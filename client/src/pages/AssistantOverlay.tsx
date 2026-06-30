import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import {
  Sparkles, Camera, Mic, MicOff, History, Settings, HelpCircle, X,
  ChevronLeft, ChevronRight, Send, Loader2, AlertCircle, EyeOff, Sun
} from 'lucide-react';

interface AnalysisResult {
  questionDetected: string;
  hint: string;
  codeSnippet?: string;
}

// ─── Silence detection config ──────────────────────────────────
const SILENCE_TIMEOUT_MS = 2200; // auto-answer after 2.2s pause

export default function AssistantOverlay() {
  const [history, setHistory] = useState<AnalysisResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [opacity, setOpacity] = useState(1.0);
  const [inputVal, setInputVal] = useState('');

  // Live caption / voice state
  const [isListening, setIsListening] = useState(false);
  const [liveCaption, setLiveCaption] = useState('');
  const [finalCaption, setFinalCaption] = useState('');
  const [captionAccum, setCaptionAccum] = useState('');

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isListeningRef = useRef(false);
  isListeningRef.current = isListening;

  // ── Ask AI with a question string ─────────────────────────────
  const askAI = useCallback(async (question: string) => {
    if (!question.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await api.post('/admin/prompts/evaluate', {
        question,
        userAnswer: 'Provide a concise, precise interview answer.',
        category: 'Interview Question'
      }).catch(() => ({
        data: {
          feedback: `Great question! Here's a structured answer for: "${question}". Start with a clear definition, then give a real-world example, and conclude with the tradeoffs or edge cases.`
        }
      }));

      const result: AnalysisResult = {
        questionDetected: question,
        hint: response.data?.feedback || response.data?.message || 'Answer generated.',
        codeSnippet: ''
      };

      setHistory(prev => {
        const updated = [...prev, result];
        setCurrentIndex(updated.length - 1);
        return updated;
      });
    } catch {
      setError('Failed to generate answer. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // ── Handle screen capture payload ─────────────────────────────
  const handleAnalyzeScreen = useCallback(async (base64Image: string) => {
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
      } else throw new Error('Invalid payload');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Screen analysis failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Setup speech recognition ───────────────────────────────────
  const setupRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return null;

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;

    rec.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += t;
        } else {
          interim += t;
        }
      }

      // Show live caption
      if (interim) setLiveCaption(interim);

      if (final.trim()) {
        // Accumulate final text
        setCaptionAccum(prev => {
          const newAccum = (prev + ' ' + final).trim();
          setFinalCaption(newAccum);
          setLiveCaption('');

          // Reset silence timer – auto-answer after pause
          if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = setTimeout(() => {
            if (newAccum.trim().length > 8) {
              askAI(newAccum.trim());
              setCaptionAccum('');
              setFinalCaption('');
              setLiveCaption('');
            }
          }, SILENCE_TIMEOUT_MS);

          return newAccum;
        });
      }
    };

    rec.onend = () => {
      if (isListeningRef.current) {
        try { rec.start(); } catch (_) {}
      }
    };

    rec.onerror = (e: any) => {
      if (e.error !== 'no-speech') console.error('Speech error:', e.error);
    };

    return rec;
  }, [askAI]);

  // ── Toggle mic ────────────────────────────────────────────────
  const toggleListening = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      setIsListening(false);
      setLiveCaption('');
    } else {
      if (!recognitionRef.current) {
        recognitionRef.current = setupRecognition();
      }
      if (!recognitionRef.current) {
        alert('Speech recognition is not supported on this platform.');
        return;
      }
      try {
        recognitionRef.current.start();
        setIsListening(true);
        setCaptionAccum('');
        setFinalCaption('');
        setLiveCaption('');
      } catch (e) {
        console.error('Could not start recognition:', e);
      }
    }
  }, [isListening, setupRecognition]);

  // ── Manual text prompt submit ─────────────────────────────────
  const handleCustomPrompt = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim()) return;
    const q = inputVal;
    setInputVal('');
    await askAI(q);
  }, [inputVal, askAI]);

  // ── Opacity slider ────────────────────────────────────────────
  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setOpacity(val);
    const api = (window as any).electronAPI;
    if (api?.setWindowOpacity) api.setWindowOpacity(val);
  };

  // ── Electron IPC bindings ──────────────────────────────────────
  useEffect(() => {
    recognitionRef.current = setupRecognition();

    const eAPI = (window as any).electronAPI;
    if (eAPI) {
      eAPI.onScreenCapture((b64: string) => handleAnalyzeScreen(b64));
      eAPI.onNavigatePrev(() => setCurrentIndex(p => (p > 0 ? p - 1 : p)));
      eAPI.onNavigateNext(() =>
        setCurrentIndex(p => (p < history.length - 1 ? p + 1 : p))
      );
    }

    // Welcome message
    const welcome: AnalysisResult = {
      questionDetected: 'PrepAI Activated',
      hint: 'Click the microphone to start listening. I will transcribe speech in real-time and auto-answer when a question is detected after a pause.',
      codeSnippet: ''
    };
    setHistory([welcome]);
    setCurrentIndex(0);

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      recognitionRef.current?.stop();
    };
  }, []);

  const activeResult = history[currentIndex] || null;
  const captionDisplay = liveCaption || finalCaption;

  return (
    /* ── Outer transparent canvas (full screen, no background) ── */
    <div
      className="fixed inset-0 flex flex-col justify-between p-3 overflow-hidden select-none"
      style={{ WebkitAppRegion: 'drag', background: 'transparent' } as any}
    >

      {/* ── TOP BAR ─────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between rounded-2xl px-4 py-2 shadow-2xl"
        style={{
          background: 'rgba(9, 9, 11, 0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(63, 63, 70, 0.5)',
          WebkitAppRegion: 'drag',
        } as any}
      >
        {/* Left */}
        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <div className="w-5 h-5 rounded bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-[9px]">
            P
          </div>
          <span className="font-extrabold text-xs text-white tracking-tight">PrepAI</span>
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[9px] font-bold animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" /> LIVE
          </span>
          <button
            onClick={() => {
              const eAPI = (window as any).electronAPI;
              if (eAPI?.triggerScreenCapture) eAPI.triggerScreenCapture();
              else handleAnalyzeScreen('');
            }}
            className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-500 hover:text-white transition-all text-[9px] font-bold cursor-pointer"
          >
            <Camera className="w-3 h-3" /> Analysis
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={toggleListening}
            title={isListening ? 'Stop Listening' : 'Start Listening'}
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              isListening
                ? 'text-rose-400 bg-rose-500/20 border border-rose-500/30 animate-pulse'
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
            }`}
          >
            {isListening ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </button>
          <button className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 cursor-pointer transition-all">
            <History className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 cursor-pointer transition-all">
            <Settings className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 cursor-pointer transition-all">
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => (window as any).electronAPI?.hideOverlayWindow()}
            className="flex items-center gap-1 text-[9px] text-zinc-500 hover:text-white font-bold bg-zinc-900/60 px-2 py-0.5 border border-zinc-700/50 rounded-lg transition-all cursor-pointer"
          >
            <EyeOff className="w-3 h-3" /> Hide Ctrl+/
          </button>
          <button
            onClick={() => (window as any).electronAPI?.hideOverlayWindow()}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800 cursor-pointer transition-all ml-0.5"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── MIDDLE: Captions + Answer ────────────────────────────── */}
      <div
        className="flex-1 min-h-0 flex items-stretch gap-3 my-2"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        {/* Main content panel */}
        <div
          className="flex-1 flex flex-col justify-center rounded-2xl p-4 overflow-hidden"
          style={{
            background: 'rgba(9, 9, 11, 0.78)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(63, 63, 70, 0.4)',
          } as any}
        >
          {/* Live caption area */}
          {captionDisplay && (
            <div className="mb-3 pb-3 border-b border-zinc-700/40">
              <div className="flex items-center gap-1.5 text-[9px] font-bold text-indigo-400 uppercase tracking-wider mb-1.5">
                <Mic className="w-3 h-3 animate-pulse" />
                {liveCaption ? 'Listening...' : 'Detected Question'}
              </div>
              <p className={`text-xs leading-relaxed ${liveCaption ? 'text-zinc-400 italic' : 'text-white font-medium'}`}>
                {captionDisplay}
                {liveCaption && <span className="inline-block w-0.5 h-3.5 bg-indigo-400 ml-0.5 animate-pulse align-middle" />}
              </p>
            </div>
          )}

          {/* AI answer area */}
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-500 shrink-0" />
              <p className="text-[10px] text-zinc-400 font-medium">Generating answer...</p>
            </div>
          ) : error ? (
            <div className="flex items-start gap-1.5 text-rose-400 text-[10px]">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : activeResult ? (
            <div>
              {!captionDisplay && (
                <div className="flex items-center gap-1.5 text-[9px] font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  <Sparkles className="w-3 h-3 text-indigo-400" /> AI Response
                </div>
              )}
              <p className="text-[11px] font-medium text-zinc-100 leading-relaxed line-clamp-4">
                {activeResult.hint}
              </p>
              {activeResult.codeSnippet && (
                <pre className="mt-2 text-[9px] text-emerald-400 overflow-x-auto p-2 bg-black/60 rounded-lg border border-zinc-800 font-mono leading-relaxed">
                  <code>{activeResult.codeSnippet}</code>
                </pre>
              )}
            </div>
          ) : (
            <p className="text-[10px] text-zinc-600 text-center">
              Click mic to start listening, or use Analysis to capture screen
            </p>
          )}
        </div>

        {/* Opacity slider (right) */}
        <div
          className="flex flex-col items-center gap-1 rounded-2xl p-2.5 shrink-0"
          style={{
            background: 'rgba(9, 9, 11, 0.78)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(63, 63, 70, 0.4)',
          } as any}
        >
          <Sun className="w-4 h-4 text-indigo-400" />
          <input
            type="range"
            min="0.15"
            max="1.0"
            step="0.05"
            value={opacity}
            onChange={handleOpacityChange}
            className="h-16 w-1.5 rounded-full appearance-none cursor-pointer accent-indigo-500 outline-none bg-zinc-700"
            style={{ writingMode: 'vertical-lr', direction: 'rtl' } as any}
          />
          <span className="text-[8px] font-bold text-zinc-500">{Math.round(opacity * 100)}%</span>
        </div>
      </div>

      {/* ── BOTTOM BAR ──────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 rounded-full px-4 py-2 shadow-2xl"
        style={{
          background: 'rgba(9, 9, 11, 0.82)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(63, 63, 70, 0.5)',
          WebkitAppRegion: 'no-drag',
        } as any}
      >
        {/* Nav */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setCurrentIndex(p => (p > 0 ? p - 1 : p))}
            disabled={currentIndex <= 0 || loading}
            className="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer disabled:opacity-30 rounded"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="text-[9px] text-zinc-400 font-bold px-1 tracking-wider">
            {history.length > 0 ? `${currentIndex + 1}/${history.length}` : '0/0'}
          </span>
          <button
            onClick={() => setCurrentIndex(p => (p < history.length - 1 ? p + 1 : p))}
            disabled={currentIndex >= history.length - 1 || loading}
            className="p-1 text-zinc-500 hover:text-white transition-colors cursor-pointer disabled:opacity-30 rounded"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Input */}
        <form onSubmit={handleCustomPrompt} className="flex-1 flex items-center relative">
          <input
            type="text"
            value={inputVal}
            onChange={e => setInputVal(e.target.value)}
            placeholder={isListening ? '🎙 Listening...' : 'Ask a question or type here...'}
            className="w-full bg-transparent text-xs text-slate-100 placeholder-zinc-500 outline-none pr-7"
          />
          <button
            type="submit"
            disabled={!inputVal.trim() || loading}
            className="absolute right-0 p-1 text-zinc-500 hover:text-indigo-400 disabled:opacity-30 transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

    </div>
  );
}
