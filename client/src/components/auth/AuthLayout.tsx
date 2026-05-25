import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Mail, Lock, User, Loader2, ArrowRight, AlertCircle, Sun, Moon } from 'lucide-react';

interface AuthLayoutProps {
  loginMode: 'social' | 'email';
  setLoginMode: (mode: 'social' | 'email') => void;
  authAction: 'login' | 'register';
  setAuthAction: (action: 'login' | 'register') => void;
  authForm: any;
  setAuthForm: (form: any) => void;
  handleCredentialAuth: (e: React.FormEvent) => void;
  handleSocialLogin: (provider: string) => void;
  loading: boolean;
  authError: string;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  loginMode,
  setLoginMode,
  authAction,
  setAuthAction,
  authForm,
  setAuthForm,
  handleCredentialAuth,
  handleSocialLogin,
  loading,
  authError,
  theme,
  setTheme
}) => {
  return (
    <div className="flex h-screen w-full bg-white dark:bg-[#0a0a0b] overflow-hidden">
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#0a0a0b] items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/20 via-black to-slate-950/20" />
        <div className="absolute top-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-600/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[60%] h-[60%] bg-blue-600/5 blur-[120px] rounded-full" />
        
        <div className="relative z-10 max-w-xl text-center lg:text-left">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-4 mb-10 justify-center lg:justify-start"
          >
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-600/20 ring-1 ring-white/10">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <span className="text-3xl font-black tracking-tighter text-white italic">
              Research<span className="text-indigo-500">IQ</span>
            </span>
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl lg:text-7xl font-bold text-white mb-8 leading-[1.1] tracking-tight"
          >
            Your AI <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400">Research</span> Partner.
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-slate-400 leading-relaxed font-medium"
          >
            Accelerate your insights with a powerful agentic RAG system designed for deep analysis and document synthesis.
          </motion.p>
        </div>
      </div>

      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 relative bg-white dark:bg-[#0a0a0b]">
        {/* Global Theme Toggle for Auth Screens */}
        <div className="absolute top-8 right-8">
          <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shadow-sm group"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-500 group-hover:rotate-12 transition-transform" /> : <Moon className="w-5 h-5 text-indigo-500 group-hover:-rotate-12 transition-transform" />}
          </button>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="w-full max-w-md"
        >
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">Welcome back</h2>
            <p className="text-slate-600 dark:text-slate-400 font-medium">Continue your research journey</p>
          </div>

          <AnimatePresence mode="wait">
            {loginMode === 'social' ? (
              <motion.div
                key="social"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <button 
                  onClick={() => handleSocialLogin('google')}
                  className="w-full h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl flex items-center justify-center gap-4 text-slate-700 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm group"
                >
                  <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5 grayscale group-hover:grayscale-0 transition-all" />
                  Continue with Google
                </button>
                <button 
                  onClick={() => handleSocialLogin('github')}
                  className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl flex items-center justify-center gap-4 font-bold hover:opacity-90 transition-all shadow-sm"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
                  </svg>
                  Continue with GitHub
                </button>
                
                <div className="relative my-10">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-200 dark:border-slate-800"></div>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase font-bold tracking-widest">
                    <span className="bg-white dark:bg-[#0a0a0b] px-4 text-slate-500">Or use credentials</span>
                  </div>
                </div>

                <button 
                  onClick={() => setLoginMode('email')}
                  className="w-full h-14 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center gap-3 font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all"
                >
                  <Mail className="w-5 h-5" />
                  Continue with Email
                </button>
              </motion.div>
            ) : (
              <motion.div
                key="email"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <form onSubmit={handleCredentialAuth} className="space-y-5">
                  {authAction === 'register' && (
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Display Name</label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                        <input 
                          type="text"
                          required
                          value={authForm.displayName}
                          onChange={(e) => setAuthForm({...authForm, displayName: e.target.value})}
                          placeholder="Dr. Research"
                          className="w-full h-14 pl-12 pr-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Email Address</label>
                    <div className="relative group">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input 
                        type="email"
                        required
                        value={authForm.email}
                        onChange={(e) => setAuthForm({...authForm, email: e.target.value})}
                        placeholder="name@university.edu"
                        className="w-full h-14 pl-12 pr-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest px-1">Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                      <input 
                        type="password"
                        required
                        value={authForm.password}
                        onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                        placeholder="••••••••"
                        className="w-full h-14 pl-12 pr-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  {authError && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-sm font-semibold flex items-center gap-3"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      {authError}
                    </motion.div>
                  )}

                  <button 
                    disabled={loading}
                    type="submit"
                    className="w-full h-14 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl flex items-center justify-center gap-3 font-bold shadow-lg shadow-indigo-600/20 transition-all active:scale-[0.98] disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                      <>
                        {authAction === 'login' ? 'Sign In' : 'Create Account'}
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </button>

                  <div className="flex flex-col gap-4 mt-8">
                    <button 
                      type="button"
                      onClick={() => setAuthAction(authAction === 'login' ? 'register' : 'login')}
                      className="text-sm font-bold text-slate-600 dark:text-slate-400 hover:text-indigo-500 transition-colors"
                    >
                      {authAction === 'login' ? "New researcher? Create an account" : "Already have an account? Sign in"}
                    </button>
                    <button 
                      type="button"
                      onClick={() => setLoginMode('social')}
                      className="text-sm font-bold text-indigo-500 hover:text-indigo-400 transition-colors"
                    >
                      Back to social login
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
};
