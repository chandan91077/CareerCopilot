import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Tv, 
  Lock, 
  KeyRound, 
  LogIn, 
  Square, 
  AlertCircle, 
  Clock, 
  WifiOff, 
  Eye, 
  EyeOff,
  MousePointer,
  Keyboard
} from 'lucide-react';
import { useScreenShare, ScreenShareStatus } from '../services/useScreenShare';

export default function ScreenShareViewer() {
  const {
    status,
    errorMsg,
    activeSession,
    remoteStream,
    joinScreenShare,
    disconnectViewer,
    sendRemoteInput,
  } = useScreenShare();

  const [sessionId, setSessionId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remoteControlEnabled, setRemoteControlEnabled] = useState(true);

  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMoveTimeRef = useRef<number>(0);

  // Attach remote stream to video element
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const getNormalizedCoordinates = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return { xRatio: 0.5, yRatio: 0.5 };
    const rect = containerRef.current.getBoundingClientRect();
    const xRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const yRatio = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    return { xRatio, yRatio };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!remoteControlEnabled || status !== 'connected') return;
    const now = Date.now();
    if (now - lastMoveTimeRef.current < 30) return; // Throttle ~30ms
    lastMoveTimeRef.current = now;

    const { xRatio, yRatio } = getNormalizedCoordinates(e);
    sendRemoteInput({ type: 'mousemove', xRatio, yRatio });
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!remoteControlEnabled || status !== 'connected') return;
    const { xRatio, yRatio } = getNormalizedCoordinates(e);
    const button = e.button === 2 ? 'right' : 'left';
    sendRemoteInput({ type: 'mousedown', button, xRatio, yRatio });
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!remoteControlEnabled || status !== 'connected') return;
    const { xRatio, yRatio } = getNormalizedCoordinates(e);
    const button = e.button === 2 ? 'right' : 'left';
    sendRemoteInput({ type: 'mouseup', button, xRatio, yRatio });
  };

  const handleContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!remoteControlEnabled || status !== 'connected') return;
    const { xRatio, yRatio } = getNormalizedCoordinates(e);
    sendRemoteInput({ type: 'click', button: 'right', xRatio, yRatio });
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!remoteControlEnabled || status !== 'connected') return;
    sendRemoteInput({ type: 'wheel', deltaY: e.deltaY });
  };

  // Global keyboard listener when viewer is connected & remote control is ON
  useEffect(() => {
    if (!remoteControlEnabled || status !== 'connected') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture inputs if user is typing into input fields
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      sendRemoteInput({ type: 'keydown', key: e.key });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;
      sendRemoteInput({ type: 'keyup', key: e.key });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [remoteControlEnabled, status, sendRemoteInput]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId || !password) return;
    try {
      await joinScreenShare(sessionId, password);
    } catch (_) {
      // Error is handled in useScreenShare state
    }
  };

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting';

  const renderStatusBadge = (currentStatus: ScreenShareStatus) => {
    switch (currentStatus) {
      case 'connected':
        return (
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            ● Connected
          </span>
        );
      case 'connecting':
        return (
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-spin"></span>
            Connecting...
          </span>
        );
      case 'stopped':
        return (
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <WifiOff className="w-3.5 h-3.5" />
            Sharing Stopped
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20">
            <Clock className="w-3.5 h-3.5" />
            Session Expired
          </span>
        );
      case 'disconnected':
        return (
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            Disconnected
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-dark-800 text-slate-500">
            Offline
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800/80 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white flex items-center gap-3">
            <Tv className="w-8 h-8 text-indigo-500" />
            Join Screen Sharing Session
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Enter the authorized candidate Session ID and Temporary Password to view real-time screen stream & remote control.
          </p>
        </div>

        <div>{renderStatusBadge(status)}</div>
      </div>

      {/* Main Container */}
      {!isConnected ? (
        <div className="max-w-md mx-auto">
          <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800/80 rounded-2xl p-8 shadow-2xl space-y-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Session Credentials
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Credentials are provided directly by the candidate.
              </p>
            </div>

            {errorMsg && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-start gap-3 text-xs">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Authentication Failed</p>
                  <p className="mt-0.5">{errorMsg}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleConnect} className="space-y-5">
              {/* Session ID Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Session ID
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="e.g. PREP-8F42K9"
                    value={sessionId}
                    onChange={(e) => setSessionId(e.target.value.toUpperCase())}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-dark-800 text-slate-900 dark:text-white font-mono text-sm uppercase placeholder:normal-case focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Temporary Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="e.g. 7X9P2Q"
                    value={password}
                    onChange={(e) => setPassword(e.target.value.toUpperCase())}
                    className="w-full pl-10 pr-10 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-dark-800 text-slate-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isConnecting || !sessionId || !password}
                className="w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold shadow-lg shadow-indigo-500/25 transition-all duration-200 disabled:opacity-50"
              >
                {isConnecting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Authenticating & Connecting...
                  </>
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    Connect to Stream
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Video Stream Player with Remote Mouse & Keyboard Control */
        <div className="bg-white dark:bg-dark-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-2xl space-y-4">
          {/* Top Video Control Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 px-2">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/40 px-3 py-1 rounded-lg border border-indigo-200 dark:border-indigo-900/60">
                Session: {activeSession?.sessionId}
              </span>
              
              {/* Remote Control Toggle */}
              <button
                onClick={() => setRemoteControlEnabled(!remoteControlEnabled)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  remoteControlEnabled
                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                    : 'bg-slate-100 dark:bg-dark-800 text-slate-500 border-slate-300 dark:border-slate-700'
                }`}
              >
                <MousePointer className="w-3.5 h-3.5" />
                <Keyboard className="w-3.5 h-3.5" />
                Remote Control: {remoteControlEnabled ? 'ON' : 'OFF'}
              </button>
            </div>

            <button
              onClick={disconnectViewer}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-all"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Disconnect Stream
            </button>
          </div>

          {/* Remote Interactive Screen Window */}
          <div
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onContextMenu={handleContextMenu}
            onWheel={handleWheel}
            className={`relative aspect-video w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center ${
              remoteControlEnabled ? 'cursor-crosshair' : 'cursor-default'
            }`}
          >
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              controls={false}
              className="w-full h-full object-contain bg-black select-none pointer-events-none"
            />
          </div>
        </div>
      )}
    </div>
  );
}
