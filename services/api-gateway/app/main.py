import sys
import importlib
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[3]))

from fastapi import FastAPI, HTTPException, Depends, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import httpx
from services.shared_platform.auth import hash_password, verify_password, issue_token, decode_token
from services.shared_platform.data import now
from services.shared_platform.observability import TraceMiddleware
from services.shared_platform.settings import service_url

app = FastAPI(title="API Gateway", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(TraceMiddleware)

# User DB mock store
USERS_DB = {
    "customer@supermarket.com": {
        "id": "CUS-DEMO",
        "email": "customer@supermarket.com",
        "password_hash": hash_password("password123"),
        "full_name": "Rahul Sharma",
        "role": "CUSTOMER"
    },
    "admin@supermarket.com": {
        "id": "USR-ADMIN",
        "email": "admin@supermarket.com",
        "password_hash": hash_password("admin123"),
        "full_name": "Supermarket Admin",
        "role": "ADMIN"
    }
}

class RegisterReq(BaseModel):
    email: str
    password: str
    full_name: str
    role: Optional[str] = "CUSTOMER"

class LoginReq(BaseModel):
    email: str
    password: str

@app.get("/api/health")
@app.get("/health")
def health():
    return {"status": "ok", "service": "api-gateway", "timestamp": now()}

@app.get("/api/metrics")
@app.get("/metrics")
def metrics():
    return f"# HELP total_gateway_requests Count of routed API requests\ntotal_gateway_requests 1\n"

# Auth routes
@app.post("/api/auth/register")
def register(payload: RegisterReq):
    if payload.email in USERS_DB:
        raise HTTPException(status_code=400, detail="User with this email already exists.")
    uid = f"USR-{len(USERS_DB) + 101}"
    user = {
        "id": uid,
        "email": payload.email,
        "password_hash": hash_password(payload.password),
        "full_name": payload.full_name,
        "role": payload.role or "CUSTOMER"
    }
    USERS_DB[payload.email] = user
    token = issue_token(uid, user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": uid,
        "role": user["role"],
        "full_name": user["full_name"]
    }

@app.post("/api/auth/login")
def login(payload: LoginReq):
    user = USERS_DB.get(payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    token = issue_token(user["id"], user["role"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user["id"],
        "role": user["role"],
        "full_name": user["full_name"]
    }

# Chat Gateway
@app.post("/api/chat")
async def chat_proxy(payload: dict):
    target = service_url("chat-service", 8008)
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(f"{target}/chat", json=payload)
            return resp.json()
    except Exception:
        # Fallback to local execution
        nim_provider_mod = importlib.import_module("services.ai-orchestrator.nim.provider")
        MockLLMProvider = nim_provider_mod.MockLLMProvider
        provider = MockLLMProvider()
        res = await provider.process_user_message(payload.get("message", ""), payload.get("customer_id", "CUS-DEMO"))
        return {
            "conversation_id": payload.get("conversation_id") or "CONV-DEMO",
            "message": res["message"],
            "sender": "assistant",
            "ai_activity": res.get("ai_activity"),
            "timestamp": now()
        }

@app.websocket("/api/chat/ws")
async def chat_ws_proxy(websocket: WebSocket):
    # The chat handler owns the WebSocket lifecycle.  Do not accept here or
    # FastAPI will reject the second accept performed by the delegated handler.
    chat_main_mod = importlib.import_module("services.chat-service.app.main")
    websocket_chat = chat_main_mod.websocket_chat
    await websocket_chat(websocket)

# Product Gateway
@app.get("/api/products")
async def products_proxy(category: Optional[str] = None, max_price: Optional[float] = None, q: Optional[str] = None):
    prod_main_mod = importlib.import_module("services.product-service.app.main")
    list_products = prod_main_mod.list_products
    search_products = prod_main_mod.search_products
    if q:
        return search_products(q, category, max_price)
    return list_products(category, max_price)

@app.get("/api/products/{product_id}")
async def product_id_proxy(product_id: str):
    prod_main_mod = importlib.import_module("services.product-service.app.main")
    get_product = prod_main_mod.get_product
    return get_product(product_id)

# Order Gateway
@app.get("/api/orders")
async def orders_proxy(customer_id: str = "CUS-DEMO"):
    order_main_mod = importlib.import_module("services.order-service.app.main")
    fetch_customer_orders = order_main_mod.fetch_customer_orders
    return fetch_customer_orders(customer_id)

@app.get("/api/orders/{order_id}")
async def order_id_proxy(order_id: str):
    order_main_mod = importlib.import_module("services.order-service.app.main")
    fetch_order = order_main_mod.fetch_order
    return fetch_order(order_id)

# Ticket Gateway
@app.get("/api/tickets")
async def tickets_proxy(customer_id: Optional[str] = None):
    tkt_main_mod = importlib.import_module("services.ticket-service.app.main")
    list_tickets = tkt_main_mod.list_tickets
    return list_tickets(customer_id)

@app.post("/api/tickets", status_code=201)
async def tickets_create_proxy(payload: dict):
    tkt_main_mod = importlib.import_module("services.ticket-service.app.main")
    new_ticket = tkt_main_mod.new_ticket
    TicketCreate = tkt_main_mod.TicketCreate
    return new_ticket(TicketCreate(**payload))

# Refund Gateway
@app.get("/api/refunds")
async def refunds_proxy(customer_id: str = "CUS-DEMO"):
    rfd_main_mod = importlib.import_module("services.refund-service.app.main")
    list_customer_refunds = rfd_main_mod.list_customer_refunds
    return list_customer_refunds(customer_id)

@app.post("/api/refunds", status_code=201)
async def refunds_create_proxy(payload: dict):
    rfd_main_mod = importlib.import_module("services.refund-service.app.main")
    request_refund = rfd_main_mod.request_refund
    RefundCreate = rfd_main_mod.RefundCreate
    return request_refund(RefundCreate(**payload))

# Notification Gateway
@app.get("/api/notifications")
async def notifications_proxy(customer_id: str = "CUS-DEMO"):
    ntf_main_mod = importlib.import_module("services.notification-service.app.main")
    get_customer_notifications = ntf_main_mod.get_customer_notifications
    return get_customer_notifications(customer_id)
