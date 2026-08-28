import { io } from 'socket.io-client';

export const socket = io(
  import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001',
  {
    autoConnect: false,
    transports: ['websocket', 'polling']
  }
);
