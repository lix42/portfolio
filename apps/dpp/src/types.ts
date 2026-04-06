export interface ProcessedChunk {
  index: number;
  content: string;
  tokens: number;
  tags: string[];
}

export interface ProcessResult {
  documentTags: string[];
  chunks: ProcessedChunk[];
}
