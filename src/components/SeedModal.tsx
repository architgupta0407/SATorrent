import React, { useState, useRef } from 'react';
import {
  Upload,
  X,
  FileText,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Layers,
  ShieldCheck,
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
      setErrorMsg(`File exceeds the 250 MB safety limit (${formatBytes(file.size)}).`);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none">
      <div className="w-full max-w-md bg-[#070b14] border border-cyan-500/40 rounded-xl shadow-[0_0_30px_rgba(6,182,212,0.25)] overflow-hidden font-mono text-xs">
        {/* Modal Window Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#090e1b]">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-cyan-400" />
            <h3 className="font-bold text-white uppercase tracking-wider text-xs">
              SEED A FILE
            </h3>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-4 space-y-4">
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => e.target.files && handleFile(e.target.files[0])}
            className="hidden"
          />

          {!selectedFile ? (
            /* Drag & Drop Zone */
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`p-6 border-2 border-dashed rounded-xl flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-cyan-400 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.2)]'
                  : 'border-slate-800 hover:border-cyan-500/50 bg-slate-900/40'
              }`}
            >
              <div className="p-3 rounded-full bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 mb-2">
                <FolderOpen className="w-6 h-6" />
              </div>
              <p className="font-bold text-white text-xs">Drag file here</p>
              <p className="text-slate-500 text-[11px] my-1">or</p>
              <span className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded font-semibold text-[11px] transition-colors border border-slate-700">
                Browse files
              </span>
              <p className="text-[10px] text-slate-500 mt-3">
                Max 250 MB • Auto-split into 64 KB pieces
              </p>
            </div>
          ) : (
            /* File Metadata Preview */
            <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <span className="font-bold text-white truncate max-w-[220px]">
                    {selectedFile.name}
                  </span>
                </div>
                {!isProcessing && (
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="text-slate-500 hover:text-red-400 text-[10px] underline cursor-pointer"
                  >
                    Change
                  </button>
                )}
              </div>

              {/* Technical Spec Breakdown */}
              <div className="grid grid-cols-3 gap-2 text-[11px] pt-2 border-t border-slate-800/80">
                <div>
                  <span className="text-slate-500">Size:</span>
                  <div className="font-bold text-slate-200 mt-0.5">{formatBytes(selectedFile.size)}</div>
                </div>
                <div>
                  <span className="text-slate-500">Piece Count:</span>
                  <div className="font-bold text-cyan-300 mt-0.5">{pieceCount} pieces</div>
                </div>
                <div>
                  <span className="text-slate-500">Piece Size:</span>
                  <div className="font-bold text-slate-200 mt-0.5">{formatBytes(DEFAULT_PIECE_SIZE)}</div>
                </div>
              </div>

              {/* Real-time SHA-256 Progress Bar */}
              {isProcessing && (
                <div className="pt-2 border-t border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-cyan-300 flex items-center gap-1.5 font-semibold">
                      <Loader2 className="w-3 h-3 animate-spin text-cyan-400" />
                      Computing SHA-256 Piece Hashes...
                    </span>
                    <span className="font-bold text-white">{hashingProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-cyan-400 transition-all duration-150"
                      style={{ width: `${hashingProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="p-2.5 rounded bg-red-950/60 border border-red-500/40 text-red-300 text-[11px] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={!selectedFile || isProcessing}
              className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold tracking-wide flex items-center gap-1.5 shadow-[0_0_12px_rgba(16,185,129,0.3)] transition-all cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>CREATING TORRENT...</span>
                </>
              ) : (
                <span>CREATE TORRENT / START SEEDING</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
