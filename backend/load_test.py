"""
ClipSave Resolver Load & Concurrency Benchmark Tool
Simulates multi-client load against the local mocked resolver.
Measures throughput, latency percentiles (p50, p95, p99), and error rates.
NOTE: Operates against the local backend with ENABLE_MOCK_EXTRACTOR=true only.
Never sends traffic to TikTok or any external third-party service.
"""

import asyncio
import time
import statistics
import httpx
from typing import List, Dict, Any

TARGET_URL = "http://127.0.0.1:8080/v1/resolve"
SAMPLE_PAYLOAD = {"url": "https://www.tiktok.com/@creativeuser/video/734891238910"}


async def worker(client: httpx.AsyncClient, num_requests: int, latencies: List[float], errors: List[str]):
    for _ in range(num_requests):
        start = time.perf_counter()
        try:
            resp = await client.post(TARGET_URL, json=SAMPLE_PAYLOAD, timeout=10.0)
            elapsed_ms = (time.perf_counter() - start) * 1000
            if resp.status_code == 200:
                latencies.append(elapsed_ms)
            elif resp.status_code == 429:
                errors.append(f"HTTP_429_RateLimited")
            else:
                errors.append(f"HTTP_{resp.status_code}")
        except Exception as e:
            errors.append(type(e).__name__)


async def run_benchmark(concurrency: int = 10, total_requests: int = 100) -> Dict[str, Any]:
    reqs_per_worker = total_requests // concurrency
    latencies: List[float] = []
    errors: List[str] = []

    print(f"\n--- Running Benchmark: Concurrency={concurrency}, Total Requests={total_requests} ---")
    start_total = time.perf_counter()

    async with httpx.AsyncClient() as client:
        tasks = [
            worker(client, reqs_per_worker, latencies, errors)
            for _ in range(concurrency)
        ]
        await asyncio.gather(*tasks)

    duration_total = time.perf_counter() - start_total
    rps = len(latencies) / duration_total if duration_total > 0 else 0

    latencies.sort()
    p50 = statistics.median(latencies) if latencies else 0
    p95 = latencies[int(len(latencies) * 0.95)] if len(latencies) >= 20 else (latencies[-1] if latencies else 0)
    p99 = latencies[int(len(latencies) * 0.99)] if len(latencies) >= 100 else (latencies[-1] if latencies else 0)

    report = {
        "concurrency": concurrency,
        "total_requests": total_requests,
        "successful_requests": len(latencies),
        "failed_requests": len(errors),
        "duration_seconds": round(duration_total, 3),
        "requests_per_second": round(rps, 2),
        "latency_p50_ms": round(p50, 2),
        "latency_p95_ms": round(p95, 2),
        "latency_p99_ms": round(p99, 2),
        "error_summary": {e: errors.count(e) for e in set(errors)},
    }

    print(f"Completed in {report['duration_seconds']}s ({report['requests_per_second']} req/s)")
    print(f"Latency: p50={report['latency_p50_ms']}ms | p95={report['latency_p95_ms']}ms | p99={report['latency_p99_ms']}ms")
    print(f"Errors: {report['failed_requests']} -> {report['error_summary']}")
    return report


if __name__ == "__main__":
    asyncio.run(run_benchmark(concurrency=10, total_requests=50))
