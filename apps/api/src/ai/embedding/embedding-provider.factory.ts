import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmbeddingProvider } from './embedding-provider.interface';
import { OpenAiEmbeddingProvider } from './providers/openai.embedding';
import { MockEmbeddingProvider } from './providers/mock.embedding';
import { DeepSeekEmbeddingProvider } from './providers/deepseek.embedding';
import type { ProviderConfig } from '../model-config/model-config.service';

@Injectable()
export class EmbeddingProviderFactory {
  private providers = new Map<string, EmbeddingProvider>();

  constructor(private config: ConfigService) {
    this.registerDefaults();
  }

  private registerDefaults() {
    this.providers.set('mock', new MockEmbeddingProvider());

    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      this.providers.set('openai', new OpenAiEmbeddingProvider(
        openaiKey,
        this.config.get('OPENAI_BASE_URL'),
        this.config.get('EMBEDDING_MODEL', 'text-embedding-3-small'),
      ));
    }

    // Qwen (Dashscope) uses OpenAI-compatible API
    const qwenKey = this.config.get<string>('QWEN_API_KEY');
    if (qwenKey) {
      this.providers.set('qwen', new OpenAiEmbeddingProvider(
        qwenKey,
        this.config.get('QWEN_BASE_URL', 'https://dashscope.aliyuncs.com/compatible-mode/v1'),
        this.config.get('EMBEDDING_MODEL', 'text-embedding-v3'),
      ));
    }
  }

  getProvider(name?: string): EmbeddingProvider {
    const providerName = name || this.config.get('EMBEDDING_PROVIDER') || 'mock';
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Embedding provider "${providerName}" not found`);
    }
    return provider;
  }

  createProviderFromConfig(config?: ProviderConfig): EmbeddingProvider {
    if (!config) return this.getProvider();

    const providerName = config.provider?.trim() || 'mock';
    if (providerName === 'mock') return new MockEmbeddingProvider();

    const apiKey = config.apiKey?.trim();
    if (!apiKey) {
      throw new Error(`Embedding provider "${providerName}" is missing an API key`);
    }

    if (providerName === 'deepseek') {
      return new DeepSeekEmbeddingProvider(apiKey, config.baseUrl, config.model);
    }
    if (['openai', 'qwen'].includes(providerName)) {
      return new OpenAiEmbeddingProvider(apiKey, config.baseUrl, config.model);
    }

    const registered = this.providers.get(providerName);
    if (registered) return registered;

    throw new Error(`Embedding provider "${providerName}" is not supported`);
  }

  registerProvider(name: string, provider: EmbeddingProvider) {
    this.providers.set(name, provider);
  }
}
