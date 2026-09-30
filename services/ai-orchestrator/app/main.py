import sys
import importlib
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[3]))

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from services.shared_platform.data import now
from services.shared_platform.observability import TraceMiddleware
from services.shared_platform.settings import setting

provider_module = importlib.import_module("services.ai-orchestrator.nim.provider")
NIMProvider = provider_module.NIMProvider
MockLLMProvider = provider_module.MockLLMProvider

app = FastAPI(title="AI Orchestrator Service", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(TraceMiddleware)

class OrchestrationRequest(BaseModel):
    message: str
    customer_id: Optional[str] = "CUS-DEMO"
    conversation_id: Optional[str] = None

def get_provider():
    provider_type = setting("AI_PROVIDER", "mock").lower()
    if provider_type == "nim":
        return NIMProvider()
    return MockLLMProvider()

@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "ai-orchestrator",
        "provider": setting("AI_PROVIDER", "mock"),
        "timestamp": now()
    }

@app.get("/metrics")
def metrics():
    return "# HELP total_ai_requests Count of processed AI orchestration requests\ntotal_ai_requests 1\n"

@app.post("/orchestrate")
async def orchestrate(req: OrchestrationRequest):
    provider = get_provider()
    result = await provider.process_user_message(req.message, req.customer_id or "CUS-DEMO")
    return result

@app.post("/orchestrate/stream")
async def orchestrate_stream(req: OrchestrationRequest):
    provider = get_provider()
    async def event_generator():
        async for chunk in provider.stream_response(req.message, req.customer_id or "CUS-DEMO"):
            yield f"data: {chunk}\n\n"
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(event_generator(), media_type="text/event-stream")
