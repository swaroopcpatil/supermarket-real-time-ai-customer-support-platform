import json
import re
import asyncio
from abc import ABC, abstractmethod
from typing import AsyncGenerator, Dict, Any
import httpx
from services.shared_platform.settings import setting
from services.shared_platform.data import (
    get_order, customer_orders, cancel as cancel_order_db,
    products as get_all_products, create_refund, create_ticket
)


class LLMProvider(ABC):
    @abstractmethod
    async def process_user_message(self, message: str, customer_id: str = "CUS-DEMO") -> Dict[str, Any]:
        pass

    @abstractmethod
    async def stream_response(self, message: str, customer_id: str = "CUS-DEMO") -> AsyncGenerator[str, None]:
        pass


class NIMProvider(LLMProvider):
    def __init__(self):
        self.base_url = setting("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
        self.api_key = setting("NVIDIA_NIM_API_KEY", "")
        self.model = setting("NVIDIA_NIM_MODEL", "meta/llama-3.1-70b-instruct")

    async def process_user_message(self, message: str, customer_id: str = "CUS-DEMO") -> Dict[str, Any]:
        if not self.api_key:
            # Fall back gracefully to mock if key is missing
            mock = MockLLMProvider()
            return await mock.process_user_message(message, customer_id)

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": "You are Supermarket AI assistant. Help customers with orders, products, refunds, and store policies."},
                {"role": "user", "content": message}
            ],
            "temperature": 0.2
        }
        for attempt in range(3):
            try:
                async with httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=5.0)) as client:
                    resp = await client.post(f"{self.base_url.rstrip('/')}/chat/completions", headers=headers, json=payload)
                    resp.raise_for_status()
                    content = resp.json()["choices"][0]["message"]["content"]
                    if content:
                        return {"message": content, "ai_activity": {"intent": "NIM_GENERATION", "agent": "Support Agent", "tools_called": ["nvidia_nim_completion"], "rag_sources": [], "confidence": 0.8, "escalated": False}}
            except (httpx.HTTPError, KeyError, IndexError, TypeError) as exc:
                print(f"[NIMProvider] attempt {attempt + 1} failed: {type(exc).__name__}")
                if attempt < 2:
                    await asyncio.sleep(0.25 * (2 ** attempt))
        
        mock = MockLLMProvider()
        return await mock.process_user_message(message, customer_id)

    async def stream_response(self, message: str, customer_id: str = "CUS-DEMO") -> AsyncGenerator[str, None]:
        if not self.api_key:
            async for chunk in MockLLMProvider().stream_response(message, customer_id):
                yield chunk
            return
        headers = {"Authorization": f"Bearer {self.api_key}", "Content-Type": "application/json"}
        payload = {"model": self.model, "messages": [{"role": "system", "content": "You are Supermarket AI assistant."}, {"role": "user", "content": message}], "temperature": 0.2, "stream": True}
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(30.0, connect=5.0)) as client:
                async with client.stream("POST", f"{self.base_url.rstrip('/')}/chat/completions", headers=headers, json=payload) as response:
                    response.raise_for_status()
                    async for line in response.aiter_lines():
                        if not line.startswith("data:"):
                            continue
                        value = line[5:].strip()
                        if value == "[DONE]":
                            return
                        try:
                            token = json.loads(value)["choices"][0].get("delta", {}).get("content", "")
                            if token:
                                yield token
                        except (json.JSONDecodeError, KeyError, IndexError, TypeError):
                            continue
                    return
        except httpx.HTTPError:
            async for chunk in MockLLMProvider().stream_response(message, customer_id):
                yield chunk


class MockLLMProvider(LLMProvider):
    async def process_user_message(self, message: str, customer_id: str = "CUS-DEMO") -> Dict[str, Any]:
        msg_lower = message.lower()
        tools_called = []
        rag_sources = []
        agent = "Support Agent"
        intent = "GENERAL_QUERY"
        escalated = False
        confidence = 0.95

        # 1. Order Status / Where is my order
        if "order" in msg_lower and any(w in msg_lower for w in ["where", "status", "track", "ord-"]):
            intent = "ORDER_STATUS"
            agent = "Order Agent"
            tools_called.append("get_customer_orders")
            
            # Find specific order ID
            match = re.search(r"ord-\d+", msg_lower)
            order_id = match.group(0).upper() if match else None
            
            if order_id:
                tools_called.append("get_order_status")
                ord_data = get_order(order_id)
                if ord_data and ord_data["customer_id"] == customer_id:
                    reply = f"Your order **{ord_data['id']}** is currently **{ord_data['status']}**.\n\n- **Total Amount**: ₹{ord_data['total_amount']}\n- **Delivery Address**: {ord_data['delivery_address']}\n- **Estimated Delivery**: {ord_data['estimated_delivery']}"
                else:
                    reply = f"I couldn't find order `{order_id}` under your account. Please check the order ID."
            else:
                orders = customer_orders(customer_id)
                if orders:
                    latest = orders[0]
                    reply = f"Here is your latest order **{latest['id']}**:\n- **Status**: {latest['status']}\n- **Total**: ₹{latest['total_amount']}\n- **Estimated Delivery**: {latest['estimated_delivery']}"
                else:
                    reply = "You currently have no active orders in your account."

        # 2. Cancel Order
        elif "cancel" in msg_lower and "order" in msg_lower:
            intent = "CANCEL_ORDER"
            agent = "Order Agent"
            tools_called.append("cancel_order")
            match = re.search(r"ord-\d+", msg_lower)
            order_id = match.group(0).upper() if match else "ORD-1004"
            ord_data = get_order(order_id)
            if ord_data and ord_data["customer_id"] == customer_id and ord_data["status"] in {"PLACED", "CONFIRMED", "PACKING"}:
                cancel_order_db(order_id)
                reply = f"Order **{order_id}** has been successfully cancelled. A full refund of ₹{ord_data['total_amount']} will be credited to your payment method."
            else:
                reply = "I couldn't cancel that order. It may not belong to your account or is already too far along for cancellation."

        # 3. Product availability / search (Amul, Milk, Rice, Oil, Salt, etc.)
        elif any(w in msg_lower for w in ["available", "price", "stock", "amul", "salt", "oil", "rice", "discount", "under ₹", "under 500", "under 300", "recommend", "healthy", "breakfast"]):
            intent = "PRODUCT_SEARCH"
            agent = "Product Agent"
            tools_called.extend(["search_products", "check_product_stock"])
            
            all_p = get_all_products()
            matching = []
            
            if "amul" in msg_lower or "milk" in msg_lower:
                matching = [p for p in all_p if "milk" in p["name"].lower() or "amul" in p["name"].lower()]
            elif "salt" in msg_lower:
                matching = [p for p in all_p if "salt" in p["name"].lower()]
            elif "oil" in msg_lower:
                matching = [p for p in all_p if "oil" in p["name"].lower()]
            elif "rice" in msg_lower:
                matching = [p for p in all_p if "rice" in p["name"].lower()]
            elif "breakfast" in msg_lower or "healthy" in msg_lower:
                matching = [p for p in all_p if p["category"] in ["Dairy", "Fruits", "Snacks"] and (p.get("discount_price") or p["price"]) <= 300]
            elif "under 500" in msg_lower or "under ₹500" in msg_lower:
                matching = [p for p in all_p if (p.get("discount_price") or p["price"]) <= 500]
            else:
                matching = all_p[:3]

            if matching:
                item_lines = []
                for p in matching[:4]:
                    price_str = f"₹{p['discount_price']} (Discounted from ₹{p['price']})" if p.get("discount_price") else f"₹{p['price']}"
                    stock_str = f"In Stock ({p['stock_quantity']} units left)" if p["is_available"] else "Out of stock"
                    item_lines.append(f"• **{p['name']}** ({p['brand']}) - {price_str} | {stock_str}")
                reply = "Here are the product details you requested:\n\n" + "\n".join(item_lines)
            else:
                reply = "I searched our product catalog but couldn't find exact matches for your request."

        # 4. Damaged / Missing / Refund request
        elif any(w in msg_lower for w in ["damaged", "missing", "broken", "spilled", "refund"]):
            if "policy" in msg_lower or "how" in msg_lower or "what is" in msg_lower:
                intent = "RAG_SEARCH"
                agent = "Support Agent"
                tools_called.append("search_knowledge_base")
                rag_sources.append({"title": "Refund policy", "source": "refund-policy.md", "similarity_score": 0.94})
                reply = "According to our **Refund Policy**, eligible damaged, missing, or incorrect items reported within 48 hours will be refunded within 3-5 business days upon request review."
            else:
                intent = "CREATE_REFUND"
                agent = "Refund Agent"
                tools_called.extend(["get_customer_orders", "check_return_policy", "create_refund_request"])
                match = re.search(r"ord-\d+", msg_lower)
                order_id = match.group(0).upper() if match else "ORD-1001"
                order = get_order(order_id)
                if not order or order["customer_id"] != customer_id:
                    reply = "I couldn't find that order under your account, so I have not created a refund request."
                    confidence = 0.45
                else:
                    ref = create_refund(order_id, customer_id, reason=message, amount=order["total_amount"])
                    reply = f"I have submitted a refund request (**{ref['refund_id']}**) for order **{order_id}** due to reported damage/issue.\n\n- **Status**: UNDER_REVIEW\n- **Amount**: ₹{ref['amount']}\n\nOur team will review it before any credit is issued."

        # 5. Policy queries (Return policy, Delivery charges, Store hours, Payment)
        elif any(w in msg_lower for w in ["policy", "return", "delivery charges", "shipping", "hours", "timing", "open", "payment"]):
            intent = "RAG_SEARCH"
            agent = "Support Agent"
            tools_called.append("search_knowledge_base")
            
            if "delivery" in msg_lower or "charge" in msg_lower or "shipping" in msg_lower:
                rag_sources.append({"title": "Delivery policy", "source": "delivery-policy.md", "similarity_score": 0.96})
                reply = "Delivery is **FREE** for all orders above **₹499**. For orders below ₹499, a standard delivery charge of **₹39** applies. Express 30-minute delivery is available for ₹29."
            elif "return" in msg_lower:
                rag_sources.append({"title": "Return policy", "source": "return-policy.md", "similarity_score": 0.95})
                reply = "Unopened non-perishable grocery and household items can be returned within **7 days** with order proof. Perishable items (dairy, fruits, vegetables) are non-returnable unless damaged."
            elif "hours" in msg_lower or "time" in msg_lower or "open" in msg_lower:
                rag_sources.append({"title": "Store hours", "source": "store-hours.md", "similarity_score": 0.98})
                reply = "Our retail stores are open daily from **7:00 AM to 10:00 PM**. AI Customer Assistant is available 24/7."
            else:
                rag_sources.append({"title": "Payment methods", "source": "payment-policy.md", "similarity_score": 0.92})
                reply = "We accept UPI (Google Pay, PhonePe), Credit/Debit Cards, Net Banking, and Cash on Delivery for orders up to ₹2,500."

        # 6. Human escalation request
        elif any(w in msg_lower for w in ["human", "agent", "person", "representative", "talk to", "escalate"]):
            intent = "HUMAN_ESCALATION"
            agent = "Escalation Agent"
            tools_called.append("create_support_ticket")
            escalated = True
            confidence = 0.45
            tkt = create_ticket(customer_id, description=f"Customer requested human escalation: {message}", category="HUMAN_REQUEST")
            reply = f"I have created a high-priority support ticket (**{tkt['id']}**) for you. A human customer support agent has been notified and will connect with you shortly."

        # Default fallback
        else:
            intent = "GENERAL_ASSIST"
            agent = "Support Agent"
            reply = "I am your Supermarket AI Customer Support Assistant. You can ask me about your order status, product availability, store policies, delivery charges, or request a refund for damaged items."

        return {
            "message": reply,
            "ai_activity": {
                "intent": intent,
                "agent": agent,
                "tools_called": tools_called,
                "rag_sources": rag_sources,
                "confidence": confidence,
                "escalated": escalated
            }
        }

    async def stream_response(self, message: str, customer_id: str = "CUS-DEMO") -> AsyncGenerator[str, None]:
        res = await self.process_user_message(message, customer_id)
        words = res["message"].split(" ")
        for w in words:
            yield w + " "
