# Question Journey: How a Query is Processed

When a user types a question into the Research Assistant and hits "Send", it triggers a sequence of events across multiple services. Here is the step-by-step path:

## 1. The Client (User's Browser)
- **Action**: The frontend (React/Vite) captures the user's input and the current `threadId`.
- **Request**: Sends an HTTP POST request to `http://162.222.204.31:8081/api/chat`.
- **Payload**: `{ "query": "What is the conclusion of the study?", "threadId": "session-123" }`

## 2. Nginx (The Traffic Guard)
- **Role**: Entry point for the server.
- **Action**: Nginx receives the request on port `8081`.
- **Routing**: Based on the `nginx-agentic-rag.conf` rules, it identifies that `/api/chat` belongs to the Node.js backend and proxies the request to `http://localhost:5001`.

## 3. Node.js Backend (The Orchestrator)
- **File**: `server/src/index.ts`
- **Role**: Manages high-level logic and bridging.
- **Action**:
    - The `/api/chat` endpoint receives the request.
    - It logs the query for debugging.
    - It forwards the request to the Python RAG Engine using the internal Docker URL: `http://rag-engine:8000/chat`.

## 4. Python RAG Engine (The Brain)
- **File**: `rag_engine.py` & `rag_api.py`
- **Role**: Intelligence and Retrieval.
- **Internal Steps**:
    1. **Initialization**: Loads the FAISS vector database from `faiss_db/`.
    2. **Filtering**: Applies a metadata filter so only documents belonging to `threadId: "session-123"` are considered.
    3. **Retrieval**: Performs a semantic search (MMR - Maximal Marginal Relevance) to find the most relevant text chunks.
    4. **Formatting**: Groups the chunks by their source file and assigns Source IDs (e.g., `[Source 1]`).
    5. **Generation**: Sends the formatted context and the original question to OpenAI (GPT-4o-mini) with instructions to cite sources.
    6. **Post-Processing**: Deduplicates citations and prepares a JSON response containing the `answer` and `citations`.

## 5. The Return Path
- **Python to Node**: The RAG engine sends the JSON response back to the Node.js backend.
- **Node to Client**: The Node.js backend receives the result and sends it back through Nginx to the user's browser.

## 6. The Result (User Interface)
- **Action**: The React app receives the response.
- **Display**: It renders the AI's answer in the chat window and displays clickable source citations (with snippets and page numbers) below the message.

---

### Key Communication Points
| From | To | Method | Connection |
| :--- | :--- | :--- | :--- |
| **User** | **Nginx** | Public HTTP | Port 8081 |
| **Nginx** | **Node.js** | Proxy Pass | Port 5001 |
| **Node.js** | **Python** | Internal API | http://rag-engine:8000 |
| **Python** | **OpenAI** | HTTPS API | External Cloud |
