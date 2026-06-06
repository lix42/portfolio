# STAR Document Processing - High-Level Design (v2)

## Problem

Current documents are unstructured markdown, chunked by header/paragraph boundaries. After chunking, we lose semantic meaning — we can't tell if a chunk describes the situation, the action taken, or the result. This makes RAG answers shallow because we can't construct a structured STAR response.

## Retrieval Strategy

**Phase 1 (this work):** Tag-based retrieval only. Question → preprocess to extract tags → match sections by tags → assemble STAR context.

**Phase 2 (future):** Predefined Q&A pairs in D1, each linked to specific sections. Runtime question → embed → vector search against predefined questions → retrieve linked sections.

## Document Format

Each STAR section is a separate `.md` file with YAML frontmatter. Files can live anywhere in `documents/` — organization is purely for human convenience, not enforced.

```markdown
---
project: "network-request-middleware"
company: "Databricks"
type: "situation"
tags: ["networking", "chrome-extension"]
---

The Chrome extension needed to intercept and modify network requests...
```

Action sections include refs to related sections:

```markdown
---
project: "network-request-middleware"
company: "Databricks"
type: "action"
tags: ["networking", "api-design", "testing"]
refs:
  situation: "databricks/nrm-situation.md"
  task: "databricks/nrm-task.md"
  result: "databricks/nrm-result.md"
---

I designed a middleware layer that intercepts fetch calls...
```

**Rules:**

- `type` is one of: `situation`, `task`, `action`, `result`
- `project` + `company` link sections together (also stored in D1)
- `refs` only on `action` type. Each value is the target section's **full R2 key** — its path relative to `documents/` (e.g. `databricks/nrm-situation.md`), not a bare filename — because `resolve-refs` looks sections up by `r2_key`, and the sync client keys objects by their path under `documents/`. At most one ref per type (`situation`/`task`/`result`). Optional — missing refs are fine
- 1:n relationship per type per project (e.g., multiple `action` sections for one project)
- `tags` on every section, but especially important on `action`
- Target **2–6 KB** per section (~500–1500 tokens). If an action is longer, split into multiple action sections.

## New D1 Schema (migration 0004)

New tables — existing tables untouched to avoid breaking current flow.

```sql
CREATE TABLE IF NOT EXISTS star_sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project TEXT NOT NULL,
  company_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('situation', 'task', 'action', 'result')),
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  r2_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS star_refs (
  action_id INTEGER NOT NULL,
  ref_type TEXT NOT NULL CHECK(ref_type IN ('situation', 'task', 'result')),
  target_id INTEGER NOT NULL,
  -- One ref per type per action, matching the single-string refs in the
  -- frontmatter/Zod schema. (Use (action_id, ref_type, target_id) only if
  -- refs become arrays.)
  PRIMARY KEY (action_id, ref_type),
  FOREIGN KEY (action_id) REFERENCES star_sections(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES star_sections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS star_section_tags (
  section_id INTEGER NOT NULL,
  tag_id INTEGER NOT NULL,
  PRIMARY KEY (section_id, tag_id),
  FOREIGN KEY (section_id) REFERENCES star_sections(id) ON DELETE CASCADE,
  FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_star_sections_project ON star_sections(project);
CREATE INDEX IF NOT EXISTS idx_star_sections_type ON star_sections(type);
CREATE INDEX IF NOT EXISTS idx_star_sections_company ON star_sections(company_id);
-- No index on star_sections(r2_key): UNIQUE already creates one.
-- No index on star_refs(action_id): it is the leftmost column of the PK.
CREATE INDEX IF NOT EXISTS idx_star_refs_target ON star_refs(target_id);
CREATE INDEX IF NOT EXISTS idx_star_section_tags_tag ON star_section_tags(tag_id);
```

**Key differences from current schema:**

- No `chunks` table — each section is a single semantic unit, no sub-chunking
- No `vectorize_id` — Phase 1 is tag-only retrieval, no vector search on section content
- Refs stored as explicit relationships rather than implicit via document grouping

## Document Processor Pipeline

New step pipeline, parallel to existing (not replacing it):

```
download-star → store-star → resolve-refs → complete
```

### Step 1: `download-star`

- Download `.md` from R2
- Parse YAML frontmatter (need a YAML parser — `yaml` package or `gray-matter`)
- Validate frontmatter against `StarSectionMetadataSchema` (Zod)
- Hash content (body only, excluding frontmatter)
- Store parsed metadata + content in DO state

### Step 2: `store-star`

- `getOrCreateCompany` (reuse existing)
- Upsert into `star_sections` (keyed on `r2_key`, skip if `content_hash` unchanged)
- Create `star_section_tags` entries (reuse existing `tags` table + `getOrCreateTags`)

### Step 3: `resolve-refs`

- Only runs for `type: action` (skip for other types)
- For each ref in frontmatter (`situation`, `task`, `result`), look up `star_sections` by `r2_key`
- Delete existing refs for this action, then insert into `star_refs`
- **Tolerant** — missing refs are logged but not fatal (referenced section may not be uploaded yet; daily reconciliation will catch it)

## How to Route: STAR vs Legacy

**Detect by frontmatter.** After downloading from R2, check if the file has YAML frontmatter with a `type` field matching a STAR type. If yes → STAR pipeline. If no → legacy pipeline. Self-describing, no R2 reorganization needed.

## Shared Package Changes

New Zod schema in `packages/shared/src/schemas.ts`:

```typescript
export const starSectionTypes = ["situation", "task", "action", "result"] as const;
export type StarSectionType = (typeof starSectionTypes)[number];

const BaseStarSectionMetadataSchema = z.object({
  project: z.string().min(1),
  company: z.string().min(1),
  tags: z.array(z.string()).default([]),
});

// Discriminated union on `type` so `refs` is only accepted on `action`.
export const StarSectionMetadataSchema = z.discriminatedUnion("type", [
  BaseStarSectionMetadataSchema.extend({ type: z.literal("situation") }),
  BaseStarSectionMetadataSchema.extend({ type: z.literal("task") }),
  BaseStarSectionMetadataSchema.extend({ type: z.literal("result") }),
  BaseStarSectionMetadataSchema.extend({
    type: z.literal("action"),
    // Values are full R2 keys (path relative to documents/).
    refs: z
      .object({
        situation: z.string().optional(),
        task: z.string().optional(),
        result: z.string().optional(),
      })
      .optional(),
  }),
]);
```

New frontmatter parsing utility in `packages/shared` (or `document-processor` — depends on whether the RAG service also needs to parse frontmatter).

## What's NOT In Scope

- RAG query changes (new API endpoint to query `star_sections` + `star_refs`) — separate task
- Tag taxonomy redesign — separate task
- Predefined Q&A pairs + vector search on questions (Phase 2) — separate task
- Migration of existing documents to STAR format — manual authoring task
- Embedding section content — not needed for Phase 1

## Risks / Open Questions

1. **Ref resolution timing** — Files are uploaded independently. Action refs may point to sections not yet uploaded. Handled by: tolerant `resolve-refs` step + daily reconciliation re-runs ref resolution for actions with incomplete refs.

   ⚠️ **Reconciliation must be made STAR-aware.** The current reconciler (`apps/r2-reconciliation/src/reconcile.ts`) decides whether an R2 object is processed via `SELECT id FROM documents WHERE r2_key = ?` — it only checks the `documents` table. STAR sections live in `star_sections`, so a fully-processed STAR file would look "missing" and be **requeued every day**. Migration 0004 must ship with a reconciler change: look STAR files up in `star_sections` (and re-resolve incomplete `star_refs`) instead of treating them as unprocessed.

2. **Frontmatter parser dependency** — Need to add a YAML parsing package. `gray-matter` is popular but heavy; a lightweight `yaml` package may suffice since we just need frontmatter extraction.

3. **Tag quality** — With embedding removed, tags are the sole retrieval mechanism in Phase 1. Tag taxonomy design (separate task) becomes high priority after this ships.
