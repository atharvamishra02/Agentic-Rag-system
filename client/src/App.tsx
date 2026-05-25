import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';

// Component Imports
import { AuthLayout } from './components/auth/AuthLayout';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { ChatWindow } from './components/chat/ChatWindow';
import { ToastContainer } from './components/ui/ToastContainer';

// Types
interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  provider: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  evidence?: Array<{ content: string, source: string, page: number }>;
  faithfulness?: number;
  relevancy?: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

function App() {
  // --- State ---
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string>('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string>('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(window.innerWidth > 768);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [uploading, setUploading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loginMode, setLoginMode] = useState<'social' | 'email'>('social');
  const [authAction, setAuthAction] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '', displayName: '' });
  const [authError, setAuthError] = useState('');
  const [toasts, setToasts] = useState<{id: string, message: string, type: 'success' | 'error' | 'info'}[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark') || 'dark';
    }
    return 'dark';
  });

  // --- Refs ---
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Derived State ---
  const activeSession = sessions.find(s => s.id === activeSessionId);
  const messages = activeSession?.messages || [];
  const sessionStorageKey = user ? `research_iq_sessions:${user.id}` : '';

  // --- Effects ---
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    axios.get('/api/auth/me')
      .then((response) => {
        setUser(response.data.user);
      })
      .catch(() => {
        setUser(null);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  useEffect(() => {
    if (user && sessionStorageKey) {
      const saved = localStorage.getItem(sessionStorageKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setSessions(parsed);
          if (parsed.length > 0) setActiveSessionId(parsed[0].id);
        } catch (e) {
          console.error("Failed to parse sessions", e);
        }
      } else {
        createNewSession();
      }
    }
  }, [user, sessionStorageKey]);

  useEffect(() => {
    if (user && sessionStorageKey && sessions.length > 0) {
      localStorage.setItem(sessionStorageKey, JSON.stringify(sessions));
    }
  }, [sessions, user, sessionStorageKey]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setIsSidebarOpen(true);
      } else {
        if (window.innerWidth <= 768) setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // --- Handlers ---
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  const handleSocialLogin = (provider: string) => {
    window.location.href = `/api/auth/${provider}`;
  };

  const handleCredentialAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);
    try {
      const endpoint = authAction === 'login' ? '/api/auth/login' : '/api/auth/register';
      const response = await axios.post(endpoint, authForm);
      
      if (authAction === 'login') {
        setUser(response.data.user);
      } else {
        showToast("Registration successful! Please log in.");
        setAuthAction('login');
      }
    } catch (err: any) {
      setAuthError(err.response?.data?.detail || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await axios.post('/api/auth/logout');
    if (sessionStorageKey) {
      localStorage.removeItem(sessionStorageKey);
    }
    setUser(null);
    setSessions([]);
    setActiveSessionId('');
    setConfirmDeleteId(null);
  };

  const createNewSession = () => {
    const newId = Date.now().toString();
    setSessions(prev => {
      const newSession: ChatSession = {
        id: newId,
        title: `Research Session ${prev.length + 1}`,
        messages: [],
        timestamp: Date.now()
      };
      return [newSession, ...prev];
    });
    setActiveSessionId(newId);
    if (isMobile) setIsSidebarOpen(false);
  };

  const handleSend = async () => {
    if (!input.trim() || loading || !activeSessionId) return;

    const userMessage: Message = { role: 'user', content: input };
    const updatedMessages = [...messages, userMessage];
    
    setSessions(prev => prev.map(s => {
      if (s.id === activeSessionId) {
        const isDefaultTitle = s.title.startsWith('Research Session');
        const newTitle = isDefaultTitle && s.messages.length === 0 
          ? (input.length > 30 ? input.substring(0, 30) + '...' : input)
          : s.title;
        return { ...s, title: newTitle, messages: updatedMessages };
      }
      return s;
    }));
    
    const queryToSubmit = input;
    setInput('');
    setLoading(true);
    setAgentStatus('Planner Agent: Decomposing query...');

    try {
      // Simulate multi-agent steps for UI feedback
      setTimeout(() => setAgentStatus('Researcher Agent: Retrieving semantic chunks...'), 1500);
      setTimeout(() => setAgentStatus('Auditor Agent: Verifying faithfulness...'), 4000);

      const response = await axios.post('/api/chat', { 
        query: queryToSubmit,
        threadId: activeSessionId,
        history: messages.map(m => ({ role: m.role, content: m.content }))
      });
      
      const { response: botResponse, confidence, citations, evidence, faithfulness, relevancy } = response.data;
      setAgentStatus('Synthesizer Agent: Finalizing research report...');
      let enhancedContent = botResponse;
      if (confidence) enhancedContent += `\n\n🎯 **Confidence**: ${(confidence * 100).toFixed(1)}%`;
      if (citations?.length > 0) enhancedContent += `\n\n📚 **Verified Sources**: ${citations.map((c: any) => `[${c.source}]`).join(', ')}`;

      const botMessage: Message = { 
        role: 'assistant', 
        content: enhancedContent,
        evidence: evidence,
        faithfulness: faithfulness,
        relevancy: relevancy
      };
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, messages: [...s.messages, botMessage] } : s
      ));
    } catch (error) {
      console.error('Error:', error);
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, messages: [...s.messages, { 
          role: 'assistant', 
          content: "I encountered an error analyzing that. Please try again." 
        }] } : s
      ));
    } finally {
      setLoading(false);
      setAgentStatus('');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSessionId) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('threadId', activeSessionId);

    try {
      await axios.post('/api/upload', formData);
      showToast(`Document "${file.name}" indexed successfully!`);
    } catch (error) {
      showToast("Failed to upload document", "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const onDeleteSession = (sessionId: string) => {
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(updatedSessions);
    if (activeSessionId === sessionId) {
      if (updatedSessions.length > 0) {
        setActiveSessionId(updatedSessions[0].id);
      } else {
        if (sessionStorageKey) localStorage.removeItem(sessionStorageKey);
        createNewSession();
      }
    }
    setConfirmDeleteId(null);
    showToast("Research thread deleted", "info");
  };

  const onClearAll = async () => {
    try {
      await axios.post('/api/auth/clear-data');
      if (sessionStorageKey) localStorage.removeItem(sessionStorageKey);
      setSessions([]);
      setActiveSessionId('');
      setConfirmClearAll(false);
      createNewSession();
      showToast("All research data cleared", "success");
    } catch (err) {
      showToast("Failed to clear server data", "error");
    }
  };

  const handleExportBrief = () => {
    if (!activeSession || activeSession.messages.length === 0) {
      showToast("No research content to export", "info");
      return;
    }
    
    let content = `# Research Brief: ${activeSession.title}\n\n`;
    content += `*Generated by ResearchIQ on ${new Date().toLocaleString()}*\n\n---\n\n`;
    
    activeSession.messages.forEach(msg => {
      content += `### ${msg.role === 'user' ? 'Question' : 'Research Analysis'}\n\n`;
      content += `${msg.content}\n\n---\n\n`;
    });
    
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Research_Brief_${activeSession.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast("Research Brief exported successfully!", "success");
  };

  // --- Rendering ---
  if (authLoading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0a0a0b]">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
          <Loader2 className="w-12 h-12 text-indigo-500" />
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthLayout 
        loginMode={loginMode} setLoginMode={setLoginMode}
        authAction={authAction} setAuthAction={setAuthAction}
        authForm={authForm} setAuthForm={setAuthForm}
        handleCredentialAuth={handleCredentialAuth}
        handleSocialLogin={handleSocialLogin}
        loading={loading} authError={authError}
        theme={theme} setTheme={setTheme}
      />
    );
  }

  return (
    <div className="flex h-dvh w-full bg-white dark:bg-[#0a0a0b] text-slate-900 dark:text-slate-200 overflow-hidden font-sans selection:bg-indigo-500/30 relative">
      <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden" accept=".pdf,.txt,.docx" />
      
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && isMobile && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
          />
        )}
      </AnimatePresence>

      <Sidebar 
        isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} sessions={sessions}
        activeSessionId={activeSessionId} setActiveSessionId={setActiveSessionId}
        createNewSession={createNewSession}
        deleteSession={(e: React.MouseEvent, id: string) => { e.stopPropagation(); setConfirmDeleteId(id); }}
        uploading={uploading} fileInputRef={fileInputRef as React.RefObject<HTMLInputElement>}
      />

      <main className="flex-[1_1_0%] flex flex-col relative bg-gradient-to-br from-white to-slate-50 dark:from-[#0a0a0b] dark:to-[#121214] min-w-0 w-full h-full min-h-0">
        <Header 
          user={user} isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen}
          isProfileMenuOpen={isProfileMenuOpen} setIsProfileMenuOpen={setIsProfileMenuOpen}
          activeSessionTitle={activeSession?.title}
          theme={theme} setTheme={setTheme}
          handleLogout={handleLogout}
          setConfirmClearAll={setConfirmClearAll}
          handleExportBrief={handleExportBrief}
        />

        <ChatWindow 
          messages={messages} 
          loading={loading}
          agentStatus={agentStatus}
          input={input} 
          setInput={setInput}
          handleSend={handleSend} 
          scrollRef={scrollRef as React.RefObject<HTMLDivElement>}
        />
      </main>

      <ToastContainer 
        toasts={toasts} setToasts={setToasts}
        confirmDeleteId={confirmDeleteId} setConfirmDeleteId={setConfirmDeleteId}
        confirmClearAll={confirmClearAll} setConfirmClearAll={setConfirmClearAll}
        onDeleteSession={onDeleteSession} onClearAll={onClearAll}
      />
    </div>
  );
}

export default App;
