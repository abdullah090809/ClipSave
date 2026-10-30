import asyncio
import time
import statistics
import httpx
from backend.app.main import app
from backend.app.config import settings
from backend.app.security.rate_limit import reset_rate_limiter

async def benchmark_scenario(name: str, method: str, url: str, concurrency: int, total_requests: int, payload: dict = None, reset_limits: bool = True):
    if reset_limits:
        reset_rate_limiter()
    
    # Enable mock extractor during resolution benchmarks to prevent external CDN traffic
    original_mock = settings.ENABLE_MOCK_EXTRACTOR
    settings.ENABLE_MOCK_EXTRACTOR = True
    
    latencies = []
    status_counts = {}
    
    transport = httpx.ASGITransport(app=app)
    sem = asyncio.Semaphore(concurrency)
    
    start_time = time.time()
    
    async def make_request(client: httpx.AsyncClient):
        async with sem:
            t0 = time.time()
            try:
                if method == "GET":
                    resp = await client.get(url)
                else:
                    resp = await client.post(url, json=payload)
                t_elapsed = (time.time() - t0) * 1000 # ms
                latencies.append(t_elapsed)
                status_counts[resp.status_code] = status_counts.get(resp.status_code, 0) + 1
            except Exception as e:
                t_elapsed = (time.time() - t0) * 1000
                latencies.append(t_elapsed)
                status_counts["error"] = status_counts.get("error", 0) + 1

    async with httpx.AsyncClient(transport=transport, base_url="http://test", timeout=10.0) as client:
        tasks = [make_request(client) for _ in range(total_requests)]
        await asyncio.gather(*tasks)
        
    duration = time.time() - start_time
    settings.ENABLE_MOCK_EXTRACTOR = original_mock
    
    rps = total_requests / duration if duration > 0 else 0
    latencies.sort()
    p50 = statistics.median(latencies) if latencies else 0
    p95 = latencies[int(len(latencies) * 0.95)] if latencies else 0
    p99 = latencies[int(len(latencies) * 0.99)] if latencies else 0
    max_lat = max(latencies) if latencies else 0
    
    success_count = sum(c for code, c in status_counts.items() if isinstance(code, int) and 200 <= code < 400)
    failed_count = total_requests - success_count
    http_429 = status_counts.get(429, 0)
    http_5xx = sum(c for code, c in status_counts.items() if isinstance(code, int) and 500 <= code < 600)

    print(f"\n--- SCENARIO: {name} ---")
    print(f"Total Requests: {total_requests} | Concurrency: {concurrency} | Duration: {duration:.3f}s")
    print(f"Throughput: {rps:.2f} req/s")
    print(f"Latency: p50={p50:.2f}ms | p95={p95:.2f}ms | p99={p99:.2f}ms | max={max_lat:.2f}ms")
    print(f"Status Counts: {status_counts}")
    print(f"Success: {success_count} | Failed: {failed_count} | 429: {http_429} | 5xx: {http_5xx}")

    return {
        "name": name,
        "total": total_requests,
        "concurrency": concurrency,
        "duration_s": round(duration, 3),
        "rps": round(rps, 2),
        "p50_ms": round(p50, 2),
        "p95_ms": round(p95, 2),
        "p99_ms": round(p99, 2),
        "max_ms": round(max_lat, 2),
        "status_counts": status_counts,
        "success": success_count,
        "failed": failed_count,
        "http_429": http_429,
        "http_5xx": http_5xx,
    }

async def main():
    print("==================================================")
    print("STARTING BOUNDED LOCAL LOAD & CONCURRENCY BENCHMARKS")
    print("Note: External services mocked; zero traffic to TikTok/CDN")
    print("==================================================")
    
    # 1. Health Liveness Probe (1 client, 100 requests)
    await benchmark_scenario("Liveness Probe /healthz (1 client)", "GET", "/healthz", concurrency=1, total_requests=100)
    
    # 2. Health Liveness Probe (5 clients, 100 requests)
    await benchmark_scenario("Liveness Probe /healthz (5 clients)", "GET", "/healthz", concurrency=5, total_requests=100)
    
    # 3. Health Liveness Probe (10 clients, 100 requests)
    await benchmark_scenario("Liveness Probe /healthz (10 clients)", "GET", "/healthz", concurrency=10, total_requests=100)
    
    # 4. Readiness Probe /readyz (10 clients, 100 requests)
    await benchmark_scenario("Readiness Probe /readyz (10 clients)", "GET", "/readyz", concurrency=10, total_requests=100)
    
    # 5. Mock Resolution /v1/resolve (1 client, 30 requests)
    await benchmark_scenario(
        "Mock Resolution /v1/resolve (1 client)",
        "POST",
        "/v1/resolve",
        concurrency=1,
        total_requests=30,
        payload={"url": "https://www.tiktok.com/@user/video/7123456789012345678"}
    )
    
    # 6. Mock Resolution /v1/resolve (5 clients, 30 requests)
    await benchmark_scenario(
        "Mock Resolution /v1/resolve (5 clients)",
        "POST",
        "/v1/resolve",
        concurrency=5,
        total_requests=30,
        payload={"url": "https://www.tiktok.com/@user/video/7123456789012345678"}
    )
    
    # 7. Rate Limiter Saturation /v1/resolve (10 clients, 60 requests WITHOUT limit reset)
    # Default limit is 30 or 60 req/min; expect HTTP 429 when threshold exceeded
    await benchmark_scenario(
        "Rate Limit Saturation (10 clients, 60 requests)",
        "POST",
        "/v1/resolve",
        concurrency=10,
        total_requests=60,
        payload={"url": "https://www.tiktok.com/@user/video/7123456789012345678"},
        reset_limits=True
    )
    
    # 8. Invalid Request Rejection (10 clients, 100 requests)
    await benchmark_scenario(
        "Invalid Domain Rejection (10 clients, 100 requests)",
        "POST",
        "/v1/resolve",
        concurrency=10,
        total_requests=100,
        payload={"url": "https://unauthorized-domain.com/video/123"},
        reset_limits=True
    )

if __name__ == "__main__":
    asyncio.run(main())
