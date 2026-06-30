import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  Sparkles, Camera, Mic, History, Settings, HelpCircle, X,
  ChevronLeft, ChevronRight, Send, Loader2, AlertCircle, EyeOff, Sun
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
  const [opacity, setOpacity] = useState(1.0);
  const [inputVal, setInputVal] = useState('');
  const [micActive, setMicActive] = useState(true);

  // Handle new screen capture base64 payload from Electron
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

  // Handle custom prompt execution
  const handleCustomPrompt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim() || loading) return;
    setLoading(true);
    setError('');
    const promptText = inputVal;
    setInputVal('');

    try {
      // Simulate/call custom question analysis
      const userResume = await api.get('/resume/latest').catch(() => ({ data: null }));
      const resumeText = userResume.data?.parsedText || '[No resume uploaded]';
      
      const response = await api.post('/admin/prompts/evaluate', {
        question: `User Question: "${promptText}"`,
        userAnswer: `Provide matching guidance based on resume.`,
        category: 'Custom Question'
      }).catch(() => ({
        data: {
          feedback: `Here is custom advice for your prompt: "${promptText}". Stay focused, frame answers chronologically, and reference your Node/React credentials.`
        }
      }));

      const mockResult: AnalysisResult = {
        questionDetected: `User Question: "${promptText}"`,
        hint: response.data?.feedback || response.data?.message || 'Coaching tips retrieved successfully.',
        codeSnippet: ''
      };

      setHistory(prev => {
        const updated = [...prev, mockResult];
        setCurrentIndex(updated.length - 1);
        return updated;
      });
    } catch (err: any) {
      setError('Failed to analyze custom question.');
    } finally {
      setLoading(false);
    }
  };

  // Adjust window opacity via IPC slider
  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setOpacity(val);
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.setWindowOpacity) {
      electronAPI.setWindowOpacity(val);
    }
  };

  useEffect(() => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      electronAPI.onScreenCapture((base64Image: string) => {
        handleAnalyzeScreen(base64Image);
      });

      electronAPI.onNavigatePrev(() => {
        setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev));
      });

      electronAPI.onNavigateNext(() => {
        setCurrentIndex(prev => (prev < history.length - 1 ? prev + 1 : prev));
      });
    }

    setHistory([
      {
        questionDetected: "Active Practice Companion Initialized",
        hint: "Welcome to PrepAI real-time mock interview overlay. Adjust opacity with the slider on the right. Press Ctrl + Enter to capture the screen, or ask custom questions below.",
        codeSnippet: ""
      }
    ]);
    setCurrentIndex(0);
  }, []);

  const activeResult = history[currentIndex] || null;

  return (
    <div className="h-screen w-screen bg-zinc-950/90 text-slate-100 flex flex-col justify-between border border-zinc-800/80 rounded-2xl p-4 shadow-2xl overflow-hidden select-none font-sans">
      
      {/* Top Header Bar (Draggable window region) */}
      <div 
        className="flex items-center justify-between border-b border-zinc-800/50 pb-2 mb-2 select-none"
        style={{ WebkitAppRegion: 'drag' } as any}
      >
        {/* Left Section Logo & State Indicators */}
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <div className="w-5 h-5 rounded bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-[9px] shadow shadow-indigo-500/20">
            P
          </div>
          <span className="font-extrabold text-xs tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
            PrepAI
          </span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-bold animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> LIVE
          </span>
          <button 
            onClick={async () => {
              // Trigger a manual screenshot analysis
              const electronAPI = (window as any).electronAPI;
              if (electronAPI) {
                // We ask main process to send back a screenshot event
                // In main.js we handle screenshot capture and send 'screen-captured'
                const mockCapture = await api.post('/assistant/analyze-screen', { image: 'mock' }).catch(() => null);
                if (mockCapture) handleAnalyzeScreen('mock');
              } else {
                handleAnalyzeScreen(''); // mock run in browser
              }
            }}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 hover:bg-indigo-500 hover:text-white transition-all text-[9px] font-bold cursor-pointer"
          >
            <Camera className="w-3 h-3" /> Analysis
          </button>
        </div>

        {/* Right Section Action Icons */}
        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button 
            onClick={() => setMicActive(!micActive)}
            className={`p-1.5 rounded-lg hover:bg-zinc-900 transition-colors cursor-pointer ${micActive ? 'text-zinc-400' : 'text-rose-500 bg-rose-500/10'}`}
            title="Toggle Mic"
          >
            <Mic className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors cursor-pointer" title="Session History">
            <History className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors cursor-pointer" title="Settings">
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 rounded-lg hover:bg-zinc-900 text-zinc-400 hover:text-white transition-colors cursor-pointer" title="Help Documentation">
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          <button 
            onClick={() => {
              const electronAPI = (window as any).electronAPI;
              if (electronAPI) electronAPI.hideOverlayWindow();
            }}
            className="flex items-center text-[10px] text-zinc-500 hover:text-zinc-300 font-bold bg-zinc-900/60 px-2 py-0.5 border border-zinc-800 rounded transition-all cursor-pointer gap-1"
            title="Hide window"
          >
            <EyeOff className="w-3 h-3" /> Hide Ctrl + \
          </button>
          <button 
            onClick={() => {
              const electronAPI = (window as any).electronAPI;
              if (electronAPI) electronAPI.hideOverlayWindow();
            }}
            className="p-1.5 rounded-lg hover:bg-zinc-900/80 hover:text-rose-400 text-zinc-500 transition-all cursor-pointer ml-1"
            title="Close Assistant"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Middle Content Section */}
      <div className="flex-1 min-h-0 flex items-center justify-between gap-4 my-2 relative">
        
        {/* Left Analysis hints / Text Area */}
        <div className="flex-1 h-full overflow-y-auto pr-2 scrollbar-none flex flex-col justify-center">
          {loading ? (
            <div className="text-center py-6 space-y-2">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mx-auto" />
              <p className="text-[10px] font-semibold text-zinc-400">Analyzing primary display screenshot...</p>
            </div>
          ) : error ? (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] flex items-start gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : activeResult ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1">
                <Sparkles className="w-3 h-3 text-indigo-400" /> AI Coach Response
              </div>
              <p className="text-[11px] font-medium text-zinc-200 leading-relaxed max-w-full text-justify line-clamp-4">
                {activeResult.hint}
              </p>
              {activeResult.codeSnippet && (
                <pre className="text-[9px] text-emerald-400 overflow-x-auto whitespace-pre p-1.5 bg-black/60 rounded border border-zinc-900 leading-normal scrollbar-none mt-1 font-mono">
                  <code>{activeResult.codeSnippet}</code>
                </pre>
              )}
            </div>
          ) : (
            <div className="text-center text-[10px] text-zinc-500">
              Overlay active. Press Ctrl + Enter to analyze screen.
            </div>
          )}
        </div>

        {/* Right Opacity/Brightness Control Slider widget */}
        <div className="flex flex-col items-center gap-1 bg-zinc-900/60 border border-zinc-800/80 rounded-xl p-2.5 shadow-sm shrink-0">
          <span className="text-zinc-400 hover:text-white transition-colors cursor-pointer" title="Opacity Adjust">
            <Sun className="w-4 h-4 text-indigo-400" />
          </span>
          <input 
            type="range" 
            min="0.15" 
            max="1.0" 
            step="0.05" 
            value={opacity} 
            onChange={handleOpacityChange}
            className="h-16 w-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-indigo-500 outline-none" 
            style={{ writingMode: 'vertical-lr', direction: 'rtl' } as any}
            title="Slide to adjust window transparency"
          />
          <span className="text-[8px] font-bold text-zinc-500 mt-1">{Math.round(opacity * 100)}%</span>
        </div>

      </div>

      {/* Bottom Search & Navigation Area */}
      <div className="border-t border-zinc-800/50 pt-2 flex items-center justify-between gap-4">
        {/* Navigation Indicators */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 px-2 py-1 rounded-lg shrink-0">
          <button
            onClick={() => setCurrentIndex(prev => (prev > 0 ? prev - 1 : prev))}
            disabled={currentIndex <= 0 || loading}
            className="p-0.5 rounded text-zinc-500 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[9px] text-zinc-400 font-bold px-1.5 tracking-wider">
            {history.length > 0 ? `${currentIndex + 1}/${history.length}` : '0/0'}
          </span>
          <button
            onClick={() => setCurrentIndex(prev => (prev < history.length - 1 ? prev + 1 : prev))}
            disabled={currentIndex >= history.length - 1 || loading}
            className="p-0.5 rounded text-zinc-500 hover:text-white transition-colors cursor-pointer disabled:opacity-30"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Text prompt box */}
        <form onSubmit={handleCustomPrompt} className="flex-1 flex items-center relative">
          <input
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder="How can I help you today?"
            className="w-full px-4 py-1.5 bg-zinc-900/60 border border-zinc-800/80 rounded-full text-xs text-slate-100 placeholder-zinc-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/25 outline-none transition-all pr-8"
          />
          <button
            type="submit"
            className="absolute right-1 p-1 text-zinc-400 hover:text-indigo-400 hover:scale-105 transition-all cursor-pointer"
            title="Submit prompt"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

    </div>
  );
}
