from typing import Any, Optional
from pydantic import BaseModel


class UserRegister(BaseModel):
    email: str
    password: str
    full_name: str
    role: str = "CUSTOMER"


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: str
    full_name: str


class Product(BaseModel):
    id: str
    sku: str
    name: str
    brand: str
    category: str
    subcategory: Optional[str] = None
    description: Optional[str] = None
    price: float
    discount_price: Optional[float] = None
    stock_quantity: int
    unit: str = "pack"
    weight: Optional[str] = None
    store_id: Optional[str] = None
    image_url: Optional[str] = None
    is_available: bool = True


class OrderItem(BaseModel):
    id: str
    product_id: str
    name: str
    quantity: int
    unit_price: float


class Order(BaseModel):
    id: str
    customer_id: str
    status: str
    total_amount: float
    delivery_address: str
    payment_status: str
    estimated_delivery: Optional[str] = None
    items: list[OrderItem] = []
    created_at: Optional[str] = None


class Ticket(BaseModel):
    id: str
    customer_id: str
    conversation_id: Optional[str] = None
    category: str
    priority: str = "MEDIUM"
    description: str
    status: str = "OPEN"
    assigned_agent: Optional[str] = None
    created_at: Optional[str] = None


class RefundRequest(BaseModel):
    refund_id: str
    order_id: str
    customer_id: str
    reason: str
    status: str = "UNDER_REVIEW"
    amount: float = 0.0
    created_at: Optional[str] = None


class ChatMessageRequest(BaseModel):
    customer_id: str
    message: str
    conversation_id: Optional[str] = None


class AIActivityEvent(BaseModel):
    intent: Optional[str] = None
    agent: Optional[str] = None
    tools_called: list[str] = []
    rag_sources: list[dict[str, Any]] = []
    confidence: float = 1.0
    escalated: bool = False


class ChatMessageResponse(BaseModel):
    conversation_id: str
    message: str
    sender: str = "assistant"
    ai_activity: Optional[AIActivityEvent] = None
    timestamp: str
