import { describe, it, expect } from "vitest";
import {
  estimateTokens,
  exceedsTokenLimit,
  MAX_CHUNK_TOKENS,
  CHARS_PER_TOKEN,
} from "./constants";

describe("constants", () => {
  describe("estimateTokens", () => {
    it("should estimate tokens based on character count", () => {
      const text = "a".repeat(400); // 400 characters
      const tokens = estimateTokens(text);
      expect(tokens).toBe(100); // 400 / 4 = 100 tokens
    });

    it("should round up fractional tokens", () => {
      const text = "abc"; // 3 characters
      const tokens = estimateTokens(text);
      expect(tokens).toBe(1); // ceil(3 / 4) = 1
    });
  });

  describe("exceedsTokenLimit", () => {
    it("should return true when text exceeds limit", () => {
      const text = "a".repeat(MAX_CHUNK_TOKENS * CHARS_PER_TOKEN + 1);
      expect(exceedsTokenLimit(text)).toBe(true);
    });

    it("should return false when text is within limit", () => {
      const text = "a".repeat(MAX_CHUNK_TOKENS * CHARS_PER_TOKEN - 1);
      expect(exceedsTokenLimit(text)).toBe(false);
    });

    it("should accept custom limit", () => {
      const text = "a".repeat(200); // 50 tokens
      expect(exceedsTokenLimit(text, 100)).toBe(false);
      expect(exceedsTokenLimit(text, 40)).toBe(true);
    });
  });
});
