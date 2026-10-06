# SATorrent

### Decentralized Peer-to-Peer Swarm File Sharing Platform

SATorrent is a BitTorrent-inspired, browser-based peer-to-peer file sharing platform built as a college project.

Instead of sending a complete file to a central server, SATorrent splits a file into 64 KB pieces and lets connected peers exchange those pieces directly over WebRTC. Verified pieces can be re-shared by other peers, creating a multi-peer swarm.

> The signaling server helps peers discover and connect to each other. The actual file data travels directly between peers.

---

## 🌐 Live Demo

### Open SATorrent directly in your browser

**https://satorrent.ai.studio/**

No installation is required for the live demo.

Open the same link on multiple devices, create or join the same room, and test the swarm.

> **Note:** Google AI Studio custom URLs use the \`*.ai.studio\` format. So the correct URL is \`satorrent.ai.studio\`, not \`satorrent.studio.ai\`.

---

## ✨ Features

- Multi-peer rooms with support for up to 8 peers in the demo
- Direct WebRTC peer-to-peer connections
- 64 KB piece-based file transfers
- BitTorrent-style rarest-first scheduling
- Leecher re-seeding and multi-hop piece propagation
- SHA-256 verification for pieces and complete files
- IndexedDB browser persistence
- Peer disconnect recovery and request reassignment
- Real-time swarm, peer and transfer telemetry
- Developer diagnostics console
- Multiple active torrents in the same room
- No file bytes sent through the signaling server

---

## 🧠 How SATorrent Works

SATorrent uses a WebRTC mesh with a lightweight WebSocket signaling server.

~~~text
                  SATorrent Signaling Server
                 room + WebRTC signaling only
                            |
            +---------------+---------------+
            |               |               |
            v               v               v
         Peer A           Peer B          Peer C
         Seeder          Leecher         Leecher
            |               |               |
            +------- direct WebRTC --------+
                    piece exchange
~~~

### Signaling Server

The Node.js server handles:

- Room creation and joining
- Peer discovery
- SDP offer/answer routing
- ICE candidate routing
- Peer join and leave notifications

It does not receive or store file bytes.

### WebRTC Mesh

Peers establish direct WebRTC connections with other peers in the room. Actual piece data is transferred through RTCDataChannel.

### Piece Scheduler

Files are divided into 64 KB pieces. The scheduler tracks:

- Missing pieces
- Pieces owned by every peer
- In-flight requests
- Piece rarity
- Per-peer request limits
- Request timeouts and retries

Rarer pieces are prioritized so the swarm can distribute data efficiently.

---

## 🔄 Swarm Re-Seeding

A key SATorrent feature is leecher-to-leecher propagation.

~~~text
Seeder A
   |
   +---- Piece 0 ----> Peer B
   |
   +---- Piece 1 ----> Peer C

Peer B verifies Piece 0
   |
   +--------------------> Peer C
~~~

Once a peer verifies a piece, it advertises that piece to the swarm and can serve it to other peers.

This allows the system to demonstrate:

~~~text
Seeder → Peer B
Seeder → Peer C
Peer B → Peer C
Peer C → Peer B
~~~

based on real piece availability.

---

## 🔐 Integrity Verification

SATorrent uses SHA-256 at two levels.

### Piece verification

Every incoming piece is:

1. Received over WebRTC
2. Hashed
3. Compared with its expected piece hash
4. Marked as owned only after verification

### Complete-file verification

After all pieces are available:

1. Pieces are reconstructed in the correct order
2. The complete file is hashed
3. The hash is compared with the manifest hash
4. Save File is enabled only after successful verification

---

## 📦 Piece Protocol

SATorrent separates control messages from binary file data.

### Control messages

- HELLO
- FILE_MANIFEST
- HAVE
- HAVE_BATCH
- PIECE_REQUEST
- PIECE_META
- PIECE_REJECT
- PING
- PONG

### Binary data

Actual file pieces are transferred as binary frames containing the metadata required to identify the file, transfer and piece.

Default piece payload size: 64 KB.

---

## 🖥️ Client Interface

SATorrent is designed as a desktop-style torrent client.

### Main views

- Overview
- Transfers
- Swarm Mesh
- Peers
- Files
- Settings
- Developer Console

### Piece map

The piece map represents real runtime state:

| State | Meaning |
|---|---|
| Green | Verified locally |
| Blue / Cyan | Available on the swarm |
| Purple | Request in flight |
| Gray | Missing |

The peer table shows peer ID, role, connection state, pieces owned, completion, download speed, upload speed and latency where available.

The swarm mesh visualizer is generated from real WebRTC peer connections.

---

## 🧪 Testing

The repository contains automated tests for the core swarm engine.

Run:

~~~bash
npx tsx test-swarm.ts
npx tsx test-acceptance-scenario.ts
npx tsx test-5peer-swarm.ts
~~~

The test coverage includes:

- SHA-256 computation
- Piece hashing and validation
- Binary frame encoding and decoding
- Rarest-first scheduling
- Duplicate request prevention
- Per-peer concurrency limits
- Peer disconnect recovery
- Request reassignment
- End-to-end file reconstruction
- 5-peer swarm behavior
- Leecher-to-leecher piece propagation
- Multiple active torrents
- Signaling-server file-byte audit

---

## 🌐 Multi-Device Demo

Use the published SATorrent URL on 3–5 physical devices:

**https://satorrent.ai.studio/**

All devices can open the same URL.

### Device 1 — Seeder

1. Open SATorrent.
2. Create a room.
3. Share the room code.
4. Seed a 5–20 MB file.

### Device 2 — Leecher / Re-Seeder

1. Open the same SATorrent URL.
2. Join the room.
3. Discover the file manifest.
4. Start downloading.
5. Watch verified pieces appear.
6. Those pieces become available for re-seeding.

### Device 3 — Swarm Peer

1. Open the same SATorrent URL.
2. Join the same room while Device 2 is still downloading.
3. Connect to the existing swarm.
4. Request pieces from multiple peers.
5. Observe pieces being sourced from Device 1 and Device 2.

The key demonstration is:

~~~text
Device 1 → Device 2
Device 1 → Device 3
Device 2 → Device 3
~~~

where Device 3 receives at least some pieces from Device 2.

### Recommended demo file

Use a file around **5–20 MB** rather than a tiny file so the piece-level swarm behavior is easy to observe.

---

## 🧱 Project Structure

~~~text
SATorrent/
├── server.ts
├── package.json
├── vite.config.ts
├── index.html
├── metadata.json
├── test-swarm.ts
├── test-acceptance-scenario.ts
├── test-5peer-swarm.ts
│
└── src/
    ├── main.tsx
    ├── App.tsx
    │
    ├── types/
    │   └── index.ts
    │
    ├── lib/
    │   ├── crypto.ts
    │   ├── protocol.ts
    │   └── storage.ts
    │
    ├── webrtc/
    │   └── PeerConnectionManager.ts
    │
    ├── swarm/
    │   ├── PieceScheduler.ts
    │   └── TorrentEngine.ts
    │
    └── components/
        ├── Header.tsx
        ├── Sidebar.tsx
        ├── MetricsCards.tsx
        ├── TransferView.tsx
        ├── PieceBitmap.tsx
        ├── SwarmVisualizer.tsx
        ├── PeerTable.tsx
        ├── CompletedFilesView.tsx
        ├── SeedModal.tsx
        ├── JoinRoomModal.tsx
        ├── DebugDrawer.tsx
        ├── ActivityFeed.tsx
        └── SettingsView.tsx
~~~

---

## 🛠 Tech Stack

**Frontend**
- React
- TypeScript
- Vite
- Tailwind CSS

**Backend**
- Node.js
- WebSocket using ws

**P2P Networking**
- WebRTC
- RTCDataChannel
- STUN / configurable TURN

**Browser APIs**
- Web Crypto API
- IndexedDB

---

## 🚀 Run Locally

The live demo is the recommended way to test SATorrent.

For development, cloning the repository is optional.

### Prerequisites

- Node.js 18+
- Modern browser with WebRTC support

### Install

~~~bash
npm install
~~~

### Start development server

~~~bash
npm run dev
~~~

For multi-device local testing, open the host machine's LAN address from the other devices rather than using \`localhost\`.

---

## ⚠️ Current Limitations

SATorrent is a college-project MVP, not a production BitTorrent client.

Current limitations include:

- Small demo room size
- Full-mesh networking becomes less efficient as peer count grows
- No DHT
- No standard public BitTorrent tracker ecosystem
- No standard .torrent / magnet-link ecosystem yet
- NAT traversal depends on STUN / TURN availability
- Browser storage and memory limits apply
- Authentication and access control are intentionally lightweight

---

## 🔮 Future Improvements

- DHT-based peer discovery
- Standard .torrent and magnet-link support
- Public tracker support
- Better TURN integration
- Persistent resume and recheck
- Selective file download
- More advanced choking and peer selection
- Desktop packaging
- Larger-scale swarm topology

---

## 🎓 College Project

**SATorrent — Smart Torrent File Sharing System**

The project demonstrates how modern browser technologies can be combined to build a decentralized file-sharing system in which peers discover one another, exchange file pieces directly, verify data cryptographically, and contribute downloaded pieces back to the swarm.

---

## 📜 License

This project is intended for educational and demonstration purposes.
