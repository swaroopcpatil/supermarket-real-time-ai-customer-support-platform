import sys
import os
import random
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[3]))

from fastapi import FastAPI
from pydantic import BaseModel
from typing import List, Optional
import httpx
from services.shared_platform.data import now
from services.shared_platform.observability import TraceMiddleware
from services.shared_platform.settings import setting

app = FastAPI(title="Embedding Service", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(TraceMiddleware)

class SingleEmbedRequest(BaseModel):
    text: str

class BatchEmbedRequest(BaseModel):
    texts: List[str]

def get_deterministic_mock_vector(text: str, dim: int = 384) -> List[float]:
    rnd = random.Random(text)
    return [round(rnd.uniform(-1.0, 1.0), 6) for _ in range(dim)]

async def generate_vector(text: str) -> List[float]:
    provider = setting("EMBEDDING_PROVIDER", "mock").lower()
    api_key = setting("NVIDIA_NIM_API_KEY", "")
    base_url = setting("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
    model = setting("EMBEDDING_MODEL", "nvidia/nv-embed-v1")

    if provider == "nim" and api_key:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{base_url}/embeddings",
                    headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                    json={"input": [text], "model": model}
                )
                if resp.status_code == 200:
                    data = resp.json()
                    return data["data"][0]["embedding"]
        except Exception as e:
            print(f"[Embedding Service] NIM Embed failed, falling back to mock: {e}")
    
    return get_deterministic_mock_vector(text)

@app.get("/health")
def health():
    return {"status": "ok", "service": "embedding-service", "provider": setting("EMBEDDING_PROVIDER", "mock"), "timestamp": now()}

@app.get("/metrics")
def metrics():
    return "# HELP embedding_requests Total embedding requests\nembedding_requests 1\n"

@app.post("/embeddings")
async def embed_single(payload: SingleEmbedRequest):
    vec = await generate_vector(payload.text)
    return {"embedding": vec, "dimension": len(vec)}

@app.post("/embeddings/batch")
async def embed_batch(payload: BatchEmbedRequest):
    vectors = [await generate_vector(t) for t in payload.texts]
    return {"embeddings": vectors, "count": len(vectors), "dimension": len(vectors[0]) if vectors else 384}
