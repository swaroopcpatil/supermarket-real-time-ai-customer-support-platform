# ADR 001: Microservices Architecture Selection

## Context
The Supermarket Real-Time AI Platform requires clear separation of concerns across product catalog management, order fulfillment, refund handling, support ticket escalation, and AI orchestration.

## Decision
We chose an asynchronous Python microservices architecture using FastAPI. Each domain service operates independently with bounded contexts.

## Consequences
- **Pros**: Independent scalability, clear domain ownership, modular codebases.
- **Cons**: Slightly higher operational overhead managed via Docker Compose and API Gateway routing.
