import asyncio
import httpx
from main import app
import uvicorn
from multiprocessing import Process
import time

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=8000)

async def test_agentic_workflow():
    print("🚀 Initializing Agentic RAG Local Verification...")
    
    # 1. Start a temporary server process
    server_process = Process(target=run_server)
    server_process.start()
    time.sleep(5) # Wait for server to boot
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        # 2. Check Health
        health = await client.get("http://127.0.0.1:8000/health")
        print(f"✅ Health Check: {health.json()}")
        
        # 3. Submit a complex query that requires planning and verification
        test_query = {
            "query": "What are the core components of a self-healing RAG system and how do they handle hallucinations?",
            "session_id": "test-session-001"
        }
        
        print(f"📡 Sending Query: {test_query['query']}")
        try:
            response = await client.post("http://127.0.0.1:8000/ask", json=test_query)
            result = response.json()
            
            print("\n--- 🤖 AGENT RESPONSE ---")
            print(f"Final Output: {result.get('response')[:200]}...")
            print(f"Confidence Score: {result.get('confidence')}")
            print(f"Trace ID: {result.get('trace_id')}")
            print(f"Citations Found: {len(result.get('citations', []))}")
            print("-------------------------\n")
            
            if result.get('response'):
                print("✨ SYSTEM VERIFIED: End-to-end flow is operational.")
            else:
                print("⚠️ SYSTEM WARNING: Empty response. Check agent logs.")
                
        except Exception as e:
            print(f"❌ Verification Failed: {str(e)}")
            
    # 4. Cleanup
    server_process.terminate()
    print("🛑 Test Server Stopped.")

if __name__ == "__main__":
    asyncio.run(test_agentic_workflow())
