# Codus

A real-time collaborative coding extension for VS Code with live cursors, room management, and document sync.

## Project Structure

| Folder | Purpose |
|--------|---------|
| `/extension` | VS Code extension (TypeScript) |
| `/server` | Socket.IO signaling server (Node.js + TypeScript) |
| `/shared` | Shared TypeScript types used by both extension and server |

## Local Development

### Prerequisites
- Node.js >= 22
- npm >= 10

### Setup
```bash
# 1. Build shared types
cd shared && npm install && npm run build

# 2. Start server
cd ../server && npm install && npm run dev

# 3. Open extension in VS Code
cd ../extension && npm install
# Press F5 in VS Code to launch Extension Development Host
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `ALLOWED_ORIGINS` | `*` | CORS allowed origins (comma-separated) |
| `ROOM_TOKEN_SECRET` | _(none)_ | Optional token for room auth |

## Deployment

Server is deployed on Render. See `render.yaml` for configuration.

## Extension Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `codus.serverUrl` | `http://localhost:3000` | URL of the Codus signaling server |
| `codus.roomToken` | _(none)_ | Optional room auth token |