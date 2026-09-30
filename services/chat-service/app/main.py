import sys
import json
import asyncio
import importlib
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[3]))

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from typing import Optional, List, Dict
import httpx
from services.shared_platform.data import now
from services.shared_platform.observability import TraceMiddleware
from services.shared_platform.settings import service_url

app = FastAPI(title="Chat Service", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(TraceMiddleware)

# In-memory history cache
CHAT_HISTORY: Dict[str, List[Dict]] = {}

class ChatRequest(BaseModel):
    customer_id: str
    message: str
    conversation_id: Optional[str] = None

@app.get("/health")
def health():
    return {"status": "ok", "service": "chat-service", "timestamp": now()}

@app.get("/metrics")
def metrics():
    return f"# HELP total_chat_messages Count of messages stored in chat history\ntotal_chat_messages {sum(len(v) for v in CHAT_HISTORY.values())}\n"

@app.get("/chat/history/{customer_id}")
def get_chat_history(customer_id: str):
    return CHAT_HISTORY.get(customer_id, [])

@app.post("/chat")
async def send_chat_message(payload: ChatRequest):
    cid = payload.customer_id
    if cid not in CHAT_HISTORY:
        CHAT_HISTORY[cid] = []

    # Store user message
    user_msg = {
        "id": f"MSG-{len(CHAT_HISTORY[cid]) + 1}",
        "sender": "customer",
        "content": payload.message,
        "timestamp": now()
    }
    CHAT_HISTORY[cid].append(user_msg)

    orchestrator_url = service_url("ai-orchestrator", 8007)
    ai_response = None

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{orchestrator_url}/orchestrate",
                json={"message": payload.message, "customer_id": payload.customer_id}
            )
            if resp.status_code == 200:
                ai_response = resp.json()
    except Exception as e:
        print(f"[Chat Service Error] Orchestrator unreachable: {e}")

    if not ai_response:
        provider_module = importlib.import_module("services.ai-orchestrator.nim.provider")
        MockLLMProvider = provider_module.MockLLMProvider
        provider = MockLLMProvider()
        ai_response = await provider.process_user_message(payload.message, payload.customer_id)

    assistant_msg = {
        "id": f"MSG-{len(CHAT_HISTORY[cid]) + 1}",
        "sender": "assistant",
        "content": ai_response["message"],
        "ai_activity": ai_response.get("ai_activity"),
        "timestamp": now()
    }
    CHAT_HISTORY[cid].append(assistant_msg)

    return {
        "conversation_id": payload.conversation_id or f"CONV-{cid}",
        "message": ai_response["message"],
        "sender": "assistant",
        "ai_activity": ai_response.get("ai_activity"),
        "timestamp": now()
    }

@app.websocket("/chat/ws")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data_str = await websocket.receive_text()
            data = json.loads(data_str)
            customer_id = data.get("customer_id", "CUS-DEMO")
            message = data.get("message", "")
            if not message.strip():
                await websocket.send_json({"type": "error", "code": "EMPTY_MESSAGE", "message": "Message cannot be empty."})
                continue

            CHAT_HISTORY.setdefault(customer_id, []).append({
                "id": f"MSG-{len(CHAT_HISTORY[customer_id]) + 1}", "sender": "customer",
                "content": message, "timestamp": now()
            })

            await websocket.send_json({"type": "status", "status": "typing"})

            provider_module = importlib.import_module("services.ai-orchestrator.app.main")
            provider = provider_module.get_provider()
            res = await provider.process_user_message(message, customer_id)

            words = res["message"].split(" ")
            accumulated = ""
            for word in words:
                accumulated += word + " "
                await websocket.send_json({
                    "type": "token",
                    "content": word + " ",
                    "accumulated": accumulated
                })
                await asyncio.sleep(0.04)

            await websocket.send_json({
                "type": "done",
                "message": res["message"],
                "ai_activity": res.get("ai_activity"),
                "timestamp": now()
            })
            CHAT_HISTORY[customer_id].append({
                "id": f"MSG-{len(CHAT_HISTORY[customer_id]) + 1}", "sender": "assistant",
                "content": res["message"], "ai_activity": res.get("ai_activity"), "timestamp": now()
            })
    except WebSocketDisconnect:
        print("[Chat Service WS] Client disconnected cleanly")
