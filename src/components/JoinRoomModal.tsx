import React, { useState } from 'react';
import { X, AlertCircle } from 'lucide-react';

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
        setErrorMsg('Please enter a room code.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 select-none">
      <div className="w-full max-w-xs bg-[#15191e] border border-[#272d34] rounded shadow-lg overflow-hidden text-xs">
        {/* Title bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#272d34] bg-[#111418]">
          <span className="font-semibold text-[#e7eaee]">
            {mode === 'join' ? 'Join Room' : 'Create Room'}
          </span>
          <button
            onClick={onClose}
            className="text-[#656d77] hover:text-[#e7eaee] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-[#272d34] bg-[#111418] text-[11px]">
          <button
            type="button"
            onClick={() => setMode('join')}
            className={`flex-1 py-1.5 font-medium transition-colors cursor-pointer text-center ${
              mode === 'join'
                ? 'text-[#e7eaee] border-b-2 border-b-blue-500 bg-[#15191e]'
                : 'text-[#656d77] hover:text-[#9299a3]'
            }`}
          >
            Join Room
          </button>
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`flex-1 py-1.5 font-medium transition-colors cursor-pointer text-center ${
              mode === 'create'
                ? 'text-[#e7eaee] border-b-2 border-b-blue-500 bg-[#15191e]'
                : 'text-[#656d77] hover:text-[#9299a3]'
            }`}
          >
            Create Room
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-3.5 space-y-3">
          {mode === 'join' ? (
            <div className="space-y-1">
              <label className="text-[#9299a3] text-[11px]">Room Code</label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. ABC123"
                maxLength={8}
                autoFocus
                className="w-full px-2.5 py-1.5 bg-[#111418] border border-[#272d34] focus:border-blue-500 rounded text-center text-sm font-mono tracking-wider text-[#e7eaee] uppercase outline-none"
              />
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="space-y-1">
                <label className="text-[#9299a3] text-[11px]">
                  Room Code (optional)
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Auto-generated"
                  maxLength={8}
                  className="w-full px-2.5 py-1.5 bg-[#111418] border border-[#272d34] focus:border-blue-500 rounded text-xs font-mono text-[#e7eaee] uppercase outline-none"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-[#9299a3]">
                  <span>Max Peers:</span>
                  <span className="font-mono text-[#e7eaee]">{maxPeers}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="8"
                  value={maxPeers}
                  onChange={(e) => setMaxPeers(parseInt(e.target.value, 10))}
                  className="w-full accent-blue-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {errorMsg && (
            <div className="p-1.5 bg-red-950/40 border border-red-800/60 rounded text-red-300 text-[10px] flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3 text-red-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#272d34]">
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 bg-[#191e24] hover:bg-[#20262e] border border-[#272d34] text-[#9299a3] hover:text-[#e7eaee] rounded text-xs transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors cursor-pointer"
            >
              {mode === 'join' ? 'Join' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
