import React from 'react';
import { User, Shield, CreditCard, MapPin } from 'lucide-react';

export default function ProfilePage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
        <div className="w-16 h-16 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-2xl">
          RS
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Rahul Sharma</h2>
          <p className="text-xs text-slate-500">customer@supermarket.com • ID: CUS-DEMO</p>
          <span className="inline-block mt-2 text-[10px] font-bold bg-amber-100 text-amber-800 px-2.5 py-0.5 rounded-full">
            SMART SAVER MEMBER
          </span>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-800 text-sm">Account Details</h3>
        <div className="space-y-3 text-xs">
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">Primary Phone</span>
            <span className="font-semibold text-slate-800">+91-9876543210</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">Default Delivery Address</span>
            <span className="font-semibold text-slate-800">21 Lake View Road, Indiranagar, Bengaluru</span>
          </div>
          <div className="flex justify-between py-2 border-b border-slate-100">
            <span className="text-slate-500">Supermarket Wallet Balance</span>
            <span className="font-bold text-emerald-600">₹250.00</span>
          </div>
        </div>
      </div>
    </div>
  );
}
