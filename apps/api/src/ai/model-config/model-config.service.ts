import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface ProviderConfig {
  provider: string;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export interface ModelConfig {
  llm: ProviderConfig;
  embedding: ProviderConfig;
}

@Injectable()
export class ModelConfigService {
  private readonly logger = new Logger(ModelConfigService.name);

  constructor(private prisma: PrismaService) {}

  async getConfig(tenantId: string): Promise<ModelConfig> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const cfg = (tenant?.config as Record<string, any>) || {};
    return {
      llm: cfg.modelConfig?.llm || this.getDefaultLlmConfig(),
      embedding: cfg.modelConfig?.embedding || this.getDefaultEmbeddingConfig(),
    };
  }

  private getDefaultLlmConfig(): ProviderConfig {
    const provider = process.env.AI_PROVIDER || 'mock';
    if (provider === 'openai') {
      return {
        provider,
        apiKey: process.env.OPENAI_API_KEY || '',
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      };
    }
    if (provider === 'qwen') {
      return {
        provider,
        apiKey: process.env.QWEN_API_KEY || '',
        baseUrl: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: process.env.QWEN_CHAT_MODEL || 'qwen-turbo',
      };
    }
    if (provider === 'deepseek') {
      return {
        provider,
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
        model: process.env.DEEPSEEK_CHAT_MODEL || 'deepseek-chat',
      };
    }
    return { provider: 'mock', apiKey: '', baseUrl: '', model: 'mock' };
  }

  private getDefaultEmbeddingConfig(): ProviderConfig {
    const provider = process.env.EMBEDDING_PROVIDER || 'mock';
    if (provider === 'openai') {
      return {
        provider,
        apiKey: process.env.OPENAI_API_KEY || '',
        baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
      };
    }
    if (provider === 'qwen') {
      return {
        provider,
        apiKey: process.env.QWEN_API_KEY || '',
        baseUrl: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        model: process.env.EMBEDDING_MODEL || 'text-embedding-v3',
      };
    }
    if (provider === 'deepseek') {
      return {
        provider,
        apiKey: process.env.DEEPSEEK_API_KEY || '',
        baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
        model: process.env.DEEPSEEK_EMBEDDING_MODEL || 'deepseek-embedding',
      };
    }
    return { provider: 'mock', apiKey: '', baseUrl: '', model: 'mock' };
  }

  async saveConfig(tenantId: string, config: ModelConfig): Promise<ModelConfig> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    const existing = (tenant?.config as Record<string, any>) || {};
    const newConfig = { ...existing, modelConfig: config } as any;
    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { config: newConfig },
    });
    return config;
  }

  async testLlmConnection(config: ProviderConfig): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
    if (config.provider === 'mock') {
      return { ok: true, message: 'Mock provider always available', latencyMs: 0 };
    }
    if (!config.apiKey) {
      return { ok: false, message: 'API Key is required' };
    }
    const start = Date.now();
    try {
      const response = await fetch(config.baseUrl + '/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + config.apiKey,
        },
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 5,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const latencyMs = Date.now() - start;
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        return { ok: false, message: 'HTTP ' + response.status + ': ' + errorBody.slice(0, 200), latencyMs };
      }
      return { ok: true, message: 'Connection successful', latencyMs };
    } catch (err: any) {
      return { ok: false, message: err.message || 'Connection failed', latencyMs: Date.now() - start };
    }
  }

  async testEmbeddingConnection(config: ProviderConfig): Promise<{ ok: boolean; message: string; latencyMs?: number }> {
    if (config.provider === 'mock') {
      return { ok: true, message: 'Mock provider always available', latencyMs: 0 };
    }
    if (!config.apiKey) {
      return { ok: false, message: 'API Key is required' };
    }
    const start = Date.now();
    try {
      const response = await fetch(config.baseUrl + '/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + config.apiKey,
        },
        body: JSON.stringify({
          model: config.model,
          input: 'test connection',
        }),
        signal: AbortSignal.timeout(15000),
      });
      const latencyMs = Date.now() - start;
      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        return { ok: false, message: 'HTTP ' + response.status + ': ' + errorBody.slice(0, 200), latencyMs };
      }
      return { ok: true, message: 'Connection successful', latencyMs };
    } catch (err: any) {
      return { ok: false, message: err.message || 'Connection failed', latencyMs: Date.now() - start };
    }
  }
}
