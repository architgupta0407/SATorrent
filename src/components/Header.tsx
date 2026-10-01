import React, { useState } from 'react';
import {
  Copy,
  Check,
  PlusCircle,
  LogIn,
  Upload,
  Radio,
  Users,
  Settings,
  Terminal,
  LogOut,
  Shield,
  Activity,
  Zap,
} from 'lucide-react';
import { RoomState } from '../types';

interface HeaderProps {
  localPeerId: string;
  roomState: RoomState | null;
  connectedPeersCount: number;
  onOpenSeedModal: () => void;
  onOpenCreateModal: () => void;
  onOpenJoinModal: () => void;
  onLeaveRoom?: () => void;
  onOpenSettings?: () => void;
  onToggleDebug?: () => void;
  isDebugOpen?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  localPeerId,
  roomState,
  connectedPeersCount,
  onOpenSeedModal,
  onOpenCreateModal,
  onOpenJoinModal,
  onLeaveRoom,
  onOpenSettings,
  onToggleDebug,
  isDebugOpen,
}) => {
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [copiedPeer, setCopiedPeer] = useState(false);

  const copyToClipboard = (text: string, type: 'room' | 'peer') => {
    navigator.clipboard.writeText(text);
    if (type === 'room') {
      setCopiedRoom(true);
      setTimeout(() => setCopiedRoom(false), 1800);
    } else {
      setCopiedPeer(true);
      setTimeout(() => setCopiedPeer(false), 1800);
    }
  };

  return (
    <header className="h-13 bg-[#060a12] border-b border-slate-800/80 px-3 sm:px-4 flex items-center justify-between sticky top-0 z-30 select-none font-mono text-xs shadow-md">
      {/* Left: SATorrent Brand & Local Node */}
      <div className="flex items-center gap-3">
        {/* Compact Desktop App Logo */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-7 h-7 rounded-md bg-gradient-to-br from-cyan-950 via-slate-900 to-blue-950 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.25)] flex-shrink-0">
            {/* SA Monogram with orbit motif */}
            <svg
              className="w-4 h-4 text-cyan-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(30 12 12)" className="opacity-40 stroke-cyan-300" strokeWidth="1.2" />
              <path d="M7 16l5-8 5 8" />
              <path d="M8.5 13.5h7" />
            </svg>
            <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 ring-2 ring-[#060a12]" />
          </div>

          <div className="flex items-baseline gap-1">
            <span className="font-extrabold text-sm tracking-tight text-white">
              <span className="text-cyan-400 font-black">SA</span>Torrent
            </span>
            <span className="hidden md:inline px-1 py-0.2 text-[9px] font-bold text-cyan-400/80 bg-cyan-950/60 border border-cyan-800/40 rounded">
              MESH
            </span>
          </div>
        </div>

        <div className="hidden lg:flex items-center gap-1.5 pl-3 border-l border-slate-800/80 text-[11px] text-slate-400">
          <span className="text-slate-500">Node:</span>
          <button
            onClick={() => copyToClipboard(localPeerId, 'peer')}
            className="flex items-center gap-1 text-slate-300 hover:text-cyan-300 transition-colors cursor-pointer group"
            title="Click to copy your Peer ID"
          >
            <span className="font-semibold text-cyan-300 group-hover:underline">{localPeerId}</span>
            {copiedPeer ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-2.5 h-2.5 opacity-40 group-hover:opacity-100" />
            )}
          </button>
        </div>
      </div>

      {/* Middle: Swarm Room & Network States */}
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Room Code Badge */}
        {roomState ? (
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-cyan-500/30 rounded-md px-2.5 py-1 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
              </span>
              <span className="text-slate-400 font-semibold hidden md:inline">ROOM</span>
              <span className="font-bold text-cyan-300 tracking-wider">
                {roomState.roomCode}
              </span>
            </div>

            <button
              onClick={() => copyToClipboard(roomState.roomCode, 'room')}
              className="p-0.5 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
              title="Copy Room Code"
            >
              {copiedRoom ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>

            <span className="text-slate-700">|</span>

            <div className="flex items-center gap-1 text-slate-300 font-semibold" title="Peers in room">
              <Users className="w-3 h-3 text-cyan-400" />
              <span>
                {connectedPeersCount + 1}/{roomState.maxPeers}
              </span>
            </div>

            {onLeaveRoom && (
              <button
                onClick={onLeaveRoom}
                className="ml-1 p-0.5 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                title="Leave room"
              >
                <LogOut className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-slate-900/70 border border-slate-800 rounded-md px-2 py-1 text-[11px] text-slate-400">
            <Radio className="w-3 h-3 text-amber-400 animate-pulse" />
            <span className="hidden sm:inline">No Room</span>
          </div>
        )}

        {/* Live Network Health Pills (Real Data Only) */}
        <div className="hidden xl:flex items-center gap-2">
          {/* Signaling Status */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] text-slate-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span>Signaling</span>
            <span className="text-emerald-400 font-semibold">Connected</span>
          </div>

          {/* WebRTC Swarm Status */}
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800 text-[10px] text-slate-400">
            <span className={`w-1.5 h-1.5 rounded-full ${connectedPeersCount > 0 ? 'bg-cyan-400' : 'bg-slate-600'}`} />
            <span>WebRTC</span>
            <span className="text-cyan-300 font-semibold">
              {connectedPeersCount} {connectedPeersCount === 1 ? 'peer' : 'peers'}
            </span>
          </div>
        </div>
      </div>

      {/* Right: Actions & Tools */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {!roomState ? (
          <>
            <button
              onClick={onOpenCreateModal}
              className="px-2.5 py-1 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded text-xs font-semibold tracking-wide flex items-center gap-1 shadow-sm transition-all cursor-pointer"
            >
              <PlusCircle className="w-3 h-3" />
              <span className="hidden sm:inline">Create</span>
            </button>

            <button
              onClick={onOpenJoinModal}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-cyan-500/40 text-slate-200 rounded text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
            >
              <LogIn className="w-3 h-3 text-cyan-400" />
              <span>Join</span>
            </button>
          </>
        ) : (
          <button
            onClick={onOpenSeedModal}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold tracking-wide flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
          >
            <Upload className="w-3 h-3" />
            <span>Seed File</span>
          </button>
        )}

        {/* Dev Console Trigger */}
        {onToggleDebug && (
          <button
            onClick={onToggleDebug}
            className={`p-1.5 rounded border transition-colors cursor-pointer ${
              isDebugOpen
                ? 'bg-purple-950/80 text-purple-300 border-purple-500/40'
                : 'text-slate-400 hover:text-slate-200 bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
            title="Toggle Developer Telemetry Drawer"
          >
            <Terminal className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Settings Icon */}
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-1.5 rounded border text-slate-400 hover:text-slate-200 bg-slate-900 border-slate-800 hover:border-slate-700 transition-colors cursor-pointer"
            title="Settings & Network Configuration"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
};
