import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { getSupabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { formatINR } from '@/lib/types';
import AdminOrders from '@/components/admin/AdminOrders';
import AdminRefunds from '@/components/admin/AdminRefunds';
import AdminTickets from '@/components/admin/AdminTickets';
import AdminProducts from '@/components/admin/AdminProducts';
import AdminPolicies from '@/components/admin/AdminPolicies';
import AdminSettings from '@/components/admin/AdminSettings';

const TABS = ['Overview', 'Orders', 'Refunds', 'Tickets', 'Products', 'Policies', 'Settings'] as const;
type Tab = (typeof TABS)[number];

type Stats = Record<string, number>;

function Overview({ go }: { go: (t: Tab) => void }) {
  const [stats, setStats] = useState<Stats | null>(null);
  const load = useCallback(async () => {
    const { data } = await getSupabase().rpc('admin_stats');
    setStats(data as Stats);
  }, []);

  useEffect(() => {
    load();
    const supabase = getSupabase();
    const channel = supabase
      .channel('admin-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'refunds' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [load]);

  if (!stats) return <p className="text-sm text-slate-500">Loading…</p>;
  const cards: { label: string; value: string; tab?: Tab; warn?: boolean }[] = [
    { label: 'Orders today', value: String(stats.orders_today), tab: 'Orders' },
    { label: 'Revenue today', value: formatINR(stats.revenue_today), tab: 'Orders' },
    { label: 'Orders to fulfil', value: String(stats.open_orders), tab: 'Orders', warn: stats.open_orders > 0 },
    { label: 'Refunds to review', value: String(stats.pending_refunds), tab: 'Refunds', warn: stats.pending_refunds > 0 },
    { label: 'Open tickets', value: String(stats.open_tickets), tab: 'Tickets', warn: stats.open_tickets > 0 },
    { label: 'AI chats today', value: String(stats.conversations_today) },
    { label: 'Products live', value: String(stats.products_live), tab: 'Products' },
    { label: 'Products needing a price', value: String(stats.products_unpriced), tab: 'Products', warn: stats.products_unpriced > 0 },
    { label: 'Low stock (≤5)', value: String(stats.low_stock), tab: 'Products', warn: stats.low_stock > 0 },
    { label: 'Customers', value: String(stats.customers) },
  ];
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <button key={c.label} onClick={() => c.tab && go(c.tab)} className={`text-left bg-white border rounded-2xl p-4 ${c.warn ? 'border-amber-300' : 'border-slate-200'} ${c.tab ? 'hover:border-emerald-400' : 'cursor-default'}`}>
          <p className="text-xs text-slate-500">{c.label}</p>
          <p className="text-2xl font-bold text-slate-800 mt-1">{c.value}</p>
        </button>
      ))}
    </div>
  );
}

export default function Admin() {
  const router = useRouter();
  const { isStaff, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('Overview');

  useEffect(() => {
    if (profile && !isStaff) router.replace('/products');
  }, [profile, isStaff, router]);

  if (!isStaff) return <p className="text-sm text-slate-500">Staff access only.</p>;

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px ${tab === t ? 'border-emerald-600 text-emerald-700 font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Overview' && <Overview go={setTab} />}
      {tab === 'Orders' && <AdminOrders />}
      {tab === 'Refunds' && <AdminRefunds />}
      {tab === 'Tickets' && <AdminTickets />}
      {tab === 'Products' && <AdminProducts />}
      {tab === 'Policies' && <AdminPolicies />}
      {tab === 'Settings' && <AdminSettings />}
    </div>
  );
}
