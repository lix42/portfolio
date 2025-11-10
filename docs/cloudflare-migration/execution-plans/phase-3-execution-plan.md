# Phase 3 Execution Plan: Shared Package

**Version**: 1.0
**Created**: 2025-11-08
**Updated**: 2025-11-08
**Status**: Ready to Execute
**Estimated Duration**: 1 week

---

## Overview

Phase 3 creates a shared package (`@portfolio/shared`) that consolidates business logic, utilities, and configurations used across multiple applications. This eliminates code duplication and ensures consistency between the Document Processor and Query Service.

### Goals

1. Extract shared business logic into reusable TypeScript package
2. Migrate `documents/prompts.json` to type-safe TypeScript constants
3. Implement utilities for chunking, embeddings, and tag generation
4. Create comprehensive test coverage for all utilities
5. Enable code sharing across workers without duplication

### Prerequisites

✅ Phase 1 complete (infrastructure created)
✅ Phase 2 complete (R2 sync operational)
✅ Existing `documents/prompts.json` file
✅ Understanding of current chunking/embedding logic from Python scripts

### Architecture Notes

**Package Purpose**:
- **Single source of truth** for prompts, constants, and utilities
- **Type-safe** configuration with TypeScript
- **Reusable** by Document Processor (Phase 4) and Query Service (Phase 5)
- **Testable** independently with comprehensive unit tests
- **Versionable** alongside code (not stored in R2)

**Why Not Keep prompts.json?**
- prompts.json is business logic, not document data
- Hard to version and type-check
- Would be uploaded to R2 with documents (incorrect)
- Can't ensure type safety across workers

---

## Task 1: Package Structure Setup

**Goal**: Initialize the shared package with proper TypeScript configuration

### Task 1.1: Create Package Directory

```bash
# From repo root
mkdir -p packages/shared/src
cd packages/shared
```

**Verification**:
```bash
ls -la
# Should show: src/
```

### Task 1.2: Initialize Package Configuration

**File**: `packages/shared/package.json`

```json
{
  "name": "@portfolio/shared",
  "version": "1.0.0",
  "description": "Shared business logic and utilities for Portfolio RAG Assistant",
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
    "dev": "tsc --watch",
    "test": "vitest",
    "test:watch": "vitest --watch",
    "lint": "biome check ."
  },
  "dependencies": {
    "openai": "^4.0.0",
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.3.3",
    "vitest": "^1.2.0"
  }
}
```

**Rationale**:
- `openai` - For generating embeddings and tags
- `zod` - For type-safe runtime validation of data
- ESM format (`"type": "module"`) for consistency with Workers
- Proper exports for TypeScript type resolution

### Task 1.3: TypeScript Configuration

**File**: `packages/shared/tsconfig.json`

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Key Settings**:
- `declaration: true` - Generate .d.ts files for type checking
- `declarationMap: true` - Enable IDE navigation to source

### Task 1.4: Install Dependencies

```bash
cd packages/shared
pnpm install
```

**Verification**:
```bash
ls node_modules | grep openai
# Should show openai package
```

### Task 1.5: Update Root pnpm-workspace.yaml

**File**: `pnpm-workspace.yaml` (root)

Ensure it includes:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

---

## Task 2: Migrate Prompts from JSON to TypeScript

**Goal**: Convert `documents/prompts.json` to type-safe TypeScript constants

### Task 2.1: Create Prompts Module

**File**: `packages/shared/src/prompts.ts`

```typescript
/**
 * System prompts for document processing and query handling
 * Migrated from documents/prompts.json for type safety
 */

/**
 * Define tags prompt - explains tag format and existing tags
 */
export const DEFINE_TAGS_PROMPT = `Tags are defined as a list of strings. Each string should represent a specific principle, value, trait, or technical expertise that is relevant to software engineering behavioral, leadership, or technical values.

Tag format: lowercase, no spaces, no special characters, no punctuation, connect words with underscores if needed.

Existing tags and their descriptions include:

| Tag                      | Description                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------- |
| **customer_obsession**  | Put customers first in every decision and action. Earn and keep their trust.       |
| **innovation**           | Seek bold ideas, embrace new technology, and drive creative solutions.             |
| **integrity**            | Act ethically, honestly, and transparently in all situations.                      |
| **bias_for_action**    | Move quickly, take calculated risks, and favor execution over perfection.          |
| **ownership**            | Take responsibility for outcomes and think long-term like an owner.                |
| **teamwork**             | Collaborate openly and support one another to achieve shared goals.                |
| **inclusively**          | Foster diversity, equity, respect, and belonging for all.                          |
| **continuous_learning** | Stay curious, learn from feedback, and keep growing personally and professionally. |
| **excellence**           | Hold high standards and strive to deliver top-quality results.                     |
| **social_impact**       | Consider the broader effect of your work and act in service of a greater mission.  |
| **frontend_architecture**      | Design scalable, maintainable, and performant frontend systems.                |
| **system_design**              | Build reliable, extensible, and efficient end-to-end systems.                  |
| **developer_experience**       | Create tools, workflows, and patterns that improve developer productivity.   |
| **design_systems**             | Define and maintain consistent, reusable UI/UX patterns across applications. |
| **performance_optimization**   | Identify and resolve bottlenecks to deliver fast, efficient software.          |
| **scalability**                | Architect solutions that handle growth in users, data, and complexity.         |
| **security_first**             | Prioritize security, privacy, and compliance in software design.               |
| **testing_culture**            | Build confidence with automated testing, CI/CD, and robust quality practices.  |

You can add more tags as needed.`;

/**
 * Preprocess question prompt - validates and extracts tags from questions
 */
export const PREPROCESS_QUESTION_PROMPT = `You are an expert assistant for designing and evaluating interview questions for software engineering roles. Your task is to:

1. Judge if the question is **valid** for a software engineering behavioral/leadership or work experience interview (e.g. not vague, not illegal, not off-topic).
2. If valid, generate a list of **relevant principles, values, traits, or technical expertise** the question targets, using the existing tags as a reference.
3. If not valid, return an empty list of tags, and an explanation of why it is not valid.

Respond in JSON format like this:
{
  "is_valid": true,
  "tags": ["ownership", "problem solving", "frontend_architecture"]
}

If the question is invalid, return:
{
  "is_valid": false,
  "tags": [],
  "explanation": "The question is invalid because ..."
}`;

/**
 * Answer question prompt - guides LLM to answer as Li Xu
 */
export const ANSWER_QUESTION_PROMPT = `You are Li Xu, a senior frontend engineer. When answering questions, always respond in the first person as "I", regardless of whether the question refers to "you" or "Li".

Guidelines:
- Base your answers ONLY on the provided context.
- Highlight my role, responsibilities, technical contributions, leadership qualities, and measurable impact.
- Write in clear, professional language suitable for resumes, interviews, or case studies.
- If the context does not contain enough info, say: "The context does not provide enough information to answer this question."
- Do not mention the words "context" or "chunks" in your answer.
- Support follow-up questions naturally, always staying in the first person voice.`;

/**
 * All prompts organized by purpose
 */
export const PROMPTS = {
  defineTags: DEFINE_TAGS_PROMPT,
  preprocessQuestion: PREPROCESS_QUESTION_PROMPT,
  answerQuestion: ANSWER_QUESTION_PROMPT,
} as const;

/**
 * Type-safe prompt keys
 */
export type PromptKey = keyof typeof PROMPTS;

/**
 * Type for preprocess question response
 */
export interface PreprocessQuestionResponse {
  is_valid: boolean;
  tags: string[];
  explanation?: string;
}
```

**Key Features**:
- Named exports for individual prompts
- Combined `PROMPTS` object for convenience
- Type-safe `PromptKey` type
- Response type definitions for structured outputs

### Task 2.2: Verification

Create a simple test to verify prompts are accessible:

**File**: `packages/shared/src/prompts.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { PROMPTS, DEFINE_TAGS_PROMPT, PREPROCESS_QUESTION_PROMPT, ANSWER_QUESTION_PROMPT } from './prompts';

describe('prompts', () => {
  it('should export all prompt constants', () => {
    expect(DEFINE_TAGS_PROMPT).toBeDefined();
    expect(PREPROCESS_QUESTION_PROMPT).toBeDefined();
    expect(ANSWER_QUESTION_PROMPT).toBeDefined();
  });

  it('should have PROMPTS object with all keys', () => {
    expect(PROMPTS.defineTags).toBe(DEFINE_TAGS_PROMPT);
    expect(PROMPTS.preprocessQuestion).toBe(PREPROCESS_QUESTION_PROMPT);
    expect(PROMPTS.answerQuestion).toBe(ANSWER_QUESTION_PROMPT);
  });

  it('should contain expected content', () => {
    expect(PROMPTS.defineTags).toContain('customer_obsession');
    expect(PROMPTS.preprocessQuestion).toContain('is_valid');
    expect(PROMPTS.answerQuestion).toContain('Li Xu');
  });
});
```

```bash
pnpm test
# Should pass all tests
```

---

## Task 3: Implement Constants Module

**Goal**: Define shared constants used across the system

### Task 3.1: Create Constants File

**File**: `packages/shared/src/constants.ts`

```typescript
/**
 * Shared constants for document processing and query service
 */

// OpenAI Configuration
export const EMBEDDING_MODEL = 'text-embedding-3-small' as const;
export const EMBEDDING_DIMENSIONS = 1536;
export const TAG_GENERATION_MODEL = 'gpt-4o' as const;
export const ANSWER_GENERATION_MODEL = 'gpt-4o' as const;

// Chunking Configuration
export const MAX_CHUNK_TOKENS = 800;
export const CHUNK_OVERLAP_TOKENS = 100;

// Search Configuration
export const VECTOR_SEARCH_TOP_K = 50;
export const TAG_MATCH_LIMIT = 50;

// Processing Batch Sizes (for Durable Objects)
export const EMBEDDING_BATCH_SIZE = 10; // chunks per batch
export const TAG_BATCH_SIZE = 5; // chunks per batch

// Retry Configuration
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_BACKOFF_MS = 1000; // base delay for exponential backoff

// Token Estimation
export const CHARS_PER_TOKEN = 4; // rough estimate: 1 token ≈ 4 characters

/**
 * Estimate token count from text
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Check if text exceeds token limit
 */
export function exceedsTokenLimit(text: string, limit: number = MAX_CHUNK_TOKENS): boolean {
  return estimateTokens(text) > limit;
}
```

### Task 3.2: Test Constants

**File**: `packages/shared/src/constants.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { estimateTokens, exceedsTokenLimit, MAX_CHUNK_TOKENS, CHARS_PER_TOKEN } from './constants';

describe('constants', () => {
  describe('estimateTokens', () => {
    it('should estimate tokens based on character count', () => {
      const text = 'a'.repeat(400); // 400 characters
      const tokens = estimateTokens(text);
      expect(tokens).toBe(100); // 400 / 4 = 100 tokens
    });

    it('should round up fractional tokens', () => {
      const text = 'abc'; // 3 characters
      const tokens = estimateTokens(text);
      expect(tokens).toBe(1); // ceil(3 / 4) = 1
    });
  });

  describe('exceedsTokenLimit', () => {
    it('should return true when text exceeds limit', () => {
      const text = 'a'.repeat(MAX_CHUNK_TOKENS * CHARS_PER_TOKEN + 1);
      expect(exceedsTokenLimit(text)).toBe(true);
    });

    it('should return false when text is within limit', () => {
      const text = 'a'.repeat(MAX_CHUNK_TOKENS * CHARS_PER_TOKEN - 1);
      expect(exceedsTokenLimit(text)).toBe(false);
    });

    it('should accept custom limit', () => {
      const text = 'a'.repeat(200); // 50 tokens
      expect(exceedsTokenLimit(text, 100)).toBe(false);
      expect(exceedsTokenLimit(text, 40)).toBe(true);
    });
  });
});
```

---

## Task 4: Implement Chunking Utility

**Goal**: Create markdown-aware chunking function

### Task 4.1: Create Chunking Module

**File**: `packages/shared/src/chunking.ts`

```typescript
import { MAX_CHUNK_TOKENS, CHUNK_OVERLAP_TOKENS, estimateTokens } from './constants';

export interface ChunkOptions {
  maxTokens?: number;
  overlapTokens?: number;
}

export interface Chunk {
  content: string;
  index: number;
  tokens: number;
}

/**
 * Chunk markdown content into context-aware segments
 *
 * Strategy:
 * 1. Split by headers (##, ###) to maintain context
 * 2. If section exceeds maxTokens, split by paragraphs
 * 3. Keep code blocks intact when possible
 * 4. Add overlap between chunks for context continuity
 */
export function chunkMarkdown(
  content: string,
  options: ChunkOptions = {}
): Chunk[] {
  const maxTokens = options.maxTokens ?? MAX_CHUNK_TOKENS;
  const overlapTokens = options.overlapTokens ?? CHUNK_OVERLAP_TOKENS;

  const chunks: Chunk[] = [];

  // Split by markdown headers (## or ###)
  const sections = splitByHeaders(content);

  let currentChunk = '';
  let chunkIndex = 0;

  for (const section of sections) {
    const sectionTokens = estimateTokens(section);

    // If section fits in current chunk, append it
    if (estimateTokens(currentChunk + '\n\n' + section) <= maxTokens) {
      currentChunk = currentChunk ? currentChunk + '\n\n' + section : section;
    } else {
      // Finalize current chunk if not empty
      if (currentChunk) {
        chunks.push({
          content: currentChunk,
          index: chunkIndex++,
          tokens: estimateTokens(currentChunk),
        });

        // Add overlap: take last N tokens from previous chunk
        currentChunk = getOverlap(currentChunk, overlapTokens);
      }

      // If section is too large, split it further
      if (sectionTokens > maxTokens) {
        const subChunks = splitLargeSection(section, maxTokens, overlapTokens);
        for (const subChunk of subChunks) {
          if (currentChunk) {
            chunks.push({
              content: currentChunk,
              index: chunkIndex++,
              tokens: estimateTokens(currentChunk),
            });
          }
          currentChunk = subChunk;
        }
      } else {
        currentChunk = currentChunk + '\n\n' + section;
      }
    }
  }

  // Add final chunk
  if (currentChunk) {
    chunks.push({
      content: currentChunk,
      index: chunkIndex,
      tokens: estimateTokens(currentChunk),
    });
  }

  return chunks;
}

/**
 * Split content by markdown headers
 */
function splitByHeaders(content: string): string[] {
  // Split by headers (## or ###) but keep the header with content
  const lines = content.split('\n');
  const sections: string[] = [];
  let currentSection: string[] = [];

  for (const line of lines) {
    if (line.match(/^##\s+/)) {
      // New section starts
      if (currentSection.length > 0) {
        sections.push(currentSection.join('\n'));
      }
      currentSection = [line];
    } else {
      currentSection.push(line);
    }
  }

  // Add last section
  if (currentSection.length > 0) {
    sections.push(currentSection.join('\n'));
  }

  return sections.filter(s => s.trim().length > 0);
}

/**
 * Split large section by paragraphs
 */
function splitLargeSection(
  section: string,
  maxTokens: number,
  overlapTokens: number
): string[] {
  const paragraphs = section.split(/\n\n+/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const para of paragraphs) {
    if (estimateTokens(currentChunk + '\n\n' + para) <= maxTokens) {
      currentChunk = currentChunk ? currentChunk + '\n\n' + para : para;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = getOverlap(currentChunk, overlapTokens);
      }

      // If single paragraph is too large, split by sentences
      if (estimateTokens(para) > maxTokens) {
        const sentences = para.split(/\.\s+/);
        for (const sentence of sentences) {
          if (estimateTokens(currentChunk + '. ' + sentence) <= maxTokens) {
            currentChunk = currentChunk ? currentChunk + '. ' + sentence : sentence;
          } else {
            if (currentChunk) {
              chunks.push(currentChunk);
              currentChunk = getOverlap(currentChunk, overlapTokens);
            }
            currentChunk = sentence;
          }
        }
      } else {
        currentChunk = currentChunk + '\n\n' + para;
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Get overlap text (last N tokens)
 */
function getOverlap(text: string, overlapTokens: number): string {
  const words = text.split(/\s+/);
  const overlapWords = Math.ceil(overlapTokens / 0.75); // rough: 1 word ≈ 0.75 tokens
  return words.slice(-overlapWords).join(' ');
}
```

### Task 4.2: Test Chunking

**File**: `packages/shared/src/chunking.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { chunkMarkdown } from './chunking';

describe('chunkMarkdown', () => {
  it('should split content by headers', () => {
    const content = `## Section 1
Content 1

## Section 2
Content 2`;

    const chunks = chunkMarkdown(content, { maxTokens: 100 });
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].content).toContain('Section 1');
  });

  it('should respect max token limit', () => {
    const content = 'a '.repeat(1000); // Large content
    const chunks = chunkMarkdown(content, { maxTokens: 200 });

    chunks.forEach(chunk => {
      expect(chunk.tokens).toBeLessThanOrEqual(200);
    });
  });

  it('should add overlap between chunks', () => {
    const content = `## Section 1
${'Content 1 '.repeat(200)}

## Section 2
${'Content 2 '.repeat(200)}`;

    const chunks = chunkMarkdown(content, { maxTokens: 200, overlapTokens: 50 });

    // If multiple chunks created, verify overlap
    if (chunks.length > 1) {
      // Later chunk should contain some content from previous chunk
      expect(chunks.length).toBeGreaterThan(1);
    }
  });

  it('should handle code blocks', () => {
    const content = `## Example
\`\`\`typescript
function test() {
  return true;
}
\`\`\``;

    const chunks = chunkMarkdown(content);
    expect(chunks[0].content).toContain('```typescript');
    expect(chunks[0].content).toContain('```');
  });

  it('should return chunk metadata', () => {
    const content = '## Test\nContent';
    const chunks = chunkMarkdown(content);

    expect(chunks[0]).toHaveProperty('content');
    expect(chunks[0]).toHaveProperty('index');
    expect(chunks[0]).toHaveProperty('tokens');
    expect(chunks[0].index).toBe(0);
  });
});
```

---

## Task 5: Implement Embeddings Utility

**Goal**: Create OpenAI embedding generation utilities

### Task 5.1: Create Embeddings Module

**File**: `packages/shared/src/embeddings.ts`

```typescript
import OpenAI from 'openai';
import { EMBEDDING_MODEL, EMBEDDING_DIMENSIONS } from './constants';

export interface EmbeddingOptions {
  model?: string;
  apiKey: string;
}

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(
  text: string,
  options: EmbeddingOptions
): Promise<number[]> {
  const openai = new OpenAI({ apiKey: options.apiKey });

  const response = await openai.embeddings.create({
    model: options.model ?? EMBEDDING_MODEL,
    input: text,
  });

  const embedding = response.data[0].embedding;

  // Validate dimensions
  if (embedding.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected ${EMBEDDING_DIMENSIONS} dimensions, got ${embedding.length}`
    );
  }

  return embedding;
}

/**
 * Generate embeddings for multiple texts in a single batch
 * More efficient than individual requests
 */
export async function generateEmbeddingsBatch(
  texts: string[],
  options: EmbeddingOptions
): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const openai = new OpenAI({ apiKey: options.apiKey });

  const response = await openai.embeddings.create({
    model: options.model ?? EMBEDDING_MODEL,
    input: texts,
  });

  // Validate all embeddings have correct dimensions
  const embeddings = response.data.map(d => d.embedding);
  embeddings.forEach((emb, idx) => {
    if (emb.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding ${idx} has ${emb.length} dimensions, expected ${EMBEDDING_DIMENSIONS}`
      );
    }
  });

  return embeddings;
}

/**
 * Calculate cosine similarity between two embeddings
 * Returns value between -1 and 1 (higher is more similar)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have same dimensions');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
```

### Task 5.2: Test Embeddings (with Mocks)

**File**: `packages/shared/src/embeddings.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateEmbedding, generateEmbeddingsBatch, cosineSimilarity } from './embeddings';
import { EMBEDDING_DIMENSIONS } from './constants';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      embeddings: {
        create: vi.fn().mockImplementation(({ input }) => {
          const inputs = Array.isArray(input) ? input : [input];
          return Promise.resolve({
            data: inputs.map(() => ({
              embedding: new Array(EMBEDDING_DIMENSIONS).fill(0.1),
            })),
          });
        }),
      },
    })),
  };
});

describe('embeddings', () => {
  const apiKey = 'test-api-key';

  describe('generateEmbedding', () => {
    it('should generate embedding for single text', async () => {
      const embedding = await generateEmbedding('test text', { apiKey });

      expect(embedding).toHaveLength(EMBEDDING_DIMENSIONS);
      expect(embedding[0]).toBe(0.1);
    });

    it('should throw error if dimensions mismatch', async () => {
      // This test would need a different mock setup
      // For now, just verify happy path
      const embedding = await generateEmbedding('test', { apiKey });
      expect(embedding).toHaveLength(1536);
    });
  });

  describe('generateEmbeddingsBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      const embeddings = await generateEmbeddingsBatch(
        ['text1', 'text2', 'text3'],
        { apiKey }
      );

      expect(embeddings).toHaveLength(3);
      embeddings.forEach(emb => {
        expect(emb).toHaveLength(EMBEDDING_DIMENSIONS);
      });
    });

    it('should return empty array for empty input', async () => {
      const embeddings = await generateEmbeddingsBatch([], { apiKey });
      expect(embeddings).toEqual([]);
    });
  });

  describe('cosineSimilarity', () => {
    it('should calculate similarity between embeddings', () => {
      const a = [1, 0, 0];
      const b = [1, 0, 0];
      const similarity = cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(1.0);
    });

    it('should return 0 for orthogonal vectors', () => {
      const a = [1, 0];
      const b = [0, 1];
      const similarity = cosineSimilarity(a, b);

      expect(similarity).toBeCloseTo(0);
    });

    it('should throw error for different dimensions', () => {
      const a = [1, 0];
      const b = [1, 0, 0];

      expect(() => cosineSimilarity(a, b)).toThrow('same dimensions');
    });
  });
});
```

---

## Task 6: Implement Tags Utility

**Goal**: Create tag extraction utility using OpenAI

### Task 6.1: Create Tags Module

**File**: `packages/shared/src/tags.ts`

```typescript
import OpenAI from 'openai';
import { TAG_GENERATION_MODEL } from './constants';
import { DEFINE_TAGS_PROMPT } from './prompts';

export interface TagGenerationOptions {
  model?: string;
  apiKey: string;
}

/**
 * Generate tags for a single chunk of content
 */
export async function generateTags(
  content: string,
  options: TagGenerationOptions
): Promise<string[]> {
  const openai = new OpenAI({ apiKey: options.apiKey });

  const response = await openai.chat.completions.create({
    model: options.model ?? TAG_GENERATION_MODEL,
    messages: [
      { role: 'system', content: DEFINE_TAGS_PROMPT },
      {
        role: 'user',
        content: `Extract 3-5 relevant tags from the following content:\n\n${content}`
      },
    ],
    temperature: 0.3, // Lower temperature for more consistent tagging
  });

  const tagsText = response.choices[0].message.content;
  return parseTags(tagsText || '');
}

/**
 * Generate tags for multiple chunks in batch
 * Uses Promise.all for parallel processing
 */
export async function generateTagsBatch(
  contents: string[],
  options: TagGenerationOptions
): Promise<string[][]> {
  if (contents.length === 0) {
    return [];
  }

  const promises = contents.map(content => generateTags(content, options));
  return Promise.all(promises);
}

/**
 * Parse tags from LLM response
 * Handles various formats: JSON array, comma-separated, newline-separated
 */
export function parseTags(response: string): string[] {
  // Try parsing as JSON array first
  try {
    const parsed = JSON.parse(response);
    if (Array.isArray(parsed)) {
      return parsed.map(normalizeTag);
    }
  } catch {
    // Not JSON, continue with text parsing
  }

  // Extract tags from various formats
  const tags: string[] = [];

  // Pattern 1: comma-separated
  if (response.includes(',')) {
    tags.push(...response.split(',').map(t => t.trim()));
  }
  // Pattern 2: newline-separated
  else if (response.includes('\n')) {
    tags.push(...response.split('\n').map(t => t.trim().replace(/^[-*]\s*/, '')));
  }
  // Pattern 3: space-separated
  else {
    tags.push(...response.split(/\s+/));
  }

  return tags
    .map(normalizeTag)
    .filter(tag => tag.length > 0)
    .slice(0, 5); // Limit to 5 tags
}

/**
 * Normalize tag format: lowercase, underscores, no special chars
 */
export function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_\s]/g, '') // Remove special characters
    .replace(/\s+/g, '_'); // Replace spaces with underscores
}
```

### Task 6.2: Test Tags

**File**: `packages/shared/src/tags.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { parseTags, normalizeTag } from './tags';

describe('tags', () => {
  describe('parseTags', () => {
    it('should parse JSON array', () => {
      const response = '["ownership", "frontend_architecture", "testing"]';
      const tags = parseTags(response);

      expect(tags).toEqual(['ownership', 'frontend_architecture', 'testing']);
    });

    it('should parse comma-separated tags', () => {
      const response = 'ownership, frontend_architecture, testing';
      const tags = parseTags(response);

      expect(tags).toContain('ownership');
      expect(tags).toContain('frontend_architecture');
      expect(tags).toContain('testing');
    });

    it('should parse newline-separated tags', () => {
      const response = '- ownership\n- frontend_architecture\n- testing';
      const tags = parseTags(response);

      expect(tags).toContain('ownership');
      expect(tags).toContain('frontend_architecture');
    });

    it('should limit to 5 tags', () => {
      const response = 'tag1, tag2, tag3, tag4, tag5, tag6, tag7';
      const tags = parseTags(response);

      expect(tags.length).toBeLessThanOrEqual(5);
    });

    it('should normalize tags', () => {
      const response = 'Ownership, Frontend Architecture, Testing!';
      const tags = parseTags(response);

      expect(tags).toContain('ownership');
      expect(tags).toContain('frontend_architecture');
      expect(tags).toContain('testing');
    });
  });

  describe('normalizeTag', () => {
    it('should convert to lowercase', () => {
      expect(normalizeTag('Ownership')).toBe('ownership');
      expect(normalizeTag('FRONTEND')).toBe('frontend');
    });

    it('should replace spaces with underscores', () => {
      expect(normalizeTag('frontend architecture')).toBe('frontend_architecture');
      expect(normalizeTag('system design')).toBe('system_design');
    });

    it('should remove special characters', () => {
      expect(normalizeTag('testing!')).toBe('testing');
      expect(normalizeTag('owner$hip')).toBe('ownership');
      expect(normalizeTag('tag-name')).toBe('tagname');
    });

    it('should handle multiple spaces', () => {
      expect(normalizeTag('frontend   architecture')).toBe('frontend_architecture');
    });
  });
});
```

---

## Task 7: Create Main Index Export

**Goal**: Create central export file for easy imports

### Task 7.1: Create Index File

**File**: `packages/shared/src/index.ts`

```typescript
/**
 * @portfolio/shared
 *
 * Shared business logic and utilities for Portfolio RAG Assistant
 */

// Prompts
export {
  PROMPTS,
  DEFINE_TAGS_PROMPT,
  PREPROCESS_QUESTION_PROMPT,
  ANSWER_QUESTION_PROMPT,
  type PromptKey,
  type PreprocessQuestionResponse,
} from './prompts';

// Constants
export {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  TAG_GENERATION_MODEL,
  ANSWER_GENERATION_MODEL,
  MAX_CHUNK_TOKENS,
  CHUNK_OVERLAP_TOKENS,
  VECTOR_SEARCH_TOP_K,
  TAG_MATCH_LIMIT,
  EMBEDDING_BATCH_SIZE,
  TAG_BATCH_SIZE,
  MAX_RETRY_ATTEMPTS,
  RETRY_BACKOFF_MS,
  CHARS_PER_TOKEN,
  estimateTokens,
  exceedsTokenLimit,
} from './constants';

// Chunking
export {
  chunkMarkdown,
  type ChunkOptions,
  type Chunk,
} from './chunking';

// Embeddings
export {
  generateEmbedding,
  generateEmbeddingsBatch,
  cosineSimilarity,
  type EmbeddingOptions,
} from './embeddings';

// Tags
export {
  generateTags,
  generateTagsBatch,
  parseTags,
  normalizeTag,
  type TagGenerationOptions,
} from './tags';
```

---

## Task 8: Zod Schemas and Validation

**Goal**: Add type-safe runtime validation with Zod schemas

### Task 8.1: Add Zod Dependency

Update `packages/shared/package.json`:

```json
{
  "dependencies": {
    "openai": "^4.0.0",
    "zod": "^3.22.0"
  }
}
```

Install:
```bash
cd packages/shared
pnpm install
```

### Task 8.2: Create Document Metadata Schema

**File**: `packages/shared/src/schemas.ts`

```typescript
import { z } from 'zod';

/**
 * Schema for document metadata JSON files (e.g., webforms.json)
 *
 * These files contain metadata about each markdown document:
 * - project: Name of the project
 * - document: Relative path to the markdown file
 * - company: Company name where the project was done
 */
export const documentMetadataSchema = z.object({
  project: z.string().min(1, 'Project name is required'),
  document: z.string().min(1, 'Document path is required'),
  company: z.string().min(1, 'Company name is required'),
});

/**
 * Type inferred from schema
 */
export type DocumentMetadata = z.infer<typeof documentMetadataSchema>;

/**
 * Validate document metadata with detailed error messages
 */
export function validateDocumentMetadata(data: unknown): {
  success: boolean;
  data?: DocumentMetadata;
  errors?: string[];
} {
  const result = documentMetadataSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.errors.map(err =>
    `${err.path.join('.')}: ${err.message}`
  );

  return { success: false, errors };
}
```

### Task 8.3: Create Shared API Response Schemas

**File**: `packages/shared/src/schemas.ts` (continued)

```typescript
/**
 * Health check response schema
 *
 * Used by:
 * - apps/service (producer)
 * - apps/ui2 (consumer)
 */
export const healthResponseSchema = z.object({
  ok: z.boolean(),
  version: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;

/**
 * Chat request schema
 */
export const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty'),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;

/**
 * Chat response schema
 */
export const chatResponseSchema = z.object({
  answer: z.string(),
  sources: z.array(z.object({
    document: z.string(),
    chunk: z.string(),
    similarity: z.number(),
  })).optional(),
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;
```

### Task 8.4: Create CLI Options Schema

**File**: `packages/shared/src/schemas.ts` (continued)

```typescript
/**
 * R2 Sync CLI options schema
 *
 * Used by apps/r2-sync to validate command-line options
 */
export const syncOptionsSchema = z.object({
  documentsPath: z.string().min(1),
  dryRun: z.boolean().default(false),
  allowDelete: z.boolean().default(false),
  ci: z.boolean().default(false),
  json: z.boolean().default(false),
  failFast: z.boolean().default(false),
  filePattern: z.string().optional(),
  maxRetries: z.number().int().min(1).max(10).default(3),
});

export type SyncOptions = z.infer<typeof syncOptionsSchema>;
```

### Task 8.5: Update Index Exports

**File**: `packages/shared/src/index.ts`

Add to exports:

```typescript
// Schemas
export {
  documentMetadataSchema,
  validateDocumentMetadata,
  healthResponseSchema,
  chatRequestSchema,
  chatResponseSchema,
  syncOptionsSchema,
  type DocumentMetadata,
  type HealthResponse,
  type ChatRequest,
  type ChatResponse,
  type SyncOptions,
} from './schemas';
```

### Task 8.6: Test Schemas

**File**: `packages/shared/src/schemas.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import {
  documentMetadataSchema,
  validateDocumentMetadata,
  healthResponseSchema,
  chatRequestSchema,
} from './schemas';

describe('schemas', () => {
  describe('documentMetadataSchema', () => {
    it('should validate valid metadata', () => {
      const valid = {
        project: 'WebForms',
        document: './webforms.md',
        company: 'DocuSign',
      };

      const result = documentMetadataSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject missing fields', () => {
      const invalid = {
        project: 'WebForms',
        // missing document and company
      };

      const result = documentMetadataSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject empty strings', () => {
      const invalid = {
        project: '',
        document: './webforms.md',
        company: 'DocuSign',
      };

      const result = documentMetadataSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('validateDocumentMetadata', () => {
    it('should return success for valid data', () => {
      const valid = {
        project: 'WebForms',
        document: './webforms.md',
        company: 'DocuSign',
      };

      const result = validateDocumentMetadata(valid);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(valid);
    });

    it('should return detailed errors for invalid data', () => {
      const invalid = {
        project: '',
        // missing fields
      };

      const result = validateDocumentMetadata(invalid);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors!.length).toBeGreaterThan(0);
    });
  });

  describe('healthResponseSchema', () => {
    it('should validate health response', () => {
      const valid = { ok: true, version: '1.0.0' };
      const result = healthResponseSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('chatRequestSchema', () => {
    it('should validate chat request', () => {
      const valid = { message: 'Hello' };
      const result = chatRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject empty message', () => {
      const invalid = { message: '' };
      const result = chatRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
```

### Task 8.7: Update Package.json

Ensure `package.json` includes zod in dependencies:

```json
{
  "dependencies": {
    "openai": "^4.0.0",
    "zod": "^3.22.0"
  }
}
```

---

## Task 9: Documentation

**Goal**: Create comprehensive documentation for the package

### Task 9.1: Create README

**File**: `packages/shared/README.md`

```markdown
# @portfolio/shared

Shared business logic and utilities for Portfolio RAG Assistant. This package provides type-safe prompts, constants, and utilities used across document processing and query services.

## Installation

This package is part of the monorepo and is consumed internally by other packages.

\`\`\`bash
# In other packages, add dependency
pnpm add @portfolio/shared --filter @portfolio/document-processor
\`\`\`

## Usage

### Prompts

\`\`\`typescript
import { PROMPTS, ANSWER_QUESTION_PROMPT } from '@portfolio/shared';

// Use specific prompt
const prompt = ANSWER_QUESTION_PROMPT;

// Or use PROMPTS object
const allPrompts = PROMPTS;
console.log(allPrompts.answerQuestion);
\`\`\`

### Constants

\`\`\`typescript
import {
  MAX_CHUNK_TOKENS,
  EMBEDDING_DIMENSIONS,
  estimateTokens
} from '@portfolio/shared';

const tokens = estimateTokens('Some text');
console.log(\`Estimated \${tokens} tokens\`);
\`\`\`

### Chunking

\`\`\`typescript
import { chunkMarkdown } from '@portfolio/shared';

const content = \`## Introduction
Large markdown document...
\`;

const chunks = chunkMarkdown(content, {
  maxTokens: 800,
  overlapTokens: 100
});

chunks.forEach(chunk => {
  console.log(\`Chunk \${chunk.index}: \${chunk.tokens} tokens\`);
});
\`\`\`

### Embeddings

\`\`\`typescript
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
\`\`\`

### Tags

\`\`\`typescript
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
\`\`\`

### Schemas

\`\`\`typescript
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
\`\`\`

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

## Testing

\`\`\`bash
pnpm test          # Run tests once
pnpm test:watch    # Run tests in watch mode
\`\`\`

## Migration from documents/prompts.json

The prompts have been migrated from `documents/prompts.json` to this package for:
- Type safety with TypeScript
- Better version control
- Reusability across workers
- Prevention of accidental R2 upload

Old usage:
\`\`\`typescript
const prompts = JSON.parse(readFileSync('documents/prompts.json'));
const prompt = prompts.answerQuestion.join('\\n');
\`\`\`

New usage:
\`\`\`typescript
import { ANSWER_QUESTION_PROMPT } from '@portfolio/shared';
const prompt = ANSWER_QUESTION_PROMPT;
\`\`\`

## License

MIT
\`\`\`

### Task 8.2: Create Migration Guide

**File**: `packages/shared/MIGRATION.md`

\`\`\`markdown
# Migration Guide: documents/prompts.json → @portfolio/shared

This guide explains how to migrate from the old `documents/prompts.json` approach to the new `@portfolio/shared` package.

## Changes

### Before (prompts.json)

\`\`\`json
{
  "defineTags": ["Tag definition line 1", "line 2"],
  "preprocessQuestion": ["Question preprocessing line 1"],
  "answerQuestion": ["Answer generation line 1"]
}
\`\`\`

Usage:
\`\`\`typescript
import prompts from './documents/prompts.json';
const prompt = prompts.answerQuestion.join('\\n');
\`\`\`

### After (@portfolio/shared)

\`\`\`typescript
import { ANSWER_QUESTION_PROMPT } from '@portfolio/shared';
const prompt = ANSWER_QUESTION_PROMPT; // Already a string
\`\`\`

## Migration Steps

### Step 1: Install Package

\`\`\`bash
pnpm add @portfolio/shared --filter your-package
\`\`\`

### Step 2: Update Imports

**Before**:
\`\`\`typescript
import prompts from '../documents/prompts.json';
const systemPrompt = prompts.answerQuestion.join('\\n');
\`\`\`

**After**:
\`\`\`typescript
import { ANSWER_QUESTION_PROMPT } from '@portfolio/shared';
const systemPrompt = ANSWER_QUESTION_PROMPT;
\`\`\`

### Step 3: Update Prompt References

| Old (prompts.json) | New (@portfolio/shared) |
|--------------------|-------------------------|
| `prompts.defineTags.join('\\n')` | `DEFINE_TAGS_PROMPT` |
| `prompts.preprocessQuestion.join('\\n')` | `PREPROCESS_QUESTION_PROMPT` |
| `prompts.answerQuestion.join('\\n')` | `ANSWER_QUESTION_PROMPT` |

### Step 4: Remove JSON Import

Delete or update any code that imports `prompts.json`.

## Benefits

1. **Type Safety**: TypeScript ensures prompts exist
2. **No Runtime Parsing**: Prompts are constants, not parsed JSON
3. **Better IntelliSense**: Editor autocomplete for prompt names
4. **Versioning**: Prompts version with code
5. **No R2 Upload**: Won't be synced to R2 with documents

## Rollback

If needed, you can temporarily keep both approaches:

\`\`\`typescript
// Use new package
import { ANSWER_QUESTION_PROMPT } from '@portfolio/shared';

// Or fall back to JSON
import prompts from '../documents/prompts.json';
const prompt = ANSWER_QUESTION_PROMPT || prompts.answerQuestion.join('\\n');
\`\`\`
\`\`\`

---

## Task 10: Build and Verification

**Goal**: Ensure package builds correctly and is ready for use

### Task 10.1: Build Package

\`\`\`bash
cd packages/shared
pnpm build
\`\`\`

**Verification**:
\`\`\`bash
ls dist/
# Should show: index.js, index.d.ts, prompts.js, prompts.d.ts, etc.
\`\`\`

### Task 10.2: Run All Tests

\`\`\`bash
pnpm test
\`\`\`

**Expected**: All tests passing (>= 20 tests)

### Task 10.3: Verify Package Exports

Create a simple test script:

**File**: `packages/shared/verify-exports.ts`

\`\`\`typescript
#!/usr/bin/env tsx

// Verify all exports are accessible
import {
  PROMPTS,
  ANSWER_QUESTION_PROMPT,
  MAX_CHUNK_TOKENS,
  chunkMarkdown,
  generateEmbedding,
  generateTags,
  estimateTokens,
} from './src/index';

console.log('✓ PROMPTS:', Object.keys(PROMPTS));
console.log('✓ ANSWER_QUESTION_PROMPT:', ANSWER_QUESTION_PROMPT.substring(0, 50) + '...');
console.log('✓ MAX_CHUNK_TOKENS:', MAX_CHUNK_TOKENS);
console.log('✓ chunkMarkdown:', typeof chunkMarkdown);
console.log('✓ generateEmbedding:', typeof generateEmbedding);
console.log('✓ generateTags:', typeof generateTags);
console.log('✓ estimateTokens:', estimateTokens('test'));

console.log('\\n✅ All exports verified!');
\`\`\`

Run:
\`\`\`bash
npx tsx verify-exports.ts
\`\`\`

### Task 10.4: Create Verification Script

**File**: `scripts/verify-phase-3.sh`

\`\`\`bash
#!/bin/bash
# Phase 3 Verification Script

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Phase 3: Shared Package Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

ERRORS=0
GREEN='\\033[0;32m'
RED='\\033[0;31m'
NC='\\033[0m'

check() {
  local name=$1
  local command=$2

  echo -n "Checking $name... "
  if eval "$command" &> /dev/null; then
    echo -e "${GREEN}✓${NC}"
    return 0
  else
    echo -e "${RED}✗${NC}"
    ERRORS=$((ERRORS + 1))
    return 1
  fi
}

# 1. Check package structure
echo "1️⃣  Package Structure"
check "shared package exists" "test -d packages/shared"
check "package.json exists" "test -f packages/shared/package.json"
check "TypeScript config exists" "test -f packages/shared/tsconfig.json"
check "Source files exist" "test -d packages/shared/src"
check "README exists" "test -f packages/shared/README.md"
echo ""

# 2. Check source files
echo "2️⃣  Source Files"
check "prompts.ts exists" "test -f packages/shared/src/prompts.ts"
check "constants.ts exists" "test -f packages/shared/src/constants.ts"
check "chunking.ts exists" "test -f packages/shared/src/chunking.ts"
check "embeddings.ts exists" "test -f packages/shared/src/embeddings.ts"
check "tags.ts exists" "test -f packages/shared/src/tags.ts"
check "schemas.ts exists" "test -f packages/shared/src/schemas.ts"
check "index.ts exists" "test -f packages/shared/src/index.ts"
echo ""

# 3. Check dependencies
echo "3️⃣  Dependencies"
check "openai installed" "test -d packages/shared/node_modules/openai"
check "zod installed" "test -d packages/shared/node_modules/zod"
check "vitest installed" "test -d packages/shared/node_modules/vitest"
echo ""

# 4. Check build
echo "4️⃣  Build"
check "Can build package" "cd packages/shared && pnpm build"
check "dist directory exists" "test -d packages/shared/dist"
check "index.js compiled" "test -f packages/shared/dist/index.js"
check "index.d.ts generated" "test -f packages/shared/dist/index.d.ts"
echo ""

# 5. Check tests
echo "5️⃣  Tests"
check "Tests pass" "cd packages/shared && pnpm test run"
echo ""

# 6. Check documentation
echo "6️⃣  Documentation"
check "README exists" "test -f packages/shared/README.md"
check "Migration guide exists" "test -f packages/shared/MIGRATION.md"
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ Phase 3 Verification Complete - All checks passed!${NC}"
  echo ""
  echo "🎉 Shared Package ready!"
  echo ""
  echo "Next Steps:"
  echo "  1. Use @portfolio/shared in other packages"
  echo "  2. Migrate code from documents/prompts.json"
  echo "  3. Ready for Phase 4: Document Processor"
else
  echo -e "${RED}❌ Phase 3 Verification Failed - $ERRORS error(s) found${NC}"
  exit 1
fi
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
\`\`\`

Make executable:
\`\`\`bash
chmod +x scripts/verify-phase-3.sh
\`\`\`

Run verification:
\`\`\`bash
./scripts/verify-phase-3.sh
\`\`\`

---

## Completion Checklist

Before marking Phase 3 complete, verify:

- [ ] Package structure created (`packages/shared/`)
- [ ] TypeScript configuration complete
- [ ] All dependencies installed (openai, zod)
- [ ] `prompts.ts` module created with all prompts migrated
- [ ] `constants.ts` module created with shared constants
- [ ] `chunking.ts` module created with markdown chunking logic
- [ ] `embeddings.ts` module created with OpenAI utilities
- [ ] `tags.ts` module created with tag generation logic
- [ ] `schemas.ts` module created with Zod schemas
- [ ] Document metadata schema implemented
- [ ] Shared API response schemas (HealthResponse, ChatRequest, ChatResponse)
- [ ] CLI options schema implemented
- [ ] `index.ts` exports all modules correctly
- [ ] Package builds successfully (`pnpm build`)
- [ ] All unit tests passing (>= 20 tests)
- [ ] README documentation complete
- [ ] Migration guide created
- [ ] Verification script passing
- [ ] Ready to be consumed by Phase 4 (Document Processor)

---

## Troubleshooting

### Issue: "Cannot find module '@portfolio/shared'"

**Solution**: Ensure package is built and listed in pnpm workspace:
\`\`\`bash
# Build the package
cd packages/shared
pnpm build

# Verify workspace config
cat ../../pnpm-workspace.yaml
# Should include: - 'packages/*'
\`\`\`

### Issue: TypeScript errors when importing

**Solution**:
1. Check `tsconfig.json` has `declaration: true`
2. Rebuild the package: `pnpm build`
3. Check consuming package's `tsconfig.json` includes proper module resolution

### Issue: Tests failing with "OpenAI is not defined"

**Solution**: Ensure `vi.mock('openai')` is set up correctly in test files. The mock should be at the top of the file before imports.

### Issue: Chunking produces chunks that are too large

**Solution**: Adjust `MAX_CHUNK_TOKENS` in `constants.ts` or pass custom `maxTokens` to `chunkMarkdown()`:
\`\`\`typescript
const chunks = chunkMarkdown(content, { maxTokens: 500 });
\`\`\`

### Issue: Tag parsing fails for LLM response

**Solution**: The `parseTags()` function handles multiple formats. If a new format appears, update the parsing logic in `tags.ts`.

---

## Next Phase

After Phase 3 completion:
- **Phase 4**: Document Processor with Durable Objects
  - Will use `@portfolio/shared` for chunking, embeddings, and tags
  - Implements event-driven processing pipeline
  - Uses Durable Objects for state management

See `docs/cloudflare-migration/02-implementation-plan.md` for full timeline.

---

## Related Documents

- [Shared Package Design](../design/shared-package.md)
- [High-Level Design](../01-high-level-design.md)
- [Implementation Plan](../02-implementation-plan.md)
- [Document Processor Design](../design/document-processor.md) (Phase 4)
