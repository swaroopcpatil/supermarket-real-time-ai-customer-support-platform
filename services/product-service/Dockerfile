FROM python:3.12-slim
WORKDIR /app
ENV PIP_DEFAULT_TIMEOUT=120 PIP_RETRIES=5
COPY services/shared_platform /app/services/shared_platform
COPY services/product-service /app/services/product-service
COPY run_product_service.py /app/run.py
RUN pip install --no-cache-dir fastapi uvicorn pydantic httpx pyjwt
EXPOSE 8001
CMD ["python", "run.py"]
