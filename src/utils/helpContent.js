import { canAccessModule, canAccessSettings } from './modules';

export const HELP_ARTICLES = [
  {
    id: 'overview',
    title: 'OWNERP Overview',
    section: 'Getting Started',
    tags: ['overview', 'erp', 'modules', 'workflow', 'start'],
    content: `OWNERP is a desktop ERP for panel manufacturing and electrical businesses. A common operating flow is: create products, maintain contacts, build BOMs, issue quotations, create orders, receive material through GRN, manage stock, post accounting transactions, and review reports, alerts, and dashboard signals. Admin users control setup, backups, users, and module access.`
  },
  {
    id: 'login-roles',
    title: 'Login and User Roles',
    section: 'Getting Started',
    tags: ['login', 'password', 'roles', 'admin', 'manager', 'operator', 'users'],
    content: `Users sign in with username and password. Admin has full access including Settings and user management. Manager handles day-to-day operations across allowed modules. Operator focuses on transaction entry and routine work. Access depends on role plus module permissions configured in Settings. Change the default admin password during first-time setup.`
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    section: 'Modules',
    moduleId: 'dashboard',
    tags: ['dashboard', 'kpi', 'revenue', 'orders', 'stock', 'watchlist'],
    content: `The Dashboard is the operational summary screen. Review revenue and quotation momentum, fulfillment mix, critical stock watchlist, top customers, quick actions, and recent orders. Managers should use it at the start of the day to identify low stock, pending orders, customer concentration, and open commercial activity.`
  },
  {
    id: 'catalogue',
    title: 'Product Catalogue',
    section: 'Modules',
    moduleId: 'products',
    tags: ['catalogue', 'products', 'product', 'hsn', 'gst', 'pricing', 'minimum stock'],
    content: `Use Product Catalogue to create and maintain item masters for raw material, components, and finished goods. Main form areas include identity, classification, commercials, inventory control, and product details. Enter product code, category, HSN code, unit, selling price, cost price, GST rate, and minimum stock. Keep product codes unique and pricing accurate before quotations, orders, and BOM creation.`
  },
  {
    id: 'categories',
    title: 'Category Masters',
    section: 'Modules',
    moduleId: 'categories',
    tags: ['categories', 'classification', 'product category', 'parent category', 'masters'],
    content: `Category Masters centralizes product classification. Create, edit, and organize categories (including optional parent categories) before assigning them in Product Catalogue. Product forms can also create a category inline when no match is found. Keep category names clean and non-duplicate so reporting and stock analysis remain reliable.`
  },
  {
    id: 'inventory',
    title: 'Inventory',
    section: 'Modules',
    moduleId: 'inventory',
    tags: ['inventory', 'stock in', 'stock out', 'adjustment', 'transactions', 'history'],
    content: `Inventory Management shows live stock and stock transaction history. Use Stock In and Stock Out for manual movements, corrections, and emergency adjustments. Enter product, quantity, movement type, and remarks. For normal vendor receipts, use Inward / GRN instead of manual stock entry so stock and purchase traceability stay aligned.`
  },
  {
    id: 'contacts',
    title: 'Contacts',
    section: 'Modules',
    moduleId: 'contacts',
    tags: ['contacts', 'customer', 'vendor', 'gst', 'banking', 'payment terms'],
    content: `Contacts stores customer and vendor masters used by quotations, orders, inward, and accounting. The form includes identity and communication, compliance and commercial controls, banking and settlement details, and internal notes. Maintain GST, PAN, credit limit, payment terms, and verified bank details. Avoid duplicate party masters.`
  },
  {
    id: 'crm',
    title: 'CRM',
    section: 'Modules',
    moduleId: 'crm',
    tags: ['crm', 'leads', 'inquiries', 'followups', 'pipeline', 'alerts'],
    content: `CRM is used for sales pipeline control before quotation and order conversion. Track inquiries, leads, follow-ups, CRM quotations, and alerts. Record customer details, inquiry source, requirement summary, follow-up dates, and lead status. CRM helps the team move from inquiry to quotation with better follow-up discipline.`
  },
  {
    id: 'hr',
    title: 'HR',
    section: 'Modules',
    moduleId: 'hr',
    tags: ['hr', 'employees', 'attendance', 'leave', 'payroll', 'documents'],
    content: `HR manages workforce profiles, leave, attendance, payroll, and employee documents. Use workforce profile forms for identity, assignment, contact, payroll, banking, and emergency contact details. Admin users can run attendance capture, leave approvals, payroll runs, document linking, and employee directory reviews.`
  },
  {
    id: 'accounting-overview',
    title: 'Accounting Overview',
    section: 'Modules',
    moduleId: 'accounting',
    tags: ['accounting', 'invoice', 'purchase bill', 'receipt', 'payment', 'journal', 'ledger', 'gst'],
    content: `Accounting handles sales invoices, purchase bills, receipt vouchers, payment vouchers, bank reconciliation, chart of accounts, journals, proforma invoices, follow-ups, and accounting settings. It is the core finance module for receivables, payables, treasury, tax, and ledger control.`
  },
  {
    id: 'accounting-sales-invoice',
    title: 'Create Sales Invoice',
    section: 'Accounting Forms',
    moduleId: 'accounting',
    tags: ['sales invoice', 'invoice', 'customer bill', 'accounting form'],
    content: `Use Create Sales Invoice to bill a customer. Enter customer, invoice date, line items, taxes, and notes. Verify GST and pricing before posting. Review posted invoices later in Sales Invoice Register.`
  },
  {
    id: 'accounting-purchase-bill',
    title: 'Create Purchase Bill',
    section: 'Accounting Forms',
    moduleId: 'accounting',
    tags: ['purchase bill', 'vendor bill', 'supplier bill', 'accounting form'],
    content: `Use Create Purchase Bill to record vendor liability and purchase value. Enter vendor, bill date, item or value details, and taxes. Review posted bills in Purchase Bill Register.`
  },
  {
    id: 'accounting-receipt-payment',
    title: 'Receipt and Payment Vouchers',
    section: 'Accounting Forms',
    moduleId: 'accounting',
    tags: ['receipt voucher', 'payment voucher', 'collections', 'settlement', 'cash', 'bank'],
    content: `Post Receipt Voucher when money is received from a customer. Post Payment Voucher when money is paid to a vendor or payee. Enter party, date, amount, payment mode, and reference. Where possible, allocate the voucher against open invoices or bills.`
  },
  {
    id: 'accounting-bank-reconciliation',
    title: 'Bank Reconciliation',
    section: 'Accounting Forms',
    moduleId: 'accounting',
    tags: ['bank', 'reconciliation', 'statement line', 'matching workspace'],
    content: `Use Add Bank Statement Line to enter bank statement entries. Review them in Bank Book Feed and Statement Matching Workspace. Match statement lines to receipts, payments, or bank transactions regularly so balances and audit trails remain clean.`
  },
  {
    id: 'accounting-manual-journal',
    title: 'Manual Journal',
    section: 'Accounting Forms',
    moduleId: 'accounting',
    tags: ['manual journal', 'journal', 'adjustment', 'entries'],
    content: `Use Manual Journal for adjustments, accruals, or non-standard accounting entries when no regular transaction form fits. Enter voucher date, debit and credit accounts, amount, and narration. Use journals carefully and keep narration meaningful.`
  },
  {
    id: 'bom',
    title: 'Bill of Materials',
    section: 'Modules',
    moduleId: 'bom',
    tags: ['bom', 'bill of materials', 'components', 'revision', 'engineering'],
    content: `Bill of Materials defines the component structure of a finished item. Main form sections include BOM identity, materials and components, and engineering notes. Use BOM before production planning and costing review. Keep revisions controlled and review stock posture before release.`
  },
  {
    id: 'quotations',
    title: 'Quotations',
    section: 'Modules',
    moduleId: 'crm',
    tags: ['quotation', 'quote', 'commercial offer', 'line items', 'terms'],
    content: `Quotations is used to create customer offers. Enter customer, quotation header, line items, discounts, tax, validity, notes, and terms. Typical status flow is Draft, Sent, Approved, or Rejected. Verify item rate and GST before sending.`
  },
  {
    id: 'inward-grn',
    title: 'Inward and GRN',
    section: 'Modules',
    moduleId: 'inward',
    tags: ['inward', 'grn', 'goods receipt', 'receiving', 'vendor receipt'],
    content: `Inward / GRN records incoming material from vendors. Enter receipt header details such as vendor and date, then record received items with quantity and value details. Saving the GRN updates stock and maintains purchase-side traceability. Use this for normal inward rather than Inventory manual adjustment.`
  },
  {
    id: 'orders',
    title: 'Orders',
    section: 'Modules',
    moduleId: 'orders',
    tags: ['orders', 'sales order', 'delivery', 'status', 'commercial header'],
    content: `Orders tracks customer sales orders and fulfillment status. The form contains commercial header and order lines. Orders normally move through Pending, Confirmed, In Production, Shipped, and Delivered. Update status on time so dashboards and reports remain reliable.`
  },
  {
    id: 'reports',
    title: 'Reports and Analytics',
    section: 'Modules',
    moduleId: 'reports',
    tags: ['reports', 'analytics', 'stock value', 'revenue', 'vendor purchase', 'category'],
    content: `Reports provides management insight through stock value by category, top value items, detailed stock report, monthly order revenue, throughput, status split, vendor purchase report, and category analysis. Use exports for management review and external reporting.`
  },
  {
    id: 'alerts-notifications',
    title: 'Alerts and Notifications',
    section: 'Modules',
    moduleId: 'notifications',
    tags: ['alerts', 'notifications', 'low stock', 'reminders', 'exceptions'],
    content: `Alerts and Notifications lists system reminders such as low stock and operational exceptions. Review alerts daily and clear them only after action is taken. Managers should use the list as a follow-up queue.`
  },
  {
    id: 'settings-company-users',
    title: 'Settings, Company, Modules, and Users',
    section: 'Administration',
    requiresSettings: true,
    tags: ['settings', 'company', 'users', 'roles', 'module access', 'shortcuts'],
    content: `Settings controls company profile, module access, user records, backup, and data locations. Company Profile stores company name, GST, address, phone, email, currency symbol, and thresholds. Module Access controls enabled modules and menu shortcuts. Users manages usernames, passwords, roles, and per-user access.`
  },
  {
    id: 'backup-local',
    title: 'Backup and Restore',
    section: 'Administration',
    requiresSettings: true,
    tags: ['backup', 'restore', 'database', 'accounting database', 'auto backup'],
    content: `Backup & Data manages cloud backup, local backup, restore, and database locations. Each backup run includes both the ERP master database and the accounting database. Main actions are Save Auto Backup Settings, Run Backup Now, Restore Database, Change Location, and Change Accounting Location. Restore replaces the live ERP database with the selected backup file, so only admins should perform it.`
  },
  {
    id: 'google-drive-setup',
    title: 'Google Drive Backup Setup',
    section: 'Cloud Backup',
    requiresSettings: true,
    tags: ['google drive', 'backup', 'oauth', 'client id', 'client secret', 'folder id', 'cloud'],
    content: `For direct Google Drive backup, open Google Cloud Console, enable Google Drive API, configure the OAuth consent screen, and create a Desktop App OAuth client. In OWNERP Settings, choose Backup Provider as Google Drive API Login, enter Client ID, Client Secret, and Drive folder URL or folder ID, then save and connect Google Drive. OWNERP creates both backup files locally and uploads them automatically to the selected Drive month folder.`
  },
  {
    id: 'google-drive-security',
    title: 'Google Drive Login Storage and Security',
    section: 'Cloud Backup',
    requiresSettings: true,
    tags: ['google drive', 'token', 'security', 'refresh token', 'login storage'],
    content: `OWNERP does not store the Google password. It stores the Google OAuth refresh token in the local desktop app configuration on the PC so scheduled uploads can continue without repeated login prompts. The app shows the Login Storage path inside Settings. For stronger protection in production, token storage should be moved to Windows-protected storage such as DPAPI or Credential Manager.`
  },
  {
    id: 'daily-routine',
    title: 'Daily, Weekly, and Monthly Routine',
    section: 'Operations',
    tags: ['daily routine', 'weekly routine', 'monthly routine', 'operations'],
    content: `Daily routine: review Dashboard, process quotations and orders, enter GRNs, post receipts and payments, and review alerts. Weekly routine: review low stock, reconcile bank statements, review receivables and payables, and verify backup status. Monthly routine: review revenue reports, stock valuation, payroll, tax and ledger controls, and confirm both master and accounting backups are available.`
  }
];

export function getVisibleHelpArticles(user, settings = {}) {
  return HELP_ARTICLES.filter((article) => {
    if (article.requiresSettings) {
      return canAccessSettings(user);
    }

    if (article.moduleId) {
      return canAccessModule(user, settings, article.moduleId);
    }

    return true;
  });
}

export function searchHelpArticles(query, articles = HELP_ARTICLES) {
  const normalized = `${query || ''}`.trim().toLowerCase();
  if (!normalized) return articles;

  return articles
    .map((article) => {
      const haystack = [
        article.title,
        article.section,
        article.content,
        ...(article.tags || [])
      ].join(' ').toLowerCase();

      let score = 0;
      if (article.title.toLowerCase().includes(normalized)) score += 6;
      if (article.section.toLowerCase().includes(normalized)) score += 3;
      if ((article.tags || []).some((tag) => tag.toLowerCase().includes(normalized))) score += 4;
      if (haystack.includes(normalized)) score += 1;

      return { ...article, score };
    })
    .filter((article) => article.score > 0)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}
