import {
  CHUNK_OVERLAP_TOKENS,
  estimateTokens,
  MAX_CHUNK_TOKENS,
} from '../constants';
export interface ChunkOptions {
  maxTokens?: number;
  overlapTokens?: number;
}

export interface Chunk {
  content: string;
  index: number;
  tokens: number;
}

export class ChunkBuilder {
  private maxTokens: number;
  private overlapTokens: number;
  private currentChunk: string;
  private chunkIndex: number;
  private chunks: Chunk[];

  constructor({ maxTokens, overlapTokens }: ChunkOptions = {}) {
    this.maxTokens = maxTokens ?? MAX_CHUNK_TOKENS;
    this.overlapTokens = overlapTokens ?? CHUNK_OVERLAP_TOKENS;
    this.currentChunk = '';
    this.chunkIndex = 0;
    this.chunks = [];
  }

  addText(text: string, connector = ' ') {
    if (
      estimateTokens(text + connector) >
      this.maxTokens - this.overlapTokens
    ) {
      return false;
    }
    if (estimateTokens(this.currentChunk + connector + text) > this.maxTokens) {
      this.flush();
    }
    this.currentChunk += (this.currentChunk ? connector : '') + text;
    return true;
  }

  flush() {
    if (this.currentChunk) {
      this.chunks.push({
        content: this.currentChunk,
        index: this.chunkIndex++,
        tokens: estimateTokens(this.currentChunk),
      });
      this.currentChunk = getOverlap(this.currentChunk, this.overlapTokens);
    }
  }

  appendContent(content: string[]) {
    if (content.some((chunk) => estimateTokens(chunk) > this.maxTokens)) {
      return false;
    }
    this.flush();
    for (const chunk of content) {
      this.chunks.push({
        content: chunk,
        index: this.chunkIndex++,
        tokens: estimateTokens(chunk),
      });
    }
    return true;
  }

  getChunks(clean = false): Chunk[] {
    this.flush();
    const result = this.chunks;
    if (clean) {
      this.chunks = [];
      this.currentChunk = '';
      this.chunkIndex = 0;
    }
    return result;
  }
}

/**
 * Get overlap text (last N tokens)
 */
export function getOverlap(text: string, overlapTokens: number): string {
  const words = text.split(/\s+/);
  const overlapWords = Math.ceil(overlapTokens / 0.75); // rough: 1 word ≈ 0.75 tokens
  return words.slice(-overlapWords).join(' ');
}
