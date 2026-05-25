import uuid
import os
import shutil
import json
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Request, Depends
from fastapi.responses import RedirectResponse, JSONResponse
from starlette.middleware.sessions import SessionMiddleware
from authlib.integrations.starlette_client import OAuth
from pydantic import BaseModel
from rag_engine import answer_query
from document_loader import load_document
from vector_store import get_text_chunks, update_vector_store
import cloudinary
import cloudinary.uploader
from dotenv import load_dotenv

from auth_utils import get_user_by_email, register_user, verify_password, create_access_token
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

# Allow insecure transport for local dev (OAuth over HTTP)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'

app = FastAPI(title="ResearchIQ Agentic RAG")

# CORS Configuration for Auth
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("APP_ORIGIN", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Secure Session Management
app.add_middleware(SessionMiddleware, secret_key=os.getenv("SESSION_SECRET", "default_secret_change_me"))

# OAuth Configuration
oauth = OAuth()
oauth.register(
    name='google',
    client_id=os.getenv("GOOGLE_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_CLIENT_SECRET"),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={'scope': 'openid email profile'}
)
oauth.register(
    name='github',
    client_id=os.getenv("GITHUB_CLIENT_ID"),
    client_secret=os.getenv("GITHUB_CLIENT_SECRET"),
    access_token_url='https://github.com/login/oauth/access_token',
    authorize_url='https://github.com/login/oauth/authorize',
    api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'user:email'}
)

# Cloudinary Setup
cloudinary.config( 
  cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME"), 
  api_key = os.getenv("CLOUDINARY_API_KEY"), 
  api_secret = os.getenv("CLOUDINARY_API_SECRET"),
  secure = True
)

class QueryRequest(BaseModel):
    query: str
    threadId: str
    history: Optional[list] = []

class AuthRequest(BaseModel):
    email: str
    password: str
    displayName: Optional[str] = None

# --- Authentication Helpers ---

async def get_current_user(request: Request):
    # 1. Check Session (OAuth)
    user = request.session.get('user')
    if user:
        return user
    
    # 2. Check JWT (Credentials)
    token = request.cookies.get("access_token")
    if token:
        try:
            import jwt
            from auth_utils import SECRET_KEY, ALGORITHM
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            return payload
        except Exception:
            pass
            
    return None

@app.get("/api/auth/me")
async def get_me(user=Depends(get_current_user)):
    if not user:
        return JSONResponse(status_code=401, content={"user": None})
    return {"user": user}

@app.post("/api/auth/register")
async def register(auth: AuthRequest):
    if get_user_by_email(auth.email):
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = register_user(auth.email, auth.password, auth.displayName or auth.email.split('@')[0])
    if not user_id:
        raise HTTPException(status_code=500, detail="Registration failed")
    
    return {"message": "User registered successfully"}

@app.post("/api/auth/login")
async def login_credentials(auth: AuthRequest):
    user = get_user_by_email(auth.email)
    if not user or not verify_password(auth.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token_data = {
        "id": user['id'],
        "provider": "credentials",
        "displayName": user['display_name'],
        "email": user['email']
    }
    token = create_access_token(token_data)
    
    response = JSONResponse(content={"user": token_data})
    response.set_cookie(
        key="access_token", 
        value=token, 
        httponly=True, 
        max_age=604800, # 7 days
        samesite="lax"
    )
    return response

@app.get("/api/auth/{provider}")
async def login(provider: str, request: Request):
    if provider not in ['google', 'github']:
        raise HTTPException(status_code=400, detail="Invalid provider")
    # Force localhost for local consistency
    redirect_uri = f"http://localhost:8000/api/auth/callback/{provider}"
    print(f"   [OAuth] Initiating {provider} login. Redirect URI: {redirect_uri}")
    return await oauth.create_client(provider).authorize_redirect(request, redirect_uri)

@app.get("/api/auth/callback/{provider}", name="auth_callback")
async def auth_callback(provider: str, request: Request):
    try:
        client = oauth.create_client(provider)
        token = await client.authorize_access_token(request)
        
        user_data = {}
        if provider == 'google':
            user_info = token.get('userinfo')
            if not user_info:
                # Fallback if userinfo is missing from token
                resp = await client.get('https://openidconnect.googleapis.com/v1/userinfo', token=token)
                user_info = resp.json()
                
            user_data = {
                "id": user_info['sub'],
                "provider": "google",
                "displayName": user_info.get('name'),
                "email": user_info.get('email'),
                "avatarUrl": user_info.get('picture')
            }
        elif provider == 'github':
            resp = await client.get('user', token=token)
            user_info = resp.json()
            user_data = {
                "id": str(user_info['id']),
                "provider": "github",
                "displayName": user_info.get('name') or user_info.get('login'),
                "email": user_info.get('email'),
                "avatarUrl": user_info.get('avatar_url')
            }
        
        request.session['user'] = user_data
        return RedirectResponse(url=os.getenv("APP_ORIGIN", "http://localhost:5173"))
    except Exception as e:
        print(f"[OAuth Error] Provider: {provider}, Detail: {e}")
        raise HTTPException(status_code=500, detail=f"Authentication failed: {str(e)}")

@app.post("/api/auth/logout")
async def logout(request: Request):
    request.session.pop('user', None)
    response = JSONResponse(content={"message": "Logged out"})
    response.delete_cookie("access_token")
    return response

@app.post("/api/auth/clear-data")
async def clear_data(user=Depends(get_current_user)):
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    from vector_store import clear_user_data
    success = clear_user_data(user.get("id"))
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to clear vector data")
        
    return {"message": "All user research data cleared successfully"}

# --- RAG Endpoints ---

@app.post("/api/chat")
async def chat_endpoint(request: QueryRequest, user=Depends(get_current_user)):
    if os.getenv("AUTH_REQUIRED") == "true" and not user:
        raise HTTPException(status_code=401, detail="Authentication required")
        
    try:
        user_id = user.get("id") if user else "anonymous"
        result = answer_query(
            request.query, 
            thread_id=request.threadId, 
            user_id=user_id,
            chat_history=request.history
        )
        return {
            "response": result.get("answer"),
            "confidence": result.get("confidence"),
            "faithfulness": result.get("faithfulness"),
            "relevancy": result.get("relevancy"),
            "citations": result.get("citations", []),
            "evidence": result.get("evidence", [])
        }
    except Exception as e:
        print(f"[Error] Chat failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/upload")
async def upload_endpoint(file: UploadFile = File(...), threadId: str = Form(None), user=Depends(get_current_user)):
    if os.getenv("AUTH_REQUIRED") == "true" and not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    file_path = None
    try:
        user_id = user.get("id") if user else "anonymous"
        temp_dir = "temp_uploads"
        os.makedirs(temp_dir, exist_ok=True)
        file_path = os.path.join(temp_dir, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        upload_result = cloudinary.uploader.upload(file_path, resource_type="raw")
        cloudinary_file_url = upload_result.get("secure_url")

        docs = load_document(file_path)
        chunks = get_text_chunks(docs, thread_id=threadId, file_url=cloudinary_file_url, user_id=user_id)
        if chunks:
            update_vector_store(chunks)
        
        return {"message": f"Document '{file.filename}' indexed successfully for user {user_id}."}
    except Exception as e:
        print(f"[Error] Upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if file_path and os.path.exists(file_path):
            os.remove(file_path)

@app.get("/health")
async def health_check():
    return {"status": "healthy", "engine": "autonomous-agentic-rag-v1"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
