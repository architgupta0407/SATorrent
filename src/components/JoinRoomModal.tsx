import React, { useState } from 'react';
import { LogIn, PlusCircle, X, Radio, AlertCircle, Users } from 'lucide-react';

interface JoinRoomModalProps {
  isOpen: boolean;
  initialMode: 'join' | 'create';
  onClose: () => void;
  onJoinRoom: (code: string) => void;
  onCreateRoom: (customCode?: string, maxPeers?: number) => void;
}

export const JoinRoomModal: React.FC<JoinRoomModalProps> = ({
  isOpen,
  initialMode,
  onClose,
  onJoinRoom,
  onCreateRoom,
}) => {
  const [mode, setMode] = useState<'join' | 'create'>(initialMode);
  const [roomCode, setRoomCode] = useState('');
  const [maxPeers, setMaxPeers] = useState(8);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (mode === 'join') {
      const code = roomCode.trim().toUpperCase();
      if (!code) {
        setErrorMsg('Please enter a valid 6-character room code.');
        return;
      }
      onJoinRoom(code);
      onClose();
    } else {
      const customCode = roomCode.trim().toUpperCase() || undefined;
      onCreateRoom(customCode, maxPeers);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-sm bg-[#070b14] border border-cyan-500/40 rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.25)] overflow-hidden font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#090e1b]">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-white uppercase tracking-wider text-xs">
              {mode === 'join' ? 'JOIN SWARM ROOM' : 'CREATE SWARM ROOM'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="grid grid-cols-2 p-1 mx-4 mt-3 bg-slate-900 rounded-md border border-slate-800 text-[11px] font-semibold">
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`py-1 rounded transition-all cursor-pointer ${
              mode === 'join'
                ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-700/50 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Join Room
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`py-1 rounded transition-all cursor-pointer ${
              mode === 'create'
                ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-700/50 shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Create Room
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          {mode === 'join' ? (
            <div className="space-y-1">
              <label className="text-slate-300 font-semibold text-[11px]">Room Code:</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                maxLength={8}
                autoFocus
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded text-center text-sm font-mono tracking-widest text-cyan-300 uppercase outline-none"
              />
              <p className="text-[10px] text-slate-500 pt-0.5">
                Obtain the 6-character room code from any connected peer in the swarm.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-slate-300 font-semibold text-[11px]">
                  Custom Room Code (Optional):
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Auto-generated if blank"
                  maxLength={8}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded text-sm font-mono tracking-wider text-cyan-300 uppercase outline-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300 font-semibold">Max Room Peers:</span>
                  <span className="text-cyan-300 font-bold">{maxPeers} peers</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="8"
                  value={maxPeers}
                  onChange={(e) => setMaxPeers(parseInt(e.target.value, 10))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-500">
                  <span>2 peers</span>
                  <span>5 peers</span>
                  <span>8 peers (Mesh cap)</span>
                </div>
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-2 rounded bg-red-950/60 border border-red-500/40 text-red-300 text-[10px] flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white rounded font-bold tracking-wide transition-all shadow-[0_0_10px_rgba(6,182,212,0.3)] cursor-pointer"
            >
              {mode === 'join' ? 'JOIN SWARM' : 'CREATE ROOM'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
