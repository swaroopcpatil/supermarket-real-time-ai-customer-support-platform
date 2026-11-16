import type { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { supabaseForToken } from '@/lib/supabase';
import { SYSTEM_PROMPT, TOOLS, runTool, storeContext } from '@/lib/agent';
import type { AiActivity, StoreSettings } from '@/lib/types';

export const config = { maxDuration: 120 };

type BetaMessageParam = Anthropic.Beta.Messages.BetaMessageParam;
type BetaMessage = Anthropic.Beta.Messages.BetaMessage;
type BetaToolUseBlock = Anthropic.Beta.Messages.BetaToolUseBlock;
type BetaToolResultBlockParam = Anthropic.Beta.Messages.BetaToolResultBlockParam;

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
const EFFORT = (process.env.ANTHROPIC_EFFORT || 'medium') as 'low' | 'medium' | 'high';
const MAX_TOOL_ROUNDS = 8;
const HISTORY_LIMIT = 30;

const Body = z.object({
  message: z.string().trim().min(1).max(4000),
  conversation_id: z.string().uuid().nullable().optional(),
});

let anthropic: Anthropic | null = null;
function client(): Anthropic {
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

function send(res: NextApiResponse, event: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(503).json({ error: 'The AI assistant is not configured yet (ANTHROPIC_API_KEY is missing).' });
  }

  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: 'Sign in to chat with support' });

  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Message must be 1-4000 characters' });

  const db = supabaseForToken(token);
  const { data: userData, error: userError } = await db.auth.getUser(token);
  if (userError || !userData.user) return res.status(401).json({ error: 'Your session has expired. Please sign in again.' });
  const userId = userData.user.id;

  // Find or create the conversation (RLS restricts both to this user).
  let conversationId = parsed.data.conversation_id || null;
  if (conversationId) {
    const { data } = await db.from('conversations').select('id').eq('id', conversationId).maybeSingle();
    if (!data) conversationId = null;
  }
  if (!conversationId) {
    const { data, error } = await db
      .from('conversations')
      .insert({ customer_id: userId, title: parsed.data.message.slice(0, 80) })
      .select('id')
      .single();
    if (error) return res.status(500).json({ error: 'Could not start a conversation' });
    conversationId = data.id as string;
  }

  const [{ data: history }, { data: settings }, { data: profile }] = await Promise.all([
    db.from('chat_messages').select('role, content').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(HISTORY_LIMIT),
    db.from('store_settings').select('*').eq('id', 1).maybeSingle(),
    db.from('profiles').select('full_name').eq('id', userId).maybeSingle(),
  ]);

  await db.from('chat_messages').insert({ conversation_id: conversationId, role: 'user', content: parsed.data.message });
  await db.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conversationId);

  // Prior turns are replayed as plain text; the API merges consecutive same-role turns.
  const messages: BetaMessageParam[] = (history || [])
    .reverse()
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  messages.push({ role: 'user', content: parsed.data.message });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  send(res, { type: 'conversation', conversation_id: conversationId });

  const activity: AiActivity = { tools: [], model: MODEL };
  let finalText = '';
  let aborted = false;
  let current: { abort: () => void } | null = null;
  req.on('close', () => {
    aborted = true;
    current?.abort();
  });

  const system = [
    { type: 'text' as const, text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } },
    { type: 'text' as const, text: storeContext(settings as StoreSettings | null, profile?.full_name ?? null) },
  ];

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS && !aborted; round++) {
      const stream = client().beta.messages.stream({
        model: MODEL,
        max_tokens: 16000,
        system,
        tools: TOOLS,
        messages,
        output_config: { effort: EFFORT },
        // Re-run the request on a fallback model if a safety classifier declines it.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
      current = stream;

      let roundText = '';
      stream.on('text', (delta) => {
        roundText += delta;
        send(res, { type: 'text', text: delta });
      });

      const message: BetaMessage = await stream.finalMessage();
      current = null;
      activity.stop_reason = message.stop_reason;
      activity.model = message.model;
      if (roundText) finalText += (finalText ? '\n\n' : '') + roundText;

      if (message.stop_reason === 'refusal') {
        const note = "I'm sorry, I can't help with that request. If you need help with an order, I can open a ticket for a support agent.";
        send(res, { type: 'text', text: (roundText ? '\n\n' : '') + note });
        finalText += (finalText ? '\n\n' : '') + note;
        break;
      }
      if (message.stop_reason === 'pause_turn') {
        messages.push({ role: 'assistant', content: message.content });
        continue;
      }

      const toolUses = message.content.filter((b): b is BetaToolUseBlock => b.type === 'tool_use');
      if (message.stop_reason !== 'tool_use' || toolUses.length === 0) break;

      messages.push({ role: 'assistant', content: message.content });
      const results: BetaToolResultBlockParam[] = [];
      for (const call of toolUses) {
        send(res, { type: 'tool_start', id: call.id, name: call.name, input: call.input });
        const outcome = await runTool(call.name, call.input, { db, userId, conversationId });
        if (outcome.escalated) activity.escalated = true;
        activity.tools.push({ name: call.name, input: call.input, ok: outcome.ok, summary: outcome.summary });
        send(res, { type: 'tool_end', id: call.id, name: call.name, ok: outcome.ok, summary: outcome.summary });
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: JSON.stringify(outcome.result),
          ...(outcome.ok ? {} : { is_error: true }),
        });
      }
      // All results for one assistant turn go back in a single user message.
      messages.push({ role: 'user', content: results });
    }
  } catch (err) {
    if (!aborted) {
      let message = 'The assistant is temporarily unavailable. Please try again in a moment.';
      if (err instanceof Anthropic.RateLimitError) message = 'The assistant is busy right now. Please try again in a minute.';
      else if (err instanceof Anthropic.AuthenticationError) message = 'The assistant is misconfigured (invalid API key). Please contact the store.';
      else if (err instanceof Anthropic.APIError) console.error('[chat] Anthropic API error', err.status, err.message);
      else console.error('[chat] unexpected error', err);
      send(res, { type: 'error', error: message });
    }
  }

  if (finalText.trim()) {
    await db.from('chat_messages').insert({
      conversation_id: conversationId,
      role: 'assistant',
      content: finalText,
      metadata: activity,
    });
  }
  if (!aborted) {
    send(res, { type: 'done', activity });
    res.end();
  }
}
