import React, { useEffect, useRef, useState } from 'react';
import { Network, Activity, Info, X, Copy, Check, Users, Radio, ArrowDown, ArrowUp } from 'lucide-react';
import { SwarmPeer, LocalTorrent } from '../types';
import { SwarmTransferPulse } from '../swarm/TorrentEngine';
import { formatSpeed, formatBytes } from '../lib/crypto';

interface SwarmVisualizerProps {
  localPeerId: string;
  peers: Map<string, SwarmPeer>;
  activeTorrent?: LocalTorrent;
  pulses: SwarmTransferPulse[];
}

interface NodePosition {
  id: string;
  isLocal: boolean;
  x: number;
  y: number;
  radius: number;
  label: string;
  role: 'SEEDER' | 'RE-SEEDER' | 'LEECHER' | 'PEER';
  percentage: number;
  status: string;
}

export const SwarmVisualizer: React.FC<SwarmVisualizerProps> = ({
  localPeerId,
  peers,
  activeTorrent,
  pulses,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodePositionsRef = useRef<Map<string, NodePosition>>(new Map());
  const [inspectedPeer, setInspectedPeer] = useState<SwarmPeer | null>(null);
  const [copiedId, setCopiedId] = useState(false);

  const activeParticlesRef = useRef<
    Array<{
      fromId: string;
      toId: string;
      progress: number;
      speed: number;
      color: string;
    }>
  >([]);

  // Spawn animated particles along the edges ONLY when actual piece transfers/pulses occur
  useEffect(() => {
    if (pulses.length === 0) return;
    const latest = pulses[0];

    activeParticlesRef.current.push({
      fromId: latest.from,
      toId: latest.to,
      progress: 0,
      speed: 0.02,
      color: latest.from === localPeerId ? '#10b981' : '#06b6d4',
    });

    if (activeParticlesRef.current.length > 25) {
      activeParticlesRef.current.shift();
    }
  }, [pulses, localPeerId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let animId: number;

    const render = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;

      ctx.clearRect(0, 0, width, height);

      // Draw subtle background radar grid circles
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.06)';
      ctx.lineWidth = 1;
      const maxDim = Math.min(width, height);
      for (let r = 50; r <= maxDim * 0.45; r += 45) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw subtle crosshair lines
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.04)';
      ctx.moveTo(centerX, centerY - maxDim * 0.45);
      ctx.lineTo(centerX, centerY + maxDim * 0.45);
      ctx.moveTo(centerX - maxDim * 0.45, centerY);
      ctx.lineTo(centerX + maxDim * 0.45, centerY);
      ctx.stroke();

      // Calculate node positions
      const peerList = Array.from(peers.values());
      const totalPeers = peerList.length;
      const nodePositions: Map<string, NodePosition> = new Map();

      // Center Node: YOU
      let localPercent = 0;
      if (activeTorrent) {
        localPercent = Math.round(
          (activeTorrent.verifiedPieces.size / activeTorrent.manifest.pieceCount) * 100
        );
      }

      const localNode: NodePosition = {
        id: localPeerId,
        isLocal: true,
        x: centerX,
        y: centerY,
        radius: 30,
        label: 'YOU',
        role: activeTorrent?.isSeeder ? 'SEEDER' : 'LEECHER',
        percentage: localPercent,
        status: 'online',
      };
      nodePositions.set(localPeerId, localNode);

      // Surrounding Peer Nodes (arranged radially)
      const orbitRadius = maxDim * 0.36;

      peerList.forEach((peer, index) => {
        const angle = (index / Math.max(totalPeers, 1)) * Math.PI * 2 - Math.PI / 2;
        const x = centerX + Math.cos(angle) * orbitRadius;
        const y = centerY + Math.sin(angle) * orbitRadius;

        const ownedSet = (activeTorrent && peer.ownedPiecesByFile?.get(activeTorrent.manifest.fileId)) || peer.ownedPieces;
        const pieceCount = activeTorrent?.manifest.pieceCount || 1;
        const percent = Math.round((ownedSet.size / pieceCount) * 100);

        let role: 'SEEDER' | 'RE-SEEDER' | 'LEECHER' | 'PEER' = 'PEER';
        if (peer.role === 'seeder' || (activeTorrent && ownedSet.size >= pieceCount && pieceCount > 0)) {
          role = 'SEEDER';
        } else if (ownedSet.size > 0 && activeTorrent && ownedSet.size < pieceCount) {
          role = 'RE-SEEDER';
        } else if (peer.role === 'leecher' || (activeTorrent && ownedSet.size === 0)) {
          role = 'LEECHER';
        }

        nodePositions.set(peer.peerId, {
          id: peer.peerId,
          isLocal: false,
          x,
          y,
          radius: 24,
          label: peer.peerId.slice(-6),
          role,
          percentage: percent,
          status: peer.dataChannelState === 'open' ? 'connected' : 'connecting',
        });
      });

      nodePositionsRef.current = nodePositions;

      // 1. Draw WebRTC mesh edges only between REAL connected peers
      peerList.forEach((peer) => {
        const targetNode = nodePositions.get(peer.peerId);
        if (!targetNode) return;

        const isOpen = peer.dataChannelState === 'open';

        ctx.beginPath();
        ctx.moveTo(localNode.x, localNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);

        if (isOpen) {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
          ctx.lineWidth = 1.5;
          ctx.setLineDash([]);
        } else {
          ctx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // 2. Draw animated small particles along connections ONLY during real transfers
      const activeParticles = activeParticlesRef.current;
      for (let i = activeParticles.length - 1; i >= 0; i--) {
        const p = activeParticles[i];
        p.progress += p.speed;

        const fromNode = nodePositions.get(p.fromId);
        const toNode = nodePositions.get(p.toId);

        if (fromNode && toNode && p.progress <= 1) {
          const px = fromNode.x + (toNode.x - fromNode.x) * p.progress;
          const py = fromNode.y + (toNode.y - fromNode.y) * p.progress;

          ctx.beginPath();
          ctx.arc(px, py, 3.5, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 8;
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (p.progress > 1) {
          activeParticles.splice(i, 1);
        }
      }

      // 3. Render Nodes
      nodePositions.forEach((node) => {
        // Outer Glow Ring
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius + 3, 0, Math.PI * 2);
        if (node.isLocal) {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.9)';
          ctx.shadowColor = 'rgba(6, 182, 212, 0.5)';
          ctx.shadowBlur = 10;
        } else if (node.role === 'SEEDER') {
          ctx.strokeStyle = 'rgba(16, 185, 129, 0.9)';
          ctx.shadowColor = 'rgba(16, 185, 129, 0.5)';
          ctx.shadowBlur = 8;
        } else if (node.role === 'RE-SEEDER') {
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.9)';
          ctx.shadowColor = 'rgba(6, 182, 212, 0.5)';
          ctx.shadowBlur = 8;
        } else {
          ctx.strokeStyle = 'rgba(168, 85, 247, 0.8)';
          ctx.shadowColor = 'rgba(168, 85, 247, 0.4)';
          ctx.shadowBlur = 6;
        }
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Inner Circle Background
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = node.isLocal ? '#091c2c' : '#080d19';
        ctx.fill();

        // Node Label
        ctx.font = node.isLocal ? 'bold 11px monospace' : 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(node.label, node.x, node.y - 4);

        // Node % or Role Subtext
        ctx.font = '8px monospace';
        ctx.fillStyle =
          node.role === 'SEEDER'
            ? '#34d399'
            : node.role === 'RE-SEEDER'
            ? '#22d3ee'
            : '#c084fc';
        ctx.fillText(`${node.percentage}%`, node.x, node.y + 7);
      });

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [peers, localPeerId, activeTorrent]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    for (const [id, node] of nodePositionsRef.current) {
      if (!node.isLocal && Math.hypot(clickX - node.x, clickY - node.y) <= node.radius + 6) {
        const peer = peers.get(id);
        if (peer) {
          setInspectedPeer(peer);
          return;
        }
      }
    }
  };

  const copyPeerId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 1800);
  };

  return (
    <div className="space-y-3 font-mono select-none">
      {/* Top Header & Live Legend */}
      <div className="flex flex-wrap items-center justify-between text-xs bg-[#070b14] p-3 rounded-xl border border-slate-800/80 gap-3">
        <div className="flex items-center gap-2">
          <Network className="w-4 h-4 text-cyan-400" />
          <h3 className="font-bold uppercase tracking-wider text-white text-xs">
            WebRTC Mesh Swarm Network
          </h3>
          <span className="text-[10px] text-slate-500">({peers.size} active peers)</span>
        </div>

        {/* Small Live Legend as specified */}
        <div className="flex items-center gap-4 text-[10px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.6)]" />
            <span className="text-slate-300 font-semibold">YOU</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <span className="text-slate-300 font-semibold">SEEDER</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-300" />
            <span className="text-slate-300 font-semibold">RE-SEEDER</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400" />
            <span className="text-slate-300 font-semibold">LEECHER</span>
          </div>
        </div>
      </div>

      {/* Main Canvas Viewport */}
      <div className="relative rounded-xl border border-slate-800/90 bg-[#040711] overflow-hidden shadow-md flex items-center justify-center min-h-[380px]">
        <canvas
          ref={canvasRef}
          width={800}
          height={480}
          onClick={handleCanvasClick}
          className="w-full h-full max-h-[500px] cursor-crosshair"
        />

        {/* Empty Swarm State */}
        {peers.size === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none bg-black/40 backdrop-blur-xs">
            <Radio className="w-10 h-10 text-cyan-400/50 mb-2 animate-pulse" />
            <p className="text-xs font-bold text-slate-300">Awaiting Swarm Peers</p>
            <p className="text-[11px] text-slate-500 max-w-sm mt-1">
              Share the Room Code with devices on the same Wi-Fi or internet. Peers establish full mesh WebRTC DataChannels automatically.
            </p>
          </div>
        )}

        {/* Inspected Peer Information Panel */}
        {inspectedPeer && (
          <div className="absolute top-3 right-3 w-72 bg-[#090e1b]/95 border border-cyan-500/50 rounded-xl p-3.5 shadow-2xl backdrop-blur-md text-xs space-y-2.5 z-20 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="font-bold text-white uppercase text-[11px]">Peer Telemetry</span>
              </div>
              <button
                onClick={() => setInspectedPeer(null)}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Peer ID:</span>
                <button
                  onClick={() => copyPeerId(inspectedPeer.peerId)}
                  className="font-bold text-cyan-300 flex items-center gap-1 hover:underline cursor-pointer"
                >
                  <span>{inspectedPeer.peerId}</span>
                  {copiedId ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Role:</span>
                <span className="font-bold uppercase text-emerald-400">{inspectedPeer.role}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Connection:</span>
                <span className="text-slate-200">{inspectedPeer.dataChannelState} ({inspectedPeer.connectionState})</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Pieces Owned:</span>
                <span className="font-bold text-white">
                  {((activeTorrent && inspectedPeer.ownedPiecesByFile?.get(activeTorrent.manifest.fileId)) || inspectedPeer.ownedPieces).size} / {activeTorrent?.manifest.pieceCount || '—'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Completion:</span>
                <span className="text-cyan-300 font-bold">
                  {activeTorrent
                    ? Math.round(
                        (((activeTorrent && inspectedPeer.ownedPiecesByFile?.get(activeTorrent.manifest.fileId)) || inspectedPeer.ownedPieces).size /
                          activeTorrent.manifest.pieceCount) *
                          100
                      )
                    : 0}
                  %
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Download Speed:</span>
                <span className="text-sky-400">{formatSpeed(inspectedPeer.downloadSpeedBps)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Upload Speed:</span>
                <span className="text-emerald-400">{formatSpeed(inspectedPeer.uploadSpeedBps)}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Latency:</span>
                <span className="text-slate-200">{inspectedPeer.latencyMs > 0 ? `${inspectedPeer.latencyMs} ms` : '—'}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Last Activity:</span>
                <span className="text-slate-400">
                  {inspectedPeer.lastActivityTimestamp
                    ? `${Math.max(0, Math.floor((Date.now() - inspectedPeer.lastActivityTimestamp) / 1000))}s ago`
                    : 'Active'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
