import asyncio
import json
import sys
from load_test import run_scenario, TARGETS

async def stress():
    print("Testing Peak Stress: 75 and 100 concurrent connections to Neon DB...")
    db_target = TARGETS[0]
    
    r75 = await run_scenario("DB Stress (75 concurrent)", db_target, 75, 300)
    print(f"75 concurrent  -> Done in {r75['total_time_sec']}s | RPS: {r75['rps']} | Errors: {r75['error_count']} | p50: {r75['p50_ms']}ms | p95: {r75['p95_ms']}ms")

    await asyncio.sleep(1)

    r100 = await run_scenario("DB Stress (100 concurrent)", db_target, 100, 400)
    print(f"100 concurrent -> Done in {r100['total_time_sec']}s | RPS: {r100['rps']} | Errors: {r100['error_count']} | p50: {r100['p50_ms']}ms | p95: {r100['p95_ms']}ms")

    with open("load_test_peak.json", "w", encoding="utf-8") as f:
        json.dump([r75, r100], f, indent=2)

if __name__ == "__main__":
    asyncio.run(stress())
