# Document Process Preview (dpp)

Local CLI tool for previewing the document processing pipeline. Chunks a markdown file and generates tags using the same algorithm as `document-processor`, giving fast feedback when tweaking chunking config, tag prompts, or document content — without deploying anything.

## Usage

```bash
# From repo root
pnpm dpp -- <file> [--output <folder>]

# Examples
pnpm dpp -- documents/experiments/webforms.md
pnpm dpp -- documents/experiments/webforms.md --output my-preview
```

`--output` defaults to `chunks` (relative to the repo root when run via turbo).

## Output

```
chunks/
  chunk1.md       # raw chunk text
  chunk2.md
  ...
  tags.md         # document-level + per-chunk tags
```

**`tags.md` example:**

```markdown
# Tags

## Document
frontend_architecture, ownership, problem_solving

## Chunk 1
ownership, problem_solving

## Chunk 2
frontend_architecture, react
```

## Environment Variables

- `OPENAI_API_KEY` — required for tag generation. Set in your shell or a `.env` file in `apps/dpp/` (Bun loads `.env` automatically).

## Commands

```bash
# Run (from repo root)
pnpm dpp -- <file>

# Type checking
pnpm --filter=@portfolio/dpp typecheck
```
