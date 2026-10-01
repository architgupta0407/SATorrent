/**
 * Central Torrent Engine for SATorrent.
 * Orchestrates WebSocket signaling, WebRTC mesh connections, piece scheduling,
 * SHA-256 verification, seeding, re-seeding, and file reconstruction.
 */

import {
  FileManifest,
  LocalTorrent,
  PeerInfo,
  RoomState,
  SignalingClientMessage,
  SignalingServerMessage,
  SwarmPeer,
  DataChannelMessage,
  CollegeDemoState,
  PieceStatus,
  SchedulerStats,
} from '../types';
import { computeSha256, generateId, generatePeerId } from '../lib/crypto';
import { storage, StoredCompletedFile, StoredTorrentState } from '../lib/storage';
import { PeerConnectionManager } from '../webrtc/PeerConnectionManager';
import { PieceScheduler } from './PieceScheduler';

export const DEFAULT_PIECE_SIZE = 64 * 1024; // 64 KB
export const MAX_FILE_SIZE = 250 * 1024 * 1024; // 250 MB
export const DEFAULT_MAX_PEERS = 8;

export interface DiagnosticLog {
  id: string;
  time: string;
  category: 'signaling' | 'webrtc' | 'piece' | 'error' | 'swarm';
  message: string;
  details?: any;
}

export interface SwarmTransferPulse {
  id: string;
  from: string;
  to: string;
  size: number;
  timestamp: number;
}

export interface EngineListener {
  onRoomStateChange?: (room: RoomState | null) => void;
  onPeersChange?: (peers: Map<string, SwarmPeer>) => void;
  onTorrentsChange?: (torrents: Map<string, LocalTorrent>) => void;
  onCompletedFilesChange?: (files: StoredCompletedFile[]) => void;
  onDiagnosticLog?: (log: DiagnosticLog) => void;
  onTransferPulse?: (pulse: SwarmTransferPulse) => void;
  onDemoStateChange?: (state: CollegeDemoState) => void;
  onError?: (message: string) => void;
}

export class TorrentEngine {
  private localPeerId: string;
  private ws: WebSocket | null = null;
  private pcm: PeerConnectionManager;
  private roomState: RoomState | null = null;
  private peers = new Map<string, SwarmPeer>();
  private torrents = new Map<string, LocalTorrent>();
  private schedulers = new Map<string, PieceScheduler>();
  private completedFiles: StoredCompletedFile[] = [];
  private listeners: EngineListener[] = [];
  private diagnosticLogs: DiagnosticLog[] = [];
  private activePulses: SwarmTransferPulse[] = [];
  private pieceMemoryCache = new Map<string, ArrayBuffer>();
  private demoState: CollegeDemoState = {
    roomCreated: false,
    peersConnected: false,
    manifestReceived: false,
    piecesTransferring: false,
    peerReSeeding: false,
    fileVerified: false,
  };

  private schedulerTickTimer: number | null = null;
  private isDestroyed = false;

  constructor(customPeerId?: string) {
    this.localPeerId = customPeerId || generatePeerId();

    this.pcm = new PeerConnectionManager(
      this.localPeerId,
      {
        onSignalNeeded: (target, type, payload) => {
          this.sendSignalingMessage({
            type: 'signal',
            senderPeerId: this.localPeerId,
            targetPeerId: target,
            signalType: type,
            payload,
          });
        },
        onDataChannelOpen: (peerId) => {
          this.addLog('webrtc', `DataChannel opened with ${peerId}`);
          this.demoState.peersConnected = true;
          this.notifyDemoState();

          const p = this.peers.get(peerId);
          if (p) {
            p.dataChannelState = 'open';
            p.lastActivityTimestamp = Date.now();
            this.notifyPeers();
          }

          // Exchange any active torrent manifests we have with the newly connected peer
          for (const [, torrent] of this.torrents) {
            this.pcm.sendJson(peerId, {
              type: 'FILE_MANIFEST',
              manifest: torrent.manifest,
            });

            // If we have verified pieces, send them as HAVE_BATCH
            if (torrent.verifiedPieces.size > 0) {
              this.pcm.sendJson(peerId, {
                type: 'HAVE_BATCH',
                fileId: torrent.manifest.fileId,
                pieceIndices: Array.from(torrent.verifiedPieces),
              });
            }
          }

          this.triggerScheduler();
        },
        onDataChannelClose: (peerId) => {
          this.addLog('webrtc', `DataChannel closed with ${peerId}`);
          const p = this.peers.get(peerId);
          if (p) {
            p.dataChannelState = 'closed';
            this.notifyPeers();
          }
          this.handlePeerLeftSwarm(peerId);
        },
        onConnectionStateChange: (peerId, state) => {
          this.addLog('webrtc', `Connection state with ${peerId}: ${state}`);
          const p = this.peers.get(peerId);
          if (p) {
            p.connectionState = state;
            this.notifyPeers();
          }
        },
        onLatencyUpdate: (peerId, latency) => {
          const p = this.peers.get(peerId);
          if (p) {
            p.latencyMs = latency;
            p.lastActivityTimestamp = Date.now();
            this.notifyPeers();
          }
        },
        onSpeedUpdate: (peerId, dlBps, ulBps) => {
          const p = this.peers.get(peerId);
          if (p) {
            p.downloadSpeedBps = dlBps;
            p.uploadSpeedBps = ulBps;
            if (dlBps > 0 || ulBps > 0) {
              p.lastActivityTimestamp = Date.now();
            }
            this.notifyPeers();
          }
          this.calculateTorrentSpeeds();
        },
        onJsonMessage: (peerId, msg) => {
          const p = this.peers.get(peerId);
          if (p) p.lastActivityTimestamp = Date.now();
          this.handleDataChannelJson(peerId, msg);
        },
        onBinaryPiece: (peerId, pieceIndex, fileId, requestId, payload) => {
          const p = this.peers.get(peerId);
          if (p) p.lastActivityTimestamp = Date.now();
          this.handleIncomingPiece(peerId, pieceIndex, fileId, requestId, payload);
        },
        onTransferEvent: (from, to, type, size) => {
          const pulse: SwarmTransferPulse = {
            id: generateId(6),
            from,
            to,
            size,
            timestamp: Date.now(),
          };
          this.notifyTransferPulse(pulse);
        },
      }
    );

    this.loadSavedStateFromStorage();
    this.startSchedulerLoop();
    this.connectSignaling();
  }

  public getLocalPeerId(): string {
    return this.localPeerId;
  }

  public getRoomState(): RoomState | null {
    return this.roomState;
  }

  public getPeers(): Map<string, SwarmPeer> {
    return this.peers;
  }

  public getTorrents(): Map<string, LocalTorrent> {
    return this.torrents;
  }

  public getCompletedFiles(): StoredCompletedFile[] {
    return this.completedFiles;
  }

  public getLogs(): DiagnosticLog[] {
    return this.diagnosticLogs;
  }

  public addListener(listener: EngineListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private addLog(category: DiagnosticLog['category'], message: string, details?: any) {
    const log: DiagnosticLog = {
      id: generateId(8),
      time: new Date().toLocaleTimeString(),
      category,
      message,
      details,
    };
    this.diagnosticLogs.unshift(log);
    if (this.diagnosticLogs.length > 250) {
      this.diagnosticLogs.pop();
    }
    this.listeners.forEach((l) => l.onDiagnosticLog && l.onDiagnosticLog(log));
  }

  public getDemoState(): CollegeDemoState {
    return this.demoState;
  }

  public getSchedulerStats(fileId: string): SchedulerStats | null {
    const scheduler = this.schedulers.get(fileId);
    const torrent = this.torrents.get(fileId);
    if (!scheduler) return null;
    return scheduler.getSchedulerStats(torrent?.manifest.fileName);
  }

  public getAllSchedulerStats(): SchedulerStats[] {
    const stats: SchedulerStats[] = [];
    for (const [fileId, scheduler] of this.schedulers) {
      const torrent = this.torrents.get(fileId);
      stats.push(scheduler.getSchedulerStats(torrent?.manifest.fileName));
    }
    return stats;
  }

  public togglePauseTorrent(fileId: string) {
    const t = this.torrents.get(fileId);
    if (!t) return;
    t.isPaused = !t.isPaused;
    t.status = t.isPaused
      ? 'paused'
      : t.verifiedPieces.size >= t.manifest.pieceCount
      ? 'completed'
      : 'downloading';

    if (t.isPaused) {
      for (const [piece] of t.inFlightPieces) {
        t.pieceStatuses[piece] = 'missing';
      }
      t.inFlightPieces.clear();
      this.addLog('swarm', `Paused transfer for "${t.manifest.fileName}"`);
    } else {
      this.addLog('swarm', `Resumed transfer for "${t.manifest.fileName}"`);
      this.triggerScheduler();
    }
    this.notifyTorrents();
  }

  private notifyDemoState() {
    this.listeners.forEach((l) => l.onDemoStateChange && l.onDemoStateChange({ ...this.demoState }));
  }

  private notifyRoom() {
    this.listeners.forEach((l) => l.onRoomStateChange && l.onRoomStateChange(this.roomState));
  }

  private notifyPeers() {
    this.listeners.forEach((l) => l.onPeersChange && l.onPeersChange(new Map(this.peers)));
  }

  private notifyTorrents() {
    this.listeners.forEach((l) => l.onTorrentsChange && l.onTorrentsChange(new Map(this.torrents)));
  }

  private notifyCompletedFiles() {
    this.listeners.forEach(
      (l) => l.onCompletedFilesChange && l.onCompletedFilesChange([...this.completedFiles])
    );
  }

  private notifyTransferPulse(pulse: SwarmTransferPulse) {
    this.listeners.forEach((l) => l.onTransferPulse && l.onTransferPulse(pulse));
  }

  private notifyError(msg: string) {
    this.addLog('error', msg);
    this.listeners.forEach((l) => l.onError && l.onError(msg));
  }

  /**
   * Connects to the WebSocket signaling server.
   */
  public connectSignaling() {
    if (typeof window === 'undefined') return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    this.addLog('signaling', `Connecting to signaling server at ${wsUrl}...`);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.addLog('signaling', 'Signaling server connected.');
        // If we were already in a room, re-join
        if (this.roomState) {
          this.joinRoom(this.roomState.roomCode);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const msg: SignalingServerMessage = JSON.parse(event.data);
          this.handleSignalingMessage(msg);
        } catch (err) {
          console.error('Failed to parse signaling message:', err);
        }
      };

      this.ws.onclose = () => {
        this.addLog('signaling', 'Signaling connection closed. Retrying in 3s...');
        if (!this.isDestroyed) {
          setTimeout(() => this.connectSignaling(), 3000);
        }
      };

      this.ws.onerror = (err) => {
        this.addLog('signaling', 'Signaling WebSocket error.');
      };
    } catch (err: any) {
      this.notifyError(`Signaling connection failed: ${err.message}`);
    }
  }

  private sendSignalingMessage(msg: SignalingClientMessage) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private handleSignalingMessage(msg: SignalingServerMessage) {
    switch (msg.type) {
      case 'room-created':
      case 'room-joined': {
        this.addLog('signaling', `Entered room: ${msg.roomCode} with ${msg.peers.length} existing peers`);
        this.roomState = {
          roomCode: msg.roomCode,
          hostId: msg.hostId,
          createdAt: Date.now(),
          maxPeers: msg.maxPeers,
          peers: msg.peers,
        };
        this.notifyRoom();

        // Connect to existing peers in the room
        for (const peer of msg.peers) {
          if (peer.peerId !== this.localPeerId) {
            this.ensurePeerEntry(peer.peerId);
            this.pcm.initiateConnection(peer.peerId);
          }
        }
        break;
      }

      case 'peer-joined': {
        this.addLog('signaling', `Peer joined room: ${msg.peer.peerId}`);
        if (this.roomState) {
          if (!this.roomState.peers.some((p) => p.peerId === msg.peer.peerId)) {
            this.roomState.peers.push(msg.peer);
            this.notifyRoom();
          }
        }
        this.ensurePeerEntry(msg.peer.peerId);
        // Deterministic connection will trigger if we are the offerer
        this.pcm.initiateConnection(msg.peer.peerId);
        break;
      }

      case 'peer-left': {
        this.addLog('signaling', `Peer left room: ${msg.peerId}`);
        if (this.roomState) {
          this.roomState.peers = this.roomState.peers.filter((p) => p.peerId !== msg.peerId);
          this.notifyRoom();
        }
        this.pcm.closePeer(msg.peerId);
        this.handlePeerLeftSwarm(msg.peerId);
        break;
      }

      case 'signal': {
        this.ensurePeerEntry(msg.senderPeerId);
        this.pcm.handleSignal(msg.senderPeerId, msg.signalType, msg.payload);
        break;
      }

      case 'error': {
        this.notifyError(`Room error: ${msg.message}`);
        break;
      }
    }
  }

  private ensurePeerEntry(peerId: string): SwarmPeer {
    let p = this.peers.get(peerId);
    if (!p) {
      p = {
        peerId,
        role: 'peer',
        connectionState: this.pcm.getPeerConnectionState(peerId),
        dataChannelState: this.pcm.getPeerDataChannelState(peerId),
        ownedPieces: new Set<number>(),
        ownedPiecesByFile: new Map<string, Set<number>>(),
        latencyMs: 0,
        downloadSpeedBps: 0,
        uploadSpeedBps: 0,
        totalDownloadedBytes: 0,
        totalUploadedBytes: 0,
        inFlightRequests: 0,
        lastActivityTimestamp: Date.now(),
      };
      this.peers.set(peerId, p);
      this.notifyPeers();
    }
    return p;
  }

  private handlePeerLeftSwarm(peerId: string) {
    this.peers.delete(peerId);
    this.notifyPeers();

    // Reassign pending pieces in all active schedulers
    for (const [, scheduler] of this.schedulers) {
      const evicted = scheduler.handlePeerDisconnected(peerId);
      if (evicted.length > 0) {
        this.addLog('swarm', `Reassigning ${evicted.length} pending pieces from disconnected ${peerId}`);
      }
    }

    this.triggerScheduler();
  }

  /**
   * Room Actions
   */
  public createRoom(customCode?: string, maxPeers = DEFAULT_MAX_PEERS) {
    this.sendSignalingMessage({
      type: 'room-create',
      peerId: this.localPeerId,
      roomCode: customCode,
      maxPeers,
    });
  }

  public joinRoom(roomCode: string) {
    this.sendSignalingMessage({
      type: 'room-join',
      peerId: this.localPeerId,
      roomCode: roomCode.trim().toUpperCase(),
    });
  }

  public leaveRoom() {
    if (this.roomState) {
      this.sendSignalingMessage({
        type: 'room-leave',
        peerId: this.localPeerId,
        roomCode: this.roomState.roomCode,
      });
      this.roomState = null;
      this.notifyRoom();
    }
    this.pcm.closeAll();
    this.peers.clear();
    this.notifyPeers();
  }

  /**
   * Seeds a local file into the swarm.
   */
  public async seedFile(file: File, onProgress?: (pct: number) => void): Promise<FileManifest> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size (${(file.size / (1024 * 1024)).toFixed(1)}MB) exceeds limit of 250MB.`);
    }

    this.addLog('swarm', `Hashing file for seeding: "${file.name}" (${file.size} bytes)...`);

    const pieceSize = DEFAULT_PIECE_SIZE;
    const pieceCount = Math.ceil(file.size / pieceSize) || 1;
    const pieceHashes: string[] = [];

    // Calculate individual piece hashes
    for (let i = 0; i < pieceCount; i++) {
      const start = i * pieceSize;
      const end = Math.min(start + pieceSize, file.size);
      const slice = file.slice(start, end);
      const buffer = await slice.arrayBuffer();
      const hash = await computeSha256(buffer);
      pieceHashes.push(hash);
      if (onProgress) {
        onProgress(Math.round(((i + 1) / pieceCount) * 100));
      }
    }

    // Calculate overall file hash
    const entireBuffer = await file.arrayBuffer();
    const overallSha256 = await computeSha256(entireBuffer);

    const manifest: FileManifest = {
      fileId: generateId(12),
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type || 'application/octet-stream',
      pieceSize,
      pieceCount,
      pieceHashes,
      overallSha256,
      creatorPeerId: this.localPeerId,
      createdAt: Date.now(),
    };

    const verifiedPieces = new Set<number>();
    const pieceStatuses: LocalTorrent['pieceStatuses'] = [];
    for (let i = 0; i < pieceCount; i++) {
      verifiedPieces.add(i);
      pieceStatuses.push('verified');
      // Store into IndexedDB & memory cache so it can be served instantly
      const start = i * pieceSize;
      const end = Math.min(start + pieceSize, file.size);
      const slice = file.slice(start, end);
      slice.arrayBuffer().then((buf) => {
        this.pieceMemoryCache.set(`${manifest.fileId}_${i}`, buf);
        storage.savePiece(manifest.fileId, i, buf);
      });
    }

    await storage.saveManifest(manifest);

    // Save completed file entry
    await storage.saveCompletedFile({
      fileId: manifest.fileId,
      fileName: manifest.fileName,
      fileSize: manifest.fileSize,
      mimeType: manifest.mimeType,
      overallSha256: manifest.overallSha256,
      completedAt: Date.now(),
      blob: file,
    });
    await this.loadCompletedFilesFromStorage();

    const localTorrent: LocalTorrent = {
      manifest,
      isSeeder: true,
      status: 'seeding',
      file,
      verifiedPieces,
      pieceStatuses,
      inFlightPieces: new Map(),
      overallSha256Status: 'verified',
      completedAt: Date.now(),
      blobUrl: URL.createObjectURL(file),
      downloadSpeedBps: 0,
      uploadSpeedBps: 0,
    };

    await storage.saveTorrentState({
      fileId: manifest.fileId,
      manifest,
      isSeeder: true,
      verifiedPieceIndices: Array.from(verifiedPieces),
      overallSha256Status: 'verified',
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    this.demoState.manifestReceived = true;
    this.notifyDemoState();

    this.torrents.set(manifest.fileId, localTorrent);
    this.notifyTorrents();

    // Broadcast FILE_MANIFEST and full HAVE_BATCH to swarm
    this.pcm.broadcastJson({
      type: 'FILE_MANIFEST',
      manifest,
    });

    this.pcm.broadcastJson({
      type: 'HAVE_BATCH',
      fileId: manifest.fileId,
      pieceIndices: Array.from(verifiedPieces),
    });

    this.addLog('swarm', `Now seeding "${file.name}" with ${pieceCount} pieces. Broadcasted to peers.`);
    return manifest;
  }

  /**
   * Handles incoming DataChannel JSON messages.
   */
  private async handleDataChannelJson(peerId: string, msg: DataChannelMessage) {
    switch (msg.type) {
      case 'HELLO': {
        this.addLog('swarm', `Received HELLO from ${peerId} (v${msg.clientVersion})`);
        break;
      }

      case 'FILE_MANIFEST': {
        this.handleReceivedManifest(peerId, msg.manifest);
        break;
      }

      case 'HAVE': {
        this.handlePeerHave(peerId, msg.fileId, msg.pieceIndex);
        break;
      }

      case 'HAVE_BATCH': {
        this.handlePeerHaveBatch(peerId, msg.fileId, msg.pieceIndices);
        break;
      }

      case 'PIECE_REQUEST': {
        await this.handleIncomingPieceRequest(peerId, msg.fileId, msg.pieceIndex, msg.requestId);
        break;
      }

      case 'PIECE_REJECT': {
        this.addLog('piece', `Piece ${msg.pieceIndex} was rejected by ${peerId}: ${msg.reason}`);
        const scheduler = this.schedulers.get(msg.fileId);
        if (scheduler) {
          scheduler.handlePieceRejected(msg.pieceIndex, peerId);
          this.triggerScheduler();
        }
        break;
      }
    }
  }

  private handleReceivedManifest(peerId: string, manifest: FileManifest) {
    if (this.torrents.has(manifest.fileId)) {
      // Already aware of this file
      return;
    }

    this.addLog('swarm', `Discovered new file from ${peerId}: "${manifest.fileName}" (${(manifest.fileSize / 1024).toFixed(1)} KB, ${manifest.pieceCount} pieces)`);

    const verifiedPieces = new Set<number>();
    const pieceStatuses: LocalTorrent['pieceStatuses'] = new Array(manifest.pieceCount).fill('missing');

    const localTorrent: LocalTorrent = {
      manifest,
      isSeeder: false,
      status: 'downloading',
      verifiedPieces,
      pieceStatuses,
      inFlightPieces: new Map(),
      overallSha256Status: 'pending',
      downloadSpeedBps: 0,
      uploadSpeedBps: 0,
    };

    this.demoState.manifestReceived = true;
    this.notifyDemoState();

    this.torrents.set(manifest.fileId, localTorrent);

    // Initialize scheduler for this file
    const scheduler = new PieceScheduler(manifest.fileId, manifest.pieceCount, {
      maxInFlightPerPeer: 3,
      requestTimeoutMs: 6000,
    });

    // Populate any pieces peers have already advertised for THIS file!
    for (const [pId, p] of this.peers) {
      const filePieces = p.ownedPiecesByFile?.get(manifest.fileId);
      if (filePieces && filePieces.size > 0) {
        scheduler.setPeerPiecesBatch(pId, Array.from(filePieces));
      }
    }

    this.schedulers.set(manifest.fileId, scheduler);

    this.notifyTorrents();

    // Trigger scheduler to start downloading missing pieces
    this.triggerScheduler();
  }

  private handlePeerHave(peerId: string, fileId: string, pieceIndex: number) {
    const peer = this.ensurePeerEntry(peerId);
    if (!peer.ownedPiecesByFile) {
      peer.ownedPiecesByFile = new Map<string, Set<number>>();
    }
    let fileSet = peer.ownedPiecesByFile.get(fileId);
    if (!fileSet) {
      fileSet = new Set<number>();
      peer.ownedPiecesByFile.set(fileId, fileSet);
    }
    fileSet.add(pieceIndex);
    peer.ownedPieces.add(pieceIndex);

    // Update role
    const torrent = this.torrents.get(fileId);
    if (torrent) {
      if (fileSet.size >= torrent.manifest.pieceCount) {
        peer.role = 'seeder';
      } else {
        peer.role = 'leecher';
      }
    }

    const scheduler = this.schedulers.get(fileId);
    if (scheduler) {
      scheduler.setPeerHasPiece(peerId, pieceIndex);
    }

    this.notifyPeers();
    this.triggerScheduler();
  }

  private handlePeerHaveBatch(peerId: string, fileId: string, pieces: number[]) {
    const peer = this.ensurePeerEntry(peerId);
    if (!peer.ownedPiecesByFile) {
      peer.ownedPiecesByFile = new Map<string, Set<number>>();
    }
    let fileSet = peer.ownedPiecesByFile.get(fileId);
    if (!fileSet) {
      fileSet = new Set<number>();
      peer.ownedPiecesByFile.set(fileId, fileSet);
    }
    for (const p of pieces) {
      fileSet.add(p);
      peer.ownedPieces.add(p);
    }

    const torrent = this.torrents.get(fileId);
    if (torrent) {
      if (fileSet.size >= torrent.manifest.pieceCount) {
        peer.role = 'seeder';
      } else {
        peer.role = 'leecher';
      }
    }

    const scheduler = this.schedulers.get(fileId);
    if (scheduler) {
      scheduler.setPeerPiecesBatch(peerId, pieces);
    }

    this.notifyPeers();
    this.triggerScheduler();
  }

  /**
   * Responds to another peer's PIECE_REQUEST.
   * Serves slice from original File or stored IndexedDB piece.
   */
  private async handleIncomingPieceRequest(
    peerId: string,
    fileId: string,
    pieceIndex: number,
    requestId: string
  ) {
    const torrent = this.torrents.get(fileId);
    if (!torrent || !torrent.verifiedPieces.has(pieceIndex)) {
      this.pcm.sendJson(peerId, {
        type: 'PIECE_REJECT',
        fileId,
        pieceIndex,
        requestId,
        reason: 'Piece not owned or unverified',
      });
      return;
    }

    let payload: ArrayBuffer | null = null;
    const cacheKey = `${fileId}_${pieceIndex}`;

    // 1. Check ultra-fast RAM piece memory cache
    if (this.pieceMemoryCache.has(cacheKey)) {
      payload = this.pieceMemoryCache.get(cacheKey)!;
    } else if (torrent.file) {
      // 2. Read from original File handle if available
      const start = pieceIndex * torrent.manifest.pieceSize;
      const end = Math.min(start + torrent.manifest.pieceSize, torrent.file.size);
      const slice = torrent.file.slice(start, end);
      payload = await slice.arrayBuffer();
      this.pieceMemoryCache.set(cacheKey, payload);
    } else {
      // 3. Otherwise fetch from IndexedDB piece storage (re-seeding behavior)
      payload = await storage.getPiece(fileId, pieceIndex);
      if (payload) {
        this.pieceMemoryCache.set(cacheKey, payload);
      }
    }

    if (!payload) {
      this.pcm.sendJson(peerId, {
        type: 'PIECE_REJECT',
        fileId,
        pieceIndex,
        requestId,
        reason: 'Piece data read error',
      });
      return;
    }

    // Verify hash before serving to ensure zero corruption propagates
    const expectedHash = torrent.manifest.pieceHashes[pieceIndex];
    const actualHash = await computeSha256(payload);

    if (expectedHash !== actualHash) {
      this.pcm.sendJson(peerId, {
        type: 'PIECE_REJECT',
        fileId,
        pieceIndex,
        requestId,
        reason: 'Internal piece hash mismatch',
      });
      return;
    }

    // Send binary frame directly to peer over DataChannel
    const sent = this.pcm.sendBinaryPiece(peerId, fileId, pieceIndex, requestId, payload);
    if (sent) {
      this.addLog('piece', `Served piece ${pieceIndex} (${payload.byteLength} B) to ${peerId}`);
      if (!torrent.isSeeder) {
        this.demoState.peerReSeeding = true;
        this.notifyDemoState();
      }
    }
  }

  /**
   * Handles incoming binary piece payload from a peer.
   * Verifies SHA-256 immediately. If verified:
   * - stores locally
   * - updates scheduler
   * - immediately broadcasts HAVE to ALL peers in the room!
   * - checks for file completion & overall SHA-256 verification
   */
  private async handleIncomingPiece(
    peerId: string,
    pieceIndex: number,
    fileId: string,
    requestId: string,
    payload: ArrayBuffer
  ) {
    this.demoState.piecesTransferring = true;
    this.notifyDemoState();
    const torrent = this.torrents.get(fileId);
    const scheduler = this.schedulers.get(fileId);

    if (!torrent || !scheduler) {
      return;
    }

    // Check expected hash
    const expectedHash = torrent.manifest.pieceHashes[pieceIndex];
    if (!expectedHash) {
      this.addLog('error', `Received piece ${pieceIndex} with unknown expected hash`);
      return;
    }

    const actualHash = await computeSha256(payload);

    if (actualHash !== expectedHash) {
      this.addLog(
        'error',
        `HASH MISMATCH for piece ${pieceIndex} from ${peerId}! Expected: ${expectedHash.slice(0, 8)}..., got: ${actualHash.slice(0, 8)}... Discarding.`
      );
      scheduler.handlePieceRejected(pieceIndex, peerId);
      torrent.pieceStatuses[pieceIndex] = 'missing';
      this.notifyTorrents();
      this.triggerScheduler();
      return;
    }

    // SHA-256 Verified!
    this.addLog('piece', `PIECE_RECEIVED piece=${pieceIndex} bytes=${payload.byteLength} source=${peerId}`);
    this.addLog('piece', `SHA256_OK piece=${pieceIndex} source=${peerId}`);

    // Cache piece in memory and IndexedDB
    this.pieceMemoryCache.set(`${fileId}_${pieceIndex}`, payload);
    await storage.savePiece(fileId, pieceIndex, payload);

    // Update torrent state
    torrent.verifiedPieces.add(pieceIndex);
    torrent.pieceStatuses[pieceIndex] = 'verified';
    torrent.inFlightPieces.delete(pieceIndex);

    // Update scheduler
    scheduler.markPieceVerified(pieceIndex);

    // CRITICAL REQUIREMENT: Immediately broadcast HAVE to ALL connected peers
    // so this leecher peer can now re-serve pieceIndex to other leechers!
    this.pcm.broadcastJson({
      type: 'HAVE',
      fileId,
      pieceIndex,
    });
    this.addLog('swarm', `HAVE_BROADCAST piece=${pieceIndex} file=${fileId}`);

    this.notifyTorrents();

    // Check if entire file is complete
    if (torrent.verifiedPieces.size >= torrent.manifest.pieceCount) {
      await this.finalizeFile(torrent);
    } else {
      this.triggerScheduler();
    }
  }

  /**
   * Reconstructs the complete file from pieces, verifies final SHA-256,
   * creates Blob URL, and saves to completed files.
   */
  private async finalizeFile(torrent: LocalTorrent) {
    this.addLog('swarm', `Reconstructing full file "${torrent.manifest.fileName}" from ${torrent.manifest.pieceCount} pieces...`);

    const piecesData: ArrayBuffer[] = [];
    for (let i = 0; i < torrent.manifest.pieceCount; i++) {
      const piece = await storage.getPiece(torrent.manifest.fileId, i);
      if (!piece) {
        this.addLog('error', `Failed to load piece ${i} during file reconstruction`);
        torrent.overallSha256Status = 'mismatch';
        this.notifyTorrents();
        return;
      }
      piecesData.push(piece);
    }

    // Combine all pieces in order into a single Blob
    const completeBlob = new Blob(piecesData, { type: torrent.manifest.mimeType });
    const fullBuffer = await completeBlob.arrayBuffer();
    const finalSha256 = await computeSha256(fullBuffer);

    if (finalSha256.toLowerCase() !== torrent.manifest.overallSha256.toLowerCase()) {
      this.addLog('error', `FINAL HASH MISMATCH! Expected ${torrent.manifest.overallSha256}, got ${finalSha256}`);
      torrent.overallSha256Status = 'mismatch';
      this.notifyTorrents();
      return;
    }

    this.addLog('swarm', `FINAL SHA-256 VERIFIED! "${torrent.manifest.fileName}" is complete and authentic.`);
    torrent.overallSha256Status = 'verified';
    torrent.status = torrent.isSeeder ? 'seeding' : 'completed';
    torrent.completedAt = Date.now();
    torrent.blobUrl = URL.createObjectURL(completeBlob);

    this.demoState.fileVerified = true;
    this.notifyDemoState();

    const completedEntry: StoredCompletedFile = {
      fileId: torrent.manifest.fileId,
      fileName: torrent.manifest.fileName,
      fileSize: torrent.manifest.fileSize,
      mimeType: torrent.manifest.mimeType,
      overallSha256: torrent.manifest.overallSha256,
      completedAt: Date.now(),
      blob: completeBlob,
    };

    await storage.saveCompletedFile(completedEntry);
    await storage.saveTorrentState({
      fileId: torrent.manifest.fileId,
      manifest: torrent.manifest,
      isSeeder: torrent.isSeeder,
      verifiedPieceIndices: Array.from(torrent.verifiedPieces),
      overallSha256Status: 'verified',
      completedAt: Date.now(),
      updatedAt: Date.now(),
    });

    await this.loadCompletedFilesFromStorage();
    this.notifyTorrents();
  }

  private async loadCompletedFilesFromStorage() {
    try {
      this.completedFiles = await storage.getAllCompletedFiles();
      this.notifyCompletedFiles();
    } catch (err) {
      console.warn('Failed to load completed files:', err);
    }
  }

  private async loadSavedStateFromStorage() {
    try {
      await this.loadCompletedFilesFromStorage();

      const savedStates = await storage.getAllTorrentStates();
      for (const state of savedStates) {
        if (!this.torrents.has(state.fileId)) {
          const verifiedPieces = new Set<number>(state.verifiedPieceIndices);
          const pieceStatuses: PieceStatus[] = new Array(state.manifest.pieceCount).fill('missing');
          for (const idx of verifiedPieces) {
            pieceStatuses[idx] = 'verified';
          }

          const comp = this.completedFiles.find((c) => c.fileId === state.fileId);
          const blobUrl = comp ? URL.createObjectURL(comp.blob) : undefined;

          const localTorrent: LocalTorrent = {
            manifest: state.manifest,
            isSeeder: state.isSeeder,
            status:
              state.overallSha256Status === 'verified'
                ? state.isSeeder
                  ? 'seeding'
                  : 'completed'
                : 'downloading',
            verifiedPieces,
            pieceStatuses,
            inFlightPieces: new Map(),
            overallSha256Status: state.overallSha256Status,
            completedAt: state.completedAt,
            blobUrl,
            downloadSpeedBps: 0,
            uploadSpeedBps: 0,
          };

          this.torrents.set(state.fileId, localTorrent);

          if (verifiedPieces.size < state.manifest.pieceCount) {
            const scheduler = new PieceScheduler(state.fileId, state.manifest.pieceCount, {
              maxInFlightPerPeer: 3,
              requestTimeoutMs: 6000,
            });
            scheduler.setVerifiedPieces(verifiedPieces);
            this.schedulers.set(state.fileId, scheduler);
          }
        }
      }
      this.notifyTorrents();
    } catch (err) {
      console.warn('Failed to load saved torrent state:', err);
    }
  }

  /**
   * Scheduler Tick: evaluates missing pieces across all active torrents
   * and requests rarest pieces from ready peers.
   */
  private triggerScheduler() {
    const readyPeers = Array.from(this.peers.keys()).filter((id) => this.pcm.isPeerReady(id));

    if (readyPeers.length === 0) return;

    for (const [fileId, torrent] of this.torrents) {
      if (torrent.verifiedPieces.size >= torrent.manifest.pieceCount) {
        continue; // Torrent complete
      }

      const scheduler = this.schedulers.get(fileId);
      if (!scheduler) continue;

      const requests = scheduler.scheduleNextRequests(readyPeers);

      for (const req of requests) {
        torrent.pieceStatuses[req.pieceIndex] = 'in_flight';
        const inFlightInfo = scheduler.getInFlightMap().get(req.pieceIndex);
        torrent.inFlightPieces.set(req.pieceIndex, {
          peerId: req.peerId,
          requestedAt: Date.now(),
          requestId: req.requestId,
          retryCount: inFlightInfo?.retryCount ?? 0,
        });

        // Send PIECE_REQUEST over data channel
        this.pcm.sendJson(req.peerId, {
          type: 'PIECE_REQUEST',
          fileId: req.fileId,
          pieceIndex: req.pieceIndex,
          requestId: req.requestId,
        });

        this.addLog(
          'piece',
          `PIECE_REQUEST piece=${req.pieceIndex} source=${req.peerId} req=${req.requestId}`
        );
      }

      if (requests.length > 0) {
        this.notifyTorrents();
      }
    }
  }

  private calculateTorrentSpeeds() {
    for (const [, torrent] of this.torrents) {
      let dlTotal = 0;
      let ulTotal = 0;

      for (const [, peer] of this.peers) {
        dlTotal += peer.downloadSpeedBps;
        ulTotal += peer.uploadSpeedBps;
      }

      torrent.downloadSpeedBps = dlTotal;
      torrent.uploadSpeedBps = ulTotal;
    }
    this.notifyTorrents();
  }

  private startSchedulerLoop() {
    // Run scheduler check every 800ms to catch timeouts and schedule available slots
    this.schedulerTickTimer = window.setInterval(() => {
      this.triggerScheduler();
    }, 800);
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.schedulerTickTimer) clearInterval(this.schedulerTickTimer);
    this.leaveRoom();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.pcm.destroy();
  }
}
