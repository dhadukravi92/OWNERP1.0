# PanelERP - Complete Installation & Setup Guide
## Panel Manufacturing & Electrical Industry ERP System

---

## 📋 TABLE OF CONTENTS

1. [System Requirements](#system-requirements)
2. [Required Tools (Free & Open Source)](#required-tools)
3. [Step-by-Step Installation](#step-by-step-installation)
4. [Building the .EXE Installer](#building-exe)
5. [First-Time Setup](#first-time-setup)
6. [User Manual](#user-manual)
7. [Google Drive Backup Setup](#google-drive-backup-setup)
8. [Troubleshooting](#troubleshooting)
9. [Database Schema](#database-schema)

---

## 1. SYSTEM REQUIREMENTS <a name="system-requirements"></a>

| Component       | Minimum              | Recommended           |
|-----------------|----------------------|-----------------------|
| OS              | Windows 10 (x64)     | Windows 11 (x64)      |
| RAM             | 4 GB                 | 8 GB                  |
| Storage         | 500 MB free          | 2 GB free             |
| Display         | 1280×720             | 1920×1080             |
| Network         | Not required         | For updates only      |

---

## 2. REQUIRED TOOLS (All Free & Open Source) <a name="required-tools"></a>

### Tool 1: Node.js (v18 LTS or v20 LTS)
- **Download:** https://nodejs.org/en/download
- **Choose:** "Windows Installer (.msi)" — LTS version
- **Size:** ~28 MB
- **What it does:** JavaScript runtime that powers the app

**Installation steps:**
1. Download the .msi file
2. Double-click → Next → Accept license → Next → Install
3. Verify: Open Command Prompt → type `node --version` → should show v18.x.x or v20.x.x

---

### Tool 2: Git (optional but recommended)
- **Download:** https://git-scm.com/download/win
- **What it does:** Version control (optional, only needed if cloning from repo)

---

### Tool 3: Visual Studio Build Tools (for native modules)
- **Download:** https://visualstudio.microsoft.com/visual-cpp-build-tools/
- **What to install:** "Desktop development with C++" workload
- **Size:** ~3–6 GB
- **Why needed:** better-sqlite3 requires native compilation

**Alternative (easier):** Install windows-build-tools via npm:
```
npm install --global windows-build-tools
```
(Run this in an Administrator command prompt)

---

### Tool 4: Python 3.x (needed by node-gyp)
- **Download:** https://www.python.org/downloads/
- **Choose:** Python 3.11 or 3.12 Windows installer
- **IMPORTANT:** Check "Add Python to PATH" during installation

---

## 3. STEP-BY-STEP INSTALLATION <a name="step-by-step-installation"></a>

### Step A: Extract the source code
1. Extract the `panel-erp.zip` to a folder, e.g., `C:\PanelERP\`
2. Open **Command Prompt** or **PowerShell** as Administrator
3. Navigate: `cd C:\PanelERP\panel-erp`

### Step B: Install dependencies
```bash
npm install
```
This will download all required packages (~500 MB, takes 3–10 minutes).

**If you get errors about better-sqlite3:**
```bash
npm install --global node-pre-gyp
npm rebuild better-sqlite3
```

### Step C: Test the app (development mode)
```bash
npm run electron-dev
```
The app should launch. Login with:
- Username: `admin`
- Password: `admin123`

---

## 4. BUILDING THE .EXE INSTALLER <a name="building-exe"></a>

### Step 1: Build the React frontend
```bash
npm run build
```
This creates an optimized production build in the `build/` folder.

### Step 2: Package as Windows installer
```bash
npm run package
```
This creates a Windows installer in the `dist/` folder.

**Output file:** `dist/PanelERP Setup 1.0.0.exe`

### Step 3: Distribute
- The generated `.exe` is a self-contained NSIS installer
- Double-click to install on any Windows 10/11 machine
- During installation, the setup will ask where the live SQLite database should be stored
- No additional software required on target machines
- Creates desktop shortcut and Start Menu entry automatically

---

## 5. FIRST-TIME SETUP <a name="first-time-setup"></a>

### After installation:
1. During setup, choose the folder where PanelERP should save the database
2. Launch **PanelERP** from desktop or Start Menu
3. Login: `admin` / `admin123`
4. Go to **Settings** → Company tab
5. Enter your company details:
   - Company Name
   - GST Number
   - Address, Phone, Email
6. Click **Save Settings**

### Change the database location later
1. Open **Settings** → **Backup & Data**
2. Click **Change Location**
3. Select the new folder
4. When asked, choose one of the following:
   - **Yes, copy old data** → PanelERP copies the current database to the new path
   - **No, create new database** → PanelERP starts with a fresh database in the new path

### Change admin password:
1. Go to **Settings** → Users tab
2. Click edit (shield icon) next to Admin
3. Enter new password → Save

### Add your products:
1. Go to **Catalogue** → Add Product
2. Fill in product details, pricing, HSN code
3. Set minimum stock level for alerts

### Add vendors and customers:
1. Go to **Contacts** → Add Contact
2. Select type: Customer or Vendor
3. Fill in GSTIN for tax compliance

---

## 6. USER MANUAL <a name="user-manual"></a>

Detailed operating reference:
- See [OPERATIONS_MANUAL.md](/d:/PanelERP/Panel-erp/docs/OPERATIONS_MANUAL.md) for module-wise and form-wise working instructions.

### 🔑 Login & Roles

| Role     | Permissions                                      |
|----------|--------------------------------------------------|
| Admin    | Full access — all modules + user management     |
| Manager  | All modules except user management               |
| Operator | View + data entry, no delete/settings access    |

---

### 📦 Catalogue Module
- Add electrical components, panels, raw materials
- Assign categories and subcategories
- Set HSN codes and GST rates for invoicing
- Define minimum stock levels for alerts
- Track cost price vs selling price

---

### 📊 Inventory Module
- View real-time stock for all products
- **Stock In**: Add stock manually (use when receiving without PO)
- **Stock Out**: Deduct stock (use for consumption/issues)
- View complete transaction history
- Stock auto-updates when GRN is saved

---

### 💰 Quotations Module
- Create quotations for customers
- Add line items by selecting from product catalogue
- Apply item-level and overall discounts
- GST auto-calculated per item
- Status flow: Draft → Sent → Approved/Rejected

---

### 📋 Bill of Materials (BOM)
- Define component lists for panel assemblies
- Link finished products to BOMs
- Click "Estimate Cost" to calculate total material cost
- Multiple versions supported

---

### 📥 Inward / GRN
- Record incoming materials from vendors
- Link to vendor (supplier)
- Stock auto-updates immediately on save
- Cost price updates to latest purchase price

---

### 📦 Orders Module
- Create sales orders for customers
- Track through: Pending → Confirmed → In Production → Shipped → Delivered
- Update status from dropdown in the table

---

### 📈 Reports
- **Stock Report**: Full inventory valuation with export
- **Order Revenue**: Monthly revenue trend charts
- **Vendor Report**: Purchase history by vendor
- **Category Analysis**: Stock value by category
- All reports exportable to CSV

---

### ⚙️ Settings
- Company info (used in document headers)
- User management (add/edit/remove users)
- Database backup (saves copy to AppData)

---

## 7. GOOGLE DRIVE BACKUP SETUP <a name="google-drive-backup-setup"></a>

OWNERP supports two backup methods:
- `Google Drive API Login`: OWNERP signs in to Google Drive once, saves the reusable login token on this PC, and uploads backups directly to Drive.
- `Local Synced Folder`: OWNERP writes backups into a local folder that is already synced by Google Drive for desktop or another sync tool.

For fully automatic cloud upload without depending on Google Drive desktop sync, use `Google Drive API Login`.

### How the Google Drive API method works
1. OWNERP creates the backup files locally.
2. OWNERP refreshes the saved Google login token.
3. OWNERP creates or reuses the current month folder in Google Drive.
4. OWNERP uploads both files automatically:
   - ERP master database backup
   - Accounting database backup
5. The same flow is used for both:
   - `Run Backup Now`
   - Scheduled auto backup

### Where the Google login is saved
- OWNERP does not store the Google password.
- OWNERP stores the Google OAuth refresh token in the Electron app config on the local PC.
- Current storage path shown inside the app:
  - `Settings -> Backup & Data -> Login Storage`
- Typical file used by the app config:
  - `%APPDATA%\OWNERP\panelerp-config.json`
  - or the Electron user-data location shown by the app

If you want to remove the saved Google login later:
- Open `Settings -> Backup & Data`
- Click `Remove Saved Login`

### Google Cloud Console setup

Before linking Google Drive in OWNERP, create a Google Cloud project and OAuth credentials.

#### Step 1: Open Google Cloud Console
1. Go to `https://console.cloud.google.com/`
2. Sign in with the Google account that will own the Drive folder
3. Create a new project or select an existing project

#### Step 2: Enable the Google Drive API
1. In the left menu, open `APIs & Services -> Library`
2. Search for `Google Drive API`
3. Open it and click `Enable`

#### Step 3: Configure the OAuth consent screen
1. Open `APIs & Services -> OAuth consent screen`
2. Choose `External` unless you are using a Google Workspace internal-only setup
3. Fill the basic app details
4. Save the consent screen
5. Add your own Google account as a test user if Google requires it during testing

#### Step 4: Create OAuth client credentials
1. Open `APIs & Services -> Credentials`
2. Click `Create Credentials -> OAuth client ID`
3. Choose application type `Desktop app`
4. Give it a name such as `OWNERP Desktop Backup`
5. Click `Create`
6. Copy these two values:
   - `Client ID`
   - `Client Secret`

Important:
- Use a `Desktop app` OAuth client.
- OWNERP opens a browser login and receives the callback on the local machine automatically.

### Create or choose the target Google Drive folder
1. In Google Drive, create a folder such as `OWNERP Backups`
2. Open that folder in the browser
3. Copy either:
   - the full folder URL
   - or the folder ID from the URL

Example:
- Folder URL:
  - `https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz`
- Folder ID:
  - `1AbCdEfGhIjKlMnOpQrStUvWxYz`

### Link Google Drive inside OWNERP
1. Open `Settings -> Backup & Data`
2. In `Backup Provider`, choose `Google Drive API Login`
3. Enter:
   - `Google Client ID`
   - `Google Client Secret`
   - `Drive Folder URL / Folder ID`
4. Click `Save Drive Login Settings`
5. Click `Connect Google Drive`
6. A browser window will open
7. Sign in with Google and approve access
8. Return to OWNERP and confirm:
   - connected account is shown
   - folder ID is shown
   - login storage path is shown

### Enable scheduled automatic Drive backup
1. Stay in `Settings -> Backup & Data`
2. Set `Automatic Backup` to `Enabled`
3. Choose the backup interval:
   - `Every Day`
   - `Every Week`
   - `Every Month`
4. Click `Save Auto Backup Settings`
5. Click `Run Backup Now` once to verify the setup

### What gets uploaded
Each backup run uploads both databases automatically:
- `panelerp_<interval>_<date>_master.db`
- `panelerp_<interval>_<date>_accounting.db`

OWNERP groups them by month inside Google Drive.

### Security notes
- OWNERP never stores the Google account password.
- OWNERP stores a refresh token so scheduled uploads can continue without repeated login prompts.
- Anyone with access to the Windows user account and local config may be able to reuse that token.
- For higher security in production, consider moving token storage to Windows Credential Manager / DPAPI.

### Troubleshooting Google Drive login

#### "Google Drive Client ID and Client Secret are required"
- Re-open `APIs & Services -> Credentials`
- Copy the Desktop OAuth client values again
- Save them in OWNERP

#### "Google Drive folder URL or folder ID is required"
- Paste the full Google Drive folder URL or only the folder ID
- Do not paste a file URL

#### "Google did not return a refresh token"
- Remove the saved login from OWNERP
- In your Google account, revoke the app's access
- Connect again and approve the app

#### "Google Drive login timed out"
- Click `Connect Google Drive` again
- Complete the browser sign-in within a few minutes

#### Scheduled backup does not upload
- Make sure `Automatic Backup` is enabled
- Make sure Google Drive still shows as connected
- Use `Run Backup Now` to test immediately
- Check `Last backup error` in the same screen

---

## 8. TROUBLESHOOTING <a name="troubleshooting"></a>

### App won't start after install
- Check Windows Event Viewer for errors
- Try running as Administrator
- Reinstall from the .exe

### "better-sqlite3" error during npm install
```bash
npm install --global windows-build-tools
npm install --ignore-scripts
npm rebuild better-sqlite3
```

### Blank white screen on launch
- Open DevTools: Ctrl+Shift+I
- Check Console tab for errors
- Usually a path issue — ensure build/ folder exists

### Data not saving
- Check disk space
- Database path: `C:\Users\<username>\AppData\Roaming\PanelERP\panelerp.db`
- Check file permissions on AppData folder

### Reset to factory defaults
1. Close the application
2. Delete: `C:\Users\<username>\AppData\Roaming\PanelERP\`
3. Reopen — fresh database will be created

---

## 9. DATABASE SCHEMA <a name="database-schema"></a>

The app uses **SQLite** (single file database). Location:
```
C:\Users\<YourName>\AppData\Roaming\PanelERP\panelerp.db
```

### Tables Overview

```
users               — Login accounts and roles
categories          — Product categories tree
products            — Product catalogue (components, panels, materials)
inventory           — Current stock levels
inventory_transactions — All stock movements (in/out history)
contacts            — Customers and vendors
quotations          — Sales quotations
quotation_items     — Line items for quotations
bom                 — Bill of Materials definitions
bom_items           — Components within each BOM
purchase_orders     — Purchase orders to vendors
grn                 — Goods Receipt Notes
grn_items           — Items received in each GRN
orders              — Customer sales orders
order_items         — Line items for orders
price_history       — Historical price changes
settings            — App configuration key-value store
notifications       — System alerts and notifications
```

### Backup & Migration
- Backup: Settings → Backup & Data → Create Backup Now
- Backups saved to: `%APPDATA%\PanelERP\backups\`
- To migrate: copy `panelerp.db` to new machine's AppData folder

---

## 📞 SUPPORT

For issues, refer to:
- This installation guide
- README.md in the source folder
- Check logs in: `%APPDATA%\PanelERP\logs\`

---

*PanelERP v1.0.0 — Built with Electron + React + SQLite*
*Open Source: MIT License*
