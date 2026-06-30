import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, Camera, Mic, MicOff, ChevronLeft, ChevronRight,
  Send, Loader2, EyeOff, Sun, X, Code2
} from 'lucide-react';

// ─── Glass styles ──────────────────────────────────────────────────
const G: React.CSSProperties = {
  background: 'rgba(9,9,14,0.83)',
  backdropFilter: 'blur(22px)',
  WebkitBackdropFilter: 'blur(22px)',
  border: '1px solid rgba(55,55,65,0.55)',
};

// ─── Instant keyword detection ─────────────────────────────────────
// Returns true as soon as a question keyword is found in INTERIM text
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

// ─── Short, precise AI answer engine ──────────────────────────────
function getAnswer(question: string): { text: string; code?: string } {
  const q = question.toLowerCase();

  // ── CODE QUESTIONS (show code first) ───────────────────────────
  if (q.includes('java') && (q.includes('code') || q.includes('write') || q.includes('implement') || q.includes('example'))) {
    return {
      text: 'Java example:',
      code: `// Java OOP example
public class Animal {
    private String name;
    
    public Animal(String name) { this.name = name; }
    
    public String speak() { return name + " speaks"; }
    
    public static void main(String[] args) {
        Animal a = new Animal("Dog");
        System.out.println(a.speak()); // Dog speaks
    }
}`
    };
  }
  if (q.includes('python') && (q.includes('code') || q.includes('write') || q.includes('implement'))) {
    return {
      text: 'Python example:',
      code: `# Python example
def fibonacci(n):
    a, b = 0, 1
    for _ in range(n):
        yield a
        a, b = b, a + b

print(list(fibonacci(8)))  # [0,1,1,2,3,5,8,13]`
    };
  }
  if (q.includes('react') && (q.includes('code') || q.includes('hook') || q.includes('usestate') || q.includes('component'))) {
    return {
      text: 'React hooks example:',
      code: `// React useState + useEffect
import { useState, useEffect } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    document.title = \`Count: \${count}\`;
  }, [count]);
  
  return <button onClick={() => setCount(c => c+1)}>{count}</button>;
}`
    };
  }
  if (q.includes('sql') || (q.includes('query') && q.includes('database'))) {
    return {
      text: 'SQL example:',
      code: `-- Join + Group By example
SELECT u.name, COUNT(o.id) as orders
FROM users u
LEFT JOIN orders o ON o.user_id = u.id
WHERE u.active = 1
GROUP BY u.id
HAVING orders > 5
ORDER BY orders DESC;`
    };
  }
  if (q.includes('linked list') || q.includes('reverse') || q.includes('binary') || q.includes('sort')) {
    return {
      text: 'Algorithm example:',
      code: `// Reverse a linked list (JavaScript)
function reverseList(head) {
  let prev = null, curr = head;
  while (curr) {
    let next = curr.next;
    curr.next = prev;
    prev = curr;
    curr = next;
  }
  return prev; // new head
} // O(n) time, O(1) space`
    };
  }

  // ── INTERVIEW QUESTIONS ─────────────────────────────────────────
  if (q.includes('tell me about yourself') || q.includes('introduce')) {
    return { text: '• Current role + years of experience\n• 2 key achievements with numbers\n• Why excited about THIS role\n• Keep under 90 seconds' };
  }
  if (q.includes('strength')) {
    return { text: '• Pick ONE specific strength\n• Back it with a real example\n• "At [company] I [action] → [result]"\n• Avoid: hardworking, team player (too generic)' };
  }
  if (q.includes('weakness')) {
    return { text: '• Pick a REAL weakness you\'ve improved\n• "I struggled with X, so I did Y, now Z"\n• Shows self-awareness + growth mindset\n• Never: "I work too hard"' };
  }
  if (q.includes('why this') || q.includes('why us') || q.includes('why do you want')) {
    return { text: '• Mention their specific product/mission\n• Name a team or project that excites you\n• "This role aligns with my goal of X"\n• Be specific — not generic praise' };
  }
  if (q.includes('5 years') || q.includes('where do you see')) {
    return { text: '• "Senior/Lead [role] in this domain"\n• Mention specific skills you want to build\n• Connect to this company\'s growth\n• Show ambition + alignment' };
  }
  if (q.includes('salary') || q.includes('compensation') || q.includes('expect')) {
    return { text: '• Research Glassdoor/Levels.fyi first\n• Give a range (anchor 10% high)\n• "Based on market + my experience: ₹X–Y"\n• "Open to discuss full package"' };
  }
  if (q.includes('conflict') || q.includes('disagree')) {
    return { text: '• Situation: describe the disagreement briefly\n• Action: focused on facts, not emotions\n• Listen first, then present data\n• Result: compromise or escalated gracefully' };
  }
  if (q.includes('achievement') || q.includes('proud') || q.includes('accomplish')) {
    return { text: '• Use STAR: Situation → Task → Action → Result\n• Quantify: "increased X by 40%"\n• Pick something relevant to THIS role\n• Make it specific and recent' };
  }
  if (q.includes('fail') || q.includes('mistake') || q.includes('went wrong')) {
    return { text: '• Pick a real failure with a lesson\n• Own it — no excuses\n• "I learned X and changed Y"\n• Show what you\'d do differently' };
  }

  // ── TECHNICAL CONCEPTS ──────────────────────────────────────────
  if (q.includes('react') || q.includes('hooks')) {
    return { text: '• Library for building UIs (not a framework)\n• Virtual DOM → efficient re-renders\n• Key hooks: useState, useEffect, useCallback, useRef\n• React 18: concurrent rendering, Suspense' };
  }
  if (q.includes('node') || q.includes('nodejs')) {
    return { text: '• Non-blocking, event-driven JS runtime\n• Single thread + event loop handles async I/O\n• Best for: APIs, real-time apps, microservices\n• Use cluster module for multi-core' };
  }
  if (q.includes('api') || q.includes('rest')) {
    return { text: '• REST: stateless, HTTP methods (GET/POST/PUT/DELETE)\n• Use proper status codes (200/201/400/401/404/500)\n• Auth: JWT Bearer token in header\n• Version: /api/v1/resource' };
  }
  if (q.includes('system design') || q.includes('scale') || q.includes('architect')) {
    return { text: '• Clarify requirements + scale (users, QPS)\n• Load Balancer → Stateless API → Cache (Redis) → DB\n• Horizontal scaling + CDN for static assets\n• Message queue (Kafka) for async tasks' };
  }
  if (q.includes('docker') || q.includes('container')) {
    return { text: '• Packages app + dependencies in isolated container\n• Dockerfile → Image → Container\n• docker-compose for multi-service dev\n• k8s orchestrates containers at scale' };
  }
  if (q.includes('closure')) {
    return { text: '• Function retaining access to outer scope after outer function returns\n• Used for: data privacy, currying, memoization\n• Example: counter factory, event handlers' };
  }
  if (q.includes('promise') || q.includes('async') || q.includes('await')) {
    return { text: '• Promise: object representing future value (pending/fulfilled/rejected)\n• async/await: syntactic sugar over promises\n• Promise.all() for parallel execution\n• Always catch errors with try/catch' };
  }
  if (q.includes('difference between') || q.includes('compare') || q.includes('vs')) {
    const parts = q.split(/difference between|compare|vs/);
    return { text: `Key differences for: "${question}"\n• Define each concept separately\n• Compare: purpose, when to use, tradeoffs\n• Give a code example or real use case\n• Conclude with: "I use X when... Y when..."` };
  }
  if (q.includes('what is') || q.includes('define') || q.includes('explain')) {
    return { text: `For: "${question.substring(0, 60)}..."\n• Define in 1 sentence\n• Give a real-world analogy\n• Show a use case or example\n• Mention tradeoffs or alternatives` };
  }

  // Generic
  return { text: `• Define the concept clearly (1 sentence)\n• Give a concrete example from your experience\n• Mention tradeoffs or edge cases\n• Connect to how you\'ve applied it` };
}

interface QA { question: string; text: string; code?: string; }

export default function AssistantOverlay() {
  const [history, setHistory] = useState<QA[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [opacity, setOpacity] = useState(1.0);
  const [inputVal, setInputVal] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState('');
  const [liveText, setLiveText] = useState('');

  // Screen capture mode: null = not captured, string = captured b64
  const [capturedScreen, setCapturedScreen] = useState<string | null>(null);
  const [screenInput, setScreenInput] = useState('');

  const recRef = useRef<any>(null);
  const answeredRef = useRef<Set<string>>(new Set()); // prevent duplicate answers
  const listeningRef = useRef(false);
  listeningRef.current = isListening;

  // ── Push answer ─────────────────────────────────────────────
  const pushQA = useCallback((qa: QA) => {
    setHistory(prev => {
      const next = [...prev, qa];
      setIdx(next.length - 1);
      return next;
    });
    setLoading(false);
  }, []);

  // ── Instant answer: no waiting ──────────────────────────────
  const answerNow = useCallback((question: string) => {
    const key = question.trim().slice(0, 40).toLowerCase();
    if (answeredRef.current.has(key)) return;
    answeredRef.current.add(key);

    setLoading(true);
    setLiveText('');
    // Answer instantly (no API call, no delay)
    const { text, code } = getAnswer(question);
    pushQA({ question, text, code });
  }, [pushQA]);

  // ── Speech recognition ──────────────────────────────────────
  const startListening = useCallback(() => {
    setMicError('');
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMicError('Speech recognition not available. Please use Chrome or the desktop app.');
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    recRef.current = rec;

    rec.onstart = () => setMicError('');

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

      // INSTANT answer: trigger as soon as a question keyword detected in INTERIM
      const checkText = (interim || final).trim();
      if (checkText.length > 8 && hasQuestionSignal(checkText)) {
        answerNow(checkText);
        answeredRef.current = new Set(); // reset for next question
      }

      // Also answer on any final result that's a sentence
      if (final.trim().length > 10) {
        answerNow(final.trim());
        answeredRef.current = new Set();
      }
    };

    rec.onerror = (e: any) => {
      if (e.error === 'not-allowed') {
        setMicError('❌ Microphone blocked. Go to Windows Settings → Privacy → Microphone → Allow apps to access your microphone.');
        setIsListening(false);
      } else if (e.error !== 'no-speech') {
        console.warn('Speech:', e.error);
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
      setLiveText('');
    } catch (e) {
      setMicError('Could not start microphone. Check Windows mic permissions.');
    }
  }, [answerNow]);

  const stopListening = useCallback(() => {
    recRef.current?.stop();
    setIsListening(false);
    setLiveText('');
    answeredRef.current = new Set();
  }, []);

  // ── Screen capture: show input prompt ──────────────────────
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

  // ── Manual text submit ──────────────────────────────────────
  const handleSubmit = useCallback((e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = inputVal.trim();
    if (!q) return;
    setInputVal('');
    answeredRef.current = new Set();
    answerNow(q);
  }, [inputVal, answerNow]);

  // ── Init ────────────────────────────────────────────────────
  useEffect(() => {
    const eAPI = (window as any).electronAPI;
    if (eAPI) {
      eAPI.onScreenCapture?.((b64: string) => handleCapture(b64));
      eAPI.onNavigatePrev?.(() => setIdx(p => Math.max(0, p - 1)));
      eAPI.onNavigateNext?.(() => setIdx(p => Math.min(history.length - 1, p + 1)));
    }
    pushQA({ question: 'Welcome', text: '✅ PrepAI ready! Click 🎙 mic → speak → instant answer appears.\nOr type below. Ctrl+Enter to capture screen.' });
    return () => recRef.current?.stop();
  }, []);

  const current = history[idx];

  // ─── RENDER ─────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'transparent',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      padding: 10, overflow: 'hidden',
      fontFamily: "'Inter','Outfit',system-ui,sans-serif",
      WebkitAppRegion: 'drag', userSelect: 'none',
    } as any}>

      {/* ══ TOP BAR ═══════════════════════════════ */}
      <div style={{ ...G, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 14px', WebkitAppRegion: 'drag' } as any}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, WebkitAppRegion: 'no-drag' } as any}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 900, color: '#fff' }}>P</div>
          <span style={{ fontWeight: 800, fontSize: 12, color: '#f4f4f5', letterSpacing: '-0.3px' }}>PrepAI</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 8px', borderRadius: 999, background: 'rgba(239,68,68,.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,.25)', fontSize: 9, fontWeight: 700 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: isListening ? '#ef4444' : '#52525b', transition: 'background .3s' }} />
            {isListening ? 'LISTENING' : 'LIVE'}
          </span>
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
          <button
            onClick={() => isListening ? stopListening() : startListening()}
            style={{ padding: 6, borderRadius: 8, cursor: 'pointer', border: 'none', outline: 'none', background: isListening ? 'rgba(239,68,68,.18)' : 'transparent', color: isListening ? '#f87171' : '#71717a', transition: 'all .15s' }}
          >
            {isListening ? <Mic size={14} /> : <MicOff size={14} />}
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

      {/* ══ MIDDLE ═══════════════════════════════════════════ */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 8, margin: '6px 0', WebkitAppRegion: 'no-drag' } as any}>

        {/* Content card */}
        <div style={{ ...G, borderRadius: 16, flex: 1, display: 'flex', flexDirection: 'column', padding: '10px 12px', overflow: 'hidden', gap: 6 }}>

          {/* Mic error */}
          {micError && (
            <p style={{ fontSize: 10, color: '#fca5a5', margin: 0, padding: '5px 8px', background: 'rgba(239,68,68,.1)', borderRadius: 8, border: '1px solid rgba(239,68,68,.2)', lineHeight: 1.4 }}>{micError}</p>
          )}

          {/* LIVE CAPTION - shows while speaking */}
          {(liveText || isListening) && (
            <div style={{ paddingBottom: 8, borderBottom: '1px solid rgba(63,63,70,.4)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Mic size={9} style={{ animation: isListening ? 'pulse 1s infinite' : 'none' }} />
                {liveText ? 'Hearing you...' : 'Waiting for speech...'}
              </div>
              <p style={{ fontSize: 12, color: '#d4d4d8', fontStyle: 'italic', margin: 0, lineHeight: 1.4 }}>
                {liveText || 'Speak now...'}
                <span style={{ display: 'inline-block', width: 2, height: 13, background: '#818cf8', marginLeft: 2, animation: 'blink 1s step-end infinite', verticalAlign: 'middle' }} />
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
              {/* Code block FIRST if available */}
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
              {/* Answer text */}
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

      {/* ══ BOTTOM BAR ════════════════════════════════════════ */}
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
        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative' }}>
          <input
            type="text" value={inputVal} onChange={e => setInputVal(e.target.value)}
            placeholder={isListening ? '🎙 Listening live...' : 'Type question or say it out loud...'}
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
