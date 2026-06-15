import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from './llm/llm.service';
import { EmbeddingService } from './embedding/embedding.service';
import { PromptsService } from './prompts/prompts.service';
import { MessagesService } from '../messages/messages.service';
import { ConversationsService } from '../conversations/conversations.service';

export interface ChatRequest {
  conversationId: string;
  tenantId: string;
  tenantType?: string;
  tenantName?: string;
  userMessage: string;
}

export interface ChatResponse {
  content: string;
  citations?: { source: string; content: string }[];
  intent?: string;
  intentScore?: number;
}

@Injectable()
export class AiOrchestratorService {
  private readonly logger = new Logger(AiOrchestratorService.name);

  constructor(
    private llmService: LlmService,
    private embeddingService: EmbeddingService,
    private promptsService: PromptsService,
    private messagesService: MessagesService,
    private conversationsService: ConversationsService,
  ) {}

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const { conversationId, tenantId, tenantType, tenantName, userMessage } = request;

    // Save user message
    await this.messagesService.create(conversationId, 'user', userMessage);

    // Get conversation history
    const history = await this.messagesService.findByConversation(conversationId, 20);
    const formattedHistory = history.slice(0, -1).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // TODO: Retrieve knowledge chunks via KnowledgeService
    // For now, empty knowledge - will be connected in Knowledge module
    const knowledge = '';

    // Build messages
    const systemPrompt = this.promptsService.getSystemPrompt({
      tenantType,
      tenantName,
      knowledge,
    });
    const messages = this.promptsService.buildRagPrompt(systemPrompt, formattedHistory, userMessage, knowledge);

    // Call LLM
    const result = await this.llmService.chat(messages, { temperature: 0.7, maxTokens: 2048 });

    // Save assistant message
    await this.messagesService.create(conversationId, 'assistant', result.content, {
      model: this.llmService.getProvider().name,
      usage: result.usage,
      finishReason: result.finishReason,
    });

    // TODO: Extract intent, detect lead signals

    return {
      content: result.content,
      citations: [],
    };
  }

  async *chatStream(request: ChatRequest) {
    const { conversationId, tenantId, tenantType, tenantName, userMessage } = request;

    await this.messagesService.create(conversationId, 'user', userMessage);

    const history = await this.messagesService.findByConversation(conversationId, 20);
    const formattedHistory = history.slice(0, -1).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    const knowledge = '';
    const systemPrompt = this.promptsService.getSystemPrompt({
      tenantType,
      tenantName,
      knowledge,
    });
    const messages = this.promptsService.buildRagPrompt(systemPrompt, formattedHistory, userMessage, knowledge);

    let fullContent = '';
    const stream = this.llmService.chatStream(messages, { temperature: 0.7, maxTokens: 2048 });

    for await (const chunk of stream) {
      fullContent += chunk.content;
      yield chunk;
    }

    await this.messagesService.create(conversationId, 'assistant', fullContent, {
      model: this.llmService.getProvider().name,
    });
  }
}
