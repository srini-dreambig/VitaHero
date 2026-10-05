import asyncio
import aiohttp
import time
import statistics
import sys
import json

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/html, */*"
}

BASE_URL = "https://vitahero.kallam.workers.dev"

TARGETS = [
    {"name": "Database Ping (Neon Postgres Roundtrip)", "url": f"{BASE_URL}/ping", "method": "GET"},
    {"name": "Android AppLinks Verification (Edge)", "url": f"{BASE_URL}/.well-known/assetlinks.json", "method": "GET"},
    {"name": "Admin Portal HTML Shell (Edge/SSR)", "url": f"{BASE_URL}/admin", "method": "GET"},
    {"name": "Invite Token Resolver (Edge DB Routing)", "url": f"{BASE_URL}/api/invite/resolve?token=load_test_probe", "method": "GET"},
    {"name": "API Auth Barrier (Security Filter)", "url": f"{BASE_URL}/api/referral-specialties", "method": "GET"},
]

async def worker(session, target, num_requests, results):
    for _ in range(num_requests):
        t0 = time.perf_counter()
        try:
            async with session.request(target["method"], target["url"], headers=HEADERS, timeout=aiohttp.ClientTimeout(total=15)) as resp:
                await resp.read()
                elapsed = (time.perf_counter() - t0) * 1000
                results.append({"status": resp.status, "duration": elapsed, "error": None})
        except Exception as e:
            elapsed = (time.perf_counter() - t0) * 1000
            results.append({"status": 0, "duration": elapsed, "error": str(e)})

async def run_scenario(name, target, concurrency, total_requests):
    reqs_per_worker = total_requests // concurrency
    results = []
    
    t_start = time.perf_counter()
    connector = aiohttp.TCPConnector(limit=concurrency + 10)
    async with aiohttp.ClientSession(connector=connector) as session:
        tasks = [
            asyncio.create_task(worker(session, target, reqs_per_worker, results))
            for _ in range(concurrency)
        ]
        await asyncio.gather(*tasks)
    t_total = time.perf_counter() - t_start

    durations = [r["duration"] for r in results if r["status"] > 0]
    errors = [r for r in results if r["status"] == 0 or r["status"] >= 500]
    status_counts = {}
    for r in results:
        code = r["status"]
        status_counts[code] = status_counts.get(code, 0) + 1

    durations.sort()
    count = len(durations)
    
    p50 = durations[int(count * 0.50)] if count else 0
    p90 = durations[int(count * 0.90)] if count else 0
    p95 = durations[int(count * 0.95)] if count else 0
    p99 = durations[int(count * 0.99)] if count else 0
    min_d = durations[0] if count else 0
    max_d = durations[-1] if count else 0
    avg_d = statistics.mean(durations) if count else 0
    rps = len(results) / t_total if t_total > 0 else 0

    return {
        "scenario": name,
        "concurrency": concurrency,
        "total_requests": len(results),
        "total_time_sec": round(t_total, 2),
        "rps": round(rps, 2),
        "status_counts": status_counts,
        "error_count": len(errors),
        "error_rate_pct": round((len(errors) / len(results) * 100) if results else 0, 2),
        "min_ms": round(min_d, 1),
        "avg_ms": round(avg_d, 1),
        "p50_ms": round(p50, 1),
        "p90_ms": round(p90, 1),
        "p95_ms": round(p95, 1),
        "p99_ms": round(p99, 1),
        "max_ms": round(max_d, 1),
    }

async def main():
    print("=================================================================")
    print("VitaHero Backend Load & Stress Testing Suite")
    print(f"Target Host: {BASE_URL}")
    print("=================================================================\n")

    summary_results = []

    # Test 1: Neon Postgres Database Concurrency (10, 25, 50 concurrent queries)
    db_target = TARGETS[0]
    for conc in [10, 25, 50]:
        total = conc * 6  # e.g., 60, 150, 300 requests
        print(f"Executing: {db_target['name']} | Concurrency: {conc} | Requests: {total}...")
        res = await run_scenario(f"DB Query ({conc} concurrent)", db_target, conc, total)
        summary_results.append(res)
        print(f"  -> Done in {res['total_time_sec']}s | RPS: {res['rps']} | Errors: {res['error_count']} | p50: {res['p50_ms']}ms | p95: {res['p95_ms']}ms\n")
        await asyncio.sleep(1)

    # Test 2: Edge & Portal Endpoints under High Concurrency (30 concurrent)
    for target in TARGETS[1:]:
        conc = 30
        total = 150
        print(f"Executing: {target['name']} | Concurrency: {conc} | Requests: {total}...")
        res = await run_scenario(target['name'], target, conc, total)
        summary_results.append(res)
        print(f"  -> Done in {res['total_time_sec']}s | RPS: {res['rps']} | Errors: {res['error_count']} | p50: {res['p50_ms']}ms | p95: {res['p95_ms']}ms\n")
        await asyncio.sleep(1)

    print("\n================== FULL LOAD TEST REPORT ==================")
    print(json.dumps(summary_results, indent=2))
    
    with open("load_test_results.json", "w", encoding="utf-8") as f:
        json.dump(summary_results, f, indent=2)

if __name__ == "__main__":
    asyncio.run(main())
