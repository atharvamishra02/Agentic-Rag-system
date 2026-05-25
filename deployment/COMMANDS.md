# Deployment Commands Reference

This is a step-by-step list of every command used to deploy the Agentic RAG system on your Ubuntu server.

## 1. Initial Setup
Ensure you are in the project root directory:
```bash
cd "/home/ubuntu/AI Research Assistant (Agentic RAG System)"
```

## 2. Docker Operations
These commands manage the Python RAG Engine and the Node.js Backend.

### Build and Start (The main deployment command)
```bash
docker-compose -f deployment/docker-compose.yml up --build -d
```

### Stop the System
```bash
docker-compose -f deployment/docker-compose.yml down
```

### View Live Logs
```bash
docker-compose -f deployment/docker-compose.yml logs -f
```

---

## 3. Nginx Reverse Proxy Setup
These commands configure Nginx to route traffic from port 8081 to your Docker containers.

### Copy Configuration
```bash
sudo cp deployment/nginx-agentic-rag.conf /etc/nginx/sites-available/agentic-rag
```

### Enable the Site
```bash
sudo ln -s /etc/nginx/sites-available/agentic-rag /etc/nginx/sites-enabled/
```

### Test Configuration
```bash
sudo nginx -t
```

### Restart Nginx
```bash
sudo systemctl restart nginx
```

---

## 4. Verification & Health Checks
Run these to ensure each service is responding correctly.

### Check Backend Health
```bash
curl http://localhost:5001/health
```

### Check RAG Engine Health
```bash
curl http://localhost:8001/
```

---

## 5. Maintenance Commands

### Clear Temporary Uploads
```bash
sudo rm -rf deployment/temp_uploads/*
```

### Force Rebuild (if changes aren't showing up)
```bash
docker-compose -f deployment/docker-compose.yml build --no-cache
docker-compose -f deployment/docker-compose.yml up -d
```
