
# Hive

Real-time collaborative coding for VS Code with room-based sync, cursor presence, and chat.

## Project Structure

# Codus

Real-time collaborative coding for VS Code with room-based sync, cursor presence, and chat.


Hive/
|- extension/
|  |- src/
|  |  |- extension.ts
|  |  |- roomManager.ts
|  |  |- cursorManager.ts
|  |  \- webview/
|  |     |- panel.ts
|  |     \- index.html
|  |- package.json
|  \- tsconfig.json
|- server/
|  |- src/
|  |  \- index.ts
|  |- package.json
|  \- tsconfig.json
\- README.md

## Features

- Create room, join room, and leave room commands.
- 4-digit room IDs for easy verbal sharing.
- Sidebar webview with:
	- current room ID and copy action
	- connected user list
	- simple room chat
- Real-time text synchronization using Yjs updates over Socket.IO events.
- Remote cursor rendering with per-user colors using editor decorations.
- Status bar presence indicator:
	- format: "Room: ROOMID (N users)"
- Automatic rejoin attempt after transport reconnect.

## Requirements

- Node.js 20+
- npm 10+
- VS Code 1.88+

## Install

Run from repository root:

1. npm install
2. npm run build

## Run Server

1. cd server
2. npm run build
3. npm run start

Server runs on port 3000 by default.

Health endpoint:

- GET /health

## Run Extension

1. Open repository root in VS Code.
2. Build once from root: npm run build
3. Press F5 to launch the Extension Development Host.
4. In the new VS Code window, run command palette actions:
	 - Create Room
	 - Join Room
	 - Leave Room

## Extension Settings

- collab.serverUrl (string)
	- default: http://127.0.0.1:3000

## Event Contract

### Client to Server

- create-room
- join-room
- leave-room
- code-change
- cursor-change
- chat-message

### Server to Client

- room-snapshot
- room-state
- code-change
- cursor-change
- chat-message
- connection-state

## Development Scripts

From repository root:

- npm run build
- npm run watch
- npm run clean

From server:

- npm run build
- npm run watch
- npm run start

From extension:

- npm run build
- npm run watch
- npm run clean
