import { Injectable } from '@nestjs/common';
import { LlmProviderFactory } from './llm-provider.factory';
import { ChatMessage, ChatOptions, ChatResult, StreamChunk, LlmProvider } from './llm-provider.interface';
import type { ProviderConfig } from '../model-config/model-config.service';

@Injectable()
export class LlmService {
  constructor(private factory: LlmProviderFactory) {}

  getProvider(name?: string): LlmProvider {
    return this.factory.getProvider(name);
  }

  async chat(messages: ChatMessage[], options?: ChatOptions, providerName?: string): Promise<ChatResult> {
    return this.getProvider(providerName).chat(messages, options);
  }

  async chatWithConfig(
    messages: ChatMessage[],
    options?: ChatOptions,
    providerConfig?: ProviderConfig,
  ): Promise<ChatResult> {
    return this.factory.createProviderFromConfig(providerConfig).chat(messages, options);
  }

  async *chatStream(messages: ChatMessage[], options?: ChatOptions, providerName?: string): AsyncGenerator<StreamChunk> {
    yield* this.getProvider(providerName).chatStream(messages, options);
  }

  async *chatStreamWithConfig(
    messages: ChatMessage[],
    options?: ChatOptions,
    providerConfig?: ProviderConfig,
  ): AsyncGenerator<StreamChunk> {
    yield* this.factory.createProviderFromConfig(providerConfig).chatStream(messages, options);
  }
}
