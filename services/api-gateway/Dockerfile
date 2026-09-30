FROM python:3.12-slim
WORKDIR /app
ENV PIP_DEFAULT_TIMEOUT=120 PIP_RETRIES=5
COPY services /app/services
COPY run_api_gateway.py /app/run.py
RUN pip install --no-cache-dir fastapi uvicorn pydantic httpx pyjwt websockets
EXPOSE 8000
CMD ["python", "run.py"]
