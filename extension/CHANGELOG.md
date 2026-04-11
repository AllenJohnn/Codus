

# Codus Changelog

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
