import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown, CheckCircle2, Circle } from 'lucide-react';
import { RoomState, LocalTorrent, CollegeDemoState } from '../types';

interface CollegeDemoBadgeProps {
  roomState: RoomState | null;
  peersCount: number;
  primaryTorrent?: LocalTorrent;
  demoState: CollegeDemoState;
}

export const CollegeDemoBadge: React.FC<CollegeDemoBadgeProps> = ({
  peersCount,
  primaryTorrent,
  demoState,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const checklistItems = [
    { key: 'roomCreated', label: 'Room created', done: demoState.roomCreated },
    { key: 'peersConnected', label: 'Peers connected', done: demoState.peersConnected },
    { key: 'manifestReceived', label: 'Manifest received', done: demoState.manifestReceived },
    { key: 'piecesTransferring', label: 'Pieces transferring', done: demoState.piecesTransferring },
    { key: 'peerReSeeding', label: 'Peer re-seeding', done: demoState.peerReSeeding },
    { key: 'fileVerified', label: 'File verified (SHA-256)', done: demoState.fileVerified },
  ];

  const doneCount = checklistItems.filter((i) => i.done).length;
  const isSwarmActive = peersCount > 0 && primaryTorrent && (primaryTorrent.downloadSpeedBps > 0 || primaryTorrent.uploadSpeedBps > 0);

  return (
    <div ref={containerRef} className="relative select-none text-xs">
      {/* Status Bar Trigger Button */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-[#9299a3] hover:text-[#e7eaee] transition-colors cursor-pointer text-[11px]"
        title="College Demo Acceptance Checklist"
      >
        <span className={`w-1.5 h-1.5 rounded-full ${doneCount === 6 ? 'bg-emerald-400' : isSwarmActive ? 'bg-blue-400' : 'bg-amber-400'}`} />
        <span>Demo:</span>
        <span className="font-mono text-[#e7eaee]">{doneCount}/6</span>
        {isExpanded ? <ChevronDown className="w-3 h-3 text-[#656d77]" /> : <ChevronUp className="w-3 h-3 text-[#656d77]" />}
      </button>

      {/* Popover Menu opening upwards */}
      {isExpanded && (
        <div className="absolute bottom-full right-0 mb-1.5 w-60 bg-[#15191e] border border-[#272d34] rounded shadow-xl overflow-hidden z-50 p-2.5 space-y-2 text-[11px]">
          <div className="flex items-center justify-between pb-1 border-b border-[#272d34]">
            <span className="font-semibold text-[#e7eaee]">Demo Checklist</span>
            <span className="font-mono text-[10px] text-emerald-400">{doneCount} of 6 complete</span>
          </div>

          <div className="space-y-1.5">
            {checklistItems.map((item) => (
              <div key={item.key} className="flex items-center gap-2 text-[10px]">
                {item.done ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                ) : (
                  <Circle className="w-3.5 h-3.5 text-[#656d77] flex-shrink-0" />
                )}
                <span className={item.done ? 'text-[#e7eaee]' : 'text-[#656d77]'}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <div className="pt-1.5 border-t border-[#272d34] text-[9px] text-[#656d77]">
            Decentralized WebRTC DataChannel swarm verification.
          </div>
        </div>
      )}
    </div>
  );
};
