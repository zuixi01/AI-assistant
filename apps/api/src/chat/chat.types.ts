import { ConversationStatus } from '../conversations/conversations.service';

export interface ChatRequest {
  conversationId: string;
  tenantId: string;
  tenantType?: string;
  tenantName?: string;
  userMessage: string;
  persistedUserMessageId?: string;
}

export interface ChatCitation {
  source: string;
  content: string;
  titlePath?: string[];
  pageNumber?: number;
}

export interface ChatResponse {
  content: string;
  citations?: ChatCitation[];
  intent?: string;
  intentScore?: number;
  confidence?: number;
  answerStatus?: string;
  conversationStatus?: ConversationStatus;
  requiresHuman?: boolean;
  products?: { id: string; title: string; price: number; reason: string }[];
}

export interface ChatTurnPersistence {
  persistUserMessage: boolean;
  persistAssistantMessage: boolean;
}

export interface FormattedHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface PreparedChatTurn {
  userMessageRecord?: { id: string };
  formattedHistory: FormattedHistoryMessage[];
  conversationContext: string;
  intent: string;
  intentScore: number;
  rewrittenQuery: string;
  retrievalOutput: {
    results: any[];
    confidence: number;
    answerStatus: string;
  };
  citations: ChatCitation[];
  knowledge: string;
  conversationTrack: 'dialogue' | 'knowledge';
}

export interface ResolvedChatTurn {
  aiResponse: string;
  answerStatus: string;
  conversationStatus: ConversationStatus;
}
