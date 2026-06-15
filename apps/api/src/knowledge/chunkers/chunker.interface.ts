export interface Chunk {
  content: string;
  q?: string;
  a?: string;
  metadata?: Record<string, any>;
  startIndex?: number;
  endIndex?: number;
}

export interface TextChunker {
  readonly name: string;
  chunk(text: string, options?: ChunkOptions): Chunk[];
}

export interface ChunkOptions {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
}
