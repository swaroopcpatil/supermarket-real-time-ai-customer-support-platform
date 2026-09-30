import json
import time
from uuid import uuid4
from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class TraceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid4()))
        started = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception as exc:
            print(json.dumps({"level": "error", "event": "request_failed", "service": request.app.title, "request_id": request_id, "error": str(exc)}))
            return JSONResponse({"error": {"code": "INTERNAL_ERROR", "message": "An unexpected error occurred.", "request_id": request_id}}, status_code=500)
        response.headers["X-Request-ID"] = request_id
        print(json.dumps({"level": "info", "event": "request_completed", "service": request.app.title, "request_id": request_id, "duration_ms": round((time.perf_counter()-started)*1000, 2)}))
        return response
