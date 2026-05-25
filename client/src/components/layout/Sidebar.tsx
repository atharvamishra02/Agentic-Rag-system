import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Plus, Trash2, FileUp, Loader2, X } from 'lucide-react';

interface ChatSession {
  id: string;
  title: string;
  messages: any[];
  timestamp: number;
}

interface SidebarProps {
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  sessions: ChatSession[];
  activeSessionId: string;
  setActiveSessionId: (id: string) => void;
  createNewSession: () => void;
  deleteSession: (e: React.MouseEvent, id: string) => void;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isSidebarOpen,
  setIsSidebarOpen,
  sessions,
  activeSessionId,
  setActiveSessionId,
  createNewSession,
  deleteSession,
  uploading,
  fileInputRef
}) => {
  return (
    <motion.aside 
      initial={false}
      animate={{ 
        width: isSidebarOpen ? (window.innerWidth <= 768 ? '100%' : '320px') : '0px',
        opacity: isSidebarOpen ? 1 : 0
      }}
      className={`fixed md:relative z-40 h-full bg-white dark:bg-[#0a0a0b] border-r border-slate-200 dark:border-slate-800/50 flex flex-col overflow-hidden transition-all duration-300 ${!isSidebarOpen ? 'pointer-events-none' : ''}`}
    >
      <div className="p-6 flex flex-col h-full min-w-[320px]">
        <div className="flex items-center justify-between mb-10 px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white italic">
              Research<span className="text-indigo-500">IQ</span>
            </span>
          </div>
          
          <button 
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <button 
          onClick={createNewSession}
          className="w-full py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl text-slate-900 dark:text-white text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 transition-all flex items-center justify-center gap-2 mb-8 shadow-sm group active:scale-[0.98]"
        >
          <Plus className="w-4 h-4 text-indigo-500 group-hover:rotate-90 transition-transform duration-300" />
          New Research Thread
        </button>

        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4 px-2">Recent Threads</p>
          {sessions.map(session => (
            <div 
              key={session.id}
              onClick={() => setActiveSessionId(session.id)}
              className={`group flex items-center gap-3 px-4 py-3.5 rounded-xl cursor-pointer transition-all border ${
                activeSessionId === session.id 
                  ? 'bg-indigo-600/10 border-indigo-600/20 text-indigo-500' 
                  : 'border-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900/50'
              }`}
            >
              <div className="truncate text-xs font-medium flex-1">{session.title}</div>
              <button 
                onClick={(e) => deleteSession(e, session.id)}
                className={`p-1.5 rounded-lg hover:bg-red-500/20 hover:text-red-400 transition-all ${window.innerWidth <= 768 ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-800">
           <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-800">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400 mb-3">Knowledge Base</p>
              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileUp className="w-3.5 h-3.5" />}
                {uploading ? 'Indexing...' : 'Upload Sources'}
              </button>
           </div>
        </div>
      </div>
    </motion.aside>
  );
};
