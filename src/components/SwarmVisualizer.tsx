import React, { useEffect, useRef, useState } from 'react';
import { Network, X, Copy, Check } from 'lucide-react';
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

  const activeParticlesRef = useRef<
    Array<{
      fromId: string;
      toId: string;
      progress: number;
      speed: number;
      color: string;
    }>
  >([]);

  // Subtle transfer particle animation during real pulses
  useEffect(() => {
    if (pulses.length === 0) return;
    const latest = pulses[0];

    activeParticlesRef.current.push({
      fromId: latest.from,
      toId: latest.to,
      progress: 0,
      speed: 0.02,
      color: latest.from === localPeerId ? '#10b981' : '#3b82f6',
    });

    if (activeParticlesRef.current.length > 20) {
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

      // Subtle background grid (technical, no glow)
      ctx.strokeStyle = '#1b2027';
      ctx.lineWidth = 1;
      const maxDim = Math.min(width, height);
      for (let r = 50; r <= maxDim * 0.45; r += 50) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, r, 0, Math.PI * 2);
        ctx.stroke();
      }

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
        radius: 18,
        label: 'YOU',
        role: activeTorrent?.isSeeder ? 'SEEDER' : 'LEECHER',
        percentage: localPercent,
      };
      nodePositions.set(localPeerId, localNode);

      // Surrounding Nodes
      const orbitRadius = maxDim * 0.35;

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
          radius: 14,
          label: peer.peerId.slice(-4),
          role,
          percentage: percent,
        });
      });

      nodePositionsRef.current = nodePositions;

      // 1. Thin gray connection lines (technical)
      peerList.forEach((peer) => {
        const targetNode = nodePositions.get(peer.peerId);
        if (!targetNode) return;

        const isOpen = peer.dataChannelState === 'open';

        ctx.beginPath();
        ctx.moveTo(localNode.x, localNode.y);
        ctx.lineTo(targetNode.x, targetNode.y);
        ctx.strokeStyle = isOpen ? '#374151' : '#272d34';
        ctx.lineWidth = 1;
        ctx.setLineDash(isOpen ? [] : [3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // 2. Subtle particles during transfer
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
          ctx.arc(px, py, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();
        } else if (p.progress > 1) {
          activeParticles.splice(i, 1);
        }
      }

      // 3. Render Nodes (clean solid circles with thin border, NO neon glow)
      nodePositions.forEach((node) => {
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);

        if (node.isLocal) {
          ctx.fillStyle = '#1e3a5f';
          ctx.strokeStyle = '#3b82f6';
        } else if (node.role === 'SEEDER') {
          ctx.fillStyle = '#064e3b';
          ctx.strokeStyle = '#10b981';
        } else if (node.role === 'RE-SEEDER') {
          ctx.fillStyle = '#1e3a5f';
          ctx.strokeStyle = '#60a5fa';
        } else {
          ctx.fillStyle = '#2e1065';
          ctx.strokeStyle = '#a855f7';
        }

        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();

        // Node Label
        ctx.font = node.isLocal ? 'bold 10px monospace' : '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(node.label, node.x, node.y);
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
      if (!node.isLocal && Math.hypot(clickX - node.x, clickY - node.y) <= node.radius + 4) {
        const peer = peers.get(id);
        if (peer) {
          setInspectedPeer(peer);
          return;
        }
      }
    }
  };

  return (
    <div className="space-y-2 select-none text-xs">
      {/* Top Header & Legend */}
      <div className="flex flex-wrap items-center justify-between text-[11px] bg-[#15191e] px-3 py-2 rounded border border-[#272d34] gap-2">
        <div className="flex items-center gap-2">
          <Network className="w-3.5 h-3.5 text-[#656d77]" />
          <span className="font-semibold text-[#e7eaee]">Swarm Mesh</span>
          <span className="text-[#656d77]">({peers.size} connected)</span>
        </div>

        {/* Technical Legend */}
        <div className="flex items-center gap-3 text-[#9299a3]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            <span>YOU</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            <span>SEEDER</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
            <span>RE-SEEDER</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
            <span>LEECHER</span>
          </span>
        </div>
      </div>

      {/* Canvas Viewport (clean dark background, thin border) */}
      <div className="relative rounded border border-[#272d34] bg-[#0d0f12] overflow-hidden flex items-center justify-center min-h-[320px]">
        <canvas
          ref={canvasRef}
          width={650}
          height={380}
          onClick={handleCanvasClick}
          className="w-full h-full max-h-[420px] cursor-crosshair"
        />

        {peers.size === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center pointer-events-none text-xs text-[#656d77]">
            <p className="font-medium text-[#9299a3]">No Swarm Peers Connected</p>
            <p className="text-[11px] mt-0.5">Share room code to establish peer mesh.</p>
          </div>
        )}

        {/* Small Technical Peer Info Slideout */}
        {inspectedPeer && (
          <div className="absolute top-2 right-2 w-64 bg-[#15191e] border border-[#272d34] rounded p-3 text-xs space-y-1.5 shadow-md">
            <div className="flex items-center justify-between border-b border-[#272d34] pb-1.5">
              <span className="font-semibold text-[#e7eaee]">Peer Info</span>
              <button
                onClick={() => setInspectedPeer(null)}
                className="text-[#656d77] hover:text-[#e7eaee] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[#656d77]">Peer ID:</span>
                <span className="font-mono text-[#e7eaee]">{inspectedPeer.peerId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#656d77]">Role:</span>
                <span className="font-semibold text-emerald-400">{inspectedPeer.role}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#656d77]">Channel:</span>
                <span className="text-[#e7eaee]">{inspectedPeer.dataChannelState}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#656d77]">Down Speed:</span>
                <span className="font-mono text-blue-400">{formatSpeed(inspectedPeer.downloadSpeedBps)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#656d77]">Up Speed:</span>
                <span className="font-mono text-emerald-400">{formatSpeed(inspectedPeer.uploadSpeedBps)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#656d77]">Latency:</span>
                <span className="font-mono text-[#e7eaee]">{inspectedPeer.latencyMs > 0 ? `${inspectedPeer.latencyMs} ms` : '—'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
