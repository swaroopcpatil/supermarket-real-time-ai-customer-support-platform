import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiError, GoogleGenAI, type Content, type FunctionCall, type Part } from '@google/genai';
import { z } from 'zod';
import { supabaseForToken } from '@/lib/supabase';
import { SYSTEM_PROMPT, TOOLS, runTool, storeContext } from '@/lib/agent';
import type { AiActivity, StoreSettings } from '@/lib/types';

export const config = { maxDuration: 120 };

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const MAX_TOOL_ROUNDS = 8;
const HISTORY_LIMIT = 30;

const Body = z.object({
  message: z.string().trim().min(1).max(4000),
  conversation_id: z.string().uuid().nullable().optional(),
});

let genai: GoogleGenAI | null = null;
function client(): GoogleGenAI {
  if (!genai) genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return genai;
}

const FUNCTION_DECLARATIONS = TOOLS.map((t) => ({
  name: t.name,
  description: t.description,
  parametersJsonSchema: t.input_schema,
}));

type StreamParams = Parameters<GoogleGenAI['models']['generateContentStream']>[0];

/** Open the response stream, retrying Google's temporary overload (500/503) a few times. A 429 is a quota limit and is reported instead. */
async function openStream(params: StreamParams, signal: AbortSignal) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await client().models.generateContentStream(params);
    } catch (err) {
      const retryable = err instanceof ApiError && [500, 503].includes(err.status);
      if (!retryable || attempt >= 3 || signal.aborted) throw err;
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
}

function send(res: NextApiResponse, event: Record<string, unknown>) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'The AI assistant is not configured yet (GEMINI_API_KEY is missing).' });
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

  // Prior turns are replayed as plain text. Gemini requires the history to
  // start with a user turn and alternate, so same-role neighbours are merged.
  const contents: Content[] = [];
  for (const m of (history || []).reverse()) {
    const role = m.role === 'assistant' ? 'model' : 'user';
    const last = contents[contents.length - 1];
    if (!last && role === 'model') continue;
    if (last && last.role === role) last.parts!.push({ text: m.content });
    else contents.push({ role, parts: [{ text: m.content }] });
  }
  const last = contents[contents.length - 1];
  if (last && last.role === 'user') last.parts!.push({ text: parsed.data.message });
  else contents.push({ role: 'user', parts: [{ text: parsed.data.message }] });

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
  const abort = new AbortController();
  req.on('close', () => {
    aborted = true;
    abort.abort();
  });

  const systemInstruction = `${SYSTEM_PROMPT}\n\n--- Live store information ---\n${storeContext(settings as StoreSettings | null, profile?.full_name ?? null)}`;

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS && !aborted; round++) {
      const stream = await openStream(
        {
          model: MODEL,
          contents,
          config: {
            systemInstruction,
            tools: [{ functionDeclarations: FUNCTION_DECLARATIONS }],
            maxOutputTokens: 8192,
            abortSignal: abort.signal,
          },
        },
        abort.signal,
      );

      // Keep every part exactly as received: Gemini attaches thought
      // signatures to parts and expects them back on the next request.
      const modelParts: Part[] = [];
      const calls: FunctionCall[] = [];
      let roundText = '';
      let finishReason: string | undefined;
      for await (const chunk of stream) {
        const candidate = chunk.candidates?.[0];
        if (candidate?.finishReason) finishReason = candidate.finishReason;
        for (const part of candidate?.content?.parts || []) {
          modelParts.push(part);
          if (part.functionCall) calls.push(part.functionCall);
          else if (part.text && !part.thought) {
            roundText += part.text;
            send(res, { type: 'text', text: part.text });
          }
        }
      }
      activity.stop_reason = finishReason ?? null;
      if (roundText) finalText += (finalText ? '\n\n' : '') + roundText;

      if (calls.length === 0) {
        if (!roundText && finishReason && finishReason !== 'STOP') {
          // Blocked by a safety filter or otherwise cut off without an answer.
          console.error('[chat] Gemini finished without output:', finishReason);
          const note = "I'm sorry, I couldn't answer that. If you need help with an order, you can open a ticket from Support Tickets and our team will follow up.";
          send(res, { type: 'text', text: note });
          finalText += (finalText ? '\n\n' : '') + note;
        }
        break;
      }

      contents.push({ role: 'model', parts: modelParts });
      const responses: Part[] = [];
      for (let i = 0; i < calls.length; i++) {
        const call = calls[i];
        const name = call.name || '';
        const id = call.id || `${round}-${i}`;
        send(res, { type: 'tool_start', id, name, input: call.args });
        const outcome = await runTool(name, call.args ?? {}, { db, userId, conversationId });
        if (outcome.escalated) activity.escalated = true;
        activity.tools.push({ name, input: call.args, ok: outcome.ok, summary: outcome.summary });
        send(res, { type: 'tool_end', id, name, ok: outcome.ok, summary: outcome.summary });
        responses.push({
          functionResponse: {
            ...(call.id ? { id: call.id } : {}),
            name,
            response: outcome.ok ? { output: outcome.result } : { error: outcome.result },
          },
        });
      }
      // All results for one model turn go back in a single user turn.
      contents.push({ role: 'user', parts: responses });
    }
  } catch (err) {
    if (!aborted) {
      // Customers never see billing or configuration details; staff see them in the logs.
      const handOff = ' You can still reach our team from Support Tickets → New ticket.';
      let message = `The assistant is temporarily unavailable. Please try again in a moment.${handOff}`;
      if (err instanceof ApiError) {
        console.error('[chat] Gemini API error', err.status, err.message);
        if (err.status === 429) message = 'The assistant is busy right now. Please try again in a minute.';  // quota or rate limit; also visible in /api/health
        else if (err.status === 400 || err.status === 401 || err.status === 403) message = `The assistant is offline right now.${handOff}`;
      } else {
        console.error('[chat] unexpected error', err);
      }
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
