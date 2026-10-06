import React, { useState } from 'react';
import {
  Users,
  Copy,
  Check,
  Signal,
  X,
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
    setTimeout(() => setCopiedPeerId(null), 1500);
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

  const getRoleDotAndText = (peer: SwarmPeer) => {
    const owned = getPeerOwnedPieces(peer).size;
    if (peer.role === 'seeder' || (activeTorrent && owned >= pieceCount && pieceCount > 0)) {
      return (
        <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Seeder</span>
        </span>
      );
    }
    if (owned > 0 && activeTorrent && owned < pieceCount) {
      return (
        <span className="inline-flex items-center gap-1.5 text-blue-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          <span>Re-seeder</span>
        </span>
      );
    }
    if (peer.role === 'leecher' || (activeTorrent && owned === 0)) {
      return (
        <span className="inline-flex items-center gap-1.5 text-purple-400 font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
          <span>Leecher</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-[#9299a3]">
        <span className="w-1.5 h-1.5 rounded-full bg-[#656d77]" />
        <span>Peer</span>
      </span>
    );
  };

  return (
    <div className="space-y-2 select-none text-xs">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#656d77]" />
          <h3 className="font-semibold text-[#e7eaee]">
            Peers ({peers.size})
          </h3>
        </div>
        <div className="text-[11px] text-[#656d77]">
          Direct WebRTC DataChannels
        </div>
      </div>

      <div className="rounded border border-[#272d34] bg-[#15191e] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead className="bg-[#111418] text-[#9299a3] border-b border-[#272d34] font-semibold">
              <tr>
                <th className="py-2 px-3">PEER ID</th>
                <th className="py-2 px-2.5">ROLE</th>
                <th className="py-2 px-2.5">CONNECTION</th>
                <th className="py-2 px-2.5 font-mono">PIECES</th>
                <th className="py-2 px-2.5 min-w-[110px]">COMPLETION</th>
                <th className="py-2 px-2.5 font-mono">DOWN</th>
                <th className="py-2 px-2.5 font-mono">UP</th>
                <th className="py-2 px-2.5 font-mono">LATENCY</th>
                <th className="py-2 px-3 text-right">LAST ACTIVITY</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f242b]">
              {peerList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-[#656d77]">
                    No peers connected. Share your room code with other devices to establish direct connections.
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
                      className="hover:bg-[#191e24] transition-colors cursor-pointer"
                    >
                      {/* Peer ID */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="text-[#e7eaee] font-medium">
                            {peer.peerId}
                          </span>
                          <button
                            onClick={(e) => copyId(peer.peerId, e)}
                            className="p-0.5 text-[#656d77] hover:text-[#e7eaee] transition-colors"
                            title="Copy Peer ID"
                          >
                            {copiedPeerId === peer.peerId ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Role */}
                      <td className="py-2 px-2.5">
                        {getRoleDotAndText(peer)}
                      </td>

                      {/* Connection */}
                      <td className="py-2 px-2.5">
                        <span className="inline-flex items-center gap-1.5 text-[#9299a3]">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isDcOpen ? 'bg-emerald-400' : 'bg-amber-400'
                            }`}
                          />
                          <span>{isDcOpen ? 'Connected' : peer.connectionState}</span>
                        </span>
                      </td>

                      {/* Pieces */}
                      <td className="py-2 px-2.5 font-mono text-[#e7eaee]">
                        {ownedCount} / {activeTorrent ? activeTorrent.manifest.pieceCount : '—'}
                      </td>

                      {/* Completion */}
                      <td className="py-2 px-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 bg-[#111418] rounded-xs h-1.5 overflow-hidden border border-[#272d34]">
                            <div
                              className={`h-full ${
                                percentage === 100 ? 'bg-emerald-500' : percentage > 0 ? 'bg-blue-500' : 'bg-[#272d34]'
                              }`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="font-mono text-[#e7eaee] text-[10px]">{percentage}%</span>
                        </div>
                      </td>

                      {/* Download */}
                      <td className="py-2 px-2.5 font-mono text-blue-400">
                        {peer.downloadSpeedBps > 0 ? formatSpeed(peer.downloadSpeedBps) : '—'}
                      </td>

                      {/* Upload */}
                      <td className="py-2 px-2.5 font-mono text-emerald-400">
                        {peer.uploadSpeedBps > 0 ? formatSpeed(peer.uploadSpeedBps) : '—'}
                      </td>

                      {/* Latency */}
                      <td className="py-2 px-2.5 font-mono text-[#9299a3]">
                        {peer.latencyMs > 0 ? `${peer.latencyMs} ms` : '—'}
                      </td>

                      {/* Last Activity */}
                      <td className="py-2 px-3 text-right text-[#656d77]">
                        {formatLastActivity(peer.lastActivityTimestamp)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Peer Info Dialog (Simple Technical Modal) */}
      {inspectedPeer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-sm bg-[#15191e] border border-[#272d34] rounded p-4 space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-[#272d34] pb-2">
              <span className="font-semibold text-[#e7eaee]">Peer Details</span>
              <button
                onClick={() => setInspectedPeer(null)}
                className="text-[#656d77] hover:text-[#e7eaee] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#656d77]">Peer ID:</span>
                <span className="font-mono text-[#e7eaee]">{inspectedPeer.peerId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#656d77]">Role:</span>
                <span>{getRoleDotAndText(inspectedPeer)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#656d77]">Connection:</span>
                <span className="text-[#e7eaee]">{inspectedPeer.dataChannelState} ({inspectedPeer.connectionState})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#656d77]">Pieces:</span>
                <span className="font-mono text-[#e7eaee]">
                  {getPeerOwnedPieces(inspectedPeer).size} / {activeTorrent?.manifest.pieceCount || '—'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#656d77]">Latency:</span>
                <span className="font-mono text-[#e7eaee]">{inspectedPeer.latencyMs > 0 ? `${inspectedPeer.latencyMs} ms` : '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#656d77]">Downloaded:</span>
                <span className="font-mono text-[#e7eaee]">{formatBytes(inspectedPeer.totalDownloadedBytes)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#656d77]">Uploaded:</span>
                <span className="font-mono text-[#e7eaee]">{formatBytes(inspectedPeer.totalUploadedBytes)}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-[#272d34]">
              <div className="text-[10px] text-[#656d77] mb-1 font-semibold">Owned Piece Indices:</div>
              <div className="p-2 bg-[#111418] rounded border border-[#272d34] max-h-24 overflow-y-auto text-[10px] font-mono text-[#9299a3] flex flex-wrap gap-1">
                {getPeerOwnedPieces(inspectedPeer).size === 0 ? (
                  <span className="italic">None reported</span>
                ) : (
                  Array.from(getPeerOwnedPieces(inspectedPeer))
                    .sort((a, b) => a - b)
                    .map((p) => (
                      <span key={p} className="px-1 py-0.2 rounded bg-[#1c2128] text-[#e7eaee]">
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
