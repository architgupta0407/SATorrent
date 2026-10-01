import React, { useState } from 'react';
import {
  GraduationCap,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Circle,
  Activity,
  Layers,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { RoomState, LocalTorrent, CollegeDemoState } from '../types';

interface CollegeDemoBadgeProps {
  roomState: RoomState | null;
  peersCount: number;
  primaryTorrent?: LocalTorrent;
  demoState: CollegeDemoState;
}

export const CollegeDemoBadge: React.FC<CollegeDemoBadgeProps> = ({
  roomState,
  peersCount,
  primaryTorrent,
  demoState,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const checklistItems = [
    { key: 'roomCreated', label: 'Room created', done: demoState.roomCreated },
    { key: 'peersConnected', label: 'Peers connected in mesh', done: demoState.peersConnected },
    { key: 'manifestReceived', label: 'Manifest metadata received', done: demoState.manifestReceived },
    { key: 'piecesTransferring', label: 'Pieces transferring over RTCDataChannel', done: demoState.piecesTransferring },
    { key: 'peerReSeeding', label: 'Peer re-seeding (P2P propagation)', done: demoState.peerReSeeding },
    { key: 'fileVerified', label: 'File SHA-256 verified & authentic', done: demoState.fileVerified },
  ];

  const totalPieces = primaryTorrent?.manifest.pieceCount || 0;
  const verifiedPieces = primaryTorrent?.verifiedPieces.size || 0;
  const isSwarmActive = peersCount > 0 && primaryTorrent && (primaryTorrent.downloadSpeedBps > 0 || primaryTorrent.uploadSpeedBps > 0 || verifiedPieces < totalPieces);

  return (
    <div className="fixed bottom-4 left-4 z-30 font-mono text-xs select-none">
      <div className="bg-[#080d19]/95 border border-cyan-500/50 rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.25)] backdrop-blur-md overflow-hidden max-w-xs sm:w-80">
        {/* Banner Header */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between px-3.5 py-2.5 bg-gradient-to-r from-cyan-950/80 via-slate-900 to-sky-950/80 border-b border-cyan-800/40 cursor-pointer hover:bg-slate-900 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-cyan-500/20 text-cyan-400">
              <GraduationCap className="w-4 h-4" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-white tracking-wide">
                SATorrent College Demo
              </div>
              <div className="text-[9px] text-cyan-400 font-semibold">
                Live Swarm Presentation Mode
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              className={`px-1.5 py-0.2 text-[9px] font-bold rounded-full ${
                isSwarmActive
                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-700 animate-pulse'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {isSwarmActive ? 'ACTIVE' : 'IDLE'}
            </span>
            <button className="text-slate-400 hover:text-white p-0.5">
              {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* Expandable Status Body */}
        {isExpanded && (
          <div className="p-3 space-y-3">
            {/* Live Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
              <div>
                <span className="text-slate-500 text-[10px]">Room:</span>
                <div className="font-bold text-cyan-300">
                  {roomState ? roomState.roomCode : 'None'}
                </div>
              </div>

              <div>
                <span className="text-slate-500 text-[10px]">Peers:</span>
                <div className="font-bold text-white">
                  {peersCount + 1} / {roomState?.maxPeers || 8}
                </div>
              </div>

              <div className="col-span-2 border-t border-slate-800 pt-1.5">
                <span className="text-slate-500 text-[10px]">Torrent:</span>
                <div className="font-bold text-slate-200 truncate">
                  {primaryTorrent ? primaryTorrent.manifest.fileName : 'None active'}
                </div>
              </div>

              <div>
                <span className="text-slate-500 text-[10px]">Pieces:</span>
                <div className="font-bold text-emerald-400">
                  {verifiedPieces} / {totalPieces}
                </div>
              </div>

              <div>
                <span className="text-slate-500 text-[10px]">Integrity:</span>
                <div
                  className={`font-bold ${
                    primaryTorrent?.overallSha256Status === 'verified'
                      ? 'text-emerald-400'
                      : primaryTorrent
                      ? 'text-amber-400'
                      : 'text-slate-500'
                  }`}
                >
                  {primaryTorrent?.overallSha256Status === 'verified'
                    ? 'SHA-256 VERIFIED'
                    : primaryTorrent
                    ? 'VERIFYING...'
                    : 'N/A'}
                </div>
              </div>
            </div>

            {/* Checklist */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Swarm Verification Checklist:
              </div>
              <div className="space-y-1 text-[11px]">
                {checklistItems.map((item) => (
                  <div
                    key={item.key}
                    className={`flex items-center gap-2 transition-colors ${
                      item.done ? 'text-emerald-300 font-semibold' : 'text-slate-500'
                    }`}
                  >
                    {item.done ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    ) : (
                      <Circle className="w-3.5 h-3.5 text-slate-600 flex-shrink-0" />
                    )}
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
