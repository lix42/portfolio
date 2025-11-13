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
  documentMetadataSchema,
  validateDocumentMetadata,
  healthResponseSchema,
  chatRequestSchema,
  chatResponseSchema,
  syncOptionsSchema,
} from './src/index.js';

console.log('✓ PROMPTS:', Object.keys(PROMPTS));
console.log(
  '✓ ANSWER_QUESTION_PROMPT:',
  `${ANSWER_QUESTION_PROMPT.substring(0, 50)}...`
);
console.log('✓ MAX_CHUNK_TOKENS:', MAX_CHUNK_TOKENS);
console.log('✓ chunkMarkdown:', typeof chunkMarkdown);
console.log('✓ generateEmbedding:', typeof generateEmbedding);
console.log('✓ generateTags:', typeof generateTags);
console.log('✓ estimateTokens:', estimateTokens('test'));
console.log('✓ documentMetadataSchema:', typeof documentMetadataSchema);
console.log('✓ validateDocumentMetadata:', typeof validateDocumentMetadata);
console.log('✓ healthResponseSchema:', typeof healthResponseSchema);
console.log('✓ chatRequestSchema:', typeof chatRequestSchema);
console.log('✓ chatResponseSchema:', typeof chatResponseSchema);
console.log('✓ syncOptionsSchema:', typeof syncOptionsSchema);

console.log('\n✅ All exports verified!');
