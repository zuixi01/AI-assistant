'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Bot, Headphones, Package, RotateCcw, Send, ShieldCheck, Sparkles, Trash2, UserRound } from 'lucide-react';
import {
  buildPublicChatSessionStorageKey,
  createPublicConversation,
  fetchPublicConversationMessages,
  fetchTenantBySlug,
  mergePublicChatMessages,
  PUBLIC_CONVERSATION_TOKEN_HEADER,
  PublicChatMessage as Message,
  PublicChatResponse as ChatApiResponse,
  PublicConversationApiResponse,
  PublicConversationSession as StoredConversationSession,
  PublicServerMessage as ServerMessage,
  sendPublicChatTurn,
  toPublicClientMessage,
} from '@ai-assistant/shared';
import { useTranslation } from '@/lib/i18n';
import { cn } from '@/lib/cn';

function getSessionStorageKey(tenantSlug: string) {
  return buildPublicChatSessionStorageKey(tenantSlug);
}

const ADMIN_DASHBOARD_ROUTE = '/admin/dashboard';

export default function ChatPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { t } = useTranslation();
  const tenantLoadFailed = t.chat.tenantLoadFailed;
  const conversationCreateFailed = t.chat.conversationCreateFailed;
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationToken, setConversationToken] = useState<string | null>(null);
  const [tenantSlug, setTenantSlug] = useState<string>('');
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadSubmitted, setLeadSubmitted] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isPreparingConversation, setIsPreparingConversation] = useState(false);
  const [isLeavingToConsole, setIsLeavingToConsole] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSyncedAtRef = useRef<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const resetConversationSession = useCallback(() => {
    if (!tenantSlug) return;
    setInitError(null);
    setMessages([]);
    setInput('');
    setLoading(false);
    setConversationId(null);
    setConversationToken(null);
    setShowLeadForm(false);
    setLeadName('');
    setLeadPhone('');
    setLeadSubmitted(false);
    lastSyncedAtRef.current = null;
    window.localStorage.removeItem(getSessionStorageKey(tenantSlug));
    setRetryNonce((nonce) => nonce + 1);
  }, [tenantSlug]);

  useEffect(() => {
    params.then((p) => setTenantSlug(p.tenantSlug));
  }, [params]);

  useEffect(() => {
    if (!tenantSlug) return;
    let cancelled = false;
    setIsPreparingConversation(true);
    setInitError(null);
    setMessages([]);
    setConversationId(null);
    setConversationToken(null);
    setLeadSubmitted(false);
    setShowLeadForm(false);
    lastSyncedAtRef.current = null;

    const apiMessage = (data: unknown): string => {
      if (!data || typeof data !== 'object') return '';
      const m = (data as { message?: string | string[] }).message;
      if (Array.isArray(m)) return m.join('; ');
      if (typeof m === 'string') return m;
      return '';
    };

    (async () => {
      try {
        const saved = window.localStorage.getItem(getSessionStorageKey(tenantSlug));
        if (saved) {
          try {
            const session = JSON.parse(saved) as Partial<StoredConversationSession>;
            if (session.conversationId && session.conversationToken) {
              if (!cancelled) {
                setConversationId(session.conversationId);
                setConversationToken(session.conversationToken);
                setIsPreparingConversation(false);
              }
              return;
            }
          } catch {
            window.localStorage.removeItem(getSessionStorageKey(tenantSlug));
          }
        }

        const { response: res, data: tenant } = await fetchTenantBySlug({ tenantSlug });
        if (cancelled) return;

        if (!res.ok) {
          setInitError(apiMessage(tenant) || tenantLoadFailed);
          setIsPreparingConversation(false);
          return;
        }
        if (!tenant?.id) {
          setInitError(tenantLoadFailed);
          setIsPreparingConversation(false);
          return;
        }

        const { response: cRes, data: conv } = await createPublicConversation({ tenantSlug, channel: 'h5' });
        if (cancelled) return;

        if (!cRes.ok) {
          setInitError(apiMessage(conv) || conversationCreateFailed);
          setIsPreparingConversation(false);
          return;
        }
        if (!conv?.id || !conv.publicToken) {
          setInitError(conversationCreateFailed);
          setIsPreparingConversation(false);
          return;
        }
        setConversationId(conv.id);
        setConversationToken(conv.publicToken);
        window.localStorage.setItem(
          getSessionStorageKey(tenantSlug),
          JSON.stringify({ conversationId: conv.id, conversationToken: conv.publicToken }),
        );
        setIsPreparingConversation(false);
      } catch {
        if (!cancelled) {
          setInitError(tenantLoadFailed);
          setIsPreparingConversation(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [tenantSlug, retryNonce, tenantLoadFailed, conversationCreateFailed]);

  useEffect(scrollToBottom, [messages]);

  useEffect(() => {
    if (!conversationId || !conversationToken) return;
    let cancelled = false;

    const syncMessages = async () => {
      try {
        const { response: res, data } = await fetchPublicConversationMessages({
          conversationId,
          conversationToken,
          after: lastSyncedAtRef.current,
          limit: 100,
        });
        if (res.status === 401 || res.status === 404) {
          window.localStorage.removeItem(getSessionStorageKey(tenantSlug));
          if (!cancelled) {
            setConversationId(null);
            setConversationToken(null);
            setInitError(conversationCreateFailed);
          }
          return;
        }
        if (!res.ok) return;
        if (cancelled || data.length === 0) return;
        const incoming = data.map(toPublicClientMessage);
        const newest = incoming[incoming.length - 1]?.createdAt;
        if (newest) lastSyncedAtRef.current = newest;
        setMessages((prev) => mergePublicChatMessages(prev, incoming));
      } catch {
        // Keep local optimistic messages if polling temporarily fails.
      }
    };

    syncMessages();
    const timer = window.setInterval(syncMessages, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [conversationId, conversationToken, tenantSlug, conversationCreateFailed]);

  const handleSend = async () => {
    if (!input.trim() || !conversationId || !conversationToken || loading || isPreparingConversation) return;

    const userMessage = input.trim();
    setInput('');
    const optimisticUserId = `local-user-${Date.now()}`;
    const optimisticAssistantId = `local-assistant-${Date.now() + 1}`;
    setMessages((prev) => [
      ...prev,
      { id: optimisticUserId, role: 'user', content: userMessage, createdAt: new Date().toISOString() },
    ]);
    setLoading(true);

    try {
      const { response, data } = await sendPublicChatTurn({
        conversationId,
        conversationToken,
        message: userMessage,
      });
      if (!response.ok) throw new Error((data as any)?.message || t.chat.errorMessage);
      if (!data?.content) throw new Error(t.chat.errorMessage);

      const showHuman =
        data.requiresHuman ||
        data.answerStatus === 'transferred_to_human' ||
        data.conversationStatus === 'pending_human' ||
        data.intent === 'transfer_human' ||
        data.intent === 'after_sale' ||
        (data.intentScore ?? 0) >= 70;

      setMessages((prev) => [
        ...prev,
        {
          id: optimisticAssistantId,
          role: 'assistant',
          content: data.content,
          createdAt: new Date().toISOString(),
          products: data.products,
          intent: data.intent,
          showHumanTransfer: showHuman,
        },
      ]);
      if (showHuman) setShowLeadForm(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: t.chat.errorMessage, createdAt: new Date().toISOString() },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [t.chat.quickRecommend, t.chat.quickPrice, t.chat.quickShipping, t.chat.quickAfterSale];

  const handleLeadSubmit = async () => {
    if (!leadName.trim() || !leadPhone.trim() || !conversationId || !conversationToken) return;
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          [PUBLIC_CONVERSATION_TOKEN_HEADER]: conversationToken,
        },
        body: JSON.stringify({
          conversationId,
          conversationToken,
          name: leadName,
          phone: leadPhone,
          source: 'chat',
        }),
      });
      setLeadSubmitted(true);
      setShowLeadForm(false);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: 'assistant', content: t.chat.leadSuccess, createdAt: new Date().toISOString() },
      ]);
    } catch (error) {
      console.error('Lead submit error:', error);
    }
  };

  const handleClearHistory = () => {
    if (loading || isPreparingConversation || !tenantSlug) return;
    setShowClearConfirm(false);
    setIsPreparingConversation(true);
    resetConversationSession();
  };

  const handleBackToConsole = useCallback(() => {
    if (isLeavingToConsole) return;
    setIsLeavingToConsole(true);
    window.location.assign(ADMIN_DASHBOARD_ROUTE);
  }, [isLeavingToConsole]);

  return (
    <main className="premium-page flex h-screen justify-center overflow-hidden px-3 py-3 sm:px-6 sm:py-6">
      <div className="premium-card relative flex h-full w-full max-w-5xl flex-col overflow-hidden">
        <div className="absolute right-8 top-10 h-40 w-40 rounded-full bg-cyan-200/60 blur-3xl" />
        <div className="absolute bottom-24 left-8 h-44 w-44 rounded-full bg-amber-200/50 blur-3xl" />

        <header className="relative z-10 border-b border-white/60 bg-white/78 px-5 py-4 backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white shadow-lg shadow-slate-900/25">
                <Bot className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-slate-950">{t.chat.title}</h1>
                <p className="text-xs font-medium text-slate-500">{t.chat.subtitle}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                type="button"
                onClick={handleBackToConsole}
                disabled={isLeavingToConsole}
                className="premium-button-secondary min-h-10 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ArrowLeft className="h-4 w-4" />
                {isLeavingToConsole ? '正在返回控制台...' : t.chat.backToConsole}
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                disabled={loading || isPreparingConversation || !tenantSlug}
                className="premium-button-secondary min-h-10 px-4 py-2 text-sm text-rose-600 hover:border-rose-200 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                {isPreparingConversation ? t.chat.clearingHistory : t.chat.clearHistory}
              </button>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
                <span className="status-dot" />
                在线接待
              </div>
            </div>
          </div>

          {initError ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
              <p className="mb-3 font-medium">{initError}</p>
              <button
                type="button"
                onClick={() => {
                  resetConversationSession();
                }}
                className="premium-button-secondary px-3 py-1.5 text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {t.chat.retryLoad}
              </button>
            </div>
          ) : null}
        </header>

        <div className="soft-scrollbar relative z-10 flex-1 overflow-auto px-4 py-5 sm:px-6">
          {messages.length === 0 ? (
            <section className="mx-auto mt-8 max-w-2xl text-center sm:mt-16">
              <div className="premium-kicker mb-4">
                <Sparkles className="h-4 w-4" />
                智能接待已准备
              </div>
              <h2 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{t.chat.welcomeTitle}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500">{t.chat.welcomeSubtitle}</p>
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  ['知识库问答', BrainCircuitFallback],
                  ['线索沉淀', ShieldCheck],
                  ['人工协同', Headphones],
                ].map(([label, Icon]) => {
                  const Visual = Icon as typeof ShieldCheck;
                  return (
                    <div key={label as string} className="premium-panel p-4">
                      <Visual className="mx-auto h-5 w-5 text-slate-700" />
                      <p className="mt-2 text-xs font-bold text-slate-600">{label as string}</p>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}

          <div className="space-y-5">
            {messages.map((msg) => (
              <div key={msg.id} className={cn('flex items-end gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                {msg.role === 'assistant' ? (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
                    <Bot className="h-4 w-4" />
                  </div>
                ) : null}
                <div className={cn('max-w-[86%] sm:max-w-[72%]', msg.role === 'user' && 'order-first')}>
                  {msg.intent ? (
                    <p className={cn('mb-1 text-xs font-semibold text-slate-400', msg.role === 'user' ? 'text-right' : 'text-left')}>
                      {msg.intent}
                    </p>
                  ) : null}
                  <div
                    className={cn(
                      'rounded-[1.35rem] px-4 py-3 text-sm leading-6',
                      msg.role === 'user' ? 'message-bubble-user rounded-br-md' : 'message-bubble-assistant rounded-bl-md',
                    )}
                  >
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>

                  {msg.products && msg.products.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {msg.products.map((product) => (
                        <div key={product.id} className="premium-panel flex items-start justify-between gap-3 p-3">
                          <div className="flex gap-3">
                            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700">
                              <Package className="h-5 w-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-950">{product.title}</h4>
                              <p className="mt-1 text-xs leading-5 text-slate-500">{product.reason}</p>
                            </div>
                          </div>
                          <span className="shrink-0 rounded-full bg-rose-50 px-3 py-1 text-sm font-black text-rose-600">
                            ¥{(product.price / 100).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {msg.showHumanTransfer && !leadSubmitted ? (
                    <div className="mt-3">
                      <button onClick={() => setShowLeadForm(true)} className="premium-button-primary px-4 py-2 text-xs">
                        <Headphones className="h-3.5 w-3.5" />
                        {t.chat.transferHuman}
                      </button>
                    </div>
                  ) : null}
                </div>
                {msg.role === 'user' ? (
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-2xl bg-white/80 text-slate-700 ring-1 ring-white">
                    <UserRound className="h-4 w-4" />
                  </div>
                ) : null}
              </div>
            ))}

            {loading ? (
              <div className="flex justify-start">
                <div className="message-bubble-assistant rounded-[1.35rem] px-4 py-3">
                  <div className="flex gap-1 text-slate-500">
                    <span className="typing-dot" />
                    <span className="typing-dot [animation-delay:120ms]" />
                    <span className="typing-dot [animation-delay:240ms]" />
                  </div>
                </div>
              </div>
            ) : null}

            {isPreparingConversation && !initError ? (
              <div className="flex justify-center">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-500 shadow-lg shadow-slate-200/50">
                  <RotateCcw className="h-3.5 w-3.5 animate-spin" />
                  {t.chat.clearingHistory}
                </div>
              </div>
            ) : null}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="relative z-10 px-4 pb-3 sm:px-6">
            <div className="flex flex-wrap justify-center gap-2">
              {quickQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => setInput(q)}
                  disabled={loading || isPreparingConversation || !!initError || !conversationId}
                  className="premium-chip hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {showLeadForm && !leadSubmitted ? (
          <div className="relative z-10 border-t border-amber-200/80 bg-amber-50/85 p-4 backdrop-blur-xl">
            <p className="mb-3 text-sm font-bold text-amber-900">{t.chat.leadFormTitle}</p>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto_auto]">
              <input
                type="text"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                placeholder={t.chat.leadNamePlaceholder}
                className="premium-input px-3 py-2 text-sm"
              />
              <input
                type="tel"
                value={leadPhone}
                onChange={(e) => setLeadPhone(e.target.value)}
                placeholder={t.chat.leadPhonePlaceholder}
                className="premium-input px-3 py-2 text-sm"
              />
              <button onClick={handleLeadSubmit} disabled={!leadName.trim() || !leadPhone.trim()} className="premium-button-primary px-4 py-2 text-sm disabled:opacity-50">
                {t.chat.leadSubmit}
              </button>
              <button onClick={() => setShowLeadForm(false)} className="premium-button-secondary px-4 py-2 text-sm">
                {t.common.cancel}
              </button>
            </div>
          </div>
        ) : null}

        <footer className="relative z-10 border-t border-white/70 bg-white/80 p-4 backdrop-blur-xl">
          <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 p-1.5 shadow-inner">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder={t.chat.placeholder}
              className="min-w-0 flex-1 bg-transparent px-4 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
              disabled={loading || isPreparingConversation || !!initError || !conversationId}
            />
            <button
              onClick={handleSend}
              disabled={loading || isPreparingConversation || !input.trim() || !!initError || !conversationId}
              className="premium-button-primary h-10 px-5 text-sm disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">{t.chat.send}</span>
            </button>
          </div>
        </footer>

        {showClearConfirm ? (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/18 px-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white/95 p-6 shadow-2xl shadow-slate-900/10">
              <div className="flex items-start gap-3">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-600">
                  <Trash2 className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-tight text-slate-950">{t.chat.clearHistoryConfirmTitle}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{t.chat.clearHistoryConfirmDescription}</p>
                </div>
              </div>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => setShowClearConfirm(false)} className="premium-button-secondary px-4 py-2 text-sm">
                  {t.common.cancel}
                </button>
                <button type="button" onClick={handleClearHistory} className="premium-button-primary bg-rose-600 px-4 py-2 text-sm text-white hover:bg-rose-700">
                  {t.chat.clearHistoryConfirmAction}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function BrainCircuitFallback(props: React.ComponentProps<typeof ShieldCheck>) {
  return <Sparkles {...props} />;
}
