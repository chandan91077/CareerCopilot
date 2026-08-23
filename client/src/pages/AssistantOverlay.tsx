import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Sparkles, Camera, Mic, MicOff, ChevronLeft, ChevronRight,
  Send, Loader2, EyeOff, Sun, X, Code2, User, Volume2,
  AlertCircle, CheckCircle2, Radio, UploadCloud, Monitor,
  Copy, Check, Lock, KeyRound, Play, Square, ExternalLink
} from 'lucide-react';
import { useScreenShare } from '../services/useScreenShare';

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

// ─── Caption entry (persistent history) ──────────────────────────
interface CaptionEntry {
  id: string;
  speaker: 'Me' | 'Interviewer' | 'Combined';
  text: string;
  timestamp: string; // HH:MM:SS
  interim?: boolean;
}

// ─── Pipeline stage log entry ─────────────────────────────────────
type StageStatus = 'ok' | 'error' | 'pending' | 'idle';
interface PipelineStage {
  label: string;
  status: StageStatus;
  detail?: string;
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

/** Returns the best supported MediaRecorder MIME type for this browser/OS */
function getSupportedMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) {
      console.log('[AUDIO] Supported MIME type detected:', mime);
      return mime;
    }
  }
  console.warn('[AUDIO] No preferred MIME type supported — using browser default');
  return '';
}

/** Get file extension matching the MIME type for Whisper */
function mimeToExtension(mime: string): string {
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4')) return 'mp4';
  return 'webm'; // default
}

function nowTimestamp(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

async function checkAudioChunkVolume(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) { resolve(1.0); return; }
        const audioCtx = new AudioCtx();
        const audioBuffer = await audioCtx.decodeAudioData(buffer);
        const channelData = audioBuffer.getChannelData(0);
        
        let sum = 0;
        for (let i = 0; i < channelData.length; i++) {
          sum += channelData[i] * channelData[i];
        }
        const rms = Math.sqrt(sum / channelData.length);
        audioCtx.close().catch(() => {});
        resolve(rms);
      } catch (e) {
        resolve(1.0);
      }
    };
    reader.onerror = () => resolve(1.0);
    reader.readAsArrayBuffer(blob);
  });
}

const HALLUCINATING_PATTERNS = [
  /thank(s|\s+you)?(\s+for\s+\w+)?/i,
  /subtitles?\s+by/i,
  /amara\.org/i,
  /subscribe/i,
  /like\s+and\s+subscribe/i,
  /thanks?\s+for\s+watching/i,
  /kansai\s+international\s+airport/i,
  /kärleksfond|karleksfond/i,
  /hubsan/i,
];

function isHallucinationOrFiller(text: string): boolean {
  const clean = text.trim();
  if (!clean || clean.length < 2) return true;
  if (/^[^\w]+$/.test(clean)) return true;
  // Filter out standalone single filler words
  if (/^(you|the|a|an|it|is|so|oh|ah|um|uh|ok|yeah|well|bye|hi|hey)$/i.test(clean)) return true;
  return HALLUCINATING_PATTERNS.some(r => r.test(clean));
}

function isSubstantiveQuestion(text: string): boolean {
  if (isHallucinationOrFiller(text)) return false;

  const clean = text.trim();
  if (!clean) return false;

  const lower = clean.toLowerCase();

  const GREETINGS = [
    /hello/i, /hi\b/i, /hey/i, /good\s+(morning|afternoon|evening)/i,
    /everyone/i, /thank/i, /welcome/i, /nice\s+to\s+meet/i, /how\s+are\s+you/i
  ];

  const keywords = [
    'what', 'why', 'how', 'when', 'where', 'who', 'which',
    'can', 'could', 'would', 'should', 'is', 'are', 'do', 'does',
    'explain', 'tell', 'describe', 'define', 'write', 'implement',
    'code', 'design', 'architecture', 'system', 'database', 'sql',
    'java', 'python', 'react', 'node', 'api', 'bug', 'algorithm',
    'complexity', 'difference', 'compare', 'advantage', 'disadvantage',
    'git', 'repo', 'push', 'commit', 'branch', 'merge', 'rebase',
    'explain', 'walk me through', 'tell me about', 'give me an example',
    'what is', 'what are', 'how do', 'how would', 'why do', 'when do'
  ];

  const hasQuestionKeyword = keywords.some(k => lower.includes(k));

  if (GREETINGS.some(g => g.test(lower)) && !hasQuestionKeyword) {
    return false;
  }

  if (clean.endsWith('?')) return true;
  if (hasQuestionKeyword && clean.split(/\s+/).length >= 4) return true;

  // Accept direct spoken prompts even when punctuation is missing, as long as they look like a real question.
  const wordCount = clean.split(/\s+/).length;
  return wordCount >= 6 && !/^(yes|no|ok|sure|alright|understood)\b/i.test(lower);
}

function getTodayDateKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getTodayDisplayDate(): string {
  return `Today (${new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short' })})`;
}

interface DayGroup {
  dateKey: string;
  displayDate: string;
  qas: QA[];
}

function groupHistoryByDay(history: QA[]): DayGroup[] {
  if (history.length === 0) return [];
  const map = new Map<string, DayGroup>();

  for (const item of history) {
    const key = item.dateKey || getTodayDateKey();
    const label = item.displayDate || key;
    if (!map.has(key)) {
      map.set(key, { dateKey: key, displayDate: label, qas: [] });
    }
    map.get(key)!.qas.push(item);
  }

  return Array.from(map.values());
}

// Helper to construct API requests targeting the correct host (local or remote Render server)
const getApiUrl = (path: string) => {
  const baseUrl = import.meta.env.VITE_API_URL || 'https://careercopilot-hu7q.onrender.com';
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const apiBase = normalizedBase.endsWith('/api') ? normalizedBase : `${normalizedBase}/api`;
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (apiBase.endsWith('/api') && normalizedPath.startsWith('/api/')) {
    return `${apiBase}${normalizedPath.substring(4)}`;
  }
  return `${apiBase}${normalizedPath}`;
};

interface QA {
  id: string;
  question: string;
  text: string;
  code?: string;
  timestamp: string;
  dateKey: string;
  displayDate: string;
}

type AudioMode = 'off' | 'mic' | 'speaker';

export default function AssistantOverlay() {
  const [history, setHistory] = useState<QA[]>([]);
  const [dayIdx, setDayIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [opacity, setOpacity] = useState(1.0);
  const [inputVal, setInputVal] = useState('');

  // ── Audio mode: off | mic | speaker ─────────────────────────────
  const [audioMode, setAudioMode] = useState<AudioMode>('off');
  const [micError, setMicError] = useState('');
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [resumeStatus, setResumeStatus] = useState<'loading'|'loaded'|'none'>('loading');

  // ── Real-time Screen Sharing Hook ──────────────────────────────────
  const {
    status: screenStatus,
    errorMsg: screenError,
    activeSession: screenSession,
    startScreenShare,
    stopScreenShare,
  } = useScreenShare();
  const [showScreenPanel, setShowScreenPanel] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);

  // ── Persistent caption history ───────────────────────────────────
  const [captions, setCaptions] = useState<CaptionEntry[]>([]);
  const [interimCaption, setInterimCaption] = useState(''); // interim text from Web Speech API
  const captionEndRef = useRef<HTMLDivElement>(null);
  const answerFeedEndRef = useRef<HTMLDivElement>(null);

  // ── Pipeline stage status ────────────────────────────────────────
  const [pipeline, setPipeline] = useState<PipelineStage[]>([
    { label: 'Audio device', status: 'idle' },
    { label: 'Capture', status: 'idle' },
    { label: 'Send to server', status: 'idle' },
    { label: 'Transcription', status: 'idle' },
    { label: 'Caption', status: 'idle' },
  ]);

  const [capturedScreen, setCapturedScreen] = useState<string | null>(null);
  const [screenInput, setScreenInput] = useState('');

  // Refs
  const recRef = useRef<any>(null);
  const micRecorderRef = useRef<{
    stream?: MediaStream;
    recorder?: MediaRecorder;
    chunkTimeout?: any;
  } | null>(null);
  const answeredRef = useRef<Set<string>>(new Set());
  const audioModeRef = useRef<AudioMode>('off');
  audioModeRef.current = audioMode;

  const combinedRecRef = useRef<{
    micStream?: MediaStream;
    desktopStream?: MediaStream;
    audioCtx?: AudioContext;
    recorder?: MediaRecorder;
    chunkTimeout?: any;
  } | null>(null);

  // ── Helpers: update a single pipeline stage ──────────────────────
  const setStage = useCallback((label: string, status: StageStatus, detail?: string) => {
    setPipeline(prev => prev.map(s => s.label === label ? { ...s, status, detail } : s));
  }, []);

  // ── Helpers: add a finalized caption entry ───────────────────────
  const addCaption = useCallback((speaker: CaptionEntry['speaker'], text: string) => {
    const entry: CaptionEntry = {
      id: `${Date.now()}-${Math.random()}`,
      speaker,
      text,
      timestamp: nowTimestamp(),
    };
    setCaptions(prev => [...prev, entry]);
    setInterimCaption('');
    setStage('Caption', 'ok', `"${text.slice(0, 40)}..."`);
  }, [setStage]);

  // ── Auto-scroll captions to bottom ──────────────────────────────
  useEffect(() => {
    captionEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [captions, interimCaption]);

  // ── Auto-scroll AI answer feed to bottom ─────────────────────────
  useEffect(() => {
    answerFeedEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, dayIdx]);

  // ── Fetch user CV ───────────────────────────────────────────────
  const fetchResume = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl('/api/resume/latest'), {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
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
  const pushQA = useCallback((newQa: { question: string; text: string; code?: string }) => {
    const qa: QA = {
      id: `${Date.now()}-${Math.random()}`,
      question: newQa.question,
      text: newQa.text,
      code: newQa.code,
      timestamp: nowTimestamp(),
      dateKey: getTodayDateKey(),
      displayDate: getTodayDisplayDate(),
    };

    setHistory(prev => {
      const next = [...prev, qa];
      const groups = groupHistoryByDay(next);
      setDayIdx(groups.length - 1);
      return next;
    });
    setLoading(false);
  }, []);

  const resumeRef = useRef<ResumeData | null>(null);
  resumeRef.current = resume;

  const [isDemoMode, setIsDemoMode] = useState(false);

  const questionBufferRef = useRef<string[]>([]);
  const pauseTimerRef = useRef<any>(null);

  const answerNow = useCallback(async (question: string) => {
    const key = question.trim().slice(0, 40).toLowerCase();
    if (answeredRef.current.has(key)) return;
    answeredRef.current.add(key);

    setLoading(true);

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
          if (data.answer.isMock || data.isMock) {
            setIsDemoMode(true);
          } else {
            setIsDemoMode(false);
          }
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

  const handleIncomingSpeech = useCallback((text: string) => {
    if (isHallucinationOrFiller(text)) return;

    // Append chunk to question buffer
    questionBufferRef.current.push(text.trim());

    // Reset silence/pause timer
    if (pauseTimerRef.current) {
      clearTimeout(pauseTimerRef.current);
    }

    // Wait for 3.5 seconds of silence (pause after question finishes)
    pauseTimerRef.current = setTimeout(() => {
      if (questionBufferRef.current.length === 0) return;

      const rawCombined = questionBufferRef.current.join(' ').trim();
      questionBufferRef.current = []; // Clear buffer for next question

      // Deduplicate consecutive repeated words
      const words = rawCombined.split(/\s+/);
      const cleanedWords: string[] = [];
      for (const w of words) {
        if (cleanedWords.length === 0 || cleanedWords[cleanedWords.length - 1].toLowerCase() !== w.toLowerCase()) {
          cleanedWords.push(w);
        }
      }
      const fullQuestion = cleanedWords.join(' ');

      if (fullQuestion.length > 8) {
        console.log('[QUESTION FINALIZED AFTER 3.5s PAUSE]:', fullQuestion);
        answerNow(fullQuestion);
      }
    }, 3500);
  }, [answerNow]);

  // ─────────────────────────────────────────────────────────────────
  // ── CORE: Send audio blob to server and handle transcription ─────
  // ─────────────────────────────────────────────────────────────────
  const sendToTranscribe = useCallback(async (
    audioBlob: Blob,
    speaker: CaptionEntry['speaker'],
    mimeType: string
  ) => {
    if (audioBlob.size < 1000) {
      console.warn('[AUDIO] Chunk too small, skipping:', audioBlob.size, 'bytes');
      return;
    }

    const volumeRms = await checkAudioChunkVolume(audioBlob);
    if (volumeRms < 0.005) {
      console.log(`[AUDIO] Skipping silent audio chunk (volume RMS: ${volumeRms.toFixed(5)})`);
      setStage('Capture', 'idle', 'Silence detected (skipped)');
      return;
    }

    console.log(`[AUDIO] Sending chunk: ${audioBlob.size} bytes, volume RMS: ${volumeRms.toFixed(4)}, speaker: ${speaker}`);
    setStage('Send to server', 'pending', `${audioBlob.size} bytes`);
    setStage('Transcription', 'pending');

    const ext = mimeToExtension(mimeType || 'audio/webm');
    const filename = `audio.${ext}`;

    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, filename);

      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl('/api/assistant/transcribe'), {
        method: 'POST',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: formData
      });

      setStage('Send to server', res.ok ? 'ok' : 'error', `HTTP ${res.status}`);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.message || `Server error ${res.status}`;
        console.error('[TRANSCRIBE] Server error:', errMsg);
        setStage('Transcription', 'error', errMsg);

        // Surface meaningful error to user in caption area
        if (res.status === 429 || errMsg.includes('429') || errMsg.includes('quota')) {
          setMicError('❌ OpenAI API quota exceeded (429). Please check billing details at platform.openai.com/account/billing, or set GROQ_API_KEY in server/.env.');
          setStage('Transcription', 'error', 'Quota exceeded (429)');
        } else if (res.status === 401) {
          setMicError('❌ Invalid API key. Please check OPENAI_API_KEY or GROQ_API_KEY in server/.env.');
        } else if (res.status === 503) {
          setMicError('❌ ' + errMsg);
        } else {
          setMicError(`❌ Transcription failed (${res.status}): ${errMsg}`);
        }
        return;
      }

      const data = await res.json();
      if (data.success && data.text) {
        const text = data.text.trim();
        console.log(`[TRANSCRIBE] ✅ Result (${speaker}):`, text);
        setStage('Transcription', 'ok', `${text.length} chars`);

        if (text.length > 0 && !isHallucinationOrFiller(text)) {
          addCaption(speaker, text);
          handleIncomingSpeech(text);
        }
      } else {
        setStage('Transcription', 'error', 'Empty response');
        console.warn('[TRANSCRIBE] Empty or failed transcription response:', data);
      }
    } catch (err: any) {
      console.error('[TRANSCRIBE] Network error:', err.message);
      setStage('Send to server', 'error', err.message);
      setStage('Transcription', 'error', 'Network error');
      setMicError(`❌ Network error: ${err.message}`);
    }
  }, [addCaption, handleIncomingSpeech, setStage]);

  // ─────────────────────────────────────────────────────────────────
  // ── MICROPHONE: Speech recognition & MediaRecorder fallback ─────
  // ─────────────────────────────────────────────────────────────────
  const startMicListening = useCallback(() => {
    setMicError('');
    const isElectron = !!(window as any).electronAPI;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    const startFallbackRecorder = async () => {
      try {
        setStage('Audio device', 'pending', 'Requesting microphone...');
        console.log('[MIC] Requesting microphone access...');

        const micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000,
          },
          video: false
        });

        const audioTracks = micStream.getAudioTracks();
        if (audioTracks.length === 0) {
          throw new Error('Microphone granted but no audio tracks returned.');
        }
        console.log(`[MIC] ✅ Mic stream acquired. Tracks: ${audioTracks.length}, label: "${audioTracks[0].label}"`);
        setStage('Audio device', 'ok', audioTracks[0].label || 'Default mic');
        setStage('Capture', 'pending');

        const mimeType = getSupportedMimeType();

        const recordCycle = () => {
          if (audioModeRef.current !== 'mic') return;

          const chunks: Blob[] = [];
          const recorderOptions = mimeType ? { mimeType } : {};
          const recorder = new MediaRecorder(micStream, recorderOptions);
          micRecorderRef.current = { stream: micStream, recorder };

          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };

          recorder.onstop = () => {
            if (chunks.length > 0) {
              const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
              console.log('[MIC] Chunk ready:', blob.size, 'bytes');
              setStage('Capture', 'ok', `${blob.size} bytes`);
              sendToTranscribe(blob, 'Me', mimeType);
            } else {
              console.warn('[MIC] No audio chunks collected — microphone may be muted or silent');
              setStage('Capture', 'error', 'No audio data (mic silent?)');
            }

            if (audioModeRef.current === 'mic') {
              recordCycle();
            }
          };

          recorder.start();
          micRecorderRef.current.chunkTimeout = setTimeout(() => {
            if (recorder.state !== 'inactive') {
              recorder.stop();
            }
          }, 4000);
        };

        setAudioMode('mic');
        audioModeRef.current = 'mic';
        recordCycle();
      } catch (err: any) {
        console.error('[MIC] Error:', err.message);
        setStage('Audio device', 'error', err.message);
        if (err.name === 'NotAllowedError') {
          setMicError('❌ Microphone blocked. Go to Windows Settings → Privacy → Microphone and allow access.');
        } else if (err.name === 'NotFoundError') {
          setMicError('❌ No microphone found. Please plug in a mic and retry.');
        } else {
          setMicError(`❌ Microphone error: ${err.message}`);
        }
        setAudioMode('off');
      }
    };

    // In Electron, Web Speech API requires Google API keys — always use MediaRecorder + Whisper
    if (!SR || isElectron) {
      startFallbackRecorder();
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    recRef.current = rec;

    rec.onstart = () => {
      console.log('[MIC] Web Speech API started');
      setStage('Audio device', 'ok', 'Web Speech API');
      setStage('Capture', 'ok', 'Streaming');
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

      if (interim) setInterimCaption(interim);

      if (final.trim().length > 0 && !isHallucinationOrFiller(final.trim())) {
        console.log('[MIC] Final transcript:', final.trim());
        setStage('Transcription', 'ok', `${final.trim().length} chars`);
        addCaption('Me', final.trim());
        if (isSubstantiveQuestion(final.trim())) {
          answerNow(final.trim());
        }
      }
    };

    rec.onerror = (e: any) => {
      console.error('[MIC] Speech recognition error:', e.error);
      if (e.error === 'not-allowed') {
        setMicError('❌ Microphone blocked. Go to Windows Settings → Privacy → Microphone → Allow desktop apps.');
        setAudioMode('off');
        setStage('Audio device', 'error', 'Permission denied');
      } else if (e.error === 'audio-capture') {
        setMicError('❌ No microphone found. Please plug in a mic and retry.');
        setAudioMode('off');
        setStage('Audio device', 'error', 'No mic found');
      } else {
        // Fallback to MediaRecorder + Whisper on network/no-speech/service errors
        rec.stop();
        startFallbackRecorder();
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
      audioModeRef.current = 'mic';
    } catch (e) {
      startFallbackRecorder();
    }
  }, [answerNow, addCaption, sendToTranscribe, setStage]);

  // ─────────────────────────────────────────────────────────────────
  // ── SPEAKER/SYSTEM AUDIO: Captures BOTH mic and system speaker ───
  // ─────────────────────────────────────────────────────────────────
  const startSpeakerListening = useCallback(async () => {
    setMicError('');

    try {
      const eAPI = (window as any).electronAPI;
      if (!eAPI || !eAPI.getScreenSources) {
        throw new Error('Electron APIs not available. Please run in the CareerCopilot desktop application.');
      }

      // 1. Retrieve screen sources from Electron
      setStage('Audio device', 'pending', 'Getting screen sources...');
      const sources = await eAPI.getScreenSources();
      const screenSource = sources.find((s: any) => s.id.startsWith('screen:')) || sources[0];
      if (!screenSource) {
        throw new Error('No screen sources found for system audio capture.');
      }
      console.log('[SPEAKER] Using source:', screenSource.name, screenSource.id);

      // 2. Request desktop audio stream via Electron's chromeMediaSource
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
              chromeMediaSourceId: screenSource.id,
              maxWidth: 1,
              maxHeight: 1,
            }
          }
        } as any);
      } catch (err: any) {
        console.warn('[SPEAKER] chromeMediaSource capture failed, trying getDisplayMedia fallback:', err.message);
        desktopStream = await (navigator.mediaDevices as any).getDisplayMedia({
          audio: { echoCancellation: false, noiseSuppression: false },
          video: true,
        });
      }

      // Stop video tracks immediately — we only need audio
      desktopStream.getVideoTracks().forEach(track => track.stop());

      // ✅ CRITICAL: Check that we actually have audio tracks
      const desktopAudioTracks = desktopStream.getAudioTracks();
      if (desktopAudioTracks.length === 0) {
        throw new Error(
          'System audio capture succeeded but returned 0 audio tracks. ' +
          'On Windows, you must enable "Stereo Mix" in Sound settings, OR use a virtual audio cable. ' +
          'Alternatively, use Mic-only mode for your voice.'
        );
      }
      console.log(`[SPEAKER] ✅ Desktop audio tracks: ${desktopAudioTracks.length}, label: "${desktopAudioTracks[0].label}"`);

      // 3. Request user microphone stream
      let micStream: MediaStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            sampleRate: 16000,
          },
          video: false
        });
        const micTracks = micStream.getAudioTracks();
        console.log(`[SPEAKER] ✅ Mic tracks: ${micTracks.length}, label: "${micTracks[0]?.label}"`);
      } catch (err: any) {
        desktopStream.getTracks().forEach(t => t.stop());
        throw new Error('Could not access microphone: ' + (err.message || err));
      }

      setStage('Audio device', 'ok', `Speaker + Mic`);

      // 4. Create Web Audio context & mix both streams into one destination
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      console.log('[SPEAKER] AudioContext state:', audioCtx.state);
      const dest = audioCtx.createMediaStreamDestination();

      const micSourceNode = audioCtx.createMediaStreamSource(micStream);
      const desktopSourceNode = audioCtx.createMediaStreamSource(desktopStream);

      // Boost desktop audio slightly (interviewer's voice)
      const desktopGain = audioCtx.createGain();
      desktopGain.gain.value = 1.5;
      desktopSourceNode.connect(desktopGain);
      desktopGain.connect(dest);
      micSourceNode.connect(dest);

      combinedRecRef.current = { micStream, desktopStream, audioCtx };

      // 5. Get the best supported MIME type
      const mimeType = getSupportedMimeType();

      // 6. Chunked recording cycle
      const recordCycle = () => {
        if (audioModeRef.current !== 'speaker') return;

        const chunks: Blob[] = [];
        const recorderOptions = mimeType ? { mimeType } : {};
        const recorder = new MediaRecorder(dest.stream, recorderOptions);

        if (combinedRecRef.current) {
          combinedRecRef.current.recorder = recorder;
        }

        setStage('Capture', 'pending');

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = () => {
          if (chunks.length > 0) {
            const blob = new Blob(chunks, { type: mimeType || 'audio/webm' });
            console.log('[SPEAKER] Chunk ready:', blob.size, 'bytes');
            setStage('Capture', 'ok', `${blob.size} bytes`);
            sendToTranscribe(blob, 'Combined', mimeType);
          } else {
            console.warn('[SPEAKER] No audio chunks — check system audio is playing');
            setStage('Capture', 'error', 'No audio data captured');
          }

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
          }, 4000);
        }
      };

      setAudioMode('speaker');
      audioModeRef.current = 'speaker';
      setStage('Capture', 'ok', 'Combined stream recording');
      recordCycle();

    } catch (err: any) {
      console.error('[SPEAKER] Setup failed:', err.message || err);
      setStage('Audio device', 'error', err.message);
      setMicError(`❌ Speaker capture failed: ${err.message || err}`);
      setAudioMode('off');
    }
  }, [answerNow, addCaption, sendToTranscribe, setStage]);

  // ── Stop all audio ──────────────────────────────────────────────
  const stopListening = useCallback(() => {
    recRef.current?.stop();
    recRef.current = null;

    if (micRecorderRef.current) {
      const ref = micRecorderRef.current;
      if (ref.recorder && ref.recorder.state !== 'inactive') {
        try { ref.recorder.stop(); } catch (_) {}
      }
      ref.stream?.getTracks().forEach(t => t.stop());
      if (ref.chunkTimeout) clearTimeout(ref.chunkTimeout);
      micRecorderRef.current = null;
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
      if (ref.chunkTimeout) clearTimeout(ref.chunkTimeout);
      combinedRecRef.current = null;
    }

    setAudioMode('off');
    setInterimCaption('');
    answeredRef.current = new Set();
    // NOTE: captions[] is NOT cleared — keeps history visible after stopping
    setPipeline(prev => prev.map(s => ({ ...s, status: 'idle', detail: undefined })));
  }, []);

  // ── Screen capture ───────────────────────────────────────────────
  const handleCapture = useCallback((b64: string) => {
    setCapturedScreen(b64);
    setScreenInput('');
  }, []);

  const submitScreenInput = useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const userInstruction = screenInput.trim();
    const currentImage = capturedScreen;

    if (!userInstruction && !currentImage) return;

    // Reset capture input bar immediately
    setCapturedScreen(null);
    setScreenInput('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(getApiUrl('/api/assistant/analyze-screen'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          image: currentImage || '',
          userInstruction: userInstruction
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.analysis) {
          const { questionDetected, hint, codeSnippet } = data.analysis;
          pushQA({
            question: userInstruction ? `📸 Screen: ${userInstruction}` : `📸 Screen: ${questionDetected || 'Screen Analysis'}`,
            text: hint || 'Screen analyzed.',
            code: codeSnippet
          });
          return;
        }
      }
      throw new Error('Screen analysis request failed');
    } catch (err) {
      console.error('[ScreenCapture] Error analyzing screen:', err);
      if (userInstruction) {
        answerNow(userInstruction);
      } else {
        pushQA({
          question: '📸 Screen Capture',
          text: 'Could not process screenshot image. Please try typing your question.'
        });
      }
    } finally {
      setLoading(false);
    }
  }, [screenInput, capturedScreen, pushQA, answerNow]);

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
      eAPI.onNavigatePrev?.(() => setDayIdx((p: number) => Math.max(0, p - 1)));
      eAPI.onNavigateNext?.(() => setDayIdx((p: number) => Math.min(dayGroups.length - 1, p + 1)));

      eAPI.checkMediaPermissions?.().then((result: any) => {
        console.log('[CareerCopilot] Electron media permissions:', result);
      });
    }

    // Log MIME support for diagnostics
    const mime = getSupportedMimeType();
    console.log('[CareerCopilot] Best audio MIME type:', mime || '(browser default)');
    console.log('[CareerCopilot] SpeechRecognition available:', !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
    console.log('[CareerCopilot] getUserMedia available:', !!(navigator.mediaDevices?.getUserMedia));

    pushQA({
      question: 'CareerCopilot ready',
      text: '🎙 Click mic for YOUR voice | 🔊 Click again for INTERVIEWER + your audio\n📸 Ctrl+Enter to capture screen | Type below to ask anything\n\n💡 Captions will appear in the left panel with timestamps. AI answers appear below.',
    });

    return () => {
      recRef.current?.stop();
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
        if (ref.chunkTimeout) clearTimeout(ref.chunkTimeout);
      }
    };
  }, []);

  const dayGroups = groupHistoryByDay(history);
  const activeDay = dayGroups[dayIdx] || (dayGroups.length > 0 ? dayGroups[dayGroups.length - 1] : null);
  const latestQA = activeDay && activeDay.qas.length > 0 ? activeDay.qas[activeDay.qas.length - 1] : null;
  const isListening = audioMode !== 'off';

  // ── Stage icon ───────────────────────────────────────────────────
  const StageIcon = ({ status }: { status: StageStatus }) => {
    if (status === 'ok') return <CheckCircle2 size={8} style={{ color: '#22c55e', flexShrink: 0 }} />;
    if (status === 'error') return <AlertCircle size={8} style={{ color: '#ef4444', flexShrink: 0 }} />;
    if (status === 'pending') return <Radio size={8} style={{ color: '#f59e0b', flexShrink: 0, animation: 'pulse 1s ease infinite' }} />;
    return <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#3f3f46', display: 'inline-block', flexShrink: 0 }} />;
  };

  // ── Speaker color per label ──────────────────────────────────────
  const speakerColor = (speaker: CaptionEntry['speaker']) => {
    if (speaker === 'Me') return '#818cf8';
    if (speaker === 'Interviewer') return '#34d399';
    return '#f59e0b';
  };

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
      <div style={{ ...G, borderRadius: 9999, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', gap: 6, WebkitAppRegion: 'drag' } as any}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexShrink: 1, overflow: 'hidden', WebkitAppRegion: 'no-drag' } as any}>
          <div style={{ width: 18, height: 18, borderRadius: 5, background: 'linear-gradient(135deg,#6366f1,#a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8.5, fontWeight: 900, color: '#fff', flexShrink: 0 }}>C</div>
          <span style={{ fontWeight: 800, fontSize: 11, color: '#f4f4f5', letterSpacing: '-0.3px', flexShrink: 0 }}>CareerCopilot</span>

          {/* Live status pill */}
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 999,
            background: audioMode === 'off' ? 'rgba(239,68,68,.12)' : audioMode === 'mic' ? 'rgba(99,102,241,.15)' : 'rgba(34,197,94,.12)',
            color: audioMode === 'off' ? '#fca5a5' : audioMode === 'mic' ? '#a5b4fc' : '#86efac',
            border: `1px solid ${audioMode === 'off' ? 'rgba(239,68,68,.25)' : audioMode === 'mic' ? 'rgba(99,102,241,.3)' : 'rgba(34,197,94,.25)'}`,
            fontSize: 8.5, fontWeight: 700, flexShrink: 0 }}>
            <span style={{ width: 4, height: 4, borderRadius: '50%',
              background: audioMode === 'off' ? '#52525b' : audioMode === 'mic' ? '#6366f1' : '#22c55e',
              transition: 'background .3s',
              boxShadow: audioMode !== 'off' ? '0 0 6px currentColor' : 'none'
            }} />
            {audioMode === 'off' ? 'OFF' : audioMode === 'mic' ? 'MIC' : 'COMBINED'}
          </span>

          {/* CV status pill */}
          <span style={{
            display: 'flex', alignItems: 'center', gap: 3, padding: '1px 6px',
            borderRadius: 999, fontSize: 8.5, fontWeight: 700, maxWidth: 85, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            background: resumeStatus === 'loaded' ? 'rgba(52,211,153,.12)' : 'rgba(251,191,36,.1)',
            color: resumeStatus === 'loaded' ? '#6ee7b7' : '#fbbf24',
            border: `1px solid ${resumeStatus === 'loaded' ? 'rgba(52,211,153,.25)' : 'rgba(251,191,36,.2)'}`,
            flexShrink: 1
          }} title={resume ? extractName(resume.parsedText || '') : ''}>
            <User size={8} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {resumeStatus === 'loading' ? 'CV...' : resumeStatus === 'loaded' ? `CV: ${extractName(resume?.parsedText || '')}` : 'No CV'}
            </span>
          </span>

          {/* Capture button */}
          <button
            onClick={() => {
              const eAPI = (window as any).electronAPI;
              if (eAPI?.triggerScreenCapture) eAPI.triggerScreenCapture();
              else handleCapture('');
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999, background: 'rgba(99,102,241,.18)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,.3)', fontSize: 8.5, fontWeight: 700, cursor: 'pointer', outline: 'none', flexShrink: 0 }}
          >
            <Camera size={10} /> Capture
          </button>

          {/* Real-time Screen Share toggle button */}
          <button
            onClick={() => setShowScreenPanel(!showScreenPanel)}
            title="Broadcast your screen in real time"
            style={{
              display: 'flex', alignItems: 'center', gap: 3, padding: '2px 7px', borderRadius: 999,
              background: screenStatus === 'sharing' ? 'rgba(34,197,94,.25)' : 'rgba(34,197,94,.22)',
              color: screenStatus === 'sharing' ? '#4ade80' : '#86efac',
              border: `1px solid ${screenStatus === 'sharing' ? 'rgba(34,197,94,.6)' : 'rgba(34,197,94,.4)'}`,
              fontSize: 8.5, fontWeight: 800, cursor: 'pointer', outline: 'none', WebkitAppRegion: 'no-drag', flexShrink: 0
            } as any}
          >
            <Monitor size={10} /> {screenStatus === 'sharing' ? '● Sharing' : 'Screen Share'}
          </button>

          {isDemoMode && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: 3, padding: '1px 6px', borderRadius: 999,
              background: 'rgba(245,158,11,.15)', color: '#fbbf24', border: '1px solid rgba(245,158,11,.4)',
              fontSize: 8, fontWeight: 800, flexShrink: 0
            }}>
              ⚡ DEMO MODE
            </span>
          )}
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

      {/* ══ EMBEDDED SCREEN SHARE PANEL ═══════════════════════════ */}
      {(showScreenPanel || screenStatus === 'sharing') && (
        <div style={{
          ...G,
          borderRadius: 14,
          padding: '8px 12px',
          margin: '4px 0',
          background: 'rgba(15,15,24,0.95)',
          border: '1px solid rgba(99,102,241,0.4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          WebkitAppRegion: 'no-drag'
        } as any}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Monitor size={14} style={{ color: '#4ade80' }} />
              <span style={{ fontSize: 11, fontWeight: 800, color: '#f4f4f5' }}>Screen Sharing</span>
              <span style={{
                fontSize: 8, fontWeight: 700, padding: '1px 6px', borderRadius: 999,
                background: screenStatus === 'sharing' ? 'rgba(34,197,94,0.2)' : 'rgba(113,113,122,0.2)',
                color: screenStatus === 'sharing' ? '#4ade80' : '#a1a1aa',
                border: `1px solid ${screenStatus === 'sharing' ? 'rgba(34,197,94,0.4)' : 'rgba(113,113,122,0.3)'}`
              }}>
                {screenStatus === 'sharing' ? '● SHARING' : 'IDLE'}
              </span>
            </div>
            <button
              onClick={() => setShowScreenPanel(false)}
              style={{ background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', padding: 2 }}
            >
              <X size={12} />
            </button>
          </div>

          {screenError && (
            <div style={{ fontSize: 9, color: '#f87171', background: 'rgba(239,68,68,0.1)', padding: '4px 8px', borderRadius: 6 }}>
              ⚠️ {screenError}
            </div>
          )}

          {screenStatus !== 'sharing' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <p style={{ margin: 0, fontSize: 9.5, color: '#a1a1aa', flex: 1 }}>
                Broadcast your screen securely to evaluators via encrypted WebRTC.
              </p>
              <button
                onClick={() => startScreenShare()}
                disabled={screenStatus === 'connecting'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4, padding: '5px 12px', borderRadius: 8,
                  background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff', fontSize: 10,
                  fontWeight: 700, border: 'none', cursor: 'pointer', outline: 'none'
                }}
              >
                <Play size={10} fill="#fff" /> Start Screen Sharing
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Credentials Box */}
              {screenSession && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'rgba(24,24,37,0.8)', padding: '6px 10px', borderRadius: 8, border: '1px solid rgba(63,63,70,0.5)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <Lock size={10} style={{ color: '#818cf8' }} />
                    <span style={{ fontSize: 8.5, color: '#71717a', textTransform: 'uppercase', fontWeight: 700 }}>Session ID:</span>
                    <span style={{ fontSize: 11, fontWeight: 900, fontFamily: 'monospace', color: '#818cf8', letterSpacing: 1 }}>{screenSession.sessionId}</span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(screenSession.sessionId);
                        setCopiedId(true);
                        setTimeout(() => setCopiedId(false), 2000);
                      }}
                      style={{ background: 'rgba(99,102,241,0.2)', border: 'none', borderRadius: 4, padding: '2px 5px', color: '#a5b4fc', fontSize: 8.5, cursor: 'pointer', marginLeft: 2 }}
                    >
                      {copiedId ? <Check size={8} /> : <Copy size={8} />} {copiedId ? 'Copied' : 'Copy ID'}
                    </button>
                  </div>

                  {screenSession.password && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderLeft: '1px solid rgba(63,63,70,0.5)', paddingLeft: 10 }}>
                      <KeyRound size={10} style={{ color: '#c084fc' }} />
                      <span style={{ fontSize: 8.5, color: '#71717a', textTransform: 'uppercase', fontWeight: 700 }}>Password:</span>
                      <span style={{ fontSize: 11, fontWeight: 900, fontFamily: 'monospace', color: '#c084fc', letterSpacing: 1 }}>{screenSession.password}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(screenSession.password || '');
                          setCopiedPass(true);
                          setTimeout(() => setCopiedPass(false), 2000);
                        }}
                        style={{ background: 'rgba(168,85,247,0.2)', border: 'none', borderRadius: 4, padding: '2px 5px', color: '#e9d5ff', fontSize: 8.5, cursor: 'pointer', marginLeft: 2 }}
                      >
                        {copiedPass ? <Check size={8} /> : <Copy size={8} />} {copiedPass ? 'Copied' : 'Copy Password'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 8.5, color: '#71717a' }}>
                  💡 Viewer enters ID & Password at <strong>/screen-share/view</strong> on Web App to watch
                </span>
                <button
                  onClick={stopScreenShare}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6,
                    background: '#e11d48', color: '#fff', fontSize: 9, fontWeight: 700, border: 'none', cursor: 'pointer'
                  }}
                >
                  <Square size={8} fill="#fff" /> Stop Sharing
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', gap: 8, margin: '6px 0', WebkitAppRegion: 'no-drag' } as any}>

        {/* Content card with Row layout */}
        <div style={{ ...G, borderRadius: 16, flex: 1, display: 'flex', flexDirection: 'row', padding: '10px 12px', overflow: 'hidden', gap: 12 }}>

          {/* LEFT COLUMN: Captions + AI Output (60% width) */}
          <div style={{ flex: 1.6, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid rgba(63,63,70,.35)', paddingRight: 12, gap: 6 }}>
            
            {/* Caption history header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, fontWeight: 700, color: '#34d399', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                <Sparkles size={9} style={{ color: '#818cf8' }} /> Live Captions
                {captions.length > 0 && (
                  <span style={{ background: 'rgba(99,102,241,.2)', color: '#a5b4fc', padding: '0 5px', borderRadius: 999, fontSize: 8 }}>{captions.length}</span>
                )}
              </div>
              {captions.length > 0 && (
                <button
                  onClick={() => setCaptions([])}
                  style={{ fontSize: 8, color: '#52525b', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px' }}
                >Clear</button>
              )}
            </div>

            {/* Error banner */}
            {micError && (
              <div style={{ padding: '5px 8px', background: 'rgba(248,113,113,.08)', borderRadius: 8, border: '1px solid rgba(248,113,113,.2)', display: 'flex', alignItems: 'flex-start', gap: 5 }}>
                <AlertCircle size={10} style={{ color: '#f87171', marginTop: 1, flexShrink: 0 }} />
                <p style={{ margin: 0, fontSize: 9.5, color: '#fecaca', lineHeight: 1.35 }}>
                  {micError}
                </p>
              </div>
            )}

            {/* Caption scroll area */}
            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4, minHeight: 0 }}>

              {/* Empty state */}
              {captions.length === 0 && !interimCaption && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 4, opacity: 0.4 }}>
                  <Mic size={18} style={{ color: '#52525b' }} />
                  <p style={{ margin: 0, fontSize: 9, color: '#52525b', textAlign: 'center', lineHeight: 1.4 }}>
                    {audioMode === 'off'
                      ? 'Click the mic button to start capturing audio'
                      : 'Listening… speak now'}
                  </p>
                </div>
              )}

              {/* Caption entries */}
              {captions.map(c => (
                <div key={c.id} style={{ padding: '4px 7px', background: 'rgba(255,255,255,.03)', borderRadius: 7, border: `1px solid rgba(${speakerColor(c.speaker) === '#818cf8' ? '129,140,248' : speakerColor(c.speaker) === '#34d399' ? '52,211,153' : '245,158,11'},.12)` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: speakerColor(c.speaker) }}>{c.speaker}</span>
                    <span style={{ fontSize: 8, color: '#3f3f46' }}>{c.timestamp}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 10, color: '#d4d4d8', lineHeight: 1.4 }}>{c.text}</p>
                </div>
              ))}

              {/* Interim (live) caption */}
              {interimCaption && (
                <div style={{ padding: '4px 7px', background: 'rgba(99,102,241,.06)', borderRadius: 7, border: '1px solid rgba(99,102,241,.2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
                    <span style={{ fontSize: 8, fontWeight: 700, color: '#818cf8' }}>Me (live)</span>
                    <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: '#818cf8', animation: 'pulse 1s ease infinite' }} />
                  </div>
                  <p style={{ margin: 0, fontSize: 10, color: '#a5b4fc', fontStyle: 'italic', lineHeight: 1.4 }}>{interimCaption}</p>
                </div>
              )}

              {/* Speaker mode interim */}
              {audioMode === 'speaker' && !interimCaption && captions.length > 0 && (
                <div style={{ padding: '3px 7px', borderRadius: 7, border: '1px dashed rgba(52,211,153,.2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ display: 'inline-block', width: 4, height: 4, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1s ease infinite' }} />
                  <p style={{ margin: 0, fontSize: 9, color: '#52525b', fontStyle: 'italic' }}>Capturing mic + speaker…</p>
                </div>
              )}

              <div ref={captionEndRef} />
            </div>

            {/* AI Answer area (Single continuous scrollable feed per session/day) */}
            <div style={{ borderTop: '1px solid rgba(63,63,70,.3)', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 6, flex: 1.2, minHeight: 0 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: '#818cf8', textTransform: 'uppercase', letterSpacing: '.06em', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Sparkles size={8} /> AI Answers {activeDay ? `(${activeDay.qas.length})` : ''}
                </span>
                {activeDay && (
                  <span style={{ fontSize: 7.5, color: '#71717a', textTransform: 'none' }}>{activeDay.displayDate}</span>
                )}
              </div>

              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 0, paddingRight: 2 }}>
                {loading && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 6px', background: 'rgba(99,102,241,.1)', borderRadius: 6 }}>
                    <Loader2 size={12} style={{ color: '#6366f1', animation: 'spin 0.6s linear infinite' }} />
                    <span style={{ fontSize: 9.5, color: '#a5b4fc' }}>Generating AI answer…</span>
                  </div>
                )}

                {activeDay && activeDay.qas.length > 0 ? (
                  activeDay.qas.map(qa => (
                    <div key={qa.id} style={{ padding: '6px 8px', background: 'rgba(255,255,255,.03)', borderRadius: 8, border: '1px solid rgba(129,140,248,.15)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: 9.5, fontWeight: 700, color: '#a5b4fc' }}>❓ {qa.question}</span>
                        <span style={{ fontSize: 7.5, color: '#52525b' }}>{qa.timestamp}</span>
                      </div>
                      {qa.code && (
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 2, fontSize: 8, fontWeight: 700, color: '#34d399', textTransform: 'uppercase' }}>
                            <Code2 size={8} /> Code
                          </div>
                          <pre style={{ margin: 0, fontSize: 9, color: '#6ee7b7', background: 'rgba(0,0,0,.55)', borderRadius: 6, padding: '5px 8px', border: '1px solid rgba(52,211,153,.15)', overflowX: 'auto', fontFamily: "'Fira Code',monospace", lineHeight: 1.4, whiteSpace: 'pre' }}>
                            <code>{qa.code}</code>
                          </pre>
                        </div>
                      )}
                      <p style={{ margin: 0, fontSize: 9.5, color: '#e4e4e7', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
                        {qa.text}
                      </p>
                    </div>
                  ))
                ) : !loading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, opacity: 0.4 }}>
                    <p style={{ margin: 0, fontSize: 9, color: '#71717a', textAlign: 'center' }}>
                      Ask a technical question to see AI answers here
                    </p>
                  </div>
                ) : null}
                <div ref={answerFeedEndRef} />
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Pipeline Status + Input (40% width) */}
          <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', minWidth: 0, gap: 6 }}>
            
            {/* Pipeline Status Panel */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, color: '#71717a', textTransform: 'uppercase', letterSpacing: '.06em' }}>Pipeline</div>
              {pipeline.map(stage => (
                <div key={stage.label} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '2px 6px', borderRadius: 5,
                  background: stage.status === 'error' ? 'rgba(239,68,68,.07)' : stage.status === 'ok' ? 'rgba(34,197,94,.05)' : stage.status === 'pending' ? 'rgba(245,158,11,.07)' : 'transparent'
                }}>
                  <StageIcon status={stage.status} />
                  <span style={{ fontSize: 9, color: stage.status === 'error' ? '#fca5a5' : stage.status === 'ok' ? '#86efac' : stage.status === 'pending' ? '#fbbf24' : '#3f3f46', flex: 1 }}>
                    {stage.label}
                  </span>
                  {stage.detail && (
                    <span style={{ fontSize: 7.5, color: '#52525b', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={stage.detail}>
                      {stage.detail}
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Instruction hint */}
            <div style={{ fontSize: 8.5, color: '#3f3f46', lineHeight: 1.4, borderTop: '1px solid rgba(63,63,70,.25)', paddingTop: 5 }}>
              {audioMode === 'off' && '🎙 = your mic  →  🔊 = mic+speaker'}
              {audioMode === 'mic' && '🎙 Mic active. Click again for speaker mode.'}
              {audioMode === 'speaker' && '🎙+🔊 Combined. Click to stop.'}
            </div>

            <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Latest Q preview */}
              {latestQA && (
                <div style={{ padding: '7px 9px', background: 'rgba(255,255,255,.03)', borderRadius: 9, border: '1px solid rgba(255,255,255,.05)' }}>
                  <p style={{ margin: 0, fontSize: 9, color: '#71717a', fontWeight: 600, marginBottom: 2 }}>❓ Latest Q</p>
                  <p style={{ margin: 0, fontSize: 10, color: '#e4e4e7', fontWeight: 600, lineHeight: 1.4 }}>
                    {latestQA.question}
                  </p>
                </div>
              )}

              {/* Screen capture input prompt */}
              {capturedScreen !== null && (
                <div style={{ padding: '7px 9px', background: 'rgba(99,102,241,.1)', borderRadius: 9, border: '1px solid rgba(99,102,241,.25)' }}>
                  <p style={{ fontSize: 9, color: '#a5b4fc', fontWeight: 600, margin: '0 0 5px 0' }}>📸 Screen captured! What do you need?</p>
                  <form onSubmit={submitScreenInput} style={{ display: 'flex', gap: 5 }}>
                    <input
                      autoFocus
                      type="text" value={screenInput} onChange={e => setScreenInput(e.target.value)}
                      placeholder='e.g. "Java code", "explain this"'
                      style={{ flex: 1, background: 'rgba(0,0,0,.4)', border: '1px solid rgba(99,102,241,.3)', borderRadius: 5, padding: '3px 7px', fontSize: 9.5, color: '#e4e4e7', outline: 'none', fontFamily: 'inherit' }}
                    />
                    <button type="submit" style={{ padding: '3px 8px', borderRadius: 5, background: '#6366f1', color: '#fff', border: 'none', fontSize: 9, fontWeight: 700, cursor: 'pointer' }}>Go</button>
                  </form>
                </div>
              )}
            </div>

            {/* Manual text input */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'center', position: 'relative', marginTop: 4 }}>
              <input
                type="text" value={inputVal} onChange={e => setInputVal(e.target.value)}
                placeholder={
                  audioMode === 'mic' ? '🎙️ Listening to mic...' :
                  audioMode === 'speaker' ? '🔊 Combined capturing...' :
                  'Type question...'
                }
                style={{ width: '100%', background: 'rgba(0,0,0,.3)', border: '1px solid rgba(63,63,70,.4)', borderRadius: 8, padding: '6px 30px 6px 10px', fontSize: 10, color: '#e4e4e7', outline: 'none', fontFamily: 'inherit', caretColor: '#818cf8' } as any}
              />
              <button type="submit" disabled={!inputVal.trim()}
                style={{ position: 'absolute', right: 8, padding: 4, border: 'none', background: 'transparent', color: inputVal.trim() ? '#818cf8' : '#3f3f46', cursor: inputVal.trim() ? 'pointer' : 'default' }}>
                <Send size={11} />
              </button>
            </form>
          </div>

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
          <button onClick={() => setDayIdx(p => Math.max(0, p - 1))} disabled={dayIdx <= 0}
            style={{ padding: 3, border: 'none', background: 'transparent', color: dayIdx <= 0 ? '#3f3f46' : '#71717a', cursor: dayIdx <= 0 ? 'default' : 'pointer' }}>
            <ChevronLeft size={13} />
          </button>
          <span style={{ fontSize: 9, color: '#a5b4fc', fontWeight: 700, padding: '0 4px' }}>
            {dayGroups.length > 0 ? `${activeDay?.displayDate || 'Today'} (${dayIdx + 1}/${dayGroups.length})` : '0/0'}
          </span>
          <button onClick={() => setDayIdx(p => Math.min(dayGroups.length - 1, p + 1))} disabled={dayIdx >= dayGroups.length - 1}
            style={{ padding: 3, border: 'none', background: 'transparent', color: dayIdx >= dayGroups.length - 1 ? '#3f3f46' : '#71717a', cursor: dayIdx >= dayGroups.length - 1 ? 'default' : 'pointer' }}>
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Caption count summary */}
        <span style={{ fontSize: 8.5, color: '#3f3f46', flexShrink: 0 }}>
          {captions.length > 0 ? `${captions.length} caption${captions.length !== 1 ? 's' : ''} captured` : 'No captions yet'}
        </span>

        <span style={{ fontSize: 9, color: '#3f3f46', flexShrink: 0, marginLeft: 'auto' }}>
          {audioMode === 'off' ? '🎙=mic 🔊=combined' : audioMode === 'mic' ? '🎙 Mic active' : '🎙+🔊 Combined active'}
        </span>
      </div>

      <style>{`
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
      `}</style>
    </div>
  );
}
