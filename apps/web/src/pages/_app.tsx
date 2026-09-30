import React, { useEffect, useState } from 'react';
import '@/styles/globals.css';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ShoppingCart, MessageSquare, Package, Ticket, BarChart3, User, Bell } from 'lucide-react';

export default function App({ Component, pageProps }: any) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const publicPaths = ['/login', '/register'];
  const isPublicPath = publicPaths.includes(router.pathname);

  useEffect(() => {
    const hasSession = Boolean(localStorage.getItem('supermarket_auth'));
    setAuthenticated(hasSession);
    if (!hasSession && !isPublicPath) router.replace('/login');
    if (hasSession && isPublicPath) router.replace('/chat');
    setAuthChecked(true);
  }, [isPublicPath, router]);

  // Public pages do not render the authenticated dashboard shell.  This also
  // prevents protected content flashing before the client-side redirect.
  if (isPublicPath) return <Component {...pageProps} />;
  if (!authChecked || !authenticated) {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-sm text-slate-500">Checking your session…</div>;
  }

  const navItems = [
    { name: 'AI Support Chat', path: '/chat', icon: MessageSquare },
    { name: 'Products Catalog', path: '/products', icon: ShoppingCart },
    { name: 'My Orders', path: '/orders', icon: Package },
    { name: 'Support Tickets', path: '/tickets', icon: Ticket },
    { name: 'Admin Analytics', path: '/admin', icon: BarChart3 },
    { name: 'Account Profile', path: '/profile', icon: User },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-slate-900 text-white flex flex-col border-r border-slate-800">
        <div className="p-5 border-b border-slate-800 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white font-bold text-xl shadow-lg">
            S
          </div>
          <div>
            <h1 className="font-bold text-base text-white tracking-wide">SuperMarket AI</h1>
            <p className="text-xs text-slate-400">Customer Support Platform</p>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = router.pathname === item.path || (item.path !== '/' && router.pathname.startsWith(item.path));
            return (
              <Link
                key={item.path}
                href={item.path}
                className={`flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="bg-slate-800/80 p-3 rounded-xl text-xs text-slate-300">
            <p className="font-medium text-white mb-1">AI Engine Mode</p>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>NVIDIA NIM / Local Mock</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h2 className="text-lg font-bold text-slate-800">
              {navItems.find((i) => i.path === router.pathname)?.name || 'Dashboard'}
            </h2>
          </div>
          <div className="flex items-center space-x-4">
            <button className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-emerald-500 rounded-full"></span>
            </button>
            <div className="flex items-center space-x-3 pl-4 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-sm">
                RS
              </div>
              <div className="text-xs">
                <p className="font-semibold text-slate-800">Rahul Sharma</p>
                <p className="text-slate-500">Rahul (Customer)</p>
              </div>
            </div>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 overflow-y-auto p-6">
          <Component {...pageProps} />
        </main>
      </div>
    </div>
  );
}
