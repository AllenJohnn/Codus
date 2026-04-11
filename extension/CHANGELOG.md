# [0.2.0] - 2026-04-11

### Changed
- Project renamed to **Codus** everywhere (extension, server, config, commands, UI, docs)
- All settings, commands, and branding now use `codus` instead of `hive` or `collab`
- Updated documentation and user-facing text for Codus




# Changelog

## [0.2.0]

### Added
- Configurable server URL via `codus.serverUrl` VS Code setting
- Join and leave notifications (editor toast + system chat message)
- Chat history persists when sidebar panel is hidden and reshown
- Auto-reconnect on unexpected socket disconnect with rejoining last room
- Reconnect banner shown in webview during reconnection attempt
- File awareness: connected users list shows which file each user is editing
- Read-only room mode toggle (room creator only)
- Deep link room joining via `vscode://codus-dev.codus/join?room=XXXX`
- Shareable room link copy button in room header
- User follow mode: click a username to follow their cursor

### Fixed
- Disconnected state is now visually distinct from connected state
- Guest name no longer shown in a floating full-width white box
- Chat textarea is fixed height with no resize handle
- Action buttons (paste selection, insert code block) moved above composer
- Keyboard shortcut hint no longer truncates
- Header square artifact removed
- Consistent section padding throughout sidebar panel
- All fonts now strictly 'Courier New' monospace with no fallback bleed

### Changed
- Extension renamed from "Collaborative Code Sharing" to "Codus"
- Room ID display enlarged and made more prominent
- UI redesigned with strict black/white monospace terminal aesthetic
- Version bumped to 0.2.0

## [0.1.2]

### Added
- Initial working release
- Room create, join, and leave commands
- Real-time code sync via Yjs + Socket.IO
- Remote cursor decorations with per-user colors
- Sidebar webview panel with room info, user list, and chat
- Status bar room indicator

All notable changes to this project are documented in this file.

## [0.1.2] - 2026-04-11

### Added
- Chat collaboration improvements for code sharing:
	- Alt+Enter send in multiline composer
	- Message separators and per-message metadata for rapid-chat readability
	- Paste active editor selection into chat as fenced code
	- Copy action for individual rendered code blocks

### Fixed
- Recovered core extension source/config files that were accidentally zeroed.
- Restored workspace manifests/config needed for stable builds.

### Changed
- Cleaned repository by removing generated VSIX/log artifacts from tracking.
- Updated ignore rules to prevent accidental recommit of generated release files.

## [0.1.1] - 2026-04-11

### Added
- Required display-name flow for room creation and joining (sidebar and commands), so users are no longer shown as generic guests by default.
- New strict black-and-white terminal-style webview redesign with compact sidebar-first layout.
- Chat composer upgraded for collaboration:
	- Multi-line input for sharing notes and code
	- Alt+Enter to send
	- Insert code-block helper
	- Per-message metadata and visual message breakers for high-volume chat
- Code-sharing enhancements in chat:
	- Paste current editor selection into the composer as fenced code
	- Copy button for each rendered code block
	- Fenced-code rendering in message history

### Changed
- Chat section behavior now prioritizes code collaboration (code snippets, separators, and readability under rapid message streams).
- Sidebar bridge expanded with extra webview actions for selection insertion and code copying while preserving existing message contracts.

### Fixed
- Create/join reliability after connection interruptions by improving socket reconnect behavior.
- Room create/join request handling with ack timeouts and clearer connection error reporting.

## [0.1.0] - 2026-04-11

### Added
- Initial release of Collaborative Code Sharing extension.
- Room lifecycle features: create room, join room, leave room, and copy room id.
- Real-time collaborative editing via Socket.IO and Yjs synchronization.
- Presence features: connected user list and remote cursor updates.
- In-room chat messaging.
- Sidebar webview panel for collaboration controls and status.
- Configurable collaboration server URL via extension settings.
