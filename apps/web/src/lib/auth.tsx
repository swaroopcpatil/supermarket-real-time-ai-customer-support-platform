import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, supabaseConfigured } from './supabase';
import type { Profile } from './types';

interface AuthState {
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  isStaff: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  loading: true,
  session: null,
  profile: null,
  isStaff: false,
  refreshProfile: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (s: Session | null) => {
    if (!s) {
      setProfile(null);
      return;
    }
    const { data } = await getSupabase().from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setProfile((data as Profile) || null);
  }, []);

  useEffect(() => {
    if (!supabaseConfigured()) {
      setLoading(false);
      return;
    }
    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      // Defer the profile query so it never runs inside the auth callback.
      setTimeout(() => loadProfile(s), 0);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const value: AuthState = {
    loading,
    session,
    profile,
    isStaff: profile?.role === 'staff' || profile?.role === 'admin',
    refreshProfile: () => loadProfile(session),
    signOut: async () => {
      await getSupabase().auth.signOut();
      setSession(null);
      setProfile(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** fetch() wrapper that sends the user's access token to our API routes. */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const { data } = await getSupabase().auth.getSession();
  const token = data.session?.access_token;
  return fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}
