# ADR 003: Retrieval-Augmented Generation (RAG) with pgvector

## Context
AI support responses regarding store policies, return conditions, and delivery rules must be grounded in authoritative documentation to prevent hallucinations.

## Decision
Use PostgreSQL with the `pgvector` extension for vector indexing alongside standard relational customer data, avoiding the cost of proprietary third-party vector databases.
