import React, { useCallback, useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';
import type { KbDocument } from '@/lib/types';

const EMPTY = { id: '', slug: '', title: '', category: 'Policy', content: '' };

export default function AdminPolicies() {
  const [docs, setDocs] = useState<KbDocument[]>([]);
  const [editing, setEditing] = useState<typeof EMPTY | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const { data } = await getSupabase().from('kb_documents').select('*').order('title');
    setDocs((data as KbDocument[]) || []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setError('');
    const payload = {
      title: editing.title.trim(),
      category: editing.category.trim() || 'Policy',
      content: editing.content.trim(),
      slug: editing.slug || editing.title.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
    };
    const { error } = editing.id
      ? await getSupabase().from('kb_documents').update(payload).eq('id', editing.id)
      : await getSupabase().from('kb_documents').insert(payload);
    if (error) setError(error.message);
    else {
      setEditing(null);
      load();
    }
  }

  async function remove(doc: KbDocument) {
    if (!confirm(`Delete "${doc.title}"? The assistant will stop using it.`)) return;
    await getSupabase().from('kb_documents').delete().eq('id', doc.id);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-slate-500">The AI assistant answers policy questions only from these documents. Keep them accurate.</p>
        <button onClick={() => setEditing({ ...EMPTY })} className="text-sm bg-emerald-600 text-white rounded-lg px-3 py-2">New document</button>
      </div>
      {editing && (
        <form onSubmit={save} className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            <input required value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Title" className="text-sm border border-slate-300 rounded-lg px-3 py-2" />
            <input value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })} placeholder="Category" className="text-sm border border-slate-300 rounded-lg px-3 py-2" />
          </div>
          <textarea required rows={8} value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2" />
          <div className="flex gap-2">
            <button className="text-sm bg-slate-900 text-white rounded-lg px-4 py-2">Save</button>
            <button type="button" onClick={() => setEditing(null)} className="text-sm border border-slate-300 rounded-lg px-4 py-2">Cancel</button>
          </div>
        </form>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        {docs.map((d) => (
          <div key={d.id} className="bg-white border border-slate-200 rounded-2xl p-4">
            <div className="flex justify-between gap-2">
              <div>
                <p className="font-semibold text-sm">{d.title}</p>
                <p className="text-[11px] text-slate-500">{d.category} · updated {new Date(d.updated_at).toLocaleDateString('en-IN')}</p>
              </div>
              <div className="text-xs space-x-2 whitespace-nowrap">
                <button onClick={() => setEditing({ id: d.id, slug: d.slug, title: d.title, category: d.category, content: d.content })} className="text-emerald-700">Edit</button>
                <button onClick={() => remove(d)} className="text-red-600">Delete</button>
              </div>
            </div>
            <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap line-clamp-6">{d.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
