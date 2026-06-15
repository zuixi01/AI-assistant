import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmProvider } from './llm-provider.interface';
import { OpenAiLlmProvider } from './providers/openai.provider';
import { MockLlmProvider } from './providers/mock-llm.provider';
import type { ProviderConfig } from '../model-config/model-config.service';

@Injectable()
export class LlmProviderFactory {
  private providers = new Map<string, LlmProvider>();

  constructor(private config: ConfigService) {
    this.registerDefaults();
  }

  private registerDefaults() {
    const mockLatency = this.config.get<number>('MOCK_AI_LATENCY_MS', 300);
    this.providers.set('mock', new MockLlmProvider(mockLatency));

    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      this.providers.set('openai', new OpenAiLlmProvider(
        openaiKey,
        this.config.get('OPENAI_BASE_URL'),
        this.config.get('OPENAI_MODEL', 'gpt-4o-mini'),
      ));
    }

    const deepseekKey = this.config.get<string>('DEEPSEEK_API_KEY');
    if (deepseekKey) {
      this.providers.set('deepseek', new OpenAiLlmProvider(
        deepseekKey,
        this.config.get('DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1'),
        this.config.get('DEEPSEEK_CHAT_MODEL', 'deepseek-chat'),
      ));
    }

    const qwenKey = this.config.get<string>('QWEN_API_KEY');
    if (qwenKey) {
      this.providers.set('qwen', new OpenAiLlmProvider(
        qwenKey,
        'https://dashscope.aliyuncs.com/compatible-mode/v1',
        'qwen-turbo',
      ));
    }
  }

  getProvider(name?: string): LlmProvider {
    const providerName = name || this.config.get('AI_PROVIDER') || 'mock';
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`LLM provider "${providerName}" not found. Available: ${[...this.providers.keys()].join(', ')}`);
    }
    return provider;
  }

  createProviderFromConfig(config?: ProviderConfig): LlmProvider {
    if (!config) return this.getProvider();

    const providerName = config.provider?.trim() || 'mock';
    if (providerName === 'mock') {
      const mockLatency = this.config.get<number>('MOCK_AI_LATENCY_MS', 300);
      return new MockLlmProvider(mockLatency);
    }

    if (['openai', 'deepseek', 'qwen'].includes(providerName)) {
      const apiKey = config.apiKey?.trim();
      if (!apiKey) {
        throw new Error(`LLM provider "${providerName}" is missing an API key`);
      }
      return new OpenAiLlmProvider(apiKey, config.baseUrl, config.model);
    }

    const registered = this.providers.get(providerName);
    if (registered) return registered;

    throw new Error(`LLM provider "${providerName}" is not supported`);
  }

  registerProvider(name: string, provider: LlmProvider) {
    this.providers.set(name, provider);
  }
}
