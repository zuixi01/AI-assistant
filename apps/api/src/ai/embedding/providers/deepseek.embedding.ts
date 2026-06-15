import { EmbeddingProvider, EmbeddingResult } from '../embedding-provider.interface';

export class DeepSeekEmbeddingProvider implements EmbeddingProvider {
  readonly name = 'deepseek';
  readonly dimensions = 1536;
  private apiKey: string;
  private baseUrl: string;
  private model: string;

  constructor(apiKey: string, baseUrl?: string, model?: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl || 'https://api.deepseek.com/v1';
    this.model = model || 'deepseek-embedding';
  }

  async embed(text: string): Promise<EmbeddingResult> {
    const results = await this.embedBatch([text]);
    return results[0];
  }

  async embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`DeepSeek Embedding API error: ${response.status} ${error}`);
    }

    const data = await response.json();
    return data.data.map((item: any, index: number) => ({
      embedding: item.embedding,
      tokenCount: data.usage?.prompt_tokens || Math.ceil(texts[index].length / 4),
    }));
  }
}
