import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Product } from './types';

export interface CartLine {
  product_id: string;
  name: string;
  price: number;
  image_url: string | null;
  quantity: number;
  max: number;
}

interface CartState {
  lines: CartLine[];
  count: number;
  subtotal: number;
  add: (p: Product, qty?: number) => void;
  setQuantity: (productId: string, qty: number) => void;
  remove: (productId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartState | null>(null);
const STORAGE_KEY = 'supermarket_cart_v1';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setLines(JSON.parse(saved));
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      /* storage unavailable */
    }
  }, [lines]);

  const value: CartState = {
    lines,
    count: lines.reduce((n, l) => n + l.quantity, 0),
    subtotal: lines.reduce((s, l) => s + l.price * l.quantity, 0),
    add: (p, qty = 1) => {
      if (p.price === null) return;
      setLines((prev) => {
        const existing = prev.find((l) => l.product_id === p.id);
        const max = Math.min(p.stock_quantity, 50);
        if (existing) {
          return prev.map((l) => (l.product_id === p.id ? { ...l, quantity: Math.min(l.quantity + qty, max), max, price: Number(p.price) } : l));
        }
        return [...prev, { product_id: p.id, name: p.name, price: Number(p.price), image_url: p.image_url, quantity: Math.min(qty, max), max }];
      });
    },
    setQuantity: (productId, qty) =>
      setLines((prev) => prev.map((l) => (l.product_id === productId ? { ...l, quantity: Math.max(1, Math.min(qty, l.max)) } : l))),
    remove: (productId) => setLines((prev) => prev.filter((l) => l.product_id !== productId)),
    clear: () => setLines([]),
  };
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
