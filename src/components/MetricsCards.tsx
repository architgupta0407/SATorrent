import React from 'react';
import { Users, ArrowDown, ArrowUp, Layers, CheckCircle } from 'lucide-react';
import { formatSpeed } from '../lib/crypto';
import { SwarmPeer, LocalTorrent } from '../types';

interface MetricsCardsProps {
  peers: Map<string, SwarmPeer>;
  torrents: Map<string, LocalTorrent>;
  completedFilesCount: number;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  peers,
  torrents,
  completedFilesCount,
}) => {
  let totalDlBps = 0;
  let totalUlBps = 0;

  for (const [, peer] of peers) {
    totalDlBps += peer.downloadSpeedBps;
    totalUlBps += peer.uploadSpeedBps;
  }

  let totalVerifiedPieces = 0;
  let totalPieceCount = 0;
  let activeTorrentsCount = 0;

  for (const [, t] of torrents) {
    totalVerifiedPieces += t.verifiedPieces.size;
    totalPieceCount += t.manifest.pieceCount;
    if (t.status === 'downloading' || t.verifiedPieces.size < t.manifest.pieceCount) {
      activeTorrentsCount++;
    }
  }

  return (
    <div className="bg-[#15191e] border border-[#272d34] rounded px-3 py-1.5 flex flex-wrap items-center justify-between gap-y-2 gap-x-6 text-xs select-none">
      <div className="flex items-center gap-6 flex-wrap">
        {/* Peers */}
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-[#656d77]" />
          <span className="text-[#9299a3]">Peers:</span>
          <span className="font-semibold text-[#e7eaee] font-mono">{peers.size}</span>
        </div>

        {/* Download Rate */}
        <div className="flex items-center gap-1.5">
          <ArrowDown className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-[#9299a3]">Down:</span>
          <span className="font-semibold text-[#e7eaee] font-mono">
            {totalDlBps > 0 ? formatSpeed(totalDlBps) : '0.0 B/s'}
          </span>
        </div>

        {/* Upload Rate */}
        <div className="flex items-center gap-1.5">
          <ArrowUp className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-[#9299a3]">Up:</span>
          <span className="font-semibold text-[#e7eaee] font-mono">
            {totalUlBps > 0 ? formatSpeed(totalUlBps) : '0.0 B/s'}
          </span>
        </div>

        {/* Active Torrents */}
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-[#656d77]" />
          <span className="text-[#9299a3]">Torrents:</span>
          <span className="font-semibold text-[#e7eaee] font-mono">
            {activeTorrentsCount} <span className="text-[#656d77] font-normal font-sans">({torrents.size} total)</span>
          </span>
        </div>
      </div>

      {/* Pieces Verified status on right */}
      <div className="flex items-center gap-1.5 text-[11px] text-[#9299a3]">
        <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
        <span>Verified Pieces:</span>
        <span className="font-mono font-semibold text-[#e7eaee]">
          {totalVerifiedPieces}
          {totalPieceCount > 0 && <span className="text-[#656d77]"> / {totalPieceCount}</span>}
        </span>
      </div>
    </div>
  );
};
