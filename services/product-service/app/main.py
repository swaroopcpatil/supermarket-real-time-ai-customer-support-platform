import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parents[3]))

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional, List
from services.shared_platform.data import products as get_all_products, now
from services.shared_platform.observability import TraceMiddleware

app = FastAPI(title="Product Service", version="1.0.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.add_middleware(TraceMiddleware)

# In-memory storage seeded with dataset
PRODUCTS_STORE = {p["id"]: p for p in get_all_products()}

class ProductCreate(BaseModel):
    name: str
    brand: str
    category: str
    price: float
    stock_quantity: int
    description: Optional[str] = None
    discount_price: Optional[float] = None
    unit: str = "pack"

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    price: Optional[float] = None
    stock_quantity: Optional[int] = None
    is_available: Optional[bool] = None

@app.get("/health")
def health():
    return {"status": "ok", "service": "product-service", "timestamp": now()}

@app.get("/metrics")
def metrics():
    return f"# HELP total_products Count of products\ntotal_products {len(PRODUCTS_STORE)}\n"

@app.get("/products")
def list_products(category: Optional[str] = None, max_price: Optional[float] = None, limit: int = 50):
    res = list(PRODUCTS_STORE.values())
    if category:
        res = [p for p in res if p["category"].lower() == category.lower()]
    if max_price is not None:
        res = [p for p in res if (p.get("discount_price") or p["price"]) <= max_price]
    return res[:limit]

@app.get("/products/search")
def search_products(q: str, category: Optional[str] = None, max_price: Optional[float] = None):
    q_lower = q.lower()
    res = []
    for p in PRODUCTS_STORE.values():
        if q_lower in p["name"].lower() or q_lower in p["brand"].lower() or q_lower in p["category"].lower() or q_lower in (p.get("description") or "").lower():
            if category and p["category"].lower() != category.lower():
                continue
            effective_price = p.get("discount_price") or p["price"]
            if max_price is not None and effective_price > max_price:
                continue
            res.append(p)
    return res

@app.get("/products/{product_id}")
def get_product(product_id: str):
    p = PRODUCTS_STORE.get(product_id.upper())
    if not p:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found")
    return p

@app.get("/products/{product_id}/availability")
def check_availability(product_id: str):
    p = PRODUCTS_STORE.get(product_id.upper())
    if not p:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found")
    return {
        "product_id": p["id"],
        "name": p["name"],
        "is_available": p["is_available"] and p["stock_quantity"] > 0,
        "stock_quantity": p["stock_quantity"]
    }

@app.post("/products", status_code=201)
def create_product(payload: ProductCreate):
    new_id = f"PRD-{len(PRODUCTS_STORE) + 1:04d}"
    item = {
        "id": new_id,
        "sku": f"SM-{len(PRODUCTS_STORE) + 1:05d}",
        "name": payload.name,
        "brand": payload.brand,
        "category": payload.category,
        "subcategory": "General",
        "description": payload.description or f"{payload.name} by {payload.brand}",
        "price": payload.price,
        "discount_price": payload.discount_price,
        "stock_quantity": payload.stock_quantity,
        "unit": payload.unit,
        "weight": "1 unit",
        "store_id": "STORE-001",
        "image_url": None,
        "is_available": payload.stock_quantity > 0,
        "created_at": now(),
        "updated_at": now()
    }
    PRODUCTS_STORE[new_id] = item
    return item

@app.patch("/products/{product_id}")
def update_product(product_id: str, payload: ProductUpdate):
    p = PRODUCTS_STORE.get(product_id.upper())
    if not p:
        raise HTTPException(status_code=404, detail=f"Product {product_id} not found")
    if payload.name is not None: p["name"] = payload.name
    if payload.price is not None: p["price"] = payload.price
    if payload.stock_quantity is not None:
        p["stock_quantity"] = payload.stock_quantity
        p["is_available"] = payload.stock_quantity > 0
    if payload.is_available is not None: p["is_available"] = payload.is_available
    p["updated_at"] = now()
    return p
