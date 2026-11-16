import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { BarChart3, Bell, LogOut, Menu, MessageSquare, Package, ShoppingBag, ShoppingCart, Ticket, User, X } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { getSupabase } from '@/lib/supabase';
import type { Notification } from '@/lib/types';

function NotificationBell({ userId }: { userId: string }) {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = getSupabase();
    supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setItems((data as Notification[]) || []));

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
        setItems((prev) => [payload.new as Notification, ...prev].slice(0, 20));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const unread = items.filter((n) => !n.is_read).length;

  async function markAllRead() {
    const ids = items.filter((n) => !n.is_read).map((n) => n.id);
    if (!ids.length) return;
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await getSupabase().from('notifications').update({ is_read: true }).in('id', ids);
  }

  return (
    <div className="relative">
      <button
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) markAllRead();
        }}
        className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg relative"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-xl shadow-xl z-50">
          <div className="px-4 py-3 border-b border-slate-100 text-sm font-semibold text-slate-800">Notifications</div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="p-4 text-sm text-slate-500">No notifications yet.</p>}
            {items.map((n) => (
              <button
                key={n.id}
                onClick={() => {
                  setOpen(false);
                  if (n.link) router.push(n.link);
                }}
                className="w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50"
              >
                <p className="text-sm font-medium text-slate-800">{n.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{n.message}</p>
                <p className="text-[10px] text-slate-400 mt-1">{new Date(n.created_at).toLocaleString('en-IN')}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { profile, isStaff, signOut, session } = useAuth();
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  const navItems = [
    { name: 'Shop', path: '/products', icon: ShoppingBag },
    { name: 'Cart', path: '/cart', icon: ShoppingCart, badge: count },
    { name: 'AI Support', path: '/chat', icon: MessageSquare },
    { name: 'My Orders', path: '/orders', icon: Package },
    { name: 'Support Tickets', path: '/tickets', icon: Ticket },
    { name: 'Profile', path: '/profile', icon: User },
    ...(isStaff ? [{ name: 'Store Admin', path: '/admin', icon: BarChart3 }] : []),
  ];

  const nav = (
    <nav className="flex-1 p-4 space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        const active = router.pathname === item.path || router.pathname.startsWith(`${item.path}/`);
        return (
          <Link
            key={item.path}
            href={item.path}
            onClick={() => setMenuOpen(false)}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
              active ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="flex-1">{item.name}</span>
            {item.badge ? <span className="text-xs bg-white/20 rounded-full px-2 py-0.5">{item.badge}</span> : null}
          </Link>
        );
      })}
    </nav>
  );

  const initials = (profile?.full_name || profile?.email || '?')
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <aside className="hidden md:flex w-64 bg-slate-900 text-white flex-col">
        <div className="p-5 border-b border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center font-bold text-xl">S</div>
          <div>
            <h1 className="font-bold text-base">SuperMarket</h1>
            <p className="text-xs text-slate-400">Shop &amp; Support</p>
          </div>
        </div>
        {nav}
        <button onClick={async () => { await signOut(); router.replace('/login'); }} className="m-4 flex items-center gap-2 px-4 py-3 text-sm text-slate-400 hover:text-white">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </aside>

      {menuOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-64 bg-slate-900 text-white flex flex-col">
            <div className="p-4 flex justify-between items-center border-b border-slate-800">
              <span className="font-bold">SuperMarket</span>
              <button aria-label="Close menu" onClick={() => setMenuOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            {nav}
            <button onClick={async () => { await signOut(); router.replace('/login'); }} className="m-4 flex items-center gap-2 px-4 py-3 text-sm text-slate-400">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setMenuOpen(false)} />
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button aria-label="Open menu" className="md:hidden p-2 -ml-2" onClick={() => setMenuOpen(true)}><Menu className="w-5 h-5" /></button>
            <h2 className="text-lg font-bold text-slate-800">{navItems.find((i) => router.pathname.startsWith(i.path))?.name || 'SuperMarket'}</h2>
          </div>
          <div className="flex items-center gap-3">
            {session && <NotificationBell userId={session.user.id} />}
            <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs">{initials}</div>
              <div className="text-xs">
                <p className="font-semibold text-slate-800">{profile?.full_name || profile?.email}</p>
                <p className="text-slate-500 capitalize">{profile?.role}</p>
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
