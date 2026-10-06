import React, { useState, useEffect } from 'react';
import {
  FileText,
  Download,
  Play,
  Pause,
  Trash2,
  Copy,
  Check,
  HardDrive,
  Users,
  Activity,
  Layers,
  Network,
  Terminal,
  Info,
  Radio,
} from 'lucide-react';
import { LocalTorrent, SwarmPeer } from '../types';
import { formatBytes, formatSpeed } from '../lib/crypto';
import { PieceBitmap } from './PieceBitmap';
import { DiagnosticLog, TorrentEngine } from '../swarm/TorrentEngine';

interface TransferViewProps {
  torrents: LocalTorrent[];
  peers: Map<string, SwarmPeer>;
  onTogglePause?: (fileId: string) => void;
  onRemoveTorrent?: (fileId: string) => void;
  filterMode?: 'all' | 'downloading' | 'seeding' | 'completed' | 'paused';
  logs?: DiagnosticLog[];
  roomCode?: string;
  engine?: TorrentEngine | null;
}

type DetailTab = 'general' | 'trackers' | 'peers' | 'pieces' | 'speed' | 'log';

export const TransferView: React.FC<TransferViewProps> = ({
  torrents,
  peers,
  onTogglePause,
  onRemoveTorrent,
  filterMode = 'all',
  logs = [],
  roomCode,
  engine,
}) => {
  const [selectedFileId, setSelectedFileId] = useState<string | null>(
    torrents.length > 0 ? torrents[0].manifest.fileId : null
  );
  const [activeTab, setActiveTab] = useState<DetailTab>('general');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Speed history samples for the Speed graph tab
  const [speedHistory, setSpeedHistory] = useState<Array<{ down: number; up: number; time: number }>>([]);

  useEffect(() => {
    const timer = setInterval(() => {
      let currentDown = 0;
      let currentUp = 0;
      for (const [, p] of peers) {
        currentDown += p.downloadSpeedBps;
        currentUp += p.uploadSpeedBps;
      }
      setSpeedHistory((prev) => [
        ...prev.slice(-29),
        { down: currentDown, up: currentUp, time: Date.now() },
      ]);
    }, 1000);
    return () => clearInterval(timer);
  }, [peers]);

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1500);
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
      <div className="p-8 text-center bg-[#15191e] rounded border border-[#272d34] text-[#9299a3] select-none text-xs space-y-1">
        <FileText className="w-8 h-8 text-[#656d77] mx-auto mb-2" />
        <p className="font-semibold text-[#e7eaee]">No Torrents in Swarm</p>
        <p className="text-[#656d77] text-[11px]">
          Seed a file with the "Seed File" button or connect to a room with active seeders.
        </p>
      </div>
    );
  }

  // Selected torrent or first
  const activeTorrent =
    torrents.find((t) => t.manifest.fileId === selectedFileId) || torrents[0];

  const manifest = activeTorrent.manifest;
  const verifiedCount = activeTorrent.verifiedPieces.size;
  const totalPieces = manifest.pieceCount;
  const percentage = Math.round((verifiedCount / totalPieces) * 100);

  // Seed count: peers who have all pieces
  const seedCount = Array.from(peers.values()).filter((p) => {
    const owned = p.ownedPiecesByFile?.get(manifest.fileId) || p.ownedPieces;
    return owned.size >= totalPieces && totalPieces > 0;
  }).length + (activeTorrent.isSeeder ? 1 : 0);

  // ETA calculation
  const remainingBytes = Math.max(0, manifest.fileSize - (verifiedCount * manifest.pieceSize));
  let etaText = '—';
  if (activeTorrent.downloadSpeedBps > 0 && remainingBytes > 0) {
    const seconds = Math.ceil(remainingBytes / activeTorrent.downloadSpeedBps);
    if (seconds < 60) etaText = `00:${seconds < 10 ? '0' : ''}${seconds}`;
    else if (seconds < 3600) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      etaText = `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    } else {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      etaText = `${h}h ${m}m`;
    }
  } else if (percentage === 100) {
    etaText = 'Done';
  }

  const getStatusText = (t: LocalTorrent) => {
    if (t.overallSha256Status === 'mismatch') return 'Hash error';
    if (t.overallSha256Status === 'verified' || t.verifiedPieces.size >= t.manifest.pieceCount) {
      return t.isSeeder ? 'Seeding' : 'Completed';
    }
    if (t.isPaused) return 'Paused';
    if (t.downloadSpeedBps > 0 || t.inFlightPieces.size > 0) return 'Downloading';
    return 'Connecting';
  };

  const getStatusColor = (t: LocalTorrent) => {
    if (t.overallSha256Status === 'mismatch') return 'text-red-400';
    if (t.overallSha256Status === 'verified' || t.verifiedPieces.size >= t.manifest.pieceCount) {
      return 'text-emerald-400';
    }
    if (t.isPaused) return 'text-[#9299a3]';
    if (t.downloadSpeedBps > 0 || t.inFlightPieces.size > 0) return 'text-blue-400';
    return 'text-[#9299a3]';
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

  // Calculate ratio
  const getTorrentRatio = (t: LocalTorrent): string => {
    if (t.isSeeder) return '∞';
    const downloaded = t.verifiedPieces.size * t.manifest.pieceSize;
    if (downloaded === 0) return '0.00';
    // Estimate based on upload activity
    const uploaded = t.uploadSpeedBps > 0 ? downloaded * 0.15 : 0;
    return (uploaded / downloaded).toFixed(2);
  };

  return (
    <div className="space-y-3 select-none text-xs">
      {/* 1. Main Desktop Torrent List Table */}
      <div className="rounded border border-[#272d34] bg-[#15191e] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#111418] text-[#9299a3] border-b border-[#272d34] text-[11px] font-semibold">
              <tr>
                <th className="py-2 px-3">NAME</th>
                <th className="py-2 px-2.5">SIZE</th>
                <th className="py-2 px-2.5 min-w-[120px]">PROGRESS</th>
                <th className="py-2 px-2.5">STATUS</th>
                <th className="py-2 px-2.5 font-mono">DOWN SPEED</th>
                <th className="py-2 px-2.5 font-mono">UP SPEED</th>
                <th className="py-2 px-2.5 font-mono">ETA</th>
                <th className="py-2 px-2.5">PEERS</th>
                <th className="py-2 px-2.5">SEEDS</th>
                <th className="py-2 px-2.5 font-mono">RATIO</th>
                <th className="py-2 px-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f242b] text-[11px]">
              {filteredTorrents.map((t) => {
                const percent = Math.round((t.verifiedPieces.size / t.manifest.pieceCount) * 100);
                const isSelected = t.manifest.fileId === activeTorrent.manifest.fileId;
                const statusStr = getStatusText(t);

                // Row ETA
                const rowRemaining = Math.max(0, t.manifest.fileSize - (t.verifiedPieces.size * t.manifest.pieceSize));
                let rowEta = '—';
                if (t.downloadSpeedBps > 0 && rowRemaining > 0) {
                  const s = Math.ceil(rowRemaining / t.downloadSpeedBps);
                  rowEta = s < 60 ? `00:${s < 10 ? '0' : ''}${s}` : `${Math.floor(s / 60)}m`;
                } else if (percent === 100) {
                  rowEta = 'Done';
                }

                // Row seeds
                const rowSeeds = Array.from(peers.values()).filter((p) => {
                  const owned = p.ownedPiecesByFile?.get(t.manifest.fileId) || p.ownedPieces;
                  return owned.size >= t.manifest.pieceCount && t.manifest.pieceCount > 0;
                }).length + (t.isSeeder ? 1 : 0);

                return (
                  <tr
                    key={t.manifest.fileId}
                    onClick={() => setSelectedFileId(t.manifest.fileId)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#1e2530] border-l-2 border-l-blue-500'
                        : 'hover:bg-[#191e24]'
                    }`}
                  >
                    {/* Name */}
                    <td className="py-2 px-3">
                      <div className="flex items-center gap-2">
                        <FileText className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-[#656d77]'}`} />
                        <span className="font-medium text-[#e7eaee] truncate max-w-[180px] sm:max-w-xs" title={t.manifest.fileName}>
                          {t.manifest.fileName}
                        </span>
                      </div>
                    </td>

                    {/* Size */}
                    <td className="py-2 px-2.5 text-[#9299a3] whitespace-nowrap">
                      {formatBytes(t.manifest.fileSize)}
                    </td>

                    {/* Progress */}
                    <td className="py-2 px-2.5">
                      <div className="w-28 space-y-0.5">
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="font-mono text-[#e7eaee]">{percent}%</span>
                          <span className="text-[#656d77]">{t.verifiedPieces.size}/{t.manifest.pieceCount}</span>
                        </div>
                        <div className="w-full bg-[#111418] rounded-xs h-1.5 overflow-hidden border border-[#272d34]">
                          <div
                            className={`h-full transition-all duration-200 ${
                              percent === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-2 px-2.5 whitespace-nowrap">
                      <span className={`font-medium ${getStatusColor(t)}`}>
                        {statusStr}
                      </span>
                    </td>

                    {/* Down Speed */}
                    <td className="py-2 px-2.5 font-mono text-blue-400 whitespace-nowrap">
                      {t.downloadSpeedBps > 0 ? formatSpeed(t.downloadSpeedBps) : '—'}
                    </td>

                    {/* Up Speed */}
                    <td className="py-2 px-2.5 font-mono text-emerald-400 whitespace-nowrap">
                      {t.uploadSpeedBps > 0 ? formatSpeed(t.uploadSpeedBps) : '—'}
                    </td>

                    {/* ETA */}
                    <td className="py-2 px-2.5 font-mono text-[#9299a3] whitespace-nowrap">
                      {rowEta}
                    </td>

                    {/* Peers */}
                    <td className="py-2 px-2.5 font-mono text-[#9299a3] whitespace-nowrap">
                      {peers.size}
                    </td>

                    {/* Seeds */}
                    <td className="py-2 px-2.5 font-mono text-emerald-400 whitespace-nowrap">
                      {rowSeeds}
                    </td>

                    {/* Ratio */}
                    <td className="py-2 px-2.5 font-mono text-[#9299a3] whitespace-nowrap">
                      {getTorrentRatio(t)}
                    </td>

                    {/* Actions */}
                    <td className="py-2 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="inline-flex items-center gap-1">
                        {onTogglePause && !t.isSeeder && percent < 100 && (
                          <button
                            onClick={() => onTogglePause(t.manifest.fileId)}
                            className="p-1 rounded text-[#9299a3] hover:text-[#e7eaee] hover:bg-[#272d34] transition-colors cursor-pointer"
                            title={t.isPaused ? 'Resume' : 'Pause'}
                          >
                            {t.isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
                          </button>
                        )}

                        {t.overallSha256Status === 'verified' && t.blobUrl && (
                          <button
                            onClick={() => handleSaveFile(t)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            title="Save file to disk"
                          >
                            <Download className="w-3 h-3" />
                            <span>Save</span>
                          </button>
                        )}

                        {onRemoveTorrent && (
                          <button
                            onClick={() => onRemoveTorrent(t.manifest.fileId)}
                            className="p-1 text-[#656d77] hover:text-red-400 hover:bg-[#272d34] rounded transition-colors cursor-pointer"
                            title="Remove from list"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
      </div>

      {/* 2. Desktop Bottom Detail Inspector Tabs (qBittorrent / Transmission style) */}
      <div className="rounded border border-[#272d34] bg-[#15191e] overflow-hidden">
        {/* Tab Navigation Header */}
        <div className="flex items-center justify-between px-2 bg-[#111418] border-b border-[#272d34] text-[11px]">
          <div className="flex items-center gap-0.5">
            {(
              [
                { id: 'general', label: 'General', icon: Info },
                { id: 'trackers', label: 'Trackers / Signaling', icon: Radio },
                { id: 'peers', label: `Peers (${peers.size})`, icon: Users },
                { id: 'pieces', label: `Pieces (${totalPieces})`, icon: Layers },
                { id: 'speed', label: 'Speed', icon: Activity },
                { id: 'log', label: 'Log', icon: Terminal },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 border-b-2 font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'border-b-blue-500 text-[#e7eaee] bg-[#15191e]'
                      : 'border-b-transparent text-[#656d77] hover:text-[#9299a3]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-blue-400' : 'text-[#656d77]'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="text-[10px] text-[#656d77] font-mono hidden sm:block">
            {manifest.fileName} • {formatBytes(manifest.fileSize)}
          </div>
        </div>

        {/* Tab Content Panes */}
        <div className="p-3">
          {/* TAB 1: GENERAL */}
          {activeTab === 'general' && (
            <div className="space-y-3">
              {/* Progress Bar & Quick Stats */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-[#e7eaee]">{manifest.fileName}</span>
                    <span className={`font-medium ${getStatusColor(activeTorrent)}`}>
                      • {getStatusText(activeTorrent)} ({percentage}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-[#9299a3] font-mono text-[11px]">
                    <span className="text-blue-400">↓ {activeTorrent.downloadSpeedBps > 0 ? formatSpeed(activeTorrent.downloadSpeedBps) : '0.0 B/s'}</span>
                    <span className="text-emerald-400">↑ {activeTorrent.uploadSpeedBps > 0 ? formatSpeed(activeTorrent.uploadSpeedBps) : '0.0 B/s'}</span>
                    <span>ETA: {etaText}</span>
                  </div>
                </div>
                <div className="w-full bg-[#111418] rounded-xs h-2 overflow-hidden border border-[#272d34]">
                  <div
                    className={`h-full transition-all duration-200 ${
                      percentage === 100 ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>

              {/* Grid of Technical Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11px]">
                {/* Transfer Info */}
                <div className="p-2.5 rounded bg-[#111418] border border-[#272d34] space-y-1">
                  <div className="text-[10px] font-semibold text-[#656d77] uppercase pb-1 border-b border-[#272d34]">
                    Transfer
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#656d77]">Downloaded:</span>
                    <span className="text-[#e7eaee] font-mono">{formatBytes(verifiedCount * manifest.pieceSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#656d77]">Uploaded:</span>
                    <span className="text-[#e7eaee] font-mono">{formatBytes(activeTorrent.isSeeder ? manifest.fileSize : 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#656d77]">Share Ratio:</span>
                    <span className="text-[#e7eaee] font-mono">{getTorrentRatio(activeTorrent)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#656d77]">Active Requests:</span>
                    <span className="text-[#e7eaee] font-mono">{activeTorrent.inFlightPieces.size}</span>
                  </div>
                </div>

                {/* Information */}
                <div className="p-2.5 rounded bg-[#111418] border border-[#272d34] space-y-1">
                  <div className="text-[10px] font-semibold text-[#656d77] uppercase pb-1 border-b border-[#272d34]">
                    Information
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#656d77]">Total Size:</span>
                    <span className="text-[#e7eaee] font-mono">{formatBytes(manifest.fileSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#656d77]">Pieces:</span>
                    <span className="text-[#e7eaee] font-mono">{verifiedCount} / {totalPieces}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#656d77]">Piece Size:</span>
                    <span className="text-[#e7eaee] font-mono">{formatBytes(manifest.pieceSize)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#656d77]">MIME Type:</span>
                    <span className="text-[#e7eaee] truncate max-w-[100px]">{manifest.mimeType}</span>
                  </div>
                </div>

                {/* Hash Integrity */}
                <div className="p-2.5 rounded bg-[#111418] border border-[#272d34] space-y-1">
                  <div className="text-[10px] font-semibold text-[#656d77] uppercase pb-1 border-b border-[#272d34]">
                    Integrity
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#656d77]">Status:</span>
                    <span className={activeTorrent.overallSha256Status === 'verified' ? 'text-emerald-400 font-semibold' : 'text-[#9299a3]'}>
                      {activeTorrent.overallSha256Status === 'verified' ? '✓ SHA-256 Verified' : 'In Progress'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#656d77] block">Full SHA-256:</span>
                    <div className="flex items-center justify-between gap-1 mt-0.5 font-mono text-[10px] text-[#9299a3] bg-[#161a1f] p-1 rounded border border-[#272d34]">
                      <span className="truncate">{manifest.overallSha256.slice(0, 18)}...</span>
                      <button
                        onClick={() => copyHash(manifest.overallSha256)}
                        className="text-[#656d77] hover:text-[#e7eaee] cursor-pointer flex-shrink-0"
                        title="Copy SHA-256"
                      >
                        {copiedHash === manifest.overallSha256 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-between text-[10px] text-[#656d77] pt-0.5">
                    <span>Algorithm:</span>
                    <span className="text-[#e7eaee]">SHA-256 SubtleCrypto</span>
                  </div>
                </div>

                {/* Actions & Swarm Mesh */}
                <div className="p-2.5 rounded bg-[#111418] border border-[#272d34] space-y-1.5 flex flex-col justify-between">
                  <div>
                    <div className="text-[10px] font-semibold text-[#656d77] uppercase pb-1 border-b border-[#272d34]">
                      Swarm
                    </div>
                    <div className="flex justify-between pt-1">
                      <span className="text-[#656d77]">Connected:</span>
                      <span className="text-[#e7eaee] font-mono">{peers.size} peers</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#656d77]">Seeds:</span>
                      <span className="text-emerald-400 font-mono">{seedCount}</span>
                    </div>
                  </div>

                  {activeTorrent.overallSha256Status === 'verified' && activeTorrent.blobUrl && (
                    <button
                      onClick={() => handleSaveFile(activeTorrent)}
                      className="w-full py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Save File to Disk</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TRACKERS & SIGNALING */}
          {activeTab === 'trackers' && (
            <div className="space-y-2">
              <div className="overflow-x-auto rounded border border-[#272d34]">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-[#111418] text-[#9299a3] border-b border-[#272d34] font-semibold">
                    <tr>
                      <th className="py-1.5 px-3">TIER</th>
                      <th className="py-1.5 px-2.5">URL / ENDPOINT</th>
                      <th className="py-1.5 px-2.5">STATUS</th>
                      <th className="py-1.5 px-2.5 font-mono">PEERS</th>
                      <th className="py-1.5 px-2.5">PROTOCOL</th>
                      <th className="py-1.5 px-2.5">LAST ANNOUNCE</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f242b] bg-[#111418]">
                    <tr>
                      <td className="py-1.5 px-3 font-mono text-[#656d77]">0</td>
                      <td className="py-1.5 px-2.5 font-mono text-[#e7eaee]">
                        {typeof window !== 'undefined' ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}` : 'ws://localhost:8080'}
                      </td>
                      <td className="py-1.5 px-2.5">
                        <span className="text-emerald-400 font-medium">Working (Connected)</span>
                      </td>
                      <td className="py-1.5 px-2.5 font-mono text-[#e7eaee]">{peers.size + 1}</td>
                      <td className="py-1.5 px-2.5 text-[#9299a3]">WebSocket Signaling</td>
                      <td className="py-1.5 px-2.5 text-[#656d77]">Active</td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-3 font-mono text-[#656d77]">1</td>
                      <td className="py-1.5 px-2.5 font-mono text-[#9299a3]">stun:stun.l.google.com:19302</td>
                      <td className="py-1.5 px-2.5">
                        <span className="text-blue-400">ICE Ready</span>
                      </td>
                      <td className="py-1.5 px-2.5 font-mono text-[#9299a3]">—</td>
                      <td className="py-1.5 px-2.5 text-[#9299a3]">STUN NAT Discovery</td>
                      <td className="py-1.5 px-2.5 text-[#656d77]">On Demand</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="p-2 bg-[#111418] rounded border border-[#272d34] text-[10px] text-[#656d77] flex items-center justify-between">
                <span>Room Code: <strong className="text-[#e7eaee] font-mono">{roomCode || 'DEMO99'}</strong></span>
                <span>Swarm Mesh: <strong className="text-[#e7eaee]">Fully Meshed P2P DataChannels</strong></span>
                <span>Transfer Type: <strong className="text-emerald-400">Zero Server Storage (Direct)</strong></span>
              </div>
            </div>
          )}

          {/* TAB 3: PEERS */}
          {activeTab === 'peers' && (
            <div className="space-y-2">
              <div className="overflow-x-auto rounded border border-[#272d34]">
                <table className="w-full text-left text-[11px] border-collapse">
                  <thead className="bg-[#111418] text-[#9299a3] border-b border-[#272d34] font-semibold">
                    <tr>
                      <th className="py-1.5 px-3">IP / PEER ID</th>
                      <th className="py-1.5 px-2.5">CLIENT ROLE</th>
                      <th className="py-1.5 px-2.5 min-w-[100px]">PROGRESS</th>
                      <th className="py-1.5 px-2.5 font-mono">DOWN SPEED</th>
                      <th className="py-1.5 px-2.5 font-mono">UP SPEED</th>
                      <th className="py-1.5 px-2.5 font-mono">LATENCY</th>
                      <th className="py-1.5 px-2.5">DATA CHANNEL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1f242b] bg-[#111418]">
                    {peers.size === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-4 text-center text-[#656d77]">
                          No remote peers connected to this torrent swarm.
                        </td>
                      </tr>
                    ) : (
                      Array.from(peers.values()).map((p) => {
                        const ownedSet = p.ownedPiecesByFile?.get(manifest.fileId) || p.ownedPieces;
                        const peerPct = Math.round((ownedSet.size / totalPieces) * 100);
                        const isSeeder = ownedSet.size >= totalPieces && totalPieces > 0;

                        return (
                          <tr key={p.peerId} className="hover:bg-[#161a1f]">
                            <td className="py-1.5 px-3 font-mono text-[#e7eaee] font-medium">
                              {p.peerId}
                            </td>
                            <td className="py-1.5 px-2.5">
                              <span
                                className={`font-medium ${
                                  isSeeder ? 'text-emerald-400' : ownedSet.size > 0 ? 'text-blue-400' : 'text-purple-400'
                                }`}
                              >
                                {isSeeder ? 'Seeder' : ownedSet.size > 0 ? 'Re-seeder' : 'Leecher'}
                              </span>
                            </td>
                            <td className="py-1.5 px-2.5">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-[10px] text-[#e7eaee] w-8">{peerPct}%</span>
                                <div className="w-16 bg-[#161a1f] h-1.5 rounded-xs overflow-hidden border border-[#272d34]">
                                  <div
                                    className={`h-full ${isSeeder ? 'bg-emerald-500' : 'bg-blue-500'}`}
                                    style={{ width: `${peerPct}%` }}
                                  />
                                </div>
                              </div>
                            </td>
                            <td className="py-1.5 px-2.5 font-mono text-blue-400">
                              {p.downloadSpeedBps > 0 ? formatSpeed(p.downloadSpeedBps) : '—'}
                            </td>
                            <td className="py-1.5 px-2.5 font-mono text-emerald-400">
                              {p.uploadSpeedBps > 0 ? formatSpeed(p.uploadSpeedBps) : '—'}
                            </td>
                            <td className="py-1.5 px-2.5 font-mono text-[#9299a3]">
                              {p.latencyMs > 0 ? `${p.latencyMs}ms` : '—'}
                            </td>
                            <td className="py-1.5 px-2.5">
                              <span className={p.dataChannelState === 'open' ? 'text-emerald-400' : 'text-amber-400'}>
                                {p.dataChannelState}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: PIECES */}
          {activeTab === 'pieces' && (
            <div className="space-y-2">
              <PieceBitmap torrent={activeTorrent} peers={peers} />
            </div>
          )}

          {/* TAB 5: SPEED */}
          {activeTab === 'speed' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-[11px] text-[#9299a3]">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-blue-400 inline-block" />
                    <span>Download: <strong className="text-blue-400 font-mono">{formatSpeed(activeTorrent.downloadSpeedBps)}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-emerald-400 inline-block" />
                    <span>Upload: <strong className="text-emerald-400 font-mono">{formatSpeed(activeTorrent.uploadSpeedBps)}</strong></span>
                  </div>
                </div>
                <span className="text-[10px] text-[#656d77]">Real-time 30-second window</span>
              </div>

              {/* Pure SVG Speed Sparkline */}
              <div className="h-32 bg-[#111418] rounded border border-[#272d34] p-2 flex items-end relative overflow-hidden">
                {/* Horizontal reference grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none opacity-20">
                  <div className="border-b border-[#272d34] w-full" />
                  <div className="border-b border-[#272d34] w-full" />
                  <div className="border-b border-[#272d34] w-full" />
                </div>

                <svg className="w-full h-full" viewBox="0 0 300 100" preserveAspectRatio="none">
                  {/* Download Area & Path */}
                  {(() => {
                    const maxRate = Math.max(
                      100 * 1024,
                      ...speedHistory.map((s) => Math.max(s.down, s.up))
                    );
                    const points = speedHistory.map((s, idx) => {
                      const x = (idx / 29) * 300;
                      const y = 100 - (s.down / maxRate) * 90;
                      return `${x},${y}`;
                    });

                    if (points.length < 2) return null;

                    const dPath = `M 0,100 L ${points.join(' L ')} L 300,100 Z`;
                    const linePath = `M ${points.join(' L ')}`;

                    return (
                      <>
                        <path d={dPath} fill="rgba(59, 130, 246, 0.15)" />
                        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth="1.5" />
                      </>
                    );
                  })()}

                  {/* Upload Path */}
                  {(() => {
                    const maxRate = Math.max(
                      100 * 1024,
                      ...speedHistory.map((s) => Math.max(s.down, s.up))
                    );
                    const points = speedHistory.map((s, idx) => {
                      const x = (idx / 29) * 300;
                      const y = 100 - (s.up / maxRate) * 90;
                      return `${x},${y}`;
                    });

                    if (points.length < 2) return null;
                    const linePath = `M ${points.join(' L ')}`;

                    return (
                      <path d={linePath} fill="none" stroke="#10b981" strokeWidth="1.5" />
                    );
                  })()}
                </svg>
              </div>
            </div>
          )}

          {/* TAB 6: LOG */}
          {activeTab === 'log' && (
            <div className="space-y-1.5 font-mono text-[10px]">
              <div className="p-2 bg-[#111418] rounded border border-[#272d34] max-h-48 overflow-y-auto space-y-0.5">
                {logs.length === 0 ? (
                  <div className="text-[#656d77] italic py-2 text-center">No log events recorded.</div>
                ) : (
                  logs.slice(0, 30).map((l) => (
                    <div key={l.id} className="flex gap-2 py-0.5 px-1 hover:bg-[#161a1f] rounded-xs">
                      <span className="text-[#656d77] flex-shrink-0">{l.time}</span>
                      <span
                        className={`flex-shrink-0 ${
                          l.category === 'error'
                            ? 'text-red-400 font-bold'
                            : l.category === 'piece'
                            ? 'text-purple-400'
                            : 'text-[#9299a3]'
                        }`}
                      >
                        [{l.category.toUpperCase()}]
                      </span>
                      <span className="text-[#e7eaee] truncate">{l.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
