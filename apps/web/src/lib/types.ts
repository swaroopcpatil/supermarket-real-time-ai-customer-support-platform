export type Role = 'customer' | 'staff' | 'admin';

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  default_address: string | null;
  role: Role;
}

export interface Product {
  id: string;
  barcode: string | null;
  name: string;
  brand: string | null;
  category: string;
  quantity_label: string | null;
  description: string | null;
  ingredients: string | null;
  nutriscore_grade: string | null;
  image_url: string | null;
  price: number | null;
  mrp: number | null;
  stock_quantity: number;
  is_active: boolean;
  source: 'openfoodfacts' | 'csv' | 'manual';
  updated_at: string;
}

export type OrderStatus = 'PLACED' | 'CONFIRMED' | 'PACKING' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export interface OrderItem {
  id: string;
  product_id: string | null;
  name: string;
  unit_price: number;
  quantity: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  status: OrderStatus;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  delivery_address: string;
  payment_method: string;
  payment_status: string;
  notes: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export interface Refund {
  id: string;
  refund_number: string;
  order_id: string;
  customer_id: string;
  reason: string;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  staff_note: string | null;
  created_at: string;
  orders?: { order_number: string } | null;
}

export interface Ticket {
  id: string;
  ticket_number: string;
  customer_id: string;
  conversation_id: string | null;
  order_id: string | null;
  category: string;
  priority: string;
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  resolution: string | null;
  created_at: string;
  updated_at: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface StoreSettings {
  store_name: string;
  support_email: string | null;
  support_phone: string | null;
  store_hours: string;
  support_hours: string;
  currency: string;
  free_delivery_threshold: number;
  delivery_fee: number;
  refund_window_hours: number;
  cancellable_statuses: string[];
}

export interface KbDocument {
  id: string;
  slug: string;
  title: string;
  category: string;
  content: string;
  updated_at: string;
}

/** What the chat UI shows about each assistant turn. */
export interface AiActivity {
  tools: { name: string; input: unknown; ok: boolean; summary: string }[];
  model?: string;
  stop_reason?: string | null;
  escalated?: boolean;
}

export const ORDER_STATUSES: OrderStatus[] = ['PLACED', 'CONFIRMED', 'PACKING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];

export function formatINR(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(value));
}
