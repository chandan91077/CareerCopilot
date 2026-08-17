import React, { useState, useEffect, useRef } from 'react';
import { 
  Monitor, 
  ShieldCheck, 
  Copy, 
  Check, 
  Square, 
  Play, 
  AlertCircle, 
  Info, 
  Lock, 
  KeyRound,
  ExternalLink
} from 'lucide-react';
import { useScreenShare } from '../services/useScreenShare';

export default function CandidateScreenShare() {
  const {
    status,
    errorMsg,
    activeSession,
    localStream,
    startScreenShare,
    stopScreenShare,
  } = useScreenShare();

  const [copiedId, setCopiedId] = useState(false);
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [electronSources, setElectronSources] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string>('');

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const isElectron = !!(window as any).electronAPI;

  // Attach local stream to video element when available
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Fetch available electron sources if running inside Electron shell
  useEffect(() => {
    if (isElectron && (window as any).electronAPI.getScreenSources) {
      (window as any).electronAPI.getScreenSources().then((sources: any[]) => {
        if (sources && sources.length > 0) {
          setElectronSources(sources);
          setSelectedSourceId(sources[0].id);
        }
      });
    }
  }, [isElectron]);

  const copyToClipboard = (text: string, type: 'id' | 'password' | 'all') => {
    navigator.clipboard.writeText(text);
    if (type === 'id') {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    } else if (type === 'password') {
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    } else if (type === 'all') {
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const isSharing = status === 'sharing';

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <Monitor className="w-8 h-8 text-indigo-500" />
            Screen Sharing
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Share your screen securely with an authorized interviewer or evaluation session.
          </p>
        </div>

        {/* Status Indicator Pill */}
        <div className="flex items-center gap-2">
          {isSharing ? (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              Connected / Sharing
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold bg-slate-100 dark:bg-dark-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400"></span>
              Not Sharing
            </span>
          )}
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Screen Sharing Error</p>
            <p className="mt-0.5">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Control Box */}
        <div className="lg:col-span-6 space-y-6">
          {!isSharing ? (
            <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-center gap-3 text-indigo-600 dark:text-indigo-400">
                <ShieldCheck className="w-6 h-6" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Consent-Based Screen Sharing
                </h2>
              </div>

              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed">
                When you start screen sharing, you will explicitly select which window or monitor to broadcast. A unique single-use <strong>Session ID</strong> and <strong>Temporary Password</strong> will be generated.
              </p>

              {/* Electron Source Selector Dropdown */}
              {isElectron && electronSources.length > 0 && (
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Select Capture Window / Monitor:
                  </label>
                  <select
                    value={selectedSourceId}
                    onChange={(e) => setSelectedSourceId(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-dark-800 text-slate-800 dark:text-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    {electronSources.map((src) => (
                      <option key={src.id} value={src.id}>
                        {src.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-2">
                <button
                  onClick={() => startScreenShare(selectedSourceId)}
                  disabled={status === 'connecting'}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold shadow-lg shadow-indigo-500/25 transition-all duration-200 disabled:opacity-50"
                >
                  {status === 'connecting' ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Initializing Stream...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current" />
                      Start Screen Sharing
                    </>
                  )}
                </button>
              </div>

              <div className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
                <span>
                  No video frames are stored on the server. Your stream flows peer-to-peer over encrypted WebRTC directly to authorized viewers.
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-dark-900 border border-emerald-500/30 dark:border-emerald-500/20 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></span>
                  Active Sharing Credentials
                </h2>
                <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                  Active
                </span>
              </div>

              {/* Session Credentials Card */}
              {activeSession && (
                <div className="space-y-4 bg-slate-50 dark:bg-dark-950/70 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
                  {/* Session ID */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-500" />
                      Session ID
                    </label>
                    <div className="flex items-center justify-between bg-white dark:bg-dark-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                      <span className="font-mono text-lg font-extrabold tracking-widest text-indigo-600 dark:text-indigo-400">
                        {activeSession.sessionId}
                      </span>
                      <button
                        onClick={() => copyToClipboard(activeSession.sessionId, 'id')}
                        className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-dark-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:text-indigo-600 flex items-center gap-1.5 transition-colors"
                      >
                        {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedId ? 'Copied!' : 'Copy ID'}
                      </button>
                    </div>
                  </div>

                  {/* Temporary Password */}
                  {activeSession.password && (
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1 flex items-center gap-1.5">
                        <KeyRound className="w-3.5 h-3.5 text-purple-500" />
                        Temporary Password
                      </label>
                      <div className="flex items-center justify-between bg-white dark:bg-dark-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                        <span className="font-mono text-lg font-extrabold tracking-widest text-purple-600 dark:text-purple-400">
                          {activeSession.password}
                        </span>
                        <button
                          onClick={() => copyToClipboard(activeSession.password || '', 'password')}
                          className="px-3 py-1.5 rounded-md bg-slate-100 dark:bg-dark-800 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-purple-50 dark:hover:bg-purple-950/40 hover:text-purple-600 flex items-center gap-1.5 transition-colors"
                        >
                          {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedPassword ? 'Copied!' : 'Copy Password'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Copy All Credentials Button */}
                  {activeSession.password && (
                    <button
                      onClick={() =>
                        copyToClipboard(
                          `Session ID: ${activeSession.sessionId}\nPassword: ${activeSession.password}`,
                          'all'
                        )
                      }
                      className="w-full py-2 px-3 rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50 flex items-center justify-center gap-2 transition-colors"
                    >
                      {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedAll ? 'Credentials Copied to Clipboard!' : 'Copy All Credentials'}
                    </button>
                  )}
                </div>
              )}

              {/* Stop Sharing Button */}
              <button
                onClick={stopScreenShare}
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold shadow-lg shadow-rose-600/20 transition-all duration-200"
              >
                <Square className="w-4 h-4 fill-current" />
                Stop Screen Sharing
              </button>
            </div>
          )}
        </div>

        {/* Right Column: Live Stream Preview */}
        <div className="lg:col-span-6 space-y-4">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-4 shadow-xl flex flex-col h-full min-h-[320px]">
            <div className="flex items-center justify-between mb-3 px-1">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Monitor className="w-4 h-4 text-slate-400" />
                Live Broadcast Preview
              </span>
              <span className="text-xs text-slate-400">
                {isSharing ? 'Local WebRTC Stream' : 'Offline'}
              </span>
            </div>

            <div className="relative flex-1 bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-slate-800">
              {isSharing && localStream ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-contain bg-black"
                />
              ) : (
                <div className="text-center p-8 space-y-3">
                  <div className="w-14 h-14 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-600">
                    <Monitor className="w-7 h-7" />
                  </div>
                  <p className="text-sm font-medium text-slate-400">
                    No active screen stream. Click "Start Screen Sharing" to broadcast.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
