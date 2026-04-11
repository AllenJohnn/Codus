# Collaborative Code Sharing (Extension)

VS Code extension for room-based real-time collaboration with shared edits, cursors, and chat.

## Features

- Create, join, and leave collaboration rooms.
- Required user display name when creating or joining rooms.
- Sidebar collaboration panel with:
	- current room state
	- connected users
	- code-oriented chat
- Real-time code sync using Yjs updates over Socket.IO.
- Remote cursor rendering in active editor.
- Chat UX for coding collaboration:
	- multiline composer
	- Alt+Enter to send
	- insert code-block helper
	- paste editor selection into chat
	- per-code-block copy button

## Configuration

- `collab.serverUrl` (default: `http://127.0.0.1:3000`)

## Commands

- `collab.createRoom`
- `collab.joinRoom`
- `collab.leaveRoom`

## Development

From `extension/`:

1. `npm install`
2. `npm run build`
3. Press `F5` in VS Code to launch Extension Development Host.

## Packaging

- `npm run package`

