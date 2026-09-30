import sys
import re
import math
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[3]))

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from services.shared_platform.data import DOCUMENTS, now
from services.shared_platform.observability import TraceMiddleware

app = FastAPI(title="RAG Service", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(TraceMiddleware)

class DocumentIndexRequest(BaseModel):
    id: str
    title: str
    source: str
    content: str
    category: Optional[str] = "General"

class SearchRequest(BaseModel):
    query: str
    top_k: int = 3

DOC_STORE = {d["id"]: d for d in DOCUMENTS}

def tokenize(text: str) -> set[str]:
    words = re.findall(r'\w+', text.lower())
    return set(words)

def keyword_similarity(query: str, text: str) -> float:
    q_words = tokenize(query)
    t_words = tokenize(text)
    if not q_words:
        return 0.0
    overlap = q_words.intersection(t_words)
    return len(overlap) / float(len(q_words))

@app.get("/health")
def health():
    return {"status": "ok", "service": "rag-service", "total_documents": len(DOC_STORE), "timestamp": now()}

@app.get("/metrics")
def metrics():
    return f"# HELP total_indexed_documents Count of indexed RAG documents\ntotal_indexed_documents {len(DOC_STORE)}\n"

@app.get("/documents")
def list_documents():
    return list(DOC_STORE.values())

@app.post("/documents")
@app.post("/documents/index")
def index_document(doc: DocumentIndexRequest):
    DOC_STORE[doc.id] = {
        "id": doc.id,
        "title": doc.title,
        "source": doc.source,
        "content": doc.content,
        "category": doc.category or "General"
    }
    return {"status": "indexed", "document_id": doc.id}

@app.post("/search")
def search_knowledge_base(payload: SearchRequest):
    results = []
    q_clean = payload.query.lower()
    for doc_id, doc in DOC_STORE.items():
        base_score = keyword_similarity(payload.query, doc["title"] + " " + doc["content"])
        
        # Domain specific boost
        if "delivery" in q_clean or "charge" in q_clean or "shipping" in q_clean:
            if "delivery" in doc["title"].lower() or "delivery" in doc["content"].lower():
                base_score += 0.6
        elif "refund" in q_clean:
            if "refund" in doc["title"].lower() or "refund" in doc["content"].lower():
                base_score += 0.6
        elif "return" in q_clean:
            if "return" in doc["title"].lower() or "return" in doc["content"].lower():
                base_score += 0.6
        elif "hour" in q_clean or "time" in q_clean or "open" in q_clean:
            if "hour" in doc["title"].lower() or "time" in doc["content"].lower():
                base_score += 0.6

        norm_score = min(base_score + 0.3, 0.98)
        results.append({
            "chunk_id": f"CHUNK-{doc_id}",
            "document_id": doc_id,
            "title": doc["title"],
            "source": doc["source"],
            "content": doc["content"],
            "similarity_score": round(norm_score, 3)
        })
    
    results.sort(key=lambda x: x["similarity_score"], reverse=True)
    top_results = results[:payload.top_k]
    
    return {
        "query": payload.query,
        "results": top_results,
        "retrieved_count": len(top_results)
    }
