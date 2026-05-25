import os
import sqlite3
import jwt
import datetime
from passlib.context import CryptContext
from typing import Optional, Dict

# Security Configuration
SECRET_KEY = os.getenv("SESSION_SECRET", "research_iq_ultra_secret_key_99")
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

DB_PATH = "users.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE,
            password_hash TEXT,
            display_name TEXT,
            provider TEXT DEFAULT 'credentials'
        )
    ''')
    conn.commit()
    conn.close()

def get_password_hash(password):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(days=7)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_user_by_email(email: str) -> Optional[Dict]:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE email = ?", (email,))
    user = cursor.fetchone()
    conn.close()
    return dict(user) if user else None

def register_user(email, password, display_name):
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        user_id = str(datetime.datetime.now().timestamp()).replace('.', '')
        cursor.execute(
            "INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)",
            (user_id, email, get_password_hash(password), display_name)
        )
        conn.commit()
        conn.close()
        return user_id
    except sqlite3.IntegrityError:
        return None

# Initialize the database on load
init_db()
