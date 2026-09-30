FROM python:3.12-slim
WORKDIR /app
ENV PIP_DEFAULT_TIMEOUT=120 PIP_RETRIES=5
COPY services/shared_platform /app/services/shared_platform
COPY services/chat-service /app/services/chat-service
COPY services/ai-orchestrator /app/services/ai-orchestrator
COPY run_chat_service.py /app/run.py
RUN pip install --no-cache-dir fastapi uvicorn pydantic httpx pyjwt websockets
EXPOSE 8008
CMD ["python", "run.py"]
