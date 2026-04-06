import { chunkMarkdown, generateTagsBatch } from "@portfolio/shared";

import type { ProcessedChunk, ProcessResult } from "./types";

export type { ProcessedChunk, ProcessResult } from "./types";

/**
 * Read a local markdown file, chunk it, and generate tags for each chunk.
 * Returns chunks with tags and a deduplicated document-level tag list.
 */
export async function processDocument(
  filePath: string,
  apiKey: string,
): Promise<ProcessResult> {
  const content = await Bun.file(filePath).text();

  const chunks = chunkMarkdown(content);
  if (chunks.length === 0) {
    return { documentTags: [], chunks: [] };
  }

  const texts = chunks.map((c) => c.content);
  const allTags = await generateTagsBatch(texts, { apiKey });

  const processedChunks: ProcessedChunk[] = chunks.map((chunk, i) => ({
    index: chunk.index,
    content: chunk.content,
    tokens: chunk.tokens,
    tags: allTags[i] ?? [],
  }));

  // Deduplicate across all chunk tags for document-level summary
  const documentTags = [
    ...new Set(processedChunks.flatMap((c) => c.tags)),
  ].sort();

  return { documentTags, chunks: processedChunks };
}
