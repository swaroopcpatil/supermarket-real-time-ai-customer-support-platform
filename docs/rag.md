# RAG implementation

The RAG service exposes `POST /documents`, `POST /documents/index`,
`POST /search`, and `GET /documents`. The local demo uses deterministic
keyword retrieval so it works with no model or network access. PostgreSQL is
provisioned with pgvector and a 384-dimension `document_chunks.embedding`
column for a production embedding backend.

Set `EMBEDDING_PROVIDER=nim`, `NVIDIA_NIM_API_KEY`, and `EMBEDDING_MODEL` to
switch the embedding service to NVIDIA's OpenAI-compatible endpoint. If the
endpoint times out or is unavailable, it returns deterministic mock embeddings
instead of failing a customer request.
