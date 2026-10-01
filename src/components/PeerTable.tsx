import React, { useState } from 'react';
import {
  Users,
  Copy,
  Check,
  Radio,
  Wifi,
  Signal,
  Clock,
  Layers,
  Info,
  X,
  ShieldCheck,
  ArrowDown,
  ArrowUp,
} from 'lucide-react';
import { SwarmPeer, LocalTorrent } from '../types';
import { formatSpeed, formatBytes } from '../lib/crypto';

interface PeerTableProps {
  peers: Map<string, SwarmPeer>;
  activeTorrent?: LocalTorrent;
}

export const PeerTable: React.FC<PeerTableProps> = ({ peers, activeTorrent }) => {
  const [copiedPeerId, setCopiedPeerId] = useState<string | null>(null);
  const [inspectedPeer, setInspectedPeer] = useState<SwarmPeer | null>(null);

  const copyId = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedPeerId(id);
    setTimeout(() => setCopiedPeerId(null), 1800);
  };

  const peerList = Array.from(peers.values());
  const pieceCount = activeTorrent?.manifest.pieceCount || 1;

  const getPeerOwnedPieces = (peer: SwarmPeer): Set<number> => {
    if (activeTorrent && peer.ownedPiecesByFile?.has(activeTorrent.manifest.fileId)) {
      return peer.ownedPiecesByFile.get(activeTorrent.manifest.fileId)!;
    }
    return peer.ownedPieces;
  };

  const formatLastActivity = (ts: number): string => {
    if (!ts) return 'Active';
    const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diff < 5) return 'Just now';
    if (diff < 60) return `${diff}s ago`;
    return `${Math.floor(diff / 60)}m ago`;
  };

  const getRoleBadge = (peer: SwarmPeer) => {
    const owned = getPeerOwnedPieces(peer).size;
    if (peer.role === 'seeder' || (activeTorrent && owned >= pieceCount && pieceCount > 0)) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 uppercase">
          SEEDER
        </span>
      );
    }
    if (owned > 0 && activeTorrent && owned < pieceCount) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 uppercase">
          RE-SEEDER
        </span>
      );
    }
    if (peer.role === 'leecher' || (activeTorrent && owned === 0)) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-950/80 text-purple-300 border border-purple-800/60 uppercase">
          LEECHER
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 uppercase">
        PEER
      </span>
    );
  };

  return (
    <div className="space-y-3 font-mono select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Connected Mesh Peers ({peers.size})
          </h3>
        </div>
        <div className="text-[11px] text-slate-400">
          Direct WebRTC DataChannels • Click row to inspect
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-800/90 bg-[#070b14] shadow-md">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#090e1b] text-slate-400 border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider">
            <tr>
              <th className="py-2.5 px-3">PEER ID</th>
              <th className="py-2.5 px-3">ROLE</th>
              <th className="py-2.5 px-3">CONNECTION</th>
              <th className="py-2.5 px-3">PIECES</th>
              <th className="py-2.5 px-3">COMPLETION</th>
              <th className="py-2.5 px-3">DOWNLOAD</th>
              <th className="py-2.5 px-3">UPLOAD</th>
              <th className="py-2.5 px-3">LATENCY</th>
              <th className="py-2.5 px-3 text-right">LAST ACTIVITY</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {peerList.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-500 text-xs">
                  No peers connected in this room yet. Connect from another browser window or device to join the mesh.
                </td>
              </tr>
            ) : (
              peerList.map((peer) => {
                const peerPieces = getPeerOwnedPieces(peer);
                const ownedCount = peerPieces.size;
                const percentage = activeTorrent
                  ? Math.round((ownedCount / pieceCount) * 100)
                  : 0;

                const isDcOpen = peer.dataChannelState === 'open';

                return (
                  <tr
                    key={peer.peerId}
                    onClick={() => setInspectedPeer(peer)}
                    className="hover:bg-slate-900/60 transition-colors cursor-pointer group"
                  >
                    {/* Peer ID */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-cyan-300 group-hover:text-cyan-200">
                          {peer.peerId}
                        </span>
                        <button
                          onClick={(e) => copyId(peer.peerId, e)}
                          className="p-1 text-slate-500 hover:text-cyan-300 transition-colors"
                          title="Copy Peer ID"
                        >
                          {copiedPeerId === peer.peerId ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3 opacity-40 group-hover:opacity-100" />
                          )}
                        </button>
                      </div>
                    </td>

                    {/* Role */}
                    <td className="py-2.5 px-3">{getRoleBadge(peer)}</td>

                    {/* Connection */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isDcOpen ? 'bg-emerald-400 shadow-[0_0_6px_rgba(16,185,129,0.5)]' : 'bg-amber-400 animate-pulse'
                          }`}
                        />
                        <span className="text-[11px] text-slate-300">
                          {isDcOpen ? 'DataChannel Open' : peer.connectionState}
                        </span>
                      </div>
                    </td>

                    {/* Pieces Owned */}
                    <td className="py-2.5 px-3 text-slate-200 font-medium">
                      {ownedCount} / {activeTorrent ? activeTorrent.manifest.pieceCount : '—'}
                    </td>

                    {/* Completion */}
                    <td className="py-2.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              percentage === 100 ? 'bg-emerald-400' : percentage > 0 ? 'bg-cyan-400' : 'bg-slate-700'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-slate-300 font-bold">{percentage}%</span>
                      </div>
                    </td>

                    {/* Download Speed */}
                    <td className="py-2.5 px-3 text-sky-400 font-medium">
                      {peer.downloadSpeedBps > 0 ? formatSpeed(peer.downloadSpeedBps) : '—'}
                    </td>

                    {/* Upload Speed */}
                    <td className="py-2.5 px-3 text-emerald-400 font-medium">
                      {peer.uploadSpeedBps > 0 ? formatSpeed(peer.uploadSpeedBps) : '—'}
                    </td>

                    {/* Latency */}
                    <td className="py-2.5 px-3 text-slate-300">
                      {peer.latencyMs > 0 ? (
                        <span className="flex items-center gap-1">
                          <Signal className="w-3 h-3 text-cyan-400" />
                          {peer.latencyMs} ms
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>

                    {/* Last Activity */}
                    <td className="py-2.5 px-3 text-right text-slate-400 text-[11px]">
                      {formatLastActivity(peer.lastActivityTimestamp)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Peer Deep Inspection Dialog */}
      {inspectedPeer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#080d19] border border-cyan-500/50 rounded-xl p-5 shadow-2xl space-y-4 text-xs font-mono">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-cyan-400" />
                <h3 className="font-bold text-white text-sm">Peer Telemetry Inspector</h3>
              </div>
              <button
                onClick={() => setInspectedPeer(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-[11px]">
              <div>
                <span className="text-slate-500">Peer ID:</span>
                <div className="font-bold text-cyan-300 mt-0.5">{inspectedPeer.peerId}</div>
              </div>

              <div>
                <span className="text-slate-500">Role:</span>
                <div className="mt-0.5">{getRoleBadge(inspectedPeer)}</div>
              </div>

              <div>
                <span className="text-slate-500">WebRTC State:</span>
                <div className="font-bold text-white mt-0.5">{inspectedPeer.connectionState}</div>
              </div>

              <div>
                <span className="text-slate-500">DataChannel:</span>
                <div className="font-bold text-emerald-400 mt-0.5">{inspectedPeer.dataChannelState}</div>
              </div>

              <div>
                <span className="text-slate-500">RTT Latency:</span>
                <div className="font-bold text-cyan-300 mt-0.5">{inspectedPeer.latencyMs > 0 ? `${inspectedPeer.latencyMs} ms` : '—'}</div>
              </div>

              <div>
                <span className="text-slate-500">Pieces Owned:</span>
                <div className="font-bold text-white mt-0.5">
                  {getPeerOwnedPieces(inspectedPeer).size} / {activeTorrent?.manifest.pieceCount || '—'}
                </div>
              </div>

              <div className="col-span-2 border-t border-slate-800 pt-2 grid grid-cols-2 gap-2">
                <div>
                  <span className="text-slate-500">Total Downloaded:</span>
                  <div className="font-bold text-sky-400">{formatBytes(inspectedPeer.totalDownloadedBytes)}</div>
                </div>
                <div>
                  <span className="text-slate-500">Total Uploaded:</span>
                  <div className="font-bold text-emerald-400">{formatBytes(inspectedPeer.totalUploadedBytes)}</div>
                </div>
              </div>
            </div>

            <div>
              <span className="text-slate-400 text-[11px] font-semibold">Owned Piece Indices:</span>
              <div className="mt-1 p-2 bg-slate-950 rounded-lg border border-slate-800 max-h-28 overflow-y-auto text-[10px] text-slate-300 flex flex-wrap gap-1">
                {getPeerOwnedPieces(inspectedPeer).size === 0 ? (
                  <span className="text-slate-500 italic">None reported yet</span>
                ) : (
                  Array.from(getPeerOwnedPieces(inspectedPeer))
                    .sort((a, b) => a - b)
                    .map((p) => (
                      <span key={p} className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                        #{p}
                      </span>
                    ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
