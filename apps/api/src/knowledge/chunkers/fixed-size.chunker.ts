import { TextChunker, Chunk, ChunkOptions } from './chunker.interface';

export class FixedSizeChunker implements TextChunker {
  readonly name = 'fixed-size';

  chunk(text: string, options?: ChunkOptions): Chunk[] {
    const chunkSize = options?.chunkSize || 500;
    const overlap = options?.chunkOverlap || 50;
    const chunks: Chunk[] = [];

    for (let i = 0; i < text.length; i += chunkSize - overlap) {
      const end = Math.min(i + chunkSize, text.length);
      const content = text.slice(i, end).trim();
      if (content.length > 0) {
        chunks.push({ content, startIndex: i, endIndex: end });
      }
      if (end >= text.length) break;
    }

    return chunks;
  }
}
