import React, { useEffect, useRef, useState } from 'react';
import {
  buildPublicChatSessionStorageKey,
  createPublicConversation,
  fetchPublicConversationMessages,
  mergePublicChatMessages,
  PublicChatMessage as Message,
  PublicConversationSession,
  sendPublicChatTurn,
  toPublicClientMessage,
} from '@ai-assistant/shared';

interface ChatWidgetProps {
  apiBaseUrl: string;
  tenantId: string;
  position?: 'bottom-right' | 'bottom-left';
  primaryColor?: string;
}

export function ChatWidget({ apiBaseUrl, tenantId, position = 'bottom-right', primaryColor = '#2563eb' }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationToken, setConversationToken] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSyncedAtRef = useRef<string | null>(null);

  const storageKey = buildPublicChatSessionStorageKey(`embed:${tenantId}`);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const session = JSON.parse(saved) as Partial<PublicConversationSession>;
      if (session.conversationId && session.conversationToken) {
        setConversationId(session.conversationId);
        setConversationToken(session.conversationToken);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  const initConversation = async () => {
    if (conversationId && conversationToken) return;
    try {
      const { response, data } = await createPublicConversation({
        baseUrl: apiBaseUrl,
        tenantId,
        channel: 'embed',
      });
      if (!response.ok || !data.id || !data.publicToken) {
        throw new Error('Failed to create conversation');
      }
      setConversationId(data.id);
      setConversationToken(data.publicToken);
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ conversationId: data.id, conversationToken: data.publicToken }),
      );
    } catch (err) {
      console.error('Failed to create conversation:', err);
    }
  };

  const handleOpen = () => {
    setIsOpen(true);
    initConversation();
  };

  const handleSend = async () => {
    if (!input.trim() || !conversationId || !conversationToken || loading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [
      ...prev,
      { id: `local-user-${Date.now()}`, role: 'user', content: userMessage, createdAt: new Date().toISOString() },
    ]);
    setLoading(true);

    try {
      const { response, data } = await sendPublicChatTurn({
        baseUrl: apiBaseUrl,
        conversationId,
        conversationToken,
        message: userMessage,
      });
      if (!response.ok || !data?.content) {
        throw new Error('Chat request failed');
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `local-assistant-${Date.now() + 1}`,
          role: 'assistant',
          content: data.content,
          createdAt: new Date().toISOString(),
          products: data.products,
          intent: data.intent,
          showHumanTransfer:
            Boolean(data.requiresHuman) ||
            data.answerStatus === 'transferred_to_human' ||
            data.conversationStatus === 'pending_human',
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `local-error-${Date.now() + 1}`,
          role: 'assistant',
          content: '抱歉，发生了错误。',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen || !conversationId || !conversationToken) return;
    let cancelled = false;

    const syncMessages = async () => {
      try {
        const { response, data } = await fetchPublicConversationMessages({
          baseUrl: apiBaseUrl,
          conversationId,
          conversationToken,
          after: lastSyncedAtRef.current,
          limit: 100,
        });
        if (response.status === 401 || response.status === 404) {
          window.localStorage.removeItem(storageKey);
          if (!cancelled) {
            setConversationId(null);
            setConversationToken(null);
          }
          return;
        }
        if (!response.ok || cancelled || data.length === 0) return;
        const incoming = data.map(toPublicClientMessage);
        const newest = incoming[incoming.length - 1]?.createdAt;
        if (newest) lastSyncedAtRef.current = newest;
        setMessages((prev) => mergePublicChatMessages(prev, incoming));
      } catch {
        // Keep optimistic messages while polling retries.
      }
    };

    syncMessages();
    const timer = window.setInterval(syncMessages, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [apiBaseUrl, conversationId, conversationToken, isOpen, storageKey]);

  const positionStyle = position === 'bottom-left'
    ? { left: '20px', bottom: '20px' }
    : { right: '20px', bottom: '20px' };

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={isOpen ? () => setIsOpen(false) : handleOpen}
        style={{
          position: 'fixed',
          ...positionStyle,
          width: '60px',
          height: '60px',
          borderRadius: '50%',
          backgroundColor: primaryColor,
          color: 'white',
          border: 'none',
          cursor: 'pointer',
          fontSize: '24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isOpen ? '✕' : '💬'}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            ...positionStyle,
            bottom: '90px',
            width: '380px',
            height: '520px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            zIndex: 10000,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {/* Header */}
          <div style={{ backgroundColor: primaryColor, color: 'white', padding: '16px', textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 600 }}>AI 智能客服</div>
            <div style={{ fontSize: '12px', opacity: 0.8, marginTop: '4px' }}>有什么可以帮您？</div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '40px', fontSize: '14px' }}>
                您好！请问有什么可以帮助您的？
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div
                  style={{
                    maxWidth: '80%',
                    padding: '10px 14px',
                    borderRadius: '16px',
                    fontSize: '14px',
                    lineHeight: '1.5',
                    backgroundColor: msg.role === 'user' ? primaryColor : '#f3f4f6',
                    color: msg.role === 'user' ? 'white' : '#1f2937',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: '4px', padding: '8px' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#9ca3af', animation: 'bounce 1s infinite' }} />
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#9ca3af', animation: 'bounce 1s infinite 0.1s' }} />
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#9ca3af', animation: 'bounce 1s infinite 0.2s' }} />
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px', borderTop: '1px solid #e5e7eb', display: 'flex', gap: '8px' }}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="输入您的问题..."
              style={{
                flex: 1,
                border: '1px solid #d1d5db',
                borderRadius: '20px',
                padding: '8px 16px',
                fontSize: '14px',
                outline: 'none',
              }}
              disabled={loading}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                backgroundColor: primaryColor,
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                padding: '8px 20px',
                fontSize: '14px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              发送
            </button>
          </div>
        </div>
      )}
    </>
  );
}
