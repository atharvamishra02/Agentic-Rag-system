from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from dotenv import load_dotenv
import os

# Load environment variables at the very beginning
load_dotenv()

from agent import run_agent
from document_loader import load_document
from vector_store import get_text_chunks, update_vector_store
import shutil
import cloudinary
import cloudinary.uploader
from cloudinary.utils import cloudinary_url

# Configure Cloudinary
cloudinary.config( 
  cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"), 
  api_key = os.getenv("CLOUDINARY_API_KEY"), 
  api_secret = os.getenv("CLOUDINARY_API_SECRET"),
  secure = True
)

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Agentic RAG API")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "OK", "message": "Agentic RAG Engine is live"}

class QueryRequest(BaseModel):
    query: str
    thread_id: str = "default_session"

@app.post("/chat")
async def chat(request: QueryRequest):
    try:
        # Calls our Phase 7 Context-Aware Agent — returns full dict with metadata
        result = run_agent(request.query, thread_id=request.thread_id)
        return result
    except Exception as e:
        print(f"Error in /chat: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload")
async def upload_file(file: UploadFile = File(...), thread_id: str = Form(None)):
    file_path = None
    try:
        # 1. Save temp file
        temp_dir = "temp_uploads"
        os.makedirs(temp_dir, exist_ok=True)
        file_path = os.path.join(temp_dir, file.filename)
        
        print(f"[API] Received file: {file.filename} (Session: {thread_id})")
        
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 2. Upload to Cloudinary for production storage
        cloudinary_file_url = None
        try:
            print(f"[Cloudinary] Uploading {file.filename}...")
            upload_result = cloudinary.uploader.upload(file_path, resource_type="raw")
            cloudinary_file_url = upload_result.get("secure_url")
            print(f"[Cloudinary] Success! URL: {cloudinary_file_url}")
        except Exception as cloud_err:
            print(f"[Cloudinary Warning] Upload failed, proceeding without Cloudinary URL: {cloud_err}")

        # 3. Process with existing RAG logic
        docs = load_document(file_path)
        chunks = get_text_chunks(docs, thread_id=thread_id, file_url=cloudinary_file_url)
        
        if not chunks:
            return {"message": f"Successfully processed {file.filename}, but no text could be extracted."}
            
        update_vector_store(chunks)
        
        return {"message": f"Successfully indexed {file.filename}"}
    except Exception as e:
        print(f"Error in /upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # 4. Cleanup
        if file_path and os.path.exists(file_path):
            os.remove(file_path)

if __name__ == "__main__":
    import uvicorn
    # Start the API on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
