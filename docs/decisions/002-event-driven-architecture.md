# ADR 002: Event-Driven Architecture with Apache Kafka

## Context
Asynchronous notifications, audit logging, and state change propagations (such as order placement or refund processing) must not block primary synchronous REST requests.

## Decision
Adopt Apache Kafka topics (`orders`, `tickets`, `refunds`, `chat-events`, `notifications`, `audit-events`) with an in-memory event bus fallback for zero-cost local execution.
