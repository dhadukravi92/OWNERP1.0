# OwnERP: Enterprise Resource Planning System

> **Offline-first, desktop ERP platform for mid-market operations.** Built with Electron, React 18, and SQLite for maximum portability, reliability, and zero vendor lock-in.

---

## Executive Summary

OwnERP is a comprehensive enterprise resource planning solution designed for manufacturing and trading businesses operating in regions with unreliable connectivity. The platform provides complete operational coverage through integrated modules for inventory management, sales operations, CRM, HR, accounting, and advanced reporting—all running locally on Windows desktops with optional cloud synchronization.

### Key Differentiators

- **Offline-First Architecture**: Full functionality without internet connectivity; sync when available
- **Zero Installation Overhead**: SQLite embedded database with no external dependencies
- **Role-Based Access Control**: Granular permission system with audit trails
- **GST Compliance**: Built-in tax calculations for Indian market requirements
- **Multi-Channel Integration**: IndiaMART API, vendor integrations, and custom webhooks
- **Enterprise Features**: Workflow approvals, audit logging, multi-user concurrency handling

---

## Core Features & Modules

### 1. **Dashboard & Analytics**
- Real-time KPI tracking with historical trends
- Role-based metric dashboards
- Customizable charts and alerts
- Data export capabilities (CSV, PDF)

### 2. **Inventory Management**
- Stock-keeping unit (SKU) management with variants
- Real-time stock level tracking with automatic adjustments
- Multi-location inventory support
- Goods Receipt Notes (GRN) with barcode integration
- Stock adjustment journals with approval workflows

### 3. **Sales Operations**
- Purchase orders, sales orders, and quotations
- Approval routing and workflow management
- Bill of Materials (BoM) with cost estimation
- GST-inclusive pricing and tax calculations
- Order lifecycle tracking from creation to delivery

### 4. **Customer Relationship Management (CRM)**
- Lead pipeline management with Kanban view
- IndiaMART integration for automated inquiry sync
- AI-powered lead scoring and probability forecasting
- Automated follow-up scheduling and alerts
- Communication integration (email, SMS ready)
- Quotation revision tracking with full audit trail

### 5. **Accounting & Finance**
- Invoice generation and management
- Voucher entry (Journal, Cash, Bank, Contra)
- General Ledger with drill-down capabilities
- Trial Balance and financial statements
- Payment reconciliation

### 6. **Human Resources**
- Employee master records and organizational hierarchy
- Leave management with workflow approvals
- Payroll processing and salary structures
- Attendance tracking

### 7. **Contacts Management**
- Customer and vendor master database
- GSTIN validation and GST compliance
- Contact categorization and segmentation
- Credit limit management with aging reports

---

## Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Desktop Shell** | Electron v29 | Cross-platform capability, secure IPC |
| **UI Framework** | React v18 | Component reusability, virtual DOM efficiency |
| **State Management** | Zustand | Lightweight (~2KB), minimal boilerplate |
| **Database** | SQLite + better-sqlite3 | Serverless, transactional, zero config |
| **Data Visualization** | Recharts | React-native charts, responsive design |
| **Styling** | CSS-in-JS + Global CSS | Theme switching (dark/light), scoped styles |
| **Routing** | React Router v6 | Client-side routing, nested routes support |
| **Icons** | Lucide React | Lightweight, consistent icon library |
| **Build & Package** | electron-builder + NSIS | Single-click Windows installer |

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│         React Components Layer           │
│  (Pages, Forms, Dashboard, Reports)     │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│       Zustand State Management           │
│  (appStore.js - IPC Proxy Pattern)      │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│     Electron Main Process (IPC)          │
│  (main.js - Secure Message Bridge)      │
└────────────────────┬────────────────────┘
                     │
┌────────────────────▼────────────────────┐
│     SQLite Database (better-sqlite3)     │
│  (%APPDATA%\OwnERP\ownerp.db)           │
└─────────────────────────────────────────┘
```

### Design Patterns

- **IPC Proxy Pattern**: React components delegate database operations via Zustand store to Electron main process
- **Module-Based Architecture**: Each business domain (CRM, Accounting, HR) organized as independent modules with shared utilities
- **Single Responsibility**: Clear separation between UI (React), state (Zustand), and data (SQLite)

---

## Project Structure

```
ownerp/
├── electron/
│   ├── main.js              # Electron main process, SQLite initialization, IPC handlers
│   └── preload.js           # Secure context bridge for IPC communication
│
├── src/
│   ├── App.js               # Main routing configuration
│   ├── index.js             # React entry point
│   ├── pages/               # Module pages (CRM, HR, Accounting, etc.)
│   │   ├── Dashboard.js
│   │   ├── CRM.js
│   │   ├── HR.js
│   │   ├── Accounting.js
│   │   ├── OrdersPro.js
│   │   └── ...
│   ├── components/
│   │   ├── layout/          # Header, Sidebar, MainLayout
│   │   ├── crm/             # CRM-specific components
│   │   ├── accounting/      # Accounting-specific components
│   │   ├── common/          # Reusable UI components
│   │   └── modules/         # Shared module components
│   ├── store/
│   │   └── appStore.js      # Zustand store with IPC bridge
│   ├── utils/
│   │   ├── db.js            # Database helper functions
│   │   ├── formatters.js    # Data formatting utilities
│   │   ├── validators.js    # Form validation rules
│   │   ├── themes.js        # Theme configuration
│   │   └── modules.js       # Module configuration
│   └── styles/
│       └── globals.css      # Global styles, CSS variables
│
├── docs/
│   ├── INSTALLATION_GUIDE.md
│   ├── OPERATIONS_MANUAL.md
│   ├── CRM_MODULE.md
│   ├── DESIGN_SYSTEM_IMPLEMENTATION.md
│   └── ...
│
├── public/                  # Static assets, icons
├── scripts/                 # Build and utility scripts
├── package.json             # Dependencies and scripts
├── setup.bat                # Windows setup automation
├── run-dev.bat              # Development server
├── build-exe.bat            # Production build and packaging
└── electron-builder.yml     # Electron builder configuration
```

---

## Development Setup

### Prerequisites
- **Node.js** v16+ and npm v8+
- **Windows 10/11** (Electron desktop environment)
- **Git** for version control

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/dhadukravi92/OWNERP1.0.git
cd OWNERP1.0

# 2. Install dependencies
npm install

# 3. Initialize SQLite database (optional - auto-created on first run)
# Database location: %APPDATA%\OwnERP\ownerp.db
```

### Running in Development

```bash
# Option 1: Use batch script (Windows)
run-dev.bat

# Option 2: Direct npm command
npm run electron-dev
```

This launches:
- React development server (port 3000)
- Electron main process
- Hot reloading on file changes

### Default Credentials

```
Username: admin
Password: admin123
```

> **⚠️ Important**: Change default credentials immediately in production environments.

---

## Building & Deployment

### Development Build
```bash
npm run build        # Creates optimized React bundle
npm run electron-dev # Runs with development tooling
```

### Production Build
```bash
npm run build          # Optimized React production bundle
npm run package        # Creates Windows installer (.exe)
```

Output: `dist/OwnERP Setup [version].exe`

**Installer Features:**
- Silent installation support with command-line flags
- Automatic Start Menu and Desktop shortcuts
- Custom installation directory
- Self-update capability (if configured)

### Distribution
```bash
# Build and package with versioning
npm run build && npm run package

# Output: dist/OwnERP-[version].exe
```

---

## Database Schema & Initialization

SQLite database is auto-initialized on first launch. Core tables include:

### User & Access Control
- `users` - User accounts with role assignments
- `roles` - Role definitions and permission mappings
- `audit_log` - Complete activity audit trail

### Inventory
- `products` - SKU master with specifications
- `stock_levels` - Real-time inventory by location
- `stock_adjustments` - Journal entries for stock changes
- `goods_receipt_notes` - Inbound receipt records

### Sales & Orders
- `quotations` - Customer quotations with versioning
- `sales_orders` - Confirmed sales orders
- `purchase_orders` - Vendor purchase orders
- `bom` - Bill of Materials definitions

### CRM
- `crm_inquiries` - Customer inquiries from multiple sources
- `crm_leads` - Pipeline leads with probability scoring
- `crm_followups` - Scheduled follow-ups and tasks
- `crm_quotations` - CRM quotation workflow
- `crm_alerts` - Automated reminders and notifications
- `crm_indiamart_sync` - IndiaMART integration logs

### Accounting
- `invoices` - Sales and purchase invoices
- `vouchers` - Journal, cash, bank, and contra entries
- `general_ledger` - Account transaction history
- `payment_reconciliation` - Payment matching

### HR & Payroll
- `employees` - Employee master records
- `leave_requests` - Leave management workflow
- `payroll` - Salary processing
- `attendance` - Daily attendance tracking

---

## IPC Communication Protocol

Electron main process exposes database operations via IPC. Example:

```javascript
// In React component (appStore.js)
const createQuotation = async (quotationData) => {
  return window.electron.invoke('create-quotation', quotationData);
};

// In main.js (Electron)
ipcMain.handle('create-quotation', async (event, data) => {
  // Validate, sanitize, and persist data
  return db.prepare(`INSERT INTO quotations ...`).run(data);
});
```

All IPC handlers include:
- Input validation and sanitization
- Error handling with meaningful messages
- Audit logging of critical operations
- Transaction support for multi-step operations

---

## Performance Considerations

### Database Optimization
- Indexed queries on frequently searched columns (customer_id, order_date, etc.)
- Batch operations for bulk inserts/updates
- Connection pooling via better-sqlite3
- Prepared statements for all queries (SQL injection prevention)

### UI Performance
- React virtualization for large lists (1000+ rows)
- Lazy loading of module pages
- Memoized components to reduce unnecessary re-renders
- Debounced search and filter operations

### Storage
- SQLite WAL (Write-Ahead Logging) for concurrent reads
- Automatic backups with compression
- Data archival for historical records

---

## Security Architecture

### Access Control
- **Role-Based Access Control (RBAC)**: Granular permissions at operation level
- **Row-Level Security**: Users see only data within their scope
- **Audit Trail**: All changes logged with user, timestamp, and operation details

### Data Protection
- **Prepared Statements**: Prevention of SQL injection attacks
- **Input Validation**: Client and server-side validation
- **IPC Sandboxing**: Preload script enforces message validation
- **Encrypted Backups**: Optional encryption for Google Drive backups

### Environment Security
- No credentials stored in source code (use environment variables)
- Local database isolation (per-user APPDATA directory)
- Session timeout with automatic logout
- OAuth 2.0 for third-party integrations (IndiaMART, Google Drive)

---

## Data Backup & Disaster Recovery

### Backup Modes

#### 1. Local Backups
```
%APPDATA%\OwnERP\backups\
  └── ownerp_backup_2024-01-15_143022.db
```

#### 2. Google Drive Integration
- OAuth 2.0 authentication (no password storage)
- Automatic scheduled backups
- Selective folder syncing
- Refresh token rotation for security

### Backup Configuration
See [docs/INSTALLATION_GUIDE.md](/docs/INSTALLATION_GUIDE.md#backup-setup) for detailed setup.

---

## Logging & Diagnostics

### Log Locations
```
%APPDATA%\OwnERP\logs\
  ├── app.log              # Application events
  ├── database.log         # SQL queries and errors
  ├── ipc.log              # Inter-process communication
  └── sync.log             # Cloud sync operations
```

### Enable Debug Mode
```bash
# Set environment variable before running
set DEBUG=ownerp:*
npm run electron-dev
```

---

## Testing Strategy

### Unit Tests (Planned)
```bash
npm run test:unit       # Jest + React Testing Library
```

### Integration Tests (Planned)
```bash
npm run test:integration # API and database operations
```

### Manual Testing Checklist
- [ ] All CRUD operations for each module
- [ ] Workflow approvals and state transitions
- [ ] Permission enforcement by role
- [ ] Backup and restore operations
- [ ] Cross-module data consistency
- [ ] Performance with 10K+ records

---

## Troubleshooting

### Common Issues

**Q: Application won't start**
- Check: `%APPDATA%\OwnERP\logs\app.log` for error details
- Try: Delete `%APPDATA%\OwnERP\ownerp.db` to reset database

**Q: Database locked error**
- Cause: Multiple instances running or corrupted WAL files
- Solution: Close all instances, delete `.db-wal` and `.db-shm` files

**Q: Google Drive backup fails**
- Check: OAuth credentials in Settings → Backup & Data
- Verify: Google Drive API enabled in Cloud Console
- Try: Disconnect and re-authenticate

**Q: Performance degradation with large datasets**
- Solution: Archive old records to separate database
- Check: Database integrity with `PRAGMA integrity_check`

---

## Contributing Guidelines

1. **Fork and branch** from `main` for feature development
2. **Follow code standards**: Consistent formatting, meaningful variable names
3. **Test thoroughly**: Local testing before submitting PR
4. **Document changes**: Update relevant docs and add comments
5. **Commit messages**: Use conventional format (feat: ..., fix: ..., docs: ...)

---

## Support & Documentation

- **Installation**: [docs/INSTALLATION_GUIDE.md](/docs/INSTALLATION_GUIDE.md)
- **Operations**: [docs/OPERATIONS_MANUAL.md](/docs/OPERATIONS_MANUAL.md)
- **CRM Module**: [docs/CRM_MODULE.md](/docs/CRM_MODULE.md)
- **Design System**: [docs/DESIGN_SYSTEM_IMPLEMENTATION.md](/docs/DESIGN_SYSTEM_IMPLEMENTATION.md)

---

## License

**MIT License** — Free for commercial and personal use. See LICENSE file for details.

---

## 💾 Data Storage

- Database: `%APPDATA%\OwnERP\ownerp.db` (SQLite)
- Backups: `%APPDATA%\OwnERP\backups\`
- Logs: `%APPDATA%\OwnERP\logs\`

---

## Google Drive Backup Setup

OwnERP now supports two backup modes:
- `Google Drive API Login`: direct upload to Google Drive using a saved OAuth login
- `Local Synced Folder`: save to a local folder already synced by Google Drive desktop

For the direct Google Drive login method:
1. Open Google Cloud Console
2. Enable `Google Drive API`
3. Configure the OAuth consent screen
4. Create an OAuth client of type `Desktop app`
5. Copy the `Client ID` and `Client Secret`
6. Create or choose a Google Drive folder and copy its folder URL or folder ID
7. In OwnERP, open `Settings -> Backup & Data`
8. Choose `Backup Provider -> Google Drive API Login`
9. Enter the Google client values and Drive folder URL/ID
10. Click `Save Drive Login Settings`
11. Click `Connect Google Drive`
12. Enable auto backup and click `Run Backup Now` once for testing

Saved login details:
- OwnERP does not store the Google password
- OwnERP stores the reusable refresh token in the local desktop app config on this PC
- The app shows the exact token storage path in `Settings -> Backup & Data -> Login Storage`

For the full step-by-step manual, see:
- [docs/INSTALLATION_GUIDE.md](/d:/OwnERP/OwnERP/docs/INSTALLATION_GUIDE.md)

For the day-to-day module and form usage guide, see:
- [docs/OPERATIONS_MANUAL.md](/d:/OwnERP/OwnERP/docs/OPERATIONS_MANUAL.md)

---

## 📄 License

MIT License — Free for commercial use.
