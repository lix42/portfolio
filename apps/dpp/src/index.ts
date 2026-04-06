import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { processDocument } from "./process";
import { writeOutput } from "./write";

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    args: process.argv.slice(2),
    options: {
      output: { type: "string", default: "chunks", short: "o" },
    },
    allowPositionals: true,
  });

  const filePath = positionals[0];
  if (!filePath) {
    console.error(
      "Usage: bun src/index.ts <file> [--output <folder>]\n" +
        "  <file>              Path to the markdown file to process\n" +
        "  -o, --output <folder>   Output folder (default: chunks)",
    );
    process.exit(1);
  }

  const outputDir = values.output ?? "chunks";
  const apiKey = process.env["OPENAI_API_KEY"];
  if (!apiKey) {
    console.error("Error: OPENAI_API_KEY environment variable is not set");
    process.exit(1);
  }

  const resolvedFile = resolve(filePath);
  const resolvedOutput = resolve(outputDir);

  console.log(`Processing: ${resolvedFile}`);
  console.log(`Output:     ${resolvedOutput}`);
  console.log("");

  const result = await processDocument(resolvedFile, apiKey);

  console.log(`Chunks:  ${result.chunks.length}`);
  console.log(`Doc tags: ${result.documentTags.join(", ") || "(none)"}`);

  await writeOutput(result, resolvedOutput);

  console.log(`\nWrote to ${resolvedOutput}/`);
  for (const chunk of result.chunks) {
    console.log(
      `  chunk${chunk.index + 1}.md  [${chunk.tokens} tokens]  ${chunk.tags.join(", ")}`,
    );
  }
  console.log("  tags.md");
}

main().catch((err: unknown) => {
  console.error("Error:", err instanceof Error ? err.message : err);
  process.exit(1);
});
