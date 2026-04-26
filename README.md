# PanelERP 🔌⚡
### Enterprise Resource Planning for Panel Manufacturing & Electrical Industry

A complete **offline-first desktop ERP** built with Electron + React + SQLite.

---

## ✅ Modules Included

| Module | Features |
|--------|----------|
| 🔧 Dashboard | Live stats, alerts, revenue chart |
| 📦 Catalogue | Products, categories, specifications, pricing |
| 🏭 Inventory | Real-time stock, adjustments, history |
| 👥 Contacts | Customers & vendors with GSTIN |
| 💰 Quotations | Create, send, approve with GST calculation |
| 📋 BOM | Bill of Materials with cost estimation |
| 📥 Inward/GRN | Goods Receipt, auto stock update |
| 📦 Orders | Full order lifecycle tracking |
| 📈 Reports | Stock, revenue, vendor, category charts + CSV export |
| 🔔 Notifications | Alerts for low stock, pending orders |
| ⚙️ Settings | Company info, user management, backup |

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run in development
npm run electron-dev

# 3. Build .EXE installer
npm run build && npm run package
```

Or just double-click `setup.bat` (Windows)

---

## 🔑 Default Login
- Username: `admin`
- Password: `admin123`

---

## 🛠️ Tech Stack (All Open Source)

| Component | Technology |
|-----------|------------|
| Desktop Shell | [Electron](https://electronjs.org) v29 |
| UI Framework | [React](https://reactjs.org) v18 |
| Database | [SQLite](https://sqlite.org) via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| State Management | [Zustand](https://github.com/pmndrs/zustand) |
| Charts | [Recharts](https://recharts.org) |
| Icons | [Lucide React](https://lucide.dev) |
| Routing | [React Router](https://reactrouter.com) v6 |
| Installer | [electron-builder](https://electron.build) with NSIS |

---

## 📁 Project Structure

```
panel-erp/
├── electron/
│   ├── main.js          # Electron main process + SQLite DB
│   └── preload.js       # Secure IPC bridge
├── src/
│   ├── pages/           # All module pages
│   ├── components/      # Layout, shared components
│   ├── store/           # Zustand state management
│   ├── utils/           # Database helpers, formatters
│   └── styles/          # Global CSS with dark/light theme
├── docs/
│   └── INSTALLATION_GUIDE.md
├── setup.bat            # One-click setup for Windows
├── run-dev.bat          # Start development mode
├── build-exe.bat        # Build .EXE installer
└── package.json
```

---

## 📦 Build Output

Running `npm run package` produces:
```
dist/
  PanelERP Setup 1.0.0.exe    ← Single-click Windows installer
```

The installer:
- Creates Start Menu shortcut
- Creates Desktop shortcut
- Allows custom install directory
- Works on Windows 10 & 11

---

## 💾 Data Storage

- Database: `%APPDATA%\PanelERP\panelerp.db` (SQLite)
- Backups: `%APPDATA%\PanelERP\backups\`
- Logs: `%APPDATA%\PanelERP\logs\`

---

## Google Drive Backup Setup

OWNERP now supports two backup modes:
- `Google Drive API Login`: direct upload to Google Drive using a saved OAuth login
- `Local Synced Folder`: save to a local folder already synced by Google Drive desktop

For the direct Google Drive login method:
1. Open Google Cloud Console
2. Enable `Google Drive API`
3. Configure the OAuth consent screen
4. Create an OAuth client of type `Desktop app`
5. Copy the `Client ID` and `Client Secret`
6. Create or choose a Google Drive folder and copy its folder URL or folder ID
7. In OWNERP, open `Settings -> Backup & Data`
8. Choose `Backup Provider -> Google Drive API Login`
9. Enter the Google client values and Drive folder URL/ID
10. Click `Save Drive Login Settings`
11. Click `Connect Google Drive`
12. Enable auto backup and click `Run Backup Now` once for testing

Saved login details:
- OWNERP does not store the Google password
- OWNERP stores the reusable refresh token in the local desktop app config on this PC
- The app shows the exact token storage path in `Settings -> Backup & Data -> Login Storage`

For the full step-by-step manual, see:
- [docs/INSTALLATION_GUIDE.md](/d:/PanelERP/Panel-erp/docs/INSTALLATION_GUIDE.md)

For the day-to-day module and form usage guide, see:
- [docs/OPERATIONS_MANUAL.md](/d:/PanelERP/Panel-erp/docs/OPERATIONS_MANUAL.md)

---

## 📄 License

MIT License — Free for commercial use.
