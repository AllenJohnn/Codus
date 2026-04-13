# Changelog

All notable changes to this project are documented here.

## [0.3.0] - 2026-04-13

### Added
- Production server deployment at `https://codus.onrender.com`
- `Codus: Connection Diagnostics` command to verify server connectivity
- Port fallback logic on the server when the default port is occupied
- Room existence validation on join to prevent silent empty-room creation
- Server health check endpoints at `/health` and `/`

### Changed
- **BREAKING**: Default `codus.serverUrl` changed from `http://127.0.0.1:3000` to `https://codus.onrender.com`
- Local server setup is no longer required for standard collaboration use
- Extension now updates the configured server URL when it detects a usable local fallback port
- Webview visibility improved with better contrast, larger fonts, and clearer button states
- Deep links now preserve server URL context for cross-system room joining

### Fixed
- Fixed file corruption caused by runaway room sync by keeping the active document locked on room join
- Fixed multi-system join failures by returning an explicit error when the room does not exist on the target server
- Fixed transport mismatch by allowing Socket.IO polling fallback on the server
- Fixed room ID normalization so create and join use the same canonical format
- Fixed cleanup and session stability issues in the extension and server

### Removed
- Requirement for a local Node.js server for standard usage

## [0.2.2] - 2026-04-13

### Added
- Repository integrity checks to catch accidental bulk overwrites of tracked source files
- Packaging safeguards so the integrity check runs during extension builds and packaging

### Changed
- Refreshed the root and extension READMEs to match the current workspace layout and commands
- Bumped the extension version for the next VSIX release

### Fixed
- Removed stale README and changelog content that no longer matched the codebase

## [0.2.1] - 2026-04-13

### Added
- CI workflow to run integrity checks, build validation, and VSIX packaging on push and pull request
- Automated VSIX artifact upload for packaged builds

### Changed
- Bumped the extension release version for the next packaged build
- Kept packaging safeguards enabled for local builds and release packaging

### Fixed
- Repaired the release process so the latest build is packaged as a fresh VSIX instead of reusing the previous artifact

## [0.2.0] - 2026-04-11

### Added
- Configurable server URL via `codus.serverUrl` VS Code setting
- Join and leave notifications in the editor and sidebar
- Auto-reconnect on socket disconnect with room rejoin
- File awareness, read-only room mode, deep link joining, and shareable room links

### Changed
- Extension branding, commands, and docs were updated to Codus

## [0.1.2] - 2026-04-11

### Added
- Initial working release
- Room create, join, and leave commands
- Real-time code sync via Yjs and Socket.IO
- Remote cursor decorations and sidebar chat
