import React from 'react';
import { DiagnosticLog } from '../swarm/TorrentEngine';
import { Trash2 } from 'lucide-react';

interface ActivityFeedProps {
  logs: DiagnosticLog[];
  onClear?: () => void;
  maxItems?: number;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({
  logs,
  onClear,
  maxItems = 15,
}) => {
  const displayLogs = logs.slice(0, maxItems);

  return (
    <div className="rounded border border-[#272d34] bg-[#15191e] overflow-hidden select-none text-xs">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#111418] border-b border-[#272d34]">
        <span className="font-semibold text-[#e7eaee] text-[11px]">Network Activity Log</span>
        {onClear && (
          <button
            onClick={onClear}
            className="text-[#656d77] hover:text-[#e7eaee] transition-colors p-0.5 cursor-pointer"
            title="Clear Log"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Dense Monospace Log Rows */}
      <div className="p-2 space-y-0.5 max-h-44 overflow-y-auto font-mono text-[10px]">
        {displayLogs.length === 0 ? (
          <div className="py-4 text-center text-[#656d77] italic">
            No events logged yet.
          </div>
        ) : (
          displayLogs.map((log) => {
            const isError = log.category === 'error';
            const isPiece = log.category === 'piece';

            return (
              <div
                key={log.id}
                className="flex items-start gap-2 py-0.5 px-1 hover:bg-[#191e24] rounded-xs"
              >
                <span className="text-[#656d77] flex-shrink-0">{log.time}</span>
                <span
                  className={`flex-shrink-0 font-medium ${
                    isError
                      ? 'text-red-400'
                      : isPiece
                      ? 'text-purple-400'
                      : 'text-[#9299a3]'
                  }`}
                >
                  [{log.category.toUpperCase()}]
                </span>
                <span className="text-[#e7eaee] truncate max-w-full">
                  {log.message}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
