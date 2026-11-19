import { io, type Socket } from 'socket.io-client';
import type { ServerToClientEvents, ClientToServerEvents } from '@etheria/protocol';

export type EtheriaSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socketInstance: EtheriaSocket | null = null;

export function getSocket(): EtheriaSocket {
  if (!socketInstance) {
    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
    socketInstance = io(socketUrl, {
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socketInstance;
}
