import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[3]))

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.shared_platform.data import create_refund, _refunds, get_order, now
from services.shared_platform.observability import TraceMiddleware

app = FastAPI(title="Refund Service", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(TraceMiddleware)

class RefundCreate(BaseModel):
    order_id: str
    customer_id: str
    reason: str
    amount: Optional[float] = 0.0

@app.get("/health")
def health():
    return {"status": "ok", "service": "refund-service", "timestamp": now()}

@app.get("/metrics")
def metrics():
    return f"# HELP total_refunds Count of total refund requests\ntotal_refunds {len(_refunds)}\n"

@app.post("/refunds", status_code=201)
def request_refund(payload: RefundCreate):
    order = get_order(payload.order_id)
    amount = payload.amount
    if not amount and order:
        amount = order["total_amount"]
    refund = create_refund(payload.order_id, payload.customer_id, payload.reason, amount)
    return refund

@app.get("/refunds/{refund_id}")
def get_refund(refund_id: str):
    for r in _refunds:
        if r["refund_id"].upper() == refund_id.upper():
            return r
    raise HTTPException(status_code=404, detail=f"Refund request {refund_id} not found")

@app.get("/customers/{customer_id}/refunds")
def list_customer_refunds(customer_id: str):
    return [r for r in _refunds if r["customer_id"] == customer_id]
