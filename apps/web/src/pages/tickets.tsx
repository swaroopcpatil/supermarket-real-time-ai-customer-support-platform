import React, { useState, useEffect } from 'react';
import { Ticket as TicketIcon, AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface TicketItem {
  id: string;
  customer_id: string;
  category: string;
  priority: string;
  description: string;
  status: string;
  created_at: string;
}

export default function TicketsPage() {
  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tickets?customer_id=CUS-DEMO');
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h1 className="text-xl font-bold text-slate-800">Support Tickets & Human Escalations</h1>
        <p className="text-xs text-slate-500 mt-1">Track AI-escalated tickets and human agent responses</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 font-medium">Loading support tickets...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tickets.map((t) => (
            <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-slate-900 font-mono text-sm">{t.id}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                  t.status === 'OPEN' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {t.status}
                </span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{t.description}</p>
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-400">
                <span>Category: <strong className="text-slate-600">{t.category}</strong></span>
                <span>Priority: <strong className="text-slate-800">{t.priority}</strong></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
