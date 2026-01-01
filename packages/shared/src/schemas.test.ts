import { describe, it, expect } from 'vitest';

import {
  documentMetadataSchema,
  validateDocumentMetadata,
  healthResponseSchema,
  chatRequestSchema,
  chatResponseSchema,
  syncOptionsSchema,
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
      const valid = {
        ok: true,
        version: '1.0.0',
        services: {
          d1: { ok: true },
          r2: { ok: true },
          vectorize: { ok: true },
        },
      };
      const result = healthResponseSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject missing fields', () => {
      const invalid = { ok: true };
      const result = healthResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject invalid types', () => {
      const invalid = {
        ok: 'yes',
        version: 123,
        services: {
          d1: { ok: true },
          r2: { ok: true },
          vectorize: { ok: true },
        },
      };
      const result = healthResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
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

    it('should reject missing message', () => {
      const invalid = {};
      const result = chatRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('chatResponseSchema', () => {
    it('should validate chat response with sources', () => {
      const valid = {
        answer: 'This is the answer',
        sources: [
          {
            document: 'doc1.md',
            chunk: 'chunk content',
            similarity: 0.95,
          },
        ],
      };
      const result = chatResponseSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should validate chat response without sources', () => {
      const valid = {
        answer: 'This is the answer',
      };
      const result = chatResponseSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject invalid source structure', () => {
      const invalid = {
        answer: 'This is the answer',
        sources: [
          {
            document: 'doc1.md',
            // missing chunk and similarity
          },
        ],
      };
      const result = chatResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe('syncOptionsSchema', () => {
    it('should validate with all required fields', () => {
      const valid = {
        documentsPath: '/path/to/documents',
      };
      const result = syncOptionsSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dryRun).toBe(false);
        expect(result.data.allowDelete).toBe(false);
        expect(result.data.maxRetries).toBe(3);
      }
    });

    it('should apply default values', () => {
      const minimal = {
        documentsPath: '/path/to/documents',
      };
      const result = syncOptionsSchema.safeParse(minimal);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dryRun).toBe(false);
        expect(result.data.allowDelete).toBe(false);
        expect(result.data.ci).toBe(false);
        expect(result.data.json).toBe(false);
        expect(result.data.failFast).toBe(false);
        expect(result.data.maxRetries).toBe(3);
      }
    });

    it('should validate with optional fields', () => {
      const valid = {
        documentsPath: '/path/to/documents',
        dryRun: true,
        allowDelete: true,
        ci: true,
        json: true,
        failFast: true,
        filePattern: '*.md',
        maxRetries: 5,
      };
      const result = syncOptionsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('should reject invalid maxRetries', () => {
      const invalid = {
        documentsPath: '/path/to/documents',
        maxRetries: 15, // exceeds max of 10
      };
      const result = syncOptionsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject maxRetries less than 1', () => {
      const invalid = {
        documentsPath: '/path/to/documents',
        maxRetries: 0,
      };
      const result = syncOptionsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it('should reject empty documentsPath', () => {
      const invalid = {
        documentsPath: '',
      };
      const result = syncOptionsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
