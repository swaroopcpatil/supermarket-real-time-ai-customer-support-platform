import React, { useEffect } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { useRouter } from 'next/router';
import '@/styles/globals.css';
import Layout from '@/components/Layout';
import { AuthProvider, useAuth } from '@/lib/auth';
import { CartProvider } from '@/lib/cart';
import { supabaseConfigured } from '@/lib/supabase';

const PUBLIC_PATHS = ['/login', '/register', '/reset-password'];

function Shell({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const { loading, session } = useAuth();
  const isPublic = PUBLIC_PATHS.includes(router.pathname);

  useEffect(() => {
    if (loading) return;
    if (!session && !isPublic) router.replace(`/login?next=${encodeURIComponent(router.asPath)}`);
    if (session && isPublic && router.pathname !== '/reset-password') router.replace('/products');
  }, [loading, session, isPublic, router]);

  if (!supabaseConfigured()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-md">
          <h1 className="text-xl font-bold text-slate-800">Setup required</h1>
          <p className="text-sm text-slate-600 mt-2">
            Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your environment, then redeploy.
          </p>
        </div>
      </div>
    );
  }
  if (isPublic) return <Component {...pageProps} />;
  if (loading || !session) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Loading…</div>;
  }
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}

export default function App(props: AppProps) {
  return (
    <>
      <Head>
        <title>SuperMarket — Shop &amp; Support</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <AuthProvider>
        <CartProvider>
          <Shell {...props} />
        </CartProvider>
      </AuthProvider>
    </>
  );
}
