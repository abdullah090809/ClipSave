"""
ClipSave Resolver Load & Concurrency Benchmark Tool
Simulates multi-client load against the local mocked resolver or health endpoints.
Measures throughput, latency percentiles (p50, p95, p99), and error distributions.
NOTE: Operates against the local backend with ENABLE_MOCK_EXTRACTOR=true only.
Never sends traffic to TikTok or any external third-party service.
"""

import argparse
import asyncio
import json
import statistics
import sys
import time
from typing import List, Dict, Any
import httpx

DEFAULT_BASE = "http://127.0.0.1:8080"
SAMPLE_PAYLOAD = {"url": "https://www.tiktok.com/@creativeuser/video/734891238910"}


async def worker(
    client: httpx.AsyncClient,
    target_url: str,
    method: str,
    num_requests: int,
    latencies: List[float],
    errors: List[str],
):
    for _ in range(num_requests):
        start = time.perf_counter()
        try:
            if method == "POST":
                resp = await client.post(target_url, json=SAMPLE_PAYLOAD, timeout=15.0)
            else:
                resp = await client.get(target_url, timeout=15.0)

            elapsed_ms = (time.perf_counter() - start) * 1000
            if resp.status_code == 200:
                latencies.append(elapsed_ms)
            elif resp.status_code == 429:
                errors.append("HTTP_429_RateLimited")
            else:
                errors.append(f"HTTP_{resp.status_code}")
        except Exception as e:
            errors.append(type(e).__name__)


async def run_benchmark(
    base_url: str = DEFAULT_BASE,
    endpoint: str = "/healthz",
    concurrency: int = 10,
    total_requests: int = 100,
) -> Dict[str, Any]:
    target_url = f"{base_url.rstrip('/')}{endpoint}"
    method = "POST" if endpoint == "/v1/resolve" else "GET"
    reqs_per_worker = max(1, total_requests // concurrency)
    latencies: List[float] = []
    errors: List[str] = []

    print(f"\n==================================================")
    print(f" ClipSave Benchmark: {method} {target_url}")
    print(f" Concurrency={concurrency} workers | Total={total_requests} reqs ({reqs_per_worker}/worker)")
    print(f"==================================================")
    start_total = time.perf_counter()

    async with httpx.AsyncClient() as client:
        tasks = [
            worker(client, target_url, method, reqs_per_worker, latencies, errors)
            for _ in range(concurrency)
        ]
        await asyncio.gather(*tasks)

    duration_total = time.perf_counter() - start_total
    total_processed = len(latencies) + len(errors)
    rps = total_processed / duration_total if duration_total > 0 else 0

    latencies.sort()
    p50 = statistics.median(latencies) if latencies else 0
    p95 = latencies[int(len(latencies) * 0.95)] if len(latencies) >= 20 else (latencies[-1] if latencies else 0)
    p99 = latencies[int(len(latencies) * 0.99)] if len(latencies) >= 100 else (latencies[-1] if latencies else 0)

    report = {
        "endpoint": endpoint,
        "concurrency": concurrency,
        "total_requests": total_processed,
        "successful_requests": len(latencies),
        "failed_or_limited_requests": len(errors),
        "duration_seconds": round(duration_total, 3),
        "requests_per_second": round(rps, 2),
        "latency_p50_ms": round(p50, 2),
        "latency_p95_ms": round(p95, 2),
        "latency_p99_ms": round(p99, 2),
        "error_summary": {e: errors.count(e) for e in set(errors)},
    }

    print(f"Completed in {report['duration_seconds']}s ({report['requests_per_second']} req/s)")
    if latencies:
        print(f"Latency: p50={report['latency_p50_ms']}ms | p95={report['latency_p95_ms']}ms | p99={report['latency_p99_ms']}ms")
    print(f"Outcome: {report['successful_requests']} OK, {report['failed_or_limited_requests']} Errors/Limited -> {report['error_summary']}")
    return report


def main():
    parser = argparse.ArgumentParser(description="ClipSave Load & Concurrency Benchmark")
    parser.add_argument("--base-url", default=DEFAULT_BASE, help="Base backend URL")
    parser.add_argument("--endpoint", default="/healthz", help="Endpoint to test (/healthz or /v1/resolve)")
    parser.add_argument("--concurrency", type=int, default=10, help="Number of concurrent workers")
    parser.add_argument("--requests", type=int, default=50, help="Total number of requests")
    parser.add_argument("--json", action="store_true", help="Output raw JSON results")

    args = parser.parse_args()
    report = asyncio.run(
        run_benchmark(
            base_url=args.base_url,
            endpoint=args.endpoint,
            concurrency=args.concurrency,
            total_requests=args.requests,
        )
    )
    if args.json:
        print("\nJSON REPORT:")
        print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
