import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Sparkles, Terminal, FileText, ChevronLeft, ChevronRight, 
  Loader2, AlertCircle, EyeOff, ShieldCheck
} from 'lucide-react';

interface AnalysisResult {
  questionDetected: string;
  hint: string;
  codeSnippet?: string;
}

export default function AssistantOverlay() {
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Handle new screen capture base64 payload from Electron main process
  const handleAnalyzeScreen = async (base64Image: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/assistant/analyze-screen', { image: base64Image });
      if (response.data?.success && response.data?.analysis) {
        const result: AnalysisResult = response.data.analysis;
        setHistory(prev => {
          const updated = [...prev, result];
          setCurrentIndex(updated.length - 1);
          return updated;
        });
      } else {
        throw new Error('Invalid analysis payload from server.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || err.message || 'Failed to analyze screen capture.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Bind Electron IPC callbacks exposed via preload bridge
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      // Listen for screen capture events
      electronAPI.onScreenCapture((base64Image: string) => {
        handleAnalyzeScreen(base64Image);
      });

      // Listen for history index navigation shortcuts
      electronAPI.onNavigatePrev(() => {
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev));
      });

      electronAPI.onNavigateNext(() => {
        setCurrentIndex(prev => (prev < history.length - 1 ? prev + 1 : prev));
      });
    }

    // Add a default welcome hint to history
    setHistory([
      {
        questionDetected: "Active Practice Companion Initialized",
        hint: "Your floating practice assistant is ready. Press Ctrl + Enter when a question or code prompt is displayed on screen to receive custom coaching tips aligned with your resume.",
        codeSnippet: ""
      }
    ]);
    setCurrentIndex(0);
  }, []);

  // Update effect to synchronize history changes with listeners
  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI && history.length > 0) {
      // Sync list state for shortcuts
      electronAPI.syncHistoryState({
        currentIndex,
        maxIndex: history.length - 1
      });
    }
  }, [currentIndex, history]);

  const activeResult = history[currentIndex] || null;

  return (
    <div className="min-h-screen bg-zinc-950/95 text-slate-100 flex flex-col justify-between border border-zinc-800 rounded-3xl p-6 shadow-2xl relative select-none">
      
      {/* Top Header Controls */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-[10px]">
            C
          </div>
          <span className="font-extrabold text-xs tracking-tight text-slate-200">
            Assistant Copilot Overlay
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded">
            MOCK MODE
          </span>
          <button 
            onClick={() => {
              const electronAPI = (window as any).electronAPI;
              if (electronAPI) electronAPI.hideOverlayWindow();
            }}
            className="p-1 rounded hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Hide assistant (Ctrl + \)"
          >
            <EyeOff className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Analysis Display Panel */}
      <div className="flex-1 my-4 flex flex-col justify-center overflow-y-auto pr-1">
        {loading ? (
          <div className="text-center py-8 space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
            <p className="text-xs font-semibold text-zinc-400">Capturing and parsing monitor screen...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        ) : activeResult ? (
          <div className="space-y-4">
            {/* Question Card */}
            <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-xl space-y-1.5">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                <FileText className="w-3 h-3 text-indigo-400" /> Detected Question / Context
              </span>
              <p className="text-xs font-bold text-slate-200 leading-normal">
                {activeResult.questionDetected}
              </p>
            </div>

            {/* Hint Panel */}
            <div className="p-4 bg-indigo-950/20 border border-indigo-500/15 rounded-xl space-y-2">
              <span className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Suggested Interview Guidelines
              </span>
              <p className="text-xs text-slate-300 leading-relaxed text-justify">
                {activeResult.hint}
              </p>
            </div>

            {/* Code Snippet */}
            {activeResult.codeSnippet && (
              <div className="p-3 bg-black/40 border border-zinc-850 rounded-xl space-y-2 font-mono">
                <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                  <Terminal className="w-3 h-3" /> Starter Code Snippet
                </span>
                <pre className="text-[10px] text-emerald-300 overflow-x-auto whitespace-pre p-2 bg-black/60 rounded border border-zinc-900 leading-normal scrollbar-none">
                  <code>{activeResult.codeSnippet}</code>
                </pre>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8 text-xs text-zinc-500">
            No questions parsed yet. Press Ctrl + Enter to capture screen.
          </div>
        )}
      </div>

      {/* Bottom Navigation Controls */}
      <div className="border-t border-zinc-800 pt-4 flex items-center justify-between">
        <span className="text-[10px] text-zinc-500 font-medium">
          {history.length > 0 ? `Result ${currentIndex + 1} of ${history.length}` : '0 results'}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev))}
            disabled={currentIndex <= 0 || loading}
            className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
            title="Previous (Ctrl + [)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentIndex(prev => (prev < history.length - 1 ? prev + 1 : prev))}
            disabled={currentIndex >= history.length - 1 || loading}
            className="p-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
            title="Next (Ctrl + ])"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

    </div>
  );
}
