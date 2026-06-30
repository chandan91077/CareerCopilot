import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import {
  Sparkles, Camera, Mic, MicOff, History, Settings, HelpCircle, X,
  ChevronLeft, ChevronRight, Send, Loader2, EyeOff, Sun
} from 'lucide-react';

// ─── Styles (no Tailwind bg-* classes - must use inline styles for transparency) ───

const GLASS: React.CSSProperties = {
  background: 'rgba(10, 10, 14, 0.80)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  border: '1px solid rgba(60, 60, 70, 0.50)',
};

const GLASS_PILL: React.CSSProperties = {
  ...GLASS,
  borderRadius: '9999px',
};

const GLASS_CARD: React.CSSProperties = {
  ...GLASS,
  borderRadius: '16px',
};

const SILENCE_MS = 2200; // auto-answer after 2.2s pause

interface AIResult {
  questionDetected: string;
  hint: string;
  codeSnippet?: string;
}

export default function AssistantOverlay() {
  const [history, setHistory] = useState<AIResult[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [opacity, setOpacity] = useState(1.0);
  const [inputVal, setInputVal] = useState('');

  // Voice state
  const [isListening, setIsListening] = useState(false);
  const [micStatus, setMicStatus] = useState<'idle' | 'listening' | 'error'>('idle');
  const [liveCaption, setLiveCaption] = useState('');   // interim transcript
  const [finalCaption, setFinalCaption] = useState(''); // accumulated finals

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumRef = useRef('');
  const isListeningRef = useRef(false);
  isListeningRef.current = isListening;

  // ─── Push result to history ─────────────────────────────────
  const pushResult = useCallback((result: AIResult) => {
    setHistory(prev => {
      const next = [...prev, result];
      setCurrentIndex(next.length - 1);
      return next;
    });
  }, []);

  // ─── Ask AI (never throws, always has fallback) ─────────────
  const askAI = useCallback(async (question: string) => {
    if (!question.trim() || loading) return;
    setLoading(true);
    try {
      const res = await api.post('/admin/prompts/evaluate', {
        question,
        userAnswer: 'Provide a concise, expert interview answer.',
        category: 'Interview Question'
      }).catch(() => ({
        data: {
          feedback: `Great question! For "${question}": Start by defining the concept clearly, give a concrete real-world example from your experience, then discuss tradeoffs or edge cases. Structure your answer with Situation → Task → Action → Result.`
        }
      }));

      pushResult({
        questionDetected: question,
        hint: res.data?.feedback || res.data?.message || `Here's how to answer: "${question}" — Explain the concept, give an example, and discuss tradeoffs.`,
        codeSnippet: ''
      });
    } catch {
      pushResult({
        questionDetected: question,
        hint: `For the question "${question}": Be structured — define, example, tradeoff. Stay confident and concise.`,
        codeSnippet: ''
      });
    } finally {
      setLoading(false);
    }
  }, [loading, pushResult]);

  // ─── Handle screen capture ──────────────────────────────────
  const handleAnalyzeScreen = useCallback(async (base64Image: string) => {
    setLoading(true);
    try {
      const res = await api.post('/assistant/analyze-screen', { image: base64Image });
      if (res.data?.success && res.data?.analysis) {
        pushResult(res.data.analysis);
      } else {
        pushResult({
          questionDetected: 'Screen captured',
          hint: 'Screen captured! Type or speak your interview question for a tailored answer.',
          codeSnippet: ''
        });
      }
    } catch {
      pushResult({
        questionDetected: 'Screen captured',
        hint: 'Screen captured! Type or speak your interview question for a tailored AI answer.',
        codeSnippet: ''
      });
    } finally {
      setLoading(false);
    }
  }, [pushResult]);

  // ─── Reset silence timer, trigger answer on pause ───────────
  const resetSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      const q = accumRef.current.trim();
      if (q.length > 5) {
        askAI(q);
        accumRef.current = '';
        setFinalCaption('');
        setLiveCaption('');
      }
    }, SILENCE_MS);
  }, [askAI]);

  // ─── Speech recognition setup ───────────────────────────────
  const startRecognition = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicStatus('error');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    recognitionRef.current = rec;

    rec.onstart = () => {
      setMicStatus('listening');
    };

    rec.onresult = (event: any) => {
      let interim = '';
      let finalText = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += t;
        } else {
          interim += t;
        }
      }

      // Show live caption with blink
      setLiveCaption(interim);

      if (finalText.trim()) {
        accumRef.current = (accumRef.current + ' ' + finalText).trim();
        setFinalCaption(accumRef.current);
        setLiveCaption('');
        resetSilenceTimer();
      }
    };

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        setMicStatus('error');
        setIsListening(false);
      }
      console.warn('SpeechRecognition error:', e.error);
    };

    rec.onend = () => {
      // Auto-restart if still supposed to be listening
      if (isListeningRef.current) {
        try { rec.start(); } catch (_) {}
      }
    };

    try {
      rec.start();
      setIsListening(true);
      setMicStatus('listening');
      accumRef.current = '';
      setFinalCaption('');
      setLiveCaption('');
    } catch (e) {
      console.error('Failed to start recognition:', e);
      setMicStatus('error');
    }
  }, [resetSilenceTimer]);

  const stopRecognition = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    recognitionRef.current?.stop();
    setIsListening(false);
    setMicStatus('idle');
    setLiveCaption('');
  }, []);

  const toggleListening = useCallback(() => {
    if (isListening) {
      stopRecognition();
    } else {
      startRecognition();
    }
  }, [isListening, startRecognition, stopRecognition]);

  // ─── Text prompt submit ─────────────────────────────────────
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputVal.trim()) return;
    const q = inputVal.trim();
    setInputVal('');
    await askAI(q);
  }, [inputVal, askAI]);

  // ─── Opacity slider ─────────────────────────────────────────
  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setOpacity(val);
    (window as any).electronAPI?.setWindowOpacity?.(val);
  };

  // ─── Init: Electron IPC bindings ────────────────────────────
  useEffect(() => {
    const eAPI = (window as any).electronAPI;
    if (eAPI) {
      eAPI.onScreenCapture((b64: string) => handleAnalyzeScreen(b64));
      eAPI.onNavigatePrev?.(() => setCurrentIndex(p => Math.max(0, p - 1)));
      eAPI.onNavigateNext?.(() => setCurrentIndex(p => Math.min(history.length - 1, p + 1)));
    }

    pushResult({
      questionDetected: 'PrepAI Ready',
      hint: '✅ PrepAI is active. Click 🎙 to start listening — I will transcribe speech live and auto-answer when a question is detected. Or click Analysis to capture your screen.',
      codeSnippet: ''
    });

    return () => {
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      recognitionRef.current?.stop();
    };
  }, []);

  const activeResult = history[currentIndex];
  const captionToShow = liveCaption || finalCaption;

  // ─── Render ─────────────────────────────────────────────────
  return (
    /* Outer wrapper: MUST use inline style for transparency - Tailwind bg-* won't work in Electron */
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'transparent',
        backgroundColor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '10px',
        overflow: 'hidden',
        fontFamily: 'Inter, Outfit, sans-serif',
        WebkitAppRegion: 'drag',
        userSelect: 'none',
      } as any}
    >

      {/* ── TOP BAR ──────────────────────────────────────── */}
      <div style={{ ...GLASS_PILL, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 14px', WebkitAppRegion: 'drag' } as any}>

        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', WebkitAppRegion: 'no-drag' } as any}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: 'linear-gradient(135deg, #6366f1, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: 'white' }}>P</div>
          <span style={{ fontWeight: 800, fontSize: 12, color: 'white', letterSpacing: '-0.3px' }}>PrepAI</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '1px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.12)', color: '#f87171', border: '1px solid rgba(239,68,68,0.25)', fontSize: 9, fontWeight: 700 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', animation: 'pulse 1s infinite' }} /> LIVE
          </span>
          <button
            onClick={() => {
              const eAPI = (window as any).electronAPI;
              if (eAPI?.triggerScreenCapture) eAPI.triggerScreenCapture();
              else handleAnalyzeScreen('');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 999, background: 'rgba(99,102,241,0.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}
          >
            <Camera size={11} /> Analysis
          </button>
        </div>

        {/* Right icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={toggleListening}
            title={micStatus === 'error' ? 'Mic permission denied' : isListening ? 'Stop' : 'Start listening'}
            style={{
              padding: 6, borderRadius: 8, cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: isListening ? 'rgba(239,68,68,0.18)' : 'transparent',
              color: micStatus === 'error' ? '#f87171' : isListening ? '#fca5a5' : '#71717a',
            }}
          >
            {isListening ? <Mic size={14} style={{ animation: 'pulse 1s infinite' }} /> : <MicOff size={14} />}
          </button>
          {[History, Settings, HelpCircle].map((Icon, i) => (
            <button key={i} style={{ padding: 6, borderRadius: 8, cursor: 'pointer', border: 'none', background: 'transparent', color: '#52525b' }}>
              <Icon size={14} />
            </button>
          ))}
          <button
            onClick={() => (window as any).electronAPI?.hideOverlayWindow?.()}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: 'rgba(39,39,42,0.6)', color: '#71717a', border: '1px solid rgba(63,63,70,0.5)', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}
          >
            <EyeOff size={11} /> Hide Ctrl+/
          </button>
          <button
            onClick={() => (window as any).electronAPI?.hideOverlayWindow?.()}
            style={{ padding: 6, borderRadius: 8, cursor: 'pointer', border: 'none', background: 'transparent', color: '#52525b' }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ── MIDDLE PANEL ─────────────────────────────────── */}
      <div
        style={{ flex: 1, minHeight: 0, display: 'flex', gap: 8, margin: '6px 0', WebkitAppRegion: 'no-drag' } as any}
      >
        {/* Content card */}
        <div style={{ ...GLASS_CARD, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '12px 14px', overflow: 'hidden' }}>
          
          {/* Live caption area */}
          {(captionToShow || isListening) && (
            <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(63,63,70,0.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 9, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <Mic size={10} style={{ animation: isListening ? 'pulse 1s infinite' : 'none' }} />
                {liveCaption ? '🎙 Listening...' : captionToShow ? 'Detected question' : '🎙 Waiting for speech...'}
              </div>
              <p style={{ fontSize: 11, color: liveCaption ? '#a1a1aa' : '#f4f4f5', fontStyle: liveCaption ? 'italic' : 'normal', fontWeight: liveCaption ? 400 : 500, lineHeight: 1.5, margin: 0 }}>
                {captionToShow || 'Speak now — I\'m listening...'}
                {liveCaption && (
                  <span style={{ display: 'inline-block', width: 1.5, height: 13, background: '#818cf8', marginLeft: 2, animation: 'blink 1s step-end infinite', verticalAlign: 'middle' }} />
                )}
              </p>
            </div>
          )}

          {/* AI Answer area */}
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={15} style={{ color: '#6366f1', animation: 'spin 1s linear infinite', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#71717a', fontWeight: 500 }}>Generating answer...</span>
            </div>
          ) : activeResult ? (
            <div>
              {!captionToShow && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6, fontSize: 9, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  <Sparkles size={10} style={{ color: '#818cf8' }} /> AI Response
                </div>
              )}
              <p style={{ fontSize: 11, color: '#e4e4e7', lineHeight: 1.65, margin: 0, display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {activeResult.hint}
              </p>
              {activeResult.codeSnippet && (
                <pre style={{ marginTop: 8, fontSize: 9, color: '#34d399', background: 'rgba(0,0,0,0.5)', borderRadius: 8, padding: '6px 8px', border: '1px solid rgba(52,211,153,0.15)', overflowX: 'auto', fontFamily: 'monospace', lineHeight: 1.5 }}>
                  <code>{activeResult.codeSnippet}</code>
                </pre>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 10, color: '#52525b', textAlign: 'center', margin: 0 }}>
              Click mic to listen · Click Analysis to capture screen
            </p>
          )}
        </div>

        {/* Opacity slider */}
        <div style={{ ...GLASS_CARD, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 8px', flexShrink: 0 }}>
          <Sun size={14} style={{ color: '#818cf8' }} />
          <input
            type="range" min="0.15" max="1.0" step="0.05"
            value={opacity} onChange={handleOpacityChange}
            style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 60, width: 4, accentColor: '#6366f1', cursor: 'pointer' } as any}
          />
          <span style={{ fontSize: 8, color: '#52525b', fontWeight: 700 }}>{Math.round(opacity * 100)}%</span>
        </div>
      </div>

      {/* ── BOTTOM BAR ───────────────────────────────────── */}
      <div
        style={{ ...GLASS_PILL, display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', WebkitAppRegion: 'no-drag' } as any}
      >
        {/* Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <button
            onClick={() => setCurrentIndex(p => Math.max(0, p - 1))}
            disabled={currentIndex <= 0 || loading}
            style={{ padding: 4, border: 'none', background: 'transparent', color: currentIndex <= 0 ? '#3f3f46' : '#71717a', cursor: currentIndex <= 0 ? 'default' : 'pointer' }}
          >
            <ChevronLeft size={13} />
          </button>
          <span style={{ fontSize: 9, color: '#52525b', fontWeight: 700, padding: '0 4px' }}>
            {history.length > 0 ? `${currentIndex + 1}/${history.length}` : '0/0'}
          </span>
          <button
            onClick={() => setCurrentIndex(p => Math.min(history.length - 1, p + 1))}
            disabled={currentIndex >= history.length - 1 || loading}
            style={{ padding: 4, border: 'none', background: 'transparent', color: currentIndex >= history.length - 1 ? '#3f3f46' : '#71717a', cursor: currentIndex >= history.length - 1 ? 'default' : 'pointer' }}
          >
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative' }}>
          <input
            type="text" value={inputVal} onChange={e => setInputVal(e.target.value)}
            placeholder={isListening ? '🎙 Listening... (or type here)' : 'Ask a question or type here...'}
            style={{
              width: '100%', background: 'transparent', border: 'none', outline: 'none',
              fontSize: 11, color: '#e4e4e7', paddingRight: 28,
              fontFamily: 'inherit', caretColor: '#818cf8'
            } as any}
          />
          <button
            type="submit" disabled={!inputVal.trim() || loading}
            style={{ position: 'absolute', right: 0, padding: 4, border: 'none', background: 'transparent', color: inputVal.trim() ? '#818cf8' : '#3f3f46', cursor: inputVal.trim() ? 'pointer' : 'default', transition: 'color 0.15s' }}
          >
            <Send size={13} />
          </button>
        </form>
      </div>

      {/* CSS animations (inline since no Tailwind) */}
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
      `}</style>
    </div>
  );
}
