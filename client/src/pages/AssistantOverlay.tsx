import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, Camera, Mic, MicOff, History, Settings, HelpCircle, X,
  ChevronLeft, ChevronRight, Send, Loader2, EyeOff, Sun
} from 'lucide-react';

// ─── Built-in AI Answer Engine (works with no server/OpenAI key) ─────────────
function generateAnswer(question: string): string {
  const q = question.toLowerCase();

  if (q.includes('tell me about yourself') || q.includes('introduce yourself')) {
    return 'Start with your current role and experience, mention 2-3 key achievements with numbers, then connect to why you are excited about this role. Keep it under 2 minutes and practice it until it sounds natural, not memorized.';
  }
  if (q.includes('strength')) {
    return 'Pick a genuine strength backed by a specific example. Structure: "My key strength is [X]. For example, at [place] I [action] which led to [result]." Avoid generic answers like "hardworking" — be specific and quantify results.';
  }
  if (q.includes('weakness')) {
    return 'Choose a real weakness you have already improved. Structure: "I used to struggle with [X], so I [what I did to improve], and now [result/progress]." This shows self-awareness and growth mindset.';
  }
  if (q.includes('why do you want') || q.includes('why this company') || q.includes('why us')) {
    return 'Research the company before the interview. Talk about: their product/mission that excites you, a specific team or project, and how the role aligns with your career goals. Be specific — not generic compliments.';
  }
  if (q.includes('where do you see yourself') || q.includes('5 years')) {
    return 'Show ambition aligned with the role: "In 5 years I want to have grown into [senior/lead role], having shipped [X], and contributed to [company goal]. This role is the ideal foundation for that path."';
  }
  if (q.includes('conflict') || q.includes('disagree')) {
    return 'Use the STAR method: describe a Situation, your Task, the Action you took (focus on communication and empathy), and the positive Result. Show that you can handle disagreement professionally and collaboratively.';
  }
  if (q.includes('greatest achievement') || q.includes('proud of') || q.includes('accomplishment')) {
    return 'Pick your most impactful achievement. Use STAR: Situation → Task → Action → Result. Quantify wherever possible: "increased by X%", "saved Y hours", "shipped to N users". Connect it to skills relevant for this role.';
  }
  if (q.includes('react') || q.includes('hooks') || q.includes('useeffect') || q.includes('usestate')) {
    return 'React is a UI library using a virtual DOM for efficient re-renders. Key hooks: useState for local state, useEffect for side effects/lifecycle, useCallback/useMemo for performance optimization, useRef for DOM access. Mention controlled components, state lifting, and React 18 concurrent features if relevant.';
  }
  if (q.includes('node') || q.includes('express') || q.includes('backend')) {
    return 'Node.js is a non-blocking, event-driven runtime ideal for I/O-heavy applications. Express provides middleware-based routing. Key concepts: async/await, error middleware, JWT auth, rate limiting, and CORS. Mention clustering for performance and PM2 for production deployment.';
  }
  if (q.includes('sql') || q.includes('database') || q.includes('mongodb') || q.includes('nosql')) {
    return 'SQL databases (PostgreSQL, MySQL) use ACID transactions and are ideal for relational data. NoSQL (MongoDB) offers flexible schemas and horizontal scaling. Key concepts: indexing for query performance, normalization vs denormalization, joins vs embedded documents, and when to use each.';
  }
  if (q.includes('api') || q.includes('rest') || q.includes('graphql')) {
    return 'REST APIs use HTTP methods (GET/POST/PUT/DELETE) with stateless requests. Key practices: versioning (/v1/), proper status codes, pagination, rate limiting. GraphQL offers flexible querying with a single endpoint. Mention authentication (JWT/OAuth) and documentation (Swagger).';
  }
  if (q.includes('array') || q.includes('string') || q.includes('linked list') || q.includes('tree') || q.includes('graph')) {
    return 'For DSA questions: first clarify constraints and edge cases, then discuss your approach before coding. Common patterns: two pointers, sliding window, BFS/DFS, dynamic programming. Always analyze time and space complexity. Practice on LeetCode — focus on patterns, not memorizing solutions.';
  }
  if (q.includes('system design') || q.includes('scale') || q.includes('architecture')) {
    return 'System design framework: 1) Clarify requirements & scale, 2) Estimate capacity (users, QPS, storage), 3) Design data model, 4) High-level architecture (LB, services, DB, cache), 5) Deep dive into bottlenecks. Cover: horizontal scaling, caching (Redis), CDN, message queues (Kafka), and database sharding.';
  }
  if (q.includes('docker') || q.includes('kubernetes') || q.includes('devops') || q.includes('ci/cd')) {
    return 'Docker containers package apps with dependencies for consistent environments. Kubernetes orchestrates containers at scale: deployments, services, pods, ingress. CI/CD pipelines (GitHub Actions, Jenkins) automate testing and deployment. Key concepts: Dockerfile best practices, multi-stage builds, health checks, and rolling deployments.';
  }
  if (q.includes('javascript') || q.includes('closure') || q.includes('prototype') || q.includes('async')) {
    return 'JavaScript key concepts: closures (functions retaining outer scope), prototype chain (inheritance), event loop (single-threaded async via callbacks/promises/async-await), hoisting (var/function declarations), and ES6+ features (arrow functions, destructuring, modules, optional chaining).';
  }
  if (q.includes('salary') || q.includes('compensation') || q.includes('pay')) {
    return 'Research market rates on Glassdoor/Levels.fyi first. When asked, say: "Based on my research and experience, I\'m targeting [range]. I\'m open to discussion based on the full compensation package." Always give a range, not a single number, and anchor high.';
  }
  if (q.includes('fail') || q.includes('mistake') || q.includes('went wrong')) {
    return 'Pick a real failure that had a learning outcome. Structure: "I once [situation/mistake]. I realized [what went wrong]. I took responsibility by [actions]. As a result I learned [specific lesson] and since then I [changed behavior]." Show accountability and growth.';
  }
  if (q.includes('teamwork') || q.includes('collaborate') || q.includes('team')) {
    return 'Describe a specific team project. Highlight: your role, how you communicated (standups, async updates), how you handled disagreements, and the outcome. Show that you listen, contribute, take ownership, and support others. Good teams win together.';
  }
  if (q.includes('how do you') || q.includes('explain') || q.includes('what is') || q.includes('define')) {
    return `For the question: "${question}" — Structure your answer clearly: 1) Define the concept in simple terms, 2) Give a real-world analogy or example from your experience, 3) Mention tradeoffs or when NOT to use it, 4) Connect to how you've applied it in a project. Stay concise and confident.`;
  }

  // Generic fallback
  return `For this question: "${question}" — Use the STAR method: Situation (context), Task (your responsibility), Action (what you specifically did), Result (measurable outcome). Quantify your results, be specific, and keep the answer under 2 minutes. If it's technical, define clearly → give an example → discuss tradeoffs.`;
}

// ─── Glass styles (inline only — Tailwind bg-* is blocked by body class) ──────
const G: React.CSSProperties = {
  background: 'rgba(9, 9, 14, 0.82)',
  backdropFilter: 'blur(22px)',
  WebkitBackdropFilter: 'blur(22px)',
  border: '1px solid rgba(55,55,65,0.55)',
};

const SILENCE_MS = 2500;

interface AIResult {
  question: string;
  answer: string;
}

export default function AssistantOverlay() {
  const [history, setHistory] = useState<AIResult[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [opacity, setOpacity] = useState(1.0);
  const [inputVal, setInputVal] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState('');
  const [liveText, setLiveText] = useState('');
  const [finalText, setFinalText] = useState('');

  const recRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const accumRef = useRef('');
  const listeningRef = useRef(false);
  listeningRef.current = isListening;

  // ── Push answer ─────────────────────────────────────────────
  const pushAnswer = useCallback((question: string, answer: string) => {
    setHistory(prev => {
      const next = [...prev, { question, answer }];
      setIdx(next.length - 1);
      return next;
    });
  }, []);

  // ── Generate and push AI answer ─────────────────────────────
  const doAnswer = useCallback(async (question: string) => {
    if (!question.trim()) return;
    setLoading(true);
    setFinalText('');
    setLiveText('');

    // Small delay to show spinner
    await new Promise(r => setTimeout(r, 400));

    const answer = generateAnswer(question);
    pushAnswer(question, answer);
    setLoading(false);
  }, [pushAnswer]);

  // ── Reset silence timer ─────────────────────────────────────
  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const q = accumRef.current.trim();
      if (q.length > 4) {
        doAnswer(q);
        accumRef.current = '';
      }
    }, SILENCE_MS);
  }, [doAnswer]);

  // ── Start speech recognition ────────────────────────────────
  const startListening = useCallback(() => {
    setMicError('');
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMicError('Speech recognition not supported in this browser/app.');
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    recRef.current = rec;

    rec.onresult = (e: any) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setLiveText(interim);
      if (final.trim()) {
        accumRef.current = (accumRef.current + ' ' + final).trim();
        setFinalText(accumRef.current);
        setLiveText('');
        resetTimer();
      }
    };

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        setMicError('Microphone access denied. Enable mic in Windows Settings → Privacy → Microphone.');
        setIsListening(false);
      }
    };

    rec.onend = () => {
      if (listeningRef.current) {
        try { rec.start(); } catch (_) {}
      }
    };

    try {
      rec.start();
      setIsListening(true);
      accumRef.current = '';
      setFinalText('');
      setLiveText('');
    } catch (e) {
      setMicError('Could not start microphone. Please allow mic access.');
    }
  }, [resetTimer]);

  const stopListening = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    recRef.current?.stop();
    setIsListening(false);
    setLiveText('');
  }, []);

  const toggleMic = useCallback(() => {
    if (isListening) stopListening();
    else startListening();
  }, [isListening, startListening, stopListening]);

  // ── Manual submit ───────────────────────────────────────────
  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = inputVal.trim();
    if (!q) return;
    setInputVal('');
    await doAnswer(q);
  }, [inputVal, doAnswer]);

  // ── Screen capture ──────────────────────────────────────────
  const handleCapture = useCallback(async (b64: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/assistant/analyze-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image: b64 })
      });
      const data = await res.json();
      if (data?.success && data?.analysis?.hint) {
        pushAnswer(data.analysis.questionDetected || 'Screen captured', data.analysis.hint);
      } else {
        pushAnswer('Screen captured', 'Screen captured! Type or speak your question for a tailored answer.');
      }
    } catch {
      pushAnswer('Screen captured', 'Screen captured! Speak or type the interview question and I will answer it for you.');
    } finally {
      setLoading(false);
    }
  }, [pushAnswer]);

  // ── Electron IPC setup ──────────────────────────────────────
  useEffect(() => {
    const eAPI = (window as any).electronAPI;
    if (eAPI) {
      eAPI.onScreenCapture?.((b64: string) => handleCapture(b64));
      eAPI.onNavigatePrev?.(() => setIdx(p => Math.max(0, p - 1)));
      eAPI.onNavigateNext?.(() => setIdx(p => Math.min(history.length - 1, p + 1)));
    }

    pushAnswer(
      'PrepAI Ready',
      '✅ Ready! Click 🎙 to listen — I will transcribe speech live and auto-answer questions after a short pause. Or type a question below, or click Analysis to capture your screen.'
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      recRef.current?.stop();
    };
  }, []);

  const current = history[idx];
  const caption = liveText || finalText;

  // ─── RENDER ──────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'transparent',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: 10, overflow: 'hidden',
      fontFamily: "'Inter','Outfit',system-ui,sans-serif",
      WebkitAppRegion: 'drag', userSelect: 'none',
    } as any}>

      {/* ══ TOP BAR ══════════════════════════════════════════ */}
      <div style={{ ...G, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 14px', WebkitAppRegion: 'drag' } as any}>

        {/* Left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'no-drag' } as any}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#fff' }}>P</div>
          <span style={{ fontWeight: 800, fontSize: 12, color: '#f4f4f5', letterSpacing: '-0.3px' }}>PrepAI</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '1px 8px', borderRadius: 999, background: 'rgba(239,68,68,.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,.25)', fontSize: 9, fontWeight: 700 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444' }} /> LIVE
          </span>
          <button
            onClick={() => {
              const eAPI = (window as any).electronAPI;
              if (eAPI?.triggerScreenCapture) eAPI.triggerScreenCapture();
              else handleCapture('');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 999, background: 'rgba(99,102,241,.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,.3)', fontSize: 9, fontWeight: 700, cursor: 'pointer', outline: 'none' }}
          >
            <Camera size={11} /> Analysis
          </button>
        </div>

        {/* Right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, WebkitAppRegion: 'no-drag' } as any}>
          <button
            onClick={toggleMic}
            title={micError || (isListening ? 'Stop listening' : 'Start listening')}
            style={{ padding: 6, borderRadius: 8, cursor: 'pointer', border: 'none', outline: 'none', transition: 'all .15s', background: isListening ? 'rgba(239,68,68,.18)' : 'transparent', color: micError ? '#fca5a5' : isListening ? '#f87171' : '#71717a' }}
          >
            {isListening ? <Mic size={14} /> : <MicOff size={14} />}
          </button>
          {[History, Settings, HelpCircle].map((Icon, i) => (
            <button key={i} style={{ padding: 6, borderRadius: 8, cursor: 'pointer', border: 'none', outline: 'none', background: 'transparent', color: '#52525b' }}><Icon size={14} /></button>
          ))}
          <button
            onClick={() => (window as any).electronAPI?.hideOverlayWindow?.()}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, background: 'rgba(39,39,42,.6)', color: '#71717a', border: '1px solid rgba(63,63,70,.5)', fontSize: 9, fontWeight: 700, cursor: 'pointer', outline: 'none' }}
          >
            <EyeOff size={10} /> Hide Ctrl+/
          </button>
          <button
            onClick={() => (window as any).electronAPI?.hideOverlayWindow?.()}
            style={{ padding: 6, borderRadius: 8, cursor: 'pointer', border: 'none', outline: 'none', background: 'transparent', color: '#52525b' }}
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ══ MIDDLE ═══════════════════════════════════════════ */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 8, margin: '6px 0', WebkitAppRegion: 'no-drag' } as any}>

        {/* Content card */}
        <div style={{ ...G, borderRadius: 16, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '12px 14px', overflow: 'hidden' }}>

          {/* Mic error */}
          {micError && (
            <p style={{ fontSize: 10, color: '#fca5a5', marginBottom: 8, padding: '6px 10px', background: 'rgba(239,68,68,.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,.2)' }}>{micError}</p>
          )}

          {/* Live captions */}
          {(caption || isListening) && (
            <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid rgba(63,63,70,.4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5, fontSize: 9, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                <Mic size={10} />
                {liveText ? 'Listening...' : caption ? 'Question detected' : 'Waiting for speech...'}
              </div>
              <p style={{ fontSize: 11, color: liveText ? '#a1a1aa' : '#f4f4f5', fontStyle: liveText ? 'italic' : 'normal', fontWeight: liveText ? 400 : 500, lineHeight: 1.55, margin: 0 }}>
                {caption || 'Start speaking...'}
                {liveText && <span style={{ display: 'inline-block', width: 2, height: 13, background: '#818cf8', marginLeft: 2, animation: 'blink 1s step-end infinite', verticalAlign: 'middle' }} />}
              </p>
            </div>
          )}

          {/* Answer */}
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={15} style={{ color: '#6366f1', animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: 10, color: '#71717a', fontWeight: 500 }}>Generating answer...</span>
            </div>
          ) : current ? (
            <div>
              {!caption && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5, fontSize: 9, fontWeight: 700, color: '#52525b', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  <Sparkles size={10} style={{ color: '#818cf8' }} /> AI Response
                </div>
              )}
              <p style={{ fontSize: 11, color: '#e4e4e7', lineHeight: 1.65, margin: 0, display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' } as any}>
                {current.answer}
              </p>
            </div>
          ) : (
            <p style={{ fontSize: 10, color: '#52525b', textAlign: 'center', margin: 0 }}>
              Click 🎙 to listen · Click Analysis to capture screen
            </p>
          )}
        </div>

        {/* Opacity slider */}
        <div style={{ ...G, borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '10px 8px', flexShrink: 0 }}>
          <Sun size={13} style={{ color: '#818cf8' }} />
          <input
            type="range" min="0.15" max="1" step="0.05"
            value={opacity}
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

      {/* ══ BOTTOM BAR ═══════════════════════════════════════ */}
      <div style={{ ...G, borderRadius: 9999, display: 'flex', alignItems: 'center', gap: 10, padding: '5px 14px', WebkitAppRegion: 'no-drag' } as any}>

        {/* Navigation */}
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

        {/* Input */}
        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative' }}>
          <input
            type="text" value={inputVal} onChange={e => setInputVal(e.target.value)}
            placeholder={isListening ? '🎙 Listening... (or type here)' : 'Type a question or speak...'}
            style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', fontSize: 11, color: '#e4e4e7', paddingRight: 26, fontFamily: 'inherit', caretColor: '#818cf8' } as any}
          />
          <button type="submit" disabled={!inputVal.trim() || loading}
            style={{ position: 'absolute', right: 0, padding: 4, border: 'none', background: 'transparent', color: inputVal.trim() ? '#818cf8' : '#3f3f46', cursor: inputVal.trim() ? 'pointer' : 'default' }}>
            <Send size={13} />
          </button>
        </form>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>
    </div>
  );
}
