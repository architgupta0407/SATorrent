import React, { useState } from 'react';
import {
  Settings,
  Shield,
  Server,
  Trash2,
  HardDrive,
  Cpu,
  Layers,
  Check,
  AlertTriangle,
  User,
  Terminal,
  FolderDown,
} from 'lucide-react';
import { storage } from '../lib/storage';

interface SettingsViewProps {
  localPeerId: string;
  onClearAllData: () => void;
  onUpdateSettings?: (settings: {
    displayName: string;
    maxPeers: number;
    devMode: boolean;
  }) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  localPeerId,
  onClearAllData,
  onUpdateSettings,
}) => {
  const [displayName, setDisplayName] = useState(
    localStorage.getItem('satorrent_display_name') || ''
  );
  const [maxPeers, setMaxPeers] = useState(
    parseInt(localStorage.getItem('satorrent_max_peers') || '8', 10)
  );
  const [devMode, setDevMode] = useState(
    localStorage.getItem('satorrent_dev_mode') !== 'false'
  );
  const [stunList, setStunList] = useState(
    'stun:stun.l.google.com:19302\nstun:stun1.l.google.com:19302\nstun:global.stun.twilio.com:3478'
  );
  const [turnUrl, setTurnUrl] = useState('');
  const [turnUsername, setTurnUsername] = useState('');
  const [turnPassword, setTurnPassword] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('satorrent_display_name', displayName);
    localStorage.setItem('satorrent_max_peers', maxPeers.toString());
    localStorage.setItem('satorrent_dev_mode', devMode ? 'true' : 'false');

    if (onUpdateSettings) {
      onUpdateSettings({ displayName, maxPeers, devMode });
    }

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleClearCache = async () => {
    if (confirm('Clear all downloaded pieces, manifests, and cache in browser IndexedDB?')) {
      await storage.clearAll();
      onClearAllData();
    }
  };

  return (
    <div className="space-y-6 max-w-3xl font-mono text-xs">
      <div className="flex items-center gap-2">
        <Settings className="w-5 h-5 text-cyan-400" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-100">
          SATorrent Client & WebRTC Configuration
        </h2>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* User & Client Profile */}
        <div className="p-5 rounded-xl bg-[#080d19] border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800 font-bold text-cyan-300">
            <User className="w-4 h-4" />
            <span>Peer Identity & Preferences</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Node Peer ID (Read-only):</label>
              <input
                type="text"
                readOnly
                value={localPeerId}
                className="w-full px-3 py-2 bg-slate-900/60 border border-slate-800 rounded-lg text-slate-400 select-all outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Display Name / Alias:</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Laptop-Alpha"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg text-slate-200 outline-none"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-slate-300 font-semibold">Max Room Peer Limit:</label>
                <span className="font-bold text-cyan-300">{maxPeers} Peers</span>
              </div>
              <input
                type="range"
                min={2}
                max={8}
                value={maxPeers}
                onChange={(e) => setMaxPeers(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-400 bg-slate-800"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300 font-semibold">Developer Diagnostics Console:</label>
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="devModeToggle"
                  checked={devMode}
                  onChange={(e) => setDevMode(e.target.checked)}
                  className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                />
                <label htmlFor="devModeToggle" className="text-slate-300 cursor-pointer">
                  Show developer diagnostics drawer & telemetry
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Network Configuration */}
        <div className="p-5 rounded-xl bg-[#080d19] border border-slate-800 space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-slate-800 font-bold text-cyan-300">
            <Server className="w-4 h-4" />
            <span>STUN / TURN Network Servers</span>
          </div>

          <div className="space-y-2">
            <label className="text-slate-300 font-semibold">STUN Servers (one per line):</label>
            <textarea
              rows={3}
              value={stunList}
              onChange={(e) => setStunList(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg text-slate-200 outline-none transition-all resize-none"
            />
            <p className="text-[11px] text-slate-500">
              Public STUN servers are used for NAT hole punching during WebRTC ICE negotiation.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="space-y-1">
              <label className="text-slate-300">TURN Server URL:</label>
              <input
                type="text"
                value={turnUrl}
                onChange={(e) => setTurnUrl(e.target.value)}
                placeholder="turn:turn.example.com:3478"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg text-slate-200 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300">TURN Username:</label>
              <input
                type="text"
                value={turnUsername}
                onChange={(e) => setTurnUsername(e.target.value)}
                placeholder="optional"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg text-slate-200 outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-slate-300">TURN Credential:</label>
              <input
                type="password"
                value={turnPassword}
                onChange={(e) => setTurnPassword(e.target.value)}
                placeholder="optional"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg text-slate-200 outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500">
              LAN devices on the same Wi-Fi communicate via direct host candidates without relay.
            </span>

            <button
              type="submit"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg font-bold border border-slate-700 hover:border-cyan-500/40 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Configuration Saved</span>
                </>
              ) : (
                <span>Save Client Config</span>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Protocol Specs Card */}
      <div className="p-5 rounded-xl bg-[#080d19] border border-slate-800 space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-slate-800 font-bold text-cyan-300">
          <Layers className="w-4 h-4" />
          <span>Swarm Architecture & College Demo Specs</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-slate-300">
          <div className="space-y-1">
            <span className="text-slate-500 text-[11px]">Default Piece Size:</span>
            <p className="font-bold text-white">64 KB (65,536 bytes)</p>
          </div>
          <div className="space-y-1">
            <span className="text-slate-500 text-[11px]">Maximum File Limit:</span>
            <p className="font-bold text-white">250 MB</p>
          </div>
          <div className="space-y-1">
            <span className="text-slate-500 text-[11px]">Swarm Mesh Capacity:</span>
            <p className="font-bold text-white">Up to 8 peers / room</p>
          </div>
          <div className="space-y-1">
            <span className="text-slate-500 text-[11px]">Integrity Check:</span>
            <p className="font-bold text-emerald-400">SubtleCrypto SHA-256 Per-Piece & Final</p>
          </div>
        </div>
      </div>

      {/* Local Storage & Cache Management */}
      <div className="p-5 rounded-xl bg-[#080d19] border border-slate-800 space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 font-bold text-red-400">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4" />
            <span>Browser Storage (IndexedDB)</span>
          </div>
          <button
            onClick={handleClearCache}
            className="px-3 py-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/60 border border-red-800/60 text-red-300 font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Swarm Cache</span>
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          Removes all cached pieces and completed files stored in this browser instance.
        </p>
      </div>
    </div>
  );
};
