/**
 * SATorrent Shared Protocol Types
 */

export interface PeerInfo {
  peerId: string;
  joinedAt: number;
  isHost?: boolean;
}

export interface RoomState {
  roomCode: string;
  hostId: string;
  createdAt: number;
  maxPeers: number;
  peers: PeerInfo[];
}

// WebSocket Signaling Messages
export type SignalingClientMessage =
  | { type: 'room-create'; peerId: string; roomCode?: string; maxPeers?: number }
  | { type: 'room-join'; peerId: string; roomCode: string }
  | { type: 'room-leave'; peerId: string; roomCode: string }
  | {
      type: 'signal';
      senderPeerId: string;
      targetPeerId: string;
      signalType: 'offer' | 'answer' | 'ice-candidate';
      payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
    }
  | { type: 'ping'; peerId: string };

export type SignalingServerMessage =
  | {
      type: 'room-created';
      roomCode: string;
      maxPeers: number;
      hostId: string;
      peers: PeerInfo[];
    }
  | {
      type: 'room-joined';
      roomCode: string;
      maxPeers: number;
      hostId: string;
      peers: PeerInfo[];
    }
  | { type: 'peer-joined'; peer: PeerInfo }
  | { type: 'peer-left'; peerId: string }
  | {
      type: 'signal';
      senderPeerId: string;
      signalType: 'offer' | 'answer' | 'ice-candidate';
      payload: RTCSessionDescriptionInit | RTCIceCandidateInit;
    }
  | { type: 'error'; code: string; message: string }
  | { type: 'pong'; timestamp: number };

// Torrent & Swarm Models
export interface FileManifest {
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  pieceSize: number;
  pieceCount: number;
  pieceHashes: string[]; // Hex string per piece (SHA-256)
  overallSha256: string; // Hex string of full file (SHA-256)
  creatorPeerId: string;
  createdAt: number;
}

// DataChannel JSON Control Protocol
export type DataChannelMessage =
  | { type: 'HELLO'; peerId: string; clientVersion: string }
  | { type: 'FILE_MANIFEST'; manifest: FileManifest }
  | { type: 'HAVE'; fileId: string; pieceIndex: number }
  | { type: 'HAVE_BATCH'; fileId: string; pieceIndices: number[] }
  | { type: 'PIECE_REQUEST'; fileId: string; pieceIndex: number; requestId: string }
  | { type: 'PIECE_META'; fileId: string; pieceIndex: number; pieceSize: number; requestId: string }
  | { type: 'PIECE_REJECT'; fileId: string; pieceIndex: number; requestId: string; reason: string }
  | { type: 'PIECE_COMPLETE'; fileId: string; pieceIndex: number }
  | { type: 'PING'; timestamp: number }
  | { type: 'PONG'; timestamp: number };

// Peer State in Swarm
export type SwarmPeerRole = 'seeder' | 're-seeder' | 'leecher' | 'peer';

export interface SwarmPeer {
  peerId: string;
  role: SwarmPeerRole;
  connectionState: RTCPeerConnectionState;
  dataChannelState: RTCDataChannelState;
  ownedPieces: Set<number>;
  ownedPiecesByFile?: Map<string, Set<number>>;
  latencyMs: number;
  downloadSpeedBps: number;
  uploadSpeedBps: number;
  totalDownloadedBytes: number;
  totalUploadedBytes: number;
  inFlightRequests: number;
  lastActivityTimestamp: number;
}

export interface DetailedInFlightItem {
  pieceIndex: number;
  peerId: string;
  status: 'In Flight';
  requestedAt: number;
  elapsedMs: number;
  requestId: string;
  retryCount: number;
}

export interface SchedulerStats {
  fileId: string;
  fileName: string;
  pieceCount: number;
  verifiedCount: number;
  missingCount: number;
  inFlightCount: number;
  availableMissingCount: number;
  rarityBreakdown: { rarity: number; pieceCount: number }[];
  peerPieceCounts: { peerId: string; piecesCount: number }[];
  inFlightList: DetailedInFlightItem[];
}

export type PieceStatus = 'missing' | 'in_flight' | 'verified';

export interface InFlightPieceDetail {
  peerId: string;
  requestedAt: number;
  requestId: string;
  retryCount?: number;
}

export type TorrentStatus = 'seeding' | 'downloading' | 'paused' | 'verifying' | 'completed' | 'error';

export interface LocalTorrent {
  manifest: FileManifest;
  isSeeder: boolean;
  status: TorrentStatus;
  file?: File;
  verifiedPieces: Set<number>;
  pieceStatuses: PieceStatus[];
  inFlightPieces: Map<number, InFlightPieceDetail>;
  overallSha256Status: 'pending' | 'verified' | 'mismatch';
  completedAt?: number;
  blobUrl?: string;
  downloadSpeedBps: number;
  uploadSpeedBps: number;
  isPaused?: boolean;
}

export interface CollegeDemoState {
  roomCreated: boolean;
  peersConnected: boolean;
  manifestReceived: boolean;
  piecesTransferring: boolean;
  peerReSeeding: boolean;
  fileVerified: boolean;
}
