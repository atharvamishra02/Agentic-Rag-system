# 🧠 AI Research Assistant — Agentic RAG System

An intelligent, multi-agent research assistant powered by **LangGraph**, **FAISS**, and **OpenAI**. Upload documents, ask questions, and get AI-synthesized answers with source citations — all through a modern React interface.

**Live at:** [https://agenticrag.online](https://agenticrag.online)

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  pynote-nginx                   │
│         (SSL termination, port 80/443)          │
└──────────┬──────────────────┬───────────────────┘
           │ /                │ /api/rag/
           ▼                  ▼
┌──────────────────┐ ┌────────────────────────────┐
│  Node.js Backend │ │   Python RAG Engine        │
│  (Express + TS)  │ │   (FastAPI + LangGraph)    │
│  Port 5001       │ │   Port 8001                │
│                  │ │                            │
│  • Auth (OAuth)  │ │  • PDF processing          │
│  • Session mgmt  │ │  • FAISS vector search     │
│  • File upload   │ │  • Multi-agent pipeline    │
│  • Serves React  │ │  • Web search (DuckDuckGo) │
│    frontend      │ │  • OpenAI LLM integration  │
└──────────────────┘ └────────────────────────────┘
           │                  │
           ▼                  ▼
┌──────────────────┐ ┌────────────────────────────┐
│   PostgreSQL     │ │   FAISS Vector Database    │
│   (Users, Auth)  │ │   (Document embeddings)    │
└──────────────────┘ └────────────────────────────┘
```

## Tech Stack

| Layer      | Technology                                      |
|------------|------------------------------------------------ |
| Frontend   | React 19, TypeScript, Vite, Tailwind CSS        |
| Backend    | Node.js, Express 5, TypeScript                  |
| AI Engine  | Python 3.11, FastAPI, LangGraph, LangChain      |
| Vector DB  | FAISS (CPU), HuggingFace Sentence Transformers  |
| Auth       | Passport.js (Google, GitHub, Local)              |
| Database   | PostgreSQL 15                                   |
| Deploy     | Docker Compose, Nginx, Let's Encrypt SSL        |
| CI/CD      | GitHub Actions (SSH deploy)                     |

## Multi-Agent Pipeline

The RAG engine uses a **LangGraph** multi-agent architecture:

1. **Planner Agent** — Analyzes the query and creates a retrieval plan
2. **Retrieval Agent** — Searches FAISS vectors + web (DuckDuckGo)
3. **Verifier Agent** — Validates retrieved context for relevance
4. **Synthesizer Agent** — Generates the final answer with citations
5. **Recovery Agent** — Handles failures and retries

## Local Development

### Prerequisites
- Python 3.11+
- Node.js 20+
- PostgreSQL (or use Docker)

### Setup

```bash
# Clone
git clone https://github.com/atharvamishra02/Agentic-Rag-system.git
cd Agentic-Rag-system

# Python backend
python -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
python rag_api.py

# Node.js backend
cd server && npm install && npm run dev

# React frontend
cd client && npm install && npm run dev
```

### Environment Variables

Copy `.env.example` to `.env` and fill in:

```env
GOOGLE_API_KEY=...          # For OpenAI/Google LLM
SESSION_SECRET=...          # Random secret for sessions
GOOGLE_CLIENT_ID=...        # OAuth (optional)
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...        # OAuth (optional)
GITHUB_CLIENT_SECRET=...
```

## Production Deployment

Deployments are automated via **GitHub Actions**. Every push to `main` triggers:

1. SSH into the production server
2. `git pull` latest code
3. Rebuild & restart Docker containers
4. Health check

### GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| `DEPLOY_HOST` | Server IP address |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_KEY`  | SSH private key |
| `DEPLOY_PATH` | Project path on server |

## License

MIT
