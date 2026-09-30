import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[3]))

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from services.shared_platform.data import now
from services.shared_platform.observability import TraceMiddleware

app = FastAPI(title="Notification Service", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(TraceMiddleware)

NOTIFICATIONS_STORE: List[dict] = [
    {
        "id": "NTF-101",
        "customer_id": "CUS-DEMO",
        "type": "ORDER_STATUS_CHANGED",
        "title": "Order ORD-1001 Out for Delivery",
        "message": "Your order ORD-1001 is out for delivery with executive Ramesh.",
        "is_read": False,
        "created_at": now()
    },
    {
        "id": "NTF-102",
        "customer_id": "CUS-DEMO",
        "type": "REFUND_REQUESTED",
        "title": "Refund Request Received",
        "message": "Refund request RFD-1001 for ₹135 has been completed.",
        "is_read": True,
        "created_at": now()
    }
]

class NotificationCreate(BaseModel):
    customer_id: str
    type: str
    title: str
    message: str

@app.get("/health")
def health():
    return {"status": "ok", "service": "notification-service", "timestamp": now()}

@app.get("/metrics")
def metrics():
    return f"# HELP total_notifications Count of sent notifications\ntotal_notifications {len(NOTIFICATIONS_STORE)}\n"

@app.get("/notifications/{customer_id}")
def get_customer_notifications(customer_id: str):
    return [n for n in NOTIFICATIONS_STORE if n["customer_id"] == customer_id]

@app.post("/notifications", status_code=201)
def create_notification(payload: NotificationCreate):
    ntf = {
        "id": f"NTF-{len(NOTIFICATIONS_STORE) + 101}",
        "customer_id": payload.customer_id,
        "type": payload.type,
        "title": payload.title,
        "message": payload.message,
        "is_read": False,
        "created_at": now()
    }
    NOTIFICATIONS_STORE.append(ntf)
    print(f"[Notification Service Event] Sent '{payload.type}' notification to {payload.customer_id}")
    return ntf
