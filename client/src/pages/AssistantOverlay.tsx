import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, Camera, Mic, MicOff, ChevronLeft, ChevronRight,
  Send, Loader2, EyeOff, Sun, X, Code2, User, Volume2
} from 'lucide-react';

// ─── Glass styles ──────────────────────────────────────────────────
const G: React.CSSProperties = {
  background: 'rgba(9,9,14,0.83)',
  backdropFilter: 'blur(22px)',
  WebkitBackdropFilter: 'blur(22px)',
  border: '1px solid rgba(55,55,65,0.55)',
};

// ─── Resume data from uploaded CV ─────────────────────────────────
interface ResumeData {
  parsedText: string;
  summary: string;
  skills: string[];
  originalName: string;
}

function extractName(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  for (const line of lines.slice(0, 5)) {
    if (/^[A-Z][a-z]+(\s[A-Z][a-z]+){1,3}$/.test(line)) return line;
  }
  return 'the candidate';
}

function extractYears(text: string): string {
  const m = text.match(/(\d+)\+?\s*(?:years?|yrs?)\s*(?:of\s*)?(?:experience|exp)/i);
  return m ? `${m[1]}+ years` : '';
}

function extractTitle(text: string): string {
  const patterns = [
    /(?:current|present|currently)\s+(?:role|position|working as)?[:\s]+([A-Z][\w\s]+)/i,
    /(?:Software|Frontend|Backend|Full.?Stack|Senior|Lead|Junior)\s+(?:Engineer|Developer|Architect|Analyst|Intern)/i,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0].trim();
  }
  return 'Software Professional';
}

function extractCompanies(text: string): string[] {
  const found: string[] = [];
  const m = text.match(/(?:at|@|worked\s+at|employed\s+at|formerly\s+at)\s+([A-Z][\w\s&.]+?)(?:\s*[,.|\\n]|$)/gi);
  if (m) m.slice(0, 2).forEach(x => { const c = x.replace(/^(at|@|worked at|employed at|formerly at)\s+/i,'').trim(); if(c) found.push(c); });
  return found;
}

// ─── Instant keyword detection ─────────────────────────────────────
function hasQuestionSignal(text: string): boolean {
  const t = text.toLowerCase();
  const triggers = [
    'what is', 'what are', 'how do', 'how does', 'how can', 'how would',
    'explain', 'describe', 'define', 'tell me', 'can you', 'why do', 'why does',
    'difference between', 'compare', 'when do', 'what happens', 'what does',
    'implement', 'write a', 'code for', 'java', 'python', 'javascript', 'sql',
    'react', 'node', 'api', 'database', 'algorithm', 'complexity',
    'yourself', 'strength', 'weakness', 'salary', 'why this', 'where do you see',
    'greatest', 'challenge', 'achievement', 'conflict', 'team'
  ];
  return triggers.some(k => t.includes(k));
}

// Helper to construct API requests targeting the correct host (local or remote Render server)
const getApiUrl = (path: string) => {
  const baseUrl = import.meta.env.VITE_API_URL || 'https://careercopilot-hu7q.onrender.com';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedBase.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${normalizedBase}${normalizedPath.substring(4)}`;
  }
  return `${normalizedBase}${normalizedPath}`;
};

interface QA { question: string; text: string; code?: string; }

type AudioMode = 'off' | 'mic' | 'speaker';

export default function AssistantOverlay() {
  const [history, setHistory] = useState<QA[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [opacity, setOpacity] = useState(1.0);
  const [inputVal, setInputVal] = useState('');

  // ── Audio mode: off | mic | speaker ─────────────────────────────
  const [audioMode, setAudioMode] = useState<AudioMode>('off');
  const [micError, setMicError] = useState('');
  const [liveText, setLiveText] = useState('');
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [resumeStatus, setResumeStatus] = useState<'loading'|'loaded'|'none'>('loading');

  const [capturedScreen, setCapturedScreen] = useState<string | null>(null);
  const [screenInput, setScreenInput] = useState('');

  // Refs
  const recRef = useRef<any>(null);
  const speakerRecRef = useRef<any>(null);
  const answeredRef = useRef<Set<string>>(new Set());
  const audioModeRef = useRef<AudioMode>('off');
  audioModeRef.current = audioMode;

  const hasSoundRef = useRef(false);
  const combinedRecRef = useRef<{
    micStream?: MediaStream;
    desktopStream?: MediaStream;
    audioCtx?: AudioContext;
    recorder?: MediaRecorder;
    soundCheckInterval?: any;
    chunkTimeout?: any;
  } | null>(null);

  // ── Fetch user CV ───────────────────────────────────────────────
  const fetchResume = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) { setResumeStatus('none'); return; }
      const res = await fetch(getApiUrl('/api/resume/latest'), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setResume(data);
        setResumeStatus('loaded');
      } else {
        setResumeStatus('none');
      }
    } catch {
      setResumeStatus('none');
    }
  }, []);

  // ── Push answer ─────────────────────────────────────────────────
  const pushQA = useCallback((qa: QA) => {
    setHistory(prev => {
      const next = [...prev, qa];
      setIdx(next.length - 1);
      return next;
    });
    setLoading(false);
  }, []);

  const resumeRef = useRef<ResumeData | null>(null);
  resumeRef.current = resume;

  const answerNow = useCallback(async (question: string) => {
    const key = question.trim().slice(0, 40).toLowerCase();
    if (answeredRef.current.has(key)) return;
    answeredRef.current.add(key);

    setLoading(true);
    setLiveText('');
    
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl('/api/assistant/ask'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ question })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.answer) {
          pushQA({ question, text: data.answer.text, code: data.answer.code });
          return;
        }
      }
      throw new Error('Failed to get answer');
    } catch (err) {
      console.error(err);
      pushQA({ question, text: 'Error fetching answer from AI backend. Please try again.' });
    }
  }, [pushQA]);

  // ─────────────────────────────────────────────────────────────────
  // ── MICROPHONE: Web Speech API (captures your own voice) ─────────
  // ─────────────────────────────────────────────────────────────────
  const startMicListening = useCallback(() => {
    setMicError('');
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMicError('❌ Speech recognition unavailable. Use Chrome or the Electron desktop app.');
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    recRef.current = rec;

    rec.onstart = () => {
      console.log('[MIC] Speech recognition started');
      setMicError('');
    };

    rec.onresult = (e: any) => {
      let interim = '';
      let final = '';

      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }

      const displayText = (interim || final).trim();
      if (displayText) setLiveText(displayText);

      const checkText = (interim || final).trim();
      if (checkText.length > 8 && hasQuestionSignal(checkText)) {
        answerNow(checkText);
        answeredRef.current = new Set();
      }

      if (final.trim().length > 10) {
        answerNow(final.trim());
        answeredRef.current = new Set();
      }
    };

    rec.onerror = (e: any) => {
      console.error('[MIC] Speech recognition error:', e.error);
      if (e.error === 'not-allowed') {
        setMicError('❌ Microphone blocked. Go to Windows Settings → Privacy → Microphone → Allow desktop apps to access your microphone.');
        setAudioMode('off');
      } else if (e.error === 'audio-capture') {
        setMicError('❌ No microphone found. Please plug in a mic and retry.');
        setAudioMode('off');
      } else if (e.error !== 'no-speech') {
        console.warn('[MIC] Error:', e.error);
      }
    };

    rec.onend = () => {
      console.log('[MIC] Speech recognition ended');
      if (audioModeRef.current === 'mic') {
        try { rec.start(); } catch (_) {}
      }
    };

    try {
      rec.start();
      setAudioMode('mic');
      setLiveText('');
    } catch (e) {
      setMicError('❌ Could not start microphone. Check Windows Privacy → Microphone settings.');
      setAudioMode('off');
    }
  }, [answerNow]);

  // ─────────────────────────────────────────────────────────────────
  // ── SPEAKER/SYSTEM AUDIO: Captures BOTH mic and system speaker
  //    using Web Audio API mixing, AnalyserNode voice detection,
  //    and server-side OpenAI Whisper API transcription.
  // ─────────────────────────────────────────────────────────────────
  const startSpeakerListening = useCallback(async () => {
    setMicError('');
    hasSoundRef.current = false;

    try {
      const eAPI = (window as any).electronAPI;
      if (!eAPI || !eAPI.getScreenSources) {
        throw new Error('Electron APIs not available. Please run in the PrepAI desktop application.');
      }

      // 1. Retrieve screen sources from Electron
      const sources = await eAPI.getScreenSources();
      const screenSource = sources.find((s: any) => s.id.startsWith('screen:')) || sources[0];
      if (!screenSource) {
        throw new Error('No screen sources found for system audio capture.');
      }

      // 2. Request desktop audio & video stream
      let desktopStream: MediaStream;
      try {
        desktopStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: screenSource.id
            }
          },
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: screenSource.id
            }
          }
        } as any);
      } catch (err: any) {
        console.warn('[SPEAKER] Direct desktop capture failed, trying fallback getDisplayMedia...', err);
        desktopStream = await (navigator.mediaDevices as any).getDisplayMedia({
          audio: true,
          video: true
        });
      }

      // Stop video tracks immediately to optimize performance
      desktopStream.getVideoTracks().forEach(track => track.stop());

      // 3. Request user microphone stream
      let micStream: MediaStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });
      } catch (err: any) {
        desktopStream.getTracks().forEach(t => t.stop());
        throw new Error('Could not access microphone: ' + (err.message || err));
      }

      // 4. Create Web Audio context & mix both mic + speaker streams
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      console.log('[SPEAKER] AudioContext state:', audioCtx.state);
      const dest = audioCtx.createMediaStreamDestination();

      const micSourceNode = audioCtx.createMediaStreamSource(micStream);
      const desktopSourceNode = audioCtx.createMediaStreamSource(desktopStream);

      micSourceNode.connect(dest);
      desktopSourceNode.connect(dest);

      // 5. Connect an analyser node to detect volume activity
      const analyser = audioCtx.createAnalyser();
      dest.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const soundCheckInterval = setInterval(() => {
        if (audioModeRef.current !== 'speaker') {
          clearInterval(soundCheckInterval);
          return;
        }
        analyser.getByteTimeDomainData(dataArray);
        for (let i = 0; i < bufferLength; i++) {
          const amplitude = Math.abs(dataArray[i] - 128);
          if (amplitude > 2) { // Lowered threshold to 2 for maximum sensitivity
            if (!hasSoundRef.current) {
              console.log('[SPEAKER] Sound activity detected! Amplitude:', amplitude);
            }
            hasSoundRef.current = true;
            break;
          }
        }
      }, 100);

      // Save references for clean stopping later
      combinedRecRef.current = {
        micStream,
        desktopStream,
        audioCtx,
        soundCheckInterval
      };

      // 6. Define transcription uploader function
      const sendToTranscribe = async (audioBlob: Blob) => {
        console.log('[COMBINED] Sending audio chunk to transcribe, size:', audioBlob.size);
        try {
          const formData = new FormData();
          formData.append('audio', audioBlob, 'audio.webm');

          const token = localStorage.getItem('token');
          const res = await fetch(getApiUrl('/api/assistant/transcribe'), {
            method: 'POST',
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: formData
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success && data.text) {
              const text = data.text.trim();
              if (text.length > 0) {
                setLiveText(text);
                console.log('[COMBINED] Transcribed text:', text);

                // Check for question signals or minimum substantial length
                if (text.length > 8 && (hasQuestionSignal(text) || text.length > 30)) {
                  answerNow(text);
                  answeredRef.current = new Set();
                }
              }
            }
          }
        } catch (err) {
          console.error('[COMBINED] Transcribe failed:', err);
        }
      };

      // 7. Define chunked recording cycle loop
      const recordCycle = () => {
        if (audioModeRef.current !== 'speaker') return;

        const chunks: Blob[] = [];
        const recorder = new MediaRecorder(dest.stream, { mimeType: 'audio/webm' });

        if (combinedRecRef.current) {
          combinedRecRef.current.recorder = recorder;
        }

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            chunks.push(e.data);
          }
        };

        recorder.onstop = () => {
          if (chunks.length > 0) {
            const blob = new Blob(chunks, { type: 'audio/webm' });
            if (hasSoundRef.current) {
              hasSoundRef.current = false; // Reset threshold for next cycle
              sendToTranscribe(blob);
            }
          }

          // Restart cycle if mode is still speaker
          if (audioModeRef.current === 'speaker') {
            recordCycle();
          }
        };

        recorder.start();

        if (combinedRecRef.current) {
          combinedRecRef.current.chunkTimeout = setTimeout(() => {
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
          }, 5000); // 5 second segments
        }
      };

      recordCycle();
      setAudioMode('speaker');
      setLiveText('');
    } catch (err: any) {
      console.error('[SPEAKER] Setup failed:', err);
      setMicError(`❌ Speaker capture failed: ${err.message || err}`);
      setAudioMode('off');
    }
  }, [answerNow]);

  // ── Stop all audio ──────────────────────────────────────────────
  const stopListening = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;
    if (speakerRecRef.current) {
      speakerRecRef.current.rec?.stop();
      speakerRecRef.current.stream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());
      speakerRecRef.current = null;
    }

    if (combinedRecRef.current) {
      const ref = combinedRecRef.current;
      if (ref.recorder && ref.recorder.state !== 'inactive') {
        try { ref.recorder.stop(); } catch (_) {}
      }
      ref.micStream?.getTracks().forEach(t => t.stop());
      ref.desktopStream?.getTracks().forEach(t => t.stop());
      if (ref.audioCtx && ref.audioCtx.state !== 'closed') {
        ref.audioCtx.close().catch(console.error);
      }
      if (ref.soundCheckInterval) clearInterval(ref.soundCheckInterval);
      if (ref.chunkTimeout) clearTimeout(ref.chunkTimeout);
      combinedRecRef.current = null;
    }

    setAudioMode('off');
    setLiveText('');
    answeredRef.current = new Set();
  }, []);

  // ── Screen capture ───────────────────────────────────────────────
  const handleCapture = useCallback((b64: string) => {
    setCapturedScreen(b64);
    setScreenInput('');
  }, []);

  const submitScreenInput = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = screenInput.trim();
    if (!q) return;
    setCapturedScreen(null);
    setScreenInput('');
    answerNow(q);
  }, [screenInput, answerNow]);

  // ── Manual text submit ──────────────────────────────────────────
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = inputVal.trim();
    if (!q) return;
    setInputVal('');
    answeredRef.current = new Set();
    answerNow(q);
  }, [inputVal, answerNow]);

  // ── Mic button cycle: off → mic → speaker → off ─────────────────
  const cycleAudioMode = useCallback(() => {
    if (audioMode === 'off') {
      startMicListening();
    } else if (audioMode === 'mic') {
      stopListening();
      setTimeout(() => startSpeakerListening(), 100);
    } else {
      stopListening();
    }
  }, [audioMode, startMicListening, startSpeakerListening, stopListening]);

  // ── Init ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchResume();

    const eAPI = (window as any).electronAPI;
    if (eAPI) {
      eAPI.onScreenCapture?.((b64: string) => handleCapture(b64));
      eAPI.onNavigatePrev?.(() => setIdx(p => Math.max(0, p - 1)));
      eAPI.onNavigateNext?.(() => setIdx(p => Math.min(history.length - 1, p + 1)));

      // Log media permission status for debugging
      eAPI.checkMediaPermissions?.().then((result: any) => {
        console.log('[PrepAI] Electron media permissions:', result);
      });
    }

    pushQA({
      question: 'Welcome',
      text: '✅ PrepAI ready!\n🎙 Click mic for YOUR voice | 🔊 Click again for INTERVIEWER audio\n📸 Ctrl+Enter to capture screen | Type below to ask anything'
    });

    return () => {
      recRef.current?.stop();
      speakerRecRef.current?.rec?.stop();
      speakerRecRef.current?.stream?.getTracks().forEach((t: MediaStreamTrack) => t.stop());

      if (combinedRecRef.current) {
        const ref = combinedRecRef.current;
        if (ref.recorder && ref.recorder.state !== 'inactive') {
          try { ref.recorder.stop(); } catch (_) {}
        }
        ref.micStream?.getTracks().forEach(t => t.stop());
        ref.desktopStream?.getTracks().forEach(t => t.stop());
        if (ref.audioCtx && ref.audioCtx.state !== 'closed') {
          ref.audioCtx.close().catch(console.error);
        }
        if (ref.soundCheckInterval) clearInterval(ref.soundCheckInterval);
        if (ref.chunkTimeout) clearTimeout(ref.chunkTimeout);
      }
    };
  }, []);

  const current = history[idx];
  const isListening = audioMode !== 'off';

  // ─── RENDER ─────────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'transparent',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: 10, overflow: 'hidden',
      fontFamily: "'Inter','Outfit',system-ui,sans-serif",
      WebkitAppRegion: 'drag', userSelect: 'none',
    } as any}>

      {/* ══ TOP BAR ═══════════════════════════════════════════════ */}
      <div style={{ ...G, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 14px', WebkitAppRegion: 'drag' } as any}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'no-drag' } as any}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#fff' }}>P</div>
          <span style={{ fontWeight: 800, fontSize: 12, color: '#f4f4f5', letterSpacing: '-0.3px' }}>PrepAI</span>

          {/* Live status pill */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 8px', borderRadius: 999,
            background: audioMode === 'off' ? 'rgba(239,68,68,.12)' : audioMode === 'mic' ? 'rgba(99,102,241,.15)' : 'rgba(34,197,94,.12)',
            color: audioMode === 'off' ? '#fca5a5' : audioMode === 'mic' ? '#a5b4fc' : '#86efac',
            border: `1px solid ${audioMode === 'off' ? 'rgba(239,68,68,.25)' : audioMode === 'mic' ? 'rgba(99,102,241,.3)' : 'rgba(34,197,94,.25)'}`,
            fontSize: 9, fontWeight: 700 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%',
              background: audioMode === 'off' ? '#52525b' : audioMode === 'mic' ? '#6366f1' : '#22c55e',
              transition: 'background .3s',
              boxShadow: audioMode !== 'off' ? '0 0 6px currentColor' : 'none'
            }} />
            {audioMode === 'off' ? 'LIVE' : audioMode === 'mic' ? 'MIC ON' : 'COMBINED ON'}
          </span>

          {/* CV status pill */}
          <span style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '1px 8px',
            borderRadius: 999, fontSize: 9, fontWeight: 700,
            background: resumeStatus === 'loaded' ? 'rgba(52,211,153,.12)' : 'rgba(251,191,36,.1)',
            color: resumeStatus === 'loaded' ? '#6ee7b7' : '#fbbf24',
            border: `1px solid ${resumeStatus === 'loaded' ? 'rgba(52,211,153,.25)' : 'rgba(251,191,36,.2)'}`,
          }}>
            <User size={8} />
            {resumeStatus === 'loading' ? 'CV...' : resumeStatus === 'loaded' ? `CV: ${extractName(resume?.parsedText || '')}` : 'No CV'}
          </span>

          {/* Capture button */}
          <button
            onClick={() => {
              const eAPI = (window as any).electronAPI;
              if (eAPI?.triggerScreenCapture) eAPI.triggerScreenCapture();
              else handleCapture('');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 999, background: 'rgba(99,102,241,.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,.3)', fontSize: 9, fontWeight: 700, cursor: 'pointer', outline: 'none' }}
          >
            <Camera size={11} /> Capture
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 2, WebkitAppRegion: 'no-drag' } as any}>
          {/* Audio mode cycle button: off → mic → speaker → off */}
          <button
            onClick={cycleAudioMode}
            title={audioMode === 'off' ? 'Click: Start mic (your voice)' : audioMode === 'mic' ? 'Click: Switch to combined mic + speaker' : 'Click: Stop audio'}
            style={{
              padding: 6, borderRadius: 8, cursor: 'pointer', border: 'none', outline: 'none',
              background: audioMode === 'off' ? 'transparent' : audioMode === 'mic' ? 'rgba(99,102,241,.18)' : 'rgba(34,197,94,.18)',
              color: audioMode === 'off' ? '#71717a' : audioMode === 'mic' ? '#a5b4fc' : '#86efac',
              transition: 'all .15s', position: 'relative'
            }}
          >
            {audioMode === 'speaker' ? <Volume2 size={14} /> : audioMode === 'mic' ? <Mic size={14} /> : <MicOff size={14} />}
          </button>

          <button
            onClick={() => (window as any).electronAPI?.hideOverlayWindow?.()}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: 'rgba(39,39,42,.6)', color: '#71717a', border: '1px solid rgba(63,63,70,.5)', fontSize: 9, fontWeight: 700, cursor: 'pointer', outline: 'none' }}
          >
            <EyeOff size={10} /> Ctrl+/
          </button>
          <button onClick={() => (window as any).electronAPI?.hideOverlayWindow?.()} style={{ padding: 6, borderRadius: 8, cursor: 'pointer', border: 'none', outline: 'none', background: 'transparent', color: '#52525b' }}>
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ══ MIDDLE ════════════════════════════════════════════════ */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 8, margin: '6px 0', WebkitAppRegion: 'no-drag' } as any}>

        {/* Content card */}
        <div style={{ ...G, borderRadius: 16, flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 12px', overflow: 'hidden', gap: 6 }}>

          {/* Mic/speaker error */}
          {micError && (
            <p style={{ fontSize: 10, color: '#fca5a5', margin: 0, padding: '5px 8px', background: 'rgba(239,68,68,.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,.2)', lineHeight: 1.4 }}>{micError}</p>
          )}

          {/* LIVE CAPTION */}
          {(liveText || isListening) && (
            <div style={{ paddingBottom: 8, borderBottom: '1px solid rgba(63,63,70,.4)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4,
                color: audioMode === 'speaker' ? '#86efac' : '#818cf8' }}>
                {audioMode === 'speaker' ? <Volume2 size={9} style={{ animation: 'pulse 1s infinite' }} /> : <Mic size={9} style={{ animation: 'pulse 1s infinite' }} />}
                {liveText
                  ? (audioMode === 'speaker' ? 'Hearing audio...' : 'Hearing you...')
                  : (audioMode === 'speaker' ? 'Hearing mic & speaker...' : 'Waiting for speech...')}
              </div>
              <p style={{ fontSize: 12, color: '#d4d4d8', fontStyle: 'italic', margin: 0, lineHeight: 1.4 }}>
                {liveText || 'Speak now...'}
                <span style={{ display: 'inline-block', width: 2, height: 13, background: audioMode === 'speaker' ? '#86efac' : '#818cf8', marginLeft: 2, animation: 'blink 1s step-end infinite', verticalAlign: 'middle' }} />
              </p>
            </div>
          )}

          {/* Screen capture input prompt */}
          {capturedScreen !== null && (
            <div style={{ padding: '8px 10px', background: 'rgba(99,102,241,.1)', borderRadius: 10, border: '1px solid rgba(99,102,241,.25)' }}>
              <p style={{ fontSize: 10, color: '#a5b4fc', fontWeight: 600, margin: '0 0 6px 0' }}>📸 Screen captured! What do you need?</p>
              <form onSubmit={submitScreenInput} style={{ display: 'flex', gap: 6 }}>
                <input
                  autoFocus
                  type="text" value={screenInput} onChange={e => setScreenInput(e.target.value)}
                  placeholder='e.g. "Java code", "explain this question", "answer this"'
                  style={{ flex: 1, background: 'rgba(0,0,0,.4)', border: '1px solid rgba(99,102,241,.3)', borderRadius: 6, padding: '4px 8px', fontSize: 10, color: '#e4e4e7', outline: 'none', fontFamily: 'inherit' }}
                />
                <button type="submit" style={{ padding: '4px 10px', borderRadius: 6, background: '#6366f1', color: '#fff', border: 'none', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>Go</button>
              </form>
            </div>
          )}

          {/* AI Answer */}
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'center' }}>
              <Loader2 size={14} style={{ color: '#6366f1', animation: 'spin 0.6s linear infinite' }} />
              <span style={{ fontSize: 10, color: '#71717a' }}>Generating...</span>
            </div>
          ) : current ? (
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {current.code && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, fontSize: 9, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    <Code2 size={9} /> Code
                  </div>
                  <pre style={{ margin: 0, fontSize: 9.5, color: '#6ee7b7', background: 'rgba(0,0,0,.55)', borderRadius: 8, padding: '8px 10px', border: '1px solid rgba(52,211,153,.15)', overflowX: 'auto', fontFamily: "'Fira Code',monospace", lineHeight: 1.55, whiteSpace: 'pre' }}>
                    <code>{current.code}</code>
                  </pre>
                </div>
              )}
              <div>
                {!current.code && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4, fontSize: 9, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    <Sparkles size={9} style={{ color: '#818cf8' }} /> Answer
                  </div>
                )}
                <p style={{ margin: 0, fontSize: 11, color: '#e4e4e7', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                  {current.text}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Opacity slider */}
        <div style={{ ...G, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, padding: '8px 7px', flexShrink: 0 }}>
          <Sun size={12} style={{ color: '#818cf8' }} />
          <input
            type="range" min="0.15" max="1" step="0.05" value={opacity}
            onChange={e => {
              const v = parseFloat(e.target.value);
              setOpacity(v);
              (window as any).electronAPI?.setWindowOpacity?.(v);
            }}
            style={{ writingMode: 'vertical-lr', direction: 'rtl', height: 56, width: 4, accentColor: '#6366f1', cursor: 'pointer' } as any}
          />
          <span style={{ fontSize: 8, color: '#52525b', fontWeight: 700 }}>{Math.round(opacity * 100)}%</span>
        </div>
      </div>

      {/* ══ BOTTOM BAR ════════════════════════════════════════════ */}
      <div style={{ ...G, borderRadius: 9999, display: 'flex', alignItems: 'center', gap: 10, padding: '5px 14px', WebkitAppRegion: 'no-drag' } as any}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <button onClick={() => setIdx(p => Math.max(0, p - 1))} disabled={idx <= 0}
            style={{ padding: 3, border: 'none', background: 'transparent', color: idx <= 0 ? '#3f3f46' : '#71717a', cursor: idx <= 0 ? 'default' : 'pointer' }}>
            <ChevronLeft size={13} />
          </button>
          <span style={{ fontSize: 9, color: '#52525b', fontWeight: 700, padding: '0 4px' }}>
            {history.length > 0 ? `${idx + 1}/${history.length}` : '0/0'}
          </span>
          <button onClick={() => setIdx(p => Math.min(history.length - 1, p + 1))} disabled={idx >= history.length - 1}
            style={{ padding: 3, border: 'none', background: 'transparent', color: idx >= history.length - 1 ? '#3f3f46' : '#71717a', cursor: idx >= history.length - 1 ? 'default' : 'pointer' }}>
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Audio mode hint */}
        <span style={{ fontSize: 9, color: '#3f3f46', flexShrink: 0 }}>
          {audioMode === 'off' ? '🎙=mic 🔊=combined' : audioMode === 'mic' ? '🎙 Mic active' : '🎙+🔊 Combined active'}
        </span>

        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative' }}>
          <input
            type="text" value={inputVal} onChange={e => setInputVal(e.target.value)}
            placeholder={
              audioMode === 'mic' ? '🎙 Listening to your mic...' :
              audioMode === 'speaker' ? '🎙+🔊 Hearing mic & speaker...' :
              'Type question or speak via mic button...'
            }
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 11, color: '#e4e4e7', paddingRight: 26, fontFamily: 'inherit', caretColor: '#818cf8' } as any}
          />
          <button type="submit" disabled={!inputVal.trim()}
            style={{ position: 'absolute', right: 0, padding: 4, border: 'none', background: 'transparent', color: inputVal.trim() ? '#818cf8' : '#3f3f46', cursor: inputVal.trim() ? 'pointer' : 'default' }}>
            <Send size={13} />
          </button>
        </form>
      </div>

      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
      `}</style>
    </div>
  );
}
