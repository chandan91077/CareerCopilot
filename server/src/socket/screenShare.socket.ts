import { Server as SocketServer, Socket } from 'socket.io';
import { ScreenShareService } from '../services/screenShare.service';

export function setupScreenShareSocket(io: SocketServer) {
  io.on('connection', (socket: Socket) => {
    console.log(`[SOCKET:SCREEN-SHARE] Client connected: ${socket.id}`);

    // Candidate registers as host/presenter for a session room
    socket.on('screen-share:host-register', async (data: { sessionId: string }) => {
      const { sessionId } = data;
      if (!sessionId) return;
      const room = `screen-share:${sessionId.toUpperCase()}`;
      socket.join(room);
      (socket as any).screenSessionId = sessionId.toUpperCase();
      (socket as any).isHost = true;
      console.log(`[SOCKET:SCREEN-SHARE] Host registered in room ${room} (Socket: ${socket.id})`);
      io.to(room).emit('screen-share:host-ready', { sessionId, hostSocketId: socket.id });
    });

    // Viewer joins an authorized screen sharing session room
    socket.on('screen-share:join-room', async (data: { sessionId: string }) => {
      const { sessionId } = data;
      if (!sessionId) return;

      const cleanSessionId = sessionId.toUpperCase();
      const session = await ScreenShareService.getSession(cleanSessionId);

      if (!session || session.status !== 'active') {
        socket.emit('screen-share:error', { message: 'Session is not active or expired' });
        return;
      }

      const room = `screen-share:${cleanSessionId}`;
      socket.join(room);
      (socket as any).screenSessionId = cleanSessionId;
      (socket as any).isHost = false;
      console.log(`[SOCKET:SCREEN-SHARE] Viewer joined room ${room} (Socket: ${socket.id})`);

      // Notify the host candidate that a viewer has joined and is ready for WebRTC offer
      socket.to(room).emit('screen-share:viewer-joined', {
        sessionId: cleanSessionId,
        viewerSocketId: socket.id,
      });
    });

    // Candidate sends SDP offer to viewer
    socket.on('screen-share:offer', (data: { sessionId: string; offer: any; targetSocketId?: string }) => {
      const { sessionId, offer, targetSocketId } = data;
      const room = `screen-share:${sessionId.toUpperCase()}`;
      console.log(`[SOCKET:SCREEN-SHARE] Relaying WebRTC SDP offer in room ${room}`);

      if (targetSocketId) {
        io.to(targetSocketId).emit('screen-share:offer', { offer, senderSocketId: socket.id });
      } else {
        socket.to(room).emit('screen-share:offer', { offer, senderSocketId: socket.id });
      }
    });

    // Viewer sends SDP answer back to candidate
    socket.on('screen-share:answer', (data: { sessionId: string; answer: any; targetSocketId?: string }) => {
      const { sessionId, answer, targetSocketId } = data;
      const room = `screen-share:${sessionId.toUpperCase()}`;
      console.log(`[SOCKET:SCREEN-SHARE] Relaying WebRTC SDP answer in room ${room}`);

      if (targetSocketId) {
        io.to(targetSocketId).emit('screen-share:answer', { answer, senderSocketId: socket.id });
      } else {
        socket.to(room).emit('screen-share:answer', { answer, senderSocketId: socket.id });
      }
    });

    // ICE Candidate relay
    socket.on('screen-share:ice-candidate', (data: { sessionId: string; candidate: any; targetSocketId?: string }) => {
      const { sessionId, candidate, targetSocketId } = data;
      const room = `screen-share:${sessionId.toUpperCase()}`;

      if (targetSocketId) {
        io.to(targetSocketId).emit('screen-share:ice-candidate', { candidate, senderSocketId: socket.id });
      } else {
        socket.to(room).emit('screen-share:ice-candidate', { candidate, senderSocketId: socket.id });
      }
    });

    // Candidate explicitly stops screen sharing
    socket.on('screen-share:stop', (data: { sessionId: string }) => {
      const { sessionId } = data;
      const room = `screen-share:${sessionId.toUpperCase()}`;
      console.log(`[SOCKET:SCREEN-SHARE] Host stopped screen sharing in room ${room}`);
      io.to(room).emit('screen-share:stopped', { sessionId });
    });

    // Handle disconnects
    socket.on('disconnect', () => {
      const sessionId = (socket as any).screenSessionId;
      const isHost = (socket as any).isHost;

      if (sessionId) {
        const room = `screen-share:${sessionId}`;
        console.log(`[SOCKET:SCREEN-SHARE] Socket ${socket.id} (${isHost ? 'Host' : 'Viewer'}) disconnected from ${room}`);
        if (isHost) {
          io.to(room).emit('screen-share:host-disconnected', { sessionId });
        } else {
          io.to(room).emit('screen-share:viewer-disconnected', { sessionId, viewerSocketId: socket.id });
        }
      }
    });
  });
}
