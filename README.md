# AI Research Assistant - Agentic RAG System

AI Research Assistant is a web app for uploading documents, asking questions, and getting research-style answers with source-aware context. It uses a React frontend, a Node.js API server, and a Python FastAPI RAG engine.

Live site: https://agenticrag.online

## What This Project Does

- Lets users register, log in, and use a private chat session.
- Accepts document uploads, including PDFs.
- Splits uploaded documents into chunks and stores embeddings in FAISS.
- Uses an agentic RAG pipeline to plan, retrieve, verify, and answer questions.
- Serves the frontend and backend through Docker in production.

## Main Parts

| Folder/File | Purpose |
| --- | --- |
| `client/` | React + TypeScript frontend built with Vite |
| `server/` | Node.js + Express backend for auth, uploads, sessions, and frontend serving |
| `rag_api.py` | Python FastAPI API for chat and document upload processing |
| `agent.py` | Main agent runner used by the Python RAG API |
| `agents/` | Planner, retriever, verifier, synthesizer, and recovery agents |
| `vector_store.py` | FAISS vector store logic |
| `deployment/` | Production Docker Compose and Nginx config |
| `.github/workflows/deploy.yml` | GitHub Actions deployment workflow |

## Architecture

For a deeper senior-developer walkthrough, see [`ARCHITECTURE.md`](ARCHITECTURE.md).

Production traffic flows like this:

```text
Browser
  |
  v
Nginx / HTTPS
  |
  +-- /              -> Node.js backend on port 5001
  +-- /api/rag/      -> Python RAG engine on port 8001

Node.js backend
  |
  +-- serves React build
  +-- handles auth and sessions
  +-- forwards chat/upload requests to Python
  +-- stores users in PostgreSQL

Python RAG engine
  |
  +-- processes uploaded files
  +-- stores/searches embeddings with FAISS
  +-- runs the multi-agent answer pipeline
```

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Backend | Node.js, Express, Passport.js |
| AI API | Python, FastAPI, LangGraph/LangChain |
| Vector Search | FAISS |
| Database | PostgreSQL |
| Deployment | Docker Compose, Nginx, GitHub Actions |

## Requirements

Install these before running locally:

- Python 3.11+
- Node.js 20+
- npm
- Git
- PostgreSQL, or Docker if you want to run production-like services

## Environment Setup

Copy the example env file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Fill in the values in `.env`.

Important variables:

| Variable | Purpose |
| --- | --- |
| `GOOGLE_API_KEY` | LLM/API key used by the Python RAG engine |
| `PORT` | Node backend port, usually `5000` locally |
| `PYTHON_API_URL` | URL of the Python API, usually `http://127.0.0.1:8000` locally |
| `APP_ORIGIN` | Frontend URL, usually `http://127.0.0.1:5173` locally |
| `SERVER_PUBLIC_URL` | Public backend URL, usually `http://127.0.0.1:5000` locally |
| `SESSION_SECRET` | Long random string for login sessions |
| `AUTH_REQUIRED` | Use `true` to require login, `false` to test without auth |
| `COOKIE_SECURE` | Use `false` locally, `true` behind HTTPS in production |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional Google OAuth login |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | Optional GitHub OAuth login |

Do not commit `.env`. It contains secrets and is ignored by git.

## Run Locally

Use three terminals.

### 1. Start the Python RAG API

```bash
python -m venv .venv
```

Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install Python dependencies and start the API:

```bash
pip install -r requirements.txt
python rag_api.py
```

Python API should be available at:

```text
http://127.0.0.1:8000
```

### 2. Start the Node.js backend

```bash
cd server
npm install
npm run dev
```

Node backend should be available at:

```text
http://127.0.0.1:5000
```

Health check:

```text
http://127.0.0.1:5000/health
```

### 3. Start the React frontend

```bash
cd client
npm install
npm run dev
```

Frontend should be available at:

```text
http://127.0.0.1:5173
```

## Build Checks

Run these before pushing code:

```bash
cd client
npm run build
```

```bash
cd server
npm run build
```

## Production Deployment

Production is designed to deploy from GitHub.

Every push to the `main` branch triggers:

1. GitHub Actions connects to the server over SSH.
2. The server pulls the latest code.
3. Docker images are rebuilt.
4. Containers are restarted.
5. A health check runs against the Node backend.

Workflow file:

```text
.github/workflows/deploy.yml
```

Required GitHub repository secrets:

| Secret | Description |
| --- | --- |
| `DEPLOY_HOST` | Production server IP or hostname |
| `DEPLOY_USER` | SSH username |
| `DEPLOY_KEY` | SSH private key for deployment |
| `DEPLOY_PATH` | Project path on the server, for example `/var/www/agentic-rag` |

## Production Containers

For `agenticrag.online`, the important containers are:

| Container | Purpose |
| --- | --- |
| `pynote-nginx-1` | Public Nginx reverse proxy for HTTP/HTTPS |
| `agentic-rag-backend-1` | Node.js backend and React frontend |
| `agentic-rag-rag-engine-1` | Python RAG engine |
| `agentic-rag-db-1` | PostgreSQL database |

The `job_agent_*` containers are separate from `agenticrag.online` unless Nginx is changed to route traffic to them.

## Manual Docker Commands

From the project root on the server:

```bash
docker compose -p agentic-rag -f deployment/docker-compose.yml build --no-cache
docker compose -p agentic-rag -f deployment/docker-compose.yml up -d --force-recreate
```

Check running containers:

```bash
docker ps
```

Check logs:

```bash
docker compose -p agentic-rag -f deployment/docker-compose.yml logs -f
```

Check disk usage:

```bash
df -h
docker system df
```

## Files That Should Not Be Committed

These are intentionally ignored:

- `.env`
- `.venv/`
- `node_modules/`
- `dist/`
- `users.db`
- `faiss_db/`
- `temp_uploads/`
- `logs.txt`
- `deploy_to_server.py`
- `scratch/`

If deployment fails because the server has no free space, check Docker image usage first:

```bash
docker system df
```

Unused Docker images can consume many GB of disk space.

## Common Problems

### Login does not work locally

Check:

- `SESSION_SECRET` is set.
- `APP_ORIGIN` matches the frontend URL.
- `SERVER_PUBLIC_URL` matches the backend URL.
- OAuth callback URLs match the values in `.env`.

### Chat returns "RAG Engine is unavailable"

Check:

- `python rag_api.py` is running.
- `PYTHON_API_URL` points to the Python API.
- `http://127.0.0.1:8000` returns a status response.

### Upload fails

Check:

- The Python API is running.
- `temp_uploads/` can be created.
- Required API keys are present in `.env`.
- The uploaded file is readable and not too large.

### Production deploy fails during Docker build

Check server disk space:

```bash
df -h
docker system df
```

If the disk is full, remove unused Docker images, stopped containers, or old build artifacts before rebuilding.

## License

MIT
