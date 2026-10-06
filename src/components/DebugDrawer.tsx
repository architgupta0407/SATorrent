import React, { useState } from 'react';
import {
  Terminal,
  X,
  Trash2,
  Search,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { DiagnosticLog, TorrentEngine } from '../swarm/TorrentEngine';
import { SwarmPeer, LocalTorrent, RoomState } from '../types';

interface DebugDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  localPeerId: string;
  roomState: RoomState | null;
  peers: Map<string, SwarmPeer>;
  torrents: Map<string, LocalTorrent>;
  logs: DiagnosticLog[];
  onClearLogs: () => void;
  engine?: TorrentEngine | null;
}

type DebugSection = 'all' | 'connections' | 'scheduler' | 'pieces' | 'hashing' | 'signaling';

export const DebugDrawer: React.FC<DebugDrawerProps> = ({
  isOpen,
  onClose,
  localPeerId,
  roomState,
  peers,
  torrents,
  logs,
  onClearLogs,
  engine,
}) => {
  const [activeSection, setActiveSection] = useState<DebugSection>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  if (!isOpen) return null;

  const filteredLogs = logs.filter((log) => {
    if (activeSection === 'connections' && log.category !== 'webrtc') return false;
    if (activeSection === 'signaling' && log.category !== 'signaling') return false;
    if (activeSection === 'pieces' && log.category !== 'piece') return false;
    if (activeSection === 'hashing' && !log.message.includes('SHA') && !log.message.includes('Hash')) return false;
    if (activeSection === 'scheduler' && log.category !== 'swarm' && log.category !== 'piece') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(q) ||
        log.category.toLowerCase().includes(q) ||
        log.time.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div
      className={`fixed inset-x-0 bottom-0 z-40 bg-[#111418] border-t border-[#272d34] flex flex-col font-mono text-xs select-text shadow-lg transition-all duration-150 ${
        isExpanded ? 'h-[75vh]' : 'h-72 sm:h-80'
      }`}
    >
      {/* Titlebar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#161a1f] border-b border-[#272d34] text-[11px]">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#9299a3]" />
          <span className="font-semibold text-[#e7eaee]">Console Inspector</span>
          <span className="text-[#656d77] pl-2 border-l border-[#272d34]">
            Node: {localPeerId}
          </span>
          <span className="text-[#656d77]">
            Peers: {peers.size}
          </span>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 bg-[#111418] p-0.5 rounded border border-[#272d34] text-[10px]">
            {(
              [
                { id: 'all', label: 'ALL' },
                { id: 'connections', label: 'CONNECTIONS' },
                { id: 'scheduler', label: 'SCHEDULER' },
                { id: 'pieces', label: 'PIECES' },
                { id: 'hashing', label: 'HASHING' },
                { id: 'signaling', label: 'SIGNALING' },
              ] as const
            ).map((sec) => (
              <button
                key={sec.id}
                onClick={() => setActiveSection(sec.id)}
                className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                  activeSection === sec.id
                    ? 'bg-[#1f242b] text-[#e7eaee] font-semibold'
                    : 'text-[#656d77] hover:text-[#9299a3]'
                }`}
              >
                {sec.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-[#111418] px-1.5 py-0.5 rounded border border-[#272d34] text-[10px]">
            <Search className="w-3 h-3 text-[#656d77]" />
            <input
              type="text"
              placeholder="Filter..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-[#e7eaee] outline-none w-20 placeholder:text-[#656d77]"
            />
          </div>

          <button
            onClick={onClearLogs}
            className="p-1 text-[#656d77] hover:text-[#e7eaee] rounded transition-colors cursor-pointer"
            title="Clear Log"
          >
            <Trash2 className="w-3 h-3" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-[#656d77] hover:text-[#e7eaee] rounded transition-colors cursor-pointer"
            title={isExpanded ? 'Restore' : 'Expand'}
          >
            {isExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>

          <button
            onClick={onClose}
            className="p-1 text-[#656d77] hover:text-[#e7eaee] rounded transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[#272d34] overflow-hidden">
        {/* Left: CONNECTIONS */}
        <div className="p-2.5 overflow-y-auto space-y-1.5 bg-[#111418] text-[11px]">
          <div className="text-[#656d77] font-semibold uppercase text-[10px] pb-1 border-b border-[#272d34]">
            Connections ({peers.size})
          </div>
          {peers.size === 0 ? (
            <p className="text-[#656d77] italic py-2">No peers connected.</p>
          ) : (
            Array.from(peers.values()).map((p) => (
              <div key={p.peerId} className="p-1.5 rounded bg-[#161a1f] border border-[#272d34] space-y-0.5">
                <div className="flex justify-between font-medium">
                  <span className="text-[#e7eaee]">{p.peerId}</span>
                  <span className={p.dataChannelState === 'open' ? 'text-emerald-400' : 'text-amber-400'}>
                    {p.dataChannelState}
                  </span>
                </div>
                <div className="text-[10px] text-[#9299a3] flex justify-between">
                  <span>Latency: {p.latencyMs > 0 ? `${p.latencyMs}ms` : '—'}</span>
                  <span>Pieces: {p.ownedPieces.size}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Center: SCHEDULER & PIECES */}
        <div className="p-2.5 overflow-y-auto space-y-1.5 bg-[#111418] text-[11px]">
          <div className="text-[#656d77] font-semibold uppercase text-[10px] pb-1 border-b border-[#272d34]">
            Scheduler Telemetry
          </div>
          {torrents.size === 0 ? (
            <p className="text-[#656d77] italic py-2">No active torrents.</p>
          ) : (
            Array.from(torrents.values()).map((t) => {
              const stats = engine?.getSchedulerStats(t.manifest.fileId);
              return (
                <div key={t.manifest.fileId} className="p-1.5 rounded bg-[#161a1f] border border-[#272d34] space-y-1 text-[10px]">
                  <div className="flex justify-between font-medium text-[#e7eaee]">
                    <span className="truncate max-w-[130px]">{t.manifest.fileName}</span>
                    <span className="text-emerald-400">{t.verifiedPieces.size}/{t.manifest.pieceCount} pcs</span>
                  </div>
                  <div className="text-[#9299a3] flex justify-between">
                    <span>In-flight: {t.inFlightPieces.size}</span>
                    <span>Avail: {stats?.availableMissingCount ?? '—'}</span>
                  </div>
                  {t.inFlightPieces.size > 0 && (
                    <div className="pt-1 border-t border-[#272d34] space-y-0.5">
                      {Array.from(t.inFlightPieces.entries()).map(([piece, info]) => (
                        <div key={piece} className="flex justify-between text-[#9299a3] text-[9px]">
                          <span className="text-blue-400">Piece #{piece}</span>
                          <span>Peer: {info.peerId.slice(-4)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Right: LOG STREAM */}
        <div className="p-2.5 overflow-y-auto space-y-1 bg-[#0d0f12] text-[10px]">
          <div className="text-[#656d77] font-semibold uppercase text-[10px] pb-1 border-b border-[#272d34] flex justify-between">
            <span>Log Stream</span>
            <span>{filteredLogs.length} events</span>
          </div>
          <div className="space-y-0.5 font-mono">
            {filteredLogs.length === 0 ? (
              <p className="text-[#656d77] italic py-2">No logs matching filter.</p>
            ) : (
              filteredLogs.map((log) => (
                <div key={log.id} className="flex gap-2 py-0.5 px-1 hover:bg-[#161a1f]">
                  <span className="text-[#656d77] flex-shrink-0">{log.time}</span>
                  <span className="text-[#9299a3] flex-shrink-0">[{log.category.toUpperCase()}]</span>
                  <span className="text-[#e7eaee] truncate">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
