# Codus

Codus is a real-time room-based collaboration extension for VS Code.

## What it does

- Create or join a room with a 4-digit code.
- Sync code changes through Yjs and Socket.IO.
- Show remote cursors and the current user list.
- Send chat messages inside the room panel.
- Toggle read-only mode as the room creator.

## Requirements

- Node.js 20 or newer.
- The Codus server running locally at the configured server URL.

## Setup

1. Install dependencies from the repository root with `npm install`.
2. Start the server with `npm run start -w server`.
3. Open the repository in VS Code and run the extension host.

The default server URL is `http://127.0.0.1:3000` and can be changed with `codus.serverUrl`.

## Commands

| Command | Description |
|---|---|
| `Codus: Create Room` | Create a new collaboration room |
| `Codus: Join Room` | Join an existing room by code |
| `Codus: Leave Room` | Leave the current room |

## Settings

| Setting | Default | Description |
|---|---|---|
| `codus.serverUrl` | `http://127.0.0.1:3000` | URL of the Codus collaboration server |

## Notes

- Room state is stored in memory on the server.
- Room codes are 4 digits.
- The extension packages only the runtime assets needed for the VSIX.

## Version history

### 0.2.1
- Refreshed release docs and packaging metadata.
- Added repository integrity checks to catch accidental bulk overwrites.
- Verified the workspace builds cleanly before packaging.

### 0.2.0
- Configurable server URL via settings.
- Join and leave notifications.
- Auto-reconnect on socket disconnect.
- File awareness, read-only mode, and remote cursor presence.
- Deep link room joining and shareable room links.

### 0.1.2
- Initial working release.
- Room create/join/leave.
- Real-time Yjs code sync.
- Cursor presence decorations.
- Sidebar webview with chat.

