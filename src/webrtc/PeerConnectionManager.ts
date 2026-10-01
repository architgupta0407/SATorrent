/**
 * WebRTC RTCPeerConnection and RTCDataChannel Manager for SATorrent.
 * Implements deterministic polite-offerer mesh connectivity, ICE queuing,
 * RTT latency pings, and throughput speed measurement.
 */

import { SignalingClientMessage } from '../types';
import { packBinaryPiece, unpackBinaryPiece, isBinaryPiece } from '../lib/protocol';

export interface RTCConfigOptions {
  stunUrls?: string[];
  turnUrl?: string;
  turnUsername?: string;
  turnPassword?: string;
}

export interface PeerConnectionEvents {
  onSignalNeeded: (targetPeerId: string, signalType: 'offer' | 'answer' | 'ice-candidate', payload: any) => void;
  onDataChannelOpen: (peerId: string) => void;
  onDataChannelClose: (peerId: string) => void;
  onJsonMessage: (peerId: string, message: any) => void;
  onBinaryPiece: (peerId: string, pieceIndex: number, fileId: string, requestId: string, payload: ArrayBuffer) => void;
  onConnectionStateChange: (peerId: string, state: RTCPeerConnectionState) => void;
  onLatencyUpdate: (peerId: string, latencyMs: number) => void;
  onSpeedUpdate: (peerId: string, downloadBps: number, uploadBps: number) => void;
  onTransferEvent?: (fromPeerId: string, toPeerId: string, type: 'send' | 'recv', size: number) => void;
}

interface PeerConnectionEntry {
  peerId: string;
  pc: RTCPeerConnection;
  dc?: RTCDataChannel;
  queuedIceCandidates: RTCIceCandidateInit[];
  isOfferer: boolean;
  latencyMs: number;
  lastPingTime: number;
  bytesReceivedWindow: number;
  bytesSentWindow: number;
  downloadBps: number;
  uploadBps: number;
  totalBytesReceived: number;
  totalBytesSent: number;
}

export class PeerConnectionManager {
  private localPeerId: string;
  private configOptions: RTCConfigOptions;
  private events: PeerConnectionEvents;
  private peers = new Map<string, PeerConnectionEntry>();
  private pingIntervalTimer: number | null = null;
  private speedIntervalTimer: number | null = null;

  constructor(localPeerId: string, events: PeerConnectionEvents, configOptions: RTCConfigOptions = {}) {
    this.localPeerId = localPeerId;
    this.events = events;
    this.configOptions = configOptions;

    this.startTimers();
  }

  public updateConfig(newOptions: RTCConfigOptions) {
    this.configOptions = { ...this.configOptions, ...newOptions };
  }

  private getRtcConfig(): RTCConfiguration {
    const iceServers: RTCIceServer[] = [
      {
        urls: this.configOptions.stunUrls && this.configOptions.stunUrls.length > 0
          ? this.configOptions.stunUrls
          : [
              'stun:stun.l.google.com:19302',
              'stun:stun1.l.google.com:19302',
              'stun:stun2.l.google.com:19302',
            ],
      },
    ];

    if (this.configOptions.turnUrl) {
      iceServers.push({
        urls: this.configOptions.turnUrl,
        username: this.configOptions.turnUsername,
        credential: this.configOptions.turnPassword,
      });
    }

    return {
      iceServers,
      iceCandidatePoolSize: 2,
    };
  }

  /**
   * Deterministic offerer rule: the peer with the lexicographically smaller
   * peerId initiates the RTCPeerConnection offer.
   */
  public isOffererFor(remotePeerId: string): boolean {
    return this.localPeerId < remotePeerId;
  }

  /**
   * Discovers a new peer in the room and establishes connection if we are the offerer.
   */
  public initiateConnection(remotePeerId: string) {
    if (this.peers.has(remotePeerId)) return;

    const isOfferer = this.isOffererFor(remotePeerId);
    const entry = this.createPeerEntry(remotePeerId, isOfferer);
    this.peers.set(remotePeerId, entry);

    if (isOfferer) {
      // Create data channel and generate offer
      const dc = entry.pc.createDataChannel('satorrent-channel', {
        ordered: true,
      });
      dc.binaryType = 'arraybuffer';
      entry.dc = dc;
      this.setupDataChannel(remotePeerId, dc);

      entry.pc
        .createOffer()
        .then((offer) => entry.pc.setLocalDescription(offer))
        .then(() => {
          if (entry.pc.localDescription) {
            this.events.onSignalNeeded(remotePeerId, 'offer', entry.pc.localDescription);
          }
        })
        .catch((err) => {
          console.error(`Failed to create offer for ${remotePeerId}:`, err);
        });
    }
  }

  private createPeerEntry(remotePeerId: string, isOfferer: boolean): PeerConnectionEntry {
    const pc = new RTCPeerConnection(this.getRtcConfig());

    const entry: PeerConnectionEntry = {
      peerId: remotePeerId,
      pc,
      queuedIceCandidates: [],
      isOfferer,
      latencyMs: 0,
      lastPingTime: 0,
      bytesReceivedWindow: 0,
      bytesSentWindow: 0,
      downloadBps: 0,
      uploadBps: 0,
      totalBytesReceived: 0,
      totalBytesSent: 0,
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.events.onSignalNeeded(remotePeerId, 'ice-candidate', event.candidate.toJSON());
      }
    };

    pc.onconnectionstatechange = () => {
      this.events.onConnectionStateChange(remotePeerId, pc.connectionState);
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeer(remotePeerId);
      }
    };

    pc.ondatachannel = (event) => {
      const dc = event.channel;
      dc.binaryType = 'arraybuffer';
      entry.dc = dc;
      this.setupDataChannel(remotePeerId, dc);
    };

    return entry;
  }

  private setupDataChannel(remotePeerId: string, dc: RTCDataChannel) {
    const handleOpen = () => {
      this.sendJson(remotePeerId, {
        type: 'HELLO',
        peerId: this.localPeerId,
        clientVersion: '1.0.0-sat',
      });
      this.events.onDataChannelOpen(remotePeerId);
    };

    if (dc.readyState === 'open') {
      setTimeout(handleOpen, 0);
    } else {
      dc.onopen = handleOpen;
    }

    dc.onclose = () => {
      this.events.onDataChannelClose(remotePeerId);
    };

    dc.onerror = (err) => {
      console.warn(`DataChannel error with ${remotePeerId}:`, err);
    };

    dc.onmessage = (event) => {
      const entry = this.peers.get(remotePeerId);
      if (!entry) return;

      if (typeof event.data === 'string') {
        // JSON control protocol message
        entry.bytesReceivedWindow += event.data.length;
        entry.totalBytesReceived += event.data.length;

        try {
          const msg = JSON.parse(event.data);
          this.handleJsonControlMessage(remotePeerId, msg);
        } catch (err) {
          console.error(`Invalid JSON from ${remotePeerId}:`, err);
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Binary piece frame
        const size = event.data.byteLength;
        entry.bytesReceivedWindow += size;
        entry.totalBytesReceived += size;

        if (this.events.onTransferEvent) {
          this.events.onTransferEvent(remotePeerId, this.localPeerId, 'recv', size);
        }

        const unpacked = unpackBinaryPiece(event.data);
        if (unpacked) {
          this.events.onBinaryPiece(
            remotePeerId,
            unpacked.header.pieceIndex,
            unpacked.header.fileId,
            unpacked.header.requestId,
            unpacked.payload
          );
        } else {
          console.warn(`Received invalid binary frame from ${remotePeerId}, length: ${size}`);
        }
      }
    };
  }

  private handleJsonControlMessage(remotePeerId: string, msg: any) {
    const entry = this.peers.get(remotePeerId);

    if (msg.type === 'PING') {
      // Respond immediately with PONG
      this.sendJson(remotePeerId, { type: 'PONG', timestamp: msg.timestamp });
      return;
    }

    if (msg.type === 'PONG') {
      if (entry && msg.timestamp) {
        const rtt = Date.now() - msg.timestamp;
        entry.latencyMs = rtt;
        this.events.onLatencyUpdate(remotePeerId, rtt);
      }
      return;
    }

    this.events.onJsonMessage(remotePeerId, msg);
  }

  /**
   * Handles incoming signaling messages (offer, answer, ice-candidate) from the server.
   */
  public async handleSignal(
    remotePeerId: string,
    signalType: 'offer' | 'answer' | 'ice-candidate',
    payload: any
  ) {
    let entry = this.peers.get(remotePeerId);

    if (!entry) {
      const isOfferer = this.isOffererFor(remotePeerId);
      entry = this.createPeerEntry(remotePeerId, isOfferer);
      this.peers.set(remotePeerId, entry);
    }

    const pc = entry.pc;

    try {
      if (signalType === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        // Drain queued ICE candidates
        while (entry.queuedIceCandidates.length > 0) {
          const cand = entry.queuedIceCandidates.shift()!;
          if (cand && (cand.candidate || cand.candidate === '')) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        }

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        if (pc.localDescription) {
          this.events.onSignalNeeded(remotePeerId, 'answer', pc.localDescription);
        }
      } else if (signalType === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(payload));
        // Drain queued ICE candidates
        while (entry.queuedIceCandidates.length > 0) {
          const cand = entry.queuedIceCandidates.shift()!;
          if (cand && (cand.candidate || cand.candidate === '')) {
            await pc.addIceCandidate(new RTCIceCandidate(cand));
          }
        }
      } else if (signalType === 'ice-candidate') {
        if (payload && (payload.candidate || payload.candidate === '')) {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(new RTCIceCandidate(payload));
          } else {
            entry.queuedIceCandidates.push(payload);
          }
        }
      }
    } catch (err) {
      console.error(`Error handling ${signalType} from ${remotePeerId}:`, err);
    }
  }

  /**
   * Sends a JSON control message over the peer's RTCDataChannel.
   */
  public sendJson(remotePeerId: string, message: any): boolean {
    const entry = this.peers.get(remotePeerId);
    if (!entry || !entry.dc || entry.dc.readyState !== 'open') {
      return false;
    }

    try {
      const str = JSON.stringify(message);
      entry.dc.send(str);
      entry.bytesSentWindow += str.length;
      entry.totalBytesSent += str.length;
      return true;
    } catch (err) {
      console.warn(`Failed to send JSON to ${remotePeerId}:`, err);
      return false;
    }
  }

  /**
   * Broadcasts a JSON control message to all open data channels.
   */
  public broadcastJson(message: any) {
    for (const [peerId] of this.peers) {
      this.sendJson(peerId, message);
    }
  }

  /**
   * Sends a binary piece frame to a specific peer.
   */
  public sendBinaryPiece(
    remotePeerId: string,
    fileId: string,
    pieceIndex: number,
    requestId: string,
    payload: ArrayBuffer
  ): boolean {
    const entry = this.peers.get(remotePeerId);
    if (!entry || !entry.dc || entry.dc.readyState !== 'open') {
      return false;
    }

    try {
      // Guard against overwhelmed RTCDataChannel bufferedAmount
      if (entry.dc.bufferedAmount > 8 * 1024 * 1024) {
        console.warn(`Peer ${remotePeerId} data channel buffer high (${entry.dc.bufferedAmount} bytes), pausing frame`);
        return false;
      }

      const frame = packBinaryPiece(fileId, pieceIndex, requestId, payload);
      entry.dc.send(frame);

      const size = frame.byteLength;
      entry.bytesSentWindow += size;
      entry.totalBytesSent += size;

      if (this.events.onTransferEvent) {
        this.events.onTransferEvent(this.localPeerId, remotePeerId, 'send', size);
      }

      return true;
    } catch (err) {
      console.warn(`Failed to send binary piece to ${remotePeerId}:`, err);
      return false;
    }
  }

  public isPeerReady(remotePeerId: string): boolean {
    const entry = this.peers.get(remotePeerId);
    return !!entry && !!entry.dc && entry.dc.readyState === 'open';
  }

  public getPeerDataChannelState(remotePeerId: string): RTCDataChannelState {
    const entry = this.peers.get(remotePeerId);
    return entry?.dc?.readyState || 'closed';
  }

  public getPeerConnectionState(remotePeerId: string): RTCPeerConnectionState {
    const entry = this.peers.get(remotePeerId);
    return entry?.pc?.connectionState || 'closed';
  }

  public getLatency(remotePeerId: string): number {
    return this.peers.get(remotePeerId)?.latencyMs || 0;
  }

  public closePeer(remotePeerId: string) {
    const entry = this.peers.get(remotePeerId);
    if (!entry) return;

    try {
      if (entry.dc) {
        entry.dc.close();
      }
      entry.pc.close();
    } catch (err) {
      console.warn(`Error closing peer connection for ${remotePeerId}:`, err);
    }

    this.peers.delete(remotePeerId);
    this.events.onDataChannelClose(remotePeerId);
  }

  public closeAll() {
    for (const [peerId] of this.peers) {
      this.closePeer(peerId);
    }
    this.peers.clear();
  }

  private startTimers() {
    // Ping interval for RTT latency measurement (every 4 seconds)
    this.pingIntervalTimer = window.setInterval(() => {
      const now = Date.now();
      for (const [peerId, entry] of this.peers) {
        if (entry.dc && entry.dc.readyState === 'open') {
          entry.lastPingTime = now;
          this.sendJson(peerId, { type: 'PING', timestamp: now });
        }
      }
    }, 4000);

    // Speed calculation window (every 1 second)
    this.speedIntervalTimer = window.setInterval(() => {
      for (const [peerId, entry] of this.peers) {
        entry.downloadBps = entry.bytesReceivedWindow;
        entry.uploadBps = entry.bytesSentWindow;

        this.events.onSpeedUpdate(peerId, entry.downloadBps, entry.uploadBps);

        // Reset window for next second
        entry.bytesReceivedWindow = 0;
        entry.bytesSentWindow = 0;
      }
    }, 1000);
  }

  public destroy() {
    if (this.pingIntervalTimer) clearInterval(this.pingIntervalTimer);
    if (this.speedIntervalTimer) clearInterval(this.speedIntervalTimer);
    this.closeAll();
  }
}
