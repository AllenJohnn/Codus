# Codus

Codus is a real-time room-based collaboration extension for VS Code.

## What it does

- Create or join a room with a 4-digit code.
- Sync code changes through Yjs and Socket.IO.
- Show remote cursors and the current user list.
- Send chat messages inside the room panel.
- Toggle read-only mode as the room creator.

## Requirements

- VS Code 1.0 or newer.
- Internet connection (extension connects to shared Codus server).

## Quick Start

1. Install the Codus extension from the VSIX file.
2. In VS Code, use:
   - `Codus: Create Room` to start a new collaboration room
   - `Codus: Join Room` to join an existing room by 4-digit code
   - `Codus: Leave Room` to disconnect

The extension connects to the shared Codus server at `https://codus.onrender.com` by default. You can override this with the `codus.serverUrl` setting.

## Development Setup

To run the server locally for development:

1. Install dependencies: `npm install`
2. Start the server: `npm run start -w server`
3. Configure `codus.serverUrl` to `http://127.0.0.1:3000` in VS Code settings
4. Open the repository and run the extension host

## Commands

| Command | Description |
|---|---|
| `Codus: Create Room` | Create a new collaboration room |
| `Codus: Join Room` | Join an existing room by code |
| `Codus: Leave Room` | Leave the current room |

## Settings

| Setting | Default | Description |
|---|---|---|
| `codus.serverUrl` | `https://codus.onrender.com` | URL of the Codus collaboration server |

## Notes

- Room state is stored in memory on the server.
- Room codes are 4 digits.
- The extension packages only the runtime assets needed for the VSIX.

## Production Server

Codus includes a free shared server running at `https://codus.onrender.com`. You can create and join rooms without needing to set up your own server. The server:

- Automatically handles port allocation (tries ports 10000-10019 if the default is occupied)
- Validates room existence on join (returns an error if the room doesn't exist)
- Cleans up empty rooms automatically
- Provides health check endpoints (`/health` and `/`)

## Version history

### 0.3.0
- **Production server deployment**: Default server URL is now `https://codus.onrender.com`
- Added port fallback logic (server tries 20 consecutive ports on startup if default occupied)
- Added `Codus: Connection Diagnostics` command to verify server connectivity
- Enhanced multi-system join reliability (explicit error when room doesn't exist on target server)
- Improved webview visibility with better contrast, larger fonts, and clearer button states
- Server validates room existence before allowing joins (prevents silent room creation)
- Deep links now preserve server URL for seamless room joining across systems

**Breaking Changes**: 
- Default `codus.serverUrl` changed from `http://127.0.0.1:3000` to `https://codus.onrender.com`
- Local server setup no longer required for basic usage (but still supported via `codus.serverUrl` setting)
- Added CI automation for integrity checks, builds, and VSIX packaging.
- Generated a fresh VSIX release artifact for the latest fixes.

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

