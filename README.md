# Codus — Real-Time Collaborative Coding for VS Code

**Codus** lets you and your teammates edit the same file together, live — no account, no setup, just a 4-digit room code.

---

## Features

- **Instant rooms** — create a room in one click and share the 4-digit code or a deep link
- **Live code sync** — edits appear in real time for every user in the room, powered by [Yjs](https://github.com/yjs/yjs) CRDTs
- **Remote cursors** — see where everyone else is in the file, colour-coded per user
- **Follow mode** — lock your view to follow another user as they move through the code
- **File awareness** — see which file each collaborator is currently editing, with a prompt to switch
- **Sidebar chat** — send messages, paste selections, and share fenced code blocks without leaving VS Code
- **Read-only mode** — room creator can lock editing for all guests (great for code review or demos)
- **Deep-link joins** — share a single URL that opens VS Code and joins the room automatically
- **No account required** — works out of the box via the shared hosted server

---

## Quick Start

1. Install **Codus** from the VS Code Marketplace (or load the `.vsix` manually via **Extensions → Install from VSIX**)
2. Open the **Codus** panel in the Activity Bar (sidebar icon)
3. Enter your display name and click **Create Room** — a 4-digit code appears
4. Share the code or click **Copy Link** to send a one-click join URL
5. Your collaborator opens the Codus panel, enters the code, and clicks **Join**

Both editors are now synced. Start typing.

---

## Commands

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and search for:

| Command | Description |
|---|---|
| `Codus: Create Room` | Start a new collaboration room and become the host |
| `Codus: Join Room` | Join an existing room using a 4-digit code |
| `Codus: Leave Room` | Disconnect from the current room |
| `Codus: Connection Diagnostics` | Check connectivity to the configured Codus server |

---

## Settings

| Setting | Default | Description |
|---|---|---|
| `codus.serverUrl` | `https://codus.onrender.com` | URL of the Codus collaboration server. Change this to point at a self-hosted instance. |

---

## Requirements

- VS Code **1.88.0** or newer
- An internet connection to reach the shared server (or your own self-hosted instance)

---

## How It Works

Codus uses **Socket.IO** for real-time transport and **Yjs** conflict-free replicated data types (CRDTs) to merge concurrent edits correctly. Every keystroke is broadcast as a compact binary delta — no full-document diffs over the wire. Concurrent edits from multiple users merge automatically and deterministically; there are no manual conflict resolutions.

Rooms are identified by a 4-digit code and exist only while at least one user is connected. There is no persistent storage — room state lives in server memory and is cleared when the server restarts or the last user leaves.

---

## Shared Server

Codus ships pointing at a free hosted server: `https://codus.onrender.com`. You can create and join rooms with no local setup at all.

> **Note:** The shared server runs on Render's free tier and **cold-starts in 20–30 seconds** after a period of inactivity. If your first connection times out, wait a moment and try again. Use `Codus: Connection Diagnostics` to verify the server is reachable before filing a bug report.

---

## Self-Hosting the Server

For better reliability, offline use, or team-internal deployment, you can run your own server.

**Requirements:** Node.js 18 or newer

```bash
git clone https://github.com/AllenJohnn/Codus.git
cd Codus
npm install
npm run start -w server
```

The server starts on port `3000` by default. Override with the `PORT` environment variable:

```bash
PORT=8080 npm run start -w server
```

Then point the extension at your server:

1. Open VS Code Settings (`Ctrl+,`)
2. Search for `codus.serverUrl`
3. Set it to `http://your-server:3000`

The server exposes `GET /health` which returns `{ "ok": true }` — useful for uptime monitoring.

---

## Known Limitations

- **No room persistence** — rooms are in-memory only. If the server restarts, active rooms are lost and users must create a new one and rejoin.
- **One synced file per session** — the extension syncs whichever file is active when you join. Switching files mid-session re-binds sync to the new file, but only one file is synced at a time.
- **No authentication** — anyone with the room code can join. Do not use the public shared server for proprietary or sensitive code. Self-host if that matters to you.
- **Shared server cold-start** — the free Render instance sleeps after inactivity. First connection may take up to 30 seconds.

---

## Contributing

Issues and pull requests are welcome at [github.com/AllenJohnn/Codus](https://github.com/AllenJohnn/Codus).

To run the extension in development:

```bash
git clone https://github.com/AllenJohnn/Codus.git
cd Codus
npm install
npm run build
```

Press `F5` in VS Code to launch the Extension Development Host with the extension loaded.

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for the full version history.

### 0.3.0
- Production server deployed at `https://codus.onrender.com` — no local setup required
- Added `Codus: Connection Diagnostics` command
- Fixed WebSocket/polling transport mismatch (cross-network joins now reliable)
- Fixed multi-file sync — active file now re-binds on tab switch
- Fixed echo deduplication memory leak — now uses TTL-based cleanup
- Added socket cleanup on extension deactivation
- Added chat message size validation (max 1000 characters)
- Fixed room ID normalisation to prevent join failures

### 0.2.0
- Configurable server URL via `codus.serverUrl` setting
- Auto-reconnect with room rejoin on socket disconnect
- Read-only room mode (host can lock editing)
- Deep-link room joining and shareable room links
- File awareness and remote cursor follow mode

### 0.1.2
- Initial release: room create/join/leave, Yjs code sync, cursor decorations, sidebar chat

---

## License

MIT — see [LICENSE](LICENSE) for details.