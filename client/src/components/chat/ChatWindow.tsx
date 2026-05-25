import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Bot, Loader2, Send, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import mermaid from 'mermaid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'base',
  themeVariables: {
    fontFamily: 'Inter, sans-serif',
    primaryColor: '#818cf8',
    primaryTextColor: '#fff',
    primaryBorderColor: '#6366f1',
    lineColor: '#64748b',
    secondaryColor: '#334155',
    tertiaryColor: '#0f172a'
  }
});

interface Message {
  role: 'user' | 'assistant';
  content: string;
  evidence?: Array<{ content: string, source: string, page: number }>;
  faithfulness?: number;
  relevancy?: number;
}

interface ChatWindowProps {
  messages: Message[];
  loading: boolean;
  agentStatus: string;
  input: string;
  setInput: (val: string) => void;
  handleSend: () => void;
  scrollRef: React.RefObject<HTMLDivElement>;
}

const MermaidChart = ({ chart }: { chart: string }) => {
  const ref = React.useRef<HTMLDivElement>(null);
  const [svg, setSvg] = React.useState<string | null>(null);
  const [error, setError] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    // Cancel any pending render
    if (timerRef.current) clearTimeout(timerRef.current);

    // Skip incomplete charts that are still being streamed
    const trimmed = chart.trim();
    if (trimmed.length < 20) return;

    // Debounce: wait for content to stabilize (streaming done)
    timerRef.current = setTimeout(() => {
      mermaid.render(`mermaid-${Math.random().toString(36).substr(2, 9)}`, trimmed)
        .then((result: { svg: string }) => {
          setSvg(result.svg);
          setError(false);
        })
        .catch(() => {
          setError(true);
        });
    }, 300);

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [chart]);

  if (error) {
    return (
      <div className="my-6 p-4 bg-slate-50 dark:bg-[#0a0a0b] rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-400 italic text-center">
        Rendering diagram…
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="mermaid flex justify-center my-6 overflow-x-auto p-4 bg-slate-50 dark:bg-[#0a0a0b] rounded-xl border border-slate-200 dark:border-slate-800"
      dangerouslySetInnerHTML={svg ? { __html: svg } : undefined}
    />
  );
};

const MarkdownComponents = {
  code({node, inline, className, children, ...props}: any) {
    const match = /language-(\w+)/.exec(className || '');
    if (!inline && match && match[1] === 'mermaid') {
      return <MermaidChart chart={String(children).replace(/\n$/, '')} />;
    }
    return <code className={className} {...props}>{children}</code>;
  }
};

// Use sessionStorage to track which messages have already been animated
const getStreamedMessages = () => {
  try {
    return new Set<string>(JSON.parse(sessionStorage.getItem('streamed_msgs') || '[]'));
  } catch {
    return new Set<string>();
  }
};

const markAsStreamed = (content: string) => {
  const streamed = getStreamedMessages();
  streamed.add(content);
  sessionStorage.setItem('streamed_msgs', JSON.stringify(Array.from(streamed).slice(-100)));
};

const TypewriterMarkdown: React.FC<{ content: string, isLast: boolean }> = ({ content, isLast }) => {
  const [displayedContent, setDisplayedContent] = React.useState(() => {
    const streamed = getStreamedMessages();
    if (isLast && !streamed.has(content)) {
      return '';
    }
    return content;
  });

  React.useEffect(() => {
    const streamed = getStreamedMessages();
    if (!isLast || streamed.has(content)) {
      setDisplayedContent(content);
      return;
    }
    
    let currentIndex = 0;
    const speed = 10; // ms per chunk
    const chunkSize = 3; // chars per tick
    
    const interval = setInterval(() => {
      currentIndex += chunkSize;
      setDisplayedContent(content.substring(0, currentIndex));
      
      if (currentIndex >= content.length) {
        clearInterval(interval);
        markAsStreamed(content);
      }
    }, speed);
    
    return () => clearInterval(interval);
  }, [content, isLast]);

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MarkdownComponents}>
      {displayedContent}
    </ReactMarkdown>
  );
};

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  loading,
  input,
  setInput,
  handleSend,
  scrollRef,
  agentStatus
}) => {
  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden py-6 px-4 md:px-6 custom-scrollbar" ref={scrollRef}>
        <div className="w-full relative space-y-8 pb-10">
          <AnimatePresence mode='popLayout'>
            {messages.length === 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-20 h-20 bg-indigo-600/10 rounded-[32px] flex items-center justify-center mb-8 border border-indigo-600/20">
                  <Sparkles className="w-10 h-10 text-indigo-500 animate-pulse" />
                </div>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white mb-4 tracking-tight">How can I assist your research?</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-sm text-lg leading-relaxed">
                  Upload documents to build your knowledge base or start a discussion.
                </p>
                <div className="grid grid-cols-2 gap-4 mt-12 w-full max-w-lg px-4">
                  {[
                    "Summarize my recent uploads",
                    "Synthesize research findings",
                    "Analyze methodology",
                    "Extract key metrics"
                  ].map((hint, i) => (
                    <button 
                      key={i}
                      onClick={() => setInput(hint)}
                      className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:border-indigo-500 hover:text-indigo-500 transition-all text-left shadow-sm"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
            
            {messages.map((msg, idx) => (
              <motion.div 
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 md:gap-6 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div className={`w-10 h-10 md:w-12 md:h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-lg ${msg.role === 'assistant' ? 'bg-indigo-600 text-white shadow-indigo-600/20' : 'bg-slate-900 text-white shadow-slate-900/20'}`}>
                  {msg.role === 'assistant' ? <Bot className="w-5 h-5 md:w-6 md:h-6" /> : <User className="w-5 h-5 md:w-6 md:h-6" />}
                </div>
                <div className={`max-w-[85%] md:max-w-[75%] space-y-2 ${msg.role === 'user' ? 'items-end' : ''}`}>
                  <div className={`p-5 md:p-6 rounded-[24px] md:rounded-[32px] text-sm md:text-base leading-relaxed shadow-sm border ${
                    msg.role === 'assistant' 
                      ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-200' 
                      : 'bg-indigo-600 border-indigo-500 text-white'
                  }`}>
                    {msg.role === 'assistant' ? (
                      <div className="space-y-4">
                        <div className="prose prose-sm md:prose-base dark:prose-invert max-w-none prose-p:leading-relaxed prose-pre:bg-slate-800/50 prose-pre:border prose-pre:border-slate-700">
                          {msg.content.includes('🛠️ [Action Triggered]') && (
                            <div className="mb-4 flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl">
                              <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-ping"></span>
                              <span className="text-[10px] font-black uppercase text-amber-700 dark:text-amber-400">Agent Action Executed</span>
                            </div>
                          )}
                          <TypewriterMarkdown content={msg.content} isLast={idx === messages.length - 1} />
                        </div>

                        {(msg.faithfulness !== undefined || msg.relevancy !== undefined) && (
                          <div className="flex gap-4 mb-4">
                            <div className="flex-1 p-3 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-xl border border-indigo-100 dark:border-indigo-500/10">
                              <p className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tighter mb-1">Faithfulness</p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-indigo-500" style={{ width: `${(msg.faithfulness || 0) * 100}%` }}></div>
                                </div>
                                <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400">{((msg.faithfulness || 0) * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                            <div className="flex-1 p-3 bg-emerald-50/50 dark:bg-emerald-500/5 rounded-xl border border-emerald-100 dark:border-emerald-500/10">
                              <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-tighter mb-1">Relevancy</p>
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-1.5 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                                  <div className="h-full bg-emerald-500" style={{ width: `${(msg.relevancy || 0) * 100}%` }}></div>
                                </div>
                                <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400">{((msg.relevancy || 0) * 100).toFixed(0)}%</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {msg.evidence && msg.evidence.length > 0 && (
                          <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-4 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                              Retrieved Evidence Chunks
                            </h4>
                            <div className="grid gap-3">
                              {msg.evidence.map((chunk, cIdx) => (
                                <div key={cIdx} className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-100 dark:border-slate-800/50 group hover:border-indigo-500/30 transition-all">
                                  <div className="flex justify-between items-start mb-2">
                                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-0.5 rounded-md">
                                      Chunk {cIdx + 1}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      {chunk.source} • Pg {chunk.page}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 dark:text-slate-400 italic line-clamp-3 group-hover:line-clamp-none transition-all leading-relaxed">
                                    "{chunk.content}"
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div className="p-2 md:p-4 bg-white/50 dark:bg-[#0a0a0b]/50 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800/50">
        <div className="max-w-6xl mx-auto relative">
          
          <AnimatePresence>
            {loading && agentStatus && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute -top-10 left-0 right-0 flex justify-center"
              >
                <div className="px-4 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-xl flex items-center gap-2 border border-indigo-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {agentStatus}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={`flex items-end gap-2 md:gap-3 p-2 md:p-3 bg-white dark:bg-slate-900 border-2 rounded-[20px] md:rounded-[24px] transition-all shadow-2xl ${loading ? 'border-indigo-500/50 opacity-80' : 'border-slate-100 dark:border-slate-800 focus-within:border-indigo-500/50 shadow-indigo-500/10'}`}>
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask your assistant..."
              className="flex-1 min-w-0 bg-transparent border-none focus:ring-0 outline-none resize-none overflow-y-auto py-2 md:py-3 text-sm md:text-base text-slate-900 dark:text-slate-200 placeholder:text-slate-600 max-h-32"
            />
            <button onClick={handleSend} disabled={!input.trim() || loading} className={`p-2 md:p-3 rounded-xl md:rounded-2xl transition-all ${input.trim() && !loading ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-600'}`}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-600 mt-3 md:mt-4 hidden md:block uppercase tracking-widest font-bold">
            AI can make mistakes. Verify important information.
          </p>
        </div>
      </div>
    </>
  );
};


