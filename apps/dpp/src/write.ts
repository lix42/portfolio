import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProcessResult } from "./types";

/**
 * Write chunks and tags to the output folder.
 * Creates (or overwrites) <outputDir>/chunk1.md, chunk2.md, ..., tags.md
 */
export async function writeOutput(
  result: ProcessResult,
  outputDir: string,
): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  // Write each chunk file
  for (const chunk of result.chunks) {
    const filename = `chunk${chunk.index + 1}.md`;
    await writeFile(join(outputDir, filename), chunk.content, "utf-8");
  }

  // Build tags.md
  const lines: string[] = ["# Tags", ""];

  lines.push("## Document");
  lines.push(
    result.documentTags.length > 0 ? result.documentTags.join(", ") : "_none_",
  );

  for (const chunk of result.chunks) {
    lines.push("");
    lines.push(`## Chunk ${chunk.index + 1}`);
    lines.push(chunk.tags.length > 0 ? chunk.tags.join(", ") : "_none_");
  }

  lines.push("");
  await writeFile(join(outputDir, "tags.md"), lines.join("\n"), "utf-8");
}
