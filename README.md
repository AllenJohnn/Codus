# Codus

Codus is a room-based collaborative coding extension for VS Code with a shared hosted server and Yjs-powered real-time sync.

## Repository Layout

- `extension/` - VS Code extension source, webview UI, and packaging config
- `server/` - Socket.IO collaboration server
- `scripts/` - integrity and packaging helpers

## Current Release

- Extension version: `0.3.0`
- Default server: `https://codus.onrender.com`
- Latest packaged artifact: `extension/codus-0.3.0.vsix`

## Working Features

- Create or join rooms with a 4-digit code
- Live code sync with Yjs and Socket.IO
- Remote cursors and room presence
- Sidebar chat and read-only mode
- Deep-link room joins across systems

## Build

From the repository root:

1. `npm install`
2. `npm run build`
3. `npm run package -w extension`

## Notes

- The shared server is the default, so local server setup is optional.
- Local development still works by pointing `codus.serverUrl` at `http://127.0.0.1:3000`.
- Rooms are in-memory on the server and are cleared when the server restarts.
