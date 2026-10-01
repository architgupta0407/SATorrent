import React, { useState } from 'react';
import { Activity, ShieldCheck, ArrowDown, ArrowUp, Radio, Network, Trash2 } from 'lucide-react';
import { DiagnosticLog } from '../swarm/TorrentEngine';

interface ActivityFeedProps {
  logs: DiagnosticLog[];
  onClear?: () => void;
  maxItems?: number;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  logs,
  onClear,
  maxItems = 12,
}) => {
  const [filter, setFilter] = useState<'all' | 'piece' | 'swarm' | 'webrtc'>('all');

  const filteredLogs = logs.filter((l) => {
    if (filter === 'all') return true;
    return l.category === filter;
  }).slice(0, maxItems);

  const getEventIcon = (log: DiagnosticLog) => {
    if (log.category === 'piece') {
      if (log.message.includes('VERIFIED') || log.message.includes('OK')) {
        return <ShieldCheck className="w-3 h-3 text-emerald-400 flex-shrink-0" />;
      }
      if (log.message.includes('REQUEST')) {
        return <ArrowDown className="w-3 h-3 text-purple-400 flex-shrink-0" />;
      }
      return <ArrowUp className="w-3 h-3 text-cyan-400 flex-shrink-0" />;
    }
    if (log.category === 'webrtc') {
      return <Network className="w-3 h-3 text-sky-400 flex-shrink-0" />;
    }
    if (log.category === 'signaling') {
      return <Radio className="w-3 h-3 text-amber-400 flex-shrink-0" />;
    }
    return <Activity className="w-3 h-3 text-slate-400 flex-shrink-0" />;
  };

  return (
    <div className="rounded-xl border border-slate-800/80 bg-[#070b14] overflow-hidden flex flex-col font-mono text-xs">
      {/* Feed Header */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-900/60 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-[11px] uppercase tracking-wider text-slate-200">
            Real-Time Activity Feed
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 text-[10px]">
            <button
              onClick={() => setFilter('all')}
              className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                filter === 'all'
                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/50'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('piece')}
              className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                filter === 'piece'
                  ? 'bg-purple-950 text-purple-300 border border-purple-700/50'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Pieces
            </button>
            <button
              onClick={() => setFilter('swarm')}
              className={`px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                filter === 'swarm'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/50'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              Swarm
            </button>
          </div>

          {onClear && (
            <button
              onClick={onClear}
              className="p-1 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              title="Clear feed"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Feed List */}
      <div className="p-2 space-y-1 max-h-56 overflow-y-auto divide-y divide-slate-800/40">
        {filteredLogs.length === 0 ? (
          <div className="py-6 text-center text-slate-500 text-[11px] italic">
            Listening for swarm and WebRTC events...
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="pt-1.5 pb-1 first:pt-0.5 flex items-center justify-between gap-2 text-[11px] hover:bg-slate-900/40 px-1.5 rounded transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                {getEventIcon(log)}
                <span className="text-slate-300 truncate max-w-sm sm:max-w-md">
                  {log.message}
                </span>
              </div>
              <span className="text-[10px] text-slate-500 flex-shrink-0 font-mono">
                {log.time}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
