/**
 * SATorrent - Decentralized WebRTC Swarm File Sharing Client
 * Modern Desktop Torrent Client & Networking Dashboard
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
import {
  AlertCircle,
  CheckCircle2,
  X,
  Upload,
  Radio,
  Share2,
  Copy,
  Check,
  LogOut,
  Users,
  ShieldCheck,
  Activity,
  Layers,
  FileText,
  PlusCircle,
  LogIn,
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
    }, 4000);
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

  return (
    <div className="h-screen bg-[#060a12] text-slate-100 flex flex-col font-mono select-none overflow-hidden text-xs">
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
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 pb-20 md:pb-6 space-y-4 bg-[#050811] text-xs">
          {/* Top Statistics Strip (Always visible on Overview, Transfers, and Swarm) */}
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
            <div className="space-y-4">
              {/* Room System Panel & Network Health Bar */}
              <div className="p-3 rounded-xl bg-[#070b14] border border-slate-800/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                {roomState ? (
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-500 font-semibold text-[10px]">ROOM:</span>
                      <span className="font-bold text-cyan-300 text-sm tracking-wider">{roomState.roomCode}</span>
                      <button
                        onClick={() => copyRoom(roomState.roomCode)}
                        className="p-1 text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                        title="Copy Room Code"
                      >
                        {copiedRoomCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>

                    <div className="h-3.5 w-px bg-slate-800 hidden sm:block" />

                    <div className="flex items-center gap-1.5 text-slate-300">
                      <span className="text-slate-500 text-[10px]">PEERS:</span>
                      <span className="font-bold text-white">{peers.size + 1} / {roomState.maxPeers}</span>
                    </div>

                    <div className="h-3.5 w-px bg-slate-800 hidden sm:block" />

                    <div className="flex items-center gap-1.5">
                      <span className="text-slate-500 text-[10px]">STATUS:</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                        SWARM ACTIVE
                      </span>
                    </div>

                    <div className="h-3.5 w-px bg-slate-800 hidden sm:block" />

                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span>SIGNALING: <strong className="text-emerald-400">Connected</strong></span>
                      <span>WEBRTC: <strong className="text-cyan-300">{peers.size} peers</strong></span>
                      <span>DATA CHANNEL: <strong className="text-emerald-400">Healthy</strong></span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Radio className="w-4 h-4 text-amber-400 animate-pulse flex-shrink-0" />
                    <div>
                      <span className="font-bold text-slate-200">Not Connected to a Swarm Room</span>
                      <p className="text-[11px] text-slate-400">Create a new room or enter an existing 6-character code to join peers.</p>
                    </div>
                  </div>
                )}

                {/* Right controls */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  {roomState ? (
                    <button
                      onClick={handleLeaveRoom}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-red-950/80 hover:text-red-300 border border-slate-700 hover:border-red-800/60 text-slate-300 rounded text-[11px] font-semibold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Leave Room</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => setJoinModalConfig({ isOpen: true, initialMode: 'create' })}
                        className="px-3 py-1 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded text-[11px] font-bold shadow-sm transition-all cursor-pointer"
                      >
                        Create Room
                      </button>
                      <button
                        onClick={() => setJoinModalConfig({ isOpen: true, initialMode: 'join' })}
                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 rounded text-[11px] font-bold transition-all cursor-pointer"
                      >
                        Join Room
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Centerpiece: Active Transfers Table & Piece Map */}
              <TransferView
                torrents={activeTorrentList}
                peers={peers}
                onTogglePause={(fileId) => engine?.togglePauseTorrent(fileId)}
              />

              {/* Lower Section: Real-time Activity Feed & Swarm Topology */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Real-time Activity Feed */}
                <ActivityFeed
                  logs={logs}
                  onClear={() => setLogs([])}
                  maxItems={10}
                />

                {/* Compact Swarm Visualizer */}
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
            <div className="space-y-4">
              {/* Filter Tabs */}
              <div className="flex items-center gap-1 bg-[#070b14] p-1.5 rounded-xl border border-slate-800/80 text-xs">
                {(
                  [
                    { id: 'all', label: `All (${activeTorrentList.length})` },
                    { id: 'downloading', label: `Downloading (${activeTorrentList.filter(t => t.status === 'downloading').length})` },
                    { id: 'seeding', label: `Seeding (${activeTorrentList.filter(t => t.isSeeder || t.status === 'seeding').length})` },
                    { id: 'completed', label: `Completed (${activeTorrentList.filter(t => t.status === 'completed').length})` },
                    { id: 'paused', label: `Paused (${activeTorrentList.filter(t => t.isPaused).length})` },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setTransferFilter(tab.id)}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                      transferFilter === tab.id
                        ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/50'
                        : 'text-slate-400 hover:text-slate-200'
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
              />
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: SWARM MESH                                         */}
          {/* ======================================================== */}
          {activeTab === 'swarm' && (
            <div className="space-y-4">
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
            <div className="space-y-4">
              <PeerTable peers={peers} activeTorrent={primaryTorrent} />
            </div>
          )}

          {/* ======================================================== */}
          {/* VIEW: FILES                                              */}
          {/* ======================================================== */}
          {activeTab === 'files' && (
            <div className="space-y-4">
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
            <div className="space-y-4">
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

      {/* 3. Non-Intrusive Floating College Presentation Checklist */}
      <CollegeDemoBadge
        roomState={roomState}
        peersCount={peers.size}
        primaryTorrent={primaryTorrent}
        demoState={demoState}
      />

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

      {/* 7. Live Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-1.5 pointer-events-none font-mono text-xs">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-center gap-2 px-3 py-2 rounded-lg border shadow-xl backdrop-blur-md transition-all ${
              toast.type === 'error'
                ? 'bg-red-950/90 text-red-200 border-red-500/40 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
                : toast.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.25)]'
                : 'bg-slate-900/90 text-cyan-200 border-cyan-500/40 shadow-[0_0_12px_rgba(6,182,212,0.25)]'
            }`}
          >
            {toast.type === 'error' ? (
              <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            ) : toast.type === 'success' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            ) : (
              <Radio className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />
            )}
            <span className="font-semibold">{toast.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
