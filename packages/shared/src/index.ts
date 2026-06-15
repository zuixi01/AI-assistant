// Tenant types
export interface TenantConfig {
  aiModel?: string;
  aiTemperature?: number;
  welcomeMessage?: string;
  aiName?: string;
  aiAvatar?: string;
  quickQuestions?: string[];
}

// Channel types
export type Channel = 'web' | 'h5' | 'wechat_miniapp' | 'douyin_miniapp' | 'widget' | 'api';

// Intent types
export type Intent = 'consultation' | 'purchase' | 'aftersale' | 'complaint' | 'general';

// Lead status
export type LeadFollowStatus = 'new' | 'contacted' | 'interested' | 'converted' | 'invalid';

// Knowledge source types
export type KnowledgeSourceType = 'pdf' | 'docx' | 'txt' | 'markdown' | 'faq' | 'webpage' | 'product';

// Knowledge status
export type KnowledgeStatus = 'pending' | 'processing' | 'ready' | 'failed';

// Retrieval methods
export enum RetrievalMethod {
  SEMANTIC = 'semantic',
  FULL_TEXT = 'full_text',
  HYBRID = 'hybrid',
  KEYWORD = 'keyword',
}

// AI provider types
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface ChatResponse {
  content: string;
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface StreamChunk {
  content: string;
  done: boolean;
}

// Embedding types
export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

// RAG types
export interface RetrievalResult {
  chunkId: string;
  content: string;
  score: number;
  source: string;
  metadata?: Record<string, unknown>;
}

export interface Citation {
  sourceId: string;
  title: string;
  content: string;
  score: number;
}

// SSE event types
export interface SSEEvent {
  event: 'message' | 'reference' | 'done' | 'error';
  data: {
    id: string;
    content?: string;
    sources?: Citation[];
    error?: string;
  };
}

// API response wrapper
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
  };
}

export * from './public-chat-client';
