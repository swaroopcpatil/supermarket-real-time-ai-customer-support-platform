# Supermarket Real-Time AI Customer Support Platform

[![CI Pipeline](https://github.com/example/supermarket-ai-platform/actions/workflows/ci.yml/badge.svg)](https://github.com/example/supermarket-ai-platform/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![Next.js 14](https://img.shields.io/badge/Next.js-14.1-black.svg)](https://nextjs.org/)
[![NVIDIA NIM](https://img.shields.io/badge/NVIDIA-NIM%20Ready-76B900.svg)](https://developer.nvidia.com/nim)

A production-grade, event-driven, multi-agent AI customer support platform for a modern supermarket enterprise. Built with Python microservices, NVIDIA NIM integration, pgvector RAG, WebSocket streaming, Kafka event processing, Prometheus monitoring, and a Next.js 14 TypeScript dashboard.

Designed for **₹0 local development cost** with full mock AI fallback and optional enterprise NVIDIA NIM acceleration.

---

## 🌟 Key Features

- **Multi-Agent AI Orchestration**: Specialized sub-agents for Product search, Order tracking & cancellations, Refund processing, Policy RAG, and Human Escalation.
- **NVIDIA NIM Integration**: OpenAI-compatible LLM/Embedding provider abstraction with zero-cost deterministic mock fallback (`AI_PROVIDER=mock`).
- **Retrieval-Augmented Generation (RAG)**: Knowledge base retrieval over store policies, refund rules, and store hours stored in **PostgreSQL + pgvector**.
- **Real-Time WebSocket Streaming**: Instant token streaming, typing indicators, and live execution tracing.
- **AI Observability Panel**: Embedded developer view displaying intent detection, invoked tools, RAG similarity scores, and confidence metrics.
- **Event-Driven Architecture**: Asynchronous Kafka event processing for order status changes, ticket escalations, and customer notifications.
- **Full-Stack Next.js Dashboard**: Polished customer chat assistant, interactive catalog, order tracking, support ticket hub, and admin analytics dashboard.

---

## 🏗️ High-Level Architecture

```text
                         ┌─────────────────────────┐
                         │       Next.js Web UI    │
                         │     Customer Dashboard  │
                         └────────────┬────────────┘
                                      │
                            REST + WebSocket
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │       API Gateway       │
                         │       FastAPI           │
                         └────────────┬────────────┘
                                      │
                ┌─────────────────────┼─────────────────────┐
                │                     │                     │
                ▼                     ▼                     ▼
       ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
       │ Chat Service   │   │ Order Service  │   │ Product Service│
       └───────┬────────┘   └────────────────┘   └────────────────┘
               │
               ▼
       ┌────────────────┐
       │ AI Orchestrator│
       └───────┬────────┘
               │
       ┌───────┼──────────────────────┐
       │       │                      │
       ▼       ▼                      ▼
   Support   Product              Order/
    Agent   Agent                 Refund Agent
       │       │                      │
       └───────┼──────────────────────┘
               │
               ▼
       ┌────────────────┐
       │   RAG Service  │
       └───────┬────────┘
               │
               ▼
       ┌─────────────────────────┐
       │ PostgreSQL + pgvector   │
       └─────────────────────────┘

          Event-driven layer

       ┌─────────────────────────┐
       │         Kafka           │
       └───────────┬─────────────┘
                   │
       ┌───────────┼────────────────────┐
       ▼           ▼                    ▼
 Notification   Analytics          Audit Service
 Service        Service            Service
```

---

## 🤖 AI Architecture & Multi-Agent Orchestration

The platform employs a multi-agent routing strategy where an intent classifier dispatches customer queries to specialized sub-agents equipped with structured tool calls:

1. **Support Agent**: Answers store policies, store hours, payment options, and delivery fees via pgvector RAG.
2. **Product Agent**: Searches supermarket inventory, stock levels, offers under ₹500, and healthy recommendations.
3. **Order Agent**: Fetches real-time status of orders (`ORD-XXXX`) and processes instant cancellations.
4. **Refund Agent**: Validates return policies and submits automated refund requests (`RFD-XXXX`).
5. **Escalation Agent**: Dispatches human support tickets (`TKT-XXXX`) when customer confidence drops or human assistance is explicitly requested.

---

## 📚 RAG Pipeline

```text
Customer Question ──► Query Embedding ──► pgvector Cosine Search ──► Top-K Chunks ──► LLM Context ──► Grounded Answer + Citation
```

Knowledge documents stored under `data/documents/`:
- `refund-policy.md`
- `return-policy.md`
- `delivery-policy.md`
- `payment-policy.md`
- `store-hours.md`
- `damaged-product-policy.md`
- `grocery-faq.md`

---

## 🧩 Microservices Directory Table

| Service | Directory | Port | Responsibility |
| :--- | :--- | :--- | :--- |
| **API Gateway** | `services/api-gateway` | `8000` | Single public API entry, JWT auth, request routing, WS proxy |
| **Product Service** | `services/product-service` | `8001` | Supermarket product catalog, inventory, and search |
| **Order Service** | `services/order-service` | `8002` | Order management, status tracking, and cancellations |
| **Refund Service** | `services/refund-service` | `8003` | Refund requests, return eligibility, and review workflows |
| **Ticket Service** | `services/ticket-service` | `8004` | Human escalation tickets and agent dispatch |
| **Embedding Service**| `services/embedding-service`| `8005` | Vector embeddings (NIM vs Local deterministic vectors) |
| **RAG Service** | `services/rag-service` | `8006` | Knowledge base indexing and similarity retrieval |
| **AI Orchestrator** | `services/ai-orchestrator` | `8007` | Intent classification, agent routing, tool execution |
| **Chat Service** | `services/chat-service` | `8008` | Chat session persistence and WebSocket token streaming |
| **Notification Svc** | `services/notification-service` | `8009` | Asynchronous Kafka event consumer and notifications |

---

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS, Lucide Icons
- **Backend Microservices**: Python 3.12, FastAPI, Pydantic, httpx, PyJWT, WebSockets
- **Generative AI & LLM**: NVIDIA NIM API (`NIMProvider`), Local Mock Fallback (`MockLLMProvider`)
- **Vector DB & Data**: PostgreSQL 16, pgvector extension, Redis 7
- **Event Bus & Messaging**: Apache Kafka, Zookeeper
- **Observability**: Prometheus, Grafana dashboards, Structured JSON logging, `X-Request-ID` tracing
- **Orchestration & DevOps**: Docker, Docker Compose, Makefile, GitHub Actions CI

---

## 🚀 Quick Local Setup (Zero-Cost Development)

### Prerequisites
- Docker & Docker Compose
- Make (optional)

### Step 1: Clone and Configure Environment
```bash
cp .env.example .env
```

### Step 2: Launch Complete System via Docker Compose
```bash
docker compose up --build
```
*Starts all 10 microservices, Next.js frontend, PostgreSQL with pgvector, Redis, Kafka, Zookeeper, Prometheus, and Grafana.*

### Step 3: Access Dashboard & Services
- **Next.js Customer Support Web App**: [http://localhost:3000](http://localhost:3000)
- **API Gateway Swagger Docs**: [http://localhost:8000/api/docs](http://localhost:8000/api/docs)
- **Prometheus Metrics**: [http://localhost:9090](http://localhost:9090)
- **Grafana Operational Dashboard**: [http://localhost:3001](http://localhost:3001) (Credentials: `admin/admin`)

---

## ⚡ NVIDIA NIM Setup vs. Mock Mode

### Running in Mock Mode (Default - ₹0 Cost)
No API key required.
```env
AI_PROVIDER=mock
EMBEDDING_PROVIDER=mock
```

### Running with Enterprise NVIDIA NIM
Update `.env` with your NVIDIA Developer NIM key:
```env
AI_PROVIDER=nim
NVIDIA_NIM_BASE_URL=https://integrate.api.nvidia.com/v1
NVIDIA_NIM_API_KEY=nvapi-your-actual-nvidia-nim-key
NVIDIA_NIM_MODEL=meta/llama-3.1-70b-instruct
```

---

## 🧪 Testing & Verification

Run the unit test suite:
```bash
python -m pytest tests/unit -v
```

Run the performance load test benchmark:
```bash
python scripts/load_test.py
```

## Design notes and current limitations

The default mock path is intentionally deterministic: it demonstrates agent
routing, structured tool events, streaming, citations, and escalation without
requiring an external account. The relational schema, pgvector extension, seed
data, Redis, Kafka, Prometheus, and Grafana are all provisioned by Compose.

The Python services currently use their in-process demo repositories for the
customer-facing flows, so writes made in mock mode are reset when a service is
restarted. This keeps the portfolio demo runnable with zero setup, but is not a
substitute for a production persistence adapter. Kafka is provisioned for the
event topology; a durable Kafka producer/consumer adapter is the next intended
increment before production use. NIM generation is optional and deliberately
falls back to mock mode after bounded retries; it must not be treated as a
guaranteed SLA.

---

## 📄 License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
