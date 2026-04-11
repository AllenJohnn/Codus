


# Codus

Code together, live. Room-based real-time collaboration for VS Code.

## What is Codus?

Codus lets you share a live coding session with any VS Code user
using a simple 4-digit room code — no accounts, no cloud, no setup.
Just create a room, share the code, and code together instantly.

## Features

- Create or join a room with a 4-digit code
- Real-time code sync powered by Yjs (conflict-free editing)
- See teammates' cursors live inside your editor
- Built-in room chat with code block support
- Paste your current selection directly into chat as a fenced code block
- Works fully local — your code never touches an external server
- Sidebar panel showing room state, connected users, and chat

## How to use

1. Open the Codus panel in the VS Code sidebar
2. Enter your display name when prompted
3. Click **create room** — a 4-digit code is generated
4. Share the code with your teammate
5. They enter the code and click **join**
6. You are now synced in real time

## Requirements

- Node.js 18 or higher
- Run the Codus server locally before using the extension:

```
bash
cd server
npm install
npm run dev
```

The server runs on http://127.0.0.1:3000 by default.
You can change this in VS Code settings under `codus.serverUrl`.

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

## Room codes

Room codes are 4 digits (e.g. 7581).
Share them verbally, via chat, or use the **copy link** button
to generate a one-click `vscode://` deep link.

## Known limitations

- Room state is stored in memory on the server — restarting the server clears all rooms
- No authentication — anyone with the room code can join
- One active file synced per room at a time

## Version history

### 0.2.0
- Configurable server URL via settings
- Join/leave notifications in editor and chat
- Chat history persists across panel hide/show
- Auto-reconnect on socket disconnect
- File awareness — see which file each user is editing
- Read-only room mode (host only)
- Deep link room joining via vscode:// URI
- Shareable room link copy button
- User follow mode — click a user to follow their cursor
- UI redesign — monospace black/white terminal aesthetic
- Fixed: disconnected state now visually distinct
- Fixed: chat textarea no longer resizable
- Fixed: action buttons reorganized above composer

### 0.1.2
- Initial working release
- Room create/join/leave
- Real-time Yjs code sync
- Cursor presence decorations
- Sidebar webview with chat

