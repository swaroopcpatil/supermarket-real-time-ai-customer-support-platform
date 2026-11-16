import type { NextApiRequest, NextApiResponse } from 'next';
import { ApiError, GoogleGenAI } from '@google/genai';
import { createClient } from '@supabase/supabase-js';

/**
 * Operational health check. Verifies that the database is reachable and that
 * the Gemini key can make a real model request (a token count, which costs
 * nothing). Never returns secret values.
 */
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
  const result: Record<string, unknown> = { ok: true, model };

  try {
    const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '', {
      auth: { persistSession: false },
    });
    const { error } = await db.from('store_settings').select('id').eq('id', 1).single();
    result.database = error ? `error: ${error.message}` : 'ok';
  } catch (err) {
    result.database = `error: ${err instanceof Error ? err.message : 'unreachable'}`;
  }

  if (!process.env.GEMINI_API_KEY) {
    result.ai = 'not configured (GEMINI_API_KEY missing)';
  } else {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { timeout: 10_000 } });
      await ai.models.countTokens({ model, contents: 'ping' });
      result.ai = 'ok';
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 429) result.ai = 'quota exceeded: check usage and billing in Google AI Studio';
        else if (err.status === 400 || err.status === 401 || err.status === 403) result.ai = 'API key rejected';
        else if (err.status === 404) result.ai = `model ${model} not found`;
        else result.ai = `error ${err.status}`;
      } else {
        result.ai = 'unreachable';
      }
    }
  }

  result.ok = result.database === 'ok' && result.ai === 'ok';
  res.setHeader('Cache-Control', 'no-store');
  res.status(result.ok ? 200 : 503).json(result);
}
