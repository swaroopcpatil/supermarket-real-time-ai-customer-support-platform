import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[3]))

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from services.shared_platform.data import create_ticket, all_tickets, _tickets, now
from services.shared_platform.observability import TraceMiddleware

app = FastAPI(title="Ticket Service", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(TraceMiddleware)

class TicketCreate(BaseModel):
    customer_id: str
    description: str
    category: Optional[str] = "GENERAL"
    conversation_id: Optional[str] = None
    priority: Optional[str] = "MEDIUM"

class TicketStatusUpdate(BaseModel):
    status: str
    assigned_agent: Optional[str] = None

@app.get("/health")
def health():
    return {"status": "ok", "service": "ticket-service", "timestamp": now()}

@app.get("/metrics")
def metrics():
    return f"# HELP total_tickets Count of total support tickets\ntotal_tickets {len(_tickets)}\n"

@app.post("/tickets", status_code=201)
def new_ticket(payload: TicketCreate):
    ticket = create_ticket(payload.customer_id, payload.description, payload.category or "GENERAL")
    if payload.conversation_id: ticket["conversation_id"] = payload.conversation_id
    if payload.priority: ticket["priority"] = payload.priority
    return ticket

@app.get("/tickets")
def list_tickets(customer_id: Optional[str] = None):
    return all_tickets(customer_id)

@app.get("/tickets/{ticket_id}")
def get_ticket(ticket_id: str):
    for t in _tickets:
        if t["id"].upper() == ticket_id.upper():
            return t
    raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")

@app.patch("/tickets/{ticket_id}/status")
def update_ticket_status(ticket_id: str, payload: TicketStatusUpdate):
    for t in _tickets:
        if t["id"].upper() == ticket_id.upper():
            t["status"] = payload.status
            if payload.assigned_agent: t["assigned_agent"] = payload.assigned_agent
            t["updated_at"] = now()
            return t
    raise HTTPException(status_code=404, detail=f"Ticket {ticket_id} not found")
