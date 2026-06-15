import { TextChunker, Chunk, ChunkOptions } from './chunker.interface';

export class QAPairChunker implements TextChunker {
  readonly name = 'qa-pair';

  chunk(text: string, _options?: ChunkOptions): Chunk[] {
    const chunks: Chunk[] = [];
    // Match Q: ... A: ... patterns
    const qaPattern = /[Qq问]\s*[:：]\s*(.+?)[\n\r]+[Aa答]\s*[:：]\s*(.+?)(?=[Qq问]\s*[:：]|$)/gs;

    let match;
    while ((match = qaPattern.exec(text)) !== null) {
      const question = match[1].trim();
      const answer = match[2].trim();
      if (question && answer) {
        chunks.push({
          content: `问：${question}\n答：${answer}`,
          q: question,
          a: answer,
        });
      }
    }

    // If no QA pairs found, fall back to paragraph splitting
    if (chunks.length === 0) {
      const paragraphs = text.split(/\n\n+/).filter((p) => p.trim());
      for (const para of paragraphs) {
        chunks.push({ content: para.trim() });
      }
    }

    return chunks;
  }
}
