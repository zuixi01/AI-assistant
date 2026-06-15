export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  stop?: string[];
  signal?: AbortSignal;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  usage?: { promptTokens: number; completionTokens: number };
}

export interface ChatResult {
  content: string;
  usage: { promptTokens: number; completionTokens: number };
  finishReason: string;
}

export interface LlmProvider {
  readonly name: string;
  chat(messages: ChatMessage[], options?: ChatOptions): Promise<ChatResult>;
  chatStream(messages: ChatMessage[], options?: ChatOptions): AsyncGenerator<StreamChunk>;
}
