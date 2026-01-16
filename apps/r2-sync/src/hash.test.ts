import { describe, expect, it } from "vitest";

import { computeBufferHash } from "./hash.js";

describe("computeBufferHash", () => {
  it("should compute SHA-256 hash", () => {
    const buffer = Buffer.from("hello world");
    const hash = computeBufferHash(buffer);
    expect(hash).toBe(
      "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    );
  });
});
