export interface PublicChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
  products?: { id: string; title: string; price: number; reason: string }[];
  intent?: string;
  showHumanTransfer?: boolean;
}

export interface PublicChatResponse {
  content: string;
  intent?: string;
  intentScore?: number;
  answerStatus?: string;
  conversationStatus?: string;
  requiresHuman?: boolean;
  products?: { id: string; title: string; price: number; reason: string }[];
}

export interface PublicServerMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
  metadata?: {
    intent?: string;
    answerStatus?: string;
    conversationStatus?: string;
    requiresHuman?: boolean;
    products?: { id: string; title: string; price: number; reason: string }[];
  } | null;
}

export interface PublicConversationSession {
  conversationId: string;
  conversationToken: string;
}

export interface PublicConversationApiResponse {
  id?: string;
  publicToken?: string;
  message?: string | string[];
}

export const PUBLIC_CONVERSATION_TOKEN_HEADER = 'x-conversation-token';

function normalizeBaseUrl(baseUrl?: string) {
  if (!baseUrl) return '';
  return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

export function buildPublicChatSessionStorageKey(scope: string) {
  return `ai-assistant:chat-session:${scope}`;
}

export function toPublicClientMessage(msg: PublicServerMessage): PublicChatMessage {
  return {
    id: msg.id,
    role: msg.role === 'user' ? 'user' : 'assistant',
    content: msg.content,
    createdAt: msg.createdAt,
    products: msg.metadata?.products,
    intent: msg.metadata?.intent,
    showHumanTransfer:
      Boolean(msg.metadata?.requiresHuman) ||
      msg.metadata?.answerStatus === 'transferred_to_human' ||
      msg.metadata?.conversationStatus === 'pending_human',
  };
}

export function mergePublicChatMessages(current: PublicChatMessage[], incoming: PublicChatMessage[]) {
  const incomingContentKeys = new Set(incoming.map((msg) => `${msg.role}\n${msg.content}`));
  const withoutLocalDuplicates = current.filter((msg) => {
    if (!msg.id.startsWith('local-')) return true;
    return !incomingContentKeys.has(`${msg.role}\n${msg.content}`);
  });
  const seenIds = new Set(withoutLocalDuplicates.map((msg) => msg.id));
  return [...withoutLocalDuplicates, ...incoming.filter((msg) => !seenIds.has(msg.id))].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );
}

export async function createPublicConversation(params: {
  baseUrl?: string;
  tenantSlug?: string;
  tenantId?: string;
  channel: string;
}) {
  const { baseUrl, tenantSlug, tenantId, channel } = params;
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/api/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenantSlug, tenantId, channel }),
  });
  const data = (await response.json()) as PublicConversationApiResponse;
  return { response, data };
}

export async function fetchTenantBySlug(params: { baseUrl?: string; tenantSlug: string }) {
  const response = await fetch(
    `${normalizeBaseUrl(params.baseUrl)}/api/tenants/slug/${encodeURIComponent(params.tenantSlug)}`,
  );
  const data = await response.json();
  return { response, data };
}

export async function fetchPublicConversationMessages(params: {
  baseUrl?: string;
  conversationId: string;
  conversationToken: string;
  after?: string | null;
  limit?: number;
}) {
  const query = new URLSearchParams({ limit: String(params.limit || 100) });
  if (params.after) query.set('after', params.after);
  const response = await fetch(
    `${normalizeBaseUrl(params.baseUrl)}/api/conversations/${params.conversationId}/messages?${query.toString()}`,
    {
      headers: { [PUBLIC_CONVERSATION_TOKEN_HEADER]: params.conversationToken },
    },
  );
  const data = (await response.json()) as PublicServerMessage[];
  return { response, data };
}

export async function sendPublicChatTurn(params: {
  baseUrl?: string;
  conversationId: string;
  conversationToken: string;
  message: string;
}) {
  const response = await fetch(`${normalizeBaseUrl(params.baseUrl)}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      [PUBLIC_CONVERSATION_TOKEN_HEADER]: params.conversationToken,
    },
    body: JSON.stringify({
      conversationId: params.conversationId,
      message: params.message,
      conversationToken: params.conversationToken,
    }),
  });
  const data = (await response.json().catch(() => null)) as PublicChatResponse | null;
  return { response, data };
}
