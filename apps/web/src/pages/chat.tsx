import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { Send, Bot, User, Cpu, FileText, CheckCircle2, AlertTriangle, RefreshCw, Zap } from 'lucide-react';

interface AIActivity {
  intent?: string;
  agent?: string;
  tools_called?: string[];
  rag_sources?: { title: string; source: string; similarity_score: number }[];
  confidence?: number;
  escalated?: boolean;
}

interface Message {
  id: string;
  sender: 'customer' | 'assistant';
  content: string;
  ai_activity?: AIActivity;
  timestamp: string;
}

const PRESET_QUERIES = [
  "Where is my order ORD-1001?",
  "Is Amul milk available?",
  "What is your refund policy?",
  "My milk packet was damaged in ORD-1001.",
  "I want to talk to a human support agent.",
  "Recommend a healthy breakfast under ₹300."
];

export default function ChatPage() {
  const router = useRouter();
  const [customerId, setCustomerId] = useState('CUS-DEMO');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome-1',
      sender: 'assistant',
      content: 'Hello Rahul! I am your Supermarket Real-Time AI Support Assistant. How can I help you today with your orders, products, or store policies?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showObservability, setShowObservability] = useState(true);
  const [selectedActivity, setSelectedActivity] = useState<AIActivity | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    if (typeof router.query.query === 'string') setInput(router.query.query);
  }, [router.query.query]);

  useEffect(() => {
    const stored = localStorage.getItem('supermarket_auth');
    if (!stored) return;
    try {
      const session = JSON.parse(stored);
      // The seeded demo user maps to CUS-DEMO; new accounts receive their own id.
      setCustomerId(session.user_id === 'CUS-DEMO' ? 'CUS-DEMO' : session.user_id);
    } catch { localStorage.removeItem('supermarket_auth'); }
  }, []);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || isTyping) return;

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      sender: 'customer',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    try {
      await sendWithWebSocket(query);
    } catch {
      // HTTP is a deliberate resilience path for restrictive corporate proxies.
      await sendWithHttp(query);
    } finally {
      setIsTyping(false);
    }
  };

  const appendAssistant = (data: any) => {
    const assistantMsg: Message = {
      id: `ast-${Date.now()}`,
      sender: 'assistant', content: data.message,
      ai_activity: data.ai_activity,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    setMessages((prev) => [...prev, assistantMsg]);
    if (data.ai_activity) setSelectedActivity(data.ai_activity);
  };

  const sendWithHttp = async (query: string) => {
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: customerId,
          message: query
        })
      });

      if (response.ok) {
        appendAssistant(await response.json());
      } else {
        throw new Error('API Error');
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          content: 'Sorry, I encountered an issue connecting to the chat service. Please try again.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  const sendWithWebSocket = (query: string) => new Promise<void>((resolve, reject) => {
    const base = process.env.NEXT_PUBLIC_WS_URL || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
    const socket = new WebSocket(`${base}/api/chat/ws`);
    let text = '';
    const timeout = window.setTimeout(() => { socket.close(); reject(new Error('WebSocket timeout')); }, 8000);
    socket.onerror = () => { window.clearTimeout(timeout); reject(new Error('WebSocket unavailable')); };
    socket.onopen = () => socket.send(JSON.stringify({ customer_id: customerId, message: query }));
    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'token') text += data.content;
      if (data.type === 'done') {
        window.clearTimeout(timeout);
        appendAssistant({ ...data, message: data.message || text.trim() });
        socket.close(); resolve();
      }
    };
  });

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col lg:flex-row gap-6">
      {/* Left Chat Window */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Chat Header */}
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Supermarket AI Assistant</h3>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Active Orchestrator Mode
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowObservability(!showObservability)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              showObservability ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
            }`}
          >
            <Cpu className="w-4 h-4" />
            {showObservability ? 'Hide AI Activity' : 'Show AI Activity'}
          </button>
        </div>

        {/* Preset Prompt Bubbles */}
        <div className="p-3 bg-slate-50/50 border-b border-slate-100 flex items-center gap-2 overflow-x-auto text-xs">
          <span className="font-semibold text-slate-400 shrink-0">Try asking:</span>
          {PRESET_QUERIES.map((pq, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(pq)}
              className="px-3 py-1 bg-white border border-slate-200 hover:border-emerald-500 hover:text-emerald-700 rounded-full text-slate-600 transition-all shrink-0 font-medium"
            >
              {pq}
            </button>
          ))}
        </div>

        {/* Message History */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.sender === 'customer' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.sender === 'assistant' && (
                <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
              )}
              <div className="max-w-2xl space-y-2">
                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed ${
                    msg.sender === 'customer'
                      ? 'bg-emerald-600 text-white rounded-br-none'
                      : 'bg-slate-100 text-slate-800 rounded-bl-none border border-slate-200/60'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-400 px-1">
                  <span>{msg.timestamp}</span>
                  {msg.ai_activity && (
                    <button
                      onClick={() => setSelectedActivity(msg.ai_activity || null)}
                      className="text-emerald-600 hover:underline font-medium flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3" /> View Tool Events
                    </button>
                  )}
                </div>
              </div>
              {msg.sender === 'customer' && (
                <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center shrink-0 font-bold text-xs">
                  RS
                </div>
              )}
            </div>
          ))}

          {isTyping && (
            <div className="flex items-center space-x-2 text-slate-400 text-xs py-2">
              <Bot className="w-4 h-4 animate-bounce text-emerald-600" />
              <span>AI Assistant is orchestrating response...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 border-t border-slate-200 bg-white">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center space-x-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about orders, products, refunds, or store policies..."
              className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white p-3 rounded-xl transition-all"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      {/* Right AI Observability Panel */}
      {showObservability && (
        <div className="w-full lg:w-96 bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Cpu className="w-5 h-5 text-emerald-600" />
              <h3 className="font-bold text-slate-800 text-sm">AI Observability Panel</h3>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
              LIVE EVENTS
            </span>
          </div>

          {selectedActivity ? (
            <div className="space-y-4 text-xs">
              <div>
                <label className="text-slate-400 font-medium">Intent Detected</label>
                <p className="font-bold text-slate-800 text-sm mt-0.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
                  {selectedActivity.intent || 'GENERAL_QUERY'}
                </p>
              </div>

              <div>
                <label className="text-slate-400 font-medium">Active Sub-Agent</label>
                <div className="flex items-center space-x-2 mt-1 bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                  <Bot className="w-4 h-4 text-emerald-600" />
                  <span className="font-bold text-emerald-900">{selectedActivity.agent || 'Support Agent'}</span>
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-medium">Tools Invoked</label>
                <div className="mt-1 space-y-1">
                  {selectedActivity.tools_called && selectedActivity.tools_called.length > 0 ? (
                    selectedActivity.tools_called.map((t, idx) => (
                      <div key={idx} className="flex items-center space-x-2 font-mono bg-slate-900 text-emerald-400 p-2 rounded-lg text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span>{t}()</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 italic">No direct tool execution</p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-slate-400 font-medium">RAG Knowledge Sources</label>
                <div className="mt-1 space-y-1.5">
                  {selectedActivity.rag_sources && selectedActivity.rag_sources.length > 0 ? (
                    selectedActivity.rag_sources.map((src, idx) => (
                      <div key={idx} className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                        <div className="flex items-center justify-between font-semibold text-slate-700">
                          <span className="flex items-center gap-1">
                            <FileText className="w-3.5 h-3.5 text-slate-500" /> {src.title}
                          </span>
                          <span className="text-emerald-600 font-bold">{Math.round(src.similarity_score * 100)}% match</span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-mono">Source: {src.source}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-slate-400 italic">No RAG retrieval needed for this turn</p>
                  )}
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-500">
                <span>Confidence Metric</span>
                <span className="font-bold text-slate-800">{Math.round((selectedActivity.confidence || 0.95) * 100)}%</span>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-slate-400 space-y-2">
              <Zap className="w-8 h-8 text-slate-300 animate-pulse" />
              <p className="text-xs">Click on any message or send a query to view live agent routing and tool execution trace.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
