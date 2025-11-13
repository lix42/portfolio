# Migration Guide: documents/prompts.json → @portfolio/shared

This guide explains how to migrate from the old `documents/prompts.json` approach to the new `@portfolio/shared` package.

## Changes

### Before (prompts.json)

```json
{
  "defineTags": ["Tag definition line 1", "line 2"],
  "preprocessQuestion": ["Question preprocessing line 1"],
  "answerQuestion": ["Answer generation line 1"]
}
```

Usage:
```typescript
import prompts from './documents/prompts.json';
const prompt = prompts.answerQuestion.join('\n');
```

### After (@portfolio/shared)

```typescript
import { ANSWER_QUESTION_PROMPT } from '@portfolio/shared';
const prompt = ANSWER_QUESTION_PROMPT; // Already a string
```

## Migration Steps

### Step 1: Install Package

```bash
pnpm add @portfolio/shared --filter your-package
```

### Step 2: Update Imports

**Before**:
```typescript
import prompts from '../documents/prompts.json';
const systemPrompt = prompts.answerQuestion.join('\n');
```

**After**:
```typescript
import { ANSWER_QUESTION_PROMPT } from '@portfolio/shared';
const systemPrompt = ANSWER_QUESTION_PROMPT;
```

### Step 3: Update Prompt References

| Old (prompts.json) | New (@portfolio/shared) |
|--------------------|-------------------------|
| `prompts.defineTags.join('\n')` | `DEFINE_TAGS_PROMPT` |
| `prompts.preprocessQuestion.join('\n')` | `PREPROCESS_QUESTION_PROMPT` |
| `prompts.answerQuestion.join('\n')` | `ANSWER_QUESTION_PROMPT` |

### Step 4: Remove JSON Import

Delete or update any code that imports `prompts.json`.

## Benefits

1. **Type Safety**: TypeScript ensures prompts exist
2. **No Runtime Parsing**: Prompts are constants, not parsed JSON
3. **Better IntelliSense**: Editor autocomplete for prompt names
4. **Versioning**: Prompts version with code
5. **No R2 Upload**: Won't be synced to R2 with documents

## Example: Full Migration

### Before

```typescript
import prompts from '../../documents/prompts.json';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: prompts.answerQuestion.join('\n')
    },
    {
      role: 'user',
      content: question
    }
  ]
});
```

### After

```typescript
import { ANSWER_QUESTION_PROMPT } from '@portfolio/shared';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });

const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [
    {
      role: 'system',
      content: ANSWER_QUESTION_PROMPT
    },
    {
      role: 'user',
      content: question
    }
  ]
});
```

## Using Other Utilities

While migrating, you can also adopt other utilities from `@portfolio/shared`:

### Constants

```typescript
import {
  MAX_CHUNK_TOKENS,
  EMBEDDING_MODEL,
  estimateTokens
} from '@portfolio/shared';

// Use constants instead of hardcoded values
const tokens = estimateTokens(text);
```

### Chunking

```typescript
import { chunkMarkdown } from '@portfolio/shared';

// Replace custom chunking logic
const chunks = chunkMarkdown(content, {
  maxTokens: 800,
  overlapTokens: 100
});
```

### Embeddings

```typescript
import { generateEmbeddingsBatch } from '@portfolio/shared';

// More efficient batch processing
const embeddings = await generateEmbeddingsBatch(texts, {
  apiKey: env.OPENAI_API_KEY
});
```

### Schemas

```typescript
import { validateDocumentMetadata } from '@portfolio/shared';

// Type-safe validation
const result = validateDocumentMetadata(data);
if (result.success) {
  // Use result.data with full type safety
  processMetadata(result.data);
} else {
  // Handle validation errors
  console.error(result.errors);
}
```

## Rollback

If needed, you can temporarily keep both approaches:

```typescript
// Use new package
import { ANSWER_QUESTION_PROMPT } from '@portfolio/shared';

// Or fall back to JSON
import prompts from '../documents/prompts.json';
const prompt = ANSWER_QUESTION_PROMPT || prompts.answerQuestion.join('\n');
```

## Testing After Migration

1. **Build your package**:
   ```bash
   pnpm build
   ```

2. **Run tests**:
   ```bash
   pnpm test
   ```

3. **Verify type checking**:
   ```bash
   pnpm exec tsc --noEmit
   ```

4. **Check imports work**:
   ```typescript
   import { ANSWER_QUESTION_PROMPT } from '@portfolio/shared';
   console.log(ANSWER_QUESTION_PROMPT.substring(0, 50));
   ```

## Common Issues

### Issue: "Cannot find module '@portfolio/shared'"

**Solution**: Ensure the package is built and workspace is configured:
```bash
cd packages/shared
pnpm build

# Verify workspace includes shared package
cat ../../pnpm-workspace.yaml
```

### Issue: "Property 'ANSWER_QUESTION_PROMPT' does not exist"

**Solution**: Check your import path and rebuild:
```bash
pnpm --filter @portfolio/shared build
```

### Issue: TypeScript errors after migration

**Solution**: Ensure your tsconfig.json has proper module resolution:
```json
{
  "compilerOptions": {
    "moduleResolution": "bundler"
  }
}
```

## Support

If you encounter issues during migration, check:
- [README.md](./README.md) for usage examples
- Package tests in `src/*.test.ts` for reference implementations
- Build output in `dist/` for available exports
