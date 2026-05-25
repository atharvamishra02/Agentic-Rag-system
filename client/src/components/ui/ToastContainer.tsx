import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, Database, CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

interface ToastContainerProps {
  toasts: Toast[];
  setToasts: React.Dispatch<React.SetStateAction<Toast[]>>;
  confirmDeleteId: string | null;
  setConfirmDeleteId: (id: string | null) => void;
  confirmClearAll: boolean;
  setConfirmClearAll: (open: boolean) => void;
  onDeleteSession: (sessionId: string) => void;
  onClearAll: () => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  setToasts,
  confirmDeleteId,
  setConfirmDeleteId,
  confirmClearAll,
  setConfirmClearAll,
  onDeleteSession,
  onClearAll
}) => {
  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none items-end">
      <AnimatePresence>
        {confirmDeleteId && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            className="pointer-events-auto bg-[#161618] border border-red-500/20 p-5 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl min-w-[320px] mb-2"
          >
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center shrink-0">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white mb-1">Delete Thread?</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">Confirm you want to delete this research thread. This action is permanent.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => onDeleteSession(confirmDeleteId)}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg shadow-red-600/20"
              >
                Yes, Delete
              </button>
              <button 
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-700 active:scale-95"
              >
                No, Keep it
              </button>
            </div>
          </motion.div>
        )}

        {confirmClearAll && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20, x: 20 }}
            className="pointer-events-auto bg-[#161618] border border-amber-500/20 p-5 rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl min-w-[320px] mb-2"
          >
            <div className="flex items-start gap-4 mb-5">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center shrink-0">
                <Database className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h4 className="text-base font-bold text-white mb-1">Clear All Data?</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">This will permanently delete all your research sessions and local data. This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={onClearAll}
                className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all active:scale-95 shadow-lg shadow-amber-600/20"
              >
                Yes, Clear All
              </button>
              <button 
                onClick={() => setConfirmClearAll(false)}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-700 active:scale-95"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            layout
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
            className="pointer-events-auto"
          >
            <div className={`px-4 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-3 min-w-[300px] ${
              toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
              toast.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' :
              'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                toast.type === 'success' ? 'bg-emerald-500/20' :
                toast.type === 'error' ? 'bg-red-500/20' :
                'bg-indigo-500/20'
              }`}>
                {toast.type === 'success' && <CheckCircle2 className="w-4 h-4" />}
                {toast.type === 'error' && <AlertCircle className="w-4 h-4" />}
                {toast.type === 'info' && <Info className="w-4 h-4" />}
              </div>
              <p className="text-sm font-semibold flex-1">{toast.message}</p>
              <button 
                onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-4 h-4 opacity-50 hover:opacity-100" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
