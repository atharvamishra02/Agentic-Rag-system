import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Sun, Moon, LogOut, Sparkles } from 'lucide-react';

interface AuthUser {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  provider: string;
}

interface HeaderProps {
  user: AuthUser;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isProfileMenuOpen: boolean;
  setIsProfileMenuOpen: (open: boolean) => void;
  activeSessionTitle?: string;
  theme: 'light' | 'dark';
  setTheme: (theme: 'light' | 'dark') => void;
  handleLogout: () => void;
  setConfirmClearAll: (open: boolean) => void;
  handleExportBrief: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  isSidebarOpen,
  setIsSidebarOpen,
  isProfileMenuOpen,
  setIsProfileMenuOpen,
  activeSessionTitle,
  theme,
  setTheme,
  handleLogout,
  setConfirmClearAll,
  handleExportBrief
}) => {
  return (
    <div className="flex items-center px-4 h-16 border-b border-slate-200 dark:border-slate-800/50 bg-white dark:bg-[#0a0a0b]/50 backdrop-blur-xl sticky top-0 z-20">
      <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="p-2 mr-4 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-slate-100 dark:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400">
        <LayoutDashboard className="w-5 h-5" />
      </button>
      <div className="flex-1 text-center pr-4">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 truncate max-w-[200px] md:max-w-none mx-auto">
          {activeSessionTitle || 'No Session Selected'}
        </p>
      </div>

      <button 
        onClick={handleExportBrief}
        className="hidden md:flex items-center gap-2 px-3 py-1.5 mr-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 rounded-lg text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all shadow-sm active:scale-95"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
        Export Brief
      </button>
      
      {/* Profile Dropdown */}
      <div className="relative">
        <button 
          onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
          className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-600/20 hover:scale-105 transition-all active:scale-95"
        >
          {user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
        </button>

        <AnimatePresence>
          {isProfileMenuOpen && (
            <>
              <div className="fixed inset-0 z-[60] bg-transparent cursor-default" onClick={() => setIsProfileMenuOpen(false)} />
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute right-0 mt-3 w-48 bg-white dark:bg-[#161618] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl z-[70] overflow-hidden"
              >
                <div className="p-4 border-b border-slate-100 dark:border-slate-800">
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Signed in as</p>
                  <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{user?.displayName || user?.email}</p>
                </div>

                <div className="p-2">

                  
                  <button 
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-xl transition-colors group"
                  >
                    {theme === 'dark' ? (
                      <>
                        <Sun className="w-4 h-4 text-amber-500" />
                        Light Mode
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4 text-indigo-400" />
                        Dark Mode
                      </>
                    )}
                  </button>

                  <div className="my-2 border-t border-slate-100 dark:border-slate-800" />

                  <button 
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      setConfirmClearAll(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-amber-500 hover:bg-amber-500/10 rounded-xl transition-colors group"
                  >
                    <Sparkles className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    Clear All History
                  </button>

                  <button 
                    onClick={() => {
                      setIsProfileMenuOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-bold text-red-500 hover:bg-red-500/10 rounded-xl transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
