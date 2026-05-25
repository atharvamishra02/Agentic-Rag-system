# Deployment Log: Problems and Solutions

This document tracks the technical challenges encountered during the deployment of the Agentic RAG system and the strategies used to overcome them.

## 1. Port Conflicts
- **Problem**: The system initially tried to use ports `8080`, `8000`, and `5000`. These were frequently occupied by other services on the production server (e.g., PyNote).
- **Solution**: Shifted the service ports to unique values:
    - Nginx: `8081`
    - RAG Engine: `8001`
    - Backend: `5001`
- **File Impacted**: `deployment/docker-compose.yml`, `deployment/nginx-agentic-rag.conf`

## 2. Container Communication Failures
- **Problem**: The Node.js backend tried to connect to the RAG Engine using `localhost:8000`, which failed because `localhost` inside a container refers to the container itself, not the host or other containers.
- **Solution**: Used Docker's internal networking. The backend now uses `http://rag-engine:8000` to communicate with the Python service.
- **File Impacted**: `deployment/docker-compose.yml` (Environment variables)

## 3. File Upload Size Limits
- **Problem**: Users encountered "413 Request Entity Too Large" errors when uploading research papers (PDFs).
- **Solution**: Modified the Nginx configuration to include `client_max_body_size 50M;` and ensured the Node.js body-parser had similar limits.
- **File Impacted**: `deployment/nginx-agentic-rag.conf`

## 4. Persistent Storage (FAISS & Uploads)
- **Problem**: Every time the containers were restarted, the uploaded documents and the FAISS vector database were lost.
- **Solution**: Implemented Docker Volumes to map the internal container directories to the host machine's filesystem.
- **File Impacted**: `deployment/docker-compose.yml`

## 5. Missing Index Crash
- **Problem**: The system would throw a 500 error if a user tried to chat before any documents were uploaded, because the FAISS index file didn't exist yet.
- **Solution**: Added robust error handling in `vector_store.py` and `rag_engine.py` to check for the existence of the index and return a friendly "No documents found" message instead of crashing.
- **File Impacted**: `rag_engine.py`, `vector_store.py`

## 6. TypeScript Execution Errors
- **Problem**: Running `ts-node` or `nodemon` in production caused `ERR_UNKNOWN_FILE_EXTENSION` or high resource usage.
- **Solution**: Implemented a multi-stage build process. The Node.js backend is now compiled to plain JavaScript (`dist/`) using `tsc`, and the production container runs the compiled code using `node dist/index.js`.
- **File Impacted**: `server/Dockerfile.node`, `server/package.json`
