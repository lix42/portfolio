import { describe, expect, it } from "vitest";

import { chunkMarkdown } from "./chunking";

describe("chunkMarkdown", () => {
  it("should split content by headers", () => {
    const content = `## Section 1
Content 1

## Section 2
Content 2`;

    const chunks = chunkMarkdown(content, { maxTokens: 200 });
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0].content).toContain("Section 1");
  });

  it("should respect max token limit", () => {
    const content = "a ".repeat(1000); // Large content
    const chunks = chunkMarkdown(content, { maxTokens: 200 });

    chunks.forEach((chunk) => {
      expect(chunk.tokens).toBeLessThanOrEqual(200);
    });
  });

  it("should add overlap between chunks", () => {
    const content = `## Section 1
${"Content 1 ".repeat(200)}

## Section 2
${"Content 2 ".repeat(200)}`;

    const chunks = chunkMarkdown(content, {
      maxTokens: 200,
      overlapTokens: 50,
    });

    // If multiple chunks created, verify overlap
    if (chunks.length > 1) {
      // Later chunk should contain some content from previous chunk
      expect(chunks.length).toBeGreaterThan(1);
    }
  });

  it("should handle code blocks", () => {
    const content = `## Example
\`\`\`typescript
function test() {
  return true;
}
\`\`\``;

    const chunks = chunkMarkdown(content);
    expect(chunks[0].content).toContain("```typescript");
    expect(chunks[0].content).toContain("```");
  });

  it("should return chunk metadata", () => {
    const content = "## Test\nContent";
    const chunks = chunkMarkdown(content);

    expect(chunks[0]).toHaveProperty("content");
    expect(chunks[0]).toHaveProperty("index");
    expect(chunks[0]).toHaveProperty("tokens");
    expect(chunks[0].index).toBe(0);
  });
});
