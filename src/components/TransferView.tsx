import React, { useState } from 'react';
import {
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ShieldCheck,
  HardDrive,
  Users,
  Play,
  Pause,
  Trash2,
  Copy,
  Check,
  Clock,
  Layers,
} from 'lucide-react';
import { LocalTorrent, SwarmPeer } from '../types';
import { formatBytes, formatSpeed } from '../lib/crypto';
import { PieceBitmap } from './PieceBitmap';

interface TransferViewProps {
  torrents: LocalTorrent[];
  peers: Map<string, SwarmPeer>;
  onTogglePause?: (fileId: string) => void;
  onRemoveTorrent?: (fileId: string) => void;
  filterMode?: 'all' | 'downloading' | 'seeding' | 'completed' | 'paused';
}

export const TransferView: React.FC<TransferViewProps> = ({
  torrents,
  peers,
  onTogglePause,
  onRemoveTorrent,
  filterMode = 'all',
}) => {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(
    torrents.length > 0 ? torrents[0].manifest.fileId : null
  );
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1800);
  };

  const filteredTorrents = torrents.filter((t) => {
    if (filterMode === 'all') return true;
    if (filterMode === 'downloading') return t.status === 'downloading' && !t.isPaused;
    if (filterMode === 'seeding') return t.status === 'seeding' || (t.isSeeder && !t.isPaused);
    if (filterMode === 'completed') return t.status === 'completed';
    if (filterMode === 'paused') return t.isPaused;
    return true;
  });

  if (torrents.length === 0) {
    return (
      <div className="p-8 text-center bg-[#070b14] rounded-xl border border-slate-800/80 text-slate-400 font-mono space-y-2 select-none">
        <FileText className="w-9 h-9 text-slate-600 mx-auto mb-1 opacity-60" />
        <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">No Active Torrents in Swarm</p>
        <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
          Click <strong className="text-cyan-400">Seed File</strong> to share a file, or join a room where a peer is broadcasting a torrent.
        </p>
      </div>
    );
  }

  // Selected torrent or default to first
  const activeTorrent =
    torrents.find((t) => t.manifest.fileId === selectedFileId) || torrents[0];

  const manifest = activeTorrent.manifest;
  const verifiedCount = activeTorrent.verifiedPieces.size;
  const totalPieces = manifest.pieceCount;
  const percentage = Math.round((verifiedCount / totalPieces) * 100);

  // Real ETA calculation based on real download speed
  const remainingBytes = Math.max(0, manifest.fileSize - (verifiedCount * manifest.pieceSize));
  let etaText = '—';
  if (activeTorrent.downloadSpeedBps > 0 && remainingBytes > 0) {
    const seconds = Math.ceil(remainingBytes / activeTorrent.downloadSpeedBps);
    if (seconds < 60) etaText = `${seconds}s`;
    else if (seconds < 3600) etaText = `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    else etaText = `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  } else if (percentage === 100) {
    etaText = 'Complete';
  }

  // Count connected peers that have pieces of this torrent
  let activePeersForFile = 0;
  for (const [, p] of peers) {
    if (p.dataChannelState === 'open') {
      activePeersForFile++;
    }
  }

  const getStatusBadge = (t: LocalTorrent) => {
    if (t.overallSha256Status === 'mismatch') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950/80 text-red-400 border border-red-800/60">
          Hash Error
        </span>
      );
    }
    if (t.overallSha256Status === 'verified' || t.verifiedPieces.size >= t.manifest.pieceCount) {
      return t.isSeeder ? (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
          Seeding
        </span>
      ) : (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-950/80 text-teal-400 border border-teal-800/60">
          Completed
        </span>
      );
    }
    if (t.isPaused) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
          Paused
        </span>
      );
    }
    if (t.inFlightPieces.size > 0 || t.downloadSpeedBps > 0) {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-sky-950/80 text-sky-400 border border-sky-800/60 animate-pulse">
          Downloading
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
        Verifying
      </span>
    );
  };

  const handleSaveFile = (t: LocalTorrent) => {
    if (!t.blobUrl) return;
    const a = document.createElement('a');
    a.href = t.blobUrl;
    a.download = t.manifest.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-4 font-mono select-none">
      {/* 1. Torrent-Client Style Transfer Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-800/90 bg-[#070b14] shadow-md">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#090e1b] text-slate-400 border-b border-slate-800 text-[10px] uppercase font-bold tracking-wider">
            <tr>
              <th className="py-2.5 px-3">NAME</th>
              <th className="py-2.5 px-3">SIZE</th>
              <th className="py-2.5 px-3 min-w-[120px]">PROGRESS</th>
              <th className="py-2.5 px-3">PIECES</th>
              <th className="py-2.5 px-3">DOWNLOAD</th>
              <th className="py-2.5 px-3">UPLOAD</th>
              <th className="py-2.5 px-3">PEERS</th>
              <th className="py-2.5 px-3">STATUS</th>
              <th className="py-2.5 px-3 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {filteredTorrents.map((t) => {
              const percent = Math.round((t.verifiedPieces.size / t.manifest.pieceCount) * 100);
              const isSelected = t.manifest.fileId === activeTorrent.manifest.fileId;

              return (
                <tr
                  key={t.manifest.fileId}
                  onClick={() => setSelectedFileId(t.manifest.fileId)}
                  className={`cursor-pointer transition-colors text-xs ${
                    isSelected
                      ? 'bg-cyan-950/40 border-l-2 border-cyan-400'
                      : 'hover:bg-slate-900/50'
                  }`}
                >
                  {/* Name with file icon */}
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-cyan-400' : 'text-slate-400'}`} />
                      <span className="font-semibold text-white max-w-[180px] sm:max-w-xs truncate" title={t.manifest.fileName}>
                        {t.manifest.fileName}
                      </span>
                    </div>
                  </td>

                  {/* Size */}
                  <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                    {formatBytes(t.manifest.fileSize)}
                  </td>

                  {/* Progress bar + percentage */}
                  <td className="py-2.5 px-3">
                    <div className="w-28 space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-300 font-bold">{percent}%</span>
                        <span className="text-slate-500">{t.verifiedPieces.size}/{t.manifest.pieceCount}</span>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            percent === 100 ? 'bg-emerald-400' : 'bg-cyan-400'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* Pieces */}
                  <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                    {t.verifiedPieces.size} / {t.manifest.pieceCount}
                  </td>

                  {/* Download speed */}
                  <td className="py-2.5 px-3 text-sky-400 whitespace-nowrap font-medium">
                    {t.downloadSpeedBps > 0 ? `↓ ${formatSpeed(t.downloadSpeedBps)}` : '—'}
                  </td>

                  {/* Upload speed */}
                  <td className="py-2.5 px-3 text-emerald-400 whitespace-nowrap font-medium">
                    {t.uploadSpeedBps > 0 ? `↑ ${formatSpeed(t.uploadSpeedBps)}` : '—'}
                  </td>

                  {/* Peers */}
                  <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-slate-500" />
                      {peers.size}
                    </span>
                  </td>

                  {/* Status badge */}
                  <td className="py-2.5 px-3 whitespace-nowrap">
                    {getStatusBadge(t)}
                  </td>

                  {/* Actions */}
                  <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-1.5">
                      {onTogglePause && !t.isSeeder && percent < 100 && (
                        <button
                          onClick={() => onTogglePause(t.manifest.fileId)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                          title={t.isPaused ? 'Resume' : 'Pause'}
                        >
                          {t.isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                        </button>
                      )}

                      {t.overallSha256Status === 'verified' && t.blobUrl && (
                        <button
                          onClick={() => handleSaveFile(t)}
                          className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-sm"
                          title="Save file to local disk"
                        >
                          <Download className="w-3 h-3" />
                          <span>Save</span>
                        </button>
                      )}

                      {onRemoveTorrent && (
                        <button
                          onClick={() => onRemoveTorrent(t.manifest.fileId)}
                          className="p-1 text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                          title="Remove torrent"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 2. Selected Torrent Detail Panel */}
      <div className="p-3.5 bg-[#070b14] rounded-xl border border-slate-800/90 space-y-3.5 shadow-md">
        {/* Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-lg bg-cyan-950/50 border border-cyan-800/40 text-cyan-400 flex-shrink-0">
              <FileText className="w-5 h-5" />
            </div>

            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white truncate max-w-sm sm:max-w-md">
                  {manifest.fileName}
                </h3>
                <span className="px-1.5 py-0.2 text-[10px] rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {formatBytes(manifest.fileSize)}
                </span>
                {getStatusBadge(activeTorrent)}
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-2 truncate">
                <span>File ID: <strong className="text-slate-300">{manifest.fileId}</strong></span>
                <span>•</span>
                <span>Type: <strong className="text-slate-300">{manifest.mimeType}</strong></span>
              </div>
            </div>
          </div>

          {/* Action / Integrity Badge */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {activeTorrent.overallSha256Status === 'verified' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-950/60 border border-emerald-500/40 text-emerald-400 text-xs font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>SHA-256 VERIFIED</span>
              </div>
            ) : activeTorrent.overallSha256Status === 'mismatch' ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-950/60 border border-red-500/40 text-red-400 text-xs font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>HASH MISMATCH</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950/60 border border-cyan-500/40 text-cyan-400 text-xs font-semibold">
                <ShieldCheck className="w-3.5 h-3.5 animate-pulse" />
                <span>VERIFYING PIECES</span>
              </div>
            )}

            {activeTorrent.overallSha256Status === 'verified' && activeTorrent.blobUrl && (
              <button
                onClick={() => handleSaveFile(activeTorrent)}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)] cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Save File</span>
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar Strip */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Transfer Progress</span>
            <span className="text-cyan-300 font-bold">{percentage}%</span>
          </div>
          <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-slate-800">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                percentage === 100 ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.5)]'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
          <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
            <div className="text-[10px] text-slate-500">Downloaded</div>
            <div className="font-bold text-white mt-0.5">
              {formatBytes(verifiedCount * manifest.pieceSize > manifest.fileSize ? manifest.fileSize : verifiedCount * manifest.pieceSize)}
            </div>
          </div>

          <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
            <div className="text-[10px] text-slate-500">Upload Rate</div>
            <div className="font-bold text-emerald-400 mt-0.5">
              {activeTorrent.uploadSpeedBps > 0 ? formatSpeed(activeTorrent.uploadSpeedBps) : '0.0 B/s'}
            </div>
          </div>

          <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
            <div className="text-[10px] text-slate-500">Pieces</div>
            <div className="font-bold text-slate-200 mt-0.5">
              {verifiedCount} / {totalPieces}
            </div>
          </div>

          <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
            <div className="text-[10px] text-slate-500">Peers in Swarm</div>
            <div className="font-bold text-cyan-300 mt-0.5">
              {peers.size}
            </div>
          </div>

          <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
            <div className="text-[10px] text-slate-500">ETA</div>
            <div className="font-bold text-slate-200 mt-0.5">
              {etaText}
            </div>
          </div>

          <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
            <div className="text-[10px] text-slate-500">Piece Size</div>
            <div className="font-bold text-slate-200 mt-0.5">
              {formatBytes(manifest.pieceSize)}
            </div>
          </div>
        </div>

        {/* SHA-256 Hash Card */}
        <div className="p-2 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-between gap-2 text-[11px]">
          <div className="flex items-center gap-2 truncate">
            <span className="text-slate-500 uppercase text-[10px] font-semibold flex-shrink-0">Overall SHA-256:</span>
            <code className="text-cyan-300 font-mono truncate">{manifest.overallSha256}</code>
          </div>
          <button
            onClick={() => copyHash(manifest.overallSha256)}
            className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer flex-shrink-0"
            title="Copy SHA-256 Hash"
          >
            {copiedHash === manifest.overallSha256 ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* 3. Dense Piece Bitmap Map */}
        <div className="pt-2">
          <PieceBitmap torrent={activeTorrent} peers={peers} />
        </div>
      </div>
    </div>
  );
};
