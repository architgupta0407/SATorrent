import React, { useState } from 'react';
import {
  FolderCheck,
  Download,
  Trash2,
  Copy,
  Check,
  FileText,
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
}) => {
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
    setTimeout(() => setCopiedHash(null), 1500);
  };

  const handleDelete = async (fileId: string) => {
    if (confirm('Delete this file from local storage?')) {
      await storage.deleteCompletedFile(fileId);
      await storage.deleteTorrentState(fileId);
      onRefresh();
    }
  };

  return (
    <div className="space-y-2 select-none text-xs">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <FolderCheck className="w-4 h-4 text-[#656d77]" />
          <h3 className="font-semibold text-[#e7eaee]">
            Files ({files.length} completed)
          </h3>
        </div>
        <div className="text-[11px] text-[#656d77]">
          Saved in browser IndexedDB
        </div>
      </div>

      <div className="rounded border border-[#272d34] bg-[#15191e] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[11px]">
            <thead className="bg-[#111418] text-[#9299a3] border-b border-[#272d34] font-semibold">
              <tr>
                <th className="py-2 px-3">NAME</th>
                <th className="py-2 px-2.5">SIZE</th>
                <th className="py-2 px-2.5 font-mono">PIECES</th>
                <th className="py-2 px-2.5">STATUS</th>
                <th className="py-2 px-2.5 font-mono">SHA-256</th>
                <th className="py-2 px-2.5">COMPLETED</th>
                <th className="py-2 px-3 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f242b]">
              {files.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-[#656d77]">
                    No completed files. Files downloaded and verified will appear here for local saving.
                  </td>
                </tr>
              ) : (
                files.map((file) => {
                  const pieceCount = Math.ceil(file.fileSize / DEFAULT_PIECE_SIZE) || 1;
                  const completedDate = new Date(file.completedAt).toLocaleString();

                  return (
                    <tr
                      key={file.fileId}
                      className="hover:bg-[#191e24] transition-colors"
                    >
                      {/* Name */}
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2">
                          <FileText className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                          <span className="font-medium text-[#e7eaee] truncate max-w-[220px]" title={file.fileName}>
                            {file.fileName}
                          </span>
                        </div>
                      </td>

                      {/* Size */}
                      <td className="py-2 px-2.5 text-[#9299a3] whitespace-nowrap">
                        {formatBytes(file.fileSize)}
                      </td>

                      {/* Pieces */}
                      <td className="py-2 px-2.5 font-mono text-[#e7eaee] whitespace-nowrap">
                        {pieceCount}
                      </td>

                      {/* Status */}
                      <td className="py-2 px-2.5 whitespace-nowrap">
                        <span className="text-emerald-400 font-medium">
                          ✓ Verified
                        </span>
                      </td>

                      {/* SHA-256 */}
                      <td className="py-2 px-2.5 font-mono text-[#656d77] whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <span className="truncate max-w-[120px] text-[#9299a3]" title={file.overallSha256}>
                            {file.overallSha256.slice(0, 16)}...
                          </span>
                          <button
                            onClick={() => copyHash(file.overallSha256)}
                            className="p-0.5 text-[#656d77] hover:text-[#e7eaee] transition-colors"
                            title="Copy Hash"
                          >
                            {copiedHash === file.overallSha256 ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </td>

                      {/* Completed Date */}
                      <td className="py-2 px-2.5 text-[#9299a3] whitespace-nowrap">
                        {completedDate}
                      </td>

                      {/* Actions */}
                      <td className="py-2 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => handleDownload(file)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[10px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                            title="Save to local disk"
                          >
                            <Download className="w-3 h-3" />
                            <span>Save</span>
                          </button>

                          <button
                            onClick={() => handleDelete(file.fileId)}
                            className="p-1 text-[#656d77] hover:text-red-400 rounded transition-colors cursor-pointer"
                            title="Delete file"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
