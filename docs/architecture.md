# Supermarket AI Platform Architecture Overview

## Component Breakdown

1. **Next.js Web UI (`apps/web`)**
   - React 18 & Next.js dashboard with WebSocket real-time chat.
   - Interactive tool call indicators, RAG citations, and AI Observability toggle panel.

2. **API Gateway (`services/api-gateway`)**
   - Single point of entry for external requests.
   - Handles JWT authentication, rate limiting, and request tracing via `X-Request-ID`.

3. **Chat Service (`services/chat-service`)**
   - Manages customer chat sessions and WebSockets.
   - Streams real-time tokens to the client frontend.

4. **AI Orchestrator (`services/ai-orchestrator`)**
   - Multi-agent router classifying user intent.
   - Integrates NVIDIA NIM (`NIMProvider`) with zero-cost fallback (`MockLLMProvider`).

5. **RAG Service & Embedding Service (`services/rag-service`, `services/embedding-service`)**
   - Vector similarity search powered by PostgreSQL and `pgvector`.
   - Indexes product policies, FAQs, store hours, and return rules.

6. **Microservices Domain Layer**
   - Product Service, Order Service, Refund Service, Ticket Service, Notification Service.
