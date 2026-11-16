import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { TOOLS, runTool, storeContext } from '../agent';

function fakeDb(rpcResult: { data: unknown; error: { message: string } | null }) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  return { db: { rpc } as unknown as SupabaseClient, rpc };
}

describe('tool definitions', () => {
  it('are strict, closed schemas that list every property as required', () => {
    for (const tool of TOOLS) {
      expect(tool.strict, tool.name).toBe(true);
      const schema = tool.input_schema as { properties: Record<string, unknown>; required: string[]; additionalProperties: boolean };
      expect(schema.additionalProperties, tool.name).toBe(false);
      expect([...schema.required].sort(), tool.name).toEqual(Object.keys(schema.properties).sort());
    }
  });

  it('have unique names', () => {
    const names = TOOLS.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('runTool', () => {
  const ctx = { userId: 'user-1', conversationId: 'conv-1' };

  it('rejects unknown tools and invalid input without touching the database', async () => {
    const { db, rpc } = fakeDb({ data: null, error: null });
    expect((await runTool('drop_tables', {}, { db, ...ctx })).ok).toBe(false);
    expect((await runTool('cancel_order', { order_number: 42 }, { db, ...ctx })).ok).toBe(false);
    expect((await runTool('request_refund', { order_number: 'ORD-1', reason: '', amount: null }, { db, ...ctx })).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('normalises order numbers before cancelling', async () => {
    const { db, rpc } = fakeDb({ data: { order_number: 'ORD-100004', status: 'CANCELLED' }, error: null });
    const out = await runTool('cancel_order', { order_number: ' ord-100004 ', reason: 'ordered twice' }, { db, ...ctx });
    expect(rpc).toHaveBeenCalledWith('cancel_order', { p_order_number: 'ORD-100004', p_reason: 'ordered twice' });
    expect(out).toMatchObject({ ok: true, summary: 'Cancelled ORD-100004' });
  });

  it('accepts a bare number as an order number', async () => {
    const { db, rpc } = fakeDb({ data: { refund_number: 'RFD-100001', amount: 58, status: 'PENDING' }, error: null });
    await runTool('request_refund', { order_number: '100001', reason: 'leaking', amount: 58 }, { db, ...ctx });
    expect(rpc).toHaveBeenCalledWith('request_refund', { p_order_number: 'ORD-100001', p_reason: 'leaking', p_amount: 58 });
  });

  it('passes database rule violations back to the model as errors', async () => {
    const { db } = fakeDb({ data: null, error: { message: 'Order ORD-100001 is OUT_FOR_DELIVERY and can no longer be cancelled' } });
    const out = await runTool('cancel_order', { order_number: 'ORD-100001', reason: 'late' }, { db, ...ctx });
    expect(out.ok).toBe(false);
    expect(out.result).toEqual({ error: 'Order ORD-100001 is OUT_FOR_DELIVERY and can no longer be cancelled' });
  });
});

describe('storeContext', () => {
  it('includes the live store rules the assistant must follow', () => {
    const text = storeContext(
      {
        store_name: 'Fresh Mart',
        support_email: null,
        support_phone: '+91 80 0000 0000',
        store_hours: 'Daily 7-22',
        support_hours: 'Daily 8-21',
        currency: 'INR',
        free_delivery_threshold: 499,
        delivery_fee: 39,
        refund_window_hours: 48,
        cancellable_statuses: ['PLACED', 'CONFIRMED', 'PACKING'],
      },
      'Asha',
    );
    expect(text).toContain('Fresh Mart');
    expect(text).toContain('Rs 499');
    expect(text).toContain('48 hours');
    expect(text).toContain('Asha');
    expect(text).not.toContain('Support email');
  });
});
