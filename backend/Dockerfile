# Multi-stage production Dockerfile for ClipSave Resolver Backend
FROM python:3.13-slim AS builder

WORKDIR /build
COPY requirements.txt .

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && pip install --no-cache-dir --user -r requirements.txt

# Final minimal runtime image
FROM python:3.13-slim AS runtime

# Install ffmpeg, nodejs, and ca-certificates for DASH remuxing and JS signature extraction
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    nodejs \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user (UID 1000 is standard for Hugging Face Spaces and container sandboxes)
RUN useradd -m -u 1000 appuser

WORKDIR /app

# Copy dependencies from builder
COPY --from=builder --chown=appuser:appuser /root/.local /app/.local
ENV PATH=/app/.local/bin:$PATH
ENV PYTHONPATH=/app

# Copy application source
COPY --chown=appuser:appuser app /app/app

# Drop privileges
USER 1000

ENV PORT=8080
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://127.0.0.1:${PORT:-8080}/healthz || exit 1

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080} --workers 1 --proxy-headers --forwarded-allow-ips \"*\""]
