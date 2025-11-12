import { describe, expect, it, vi } from 'vitest';

import { EMBEDDING_DIMENSIONS } from './constants';
import {
  cosineSimilarity,
  generateEmbedding,
  generateEmbeddingsBatch,
} from './embeddings';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: class MockOpenAI {
      embeddings = {
        create: vi.fn().mockImplementation(({ input }) => {
          const inputs = Array.isArray(input) ? input : [input];
          return Promise.resolve({
            data: inputs.map(() => ({
              embedding: new Array(EMBEDDING_DIMENSIONS).fill(0.1),
            })),
          });
        }),
      };
    },
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
  });

  describe('generateEmbeddingsBatch', () => {
    it('should generate embeddings for multiple texts', async () => {
      const embeddings = await generateEmbeddingsBatch(
        ['text1', 'text2', 'text3'],
        { apiKey }
      );

      expect(embeddings).toHaveLength(3);
      embeddings.forEach((emb) => {
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

    it('should return 0 for zero vectors', () => {
      const a = [1, 2, 3];
      const b = [0, 0, 0];
      const c = [0, 0, 0];
      expect(cosineSimilarity(a, b)).toBe(0);
      expect(cosineSimilarity(b, a)).toBe(0);
      expect(cosineSimilarity(b, c)).toBe(0);
    });
  });
});
