import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { Bot, CheckCircle2, Loader2, Plus, Send, User, Wrench, XCircle } from 'lucide-react';
import { getSupabase } from '@/lib/supabase';
import { authFetch, useAuth } from '@/lib/auth';
import type { AiActivity } from '@/lib/types';

interface ToolEvent {
  id: string;
  name: string;
  status: 'running' | 'ok' | 'error';
  summary?: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  tools?: ToolEvent[];
  activity?: AiActivity;
  error?: string;
}

interface ConversationRow {
  id: string;
  title: string | null;
  updated_at: string;
}

const SUGGESTIONS = [
  'Where is my latest order?',
  'Do you have Amul butter in stock?',
  'What is your refund policy for damaged items?',
  'I want to talk to a person',
];

const TOOL_LABELS: Record<string, string> = {
  search_products: 'Searching catalogue',
  get_my_orders: 'Loading your orders',
  get_order_details: 'Checking order',
  cancel_order: 'Cancelling order',
  request_refund: 'Submitting refund request',
  search_policies: 'Reading store policies',
  create_support_ticket: 'Opening support ticket',
  get_my_tickets: 'Loading your tickets',
};

// Minimal, safe markdown: escape HTML, then bold, inline code, bullets, line breaks.
function renderMarkdown(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 rounded">$1</code>')
    .split('\n')
    .map((line) => (/^\s*[-*•]\s+/.test(line) ? `<li class="ml-4 list-disc">${line.replace(/^\s*[-*•]\s+/, '')}</li>` : line))
    .join('<br/>')
    .replace(/<br\/>(<li)/g, '$1')
    .replace(/(<\/li>)<br\/>/g, '$1');
}

export default function Chat() {
  const router = useRouter();
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const prefilled = useRef(false);

  const loadConversations = useCallback(async () => {
    const { data } = await getSupabase().from('conversations').select('id, title, updated_at').order('updated_at', { ascending: false }).limit(20);
    setConversations((data as ConversationRow[]) || []);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (prefilled.current || typeof router.query.order !== 'string') return;
    prefilled.current = true;
    setInput(`I need help with order ${router.query.order}`);
  }, [router.query.order]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function openConversation(id: string) {
    if (streaming) return;
    setConversationId(id);
    const { data } = await getSupabase().from('chat_messages').select('id, role, content, metadata').eq('conversation_id', id).order('created_at');
    setMessages(
      (data || []).map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        activity: m.role === 'assistant' ? (m.metadata as AiActivity) : undefined,
        tools: m.role === 'assistant' ? ((m.metadata as AiActivity)?.tools || []).map((t, i) => ({ id: String(i), name: t.name, status: t.ok ? 'ok' : 'error', summary: t.summary })) : undefined,
      })),
    );
  }

  function newConversation() {
    if (streaming) return;
    setConversationId(null);
    setMessages([]);
  }

  async function send(text: string) {
    const message = text.trim();
    if (!message || streaming) return;
    setInput('');
    setStreaming(true);
    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', content: message }, { id: assistantId, role: 'assistant', content: '', tools: [] }]);

    const patch = (fn: (m: ChatMessage) => ChatMessage) => setMessages((prev) => prev.map((m) => (m.id === assistantId ? fn(m) : m)));

    try {
      const res = await authFetch('/api/chat', { method: 'POST', body: JSON.stringify({ message, conversation_id: conversationId }) });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: 'The assistant is unavailable right now.' }));
        patch((m) => ({ ...m, error: err.error }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        for (const raw of events) {
          if (!raw.startsWith('data: ')) continue;
          const event = JSON.parse(raw.slice(6));
          if (event.type === 'conversation') setConversationId(event.conversation_id);
          else if (event.type === 'text') patch((m) => ({ ...m, content: m.content + event.text }));
          else if (event.type === 'tool_start') patch((m) => ({ ...m, tools: [...(m.tools || []), { id: event.id, name: event.name, status: 'running' }] }));
          else if (event.type === 'tool_end')
            patch((m) => ({ ...m, tools: (m.tools || []).map((t) => (t.id === event.id ? { ...t, status: event.ok ? 'ok' : 'error', summary: event.summary } : t)) }));
          else if (event.type === 'error') patch((m) => ({ ...m, error: event.error }));
          else if (event.type === 'done') patch((m) => ({ ...m, activity: event.activity }));
        }
      }
    } catch {
      patch((m) => ({ ...m, error: 'Connection lost. Please try again.' }));
    } finally {
      setStreaming(false);
      loadConversations();
    }
  }

  return (
    <div className="max-w-6xl mx-auto h-[calc(100vh-7rem)] md:h-[calc(100vh-8rem)] flex gap-4">
      <aside className="hidden lg:flex w-64 flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <button onClick={newConversation} className="m-3 flex items-center justify-center gap-2 text-sm bg-emerald-600 text-white rounded-lg py-2"><Plus className="w-4 h-4" /> New chat</button>
        <div className="flex-1 overflow-y-auto">
          {conversations.map((c) => (
            <button key={c.id} onClick={() => openConversation(c.id)} className={`w-full text-left px-4 py-2.5 text-sm truncate hover:bg-slate-50 ${c.id === conversationId ? 'bg-emerald-50 text-emerald-800' : 'text-slate-700'}`}>
              {c.title || 'Conversation'}
            </button>
          ))}
        </div>
      </aside>

      <section className="flex-1 flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden min-w-0">
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold text-slate-800 text-sm">Support assistant</span>
            <span className="text-xs text-slate-400">· can check orders, refunds, products &amp; policies</span>
          </div>
          <button onClick={newConversation} className="lg:hidden text-xs text-emerald-700">New chat</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
          {messages.length === 0 && (
            <div className="text-center mt-10">
              <Bot className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="mt-3 font-semibold text-slate-800">Hi {profile?.full_name?.split(' ')[0] || 'there'}, how can I help?</h3>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} className="text-sm border border-slate-200 rounded-full px-4 py-2 hover:border-emerald-400 hover:bg-emerald-50">{s}</button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : ''}`}>
              {m.role === 'assistant' && <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0"><Bot className="w-4 h-4 text-emerald-700" /></div>}
              <div className={`max-w-[85%] ${m.role === 'user' ? 'order-first' : ''}`}>
                {m.tools && m.tools.length > 0 && (
                  <div className="mb-2 space-y-1">
                    {m.tools.map((t) => (
                      <div key={t.id} className="flex items-center gap-2 text-xs text-slate-500">
                        {t.status === 'running' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.status === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                        <Wrench className="w-3 h-3" />
                        <span>{t.summary || TOOL_LABELS[t.name] || t.name}</span>
                      </div>
                    ))}
                  </div>
                )}
                {(m.content || m.role === 'user') && (
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${m.role === 'user' ? 'bg-emerald-600 text-white' : 'bg-slate-50 text-slate-800 border border-slate-100'}`}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }}
                  />
                )}
                {m.role === 'assistant' && !m.content && !m.error && streaming && (!m.tools || m.tools.every((t) => t.status !== 'running')) && (
                  <div className="text-xs text-slate-400 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Thinking…</div>
                )}
                {m.error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mt-1">{m.error}</p>}
                {m.activity?.escalated && <p className="text-xs text-amber-700 mt-1">A support agent has been notified — see Support Tickets.</p>}
              </div>
              {m.role === 'user' && <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-slate-600" /></div>}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="p-3 border-t border-slate-100 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about an order, a product, a refund…"
            maxLength={4000}
            className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm"
            disabled={streaming}
          />
          <button disabled={streaming || !input.trim()} aria-label="Send" className="bg-emerald-600 text-white rounded-xl px-4 disabled:opacity-50">
            {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </section>
    </div>
  );
}
