/**
 * SATorrent Node.js Signaling Server & Web Host
 *
 * Handles ONLY:
 * - Room creation & membership
 * - WebRTC signaling (offers, answers, ICE candidates)
 * - Peer discovery & presence
 *
 * NEVER receives, stores, or routes file data or pieces.
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import {
  SignalingClientMessage,
  SignalingServerMessage,
  PeerInfo,
} from './src/types';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);
const DEFAULT_MAX_PEERS = 8;

interface PeerSocket {
  peerId: string;
  roomCode?: string;
  ws: WebSocket;
  joinedAt: number;
}

interface Room {
  roomCode: string;
  hostId: string;
  createdAt: number;
  maxPeers: number;
  peers: Map<string, PeerSocket>;
}

const app = express();
const server = http.createServer(app);

// WebSocket Signaling Server attached to /ws path on port 3000
const wss = new WebSocketServer({ server, path: '/ws' });

const rooms = new Map<string, Room>();
const clients = new Map<WebSocket, PeerSocket>();

function log(module: string, message: string) {
  const timestamp = new Date().toISOString().substring(11, 19);
  console.log(`[${timestamp}] [${module}] ${message}`);
}

function sendTo(ws: WebSocket, message: SignalingServerMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

wss.on('connection', (ws: WebSocket, req) => {
  log('WS', `New client connection from ${req.socket.remoteAddress || 'unknown'}`);

  const peerEntry: PeerSocket = {
    peerId: '',
    ws,
    joinedAt: Date.now(),
  };
  clients.set(ws, peerEntry);

  ws.on('message', (raw: Buffer | string) => {
    try {
      const msg: SignalingClientMessage = JSON.parse(raw.toString());
      handleMessage(ws, peerEntry, msg);
    } catch (err: any) {
      log('WS_ERROR', `Failed to parse message: ${err.message}`);
    }
  });

  ws.on('close', () => {
    handleDisconnect(ws, peerEntry);
  });

  ws.on('error', (err) => {
    log('WS_ERROR', `Client error (${peerEntry.peerId || 'anonymous'}): ${err.message}`);
  });
});

function handleMessage(ws: WebSocket, peer: PeerSocket, msg: SignalingClientMessage) {
  switch (msg.type) {
    case 'room-create': {
      peer.peerId = msg.peerId;
      const roomCode = (msg.roomCode || generateRoomCode()).toUpperCase();
      const maxPeers = msg.maxPeers || DEFAULT_MAX_PEERS;

      if (rooms.has(roomCode)) {
        sendTo(ws, {
          type: 'error',
          code: 'ROOM_EXISTS',
          message: `Room ${roomCode} already exists.`,
        });
        return;
      }

      const newRoom: Room = {
        roomCode,
        hostId: msg.peerId,
        createdAt: Date.now(),
        maxPeers,
        peers: new Map(),
      };

      peer.roomCode = roomCode;
      newRoom.peers.set(msg.peerId, peer);
      rooms.set(roomCode, newRoom);

      log('ROOM', `Created room "${roomCode}" by host "${msg.peerId}" (capacity: ${maxPeers})`);

      const peersList: PeerInfo[] = [{
        peerId: msg.peerId,
        joinedAt: peer.joinedAt,
        isHost: true,
      }];

      sendTo(ws, {
        type: 'room-created',
        roomCode,
        maxPeers,
        hostId: msg.peerId,
        peers: peersList,
      });
      break;
    }

    case 'room-join': {
      peer.peerId = msg.peerId;
      const roomCode = msg.roomCode.toUpperCase();
      const room = rooms.get(roomCode);

      if (!room) {
        sendTo(ws, {
          type: 'error',
          code: 'ROOM_NOT_FOUND',
          message: `Room "${roomCode}" was not found. Please verify code or create a new room.`,
        });
        return;
      }

      if (room.peers.size >= room.maxPeers) {
        sendTo(ws, {
          type: 'error',
          code: 'ROOM_FULL',
          message: `Room "${roomCode}" is full (maximum ${room.maxPeers} peers reached).`,
        });
        return;
      }

      // Check if peer is already in another room
      if (peer.roomCode && peer.roomCode !== roomCode) {
        leaveCurrentRoom(ws, peer);
      }

      peer.roomCode = roomCode;
      room.peers.set(msg.peerId, peer);

      log('ROOM', `Peer "${msg.peerId}" joined room "${roomCode}" (${room.peers.size}/${room.maxPeers} peers)`);

      // 1. Send room-joined to the newly joined peer with all existing peers
      const existingPeersList: PeerInfo[] = Array.from(room.peers.values()).map((p) => ({
        peerId: p.peerId,
        joinedAt: p.joinedAt,
        isHost: p.peerId === room.hostId,
      }));

      sendTo(ws, {
        type: 'room-joined',
        roomCode,
        maxPeers: room.maxPeers,
        hostId: room.hostId,
        peers: existingPeersList,
      });

      // 2. Notify all other existing peers in the room that a new peer joined
      const joinedNotification: SignalingServerMessage = {
        type: 'peer-joined',
        peer: {
          peerId: msg.peerId,
          joinedAt: peer.joinedAt,
          isHost: msg.peerId === room.hostId,
        },
      };

      for (const [id, target] of room.peers) {
        if (id !== msg.peerId) {
          sendTo(target.ws, joinedNotification);
        }
      }
      break;
    }

    case 'room-leave': {
      leaveCurrentRoom(ws, peer);
      break;
    }

    case 'signal': {
      // Route WebRTC offer / answer / ice-candidate to specific target peer
      if (!peer.roomCode) return;
      const room = rooms.get(peer.roomCode);
      if (!room) return;

      const target = room.peers.get(msg.targetPeerId);
      if (target && target.ws.readyState === WebSocket.OPEN) {
        log('SIGNAL', `Routed "${msg.signalType}" from ${msg.senderPeerId} -> ${msg.targetPeerId}`);
        sendTo(target.ws, {
          type: 'signal',
          senderPeerId: msg.senderPeerId,
          signalType: msg.signalType,
          payload: msg.payload,
        });
      } else {
        log('SIGNAL_DROP', `Target peer "${msg.targetPeerId}" not reachable in room "${peer.roomCode}"`);
      }
      break;
    }

    case 'ping': {
      sendTo(ws, {
        type: 'pong',
        timestamp: Date.now(),
      });
      break;
    }
  }
}

function leaveCurrentRoom(ws: WebSocket, peer: PeerSocket) {
  if (!peer.roomCode) return;
  const room = rooms.get(peer.roomCode);

  if (room) {
    room.peers.delete(peer.peerId);
    log('ROOM', `Peer "${peer.peerId}" left room "${room.roomCode}" (${room.peers.size} remaining)`);

    // Notify remaining peers
    const leaveNotification: SignalingServerMessage = {
      type: 'peer-left',
      peerId: peer.peerId,
    };

    for (const [, other] of room.peers) {
      sendTo(other.ws, leaveNotification);
    }

    // If host left and peers remain, reassign host
    if (room.hostId === peer.peerId && room.peers.size > 0) {
      const nextHost = Array.from(room.peers.values())[0];
      room.hostId = nextHost.peerId;
      log('ROOM', `Host migrated to "${nextHost.peerId}" for room "${room.roomCode}"`);
    }

    // Clean up empty rooms
    if (room.peers.size === 0) {
      rooms.delete(room.roomCode);
      log('ROOM', `Room "${room.roomCode}" destroyed (no active peers remaining)`);
    }
  }

  peer.roomCode = undefined;
}

function handleDisconnect(ws: WebSocket, peer: PeerSocket) {
  log('WS', `Client disconnected: "${peer.peerId || 'anonymous'}"`);
  leaveCurrentRoom(ws, peer);
  clients.delete(ws);
}

// Express and Vite setup
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  // API endpoints (health & swarm diagnostics)
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'SATorrent Signaling Server',
      activeRooms: rooms.size,
      connectedClients: clients.size,
      time: new Date().toISOString(),
    });
  });

  app.get('/api/rooms', (req, res) => {
    const list = Array.from(rooms.values()).map((r) => ({
      roomCode: r.roomCode,
      peerCount: r.peers.size,
      maxPeers: r.maxPeers,
      createdAt: r.createdAt,
    }));
    res.json({ rooms: list });
  });

  if (!isProd) {
    // Development mode: Vite middleware
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    log('SERVER', 'Vite dev server middleware mounted');
  } else {
    // Production mode: Serve dist folder
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    log('SERVER', `Serving production build from ${distPath}`);
  }

  server.listen(PORT, '0.0.0.0', () => {
    log('SERVER', `SATorrent server listening on http://0.0.0.0:${PORT}`);
    log('SERVER', `WebSocket signaling available at ws://0.0.0.0:${PORT}/ws`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
