import React, { useState } from 'react';
import { Check, Clock, Radio, XCircle, Info, ShieldCheck, Layers } from 'lucide-react';
import { LocalTorrent, SwarmPeer } from '../types';
import { formatBytes } from '../lib/crypto';

interface PieceBitmapProps {
  torrent: LocalTorrent;
  peers: Map<string, SwarmPeer>;
}

export const PieceBitmap: React.FC<PieceBitmapProps> = ({ torrent, peers }) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const pieceCount = torrent.manifest.pieceCount;
  const verifiedPieces = torrent.verifiedPieces;
  const inFlightPieces = torrent.inFlightPieces;

  // Compute piece availability on peers for this specific file
  const getPeersWithPiece = (index: number): string[] => {
    const list: string[] = [];
    for (const [peerId, peer] of peers) {
      const owned = peer.ownedPiecesByFile?.get(torrent.manifest.fileId) || peer.ownedPieces;
      if (owned.has(index)) {
        list.push(peerId);
      }
    }
    return list;
  };

  const getPieceStatus = (index: number): 'verified' | 'in_flight' | 'available' | 'missing' => {
    if (verifiedPieces.has(index)) return 'verified';
    if (inFlightPieces.has(index)) return 'in_flight';
    const owners = getPeersWithPiece(index);
    if (owners.length > 0) return 'available';
    return 'missing';
  };

  const getStatusColor = (status: 'verified' | 'in_flight' | 'available' | 'missing') => {
    switch (status) {
      case 'verified':
        return 'bg-emerald-500 hover:bg-emerald-400 border border-emerald-400/50 shadow-[0_0_6px_rgba(16,185,129,0.35)]';
      case 'in_flight':
        return 'bg-purple-500 hover:bg-purple-400 border border-purple-400/50 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.5)]';
      case 'available':
        return 'bg-cyan-500/80 hover:bg-cyan-400 border border-cyan-400/50 shadow-[0_0_6px_rgba(6,182,212,0.3)]';
      case 'missing':
      default:
        return 'bg-slate-800/90 hover:bg-slate-700 border border-slate-700/50';
    }
  };

  // Get size of a specific piece (last piece may be smaller than pieceSize)
  const getPieceByteSize = (index: number): number => {
    if (index === pieceCount - 1) {
      const rem = torrent.manifest.fileSize % torrent.manifest.pieceSize;
      return rem === 0 ? torrent.manifest.pieceSize : rem;
    }
    return torrent.manifest.pieceSize;
  };

  const hoveredOwners = hoveredIndex !== null ? getPeersWithPiece(hoveredIndex) : [];
  const hoveredInFlight = hoveredIndex !== null ? inFlightPieces.get(hoveredIndex) : null;
  const hoveredStatus = hoveredIndex !== null ? getPieceStatus(hoveredIndex) : null;

  return (
    <div className="space-y-2.5 font-mono select-none">
      {/* Header & Legend */}
      <div className="flex flex-wrap items-center justify-between text-xs gap-2 bg-[#090e1b] px-3 py-2 rounded-lg border border-slate-800/80">
        <div className="flex items-center gap-3 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
            <span className="text-slate-300 font-semibold">Verified ({verifiedPieces.size})</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-purple-500 animate-pulse" />
            <span className="text-slate-300 font-semibold">In Flight ({inFlightPieces.size})</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-cyan-500/80" />
            <span className="text-slate-300 font-semibold">Swarm Available</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-xs bg-slate-800 border border-slate-700" />
            <span className="text-slate-400">Missing</span>
          </div>
        </div>

        <div className="text-[11px] text-slate-400">
          <span>Pieces: </span>
          <strong className="text-white">{pieceCount}</strong>
          <span className="text-slate-500"> ({formatBytes(torrent.manifest.pieceSize)} / piece)</span>
        </div>
      </div>

      {/* Dense Piece Grid Container */}
      <div className="relative p-2.5 bg-[#050811] rounded-lg border border-slate-800/90 shadow-inner">
        <div
          className="grid gap-1 max-h-56 overflow-y-auto pr-1"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${pieceCount > 200 ? '12px' : pieceCount > 80 ? '15px' : '18px'}, 1fr))`,
          }}
          onMouseLeave={() => setHoveredIndex(null)}
        >
          {Array.from({ length: pieceCount }, (_, i) => {
            const status = getPieceStatus(i);
            const isHovered = hoveredIndex === i;

            return (
              <div
                key={i}
                onMouseEnter={() => setHoveredIndex(i)}
                className={`aspect-square rounded-xs transition-transform duration-100 cursor-pointer ${getStatusColor(
                  status
                )} ${isHovered ? 'scale-125 z-10 ring-2 ring-white' : ''}`}
                title={`Piece #${i}`}
              />
            );
          })}
        </div>

        {/* Hover Inspector Tooltip */}
        {hoveredIndex !== null && (
          <div className="mt-2.5 p-2 rounded bg-slate-900/95 border border-cyan-500/40 text-[11px] flex flex-wrap items-center justify-between gap-3 text-slate-300 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
            <div className="flex items-center gap-3">
              <span className="font-bold text-white">
                Piece #{hoveredIndex}
              </span>
              <span className="text-slate-500">|</span>
              <span>
                Status:{' '}
                <strong
                  className={
                    hoveredStatus === 'verified'
                      ? 'text-emerald-400'
                      : hoveredStatus === 'in_flight'
                      ? 'text-purple-400'
                      : hoveredStatus === 'available'
                      ? 'text-cyan-400'
                      : 'text-slate-400'
                  }
                >
                  {hoveredStatus === 'verified'
                    ? 'Verified locally'
                    : hoveredStatus === 'in_flight'
                    ? 'In Flight'
                    : hoveredStatus === 'available'
                    ? 'Available on Swarm'
                    : 'Missing'}
                </strong>
              </span>
              <span className="text-slate-500">|</span>
              <span>
                Size: <strong className="text-slate-200">{formatBytes(getPieceByteSize(hoveredIndex))}</strong>
              </span>
            </div>

            <div className="flex items-center gap-3 text-[10px]">
              {hoveredInFlight && (
                <>
                  <span>
                    Source: <strong className="text-cyan-300">{hoveredInFlight.peerId}</strong>
                  </span>
                  <span>
                    Retry: <strong className="text-amber-400">{hoveredInFlight.retryCount ?? 0}</strong>
                  </span>
                </>
              )}

              {hoveredStatus === 'available' && hoveredOwners.length > 0 && (
                <span>
                  Owners: <strong className="text-cyan-300">{hoveredOwners.length} {hoveredOwners.length === 1 ? 'peer' : 'peers'}</strong>
                </span>
              )}

              {hoveredStatus === 'verified' && (
                <span className="text-emerald-400 font-bold flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  SHA-256 Validated
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
