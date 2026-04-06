import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ProcessResult } from "./types";

/**
 * Write chunks and tags to the output folder.
 * Clears stale chunk/tags files from prior runs, then writes fresh output.
 */
export async function writeOutput(
  result: ProcessResult,
  outputDir: string,
): Promise<void> {
  await mkdir(outputDir, { recursive: true });

  // Remove stale files from previous runs
  const existing = await readdir(outputDir).catch(() => []);
  for (const file of existing) {
    if (
      (file.startsWith("chunk") && file.endsWith(".md")) ||
      file === "tags.md"
    ) {
      await rm(join(outputDir, file), { force: true });
    }
  }

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
