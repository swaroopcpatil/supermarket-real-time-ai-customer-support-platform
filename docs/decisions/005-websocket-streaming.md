# ADR 005: WebSocket Real-Time Chat & Token Streaming

## Context
Conversational AI user experience requires instant visual feedback, typing indicators, and token-by-token streaming rather than standard blocking HTTP requests.

## Decision
Use WebSockets (`/api/chat/ws`) to maintain bidirectional connections between Next.js and API Gateway / Chat Service.
