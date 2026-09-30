import time
import asyncio
import httpx
import numpy as np

TARGET_URL = "http://localhost:8000/api/chat"
TOTAL_REQUESTS = 20
CONCURRENCY = 4

SAMPLE_PAYLOADS = [
    {"customer_id": "CUS-DEMO", "message": "Where is my order ORD-1001?"},
    {"customer_id": "CUS-DEMO", "message": "Is Amul milk available?"},
    {"customer_id": "CUS-DEMO", "message": "What is your refund policy?"},
    {"customer_id": "CUS-DEMO", "message": "My item arrived damaged."},
]

async def send_request(client, payload):
    start = time.perf_counter()
    try:
        resp = await client.post(TARGET_URL, json=payload, timeout=10.0)
        elapsed = (time.perf_counter() - start) * 1000.0
        return elapsed, resp.status_code
    except Exception as e:
        elapsed = (time.perf_counter() - start) * 1000.0
        return elapsed, 500

async def main():
    print(f"--- Starting Load Test benchmark on {TARGET_URL} ---")
    print(f"Total Requests: {TOTAL_REQUESTS} | Concurrency: {CONCURRENCY}")
    
    latencies = []
    statuses = []
    
    start_total = time.perf_counter()
    
    async with httpx.AsyncClient() as client:
        tasks = []
        for i in range(TOTAL_REQUESTS):
            payload = SAMPLE_PAYLOADS[i % len(SAMPLE_PAYLOADS)]
            tasks.append(send_request(client, payload))
        
        results = await asyncio.gather(*tasks)
        for lat, status in results:
            latencies.append(lat)
            statuses.append(status)
            
    total_time = time.perf_counter() - start_total
    rps = TOTAL_REQUESTS / total_time
    p50 = np.percentile(latencies, 50)
    p95 = np.percentile(latencies, 95)
    
    print("\n--- BENCHMARK RESULTS ---")
    print(f"Total Time Taken : {total_time:.2f} seconds")
    print(f"Requests / sec   : {rps:.2f} req/s")
    print(f"P50 Latency      : {p50:.2f} ms")
    print(f"P95 Latency      : {p95:.2f} ms")
    print(f"Success Rate     : {statuses.count(200) / TOTAL_REQUESTS * 100:.1f}%")

if __name__ == "__main__":
    asyncio.run(main())
