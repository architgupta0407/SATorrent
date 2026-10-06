import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  FileText,
  AlertCircle,
  Loader2,
  FolderOpen,
} from 'lucide-react';
import { formatBytes } from '../lib/crypto';
import { DEFAULT_PIECE_SIZE, MAX_FILE_SIZE } from '../swarm/TorrentEngine';

interface SeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSeedFile: (file: File, onProgress?: (pct: number) => void) => Promise<any>;
}

export const SeedModal: React.FC<SeedModalProps> = ({ isOpen, onClose, onSeedFile }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hashingProgress, setHashingProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFile = (file: File) => {
    setErrorMsg(null);
    if (file.size > MAX_FILE_SIZE) {
      setErrorMsg(`File exceeds safety limit of 250 MB (${formatBytes(file.size)}).`);
      return;
    }
    if (file.size === 0) {
      setErrorMsg('Cannot seed an empty (0 byte) file.');
      return;
    }
    setSelectedFile(file);
    setHashingProgress(0);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) return;
    setIsProcessing(true);
    setErrorMsg(null);
    setHashingProgress(0);

    try {
      await onSeedFile(selectedFile, (progress) => {
        setHashingProgress(progress);
      });
      setIsProcessing(false);
      setSelectedFile(null);
      onClose();
    } catch (err: any) {
      setIsProcessing(false);
      setErrorMsg(err.message || 'Failed to seed file');
    }
  };

  const pieceCount = selectedFile
    ? Math.ceil(selectedFile.size / DEFAULT_PIECE_SIZE)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 select-none">
      <div className="w-full max-w-md bg-[#15191e] border border-[#272d34] rounded shadow-lg overflow-hidden text-xs">
        {/* Title bar */}
        <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#272d34] bg-[#111418]">
          <span className="font-semibold text-[#e7eaee]">Seed File</span>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="text-[#656d77] hover:text-[#e7eaee] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-3.5 space-y-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && handleFile(e.target.files[0])}
            className="hidden"
          />

          {!selectedFile ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border border-dashed rounded text-center cursor-pointer transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-[#1e293b]'
                  : 'border-[#272d34] hover:border-[#3b444f] bg-[#111418]'
              }`}
            >
              <FolderOpen className="w-6 h-6 text-[#656d77] mx-auto mb-2" />
              <p className="font-medium text-[#e7eaee]">Drag file here</p>
              <p className="text-[#656d77] text-[11px] my-1">or</p>
              <button
                type="button"
                className="px-2.5 py-1 bg-[#191e24] hover:bg-[#20262e] border border-[#272d34] text-[#e7eaee] rounded text-xs transition-colors cursor-pointer"
              >
                Browse
              </button>
              <p className="text-[10px] text-[#656d77] mt-3">
                Max 250 MB • 64 KB pieces
              </p>
            </div>
          ) : (
            <div className="p-3 bg-[#111418] rounded border border-[#272d34] space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
                  <span className="font-medium text-[#e7eaee] truncate max-w-[240px]">
                    {selectedFile.name}
                  </span>
                </div>
                {!isProcessing && (
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-[#656d77] hover:text-red-400 text-[11px] cursor-pointer"
                  >
                    Change
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-[#272d34]">
                <div>
                  <span className="text-[#656d77]">Size:</span>{' '}
                  <span className="text-[#e7eaee] font-mono">{formatBytes(selectedFile.size)}</span>
                </div>
                <div>
                  <span className="text-[#656d77]">Piece count:</span>{' '}
                  <span className="text-[#e7eaee] font-mono">{pieceCount}</span>
                </div>
                <div>
                  <span className="text-[#656d77]">Piece size:</span>{' '}
                  <span className="text-[#e7eaee] font-mono">{formatBytes(DEFAULT_PIECE_SIZE)}</span>
                </div>
                <div>
                  <span className="text-[#656d77]">SHA-256:</span>{' '}
                  <span className="text-emerald-400">Ready</span>
                </div>
              </div>

              {isProcessing && (
                <div className="pt-2 border-t border-[#272d34] space-y-1">
                  <div className="flex justify-between text-[11px] text-[#9299a3]">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
                      Calculating SHA-256 piece hashes...
                    </span>
                    <span className="font-mono text-[#e7eaee]">{hashingProgress}%</span>
                  </div>
                  <div className="w-full bg-[#15191e] rounded-xs h-1.5 overflow-hidden border border-[#272d34]">
                    <div
                      className="h-full bg-blue-500 transition-all duration-150"
                      style={{ width: `${hashingProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="p-2 bg-red-950/40 border border-red-800/60 rounded text-red-300 text-[11px] flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Dialog Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#272d34]">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-3 py-1 bg-[#191e24] hover:bg-[#20262e] border border-[#272d34] text-[#9299a3] hover:text-[#e7eaee] rounded transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedFile || isProcessing}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded font-medium transition-colors cursor-pointer"
            >
              {isProcessing ? 'Hashing...' : 'Start Seeding'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
