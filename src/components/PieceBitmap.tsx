import React, { useState } from 'react';
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
        return 'bg-emerald-600 hover:bg-emerald-500';
      case 'in_flight':
        return 'bg-purple-600 hover:bg-purple-500';
      case 'available':
        return 'bg-blue-600 hover:bg-blue-500';
      case 'missing':
      default:
        return 'bg-[#22272e] hover:bg-[#2d333b]';
    }
  };

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
    <div className="space-y-2 select-none text-xs">
      {/* Header & Legend */}
      <div className="flex flex-wrap items-center justify-between text-[11px] gap-2 text-[#9299a3] px-1">
        <div className="flex items-center gap-3">
          <span className="font-medium text-[#e7eaee]">Piece Availability:</span>

          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-600 inline-block" />
            <span>Verified ({verifiedPieces.size})</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-blue-600 inline-block" />
            <span>Available</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-purple-600 inline-block" />
            <span>In Flight ({inFlightPieces.size})</span>
          </div>

          <div className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-xs bg-[#22272e] border border-[#272d34] inline-block" />
            <span>Missing</span>
          </div>
        </div>

        <div className="font-mono text-[10px]">
          {pieceCount} pieces ({formatBytes(torrent.manifest.pieceSize)}/piece)
        </div>
      </div>

      {/* Dense, Clean Piece Grid Container (No Glow) */}
      <div className="relative p-2 bg-[#111418] rounded border border-[#272d34]">
        <div
          className="grid gap-[3px] max-h-48 overflow-y-auto pr-1"
          style={{
            gridTemplateColumns: `repeat(auto-fill, minmax(${pieceCount > 200 ? '10px' : pieceCount > 80 ? '12px' : '15px'}, 1fr))`,
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
                className={`aspect-square rounded-xs transition-colors cursor-pointer ${getStatusColor(
                  status
                )} ${isHovered ? 'ring-1 ring-white' : ''}`}
                title={`Piece #${i}`}
              />
            );
          })}
        </div>

        {/* Dense Functional Tooltip */}
        {hoveredIndex !== null && (
          <div className="mt-2 p-2 bg-[#161a1f] border border-[#272d34] rounded text-[11px] font-mono text-[#e7eaee] flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-blue-400">Piece #{hoveredIndex}</span>
              <span className="text-[#656d77]">|</span>
              <span>
                Status:{' '}
                <strong
                  className={
                    hoveredStatus === 'verified'
                      ? 'text-emerald-400'
                      : hoveredStatus === 'in_flight'
                      ? 'text-purple-400'
                      : hoveredStatus === 'available'
                      ? 'text-blue-400'
                      : 'text-[#9299a3]'
                  }
                >
                  {hoveredStatus === 'verified'
                    ? 'Verified'
                    : hoveredStatus === 'in_flight'
                    ? 'In Flight'
                    : hoveredStatus === 'available'
                    ? 'Available on swarm'
                    : 'Missing'}
                </strong>
              </span>
              <span className="text-[#656d77]">|</span>
              <span>Size: {formatBytes(getPieceByteSize(hoveredIndex))}</span>
            </div>

            <div className="flex items-center gap-3 text-[10px] text-[#9299a3]">
              {hoveredInFlight && (
                <>
                  <span>Source: <strong className="text-[#e7eaee]">{hoveredInFlight.peerId}</strong></span>
                  <span>Retry: {hoveredInFlight.retryCount ?? 0}</span>
                </>
              )}
              {hoveredStatus === 'available' && hoveredOwners.length > 0 && (
                <span>Sources: {hoveredOwners.length} {hoveredOwners.length === 1 ? 'peer' : 'peers'}</span>
              )}
              {hoveredStatus === 'verified' && (
                <span className="text-emerald-400">✓ SHA-256 Validated</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
