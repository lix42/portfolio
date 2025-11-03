# Shared Package Design

**Component**: Shared Business Logic and Utilities
**Location**: `packages/shared/`
**Used By**: Document Processor, Query Service, R2 Sync

---

## Overview

The Shared Package contains business logic, utilities, and configurations used across multiple applications in the monorepo. It eliminates code duplication and ensures consistency.

---

## Decision: Configuration Location

### Problem Statement

Where should `prompts.json` and other shared business logic live?

**Current**: `documents/prompts.json` (mixed with document data)

**Issues**:
- `prompts.json` is business logic, not document data
- Needs to be shared by document processor and query service
- Shouldn't be uploaded to R2 with documents
- Hard to version and deploy changes

### Decision

**Create `packages/shared` package** for shared configuration and utilities.

### Rationale

1. **Separation of concerns**: Business logic separate from document data
2. **Type safety**: TypeScript types for prompts and utilities
3. **Versioning**: Can version prompts with code
4. **Reusability**: Single source of truth for all workers
5. **No R2 upload**: Not part of document sync
6. **Testable**: Can unit test utilities independently

---

## Package Structure

```
packages/shared/
├── src/
│   ├── prompts.ts           # Prompts and instructions
│   ├── chunking.ts          # Markdown chunking logic
│   ├── embeddings.ts        # Embedding utilities
│   ├── tags.ts              # Tag extraction logic
│   ├── constants.ts         # Shared constants
│   └── index.ts             # Re-exports
├── package.json
└── tsconfig.json
```

---

## Modules

### 1. Prompts (`src/prompts.ts`)

```typescript
export const PROMPTS = {
  tagExtraction: `You are an expert at analyzing technical documentation...`,
  
  chunkTagging: `Given a chunk of text, extract 3-5 relevant tags...`,
  
  questionPreprocessing: `Analyze this question and extract key tags...`,

  answerGeneration: `Based on the context provided, answer the question...`
} as const;

export type PromptKey = keyof typeof PROMPTS;
```

**Benefits**:
- Type-safe prompt keys
- Single source of truth
- Easy to update and version
- Testable with unit tests

### 2. Chunking (`src/chunking.ts`)

```typescript
export interface ChunkOptions {
  maxTokens?: number;
  overlap?: number;
}

export function chunkMarkdown(
  content: string,
  options: ChunkOptions = {}
): string[] {
  const maxTokens = options.maxTokens || 800;
  const overlap = options.overlap || 100;

  // Implementation: context-aware chunking
  // - Respect markdown headers
  // - Keep code blocks intact
  // - Maintain semantic boundaries

  return chunks;
}
```

### 3. Embeddings (`src/embeddings.ts`)

```typescript
export async function generateEmbedding(
  text: string,
  apiKey: string
): Promise<number[]> {
  const openai = new OpenAI({ apiKey });
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text
  });
  return response.data[0].embedding;
}

export async function generateEmbeddingsBatch(
  texts: string[],
  apiKey: string
): Promise<number[][]> {
  // Batch processing for efficiency
  const openai = new OpenAI({ apiKey });
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts
  });
  return response.data.map(d => d.embedding);
}
```

### 4. Tags (`src/tags.ts`)

```typescript
export async function generateTags(
  content: string,
  apiKey: string
): Promise<string[]> {
  const openai = new OpenAI({ apiKey });
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: PROMPTS.tagExtraction },
      { role: 'user', content }
    ]
  });

  // Parse tags from response
  return parseTags(response.choices[0].message.content);
}

export async function batchGenerateTags(
  texts: string[],
  apiKey: string
): Promise<string[][]> {
  // Generate tags for multiple texts
  const promises = texts.map(text => generateTags(text, apiKey));
  return Promise.all(promises);
}
```

### 5. Constants (`src/constants.ts`)

```typescript
export const EMBEDDING_MODEL = 'text-embedding-3-small';
export const EMBEDDING_DIMENSIONS = 1536;
export const MAX_CHUNK_TOKENS = 800;
export const CHUNK_OVERLAP = 100;
export const TAG_MATCH_COUNT = 50;
export const VECTOR_SEARCH_TOP_K = 50;
```

---

## Usage Examples

### In Document Processor

```typescript
import { chunkMarkdown, generateEmbeddingsBatch, PROMPTS } from '@portfolio/shared';

// Chunk document
const chunks = chunkMarkdown(content, { maxTokens: 800 });

// Generate embeddings
const embeddings = await generateEmbeddingsBatch(chunks, apiKey);
```

### In Query Service

```typescript
import { generateEmbedding, PROMPTS, VECTOR_SEARCH_TOP_K } from '@portfolio/shared';

// Generate query embedding
const embedding = await generateEmbedding(question, apiKey);

// Use in search
const results = await vectorize.query(embedding, {
  topK: VECTOR_SEARCH_TOP_K
});
```

---

## Package Configuration

```json
{
  "name": "@portfolio/shared",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "test": "vitest"
  },
  "dependencies": {
    "openai": "^4.0.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

---

## Testing

```typescript
// __tests__/chunking.test.ts
import { chunkMarkdown } from '../src/chunking';

describe('chunkMarkdown', () => {
  it('should respect max token limit', () => {
    const content = 'Large document content...';
    const chunks = chunkMarkdown(content, { maxTokens: 800 });

    chunks.forEach(chunk => {
      expect(estimateTokens(chunk)).toBeLessThanOrEqual(800);
    });
  });

  it('should maintain code block integrity', () => {
    const content = '```typescript\nfunction test() {}\n```';
    const chunks = chunkMarkdown(content);

    expect(chunks[0]).toContain('```typescript');
    expect(chunks[0]).toContain('```');
  });
});
```

---

## Migration from documents/prompts.json

```bash
# Old location
documents/prompts.json

# New location
packages/shared/src/prompts.ts

# Migration steps:
1. Convert JSON to TypeScript constants
2. Add type definitions
3. Update imports in existing code
4. Remove prompts.json from documents/
```

---

## Related Documents

- [High-Level Design](../01-high-level-design.md)
- [Document Processor](./document-processor.md) - Uses this package
- [Query Service](./query-service.md) - Uses this package
- [Implementation Plan](../02-implementation-plan.md)
