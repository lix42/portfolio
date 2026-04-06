# dpp (Document Process Preview)

Local Bun CLI for previewing the chunking + tagging pipeline. No build step — Bun runs TypeScript directly.

## Purpose

Fast local feedback loop for tweaking:
- Chunking algorithm (`@portfolio/shared` → `chunkMarkdown`)
- Tag generation prompt (`@portfolio/shared` → `DEFINE_TAGS_PROMPT`)
- Document content/structure

## Architecture

```
<file.md> → chunkMarkdown() → generateTagsBatch() → chunks/ folder
                (shared)           (shared)          chunk1.md … tags.md
```

## Commands

```bash
# Run from repo root
pnpm dpp -- documents/experiments/webforms.md
pnpm dpp -- documents/experiments/webforms.md --output my-preview

# Type checking
pnpm --filter=@portfolio/dpp typecheck
```

## Source Files

| File | Purpose |
|------|---------|
| `src/index.ts` | CLI entry — arg parsing, env check, console output |
| `src/process.ts` | Read file → chunk → generate tags → return result |
| `src/write.ts` | Write chunk files and `tags.md` to output folder |

## Gotchas

- **No build step**: Bun runs `src/index.ts` directly via `pnpm exec` script.
- **Output path is relative to CWD**: When run via `pnpm dpp` from repo root, `--output chunks` resolves to `<repo-root>/chunks/`. Pass an absolute path or `cd` first if you want output elsewhere.
- **Chunking and tag functions live in `@portfolio/shared`**: To tweak chunking, edit `packages/shared/src/chunking.ts`. To tweak tags: system prompt is in `packages/shared/src/prompts.ts` (`DEFINE_TAGS_PROMPT`), user message template is in `packages/shared/src/tags.ts` (`generateTags`).
- **Rebuild shared for typecheck only**: After editing shared source, run `pnpm --filter=@portfolio/shared build` so `tsc --noEmit` picks up updated types. Bun resolves workspace source directly at runtime — no rebuild needed to run `pnpm dpp`.
