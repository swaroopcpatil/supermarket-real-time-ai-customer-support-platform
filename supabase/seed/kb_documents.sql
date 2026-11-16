-- Starter store policies for the AI assistant's knowledge base.
-- These match how the app behaves out of the box (see store_settings).
-- Edit them from Admin > Policies to reflect your store's real rules.
insert into public.kb_documents (slug, title, category, content) values
('refund-policy', 'Refund policy', 'Refunds',
$$Damaged, spoiled, expired, missing or incorrect items can be reported within 48 hours of delivery.
How to request: open the order in My Orders and choose "Request refund", or ask the AI assistant with your order number (for example ORD-100001).
Every refund request starts as PENDING and is reviewed by our support team. The assistant can submit a request for you but cannot approve it.
Approved refunds for cash or UPI-on-delivery orders are paid back to your UPI ID or bank account; card-on-delivery refunds go back to the same card. Allow 3-5 business days after approval.
Change of mind: perishable goods (dairy, bakery, meat, fruits and vegetables, frozen food) cannot be refunded for change of mind.$$),

('return-policy', 'Return policy', 'Refunds',
$$Unopened non-perishable grocery and household items can be returned within 7 days of delivery in their original packaging. Ask the assistant or open a support ticket to arrange the return.
Perishable items are not returnable after you accept delivery unless they were damaged or spoiled on arrival; report those within 48 hours as a refund request.
Opened personal care and hygiene products cannot be returned.$$),

('delivery-policy', 'Delivery policy and charges', 'Delivery',
$$Delivery is free on orders of Rs 499 or more. Orders below Rs 499 have a Rs 39 delivery charge, shown at checkout before you place the order.
Deliveries run daily during store hours. You can track every order in real time in My Orders: PLACED, CONFIRMED, PACKING, OUT FOR DELIVERY, DELIVERED.
You receive an in-app notification every time your order status changes.$$),

('cancellation-policy', 'Order cancellation', 'Orders',
$$You can cancel an order yourself while it is PLACED, CONFIRMED or PACKING, from My Orders or by asking the assistant.
Once an order is OUT FOR DELIVERY it can no longer be cancelled; you can refuse the delivery or request a refund after it is delivered.
Cancelled orders are not charged because payment is collected on delivery.$$),

('payment-policy', 'Payment methods', 'Payments',
$$Payment is collected at delivery. Accepted methods: cash on delivery, UPI on delivery (scan the delivery partner's QR code), and card on delivery.
You choose the payment method at checkout. You are not charged anything when placing an order.$$),

('store-hours', 'Store and support hours', 'Store',
$$The store is open daily from 7:00 AM to 10:00 PM.
The AI assistant is available 24/7. Human support agents answer tickets daily from 8:00 AM to 9:00 PM; tickets raised outside those hours are answered the next morning.$$),

('damaged-products', 'Damaged or spoiled products', 'Refunds',
$$If an item arrives crushed, leaking, broken, spoiled or past its expiry date, report it within 48 hours of delivery.
Open the order in My Orders and choose "Request refund", or tell the assistant your order number and what was wrong. A clear description helps the support team approve it faster.$$),

('human-support', 'Talking to a human agent', 'Support',
$$Ask the assistant for a human agent at any time ("I want to talk to a person"). It will open a support ticket with your conversation attached, and you can follow it in Support Tickets.
You can also open a ticket yourself from the Support Tickets page.$$)
on conflict (slug) do nothing;
