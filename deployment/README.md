# Deployment Guide: AI Research Assistant (Agentic RAG System)

This directory contains the configuration files and documentation for deploying the Agentic RAG system in a production environment using Docker and Nginx.

## File Purposes

### Root Directory Deployment Files
- **`Dockerfile.python`**: Defines the Docker image for the Python-based RAG Engine. It installs Python dependencies, sets up the environment, and runs the FastAPI server.
- **`server/Dockerfile.node`**: Defines the Docker image for the Node.js backend. It builds the TypeScript code and prepares the server to handle API requests and serve the client.
- **`docker-compose.yml`**: Orchestrates the multi-container setup (Python RAG Engine and Node.js Backend).
- **`.dockerignore`**: Specifies which files and directories (like `node_modules`, `.venv`, and large data files) should be excluded from the Docker build context to keep images small and builds fast.
- **`deploy_to_server.py`**: A utility script used to automate the deployment process, likely handling file transfers or remote command execution.

### Deployment Folder Files
- **`deployment/docker-compose.yml`**: A production-specific version of the docker-compose configuration. It maps internal service ports to external ports (e.g., `8001` and `5001`) and sets up persistent volumes for the FAISS database and uploads.
- **`deployment/nginx-agentic-rag.conf`**: The Nginx configuration file. It acts as a reverse proxy, routing incoming traffic from port `80` to the appropriate internal services (Backend or RAG Engine).
- **`deployment/ARCHITECTURE.md`**: Detailed overview of the system's structural design and data flow.
- **`deployment/QUESTION_FLOW.md`**: Step-by-step journey of a user's question through the system.
- **`deployment/COMMANDS.md`**: A quick-reference list of all terminal commands used for deployment.
- **`deployment/PROBLEMS_AND_SOLUTIONS.md`**: A log of challenges faced during deployment and how they were resolved.

## How to Deploy

1. **Environment Setup**: Ensure `.env` is configured with necessary API keys (OpenAI, Tavily, etc.).
2. **Build and Start**:
   ```bash
   docker compose -p agentic-rag -f deployment/docker-compose.yml up --build -d
   ```
3. **Nginx Configuration**:
   - Copy `nginx-agentic-rag.conf` to `/etc/nginx/sites-available/`.
   - Link to `sites-enabled`: `sudo ln -sf /etc/nginx/sites-available/agentic-rag /etc/nginx/sites-enabled/`
   - Reload Nginx: `sudo systemctl reload nginx`.
