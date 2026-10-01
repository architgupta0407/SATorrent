import React from 'react';
import {
  Users,
  ArrowDownCircle,
  ArrowUpCircle,
  Layers,
  ShieldCheck,
  Activity,
} from 'lucide-react';
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
  // Compute real metrics from runtime state
  let totalDlBps = 0;
  let totalUlBps = 0;
  let seedersCount = 0;
  let leechersCount = 0;

  for (const [, peer] of peers) {
    totalDlBps += peer.downloadSpeedBps;
    totalUlBps += peer.uploadSpeedBps;
    if (peer.role === 'seeder') seedersCount++;
    else if (peer.role === 'leecher' || peer.role === 're-seeder') leechersCount++;
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

  // Format statistics according to specification
  const cards = [
    {
      label: 'PEERS ONLINE',
      value: peers.size.toString(),
      subtext: peers.size > 0 ? `${seedersCount} Seeder${seedersCount === 1 ? '' : 's'} • ${leechersCount} Leecher${leechersCount === 1 ? '' : 's'}` : '0 Connected',
      icon: Users,
      iconColor: 'text-cyan-400',
      borderColor: 'border-cyan-800/40',
      accentGlow: 'hover:border-cyan-500/50',
    },
    {
      label: 'DOWNLOAD',
      value: totalDlBps > 0 ? formatSpeed(totalDlBps) : '0.0 B/s',
      subtext: totalDlBps > 0 ? 'P2P Direct Inbound' : 'Idle',
      icon: ArrowDownCircle,
      iconColor: 'text-sky-400',
      borderColor: 'border-sky-800/40',
      accentGlow: 'hover:border-sky-500/50',
    },
    {
      label: 'UPLOAD',
      value: totalUlBps > 0 ? formatSpeed(totalUlBps) : '0.0 B/s',
      subtext: totalUlBps > 0 ? 'Swarm Re-seeding' : 'Idle',
      icon: ArrowUpCircle,
      iconColor: 'text-emerald-400',
      borderColor: 'border-emerald-800/40',
      accentGlow: 'hover:border-emerald-500/50',
    },
    {
      label: 'ACTIVE TORRENTS',
      value: activeTorrentsCount.toString(),
      subtext: `${torrents.size} in engine • ${completedFilesCount} completed`,
      icon: Layers,
      iconColor: 'text-purple-400',
      borderColor: 'border-purple-800/40',
      accentGlow: 'hover:border-purple-500/50',
    },
    {
      label: 'PIECES VERIFIED',
      value: `${totalVerifiedPieces}${totalPieceCount > 0 ? ` / ${totalPieceCount}` : ''}`,
      subtext: 'SHA-256 Validated',
      icon: ShieldCheck,
      iconColor: 'text-teal-400',
      borderColor: 'border-teal-800/40',
      accentGlow: 'hover:border-teal-500/50',
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 font-mono select-none">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className={`p-2.5 rounded-lg bg-[#070b14] border ${c.borderColor} ${c.accentGlow} transition-all duration-200 flex flex-col justify-between shadow-sm`}
          >
            <div className="flex items-center justify-between text-slate-400 text-[10px] tracking-wider uppercase font-semibold">
              <span>{c.label}</span>
              <Icon className={`w-3.5 h-3.5 ${c.iconColor}`} />
            </div>

            <div className="my-1">
              <div className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                {c.value}
              </div>
            </div>

            <div className="text-[10px] text-slate-500 truncate">
              {c.subtext}
            </div>
          </div>
        );
      })}
    </div>
  );
};
