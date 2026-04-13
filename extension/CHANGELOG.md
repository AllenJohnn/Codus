# Changelog

All notable changes to this project are documented here.

## [0.3.0] - 2026-04-13

### Added
- **Production server deployment** at `https://codus.onrender.com`
- `Codus: Connection Diagnostics` command to verify server connectivity
- Port fallback logic: server automatically tries ports 10000-10019 if default occupied
- Room existence validation on join (prevents silent creation of empty rooms on wrong server)
- Server health check endpoints (`/health` and `/` status)

### Changed
- **BREAKING**: Default `codus.serverUrl` changed from `http://127.0.0.1:3000` to `https://codus.onrender.com`
- Users no longer need local server setup for basic collaboration
- Extension now detects occupied local ports and auto-updates configured server URL
- Webview visibility improved: better contrast, larger fonts, clearer button states
- Deep links now preserve server URL context for cross-system room joining

### Fixed
- Fixed file corruption issue from runaway room sync (active document locked on room join)
- Multi-system join now returns explicit error instead of creating empty rooms
- Improved error messaging for connection diagnostics

### Removed
- Requirement for local Node.js/server for standard usage

## [0.2.2] - 2026-04-13

### Added
- Repository integrity checks to catch accidental bulk overwrites of tracked source files.
- Packaging safeguards so the integrity check runs during extension builds and packaging.

### Changed
- Refreshed the root and extension READMEs to match the current workspace layout and commands.
- Bumped the extension version for the next VSIX release.

### Fixed
- Removed stale README/changelog content that no longer matched the current codebase.

## [0.2.2] - 2026-04-13

### Added
- CI workflow to run integrity checks, build validation, and VSIX packaging on push and pull request.
- Automated VSIX artifact upload for packaged builds.

### Changed
- Bumped the extension release version for the next packaged build.
- Kept packaging safeguards enabled for local builds and release packaging.

### Fixed
- Repaired the release process so the latest build is packaged as a fresh VSIX instead of reusing the previous artifact.

## [0.2.0] - 2026-04-11

### Added
- Configurable server URL via `codus.serverUrl` VS Code setting.
- Join and leave notifications in the editor and sidebar.
- Auto-reconnect on socket disconnect with room rejoin.
- File awareness, read-only room mode, deep link joining, and shareable room links.

### Changed
- Extension branding, commands, and docs were updated to Codus.

## [0.1.2] - 2026-04-11

### Added
- Initial working release.
- Room create, join, and leave commands.
- Real-time code sync via Yjs and Socket.IO.
- Remote cursor decorations and sidebar chat.
