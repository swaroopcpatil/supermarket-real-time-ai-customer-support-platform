FROM python:3.12-slim
WORKDIR /app
ENV PIP_DEFAULT_TIMEOUT=120 PIP_RETRIES=5
COPY services/shared_platform /app/services/shared_platform
COPY services/ticket-service /app/services/ticket-service
COPY run_ticket_service.py /app/run.py
RUN pip install --no-cache-dir fastapi uvicorn pydantic httpx pyjwt
EXPOSE 8004
CMD ["python", "run.py"]
