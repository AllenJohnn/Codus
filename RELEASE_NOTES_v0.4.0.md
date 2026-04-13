# Codus v0.4.0 Release Notes

**Released:** April 13, 2026  
**Status:** ✅ Live on VS Code Marketplace  
**Version:** 0.4.0 (Marketplace Launch Release)

---

## 🎉 Major Milestone: VS Code Marketplace Launch

Codus is now available to **1 million+ VS Code users** globally!

- **🔗 Marketplace URL:** https://marketplace.visualstudio.com/items?itemName=AllenJohn.codus
- **📥 Installation:** Search "Codus" in VS Code Extensions
- **🌐 GitHub:** https://github.com/AllenJohnn/Codus

---

## ✨ What's New in v0.4.0

### Marketplace & Branding
- ✅ Custom extension icon (128x128px PNG)
- ✅ Professional gallery banner (dark theme)
- ✅ Enhanced `displayName`: "Codus — Collaborative Coding"
- ✅ Richer metadata:
  - 10 targeted keywords for search visibility
  - Author attribution
  - Free pricing label
  - Categorized commands in Command Palette

### Documentation & UX
- ✅ Comprehensive marketplace README (4.79 KB)
  - Feature showcase with comparison tables
  - 4-step quick start guide
  - Self-hosting instructions for teams
  - Known limitations clearly stated
  - Full contribution guidelines
  
- ✅ Updated CHANGELOG with v0.3.0–v0.1.2 history
- ✅ Markdown-formatted server settings with self-hosting links

### Repository Integration
- ✅ GitHub repository links configured:
  - **Issues/Bugs:** https://github.com/AllenJohnn/Codus/issues
  - **Homepage:** https://github.com/AllenJohnn/Codus/blob/main/extension/README.md
  - **Repository:** https://github.com/AllenJohnn/Codus

---

## 📊 Extension Specifications

| Property | Value |
|----------|-------|
| **Publisher** | AllenJohn |
| **Extension ID** | AllenJohn.codus |
| **Version** | 0.4.0 |
| **License** | MIT |
| **Min VS Code Version** | 1.88.0+ |
| **Package Size** | ~560 KB (bundled) |
| **Server** | https://codus.onrender.com (free tier) |

---

## 🚀 Features (Unchanged from v0.3.0)

- **Live Code Sync** — Real-time CRDT-powered synchronization via Yjs
- **Remote Cursors** — See collaborators' positions in real time
- **Follow Mode** — Auto-scroll to follow another user
- **File Awareness** — See which file each user is editing
- **Sidebar Chat** — Built-in messaging with code snippets
- **Read-Only Mode** — Host can lock the room for demos/review
- **Deep-Link Joins** — Share one URL for instant room access
- **No Account** — Works out of the box with the shared server

---

## ⚙️ System Requirements

- **VS Code**: 1.88.0 or newer
- **Internet**: Required (for shared server or self-hosted instance)
- **Node.js**: 18+ (self-hosting only)

---

## 📦 What's Included in the VSIX

```
extension/
├── media/
│   ├── icon.png (16.33 KB) • Custom marketplace icon
│   └── collab.svg (0.28 KB) • Sidebar icon
├── out/
│   ├── extension.js (509.51 KB) • Bundled extension (esbuild)
│   └── codus-server.js (1.78 MB) • Embedded collaborative server
├── src/webview/
│   └── index.html (28.01 KB) • UI components (rooms, chat, cursors)
├── LICENSE.txt (1.06 KB) • MIT license
├── package.json (3.43 KB) • Extension metadata
└── readme.md (4.79 KB) • Marketplace documentation
```

**Total Size:** 560.69 KB (optimized with .vscodeignore)

---

## 🔧 Development & Build Pipeline

- **Language**: TypeScript 5.8.3
- **Bundler**: esbuild 0.25.4 (production minification)
- **Watcher**: tsc -w for development
- **Package Tool**: @vscode/vsce 2.x
- **Quality Checks**: Integrity verification on every build

**Build Command:**
```bash
npm run build              # Development
npm run package -w extension  # Production
npx @vscode/vsce publish patch # Marketplace
```

---

## 📋 Deployment Checklist

- ✅ Extension published to VS Code Marketplace
- ✅ Version updated in package.json (0.4.0)
- ✅ CHANGELOG.md updated with v0.4.0 entry
- ✅ Marketplace metadata complete and optimized
- ✅ Icon included (16.33 KB)
- ✅ GitHub repository configured
- ✅ Free server running at https://codus.onrender.com
- ✅ Self-hosting docs provided
- ✅ VSIX built and signed (~560 KB)

---

## 🎯 Known Limitations

- **No data persistence** — Rooms stored in memory; lost on server restart
- **One file per session** — Only active file is synced (tab switching re-binds)
- **No authentication** — Anyone with the room code can join (self-host for private use)
- **Free server cold-starts** — Render free tier has 20–30s first-wake delay

---

## 🔜 Next Steps

### For Users
1. Install from VS Code Marketplace (search "Codus")
2. Create a room and share the 4-digit code
3. Collaborators join with the same code
4. Start pair programming in real time

### For Developers
1. Self-host for privacy: `npm run start -w server`
2. Configure `codus.serverUrl` in settings
3. Contribute via GitHub: https://github.com/AllenJohnn/Codus

---

## 📞 Support

- **Issues & Feature Requests:** https://github.com/AllenJohnn/Codus/issues
- **Marketplace Page:** https://marketplace.visualstudio.com/items?itemName=AllenJohn.codus
- **Command Palette Help:** Run `Codus: Connection Diagnostics`

---

## 📄 License

MIT License — See [LICENSE](extension/LICENSE) in the repository.

---

**Author:** Allen John  
**Last Updated:** April 13, 2026  
**Status:** Production Ready ✅
