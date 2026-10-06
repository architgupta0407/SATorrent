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
    <div className="space-y-4 max-w-3xl text-xs select-none">
      <div className="flex items-center justify-between px-1 pb-1 border-b border-[#272d34]">
        <div className="flex items-center gap-2">
          <Settings className="w-4 h-4 text-blue-400" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#e7eaee]">
            Preferences & WebRTC Options
          </h2>
        </div>
        <span className="text-[11px] text-[#656d77]">Desktop Client Config</span>
      </div>

      <form onSubmit={handleSave} className="space-y-3">
        {/* User & Client Profile */}
        <div className="p-3.5 rounded bg-[#15191e] border border-[#272d34] space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-[#272d34] font-medium text-[#e7eaee] text-xs">
            <User className="w-3.5 h-3.5 text-[#9299a3]" />
            <span>Peer Identity</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
            <div className="space-y-1">
              <label className="text-[#9299a3]">Node Peer ID:</label>
              <input
                type="text"
                readOnly
                value={localPeerId}
                className="w-full px-2.5 py-1.5 bg-[#111418] border border-[#272d34] rounded font-mono text-[#9299a3] select-all outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[#9299a3]">Display Name / Alias:</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Node-1"
                className="w-full px-2.5 py-1.5 bg-[#111418] border border-[#272d34] focus:border-blue-500 rounded text-[#e7eaee] outline-none"
              />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-[#9299a3]">Max Peers in Swarm:</label>
                <span className="font-mono text-[#e7eaee]">{maxPeers}</span>
              </div>
              <input
                type="range"
                min={2}
                max={8}
                value={maxPeers}
                onChange={(e) => setMaxPeers(parseInt(e.target.value, 10))}
                className="w-full accent-blue-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[#9299a3]">Diagnostics:</label>
              <div className="flex items-center gap-2 pt-1.5">
                <input
                  type="checkbox"
                  id="devModeToggle"
                  checked={devMode}
                  onChange={(e) => setDevMode(e.target.checked)}
                  className="w-3.5 h-3.5 accent-blue-500 rounded cursor-pointer"
                />
                <label htmlFor="devModeToggle" className="text-[#e7eaee] cursor-pointer">
                  Enable Console Inspector
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Network Configuration */}
        <div className="p-3.5 rounded bg-[#15191e] border border-[#272d34] space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-[#272d34] font-medium text-[#e7eaee] text-xs">
            <Server className="w-3.5 h-3.5 text-[#9299a3]" />
            <span>ICE / STUN / TURN Configuration</span>
          </div>

          <div className="space-y-1.5 text-[11px]">
            <label className="text-[#9299a3]">STUN Servers (one per line):</label>
            <textarea
              rows={2}
              value={stunList}
              onChange={(e) => setStunList(e.target.value)}
              className="w-full px-2.5 py-1.5 bg-[#111418] border border-[#272d34] focus:border-blue-500 rounded text-[#e7eaee] font-mono outline-none resize-none"
            />
            <p className="text-[10px] text-[#656d77]">
              STUN provides NAT traversal candidate discovery. Direct host candidates connect without server relay on local network.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-[11px] pt-1">
            <div className="space-y-1">
              <label className="text-[#9299a3]">TURN URL:</label>
              <input
                type="text"
                value={turnUrl}
                onChange={(e) => setTurnUrl(e.target.value)}
                placeholder="turn:turn.example.com:3478"
                className="w-full px-2.5 py-1.5 bg-[#111418] border border-[#272d34] focus:border-blue-500 rounded text-[#e7eaee] outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[#9299a3]">Username:</label>
              <input
                type="text"
                value={turnUsername}
                onChange={(e) => setTurnUsername(e.target.value)}
                placeholder="optional"
                className="w-full px-2.5 py-1.5 bg-[#111418] border border-[#272d34] focus:border-blue-500 rounded text-[#e7eaee] outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[#9299a3]">Credential:</label>
              <input
                type="password"
                value={turnPassword}
                onChange={(e) => setTurnPassword(e.target.value)}
                placeholder="optional"
                className="w-full px-2.5 py-1.5 bg-[#111418] border border-[#272d34] focus:border-blue-500 rounded text-[#e7eaee] outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[10px] text-[#656d77]">
              Changes apply to new WebRTC peer connections.
            </span>

            <button
              type="submit"
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              {savedSuccess ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-300" />
                  <span>Saved</span>
                </>
              ) : (
                <span>Save Settings</span>
              )}
            </button>
          </div>
        </div>
      </form>

      {/* Protocol Specifications Panel */}
      <div className="p-3.5 rounded bg-[#15191e] border border-[#272d34] space-y-2">
        <div className="flex items-center gap-2 pb-1.5 border-b border-[#272d34] font-medium text-[#e7eaee] text-xs">
          <Layers className="w-3.5 h-3.5 text-[#9299a3]" />
          <span>Protocol Architecture Specifications</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
          <div>
            <span className="text-[#656d77]">Piece Size:</span>
            <p className="font-mono text-[#e7eaee]">64 KB (65,536 B)</p>
          </div>
          <div>
            <span className="text-[#656d77]">Max File Limit:</span>
            <p className="font-mono text-[#e7eaee]">250 MB</p>
          </div>
          <div>
            <span className="text-[#656d77]">Max Room Mesh:</span>
            <p className="font-mono text-[#e7eaee]">Up to 8 peers</p>
          </div>
          <div>
            <span className="text-[#656d77]">Hash Integrity:</span>
            <p className="text-emerald-400 font-mono">SHA-256 (SubtleCrypto)</p>
          </div>
        </div>
      </div>

      {/* Local Storage & Cache Management */}
      <div className="p-3.5 rounded bg-[#15191e] border border-[#272d34] space-y-2">
        <div className="flex items-center justify-between pb-1.5 border-b border-[#272d34] font-medium text-xs">
          <div className="flex items-center gap-2 text-[#e7eaee]">
            <HardDrive className="w-3.5 h-3.5 text-[#9299a3]" />
            <span>Local IndexedDB Storage</span>
          </div>
          <button
            onClick={handleClearCache}
            className="px-2.5 py-1 rounded bg-[#191e24] hover:bg-red-950/40 border border-[#272d34] hover:border-red-800/60 text-[#9299a3] hover:text-red-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Cache</span>
          </button>
        </div>
        <p className="text-[10px] text-[#656d77]">
          Removes locally cached piece chunks and completed files from the browser database.
        </p>
      </div>
    </div>
  );
};
