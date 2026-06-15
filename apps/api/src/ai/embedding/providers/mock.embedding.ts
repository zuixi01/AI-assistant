import { EmbeddingProvider, EmbeddingResult } from '../embedding-provider.interface';

export class MockEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'mock';
  readonly dimensions = 1536;

  async embed(text: string): Promise<EmbeddingResult> {
    return {
      embedding: this.generateDeterministicVector(text),
      tokenCount: Math.ceil(text.length / 4),
    };
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    return texts.map((text) => ({
      embedding: this.generateDeterministicVector(text),
      tokenCount: Math.ceil(text.length / 4),
    }));
  }

  private generateDeterministicVector(text: string): number[] {
    const vector: number[] = [];
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    for (let i = 0; i < this.dimensions; i++) {
      const seed = (hash + i * 31) | 0;
      const val = Math.sin(seed) * 10000;
      vector.push(val - Math.floor(val));
    }
    const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
    return vector.map((v) => v / norm);
  }
}
