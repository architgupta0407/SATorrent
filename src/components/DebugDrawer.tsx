import React, { useState } from 'react';
import {
  Terminal,
  X,
  Trash2,
  Filter,
  CheckCircle2,
  AlertCircle,
  Radio,
  Network,
  Cpu,
  Search,
  Clock,
  Layers,
  ShieldCheck,
  ArrowDown,
  ArrowUp,
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

type DebugSection = 'all' | 'connections' | 'scheduler' | 'pieces' | 'transfers' | 'hashing' | 'signaling';

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

  // Filter logs by section/category
  const filteredLogs = logs.filter((log) => {
    if (activeSection === 'connections' && log.category !== 'webrtc') return false;
    if (activeSection === 'signaling' && log.category !== 'signaling') return false;
    if (activeSection === 'pieces' && log.category !== 'piece') return false;
    if (activeSection === 'hashing' && !log.message.includes('SHA') && !log.message.includes('Hash')) return false;
    if (activeSection === 'transfers' && !log.message.includes('PIECE') && !log.message.includes('transfer')) return false;
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
      className={`fixed inset-x-0 bottom-0 z-40 bg-[#060a12]/95 border-t border-purple-500/40 backdrop-blur-xl shadow-[0_-10px_35px_rgba(0,0,0,0.85)] flex flex-col font-mono text-xs select-text transition-all duration-200 ${
        isExpanded ? 'h-[75vh]' : 'h-80 sm:h-96'
      }`}
    >
      {/* Drawer Titlebar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#090d18] border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-purple-400 font-bold text-xs">
            <Terminal className="w-3.5 h-3.5" />
            <span>DEV CONSOLE • P2P TELEMETRY</span>
          </div>

          <div className="hidden sm:flex items-center gap-3 text-[10px] text-slate-400 pl-3 border-l border-slate-800">
            <span>Node: <strong className="text-cyan-300">{localPeerId}</strong></span>
            <span>Room: <strong className="text-cyan-300">{roomState?.roomCode || 'None'}</strong></span>
            <span>RTC Mesh: <strong className="text-emerald-400">{peers.size} Peers</strong></span>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="flex items-center gap-1">
          {/* Section Selector */}
          <div className="hidden md:flex items-center gap-1 bg-slate-950 p-0.5 rounded border border-slate-800 text-[10px]">
            {(
              [
                { id: 'all', label: 'ALL LOGS' },
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
                    ? 'bg-purple-950 text-purple-300 font-bold border border-purple-700/50'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {sec.label}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded border border-slate-800 text-[10px]">
            <Search className="w-3 h-3 text-slate-500" />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-slate-200 outline-none w-20 sm:w-28 placeholder:text-slate-600"
            />
          </div>

          <button
            onClick={onClearLogs}
            className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-900 rounded transition-colors cursor-pointer"
            title="Clear Event Log"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-900 rounded transition-colors cursor-pointer"
            title={isExpanded ? 'Restore size' : 'Expand full height'}
          >
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white hover:bg-slate-900 rounded transition-colors cursor-pointer"
            title="Close Dev Console"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Multi-Column Diagnostic Grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-800/80 overflow-hidden">
        {/* Column 1: CONNECTIONS (RTC Mesh & DataChannels) */}
        <div className="p-3 overflow-y-auto space-y-2 bg-[#070b14]/70">
          <div className="flex items-center justify-between text-slate-400 font-bold border-b border-slate-800 pb-1 text-[11px]">
            <span>CONNECTIONS ({peers.size})</span>
            <span className="text-[10px] text-cyan-400">WebRTC Mesh</span>
          </div>

          {peers.size === 0 ? (
            <p className="text-[11px] text-slate-500 italic py-3 text-center">
              No active RTCPeerConnections. Join a room with other devices.
            </p>
          ) : (
            Array.from(peers.values()).map((p) => (
              <div
                key={p.peerId}
                className="p-2 rounded bg-slate-900/70 border border-slate-800 space-y-1 text-[10px]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-cyan-300">{p.peerId}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded text-[9px] ${
                      p.dataChannelState === 'open'
                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                        : 'bg-amber-950 text-amber-400 border border-amber-800'
                    }`}
                  >
                    DC: {p.dataChannelState}
                  </span>
                </div>
                <div className="text-slate-400 flex items-center justify-between">
                  <span>ICE State:</span>
                  <span className="text-slate-200">{p.connectionState}</span>
                </div>
                <div className="text-slate-400 flex items-center justify-between">
                  <span>Pieces Owned:</span>
                  <span className="text-slate-200">{p.ownedPieces.size}</span>
                </div>
                <div className="text-slate-400 flex items-center justify-between">
                  <span>RTT Latency:</span>
                  <span className="text-slate-200">{p.latencyMs > 0 ? `${p.latencyMs} ms` : '—'}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Column 2: SCHEDULER & PIECES (Rarest-First Breakdown & In-Flight Queue) */}
        <div className="p-3 overflow-y-auto space-y-2 bg-[#070b14]/70">
          <div className="flex items-center justify-between text-slate-400 font-bold border-b border-slate-800 pb-1 text-[11px]">
            <span>SCHEDULER & PIECES</span>
            <span className="text-[10px] text-purple-400">Rarest-First</span>
          </div>

          {torrents.size === 0 ? (
            <p className="text-[11px] text-slate-500 italic py-3 text-center">
              No active torrents in engine.
            </p>
          ) : (
            Array.from(torrents.values()).map((t) => {
              const stats = engine?.getSchedulerStats(t.manifest.fileId);
              const missingCount = stats?.missingCount ?? (t.manifest.pieceCount - t.verifiedPieces.size);

              return (
                <div
                  key={t.manifest.fileId}
                  className="p-2 rounded bg-slate-900/70 border border-slate-800 space-y-2 text-[10px]"
                >
                  <div className="flex items-center justify-between font-bold">
                    <span className="text-white truncate max-w-[130px]">{t.manifest.fileName}</span>
                    <span className="text-emerald-400">{t.verifiedPieces.size} / {t.manifest.pieceCount} pcs</span>
                  </div>

                  {/* Scheduler availability info */}
                  <div className="grid grid-cols-2 gap-1 p-1 rounded bg-slate-950/80 border border-slate-800/80 text-[9px]">
                    <div>
                      <span className="text-slate-500">Missing:</span>{' '}
                      <strong className="text-amber-400">{missingCount}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500">Avail. Swarm:</span>{' '}
                      <strong className="text-cyan-400">{stats?.availableMissingCount ?? '—'}</strong>
                    </div>
                    {stats && stats.rarityBreakdown.length > 0 && (
                      <div className="col-span-2 pt-0.5 border-t border-slate-800/50 text-slate-400">
                        <span className="text-slate-500">Rarity: </span>
                        {stats.rarityBreakdown.map((rb) => (
                          <span key={rb.rarity} className="inline-block mr-1.5 text-purple-300">
                            {rb.pieceCount}p ({rb.rarity} peer{rb.rarity === 1 ? '' : 's'})
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* In-Flight Queue */}
                  <div>
                    <div className="text-[9px] font-bold text-purple-300 uppercase tracking-wider mb-1 flex items-center justify-between">
                      <span>In-Flight Requests ({t.inFlightPieces.size})</span>
                      <span className="text-slate-500 font-normal">Max 3/peer</span>
                    </div>

                    {t.inFlightPieces.size > 0 ? (
                      <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                        {Array.from(t.inFlightPieces.entries()).map(([piece, info]) => {
                          const elapsedSec = Math.max(0, Math.floor((Date.now() - info.requestedAt) / 1000));
                          return (
                            <div
                              key={piece}
                              className="p-1 rounded bg-purple-950/40 text-purple-200 border border-purple-800/40 text-[9px] space-y-0.5"
                            >
                              <div className="flex items-center justify-between font-bold">
                                <span className="text-cyan-300">Piece #{piece}</span>
                                <span className="text-slate-400">{elapsedSec}s elapsed</span>
                              </div>
                              <div className="text-slate-400 flex items-center justify-between">
                                <span>Source: <strong className="text-slate-200">{info.peerId}</strong></span>
                                {(info.retryCount ?? 0) > 0 && (
                                  <span className="text-amber-400 font-bold">Retries: {info.retryCount}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="text-slate-500 italic text-[9px]">No pending piece requests</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Column 3: LIVE EVENT LOG STREAM */}
        <div className="p-3 overflow-y-auto space-y-1 flex flex-col bg-[#050810]">
          <div className="flex items-center justify-between text-slate-400 font-bold border-b border-slate-800 pb-1 mb-1 text-[11px]">
            <span>LIVE SWARM STREAM</span>
            <span className="text-[10px] text-slate-500">{filteredLogs.length} events</span>
          </div>

          <div className="flex-1 space-y-1 overflow-y-auto pr-1 text-[10px]">
            {filteredLogs.length === 0 ? (
              <p className="text-slate-600 italic py-4 text-center">No matching events logged.</p>
            ) : (
              filteredLogs.map((log) => {
                const badgeColor =
                  log.category === 'error'
                    ? 'text-red-400 bg-red-950/60 border-red-800'
                    : log.category === 'piece'
                    ? 'text-purple-400 bg-purple-950/60 border-purple-800'
                    : log.category === 'signaling'
                    ? 'text-amber-400 bg-amber-950/60 border-amber-800'
                    : log.category === 'webrtc'
                    ? 'text-cyan-400 bg-cyan-950/60 border-cyan-800'
                    : 'text-slate-400 bg-slate-900 border-slate-700';

                return (
                  <div key={log.id} className="leading-tight flex items-start gap-1.5 font-mono py-0.5">
                    <span className="text-slate-600 flex-shrink-0 text-[9px]">{log.time}</span>
                    <span
                      className={`px-1 py-0.2 rounded text-[8px] font-bold uppercase tracking-wider border flex-shrink-0 ${badgeColor}`}
                    >
                      {log.category}
                    </span>
                    <span className="text-slate-300 break-all">{log.message}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
