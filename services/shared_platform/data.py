from datetime import UTC, datetime, timedelta
from decimal import Decimal
from uuid import uuid4


def now() -> str:
    return datetime.now(UTC).isoformat()


PRODUCT_SEEDS = [
    ("Amul Taaza Milk 1L", "Amul", "Dairy", 68, 3),
    ("Tata Salt 1kg", "Tata", "Groceries", 30, 38),
    ("Fortune Sunflower Oil 1L", "Fortune", "Groceries", 145, 12),
    ("India Gate Basmati Rice 1kg", "India Gate", "Groceries", 135, 24),
    ("Britannia Good Day", "Britannia", "Snacks", 35, 48),
    ("Tropicana Orange Juice 1L", "Tropicana", "Beverages", 120, 17),
    ("Fresh Bananas 1kg", "Fresh Farms", "Fruits", 55, 32),
    ("Aashirvaad Atta 5kg", "Aashirvaad", "Groceries", 285, 18),
    ("Surf Excel 1kg", "Surf Excel", "Household", 210, 15),
    ("Himalaya Face Wash", "Himalaya", "Personal Care", 165, 20),
]


def products() -> list[dict]:
    items = []
    for index in range(100):
        name, brand, category, price, stock = PRODUCT_SEEDS[index % len(PRODUCT_SEEDS)]
        suffix = "" if index < len(PRODUCT_SEEDS) else f" {index // len(PRODUCT_SEEDS) + 1}"
        items.append({
            "id": f"PRD-{index + 1:04d}", "sku": f"SM-{index + 1:05d}",
            "name": name + suffix, "brand": brand, "category": category,
            "subcategory": "Everyday essentials", "description": f"Quality {name.lower()} for your pantry.",
            "price": price, "discount_price": price - 10 if index % 4 == 0 else None,
            "stock_quantity": stock, "unit": "pack", "weight": "1 unit", "store_id": "STORE-001",
            "image_url": None, "is_available": stock > 0, "created_at": now(), "updated_at": now(),
        })
    return items


_orders = {
    "ORD-1001": {"id": "ORD-1001", "customer_id": "CUS-DEMO", "status": "OUT_FOR_DELIVERY", "total_amount": 486, "delivery_address": "21 Lake View Road, Bengaluru", "payment_status": "PAID", "estimated_delivery": "Today, 6:30 PM", "created_at": now(), "updated_at": now(), "items": [{"id": "ITEM-1", "product_id": "PRD-0001", "name": "Amul Taaza Milk 1L", "quantity": 2, "unit_price": 68}]},
    "ORD-1002": {"id": "ORD-1002", "customer_id": "CUS-DEMO", "status": "DELIVERED", "total_amount": 325, "delivery_address": "21 Lake View Road, Bengaluru", "payment_status": "PAID", "estimated_delivery": "Delivered yesterday", "created_at": now(), "updated_at": now(), "items": [{"id": "ITEM-2", "product_id": "PRD-0003", "name": "Fortune Sunflower Oil 1L", "quantity": 2, "unit_price": 145}]},
}


def get_order(order_id: str) -> dict | None:
    return _orders.get(order_id.upper())


def customer_orders(customer_id: str) -> list[dict]:
    return [order for order in _orders.values() if order["customer_id"] == customer_id]


def cancel(order_id: str) -> dict | None:
    order = get_order(order_id)
    if order and order["status"] in {"PLACED", "CONFIRMED", "PACKING"}:
        order["status"] = "CANCELLED"; order["updated_at"] = now()
    return order


DOCUMENTS = [
    {"id": "DOC-REFUND", "title": "Refund policy", "source": "refund-policy.md", "content": "Eligible damaged, missing, or incorrect items can be reported within 48 hours. Refund requests are reviewed before approval and are never guaranteed by the assistant."},
    {"id": "DOC-RETURN", "title": "Return policy", "source": "return-policy.md", "content": "Unopened eligible grocery and household products may be returned within 7 days with the order number. Perishable products are assessed case by case."},
    {"id": "DOC-DELIVERY", "title": "Delivery policy", "source": "delivery-policy.md", "content": "Delivery is free for orders above Rs 499. Orders below that amount have a Rs 39 delivery charge. Delivery slots depend on store coverage."},
    {"id": "DOC-STORE", "title": "Store hours", "source": "store-hours.md", "content": "Stores are open daily from 7 AM to 10 PM. Customer support chat is available from 8 AM to 9 PM."},
    {"id": "DOC-PAYMENT", "title": "Payment methods", "source": "payment-policy.md", "content": "We accept UPI, cards, net banking, wallets, and cash on delivery where offered."},
]


_tickets: list[dict] = []
_refunds: list[dict] = []


def create_ticket(customer_id: str, description: str, category: str = "ESCALATION") -> dict:
    ticket = {"id": f"TKT-{len(_tickets)+1001}", "customer_id": customer_id, "conversation_id": None, "category": category, "priority": "HIGH", "description": description, "status": "OPEN", "assigned_agent": None, "created_at": now(), "updated_at": now()}
    _tickets.append(ticket); return ticket


def all_tickets(customer_id: str | None = None) -> list[dict]:
    return [t for t in _tickets if not customer_id or t["customer_id"] == customer_id]


def create_refund(order_id: str, customer_id: str, reason: str, amount: float = 0) -> dict:
    refund = {"refund_id": f"RFD-{len(_refunds)+1001}", "order_id": order_id, "customer_id": customer_id, "reason": reason, "status": "UNDER_REVIEW", "amount": amount, "created_at": now(), "processed_at": None}
    _refunds.append(refund); return refund
