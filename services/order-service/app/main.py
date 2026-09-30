import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[3]))

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
from services.shared_platform.data import get_order, customer_orders, cancel, now, _orders
from services.shared_platform.observability import TraceMiddleware

app = FastAPI(title="Order Service", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(TraceMiddleware)

class OrderItemInput(BaseModel):
    product_id: str
    name: str
    quantity: int
    unit_price: float

class OrderCreate(BaseModel):
    customer_id: str
    delivery_address: str
    items: List[OrderItemInput]

class StatusUpdate(BaseModel):
    status: str

@app.get("/health")
def health():
    return {"status": "ok", "service": "order-service", "timestamp": now()}

@app.get("/metrics")
def metrics():
    return f"# HELP total_orders Count of total orders\ntotal_orders {len(_orders)}\n"

@app.get("/orders/{order_id}")
def fetch_order(order_id: str):
    order = get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    return order

@app.get("/customers/{customer_id}/orders")
def fetch_customer_orders(customer_id: str):
    return customer_orders(customer_id)

@app.post("/orders", status_code=201)
def create_order(payload: OrderCreate):
    new_id = f"ORD-{len(_orders) + 1001}"
    total = sum(item.quantity * item.unit_price for item in payload.items)
    items_data = [
        {"id": f"ITEM-{i+1}", "product_id": item.product_id, "name": item.name, "quantity": item.quantity, "unit_price": item.unit_price}
        for i, item in enumerate(payload.items)
    ]
    order = {
        "id": new_id,
        "customer_id": payload.customer_id,
        "status": "PLACED",
        "total_amount": round(total, 2),
        "delivery_address": payload.delivery_address,
        "payment_status": "PAID",
        "estimated_delivery": "Today in 45 mins",
        "created_at": now(),
        "updated_at": now(),
        "items": items_data
    }
    _orders[new_id] = order
    return order

@app.patch("/orders/{order_id}/status")
def update_status(order_id: str, payload: StatusUpdate):
    order = get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    order["status"] = payload.status
    order["updated_at"] = now()
    return order

@app.post("/orders/{order_id}/cancel")
def cancel_order_endpoint(order_id: str):
    order = get_order(order_id)
    if not order:
        raise HTTPException(status_code=404, detail=f"Order {order_id} not found")
    if order["status"] not in {"PLACED", "CONFIRMED", "PACKING"}:
        raise HTTPException(status_code=400, detail=f"Order status '{order['status']}' cannot be cancelled.")
    order = cancel(order_id)
    return {"message": "Order successfully cancelled", "order": order}
