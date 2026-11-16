import type { NextApiRequest, NextApiResponse } from 'next';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

/**
 * Operational health check. Verifies that the database is reachable and that
 * the Anthropic key is valid (a models lookup, which uses no tokens).
 * Never returns secret values.
 */
export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const model = process.env.ANTHROPIC_MODEL || 'claude-opus-5-5';
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

  if (!process.env.ANTHROPIC_API_KEY) {
    result.ai = 'not configured (ANTHROPIC_API_KEY missing)';
  } else {
    try {
      await new Anthropic({ maxRetries: 0, timeout: 10_000 }).models.retrieve(model);
      result.ai = 'ok';
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) result.ai = 'invalid API key';
      else if (err instanceof Anthropic.PermissionDeniedError) result.ai = 'key not allowed to use this model';
      else if (err instanceof Anthropic.NotFoundError) result.ai = `model ${model} not found`;
      else if (err instanceof Anthropic.APIError) result.ai = `error ${err.status ?? ''}`.trim();
      else result.ai = 'unreachable';
    }
  }

  result.ok = result.database === 'ok' && result.ai === 'ok';
  res.setHeader('Cache-Control', 'no-store');
  res.status(result.ok ? 200 : 503).json(result);
}
