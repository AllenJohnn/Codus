# Codus — Real-Time Collaborative Coding for VS Code

> **Pair program instantly. No account. No setup. Just a 4-digit code.**

Share a room code with your teammate → both editors sync live in seconds.  
Built on [Yjs](https://github.com/yjs/yjs) CRDTs and Socket.IO — the same real-time stack powering tools like Linear and Notion.

---

## What You Get

| | |
|---|---|
| **Live code sync** | Every keystroke appears instantly for every user in the room |
| **Remote cursors** | See collaborators' cursors in real time, colour-coded by user |
| **Follow mode** | Click a user to auto-scroll and follow their cursor as they move |
| **File awareness** | See which file each user is editing; one click to switch to it |
| **Sidebar chat** | Send messages, paste selections, share fenced code blocks |
| **Read-only mode** | Host can lock the room — great for demos and code review |
| **Deep-link joins** | Share one URL that opens VS Code and joins the room directly |
| **No account needed** | Works immediately via the shared hosted server |

---

## Getting Started

**1.** Open the **Codus** panel in the Activity Bar (look for the sidebar icon after installing)

**2.** Enter your display name and click **Create Room**

**3.** Share the 4-digit code — or click **Copy Link** for a one-click join URL

**4.** Your collaborator opens Codus, enters the code, clicks **Join**

Both editors are now synced. Start typing.

---

## Commands

| Command | What it does |
|---|---|
| `Codus: Create Room` | Start a room and become the host |
| `Codus: Join Room` | Join a room with a 4-digit code |
| `Codus: Leave Room` | Disconnect from the current room |
| `Codus: Connection Diagnostics` | Test connectivity to the server |

Access all commands via the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`).

---

## Settings

| Setting | Default | Description |
|---|---|---|
| `codus.serverUrl` | `https://codus.onrender.com` | Collaboration server URL. Point this at your own server for a private deployment. |

---

## Requirements

- VS Code **1.88.0** or newer
- Internet connection (or a self-hosted server on your local network)

---

## Free Shared Server

Codus connects to `https://codus.onrender.com` out of the box — free, no sign-up.

> **Heads up:** The shared server runs on Render's free tier and cold-starts in **20–30 seconds** after inactivity. If your first connection times out, wait a moment and retry. Run `Codus: Connection Diagnostics` to confirm the server is up.

---

## Self-Hosting

Want a private, always-on server for your team? Run your own in minutes.

**Requires:** Node.js 18+

```bash
git clone https://github.com/AllenJohnn/Codus.git
cd Codus && npm install
npm run start -w server          # starts on port 3000
PORT=8080 npm run start -w server  # or pick your own port
```

Then in VS Code Settings, set `codus.serverUrl` to `http://your-server:3000`.

The server exposes `GET /health → { "ok": true }` for uptime monitoring.

---

## How It Works

Each room holds a **Yjs shared document** on the server. When you type, your editor produces a compact binary delta — not a full document diff — which the server applies and broadcasts to all other users. Yjs CRDTs guarantee that concurrent edits from different users always merge to the same result, with no conflicts and no data loss.

Rooms are ephemeral: they live in server memory and are destroyed when the last user leaves.

---

## Known Limitations

- **No persistence** — rooms reset if the server restarts. Users must rejoin.
- **One file at a time** — the session syncs the active file. Switching tabs re-binds sync to the new file.
- **No authentication** — anyone with the room code can join. Don't share sensitive code on the public server; self-host instead.

---

## Changelog

### 0.5.0 — Latest
- Updated Codus extension icon artwork
- Chat now sends on Enter, with Shift+Enter preserved for multiline messages
- Removed room link and chat insert helper buttons for a cleaner sidebar flow
- Reduced reconnect noise by removing repeated reconnect system messages
- Hardened sync binding behavior to prevent unintended cross-file data replacement

### 0.4.2
- New black-and-white sidebar UI with cleaner spacing and stronger visual hierarchy
- Shared extension/server type definitions extracted to a single source of truth
- Reconnect and room snapshot state handling hardened for stability
- Improved sync safety to avoid accidental cross-file overwrite scenarios
- Added ESLint and Prettier tooling for extension and server packages

### 0.3.0
- Free hosted server at `https://codus.onrender.com` — zero local setup
- `Codus: Connection Diagnostics` command
- Fixed WebSocket + polling transport mismatch (works across firewalls and proxies)
- Fixed multi-file sync (active file re-binds correctly on tab switch)
- Fixed echo deduplication memory leak (TTL-based cleanup)
- Socket cleanup on extension deactivation
- Chat message size capped at 1 000 characters
- Room ID normalisation fix (prevents join failures)

### 0.2.0
- Configurable `codus.serverUrl` setting
- Auto-reconnect with automatic room rejoin
- Read-only room mode
- Deep-link room joining and shareable links
- File awareness, follow mode, remote cursors

### 0.1.2
- Initial release: rooms, live Yjs sync, cursor decorations, sidebar chat

---

## Contributing & Issues

[github.com/AllenJohnn/Codus](https://github.com/AllenJohnn/Codus) — issues and PRs welcome.

---

*MIT License — © 2026 Allen John*