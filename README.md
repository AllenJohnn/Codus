
# Codus

Codus is a room-based VS Code collaboration workspace with a local extension and a Socket.IO/Yjs server.

## Layout

- `extension/` contains the VS Code extension and webview UI.
- `server/` contains the collaboration server.
- `scripts/verify-integrity.js` guards against accidental bulk overwrites of tracked source files.

## Requirements

- Node.js 20+
- npm 10+
- VS Code 1.88+

## Getting Started

1. Run `npm install` from the repository root.
2. Run `npm run build` to verify the extension and server compile cleanly.
3. Run `npm run start -w server` to start the collaboration server.
4. Open the repository in VS Code and press `F5` to launch the extension development host.

## Commands

- `npm run build` - build the extension and server.
- `npm run verify` - run the repository integrity check.
- `npm run watch` - watch both workspaces.
- `npm run clean` - remove generated build output.
- `npm run package -w extension` - create the VSIX package from the extension workspace.

## Configuration

- `codus.serverUrl` points the extension at the collaboration server.

## Notes

- Room state is kept in memory on the server.
- Room codes are 4 digits.
- The extension packages only the files required for the VSIX.
