import uuid
import time
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from .config import settings
from .routes.resolve import router as resolve_router
from .routes.health import router as health_router

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Stateless resolver backend for ClipSave mobile app.",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# CORS Middleware (strict allow list + local network origins for mobile development)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Accept", "X-Request-ID"],
)


@app.middleware("http")
async def security_and_tracing_middleware(request: Request, call_next):
    # Assign unique request ID
    req_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = req_id

    start_time = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start_time) * 1000, 2)

    # Security headers
    response.headers["X-Request-ID"] = req_id
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Server"] = "ClipSave-Resolver"
    response.headers["X-Response-Time-Ms"] = str(duration_ms)

    return response


# Include Routers
app.include_router(health_router)
app.include_router(resolve_router)
