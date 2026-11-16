const COLORS: Record<string, string> = {
  PLACED: 'bg-slate-100 text-slate-700',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  PACKING: 'bg-indigo-50 text-indigo-700',
  OUT_FOR_DELIVERY: 'bg-amber-50 text-amber-700',
  DELIVERED: 'bg-emerald-50 text-emerald-700',
  CANCELLED: 'bg-red-50 text-red-700',
  PENDING: 'bg-amber-50 text-amber-700',
  APPROVED: 'bg-emerald-50 text-emerald-700',
  REJECTED: 'bg-red-50 text-red-700',
  OPEN: 'bg-amber-50 text-amber-700',
  IN_PROGRESS: 'bg-blue-50 text-blue-700',
  RESOLVED: 'bg-emerald-50 text-emerald-700',
  CLOSED: 'bg-slate-100 text-slate-600',
  URGENT: 'bg-red-50 text-red-700',
  HIGH: 'bg-orange-50 text-orange-700',
  MEDIUM: 'bg-slate-100 text-slate-700',
  LOW: 'bg-slate-50 text-slate-500',
};

export default function StatusBadge({ value }: { value: string }) {
  return (
    <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${COLORS[value] || 'bg-slate-100 text-slate-700'}`}>
      {value.replace(/_/g, ' ')}
    </span>
  );
}
