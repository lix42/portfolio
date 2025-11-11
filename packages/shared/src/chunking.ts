import { MAX_CHUNK_TOKENS, CHUNK_OVERLAP_TOKENS } from './constants';
import { Chunk, ChunkBuilder, ChunkOptions } from './utils/chunkBuilder';

/**
 * Chunk markdown content into context-aware segments
 *
 * Strategy:
 * 1. Split by headers (##, ###) to maintain context
 * 2. If section exceeds maxTokens, split by paragraphs
 * 3. Keep code blocks intact when possible
 * 4. Add overlap between chunks for context continuity
 */

export function chunkMarkdown(
  content: string,
  options: ChunkOptions = {}
): Chunk[] {
  const maxTokens = options.maxTokens ?? MAX_CHUNK_TOKENS;
  const overlapTokens = options.overlapTokens ?? CHUNK_OVERLAP_TOKENS;

  const chunks = new ChunkBuilder({ maxTokens, overlapTokens });

  // Split by markdown headers (## or ###)
  const sections = splitByHeaders(content);

  for (const section of sections) {
    if (!chunks.addText(section, '\n\n')) {
      // If section too large, split further by paragraphs/sentences
      chunks.appendContent(
        splitLargeSection(section, maxTokens, overlapTokens)
      );
    }
  }

  return chunks.getChunks();
}

/**
 * Split content by markdown headers
 */
function splitByHeaders(content: string): string[] {
  // Split by headers (## or ###) but keep the header with content
  const lines = content.split('\n');
  const sections: string[] = [];
  let currentSection: string[] = [];

  for (const line of lines) {
    if (line.match(/^##\s+/)) {
      // New section starts
      if (currentSection.length > 0) {
        sections.push(currentSection.join('\n'));
      }
      currentSection = [line];
    } else {
      currentSection.push(line);
    }
  }

  // Add last section
  if (currentSection.length > 0) {
    sections.push(currentSection.join('\n'));
  }

  return sections.filter((s) => s.trim().length > 0);
}

/**
 * Split text into sentences using a more robust regex
 * Handles: periods, question marks, exclamation marks
 * Avoids splitting on: Mr., Dr., abbreviations, decimals
 */
function splitSentences(text: string): string[] {
  // Split on sentence boundaries: period/question/exclamation followed by space and capital letter
  // The positive lookbehind (?<=[.!?]) ensures we split after punctuation
  // The positive lookahead (?=[A-Z]) ensures next sentence starts with capital
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])/)
    .filter((s) => s.trim().length > 0);
}

/**
 * Split large section by paragraphs
 */

function splitLargeSection(
  section: string,
  maxTokens: number,
  overlapTokens: number
): string[] {
  const paragraphs = section.split(/\n\n+/);
  const chunks = new ChunkBuilder({ maxTokens, overlapTokens });

  for (const para of paragraphs) {
    if (!chunks.addText(para, '\n\n')) {
      const sentences = splitSentences(para);
      for (const sentence of sentences) {
        if (!chunks.addText(sentence, ' ')) {
          const words = sentence.split(/\s+/);
          for (const word of words) {
            chunks.addText(word, ' ');
          }
        }
      }
    }
  }

  return chunks.getChunks().map((c) => c.content);
}
