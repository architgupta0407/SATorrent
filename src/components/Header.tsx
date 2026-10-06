import React, { useState } from 'react';
import {
  Copy,
  Check,
  Plus,
  LogIn,
  Upload,
  Settings,
  Terminal,
  LogOut,
  Radio,
  Users,
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
      setTimeout(() => setCopiedRoom(false), 1500);
    } else {
      setCopiedPeer(true);
      setTimeout(() => setCopiedPeer(false), 1500);
    }
  };

  return (
    <header className="h-11 bg-[#111418] border-b border-[#272d34] px-3 flex items-center justify-between sticky top-0 z-30 select-none text-xs">
      {/* Left: SATorrent Application Logo */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          {/* Subtle Technical Software Icon */}
          <div className="flex items-center justify-center w-6 h-6 rounded bg-[#191e24] border border-[#272d34] text-blue-400 font-bold text-xs">
            <span className="tracking-tighter font-mono">SA</span>
          </div>

          <div className="flex items-baseline gap-1">
            <span className="font-semibold text-sm tracking-tight text-[#e7eaee]">
              <span className="font-extrabold text-blue-400">SA</span>Torrent
            </span>
          </div>
        </div>

        {/* Local Peer ID */}
        <div className="hidden lg:flex items-center gap-1.5 pl-3 border-l border-[#272d34] text-[11px] text-[#9299a3]">
          <span>Peer:</span>
          <button
            onClick={() => copyToClipboard(localPeerId, 'peer')}
            className="font-mono text-[#e7eaee] hover:text-blue-400 flex items-center gap-1 transition-colors cursor-pointer"
            title="Click to copy Peer ID"
          >
            <span>{localPeerId}</span>
            {copiedPeer ? (
              <Check className="w-3 h-3 text-emerald-400" />
            ) : (
              <Copy className="w-2.5 h-2.5 text-[#656d77]" />
            )}
          </button>
        </div>
      </div>

      {/* Center: Room & Connection Status */}
      <div className="flex items-center gap-2 sm:gap-3 text-[11px]">
        {roomState ? (
          <div className="flex items-center gap-2 bg-[#161a1f] border border-[#272d34] rounded px-2.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[#9299a3]">Room:</span>
            <span className="font-mono font-semibold text-[#e7eaee] tracking-wide">
              {roomState.roomCode}
            </span>

            <button
              onClick={() => copyToClipboard(roomState.roomCode, 'room')}
              className="text-[#9299a3] hover:text-[#e7eaee] transition-colors p-0.5 cursor-pointer"
              title="Copy Room Code"
            >
              {copiedRoom ? (
                <Check className="w-3 h-3 text-emerald-400" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>

            <span className="text-[#272d34]">|</span>

            <div className="flex items-center gap-1 text-[#9299a3]" title="Connected swarm peers">
              <Users className="w-3 h-3 text-[#656d77]" />
              <span className="text-[#e7eaee] font-medium">
                {connectedPeersCount + 1}/{roomState.maxPeers}
              </span>
            </div>

            {onLeaveRoom && (
              <button
                onClick={onLeaveRoom}
                className="ml-1 text-[#9299a3] hover:text-red-400 transition-colors cursor-pointer"
                title="Leave room"
              >
                <LogOut className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-[#161a1f] border border-[#272d34] rounded px-2 py-1 text-[#9299a3]">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span>Not Connected to Room</span>
          </div>
        )}

        {/* Signaling & Network Indicator */}
        <div className="hidden sm:flex items-center gap-3 text-[#9299a3]">
          <span className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-[#9299a3]">Signaling</span>
          </span>

          <span className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${connectedPeersCount > 0 ? 'bg-blue-400' : 'bg-[#656d77]'}`} />
            <span className="text-[#9299a3]">
              {connectedPeersCount} {connectedPeersCount === 1 ? 'peer' : 'peers'}
            </span>
          </span>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-1.5">
        <button
          onClick={onOpenSeedModal}
          className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Seed File</span>
        </button>

        {!roomState ? (
          <>
            <button
              onClick={onOpenCreateModal}
              className="px-2.5 py-1 bg-[#191e24] hover:bg-[#20262e] border border-[#272d34] text-[#e7eaee] rounded text-xs transition-colors cursor-pointer hidden sm:flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 text-[#9299a3]" />
              <span>Create</span>
            </button>
            <button
              onClick={onOpenJoinModal}
              className="px-2.5 py-1 bg-[#191e24] hover:bg-[#20262e] border border-[#272d34] text-[#e7eaee] rounded text-xs transition-colors cursor-pointer flex items-center gap-1"
            >
              <LogIn className="w-3.5 h-3.5 text-[#9299a3]" />
              <span>Join</span>
            </button>
          </>
        ) : null}

        {onToggleDebug && (
          <button
            onClick={onToggleDebug}
            className={`p-1 rounded border transition-colors cursor-pointer ${
              isDebugOpen
                ? 'bg-[#1f2937] text-blue-400 border-blue-500/50'
                : 'text-[#9299a3] hover:text-[#e7eaee] bg-[#161a1f] border-[#272d34] hover:bg-[#191e24]'
            }`}
            title="Toggle Developer Console"
          >
            <Terminal className="w-3.5 h-3.5" />
          </button>
        )}

        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="p-1 rounded border text-[#9299a3] hover:text-[#e7eaee] bg-[#161a1f] border-[#272d34] hover:bg-[#191e24] transition-colors cursor-pointer"
            title="Settings"
          >
            <Settings className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </header>
  );
};
