FROM python:3.12-slim
WORKDIR /app
ENV PIP_DEFAULT_TIMEOUT=120 PIP_RETRIES=5
COPY services/shared_platform /app/services/shared_platform
COPY services/refund-service /app/services/refund-service
COPY run_refund_service.py /app/run.py
RUN pip install --no-cache-dir fastapi uvicorn pydantic httpx pyjwt
EXPOSE 8003
CMD ["python", "run.py"]
