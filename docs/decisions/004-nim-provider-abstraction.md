# ADR 004: NVIDIA NIM Provider Abstraction

## Context
The platform must support enterprise NVIDIA NIM inference endpoints while remaining fully operational for developers at ₹0 infrastructure cost without paid credentials.

## Decision
Implement an abstract `LLMProvider` base class with concrete implementations: `NIMProvider` (OpenAI-compatible NVIDIA NIM endpoint) and `MockLLMProvider` (deterministic local agent router and tool simulator).
