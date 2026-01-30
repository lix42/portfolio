import { describe, expect, it } from "vitest";

import {
  ChatErrorResponseSchema,
  ChatRequestSchema,
  ChatSuccessResponseSchema,
  documentMetadataSchema,
  healthResponseSchema,
  isErrorChat,
  isSuccessChat,
  syncOptionsSchema,
  validateDocumentMetadata,
} from "./schemas";

describe("schemas", () => {
  describe("documentMetadataSchema", () => {
    it("should validate valid metadata", () => {
      const valid = {
        project: "WebForms",
        document: "./webforms.md",
        company: "DocuSign",
      };

      const result = documentMetadataSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject missing fields", () => {
      const invalid = {
        project: "WebForms",
        // missing document and company
      };

      const result = documentMetadataSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject empty strings", () => {
      const invalid = {
        project: "",
        document: "./webforms.md",
        company: "DocuSign",
      };

      const result = documentMetadataSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("validateDocumentMetadata", () => {
    it("should return success for valid data", () => {
      const valid = {
        project: "WebForms",
        document: "./webforms.md",
        company: "DocuSign",
      };

      const result = validateDocumentMetadata(valid);
      expect(result.success).toBe(true);
      expect(result.data).toEqual(valid);
    });

    it("should return detailed errors for invalid data", () => {
      const invalid = {
        project: "",
        // missing fields
      };

      const result = validateDocumentMetadata(invalid);
      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.length).toBeGreaterThan(0);
    });
  });

  describe("healthResponseSchema", () => {
    it("should validate health response", () => {
      const valid = {
        ok: true,
        version: "1.0.0",
        services: {
          d1: { ok: true },
          r2: { ok: true },
          vectorize: { ok: true },
        },
      };
      const result = healthResponseSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject missing fields", () => {
      const invalid = { ok: true };
      const result = healthResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject invalid types", () => {
      const invalid = {
        ok: "yes",
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

  describe("ChatRequestSchema", () => {
    it("should validate chat request", () => {
      const valid = { message: "Hello" };
      const result = ChatRequestSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject empty message", () => {
      const invalid = { message: "" };
      const result = ChatRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject missing message", () => {
      const invalid = {};
      const result = ChatRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject message exceeding max length", () => {
      const invalid = { message: "a".repeat(1001) };
      const result = ChatRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject non-string message", () => {
      const invalid = { message: 123 };
      const result = ChatRequestSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("ChatSuccessResponseSchema", () => {
    it("should validate success response", () => {
      const valid = { status: "ok", answer: "This is the answer" };
      const result = ChatSuccessResponseSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject missing answer", () => {
      const invalid = {};
      const result = ChatSuccessResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject non-string answer", () => {
      const invalid = { answer: 123 };
      const result = ChatSuccessResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("ChatErrorResponseSchema", () => {
    it("should validate error response", () => {
      const valid = { status: "error", error: "Something went wrong" };
      const result = ChatErrorResponseSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject missing error", () => {
      const invalid = {};
      const result = ChatErrorResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject non-string error", () => {
      const invalid = { error: 500 };
      const result = ChatErrorResponseSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });

  describe("isSuccessChat", () => {
    it("should return true for success response", () => {
      const response = { status: "ok" as const, answer: "This is the answer" };
      expect(isSuccessChat(response)).toBe(true);
    });

    it("should return false for error response", () => {
      const response = {
        status: "error" as const,
        error: "Something went wrong",
      };
      expect(isSuccessChat(response)).toBe(false);
    });
  });

  describe("isErrorChat", () => {
    it("should return true for error response", () => {
      const response = {
        status: "error" as const,
        error: "Something went wrong",
      };
      expect(isErrorChat(response)).toBe(true);
    });

    it("should return false for success response", () => {
      const response = { status: "ok" as const, answer: "This is the answer" };
      expect(isErrorChat(response)).toBe(false);
    });
  });

  describe("syncOptionsSchema", () => {
    it("should validate with all required fields", () => {
      const valid = {
        documentsPath: "/path/to/documents",
      };
      const result = syncOptionsSchema.safeParse(valid);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.dryRun).toBe(false);
        expect(result.data.allowDelete).toBe(false);
        expect(result.data.maxRetries).toBe(3);
      }
    });

    it("should apply default values", () => {
      const minimal = {
        documentsPath: "/path/to/documents",
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

    it("should validate with optional fields", () => {
      const valid = {
        documentsPath: "/path/to/documents",
        dryRun: true,
        allowDelete: true,
        ci: true,
        json: true,
        failFast: true,
        filePattern: "*.md",
        maxRetries: 5,
      };
      const result = syncOptionsSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it("should reject invalid maxRetries", () => {
      const invalid = {
        documentsPath: "/path/to/documents",
        maxRetries: 15, // exceeds max of 10
      };
      const result = syncOptionsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject maxRetries less than 1", () => {
      const invalid = {
        documentsPath: "/path/to/documents",
        maxRetries: 0,
      };
      const result = syncOptionsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });

    it("should reject empty documentsPath", () => {
      const invalid = {
        documentsPath: "",
      };
      const result = syncOptionsSchema.safeParse(invalid);
      expect(result.success).toBe(false);
    });
  });
});
