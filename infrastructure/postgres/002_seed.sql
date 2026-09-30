-- Seed Stores
INSERT INTO stores (id, name, address, city, pincode) VALUES
('STORE-001', 'Supermarket Indiranagar', '100 Feet Road, Indiranagar', 'Bengaluru', '560038'),
('STORE-002', 'Supermarket HSR Layout', 'Sector 3, HSR Layout', 'Bengaluru', '560102'),
('STORE-003', 'Supermarket Koramangala', '5th Block, Koramangala', 'Bengaluru', '560095'),
('STORE-004', 'Supermarket Whitefield', 'ITPL Main Road, Whitefield', 'Bengaluru', '560066'),
('STORE-005', 'Supermarket JP Nagar', '2nd Phase, JP Nagar', 'Bengaluru', '560078')
ON CONFLICT (id) DO NOTHING;

-- Seed Users (default password hash for 'password123')
INSERT INTO users (id, email, password_hash, full_name, role) VALUES
('USR-DEMO', 'customer@supermarket.com', '73616c7431323334353637383930:3546366663363363386638316130', 'Rahul Sharma', 'CUSTOMER'),
('USR-ADMIN', 'admin@supermarket.com', '73616c7431323334353637383930:3546366663363363386638316130', 'Supermarket Admin', 'ADMIN'),
('USR-AGENT1', 'support@supermarket.com', '73616c7431323334353637383930:3546366663363363386638316130', 'Priya Support Agent', 'SUPPORT_AGENT')
ON CONFLICT (id) DO NOTHING;

-- Seed Customers
INSERT INTO customers (id, user_id, phone, address, city, membership_tier, wallet_balance) VALUES
('CUS-DEMO', 'USR-DEMO', '+91-9876543210', '21 Lake View Road, Indiranagar', 'Bengaluru', 'SAVER', 250.00)
ON CONFLICT (id) DO NOTHING;

-- Seed Products (100 products)
DO $$
DECLARE
    i INT;
    cat VARCHAR(50);
    brand VARCHAR(50);
    p_name VARCHAR(100);
    price NUMERIC(10, 2);
    disc NUMERIC(10, 2);
BEGIN
    FOR i IN 1..100 LOOP
        IF i % 10 = 1 THEN cat := 'Dairy'; brand := 'Amul'; p_name := 'Amul Taaza Toned Milk 1L'; price := 68.00;
        ELSIF i % 10 = 2 THEN cat := 'Groceries'; brand := 'Tata'; p_name := 'Tata Vacuum Salt 1kg'; price := 30.00;
        ELSIF i % 10 = 3 THEN cat := 'Groceries'; brand := 'Fortune'; p_name := 'Fortune Refined Sunflower Oil 1L'; price := 145.00;
        ELSIF i % 10 = 4 THEN cat := 'Groceries'; brand := 'India Gate'; p_name := 'India Gate Feast Basmati Rice 1kg'; price := 135.00;
        ELSIF i % 10 = 5 THEN cat := 'Snacks'; brand := 'Britannia'; p_name := 'Britannia Good Day Butter Biscuits 200g'; price := 35.00;
        ELSIF i % 10 = 6 THEN cat := 'Beverages'; brand := 'Tropicana'; p_name := 'Tropicana 100% Orange Juice 1L'; price := 120.00;
        ELSIF i % 10 = 7 THEN cat := 'Fruits'; brand := 'Fresh Farms'; p_name := 'Robusta Organic Bananas 1kg'; price := 55.00;
        ELSIF i % 10 = 8 THEN cat := 'Groceries'; brand := 'Aashirvaad'; p_name := 'Aashirvaad Shuddh Chakki Atta 5kg'; price := 285.00;
        ELSIF i % 10 = 9 THEN cat := 'Household'; brand := 'Surf Excel'; p_name := 'Surf Excel Easy Wash Detergent 1kg'; price := 210.00;
        ELSE cat := 'Personal Care'; brand := 'Himalaya'; p_name := 'Himalaya Purifying Neem Face Wash 150ml'; price := 165.00;
        END IF;

        IF i > 10 THEN
            p_name := p_name || ' Pack ' || (i / 10)::text;
        END IF;

        IF i % 4 = 0 THEN disc := price - 10.00; ELSE disc := NULL; END IF;

        INSERT INTO products (id, sku, name, brand, category, subcategory, description, price, discount_price, stock_quantity, unit, weight, store_id, is_available)
        VALUES (
            'PRD-' || LPAD(i::text, 4, '0'),
            'SM-' || LPAD(i::text, 5, '0'),
            p_name,
            brand,
            cat,
            'Essentials',
            'Fresh and genuine ' || p_name || ' supplied directly from trusted distributors.',
            price,
            disc,
            (20 + (i * 3) % 80),
            'pack',
            '1 unit',
            'STORE-001',
            TRUE
        ) ON CONFLICT (id) DO NOTHING;
    END LOOP;
END $$;

-- Seed Promotions
INSERT INTO promotions (id, title, discount_percent, category, code, is_active) VALUES
('PROMO-01', 'Weekend Grocery Bonanza', 15, 'Groceries', 'GROCERY15', TRUE),
('PROMO-02', 'Fresh Dairy Special', 10, 'Dairy', 'DAIRY10', TRUE),
('PROMO-03', 'Snack Attack Offer', 20, 'Snacks', 'SNACK20', TRUE)
ON CONFLICT (id) DO NOTHING;

-- Seed Orders
INSERT INTO orders (id, customer_id, status, total_amount, delivery_address, payment_status, estimated_delivery) VALUES
('ORD-1001', 'CUS-DEMO', 'OUT_FOR_DELIVERY', 486.00, '21 Lake View Road, Indiranagar, Bengaluru', 'PAID', 'Today, 6:30 PM'),
('ORD-1002', 'CUS-DEMO', 'DELIVERED', 325.00, '21 Lake View Road, Indiranagar, Bengaluru', 'PAID', 'Yesterday'),
('ORD-1003', 'CUS-DEMO', 'PACKING', 590.00, '21 Lake View Road, Indiranagar, Bengaluru', 'PAID', 'Today, 8:00 PM'),
('ORD-1004', 'CUS-DEMO', 'CONFIRMED', 210.00, '21 Lake View Road, Indiranagar, Bengaluru', 'PAID', 'Tomorrow, 10:00 AM'),
('ORD-1005', 'CUS-DEMO', 'CANCELLED', 135.00, '21 Lake View Road, Indiranagar, Bengaluru', 'REFUNDED', 'Cancelled')
ON CONFLICT (id) DO NOTHING;

-- Seed Order Items
INSERT INTO order_items (id, order_id, product_id, name, quantity, unit_price) VALUES
('ITEM-101', 'ORD-1001', 'PRD-0001', 'Amul Taaza Toned Milk 1L', 2, 68.00),
('ITEM-102', 'ORD-1001', 'PRD-0003', 'Fortune Refined Sunflower Oil 1L', 2, 145.00),
('ITEM-103', 'ORD-1001', 'PRD-0005', 'Britannia Good Day Butter Biscuits 200g', 2, 30.00),
('ITEM-104', 'ORD-1002', 'PRD-0008', 'Aashirvaad Shuddh Chakki Atta 5kg', 1, 285.00),
('ITEM-105', 'ORD-1003', 'PRD-0004', 'India Gate Feast Basmati Rice 1kg', 3, 135.00)
ON CONFLICT (id) DO NOTHING;

-- Seed Knowledge Documents
INSERT INTO documents (id, title, source, category) VALUES
('DOC-REFUND', 'Refund Policy', 'refund-policy.md', 'Policy'),
('DOC-RETURN', 'Return Policy', 'return-policy.md', 'Policy'),
('DOC-DELIVERY', 'Delivery Policy', 'delivery-policy.md', 'Policy'),
('DOC-STORE', 'Store Hours & Locations', 'store-hours.md', 'Information'),
('DOC-PAYMENT', 'Payment Methods Policy', 'payment-policy.md', 'Policy'),
('DOC-FAQ', 'Customer FAQ', 'grocery-faq.md', 'FAQ')
ON CONFLICT (id) DO NOTHING;

-- Seed Document Chunks
INSERT INTO document_chunks (id, document_id, content, chunk_index) VALUES
('CHUNK-01', 'DOC-REFUND', 'Eligible damaged, missing, or incorrect items can be reported within 48 hours. Refund requests are reviewed before approval and credited back in 3-5 business days.', 0),
('CHUNK-02', 'DOC-RETURN', 'Unopened non-perishable grocery products may be returned within 7 days with order proof. Perishable items are non-returnable unless damaged.', 0),
('CHUNK-03', 'DOC-DELIVERY', 'Delivery is free for orders above Rs 499. Orders below that amount incur a Rs 39 delivery charge. Express delivery is available for Rs 29.', 0),
('CHUNK-04', 'DOC-STORE', 'Stores are open daily from 7:00 AM to 10:00 PM. AI customer support is available 24/7. Human support desk runs from 8:00 AM to 9:00 PM.', 0),
('CHUNK-05', 'DOC-PAYMENT', 'We accept UPI (GPay, PhonePe), Credit/Debit Cards, Net Banking, and Cash on Delivery for orders up to Rs 2,500.', 0)
ON CONFLICT (id) DO NOTHING;

-- Seed Tickets
INSERT INTO tickets (id, customer_id, category, priority, description, status) VALUES
('TKT-1001', 'CUS-DEMO', 'DELIVERY_DELAY', 'HIGH', 'Delivery delayed for order ORD-1001 past estimated time slot.', 'OPEN'),
('TKT-1002', 'CUS-DEMO', 'REFUND_INQUIRY', 'MEDIUM', 'Inquiring about refund credit timeframe for cancelled order ORD-1005.', 'RESOLVED')
ON CONFLICT (id) DO NOTHING;

-- Seed Refunds
INSERT INTO refunds (refund_id, order_id, customer_id, reason, status, amount) VALUES
('RFD-1001', 'ORD-1005', 'CUS-DEMO', 'Customer cancelled order before packing', 'COMPLETED', 135.00)
ON CONFLICT (id) DO NOTHING;
