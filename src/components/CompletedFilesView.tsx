import React, { useState } from 'react';
import {
  FolderCheck,
  Download,
  ShieldCheck,
  FileText,
  Clock,
  Trash2,
  Share2,
  Copy,
  Check,
  Filter,
  CheckCircle2,
} from 'lucide-react';
import { StoredCompletedFile, storage } from '../lib/storage';
import { formatBytes } from '../lib/crypto';
import { DEFAULT_PIECE_SIZE } from '../swarm/TorrentEngine';
import { LocalTorrent } from '../types';

interface CompletedFilesViewProps {
  files: StoredCompletedFile[];
  torrents?: LocalTorrent[];
  onRefresh: () => void;
  onReSeed?: (file: StoredCompletedFile) => void;
}

export const CompletedFilesView: React.FC<CompletedFilesViewProps> = ({
  files,
  torrents = [],
  onRefresh,
  onReSeed,
}) => {
  const [filter, setFilter] = useState<'all' | 'completed' | 'seeded' | 'downloading'>('all');
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const handleDownload = (file: StoredCompletedFile) => {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    setTimeout(() => setCopiedHash(null), 1800);
  };

  const handleDelete = async (fileId: string) => {
    if (confirm('Delete this file from browser storage?')) {
      await storage.deleteCompletedFile(fileId);
      await storage.deleteTorrentState(fileId);
      onRefresh();
    }
  };

  return (
    <div className="space-y-4 font-mono select-none text-xs">
      {/* Top Filter & Counter */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#070b14] p-3 rounded-xl border border-slate-800/80">
        <div className="flex items-center gap-2">
          <FolderCheck className="w-4 h-4 text-purple-400" />
          <h3 className="font-bold uppercase tracking-wider text-slate-200">
            Files Manager ({files.length} Completed)
          </h3>
        </div>

        {/* Filter categories as specified */}
        <div className="flex items-center gap-1.5 bg-slate-900 px-2 py-1 rounded border border-slate-800 text-[11px]">
          <Filter className="w-3 h-3 text-slate-500" />
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              filter === 'all' ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-700/50' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Files
          </button>
          <button
            onClick={() => setFilter('completed')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              filter === 'completed' ? 'bg-emerald-950 text-emerald-300 font-bold border border-emerald-700/50' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Completed
          </button>
          <button
            onClick={() => setFilter('seeded')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              filter === 'seeded' ? 'bg-purple-950 text-purple-300 font-bold border border-purple-700/50' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Seeded
          </button>
        </div>
      </div>

      {files.length === 0 ? (
        <div className="p-8 text-center bg-[#070b14] rounded-xl border border-slate-800/80 text-slate-400 space-y-2">
          <FolderCheck className="w-9 h-9 text-slate-600 mx-auto mb-1 opacity-60" />
          <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">No Completed Files Yet</p>
          <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
            Files downloaded across the P2P swarm and validated against their expected SHA-256 hash manifest automatically appear here for offline saving.
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {files.map((file) => {
            const pieceCount = Math.ceil(file.fileSize / DEFAULT_PIECE_SIZE) || 1;
            const completedDate = new Date(file.completedAt).toLocaleString();

            return (
              <div
                key={file.fileId}
                className="p-3.5 rounded-xl bg-[#070b14] border border-slate-800/90 hover:border-cyan-500/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-md"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2.5 rounded-lg bg-purple-950/40 border border-purple-800/40 text-purple-400 flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-white text-sm truncate max-w-sm sm:max-w-md">
                        {file.fileName}
                      </h4>
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px]">
                        {formatBytes(file.fileSize)}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-800/60 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        SHA-256 VERIFIED
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span>Pieces: <strong className="text-slate-200">{pieceCount}</strong> ({formatBytes(DEFAULT_PIECE_SIZE)}/ea)</span>
                      <span>•</span>
                      <span>Completed: <strong className="text-slate-200">{completedDate}</strong></span>
                      <span>•</span>
                      <span>Source: <strong className="text-cyan-300">P2P Swarm</strong></span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pt-0.5 truncate">
                      <span className="uppercase font-semibold">SHA-256:</span>
                      <code className="text-slate-400 truncate">{file.overallSha256}</code>
                      <button
                        onClick={() => copyHash(file.overallSha256)}
                        className="text-slate-500 hover:text-cyan-300 p-0.5"
                        title="Copy SHA-256"
                      >
                        {copiedHash === file.overallSha256 ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Actions: Save File (enabled only because integrity check passed) */}
                <div className="flex items-center gap-2 flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
                  <button
                    onClick={() => handleDownload(file)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold flex items-center gap-1.5 transition-all shadow-[0_0_10px_rgba(16,185,129,0.3)] cursor-pointer"
                    title="Save verified file to local drive"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>SAVE FILE</span>
                  </button>

                  <button
                    onClick={() => handleDelete(file.fileId)}
                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                    title="Delete cached file from browser IndexedDB"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
