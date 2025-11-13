# @portfolio/shared

Shared business logic and utilities for Portfolio RAG Assistant. This package provides type-safe prompts, constants, and utilities used across document processing and query services.

## Installation

This package is part of the monorepo and is consumed internally by other packages.

```bash
# In other packages, add dependency
pnpm add @portfolio/shared --filter @portfolio/document-processor
```

## Usage

### Prompts

```typescript
import { PROMPTS, ANSWER_QUESTION_PROMPT } from '@portfolio/shared';

// Use specific prompt
const prompt = ANSWER_QUESTION_PROMPT;

// Or use PROMPTS object
const allPrompts = PROMPTS;
console.log(allPrompts.answerQuestion);
```

### Constants

```typescript
import {
  MAX_CHUNK_TOKENS,
  EMBEDDING_DIMENSIONS,
  estimateTokens
} from '@portfolio/shared';

const tokens = estimateTokens('Some text');
console.log(`Estimated ${tokens} tokens`);
```

### Chunking

```typescript
import { chunkMarkdown } from '@portfolio/shared';

const content = `## Introduction
Large markdown document...
`;

const chunks = chunkMarkdown(content, {
  maxTokens: 800,
  overlapTokens: 100
});

chunks.forEach(chunk => {
  console.log(`Chunk ${chunk.index}: ${chunk.tokens} tokens`);
});
```

### Embeddings

```typescript
import { generateEmbedding, generateEmbeddingsBatch } from '@portfolio/shared';

// Single embedding
const embedding = await generateEmbedding('Sample text', {
  apiKey: process.env.OPENAI_API_KEY
});

// Batch embeddings (more efficient)
const embeddings = await generateEmbeddingsBatch(
  ['Text 1', 'Text 2', 'Text 3'],
  { apiKey: process.env.OPENAI_API_KEY }
);
```

### Tags

```typescript
import { generateTags, parseTags, normalizeTag } from '@portfolio/shared';

// Generate tags using OpenAI
const tags = await generateTags('Technical content...', {
  apiKey: process.env.OPENAI_API_KEY
});

// Parse tags from LLM response
const parsed = parseTags('ownership, frontend_architecture');

// Normalize tag format
const normalized = normalizeTag('Frontend Architecture');
// Returns: 'frontend_architecture'
```

### Schemas

```typescript
import {
  documentMetadataSchema,
  validateDocumentMetadata,
  healthResponseSchema
} from '@portfolio/shared';

// Validate document metadata
const metadata = {
  project: 'WebForms',
  document: './webforms.md',
  company: 'DocuSign'
};

const result = validateDocumentMetadata(metadata);
if (result.success) {
  console.log('Valid:', result.data);
} else {
  console.error('Errors:', result.errors);
}

// Validate API responses
const healthResponse = { ok: true, version: '1.0.0' };
const validated = healthResponseSchema.parse(healthResponse);
```

## API Reference

### Prompts

- `PROMPTS` - Object containing all prompts
- `DEFINE_TAGS_PROMPT` - Tag definition and format guide
- `PREPROCESS_QUESTION_PROMPT` - Question validation and tag extraction
- `ANSWER_QUESTION_PROMPT` - Answer generation guidelines

### Constants

- `EMBEDDING_MODEL` - OpenAI embedding model name
- `EMBEDDING_DIMENSIONS` - Embedding vector dimensions (1536)
- `MAX_CHUNK_TOKENS` - Maximum tokens per chunk (800)
- `CHUNK_OVERLAP_TOKENS` - Overlap between chunks (100)
- `VECTOR_SEARCH_TOP_K` - Top K results for vector search (50)

### Functions

#### `chunkMarkdown(content: string, options?: ChunkOptions): Chunk[]`
Split markdown content into context-aware chunks.

#### `generateEmbedding(text: string, options: EmbeddingOptions): Promise<number[]>`
Generate embedding for single text.

#### `generateEmbeddingsBatch(texts: string[], options: EmbeddingOptions): Promise<number[][]>`
Generate embeddings for multiple texts efficiently.

#### `generateTags(content: string, options: TagGenerationOptions): Promise<string[]>`
Generate tags for content using OpenAI.

#### `parseTags(response: string): string[]`
Parse tags from various LLM response formats.

#### `normalizeTag(tag: string): string`
Normalize tag to standard format (lowercase, underscores).

#### `validateDocumentMetadata(data: unknown): ValidationResult`
Validate document metadata with detailed error messages.

### Schemas

#### `documentMetadataSchema`
Validates document metadata objects with project, document, and company fields.

#### `healthResponseSchema`
Validates health check API responses.

#### `chatRequestSchema`
Validates incoming chat request payloads.

#### `chatResponseSchema`
Validates chat response with answer and optional sources.

#### `syncOptionsSchema`
Validates R2 sync CLI options with defaults and constraints.

## Testing

```bash
pnpm test          # Run tests once
pnpm test:watch    # Run tests in watch mode
```

## Migration from documents/prompts.json

The prompts have been migrated from `documents/prompts.json` to this package for:
- Type safety with TypeScript
- Better version control
- Reusability across workers
- Prevention of accidental R2 upload

Old usage:
```typescript
const prompts = JSON.parse(readFileSync('documents/prompts.json'));
const prompt = prompts.answerQuestion.join('\n');
```

New usage:
```typescript
import { ANSWER_QUESTION_PROMPT } from '@portfolio/shared';
const prompt = ANSWER_QUESTION_PROMPT;
```

See [MIGRATION.md](./MIGRATION.md) for detailed migration guide.

## License

MIT
