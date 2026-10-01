/**
 * PieceScheduler for SATorrent.
 * Implements a BitTorrent-style Rarest-First scheduling algorithm with in-flight concurrency
 * limits, peer ownership tracking, timeout detection, and automatic reassignment on disconnect.
 */

import { generateId } from '../lib/crypto';
import { DetailedInFlightItem, SchedulerStats } from '../types';

export interface ScheduledRequest {
  fileId: string;
  pieceIndex: number;
  peerId: string;
  requestId: string;
}

export interface InFlightInfo {
  peerId: string;
  requestedAt: number;
  requestId: string;
  retryCount: number;
}

export class PieceScheduler {
  private fileId: string;
  private pieceCount: number;
  private verifiedPieces = new Set<number>();
  private peerPieces = new Map<string, Set<number>>();
  private inFlight = new Map<number, InFlightInfo>();
  private retryCounts = new Map<number, number>();

  private maxInFlightPerPeer: number;
  private requestTimeoutMs: number;

  constructor(
    fileId: string,
    pieceCount: number,
    options: { maxInFlightPerPeer?: number; requestTimeoutMs?: number } = {}
  ) {
    this.fileId = fileId;
    this.pieceCount = pieceCount;
    this.maxInFlightPerPeer = options.maxInFlightPerPeer ?? 2;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 5000;
  }

  public setVerifiedPieces(pieces: Set<number>) {
    this.verifiedPieces = new Set(pieces);
    for (const p of this.verifiedPieces) {
      this.inFlight.delete(p);
    }
  }

  public markPieceVerified(pieceIndex: number) {
    this.verifiedPieces.add(pieceIndex);
    this.inFlight.delete(pieceIndex);
  }

  public setPeerHasPiece(peerId: string, pieceIndex: number) {
    let set = this.peerPieces.get(peerId);
    if (!set) {
      set = new Set<number>();
      this.peerPieces.set(peerId, set);
    }
    set.add(pieceIndex);
  }

  public setPeerPiecesBatch(peerId: string, pieces: number[]) {
    let set = this.peerPieces.get(peerId);
    if (!set) {
      set = new Set<number>();
      this.peerPieces.set(peerId, set);
    }
    for (const p of pieces) {
      set.add(p);
    }
  }

  public getPeerPieces(peerId: string): Set<number> {
    return this.peerPieces.get(peerId) || new Set<number>();
  }

  public getVerifiedPieces(): Set<number> {
    return this.verifiedPieces;
  }

  public getInFlightMap(): Map<number, InFlightInfo> {
    return this.inFlight;
  }

  public isComplete(): boolean {
    return this.verifiedPieces.size >= this.pieceCount;
  }

  public getProgressPercentage(): number {
    if (this.pieceCount === 0) return 0;
    return Math.round((this.verifiedPieces.size / this.pieceCount) * 100);
  }

  /**
   * Cleans up state when a peer disconnects and reassigns its pending in-flight requests.
   */
  public handlePeerDisconnected(peerId: string): number[] {
    this.peerPieces.delete(peerId);

    const evictedPieces: number[] = [];
    for (const [pieceIndex, info] of this.inFlight.entries()) {
      if (info.peerId === peerId) {
        this.inFlight.delete(pieceIndex);
        evictedPieces.push(pieceIndex);
      }
    }
    return evictedPieces;
  }

  /**
   * Handles a PIECE_REJECT message from a peer.
   */
  public handlePieceRejected(pieceIndex: number, peerId: string) {
    const info = this.inFlight.get(pieceIndex);
    if (info && info.peerId === peerId) {
      this.inFlight.delete(pieceIndex);
      // Remove piece from peer's availability if they rejected it
      this.peerPieces.get(peerId)?.delete(pieceIndex);
    }
  }

  /**
   * Checks for timed-out requests and re-queues them with incremented retry count.
   */
  public checkTimeouts(): number[] {
    const now = Date.now();
    const timedOut: number[] = [];

    for (const [pieceIndex, info] of this.inFlight.entries()) {
      if (now - info.requestedAt > this.requestTimeoutMs) {
        this.inFlight.delete(pieceIndex);
        const prevRetries = this.retryCounts.get(pieceIndex) || 0;
        this.retryCounts.set(pieceIndex, prevRetries + 1);
        timedOut.push(pieceIndex);
      }
    }

    return timedOut;
  }

  /**
   * Computes piece rarity across all currently connected peers.
   * Rarity = number of connected peers that possess this piece.
   */
  public computePieceRarity(): Map<number, number> {
    const rarity = new Map<number, number>();

    for (let p = 0; p < this.pieceCount; p++) {
      if (this.verifiedPieces.has(p)) continue;

      let count = 0;
      for (const [, owned] of this.peerPieces) {
        if (owned.has(p)) {
          count++;
        }
      }
      if (count > 0) {
        rarity.set(p, count);
      }
    }

    return rarity;
  }

  /**
   * Schedules the next batch of piece requests according to the rarest-first algorithm.
   * Only queries active/ready peers.
   */
  public scheduleNextRequests(readyPeerIds: string[]): ScheduledRequest[] {
    this.checkTimeouts();

    if (this.isComplete() || readyPeerIds.length === 0) {
      return [];
    }

    // 1. Calculate active in-flight count per ready peer
    const peerInFlightCount = new Map<string, number>();
    for (const peerId of readyPeerIds) {
      peerInFlightCount.set(peerId, 0);
    }

    for (const [, info] of this.inFlight) {
      if (peerInFlightCount.has(info.peerId)) {
        peerInFlightCount.set(info.peerId, (peerInFlightCount.get(info.peerId) || 0) + 1);
      }
    }

    // 2. Identify missing pieces not currently in-flight
    const missingPieces: number[] = [];
    for (let p = 0; p < this.pieceCount; p++) {
      if (!this.verifiedPieces.has(p) && !this.inFlight.has(p)) {
        missingPieces.push(p);
      }
    }

    if (missingPieces.length === 0) {
      return [];
    }

    // 3. Compute rarity for all missing pieces
    const rarityMap = this.computePieceRarity();

    // Filter to missing pieces that at least one connected ready peer actually owns
    const availableMissing = missingPieces.filter((p) => (rarityMap.get(p) ?? 0) > 0);

    // Sort rarest first (lowest rarity count first)
    availableMissing.sort((a, b) => {
      const rA = rarityMap.get(a) ?? 999;
      const rB = rarityMap.get(b) ?? 999;
      if (rA !== rB) return rA - rB; // rarest first
      return a - b; // tie breaker
    });

    const scheduled: ScheduledRequest[] = [];

    // 4. Assign rarest pieces to available peers within their concurrency quota
    for (const pieceIndex of availableMissing) {
      // Find candidate peers that own this piece and have available slots
      const candidatePeers = readyPeerIds.filter((peerId) => {
        const owns = this.peerPieces.get(peerId)?.has(pieceIndex);
        const inFlight = peerInFlightCount.get(peerId) || 0;
        return owns && inFlight < this.maxInFlightPerPeer;
      });

      if (candidatePeers.length === 0) {
        continue;
      }

      // Pick peer with the least currently assigned in-flight requests (load balancing)
      // When load is equal, prefer peers with fewer total pieces (non-seeders/re-seeders)
      // to actively propagate pieces through the swarm and offload the original seeder!
      candidatePeers.sort((a, b) => {
        const loadA = peerInFlightCount.get(a) || 0;
        const loadB = peerInFlightCount.get(b) || 0;
        if (loadA !== loadB) return loadA - loadB;

        const piecesA = this.peerPieces.get(a)?.size || 0;
        const piecesB = this.peerPieces.get(b)?.size || 0;
        return piecesA - piecesB;
      });

      const selectedPeer = candidatePeers[0];
      const requestId = generateId(8);
      const retries = this.retryCounts.get(pieceIndex) || 0;

      this.inFlight.set(pieceIndex, {
        peerId: selectedPeer,
        requestedAt: Date.now(),
        requestId,
        retryCount: retries,
      });

      peerInFlightCount.set(selectedPeer, (peerInFlightCount.get(selectedPeer) || 0) + 1);

      scheduled.push({
        fileId: this.fileId,
        pieceIndex,
        peerId: selectedPeer,
        requestId,
      });
    }

    return scheduled;
  }

  public getDetailedInFlightList(): DetailedInFlightItem[] {
    const now = Date.now();
    const list: DetailedInFlightItem[] = [];
    for (const [pieceIndex, info] of this.inFlight.entries()) {
      list.push({
        pieceIndex,
        peerId: info.peerId,
        status: 'In Flight',
        requestedAt: info.requestedAt,
        elapsedMs: Math.max(0, now - info.requestedAt),
        requestId: info.requestId,
        retryCount: info.retryCount,
      });
    }
    return list.sort((a, b) => a.pieceIndex - b.pieceIndex);
  }

  public getMissingPieces(): number[] {
    const missing: number[] = [];
    for (let p = 0; p < this.pieceCount; p++) {
      if (!this.verifiedPieces.has(p)) {
        missing.push(p);
      }
    }
    return missing;
  }

  public getSchedulerStats(fileName?: string): SchedulerStats {
    const missing = this.getMissingPieces();
    const rarityMap = this.computePieceRarity();

    // Rarity distribution: count how many pieces have rarity 1, 2, 3, etc.
    const rarityCounts = new Map<number, number>();
    for (const [, count] of rarityMap) {
      rarityCounts.set(count, (rarityCounts.get(count) || 0) + 1);
    }
    const rarityBreakdown = Array.from(rarityCounts.entries())
      .map(([rarity, pieceCount]) => ({ rarity, pieceCount }))
      .sort((a, b) => a.rarity - b.rarity);

    // Peer availability counts
    const peerPieceCounts: { peerId: string; piecesCount: number }[] = [];
    for (const [peerId, pieces] of this.peerPieces) {
      peerPieceCounts.push({ peerId, piecesCount: pieces.size });
    }

    // Missing pieces available on at least one peer
    const availableMissingCount = missing.filter((p) => (rarityMap.get(p) ?? 0) > 0).length;

    return {
      fileId: this.fileId,
      fileName: fileName || this.fileId,
      pieceCount: this.pieceCount,
      verifiedCount: this.verifiedPieces.size,
      missingCount: missing.length,
      inFlightCount: this.inFlight.size,
      availableMissingCount,
      rarityBreakdown,
      peerPieceCounts,
      inFlightList: this.getDetailedInFlightList(),
    };
  }

  public getFileId(): string {
    return this.fileId;
  }

  public getPieceCount(): number {
    return this.pieceCount;
  }
}
