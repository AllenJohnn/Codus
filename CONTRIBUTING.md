# Contributing to Codus

## Prerequisites

- Node.js 20 or newer
- npm
- VS Code 1.88 or newer

## Build

From the repository root:

```bash
cd extension
npm ci
npm run build
```

The extension build bundles `extension/src/extension.ts`, bundles the embedded server, and copies the webview HTML into `out/src/webview/index.html`.

## Development

Open the repository in VS Code and press `F5` to launch the extension host.

## Server

To run the collaboration server directly:

```bash
cd server
npm ci
npm run start
```

You can point `codus.serverUrl` at the running server from VS Code settings.

## Layout

- `extension/` contains the VS Code extension and webview UI.
- `server/` contains the Socket.IO + Express collaboration server.
- `scripts/` contains repository integrity checks and support scripts.
