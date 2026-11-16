import { createClient, SupabaseClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function supabaseConfigured(): boolean {
  return Boolean(url && anonKey);
}

let browserClient: SupabaseClient | null = null;

/** Singleton client for the browser. Session is persisted in localStorage. */
export function getSupabase(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
  }
  if (!browserClient) {
    browserClient = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }
  return browserClient;
}

/**
 * Server-side client that acts as the signed-in user. Every query goes
 * through row level security with the caller's own permissions, so API
 * routes never need the service role key.
 */
export function supabaseForToken(accessToken: string): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are not configured');
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
