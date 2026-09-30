FROM python:3.12-slim
WORKDIR /app
ENV PIP_DEFAULT_TIMEOUT=120 PIP_RETRIES=5
COPY services/shared_platform /app/services/shared_platform
COPY services/notification-service /app/services/notification-service
COPY run_notification_service.py /app/run.py
RUN pip install --no-cache-dir fastapi uvicorn pydantic httpx pyjwt
EXPOSE 8009
CMD ["python", "run.py"]
