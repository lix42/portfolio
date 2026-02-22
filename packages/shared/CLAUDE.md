# @portfolio/shared

Internal package providing shared business logic used across `@portfolio/service` and `@portfolio/document-processor`. Not published — monorepo-only.

## What's in here

| Module | Exports | Purpose |
|--------|---------|---------|
| `prompts.ts` | `PROMPTS`, `ANSWER_QUESTION_PROMPT`, `PREPROCESS_QUESTION_PROMPT`, `DEFINE_TAGS_PROMPT` | LLM prompt strings |
| `constants.ts` | `EMBEDDING_MODEL`, `EMBEDDING_DIMENSIONS`, `MAX_CHUNK_TOKENS`, `CHUNK_OVERLAP_TOKENS`, `VECTOR_SEARCH_TOP_K` | Shared numeric/string constants |
| `chunking.ts` | `chunkMarkdown` | Split markdown into ~800-token chunks with overlap |
| `embeddings.ts` | `generateEmbedding`, `generateEmbeddingsBatch` | OpenAI embedding calls |
| `tags.ts` | `generateTags`, `parseTags`, `normalizeTag` | Tag generation + normalization |
| `schemas.ts` | `documentMetadataSchema`, `healthResponseSchema`, `chatRequestSchema`, `chatResponseSchema`, `syncOptionsSchema` | Zod schemas for API contracts |
| `asyncWorker.ts` | — | Async worker utilities |
| `utils/` | — | Internal helpers |

## Commands

```bash
# Build (tsc → dist/)
pnpm build

# Watch mode
pnpm dev

# Tests
pnpm test
pnpm test:watch

# Type checking
pnpm typecheck
```

## Gotchas

- **Build required before consumers can import**: Other packages reference `dist/` output. Run `pnpm build` (or `turbo run build`) before running `@portfolio/service` or `@portfolio/document-processor` locally after making changes here.
- **Prompts live here, not in R2**: Prompts were migrated from `documents/prompts.json` to prevent accidental R2 upload and to get type safety. See `MIGRATION.md`.
- **Zod schemas are shared API contracts**: `chatRequestSchema` / `chatResponseSchema` are validated at the service boundary — changes here propagate to both the Worker and any consumers.
