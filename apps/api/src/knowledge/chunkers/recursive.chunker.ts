import { TextChunker, Chunk, ChunkOptions } from './chunker.interface';

export class RecursiveChunker implements TextChunker {
  readonly name = 'recursive';

  chunk(text: string, options?: ChunkOptions): Chunk[] {
    const chunkSize = options?.chunkSize || 500;
    const overlap = options?.chunkOverlap || 50;
    const separators = options?.separators || ['\n\n', '\n', '。', '！', '？', '；', '.', '!', '?', ';', ' '];

    return this.recursiveSplit(text, separators, chunkSize, overlap);
  }

  private recursiveSplit(text: string, separators: string[], chunkSize: number, overlap: number): Chunk[] {
    if (text.length <= chunkSize) {
      return text.trim() ? [{ content: text.trim() }] : [];
    }

    const separator = separators.find((sep) => text.includes(sep)) || '';
    if (!separator) {
      // Force split by character count
      const chunks: Chunk[] = [];
      for (let i = 0; i < text.length; i += chunkSize - overlap) {
        const end = Math.min(i + chunkSize, text.length);
        const content = text.slice(i, end).trim();
        if (content) chunks.push({ content, startIndex: i, endIndex: end });
        if (end >= text.length) break;
      }
      return chunks;
    }

    const parts = text.split(separator);
    const chunks: Chunk[] = [];
    let current = '';

    for (const part of parts) {
      const candidate = current ? current + separator + part : part;
      if (candidate.length > chunkSize && current) {
        chunks.push({ content: current.trim() });
        current = part;
      } else {
        current = candidate;
      }
    }
    if (current.trim()) {
      chunks.push({ content: current.trim() });
    }

    return chunks;
  }
}
