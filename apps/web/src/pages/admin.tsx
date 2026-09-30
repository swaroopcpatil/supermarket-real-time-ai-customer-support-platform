import React from 'react';
import { Users, ShoppingBag, Ticket, RefreshCw, MessageSquare, ShieldAlert, Clock, Award } from 'lucide-react';

export default function AdminDashboard() {
  const kpis = [
    { name: 'Total Customers', value: '1,420', change: '+12%', icon: Users, color: 'text-blue-600 bg-blue-50' },
    { name: 'Orders Today', value: '184', change: '+8%', icon: ShoppingBag, color: 'text-emerald-600 bg-emerald-50' },
    { name: 'Open Tickets', value: '4', change: '-25%', icon: Ticket, color: 'text-amber-600 bg-amber-50' },
    { name: 'Refund Requests', value: '12', change: 'Normal', icon: RefreshCw, color: 'text-purple-600 bg-purple-50' },
    { name: 'AI Conversations', value: '840', change: '+34%', icon: MessageSquare, color: 'text-indigo-600 bg-indigo-50' },
    { name: 'AI Escalation Rate', value: '4.2%', change: '-1.1%', icon: ShieldAlert, color: 'text-rose-600 bg-rose-50' },
    { name: 'Avg Response Time', value: '1.2s', change: 'Fast', icon: Clock, color: 'text-teal-600 bg-teal-50' },
    { name: 'AI Resolution Rate', value: '95.8%', change: '+2.4%', icon: Award, color: 'text-emerald-700 bg-emerald-100' },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Admin Operations & AI Analytics</h1>
          <p className="text-xs text-slate-500 mt-1">Real-time system health, agent metrics, and customer satisfaction</p>
        </div>
        <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold text-xs">
          System Status: Operational
        </span>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">{kpi.name}</span>
                <div className={`p-2 rounded-xl ${kpi.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-extrabold text-slate-900">{kpi.value}</span>
                <span className="text-xs font-bold text-emerald-600">{kpi.change}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Analytics Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversation Volume Chart Mock */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-sm">AI Conversations Over Time</h3>
          <div className="h-48 flex items-end justify-between gap-2 pt-6">
            {[45, 60, 75, 90, 110, 140, 180, 210, 190, 240, 280, 310].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <div
                  style={{ height: `${(h / 310) * 100}%` }}
                  className="w-full bg-emerald-500 hover:bg-emerald-600 rounded-t-md transition-all"
                ></div>
                <span className="text-[10px] text-slate-400">{i + 1}h</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI Agent Workload Breakdown */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <h3 className="font-bold text-slate-800 text-sm">Agent Workload Distribution</h3>
          <div className="space-y-3 text-xs">
            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Product Agent (Catalog/Search)</span>
                <span>42%</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full w-[42%]"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Order Agent (Tracking/Cancel)</span>
                <span>31%</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full w-[31%]"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Support Agent (RAG/Policies)</span>
                <span>18%</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-indigo-500 h-full w-[18%]"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Refund Agent (Damaged/Return)</span>
                <span>5%</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-purple-500 h-full w-[5%]"></div>
              </div>
            </div>

            <div>
              <div className="flex justify-between font-semibold mb-1">
                <span>Escalation Agent (Human Handover)</span>
                <span>4%</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div className="bg-rose-500 h-full w-[4%]"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
