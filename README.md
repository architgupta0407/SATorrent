# SATorrent - Decentralized WebRTC Swarm File Sharing Platform

SATorrent is a real working peer-to-peer file sharing swarm platform inspired by BitTorrent, built with **React**, **TypeScript**, **Tailwind CSS**, and **native WebRTC DataChannels**.

It allows users to connect multiple devices in a room, split files into 64 KB pieces, distribute pieces across peers using a **BitTorrent-style Rarest-First scheduler**, re-seed acquired pieces to other peers, verify piece & full-file integrity with **SHA-256**, and reconstruct complete files locally.

---

## 🏗 Architecture & Geniuine P2P Verification

- **Zero Server File Bytes**: File bytes and piece payloads **never** touch the Node.js signaling server.
- **Signaling Server (`server.ts`)**: Handles only lightweight JSON messages for room creation, peer discovery, and WebRTC SDP offer/answer/ICE candidate routing over WebSockets (`ws`).
- **Data Transfer**: 100% direct peer-to-peer over WebRTC `RTCDataChannel` using a self-describing 64-byte binary frame (`SATO` magic bytes, piece index, payload size, file ID, and transfer ID).
- **Rarest-First Scheduling**: Peers inspect what pieces connected peers own and prioritize requesting pieces that have the fewest copies in the swarm.
- **Immediate Re-Seeding**: As soon as Peer B receives and verifies piece 1 from Peer A (the seeder), Peer B broadcasts `HAVE` to all peers in the room. Peer C can now download piece 1 directly from Peer B, demonstrating true decentralized multi-peer swarm propagation!
- **Strict Verification**: Every single 64 KB piece is validated against its expected SHA-256 hash before being marked as owned or stored. The reconstructed complete file is validated against the overall SHA-256 manifest hash before being unlocked for download.

---

## 📁 Project Structure

```
├── server.ts                    # Full-Stack Express & WebSocket Signaling Server
├── test-swarm.ts                # Automated core test suite (scheduler, hashing, framing)
├── index.html                   # Application HTML shell
├── package.json                 # Dependencies and execution scripts
├── vite.config.ts               # Vite configuration
├── metadata.json                # Project metadata
│
├── src/
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Primary SATorrent client dashboard
│   ├── index.css                # Futuristic dark theme styling & custom scrollbars
│   │
│   ├── types/
│   │   └── index.ts             # Protocol message types, FileManifest, Swarm models
│   │
│   ├── lib/
│   │   ├── crypto.ts            # Web Crypto SHA-256 hashing & ID generators
│   │   ├── protocol.ts          # 64-byte binary piece framing and unpacker
│   │   └── storage.ts           # Browser IndexedDB persistence for pieces & files
│   │
│   ├── webrtc/
│   │   └── PeerConnectionManager.ts # Deterministic polite offerer WebRTC manager
│   │
│   ├── swarm/
│   │   ├── PieceScheduler.ts    # Rarest-first scheduler with concurrency limits
│   │   └── TorrentEngine.ts     # Swarm orchestrator (signaling, seeding, re-seeding)
│   │
│   └── components/
│       ├── Header.tsx           # Brand "SA" emblem, room status, action buttons
│       ├── Sidebar.tsx          # Client navigation & Dev Console trigger
│       ├── MetricsCards.tsx     # Real-time speeds, peers online, verified pieces
│       ├── TransferView.tsx     # Active torrent details & progress bar
│       ├── PieceBitmap.tsx      # Visual piece matrix [■■■■■■■■□□] with popover
│       ├── SwarmVisualizer.tsx  # Canvas mesh topology graph with animated pulse dots
│       ├── PeerTable.tsx        # Live peer stats (DL/UL speed, pieces owned, RTT latency)
│       ├── CompletedFilesView.tsx # Downloaded & verified files with "Save File" button
│       ├── SeedModal.tsx        # Drag & drop file seeder with 250MB limit check
│       ├── JoinRoomModal.tsx    # Room creator & room code joiner
│       ├── DebugDrawer.tsx      # Collapsible RTC telemetry & live event console
│       └── SettingsView.tsx     # STUN/TURN configuration & cache manager
```

---

## 🚀 How to Run the Application

### 1. Install dependencies
```bash
npm install
```

### 2. Run the development server
```bash
npm run dev
```
The server will start on `http://localhost:3000` with WebSocket signaling available at `ws://localhost:3000/ws`.

### 3. Run automated tests
```bash
# Core logic unit tests
npx tsx test-swarm.ts

# 3-Device end-to-end acceptance scenario
npx tsx test-acceptance-scenario.ts

# 5-Device full decentralized swarm test
npx tsx test-5peer-swarm.ts
```
Tests will execute and verify:
1. Web Crypto SHA-256 computation & piece validation
2. 64-byte binary framing and zero-copy unpacking
3. Rarest-first piece scheduling & load balancing
4. Duplicate request prevention & concurrency limits (max 3/peer)
5. Peer disconnect recovery & pending piece reassignment
6. True 5-peer decentralized mesh with multi-generational leecher propagation (Device 1 ➔ Device 2, Device 1 ➔ Device 3, Device 2 ➔ Device 3, Device 2 ➔ Device 4, Device 3 ➔ Device 5)
7. Multiple active torrents seeded and downloaded simultaneously in the same room
8. Strict signaling server byte audit: 0 file bytes through the signaling server
9. End-to-end file splitting, verification, and full reconstruction with SHA-256 match

---

## 👥 How to Test with 3–5 Devices (College Demo Scenario)

### Step 1: Device 1 (The Seeder)
1. Open SATorrent in your browser (or laptop 1).
2. Click **Create Room** (or use the auto-generated 6-character room code, e.g. `ABC123`).
3. Click **Seed File** and choose a sample file (e.g., an image, PDF, or video up to 250 MB).
4. Watch the progress bar as SATorrent calculates the SHA-256 hash for every 64 KB piece and the overall file hash.
5. Device 1 will now display all pieces as **green (Verified / Seeded)**.

### Step 2: Device 2 (Leecher / Re-Seeder)
1. Open SATorrent on Device 2 (or a separate browser window / incognito tab).
2. Click **Join Room** and enter the room code `ABC123`.
3. Device 2 instantly discovers the file manifest from Device 1 via WebRTC DataChannel.
4. Device 2 begins requesting pieces from Device 1 according to the rarest-first algorithm.
5. Watch the Piece Bitmap on Device 2:
   - **Purple blocks**: in-flight downloading pieces
   - **Green blocks**: verified pieces received and validated with SHA-256
   - **Cyan blocks**: pieces available in the swarm

### Step 3: Device 3 (Leecher)
1. Open SATorrent on Device 3 and join the same room `ABC123`.
2. Notice how Device 3 establishes WebRTC mesh connections with **both** Device 1 AND Device 2!
3. The Swarm Mesh Visualizer will show connections between all peers:
   - Device 1 (Seeder)
   - Device 2 (Leecher / Re-Seeder)
   - Device 3 (Leecher)
4. Device 3 requests pieces from **Device 1 AND Device 2 simultaneously**!
   - As Device 2 receives pieces, it advertises `HAVE` to Device 3.
   - Device 3 will download some pieces directly from Device 2 rather than Device 1!
   - Animated glowing particles on the **Swarm Mesh Visualizer** show the active data flow between Device 1 ➔ Device 2, Device 1 ➔ Device 3, and Device 2 ➔ Device 3!

### Step 4: Reconstruction & Integrity Verification
1. Once Device 2 or Device 3 collects all pieces, SATorrent automatically reconstructs the full file in piece order.
2. The engine computes the final SHA-256 hash of the reconstructed file and compares it with the manifest.
3. The badge turns green: **"SHA-256 VERIFIED"**.
4. Click **Save File** to download the completed authentic file directly to your disk!

---

## 🛠 Developer Diagnostics Drawer
Click the **Dev Console** button in the bottom left to open the diagnostic drawer. It displays:
- Real-time RTCPeerConnection states (connected, checking, closed)
- RTCDataChannel states (`open`)
- In-flight request queues with active peer assignments
- RTT ping latency (ms) per peer
- Live auto-scrolling log of WebRTC and signaling events

---

## ⚠️ Notes & Limitations
- **NAT / Firewalls**: When testing between devices on completely separate networks, STUN servers (`stun.l.google.com`) are used for NAT traversal. If a symmetric NAT or strict university firewall blocks direct UDP, configure TURN credentials in the **Settings** view.
- **File Size Limit**: Configured to 250 MB for the browser demo to avoid excessive RAM usage in mobile browser tabs.
