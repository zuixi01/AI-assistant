import { Injectable } from '@nestjs/common';
import { EmbeddingProviderFactory } from './embedding-provider.factory';
import { EmbeddingResult, EmbeddingProvider } from './embedding-provider.interface';
import type { ProviderConfig } from '../model-config/model-config.service';

@Injectable()
export class EmbeddingService {
  constructor(private factory: EmbeddingProviderFactory) {}

  getProvider(name?: string): EmbeddingProvider {
    return this.factory.getProvider(name);
  }

  async embed(text: string, providerName?: string): Promise<EmbeddingResult> {
    return this.getProvider(providerName).embed(text);
  }

  async embedWithConfig(text: string, providerConfig?: ProviderConfig): Promise<EmbeddingResult> {
    return this.factory.createProviderFromConfig(providerConfig).embed(text);
  }

  async embedBatch(texts: string[], providerName?: string): Promise<EmbeddingResult[]> {
    return this.getProvider(providerName).embedBatch(texts);
  }

  async embedBatchWithConfig(texts: string[], providerConfig?: ProviderConfig): Promise<EmbeddingResult[]> {
    return this.factory.createProviderFromConfig(providerConfig).embedBatch(texts);
  }
}
