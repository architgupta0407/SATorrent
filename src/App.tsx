/**
 * SATorrent - Decentralized WebRTC Swarm File Sharing Client
 * Professional Desktop Peer-to-Peer File Sharing Client
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Header } from './components/Header';
import { Sidebar, NavTab } from './components/Sidebar';
import { MetricsCards } from './components/MetricsCards';
import { TransferView } from './components/TransferView';
import { SwarmVisualizer } from './components/SwarmVisualizer';
import { PeerTable } from './components/PeerTable';
import { CompletedFilesView } from './components/CompletedFilesView';
import { SettingsView } from './components/SettingsView';
import { SeedModal } from './components/SeedModal';
import { JoinRoomModal } from './components/JoinRoomModal';
import { DebugDrawer } from './components/DebugDrawer';
import { ActivityFeed } from './components/ActivityFeed';
import { CollegeDemoBadge } from './components/CollegeDemoBadge';
import {
  TorrentEngine,
  DiagnosticLog,
  SwarmTransferPulse,
} from './swarm/TorrentEngine';
import {
  RoomState,
  SwarmPeer,
  LocalTorrent,
  CollegeDemoState,
} from './types';
import { StoredCompletedFile } from './lib/storage';
import { formatSpeed } from './lib/crypto';
import {
  AlertCircle,
  CheckCircle2,
  X,
  Copy,
  Check,
  LogOut,
  Radio,
  ArrowDown,
  ArrowUp,
  Terminal,
  Layers,
} from 'lucide-react';

interface Toast {
  id: string;
  type: 'info' | 'success' | 'error';
  message: string;
}

export default function App() {
  const [engine, setEngine] = useState<TorrentEngine | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [peers, setPeers] = useState<Map<string, SwarmPeer>>(new Map());
  const [torrents, setTorrents] = useState<Map<string, LocalTorrent>>(new Map());
  const [completedFiles, setCompletedFiles] = useState<StoredCompletedFile[]>([]);
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [pulses, setPulses] = useState<SwarmTransferPulse[]>([]);
  const [demoState, setDemoState] = useState<CollegeDemoState>({
    roomCreated: false,
    peersConnected: false,
    manifestReceived: false,
    piecesTransferring: false,
    peerReSeeding: false,
    fileVerified: false,
  });
  const [isDebugOpen, setIsDebugOpen] = useState(false);
  const [isSeedModalOpen, setIsSeedModalOpen] = useState(false);
  const [joinModalConfig, setJoinModalConfig] = useState<{
    isOpen: boolean;
    initialMode: 'join' | 'create';
  }>({ isOpen: false, initialMode: 'join' });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [copiedRoomCode, setCopiedRoomCode] = useState(false);
  const [transferFilter, setTransferFilter] = useState<'all' | 'downloading' | 'seeding' | 'completed' | 'paused'>('all');

  const addToast = (type: 'info' | 'success' | 'error', message: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  // Initialize Torrent Engine on mount
  useEffect(() => {
    let savedPeerId = sessionStorage.getItem('satorrent_peer_id');
    const newEngine = new TorrentEngine(savedPeerId || undefined);
    sessionStorage.setItem('satorrent_peer_id', newEngine.getLocalPeerId());

    const unsubscribe = newEngine.addListener({
      onRoomStateChange: (room) => {
        setRoomState(room);
        if (room) {
          setDemoState((prev) => ({ ...prev, roomCreated: true }));
        }
      },
      onPeersChange: (p) => {
        setPeers(new Map(p));
        if (p.size > 0) {
          setDemoState((prev) => ({ ...prev, peersConnected: true }));
        }
      },
      onTorrentsChange: (t) => {
        setTorrents(new Map(t));
        if (t.size > 0) {
          setDemoState((prev) => ({ ...prev, manifestReceived: true }));
        }
      },
      onCompletedFilesChange: (f) => setCompletedFiles(f),
      onDiagnosticLog: (log) => {
        setLogs((prev) => [log, ...prev].slice(0, 250));
        if (log.category === 'error') {
          addToast('error', log.message);
        } else if (log.message.includes('FINAL SHA-256 VERIFIED')) {
          addToast('success', log.message);
        }
      },
      onTransferPulse: (pulse) => {
        setPulses((prev) => [pulse, ...prev].slice(0, 25));
        setDemoState((prev) => ({ ...prev, piecesTransferring: true }));
      },
      onDemoStateChange: (state) => {
        setDemoState(state);
      },
      onError: (msg) => {
        addToast('error', msg);
      },
    });

    setEngine(newEngine);

    // Auto-join room from URL ?room=XYZ
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      setTimeout(() => {
        newEngine.joinRoom(roomParam);
      }, 500);
    }

    return () => {
      unsubscribe();
      newEngine.destroy();
    };
  }, []);

  const handleCreateRoom = (customCode?: string, maxPeers?: number) => {
    if (!engine) return;
    engine.createRoom(customCode, maxPeers);
    addToast('info', 'Creating swarm room...');
  };

  const handleJoinRoom = (code: string) => {
    if (!engine) return;
    engine.joinRoom(code);
    addToast('info', `Connecting to swarm room "${code}"...`);
  };

  const handleLeaveRoom = () => {
    if (!engine) return;
    engine.leaveRoom();
    addToast('info', 'Left swarm room');
  };

  const handleSeedFile = async (file: File, onProgress?: (pct: number) => void) => {
    if (!engine) return;
    const manifest = await engine.seedFile(file, onProgress);
    addToast('success', `Now seeding "${manifest.fileName}" (${manifest.pieceCount} pieces)`);
    setActiveTab('overview');
  };

  const copyRoom = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedRoomCode(true);
    setTimeout(() => setCopiedRoomCode(false), 1800);
  };

  const activeTorrentList = Array.from(torrents.values());
  const primaryTorrent = activeTorrentList.length > 0 ? activeTorrentList[0] : undefined;

  // Aggregate Swarm Speeds
  let totalDlBps = 0;
  let totalUlBps = 0;
  for (const [, p] of peers) {
    totalDlBps += p.downloadSpeedBps;
    totalUlBps += p.uploadSpeedBps;
  }

  return (
    <div className="h-screen bg-[#0d0f12] text-[#e7eaee] flex flex-col font-sans select-none overflow-hidden text-xs">
      {/* 1. Global Desktop Top Bar */}
      <Header
        localPeerId={engine ? engine.getLocalPeerId() : 'SAT-......'}
        roomState={roomState}
        connectedPeersCount={peers.size}
        onOpenSeedModal={() => setIsSeedModalOpen(true)}
        onOpenCreateModal={() => setJoinModalConfig({ isOpen: true, initialMode: 'create' })}
        onOpenJoinModal={() => setJoinModalConfig({ isOpen: true, initialMode: 'join' })}
        onLeaveRoom={roomState ? handleLeaveRoom : undefined}
        onOpenSettings={() => setActiveTab('settings')}
        onToggleDebug={() => setIsDebugOpen((prev) => !prev)}
        isDebugOpen={isDebugOpen}
      />

      {/* 2. Main Desktop Workspace Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Desktop Sidebar */}
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          activeTransfersCount={activeTorrentList.length}
          completedFilesCount={completedFiles.length}
          peersCount={peers.size}
          isDebugOpen={isDebugOpen}
          onToggleDebug={() => setIsDebugOpen((prev) => !prev)}
        />

        {/* Center Main Scrollable Viewport */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 pb-10 space-y-3 bg-[#0d0f12] text-xs">
          {/* Top Statistics Strip */}
          {(activeTab === 'overview' || activeTab === 'transfers' || activeTab === 'swarm') && (
            <MetricsCards
              peers={peers}
              torrents={torrents}
              completedFilesCount={completedFiles.length}
            />
          )}

          {/* ======================================================== */}
          {/* VIEW: OVERVIEW (The Core Desktop Torrent Centerpiece)     */}
          {/* ======================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-3">
              {/* Room System Panel & Network Health Bar (Clean, Technical) */}
              <div className="p-2.5 rounded bg-[#15191e] border border-[#272d34] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                {roomState ? (
                  <div className="flex items-center gap-3 flex-wrap text-[11px]">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[#656d77]">Room:</span>
                      <span className="font-mono font-semibold text-[#e7eaee] tracking-wide">
                        {roomState.roomCode}
                      </span>
                      <button
                        onClick={() => copyRoom(roomState.roomCode)}
                        className="p-0.5 text-[#9299a3] hover:text-[#e7eaee] transition-colors cursor-pointer"
                        title="Copy Room Code"
                      >
                        {copiedRoomCode ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    <span className="text-[#272d34] hidden sm:inline">|</span>

                    <div className="flex items-center gap-1.5 text-[#9299a3]">
                      <span>Swarm:</span>
                      <span className="font-mono font-medium text-[#e7eaee]">
                        {peers.size + 1} / {roomState.maxPeers} peers
                      </span>
                    </div>

                    <span className="text-[#272d34] hidden sm:inline">|</span>

                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span className="text-emerald-400 font-medium">Mesh Connected</span>
                    </div>

                    <span className="text-[#272d34] hidden sm:inline">|</span>

                    <div className="flex items-center gap-3 text-[11px] text-[#9299a3]">
                      <span>Signaling: <strong className="text-emerald-400 font-normal">Active</strong></span>
                      <span>DataChannels: <strong className="text-[#e7eaee] font-normal">{peers.size} open</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2.5 text-[11px]">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <div>
                      <span className="font-medium text-[#e7eaee]">Not Connected to Swarm Room</span>
                      <span className="text-[#656d77] ml-2">Create a room or enter a room code to join peers.</span>
                    </div>
                  </div>
                )}

                {/* Right controls */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {roomState ? (
                    <button
                      onClick={handleLeaveRoom}
                      className="px-2.5 py-1 bg-[#191e24] hover:bg-red-950/40 hover:text-red-300 border border-[#272d34] hover:border-red-800/60 text-[#9299a3] rounded text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Leave Room</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setJoinModalConfig({ isOpen: true, initialMode: 'create' })}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Create Room
                      </button>
                      <button
                        onClick={() => setJoinModalConfig({ isOpen: true, initialMode: 'join' })}
                        className="px-2.5 py-1 bg-[#191e24] hover:bg-[#20262e] border border-[#272d34] text-[#e7eaee] rounded text-[11px] font-medium transition-colors cursor-pointer"
                      >
                        Join Room
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Centerpiece: Active Transfers Table & Bottom Tabs */}
              <TransferView
                torrents={activeTorrentList}
                peers={peers}
                onTogglePause={(fileId) => engine?.togglePauseTorrent(fileId)}
                logs={logs}
                roomCode={roomState?.roomCode}
                engine={engine}
              />

              {/* Lower Section: Activity Feed & Swarm Visualizer */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <ActivityFeed
                  logs={logs}
                  onClear={() => setLogs([])}
                  maxItems={10}
                />
                <SwarmVisualizer
                  localPeerId={engine?.getLocalPeerId() || ''}
                  peers={peers}
                  activeTorrent={primaryTorrent}
                  pulses={pulses}
                />
              </div>

              {/* Connected Mesh Peers Table */}
              <PeerTable peers={peers} activeTorrent={primaryTorrent} />
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: TRANSFERS                                          */}
          {/* ======================================================== */}
          {activeTab === 'transfers' && (
            <div className="space-y-3">
              {/* Filter Tabs (Clean Segmented Control) */}
              <div className="flex items-center gap-1 bg-[#15191e] p-1 rounded border border-[#272d34] text-xs">
                {(
                  [
                    { id: 'all', label: `All (${activeTorrentList.length})` },
                    { id: 'downloading', label: `Downloading (${activeTorrentList.filter(t => t.status === 'downloading' && !t.isPaused).length})` },
                    { id: 'seeding', label: `Seeding (${activeTorrentList.filter(t => t.isSeeder || t.status === 'seeding').length})` },
                    { id: 'completed', label: `Completed (${activeTorrentList.filter(t => t.status === 'completed' || t.overallSha256Status === 'verified').length})` },
                    { id: 'paused', label: `Paused (${activeTorrentList.filter(t => t.isPaused).length})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setTransferFilter(tab.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors cursor-pointer ${
                      transferFilter === tab.id
                        ? 'bg-[#1e2530] text-[#e7eaee]'
                        : 'text-[#9299a3] hover:text-[#e7eaee]'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <TransferView
                torrents={activeTorrentList}
                peers={peers}
                onTogglePause={(fileId) => engine?.togglePauseTorrent(fileId)}
                filterMode={transferFilter}
                logs={logs}
                roomCode={roomState?.roomCode}
                engine={engine}
              />
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: SWARM MESH                                         */}
          {/* ======================================================== */}
          {activeTab === 'swarm' && (
            <div className="space-y-3">
              <SwarmVisualizer
                localPeerId={engine?.getLocalPeerId() || ''}
                peers={peers}
                activeTorrent={primaryTorrent}
                pulses={pulses}
              />
              <PeerTable peers={peers} activeTorrent={primaryTorrent} />
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: PEERS                                              */}
          {/* ======================================================== */}
          {activeTab === 'peers' && (
            <div className="space-y-3">
              <PeerTable peers={peers} activeTorrent={primaryTorrent} />
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: FILES                                              */}
          {/* ======================================================== */}
          {activeTab === 'files' && (
            <div className="space-y-3">
              <CompletedFilesView
                files={completedFiles}
                torrents={activeTorrentList}
                onRefresh={() => {
                  if (engine) {
                    setCompletedFiles(engine.getCompletedFiles());
                  }
                }}
                onReSeed={(file) => {
                  addToast('info', `Re-seeding "${file.fileName}"...`);
                }}
              />
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: SETTINGS                                           */}
          {/* ======================================================== */}
          {activeTab === 'settings' && (
            <div className="space-y-3">
              <SettingsView
                localPeerId={engine?.getLocalPeerId() || ''}
                onClearAllData={() => {
                  setCompletedFiles([]);
                  setTorrents(new Map());
                  addToast('info', 'IndexedDB cache cleared');
                }}
              />
            </div>
          )}
        </main>
      </div>

      {/* 3. Global Desktop Status Bar (Bottom of Window - qBittorrent/VS Code Style) */}
      <footer className="h-6 bg-[#111418] border-t border-[#272d34] px-3 flex items-center justify-between text-[11px] text-[#9299a3] select-none z-30">
        <div className="flex items-center gap-3">
          {/* Total Download Rate */}
          <div className="flex items-center gap-1 font-mono text-blue-400">
            <ArrowDown className="w-3 h-3" />
            <span>D: {totalDlBps > 0 ? formatSpeed(totalDlBps) : '0.0 B/s'}</span>
          </div>

          <span className="text-[#272d34]">|</span>

          {/* Total Upload Rate */}
          <div className="flex items-center gap-1 font-mono text-emerald-400">
            <ArrowUp className="w-3 h-3" />
            <span>U: {totalUlBps > 0 ? formatSpeed(totalUlBps) : '0.0 B/s'}</span>
          </div>

          <span className="text-[#272d34]">|</span>

          {/* Swarm Peers */}
          <div className="flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${peers.size > 0 ? 'bg-emerald-400' : 'bg-[#656d77]'}`} />
            <span>{peers.size} {peers.size === 1 ? 'peer' : 'peers'}</span>
          </div>

          <span className="text-[#272d34] hidden sm:inline">|</span>

          {/* Signaling Status */}
          <div className="hidden sm:flex items-center gap-1 text-[#656d77]">
            <span>DHT/Signaling:</span>
            <span className="text-emerald-400">Connected</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Room Code */}
          {roomState ? (
            <button
              onClick={() => copyRoom(roomState.roomCode)}
              className="flex items-center gap-1 font-mono text-[#e7eaee] hover:text-blue-400 transition-colors cursor-pointer"
              title="Click to copy room code"
            >
              <span className="text-[#656d77]">Room:</span>
              <span>{roomState.roomCode}</span>
            </button>
          ) : (
            <span className="text-[#656d77]">No active room</span>
          )}

          <span className="text-[#272d34]">|</span>

          {/* College Demo Checklist Status */}
          <CollegeDemoBadge
            roomState={roomState}
            peersCount={peers.size}
            primaryTorrent={primaryTorrent}
            demoState={demoState}
          />
        </div>
      </footer>

      {/* 4. Collapsible Developer Diagnostics Drawer */}
      <DebugDrawer
        isOpen={isDebugOpen}
        onClose={() => setIsDebugOpen(false)}
        localPeerId={engine?.getLocalPeerId() || ''}
        roomState={roomState}
        peers={peers}
        torrents={torrents}
        logs={logs}
        onClearLogs={() => setLogs([])}
        engine={engine}
      />

      {/* 5. Desktop Torrent Creation / Seeding Modal */}
      <SeedModal
        isOpen={isSeedModalOpen}
        onClose={() => setIsSeedModalOpen(false)}
        onSeedFile={handleSeedFile}
      />

      {/* 6. Room Join & Create Dialog */}
      <JoinRoomModal
        isOpen={joinModalConfig.isOpen}
        initialMode={joinModalConfig.initialMode}
        onClose={() => setJoinModalConfig((prev) => ({ ...prev, isOpen: false }))}
        onJoinRoom={handleJoinRoom}
        onCreateRoom={handleCreateRoom}
      />

      {/* 7. Live Toast Notifications (Clean, Restrained) */}
      <div className="fixed bottom-8 right-4 z-50 space-y-1.5 pointer-events-none text-xs">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center gap-2 px-3 py-1.5 rounded bg-[#161a1f] border border-[#272d34] text-[#e7eaee] shadow-lg transition-all"
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            ) : toast.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            ) : (
              <Radio className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            )}
            <span className="font-medium text-[11px]">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
