import { useState, useRef, useCallback, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

const getSocketUrl = () => {
  const baseUrl = import.meta.env.VITE_API_URL || 'https://careercopilot-hu7q.onrender.com';
  return baseUrl.replace(/\/api\/?$/, '');
};

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

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export type ScreenShareStatus = 
  | 'idle'
  | 'connecting'
  | 'sharing'
  | 'connected'
  | 'disconnected'
  | 'stopped'
  | 'expired'
  | 'error';

export interface ActiveSessionInfo {
  sessionId: string;
  password?: string;
  expiresAt: string;
  status: string;
}

export function useScreenShare() {
  const [status, setStatus] = useState<ScreenShareStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [activeSession, setActiveSession] = useState<ActiveSessionInfo | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  // Initialize socket connection
  const initSocket = useCallback(() => {
    if (socketRef.current && socketRef.current.connected) {
      return socketRef.current;
    }
    const socket = io(getSocketUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    socketRef.current = socket;
    return socket;
  }, []);

  // Cleanup WebRTC & Socket
  const cleanup = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    setLocalStream(null);
    setRemoteStream(null);
  }, []);

  // Ensure cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  /**
   * Candidate: Start explicit screen capture and create session
   */
  const startScreenShare = useCallback(async (selectedSourceId?: string) => {
    try {
      setStatus('connecting');
      setErrorMsg('');

      let stream: MediaStream;

      // Check if running in Electron
      const isElectron = !!(window as any).electronAPI;
      if (isElectron) {
        let sourceIdToUse = selectedSourceId;
        if (!sourceIdToUse && (window as any).electronAPI?.getScreenSources) {
          try {
            const sources = await (window as any).electronAPI.getScreenSources();
            const screenSource = sources.find((s: any) => s.id.startsWith('screen:')) || sources[0];
            if (screenSource) {
              sourceIdToUse = screenSource.id;
            }
          } catch (e) {
            console.warn('[SCREEN-SHARE] Failed to get desktop sources:', e);
          }
        }

        if (sourceIdToUse) {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sourceIdToUse,
                minWidth: 1280,
                maxWidth: 1920,
                minHeight: 720,
                maxHeight: 1080,
              },
            } as any,
          });
        } else {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: 'always' } as any,
            audio: false,
          });
        }
      } else {
        // Browser standard display media prompt (explicit candidate selection)
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { cursor: 'always' } as any,
          audio: false,
        });
      }

      mediaStreamRef.current = stream;
      setLocalStream(stream);

      // Handle track ending (user clicks browser/OS native "Stop Sharing" button)
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => {
          console.log('[SCREEN-SHARE] Track ended by candidate OS controls');
          stopScreenShare();
        };
      }

      // Create session on backend API
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/screen-share/create'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ durationMinutes: 60 }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to create screen share session');
      }

      const sessionData = await response.json();
      setActiveSession({
        sessionId: sessionData.sessionId,
        password: sessionData.password,
        expiresAt: sessionData.expiresAt,
        status: 'active',
      });

      // Setup Socket signaling
      const socket = initSocket();
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      // Add local video track to PeerConnection
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Relay ICE candidates
      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('screen-share:ice-candidate', {
            sessionId: sessionData.sessionId,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[WEBRTC:CANDIDATE] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setStatus('sharing');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setStatus('disconnected');
        }
      };

      // Register as host in socket room
      socket.emit('screen-share:host-register', { sessionId: sessionData.sessionId });

      // When a viewer joins, create and send WebRTC offer
      socket.on('screen-share:viewer-joined', async ({ viewerSocketId }) => {
        console.log('[WEBRTC:CANDIDATE] Viewer joined, creating offer for socket:', viewerSocketId);
        try {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('screen-share:offer', {
            sessionId: sessionData.sessionId,
            offer,
            targetSocketId: viewerSocketId,
          });
        } catch (err: any) {
          console.error('[WEBRTC:CANDIDATE] Error creating offer:', err);
        }
      });

      // Handle SDP answer from viewer
      socket.on('screen-share:answer', async ({ answer }) => {
        console.log('[WEBRTC:CANDIDATE] Received SDP answer from viewer');
        try {
          if (pc.signalingState !== 'stable') {
            await pc.setRemoteDescription(new RTCSessionDescription(answer));
          }
        } catch (err: any) {
          console.error('[WEBRTC:CANDIDATE] Error setting remote answer:', err);
        }
      });

      // Handle incoming ICE candidate from viewer
      socket.on('screen-share:ice-candidate', async ({ candidate }) => {
        try {
          if (candidate && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (err: any) {
          console.error('[WEBRTC:CANDIDATE] Error adding ICE candidate:', err);
        }
      });

      // Handle incoming remote mouse & keyboard control inputs from viewer
      socket.on('screen-share:remote-input', ({ input }) => {
        const isElectron = !!(window as any).electronAPI;
        if (isElectron && (window as any).electronAPI?.executeRemoteInput) {
          (window as any).electronAPI.executeRemoteInput(input);
        }
      });

      setStatus('sharing');
      return sessionData;
    } catch (err: any) {
      console.error('[SCREEN-SHARE] Start failed:', err);
      setStatus('error');
      setErrorMsg(err.message || 'Could not start screen sharing');
      cleanup();
      throw err;
    }
  }, [initSocket, cleanup]);

  /**
   * Candidate: Explicitly stop screen sharing session
   */
  const stopScreenShare = useCallback(async () => {
    if (activeSession?.sessionId) {
      try {
        const token = localStorage.getItem('token');
        await fetch(getApiUrl('/api/screen-share/stop'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ sessionId: activeSession.sessionId }),
        });
      } catch (err) {
        console.warn('[SCREEN-SHARE] Error calling stop endpoint:', err);
      }

      if (socketRef.current) {
        socketRef.current.emit('screen-share:stop', { sessionId: activeSession.sessionId });
      }
    }

    cleanup();
    setActiveSession(null);
    setStatus('stopped');
  }, [activeSession, cleanup]);

  /**
   * Viewer: Join authorized screen share session with Session ID and Password
   */
  const joinScreenShare = useCallback(async (sessionId: string, password: string) => {
    try {
      setStatus('connecting');
      setErrorMsg('');

      const cleanSessionId = sessionId.trim().toUpperCase();
      const cleanPassword = password.trim().toUpperCase();

      // Validate credentials against backend REST API
      const token = localStorage.getItem('token');
      const response = await fetch(getApiUrl('/api/screen-share/join'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ sessionId: cleanSessionId, password: cleanPassword }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Invalid Session ID or Password');
      }

      const joinData = await response.json();
      setActiveSession({
        sessionId: joinData.sessionId,
        expiresAt: joinData.expiresAt,
        status: 'active',
      });

      // Initialize Socket signaling & RTCPeerConnection for viewer
      const socket = initSocket();
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      // Handle incoming remote screen stream track
      pc.ontrack = (event) => {
        console.log('[WEBRTC:VIEWER] Received remote stream track:', event.track.kind);
        if (event.streams && event.streams[0]) {
          setRemoteStream(event.streams[0]);
          setStatus('connected');
        }
      };

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit('screen-share:ice-candidate', {
            sessionId: cleanSessionId,
            candidate: event.candidate,
          });
        }
      };

      pc.onconnectionstatechange = () => {
        console.log('[WEBRTC:VIEWER] Connection state:', pc.connectionState);
        if (pc.connectionState === 'connected') {
          setStatus('connected');
        } else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setStatus('disconnected');
        }
      };

      // Handle WebRTC SDP offer from host candidate
      socket.on('screen-share:offer', async ({ offer, senderSocketId }) => {
        console.log('[WEBRTC:VIEWER] Received SDP offer from host');
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('screen-share:answer', {
            sessionId: cleanSessionId,
            answer,
            targetSocketId: senderSocketId,
          });
        } catch (err: any) {
          console.error('[WEBRTC:VIEWER] Error handling offer:', err);
        }
      });

      // Handle ICE candidates from host candidate
      socket.on('screen-share:ice-candidate', async ({ candidate }) => {
        try {
          if (candidate && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (err: any) {
          console.error('[WEBRTC:VIEWER] Error adding ICE candidate:', err);
        }
      });

      // Handle host stopping screen share
      socket.on('screen-share:stopped', () => {
        console.log('[WEBRTC:VIEWER] Candidate stopped screen sharing');
        setStatus('stopped');
        cleanup();
      });

      socket.on('screen-share:host-disconnected', () => {
        console.log('[WEBRTC:VIEWER] Candidate host disconnected');
        setStatus('disconnected');
      });

      // Join socket room
      socket.emit('screen-share:join-room', { sessionId: cleanSessionId });

    } catch (err: any) {
      console.error('[SCREEN-SHARE:VIEWER] Join failed:', err);
      setStatus('error');
      setErrorMsg(err.message || 'Could not connect to screen sharing session');
      cleanup();
      throw err;
    }
  }, [initSocket, cleanup]);

  /**
   * Viewer: Disconnect from stream
   */
  const disconnectViewer = useCallback(() => {
    cleanup();
    setActiveSession(null);
    setStatus('idle');
  }, [cleanup]);

  /**
   * Viewer: Send remote mouse/keyboard control input to candidate host
   */
  const sendRemoteInput = useCallback((input: any) => {
    if (socketRef.current && activeSession?.sessionId) {
      socketRef.current.emit('screen-share:remote-input', {
        sessionId: activeSession.sessionId,
        input,
      });
    }
  }, [activeSession]);

  return {
    status,
    errorMsg,
    activeSession,
    localStream,
    remoteStream,
    startScreenShare,
    stopScreenShare,
    joinScreenShare,
    disconnectViewer,
    sendRemoteInput,
  };
}
