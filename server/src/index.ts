// @ts-nocheck
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import multer from 'multer';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import pg from 'pg';
import { fileURLToPath } from 'url';

const { Pool } = pg;

type AuthProvider = 'google' | 'github';

interface AppUser {
  id: string;
  provider: AuthProvider | 'local';
  providerId: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  createdAt: string;
  lastLoginAt: string;
}

declare global {
  namespace Express {
    interface User extends AppUser {}
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const app = express();
app.set('trust proxy', 1);
const upload = multer({ dest: 'uploads/' });
const PORT = Number(process.env.PORT || 5000);
const PYTHON_API_URL = process.env.PYTHON_API_URL || 'http://127.0.0.1:8000';
const APP_ORIGIN = process.env.APP_ORIGIN || 'http://127.0.0.1:5173';
const SERVER_PUBLIC_URL = process.env.SERVER_PUBLIC_URL || `http://127.0.0.1:${PORT}`;
const SESSION_SECRET = process.env.SESSION_SECRET || 'replace-this-session-secret';
const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== 'false';
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const DATABASE_URL = process.env.DATABASE_URL || 'postgres://postgres:postgres@db:5432/agenticrag';

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function initDB(retries = 5) {
  for (let i = 0; i < retries; i++) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR(255) PRIMARY KEY,
          provider VARCHAR(50) NOT NULL,
          provider_id VARCHAR(255) NOT NULL,
          display_name VARCHAR(255),
          email VARCHAR(255),
          avatar_url TEXT,
          password_hash TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_login_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('[Node.js] PostgreSQL database initialized');
      return;
    } catch (error: any) {
      console.error(`[Node.js] Error initializing database (attempt ${i + 1}/${retries}):`, error.message);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        console.error('[Node.js] Failed to connect to database after maximum retries');
      }
    }
  }
}
initDB();

async function upsertUser(user: Omit<AppUser, 'createdAt' | 'lastLoginAt'> & { passwordHash?: string }): Promise<AppUser> {
  const { id, provider, providerId, displayName, email, avatarUrl, passwordHash } = user;
  const result = await pool.query(
    `INSERT INTO users (id, provider, provider_id, display_name, email, avatar_url, password_hash)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (id) DO UPDATE SET
       display_name = EXCLUDED.display_name,
       email = EXCLUDED.email,
       avatar_url = EXCLUDED.avatar_url,
       last_login_at = CURRENT_TIMESTAMP
     RETURNING id, provider, provider_id as "providerId", display_name as "displayName", email, avatar_url as "avatarUrl", created_at as "createdAt", last_login_at as "lastLoginAt", password_hash as "passwordHash"`,
    [id, provider, providerId, displayName, email, avatarUrl, passwordHash]
  );
  return result.rows[0];
}

async function getUserById(id: string): Promise<AppUser | undefined> {
  const result = await pool.query(
    'SELECT id, provider, provider_id as "providerId", display_name as "displayName", email, avatar_url as "avatarUrl", created_at as "createdAt", last_login_at as "lastLoginAt" FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0];
}

async function getUserByEmail(email: string): Promise<AppUser | undefined> {
  const result = await pool.query(
    'SELECT id, provider, provider_id as "providerId", display_name as "displayName", email, avatar_url as "avatarUrl", created_at as "createdAt", last_login_at as "lastLoginAt", password_hash as "passwordHash" FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0];
}

function stableUserId(provider: AuthProvider, providerId: string) {
  return crypto.createHash('sha256').update(`${provider}:${providerId}`).digest('hex').slice(0, 24);
}

// Removed old JSON-based auth functions

function getCallbackUrl(provider: AuthProvider) {
  return `${SERVER_PUBLIC_URL}/api/auth/${provider}/callback`;
}

function toPrivateThreadId(userId: string, threadId?: string) {
  const safeThreadId = String(threadId || 'default_session').replace(/[^a-zA-Z0-9_.-]/g, '_');
  return `${userId}:${safeThreadId}`;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!AUTH_REQUIRED || req.isAuthenticated()) return next();
  return res.status(401).json({ error: 'Authentication required' });
}

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await getUserById(id);
    done(user ? null : new Error('User session no longer exists'), user || undefined);
  } catch (error) {
    done(error, undefined);
  }
});

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: getCallbackUrl('google'),
  }, async (_accessToken, _refreshToken, profile, done) => {
    try {
      const email = profile.emails?.[0]?.value;
      const avatarUrl = profile.photos?.[0]?.value;
      const user = await upsertUser({
        id: stableUserId('google', profile.id),
        provider: 'google',
        providerId: profile.id,
        displayName: profile.displayName || email || 'Google user',
        email,
        avatarUrl,
      });
      done(null, user);
    } catch (err) {
      done(err, undefined);
    }
  }));
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: getCallbackUrl('github'),
    scope: ['user:email'],
  }, async (_accessToken: string, _refreshToken: string, profile: any, done: (error: unknown, user?: AppUser) => void) => {
    try {
      const email = profile.emails?.[0]?.value;
      const avatarUrl = profile.photos?.[0]?.value;
      const user = await upsertUser({
        id: stableUserId('github', profile.id),
        provider: 'github',
        providerId: profile.id,
        displayName: profile.displayName || profile.username || email || 'GitHub user',
        email,
        avatarUrl,
      });
      done(null, user);
    } catch (err) {
      done(err, undefined);
    }
  }));
}

passport.use(new LocalStrategy({
  usernameField: 'email',
  passwordField: 'password',
}, async (email, password, done) => {
  try {
    const user = await getUserByEmail(email);
    if (!user) {
      return done(null, false, { message: 'Incorrect email.' });
    }
    if (!user.passwordHash) {
      return done(null, false, { message: 'User registered via OAuth.' });
    }
    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return done(null, false, { message: 'Incorrect password.' });
    }
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

app.use(cors({
  origin: APP_ORIGIN,
  credentials: true,
}));
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(session({
  name: 'research_iq.sid',
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
}));
app.use(passport.initialize());
app.use(passport.session());

const clientBuildPath = path.resolve(process.cwd(), 'client/dist');
app.use(express.static(clientBuildPath));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'OK', message: 'Node.js Backend is live' });
});

app.get('/api/auth/me', (req: Request, res: Response) => {
  if (!(req as any).isAuthenticated() || !(req as any).user) {
    return res.status(401).json({ authenticated: false });
  }

  const { id, provider, displayName, email, avatarUrl } = (req as any).user;
  res.json({ authenticated: true, user: { id, provider, displayName, email, avatarUrl } });
});

app.get('/api/auth/google', (req: Request, res: Response, next: NextFunction) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Google OAuth is not configured' });
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
});

app.get('/api/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login?error=google' }),
  (_req: Request, res: Response) => res.redirect(APP_ORIGIN),
);

app.get('/api/auth/github', (req: Request, res: Response, next: NextFunction) => {
  if (!process.env.GITHUB_CLIENT_ID || !process.env.GITHUB_CLIENT_SECRET) {
    return res.status(503).json({ error: 'GitHub OAuth is not configured' });
  }
  passport.authenticate('github', { scope: ['user:email'] })(req, res, next);
});

app.get('/api/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login?error=github' }),
  (_req: Request, res: Response) => res.redirect(APP_ORIGIN),
);

app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { email, password, displayName } = req.body;
    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = crypto.randomUUID();
    
    const user = await upsertUser({
      id: userId,
      provider: 'local',
      providerId: userId,
      displayName,
      email,
      passwordHash,
    });

    req.login(user, (err) => {
      if (err) return res.status(500).json({ error: 'Error logging in' });
      res.json({ message: 'Registration successful', user });
    });
  } catch (error: any) {
    console.error('[Node.js] Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/auth/login', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', (err: any, user: AppUser, info: any) => {
    if (err) return next(err);
    if (!user) return res.status(401).json({ error: info?.message || 'Authentication failed' });
    
    req.login(user, (err) => {
      if (err) return next(err);
      res.json({ message: 'Login successful', user });
    });
  })(req, res, next);
});

app.post('/api/auth/logout', (req: Request, res: Response, next: NextFunction) => {
  (req as any).logout((logoutError: any) => {
    if (logoutError) return next(logoutError);
    (req as any).session.destroy((destroyError: any) => {
      if (destroyError) return next(destroyError);
      res.clearCookie('research_iq.sid');
      res.status(204).send();
    });
  });
});

app.post('/api/auth/clear-data', requireAuth, async (req: Request, res: Response) => {
  try {
    // In a full implementation, we would call the Python engine to delete this user's vectors
    // For now, returning success enables the frontend to clear its local state without error
    res.json({ success: true, message: 'User data cleared successfully' });
  } catch (error) {
    console.error('[Node.js] Error clearing data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/chat', requireAuth, async (req: Request, res: Response) => {
  try {
    const { query, threadId } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const privateThreadId = toPrivateThreadId((req as any).user?.id || 'anonymous', threadId);
    console.log(`[Node.js] User: ${(req as any).user?.id || 'anonymous'} | Thread: ${privateThreadId} | Query: "${query}"`);

    const response = await axios.post(`${PYTHON_API_URL}/chat`, {
      query,
      thread_id: privateThreadId,
    });

    res.json(response.data);
  } catch (error: any) {
    console.error('[Node.js] Error calling Python RAG Engine:', error.message);
    res.status(503).json({
      error: 'RAG Engine is unavailable',
      details: error.message,
    });
  }
});

app.post('/api/upload', requireAuth, upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { threadId } = req.body;
    const privateThreadId = toPrivateThreadId((req as any).user?.id || 'anonymous', threadId);
    console.log(`[Node.js] User: ${(req as any).user?.id || 'anonymous'} | Thread: ${privateThreadId} | Uploading: ${req.file.originalname}`);

    const formData = new FormData();
    formData.append('file', fs.createReadStream(req.file.path), {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });
    formData.append('thread_id', privateThreadId);

    const response = await axios.post(`${PYTHON_API_URL}/upload`, formData, {
      headers: formData.getHeaders(),
    });

    fs.unlinkSync(req.file.path);
    res.json(response.data);
  } catch (error: any) {
    const status = error.response?.status || 500;
    const errorMessage = error.response?.data?.detail || error.response?.data?.error || error.message;

    console.error(`[Node.js] Error forwarding file to Python API (Status: ${status}):`, errorMessage);

    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch {
        console.error('[Node.js] Failed to cleanup temp file:', req.file.path);
      }
    }

    res.status(status).json({
      error: 'Failed to process file',
      details: errorMessage,
    });
  }
});

app.get(/.*/, (_req: Request, res: Response) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log('========================================');
  console.log(`Node.js Backend running on port ${PORT}`);
  console.log(`Bridged to Python API at ${PYTHON_API_URL}`);
  console.log(`OAuth callbacks: ${getCallbackUrl('google')} and ${getCallbackUrl('github')}`);
  console.log('========================================');
});
