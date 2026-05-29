import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen, ReceiptText, Scale, ShieldCheck, Wallet, Building2, BrainCircuit,
  Database, Download, Plus, Save, RefreshCw, AlertTriangle, CheckCircle2, Landmark, X,
  User, Phone, MapPin, DollarSign, Zap, Package, Search, Trash, Edit2
} from 'lucide-react';
import { useAppStore } from '../store/appStore';
import db, { formatCurrency, formatDate, generateId } from '../utils/database';
import accountingDb from '../utils/accountingDatabase';
import { answerAccountingQuestion, buildAccountingSuggestions } from '../utils/accountingAdvisor';
import { getDocumentTemplateDefaults } from '../utils/documentTemplates';
import VoucherWorkbench from '../components/accounting/VoucherWorkbench';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const today = () => new Date().toISOString().slice(0, 10);
const newLine = () => ({ product_id: '', product_name: '', hsn_sac: '', quantity: 1, unit: 'PCS', rate: 0, gst_rate: 18 });
const newProformaLine = () => ({ id: generateId(), product_id: '', description: '', quantity: 1, unit_price: 0, tax_rate: 18 });
const newQuickProductForm = () => ({ name: '', code: '', description: '', unit: 'PCS', hsn_code: '', gst_rate: 18, selling_price: 0, cost_price: 0 });
const newCustomerContactForm = () => ({
  type: 'customer',
  name: '',
  company: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  gst_number: '',
  pan_number: '',
  credit_limit: 0,
  account_holder_name: '',
  bank_name: '',
  branch_name: '',
  account_number: '',
  account_type: 'current',
  ifsc_code: '',
  swift_code: '',
  iban: '',
  upi_id: '',
  preferred_payment_method: 'bank_transfer',
  payment_terms_days: 0,
  bank_address: '',
  notes: ''
});
const newVendorContactForm = () => ({ ...newCustomerContactForm(), type: 'vendor' });
const generateProformaNumber = () => `PI-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
const generateVoucherNumber = (prefix) => `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
const shiftDate = (dateString, days) => {
  const base = new Date(dateString || today());
  base.setDate(base.getDate() + Number(days || 0));
  return base.toISOString().slice(0, 10);
};
const formatPaymentMethod = (value) => {
  const labels = {
    bank_transfer: 'Bank Transfer / NEFT / RTGS',
    upi: 'UPI',
    cheque: 'Cheque',
    cash: 'Cash',
    card: 'Card / POS',
    other: 'Other'
  };
  return labels[value] || 'Not set';
};
const maskAccountNumber = (value) => {
  const clean = `${value || ''}`.replace(/\s+/g, '');
  if (!clean) return '-';
  if (clean.length <= 4) return clean;
  return `${'*'.repeat(Math.max(clean.length - 4, 0))}${clean.slice(-4)}`;
};
const encodeArrayBufferToBase64 = (arrayBuffer) => {
  let binary = '';
  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return window.btoa(binary);
};
const calculateAgingBuckets = (rows, amountKey = 'outstanding_amount') => rows.reduce((acc, row) => {
  const amount = Number(row[amountKey] || 0);
  if (amount <= 0) return acc;
  const dueDate = row.due_date ? new Date(row.due_date) : null;
  const diffDays = dueDate ? Math.floor((new Date() - dueDate) / (1000 * 60 * 60 * 24)) : 0;
  if (diffDays <= 0) acc.current += amount;
  else if (diffDays <= 30) acc.bucket30 += amount;
  else if (diffDays <= 60) acc.bucket60 += amount;
  else if (diffDays <= 90) acc.bucket90 += amount;
  else acc.bucket120 += amount;
  return acc;
}, { current: 0, bucket30: 0, bucket60: 0, bucket90: 0, bucket120: 0 });
const getPartyDisplayName = (row) => (row?.company || row?.name || '').trim();
const getPartyGroupKey = (row) => {
  const displayName = getPartyDisplayName(row).toLowerCase();
  const gst = `${row?.gst_number || ''}`.trim().toLowerCase();
  const email = `${row?.email || ''}`.trim().toLowerCase();
  const phone = `${row?.phone || ''}`.trim().toLowerCase();
  return displayName || gst || email || phone || `${row?.id || ''}`;
};
const ACCOUNTING_TABS = [
  { id: 'overview', label: 'Overview', hotkey: 'Alt+1' },
  { id: 'billing', label: 'Billing', hotkey: 'Alt+2' },
  { id: 'settlement', label: 'Settlement', hotkey: 'Alt+3' },
  { id: 'proforma', label: 'Proforma', hotkey: 'Alt+4' },
  { id: 'voucher', label: 'Voucher', hotkey: 'Alt+5' },
  { id: 'parties', label: 'Parties', hotkey: 'Alt+6' },
  { id: 'banking', label: 'Banking', hotkey: 'Alt+7' },
  { id: 'ledger', label: 'Ledger', hotkey: 'Alt+8' },
  { id: 'advisor', label: 'Advisor', hotkey: 'Alt+9' },
  { id: 'control', label: 'Data Control', hotkey: 'Alt+0' }
];

function getTabHotkeySignature(event) {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return '';
  return `ALT+${event.key}`;
}

function calcTotals(items, supplyType) {
  const normalized = items.map((item) => {
    const taxable = Number(item.quantity || 0) * Number(item.rate || 0);
    const tax = taxable * (Number(item.gst_rate || 0) / 100);
    return {
      ...item,
      taxable_amount: taxable,
      cgst_amount: supplyType === 'intra-state' ? tax / 2 : 0,
      sgst_amount: supplyType === 'intra-state' ? tax / 2 : 0,
      igst_amount: supplyType === 'inter-state' ? tax : 0,
      line_total: taxable + tax
    };
  });

  const taxable = normalized.reduce((sum, item) => sum + item.taxable_amount, 0);
  const cgst = normalized.reduce((sum, item) => sum + item.cgst_amount, 0);
  const sgst = normalized.reduce((sum, item) => sum + item.sgst_amount, 0);
  const igst = normalized.reduce((sum, item) => sum + item.igst_amount, 0);
  return { items: normalized, taxable, cgst, sgst, igst, totalTax: cgst + sgst + igst, total: taxable + cgst + sgst + igst };
}

export default function Accounting() {
  const { settings, currentUser, addNotification } = useAppStore();
  const currencySymbol = settings.currency_symbol || '\u20B9';
  const companyState = settings.company_state || 'Gujarat';
  const proformaDefaults = getDocumentTemplateDefaults(settings, 'proforma');

  const [activeTab, setActiveTab] = useState('overview');
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dbInfo, setDbInfo] = useState({ folderPath: '', dbPath: '' });
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [users, setUsers] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [grns, setGrns] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [taxCodes, setTaxCodes] = useState([]);
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [purchaseBills, setPurchaseBills] = useState([]);
  const [journals, setJournals] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [assets, setAssets] = useState([]);
  const [customerExposure, setCustomerExposure] = useState([]);
  const [vendorExposure, setVendorExposure] = useState([]);
  const [proformas, setProformas] = useState([]);
  const [receiptVouchers, setReceiptVouchers] = useState([]);
  const [paymentVouchers, setPaymentVouchers] = useState([]);
  const [bankTransactions, setBankTransactions] = useState([]);
  const [reconciliationLines, setReconciliationLines] = useState([]);
  const [partyFollowups, setPartyFollowups] = useState([]);
  const [dispatchLogs, setDispatchLogs] = useState([]);
  const [accountingSettings, setAccountingSettings] = useState({});
  const [metrics, setMetrics] = useState({ receivables: 0, overdue: 0, payables: 0, cash: 0, outputTax: 0, inputTax: 0, assetBase: 0, pendingJournals: 0, hsnGaps: 0 });
  const [bridge, setBridge] = useState({ customers: 0, vendors: 0, orders: 0, grns: 0 });
  const [salesForm, setSalesForm] = useState({ customer_id: '', customer_name: '', customer_gst: '', source_order_id: '', source_proforma_id: '', source_proforma_number: '', invoice_date: today(), due_date: today(), place_of_supply: companyState, supply_type: 'intra-state', notes: '', items: [newLine()] });
  const [purchaseForm, setPurchaseForm] = useState({ vendor_id: '', vendor_name: '', vendor_gst: '', source_grn_id: '', bill_date: today(), due_date: today(), place_of_supply: companyState, supply_type: 'intra-state', itc_eligible: true, notes: '', items: [newLine()] });
  const [receiptForm, setReceiptForm] = useState({ customer_id: '', bank_account_id: '', receipt_date: today(), payment_mode: 'bank_transfer', reference_number: '', narration: '', allocations: [] });
  const [paymentForm, setPaymentForm] = useState({ vendor_id: '', bank_account_id: '', payment_date: today(), payment_mode: 'bank_transfer', reference_number: '', narration: '', allocations: [] });
  const [reconciliationForm, setReconciliationForm] = useState({ bank_account_id: '', statement_date: today(), reference_number: '', description: '', entry_type: 'credit', amount: '', notes: '' });
  const [journalForm, setJournalForm] = useState({ narration: '', lines: [{ account_code: '5300', debit_amount: 0, credit_amount: 0 }, { account_code: '1000', debit_amount: 0, credit_amount: 0 }] });
  const [assetForm, setAssetForm] = useState({ asset_name: '', category: 'Plant & Machinery', capitalization_date: today(), gross_value: 0, salvage_value: 0, useful_life_months: 60, depreciation_method: 'SLM', linked_purchase_bill_id: '' });
  const [proformaModalOpen, setProformaModalOpen] = useState(false);
  const [editingProformaId, setEditingProformaId] = useState(null);
  const [quickProductModalOpen, setQuickProductModalOpen] = useState(false);
  const [quickProductLineId, setQuickProductLineId] = useState(null);
  const [quickProductForm, setQuickProductForm] = useState(newQuickProductForm());
  const [partyLedgerModalOpen, setPartyLedgerModalOpen] = useState(false);
  const [partyLedgerLoading, setPartyLedgerLoading] = useState(false);
  const [partyLedgerData, setPartyLedgerData] = useState(null);
  const [followupForm, setFollowupForm] = useState({ followup_type: 'statement', subject: '', notes: '', due_date: today(), assigned_to: '' });
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchBusy, setDispatchBusy] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({ document_type: '', document_id: '', document_number: '', recipient_email: '', sender_key: 'company', subject: '', body: '', attachment_name: '', attachment_base64: '', related_party_id: '', related_party_type: '' });
  const [proformaForm, setProformaForm] = useState({
    proforma_number: generateProformaNumber(),
    customer_id: '',
    source_order_id: '',
    sender_key: 'company',
    issue_date: today(),
    valid_till: shiftDate(today(), 7),
    status: 'draft',
    subject: proformaDefaults.subject,
    mail_draft: proformaDefaults.mailDraft,
    notes: '',
    terms: proformaDefaults.terms,
    items: [newProformaLine()]
  });
  const [advisorQuestion, setAdvisorQuestion] = useState('');
  const [advisorAnswer, setAdvisorAnswer] = useState('');
  const [customerSearchModal, setCustomerSearchModal] = useState(false);
  const [vendorSearchModal, setVendorSearchModal] = useState(false);
  const [customerEditorOpen, setCustomerEditorOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [customerContactForm, setCustomerContactForm] = useState(newCustomerContactForm());
  const [customerContactErrors, setCustomerContactErrors] = useState({});
  const [vendorEditorOpen, setVendorEditorOpen] = useState(false);
  const [editingVendorId, setEditingVendorId] = useState(null);
  const [vendorContactForm, setVendorContactForm] = useState(newVendorContactForm());
  const [vendorContactErrors, setVendorContactErrors] = useState({});
  const [customerSearch, setCustomerSearch] = useState('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [productSearchModal, setProductSearchModal] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productLineMode, setProductLineMode] = useState(null); // 'sales' or 'purchase'
  const accountingTabHotkeys = useMemo(
    () => Object.fromEntries(ACCOUNTING_TABS.map((tab) => [tab.hotkey.toUpperCase(), tab.id])),
    []
  );

  const salesPreview = useMemo(() => calcTotals(salesForm.items, salesForm.supply_type), [salesForm]);
  const purchasePreview = useMemo(() => calcTotals(purchaseForm.items, purchaseForm.supply_type), [purchaseForm]);
  const selectedCustomer = useMemo(() => customers.find((entry) => entry.id === salesForm.customer_id) || null, [customers, salesForm.customer_id]);
  const selectedVendor = useMemo(() => vendors.find((entry) => entry.id === purchaseForm.vendor_id) || null, [purchaseForm.vendor_id, vendors]);
  const senderOptions = useMemo(() => {
    const options = [];
    if (settings.company_email) {
      options.push({
        key: 'company',
        label: settings.company_name || 'Company Sender',
        email: settings.company_email,
        name: settings.company_name || 'Company'
      });
    }
    users.filter((user) => user.email).forEach((user) => {
      options.push({
        key: `user:${user.id}`,
        label: `${user.full_name || user.username || 'User'} (${user.role || 'user'})`,
        email: user.email,
        name: user.full_name || user.username || 'User',
        userId: user.id
      });
    });
    return options;
  }, [settings.company_email, settings.company_name, users]);
  const activeSender = useMemo(
    () => senderOptions.find((option) => option.key === proformaForm.sender_key) || senderOptions[0] || null,
    [proformaForm.sender_key, senderOptions]
  );
  const selectedProformaCustomer = useMemo(() => customers.find((entry) => entry.id === proformaForm.customer_id) || null, [customers, proformaForm.customer_id]);
  const proformaPreview = useMemo(() => {
    const normalizedItems = (proformaForm.items || []).map((item) => {
      const quantity = Number(item.quantity || 0);
      const rate = Number(item.unit_price || 0);
      const taxRate = Number(item.tax_rate || 0);
      const taxable = quantity * rate;
      const taxAmount = taxable * (taxRate / 100);
      return { ...item, taxable, taxAmount, lineTotal: taxable + taxAmount };
    });
    const subtotal = normalizedItems.reduce((sum, item) => sum + item.taxable, 0);
    const tax = normalizedItems.reduce((sum, item) => sum + item.taxAmount, 0);
    return { items: normalizedItems, subtotal, tax, total: subtotal + tax };
  }, [proformaForm.items]);
  const customerExposureMap = useMemo(() => Object.fromEntries(customerExposure.map((row) => [row.customer_id, row])), [customerExposure]);
  const vendorExposureMap = useMemo(() => Object.fromEntries(vendorExposure.map((row) => [row.vendor_id, row])), [vendorExposure]);
  const unifiedParties = useMemo(() => {
    const grouped = new Map();
    const upsertGroup = (entry, role) => {
      const key = getPartyGroupKey(entry);
      if (!grouped.has(key)) {
        grouped.set(key, {
          key,
          displayName: getPartyDisplayName(entry) || 'Unnamed party',
          email: entry.email || '',
          phone: entry.phone || '',
          gst_number: entry.gst_number || '',
          state: entry.state || '',
          credit_limit: Number(entry.credit_limit || 0),
          payment_terms_days: Number(entry.payment_terms_days || 0),
          preferred_payment_method: entry.preferred_payment_method || '',
          account_holder_name: entry.account_holder_name || '',
          bank_name: entry.bank_name || '',
          branch_name: entry.branch_name || '',
          account_number: entry.account_number || '',
          account_type: entry.account_type || '',
          ifsc_code: entry.ifsc_code || '',
          swift_code: entry.swift_code || '',
          iban: entry.iban || '',
          upi_id: entry.upi_id || '',
          customer: null,
          vendor: null
        });
      }

      const group = grouped.get(key);
      group[role] = entry;
      group.displayName = group.displayName || getPartyDisplayName(entry) || 'Unnamed party';
      group.email = group.email || entry.email || '';
      group.phone = group.phone || entry.phone || '';
      group.gst_number = group.gst_number || entry.gst_number || '';
      group.state = group.state || entry.state || '';
      group.credit_limit = Math.max(group.credit_limit, Number(entry.credit_limit || 0));
      group.payment_terms_days = Math.max(group.payment_terms_days, Number(entry.payment_terms_days || 0));
      group.preferred_payment_method = group.preferred_payment_method || entry.preferred_payment_method || '';
      group.account_holder_name = group.account_holder_name || entry.account_holder_name || '';
      group.bank_name = group.bank_name || entry.bank_name || '';
      group.branch_name = group.branch_name || entry.branch_name || '';
      group.account_number = group.account_number || entry.account_number || '';
      group.account_type = group.account_type || entry.account_type || '';
      group.ifsc_code = group.ifsc_code || entry.ifsc_code || '';
      group.swift_code = group.swift_code || entry.swift_code || '';
      group.iban = group.iban || entry.iban || '';
      group.upi_id = group.upi_id || entry.upi_id || '';
    };

    customers.forEach((entry) => upsertGroup(entry, 'customer'));
    vendors.forEach((entry) => upsertGroup(entry, 'vendor'));

    return Array.from(grouped.values())
      .map((group) => {
        const customerSide = group.customer ? customerExposureMap[group.customer.id] || {} : {};
        const vendorSide = group.vendor ? vendorExposureMap[group.vendor.id] || {} : {};
        const routing = group.ifsc_code || group.upi_id || group.swift_code || group.iban || 'Pending';
        const bankReady = Boolean((group.bank_name || group.account_number || group.upi_id) && routing !== 'Pending');
        const receivable = Number(customerSide.outstanding_amount || 0);
        const payable = Number(vendorSide.outstanding_amount || 0);
        const overdue = Number(customerSide.overdue_amount || 0) + Number(vendorSide.overdue_amount || 0);
        const relationshipSummary = group.customer && group.vendor
          ? 'Collections and settlements enabled'
          : group.customer
            ? 'Collections enabled'
            : 'Settlements enabled';

        return {
          ...group,
          routing,
          bankReady,
          receivable,
          payable,
          overdue,
          totalExposure: receivable + payable,
          relationshipSummary
        };
      })
      .sort((left, right) => {
        const exposureDelta = Number(right.totalExposure || 0) - Number(left.totalExposure || 0);
        if (exposureDelta !== 0) return exposureDelta;
        return left.displayName.localeCompare(right.displayName);
      });
  }, [customerExposureMap, customers, vendorExposureMap, vendors]);
  const unifiedPartyStats = useMemo(() => ({
    total: unifiedParties.length,
    bankReady: unifiedParties.filter((row) => row.bankReady).length,
    dualSide: unifiedParties.filter((row) => row.customer && row.vendor).length
  }), [unifiedParties]);
  const bankAccountMap = useMemo(() => Object.fromEntries(bankAccounts.map((row) => [row.id, row])), [bankAccounts]);
  const unreconciledBankTransactionIds = useMemo(
    () => new Set(reconciliationLines.filter((row) => row.bank_transaction_id && row.status === 'matched').map((row) => row.bank_transaction_id)),
    [reconciliationLines]
  );
  const receiptAmount = useMemo(
    () => receiptForm.allocations.reduce((sum, row) => sum + Number(row.allocated_amount || 0), 0),
    [receiptForm.allocations]
  );
  const paymentAmount = useMemo(
    () => paymentForm.allocations.reduce((sum, row) => sum + Number(row.allocated_amount || 0), 0),
    [paymentForm.allocations]
  );
  const suggestions = useMemo(() => buildAccountingSuggestions({
    receivablesOutstanding: metrics.receivables,
    overdueReceivables: metrics.overdue,
    payablesOutstanding: metrics.payables,
    payablesNext7Days: metrics.payables,
    availableCash: metrics.cash,
    outputTax: metrics.outputTax,
    inputTax: metrics.inputTax,
    assetBase: metrics.assetBase,
    unpostedJournals: metrics.pendingJournals,
    productsWithoutHsn: metrics.hsnGaps
  }, { currencySymbol }), [metrics, currencySymbol]);

  // Initial workspace hydration intentionally runs once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    const handleAccountingTabHotkey = (event) => {
      if (event.defaultPrevented || event.isComposing) return;
      const nextTab = accountingTabHotkeys[getTabHotkeySignature(event).toUpperCase()];
      if (!nextTab) return;
      event.preventDefault();
      event.stopPropagation();
      setActiveTab(nextTab);
    };

    window.addEventListener('keydown', handleAccountingTabHotkey);
    return () => window.removeEventListener('keydown', handleAccountingTabHotkey);
  }, [accountingTabHotkeys]);

  const flash = (type, message) => {
    setStatus({ type, message });
    setTimeout(() => setStatus(null), 3500);
  };

  const accountByCode = (code, fallback = code) => {
    const account = accounts.find((entry) => entry.code === code);
    return { account_id: account?.id || null, account_code: code, account_name: account?.name || fallback };
  };

  const applyCustomerToSalesForm = (customer) => {
    if (!customer) return;
    const supply_type = customer.state && customer.state !== companyState ? 'inter-state' : 'intra-state';
    const paymentTermsDays = Number(customer.payment_terms_days || 0);
    setSalesForm((prev) => ({
      ...prev,
      customer_id: customer.id,
      customer_name: customer.company || customer.name,
      customer_gst: customer.gst_number || '',
      place_of_supply: customer.state || companyState,
      supply_type,
      due_date: shiftDate(prev.invoice_date, paymentTermsDays)
    }));
  };

  const applyVendorToPurchaseForm = (vendor) => {
    if (!vendor) return;
    const supply_type = vendor.state && vendor.state !== companyState ? 'inter-state' : 'intra-state';
    const paymentTermsDays = Number(vendor.payment_terms_days || 0);
    setPurchaseForm((prev) => ({
      ...prev,
      vendor_id: vendor.id,
      vendor_name: vendor.company || vendor.name,
      vendor_gst: vendor.gst_number || '',
      place_of_supply: vendor.state || companyState,
      supply_type,
      due_date: shiftDate(prev.bill_date, paymentTermsDays)
    }));
  };

  const loadAll = async () => {
    setLoading(true);
    try {
      const [customerRows, vendorRows, userRows, productRows, orderRows, grnRows, proformaRows, accountRows, taxRows, invoiceRows, billRows, journalRows, bankRows, bankTxnRows, receiptRows, paymentRows, reconciliationRows, followupRows, dispatchRows, assetRows, accountingSettingsRows, metricsRows, bridgeRows, customerExposureRows, vendorExposureRows, info] = await Promise.all([
        db.all("SELECT id, name, company, email, phone, gst_number, state, credit_limit, account_holder_name, bank_name, branch_name, account_number, account_type, ifsc_code, swift_code, iban, upi_id, preferred_payment_method, payment_terms_days FROM contacts WHERE type='customer' AND is_active=1 ORDER BY name"),
        db.all("SELECT id, name, company, email, phone, gst_number, state, credit_limit, account_holder_name, bank_name, branch_name, account_number, account_type, ifsc_code, swift_code, iban, upi_id, preferred_payment_method, payment_terms_days FROM contacts WHERE type='vendor' AND is_active=1 ORDER BY name"),
        db.all(`
          SELECT id, username, full_name, email, role
          FROM users
          WHERE is_active = 1
            AND COALESCE(is_hidden, 0) = 0
            AND COALESCE(is_protected, 0) = 0
            AND LOWER(COALESCE(role, '')) <> 'developer'
            AND LOWER(COALESCE(username, '')) <> 'developer'
          ORDER BY COALESCE(full_name, username)
        `),
        db.all("SELECT id, name, code, description, hsn_code, gst_rate, selling_price, cost_price, unit FROM products WHERE is_active=1 ORDER BY name"),
        db.all("SELECT id, order_number FROM orders ORDER BY created_at DESC LIMIT 20"),
        db.all("SELECT id, grn_number FROM grn ORDER BY created_at DESC LIMIT 20"),
        db.all(`SELECT p.*, c.name as customer_name, c.company as customer_company, o.order_number
          FROM proforma_invoices p
          LEFT JOIN contacts c ON c.id = p.customer_id
          LEFT JOIN orders o ON o.id = p.source_order_id
          ORDER BY p.created_at DESC`),
        accountingDb.all('SELECT * FROM coa_accounts WHERE is_active=1 ORDER BY CAST(code AS INTEGER)'),
        accountingDb.all('SELECT * FROM tax_codes WHERE is_active=1 ORDER BY rate'),
        accountingDb.all('SELECT * FROM sales_invoices ORDER BY created_at DESC LIMIT 20'),
        accountingDb.all('SELECT * FROM purchase_bills ORDER BY created_at DESC LIMIT 20'),
        accountingDb.all('SELECT * FROM journal_entries ORDER BY created_at DESC LIMIT 20'),
        accountingDb.all('SELECT * FROM bank_accounts WHERE is_active=1 ORDER BY account_name'),
        accountingDb.all(`SELECT bt.*, ba.account_name
          FROM bank_transactions bt
          LEFT JOIN bank_accounts ba ON ba.id = bt.bank_account_id
          ORDER BY bt.transaction_date DESC, bt.created_at DESC
          LIMIT 50`),
        accountingDb.all(`SELECT rv.*, ba.account_name
          FROM receipt_vouchers rv
          LEFT JOIN bank_accounts ba ON ba.id = rv.bank_account_id
          ORDER BY rv.created_at DESC
          LIMIT 25`),
        accountingDb.all(`SELECT pv.*, ba.account_name
          FROM payment_vouchers pv
          LEFT JOIN bank_accounts ba ON ba.id = pv.bank_account_id
          ORDER BY pv.created_at DESC
          LIMIT 25`),
        accountingDb.all(`SELECT brl.*, ba.account_name, bt.description as bank_transaction_description
          FROM bank_reconciliation_lines brl
          LEFT JOIN bank_accounts ba ON ba.id = brl.bank_account_id
          LEFT JOIN bank_transactions bt ON bt.id = brl.bank_transaction_id
          ORDER BY brl.statement_date DESC, brl.created_at DESC
          LIMIT 80`),
        accountingDb.all('SELECT * FROM party_followups ORDER BY due_date ASC, created_at DESC LIMIT 50'),
        accountingDb.all('SELECT * FROM document_dispatch_logs ORDER BY created_at DESC LIMIT 30'),
        accountingDb.all('SELECT * FROM fixed_assets ORDER BY capitalization_date DESC'),
        accountingDb.all('SELECT key, value FROM accounting_settings'),
        Promise.all([
          accountingDb.get('SELECT COALESCE(SUM(outstanding_amount),0) amount FROM sales_invoices WHERE outstanding_amount > 0'),
          accountingDb.get("SELECT COALESCE(SUM(outstanding_amount),0) amount FROM sales_invoices WHERE outstanding_amount > 0 AND due_date < date('now')"),
          accountingDb.get('SELECT COALESCE(SUM(outstanding_amount),0) amount FROM purchase_bills WHERE outstanding_amount > 0'),
          accountingDb.get('SELECT COALESCE(SUM(current_balance),0) amount FROM bank_accounts WHERE is_active=1'),
          accountingDb.get("SELECT COALESCE(SUM(total_tax),0) amount FROM sales_invoices WHERE strftime('%Y-%m', invoice_date)=strftime('%Y-%m','now')"),
          accountingDb.get("SELECT COALESCE(SUM(total_tax),0) amount FROM purchase_bills WHERE strftime('%Y-%m', bill_date)=strftime('%Y-%m','now') AND itc_eligible=1"),
          accountingDb.get("SELECT COALESCE(SUM(gross_value),0) amount FROM fixed_assets WHERE status='active'"),
          accountingDb.get("SELECT COUNT(*) count FROM journal_entries WHERE posting_status <> 'posted'"),
          db.get("SELECT COUNT(*) count FROM products WHERE is_active=1 AND (hsn_code IS NULL OR trim(hsn_code)='')")
        ]),
        Promise.all([
          db.get("SELECT COUNT(*) count FROM contacts WHERE type='customer' AND is_active=1"),
          db.get("SELECT COUNT(*) count FROM contacts WHERE type='vendor' AND is_active=1"),
          db.get("SELECT COUNT(*) count FROM orders WHERE status IN ('pending','in_production','shipped')"),
          db.get('SELECT COUNT(*) count FROM grn')
        ]),
        accountingDb.all(`SELECT customer_id, customer_name, COUNT(*) invoice_count,
          COALESCE(SUM(total_amount),0) billed_amount,
          COALESCE(SUM(outstanding_amount),0) outstanding_amount,
          COALESCE(SUM(CASE WHEN due_date < date('now') THEN outstanding_amount ELSE 0 END),0) overdue_amount
          FROM sales_invoices
          GROUP BY customer_id, customer_name
          ORDER BY outstanding_amount DESC, billed_amount DESC
          LIMIT 10`),
        accountingDb.all(`SELECT vendor_id, vendor_name, COUNT(*) bill_count,
          COALESCE(SUM(total_amount),0) billed_amount,
          COALESCE(SUM(outstanding_amount),0) outstanding_amount,
          COALESCE(SUM(CASE WHEN due_date < date('now') THEN outstanding_amount ELSE 0 END),0) overdue_amount
          FROM purchase_bills
          GROUP BY vendor_id, vendor_name
          ORDER BY outstanding_amount DESC, billed_amount DESC
          LIMIT 10`),
        window.electronAPI?.getAccountingDatabaseInfo ? window.electronAPI.getAccountingDatabaseInfo() : Promise.resolve({ folderPath: '', dbPath: '' })
      ]);

      const settingsMap = {};
      accountingSettingsRows.forEach((row) => { settingsMap[row.key] = row.value; });
      setCustomers(customerRows); setVendors(vendorRows); setUsers(userRows); setProducts(productRows); setOrders(orderRows); setGrns(grnRows); setProformas(proformaRows || []);
      setAccounts(accountRows); setTaxCodes(taxRows); setSalesInvoices(invoiceRows); setPurchaseBills(billRows); setJournals(journalRows); setBankAccounts(bankRows); setBankTransactions(bankTxnRows || []);
      setReceiptVouchers(receiptRows || []); setPaymentVouchers(paymentRows || []); setReconciliationLines(reconciliationRows || []); setPartyFollowups(followupRows || []); setDispatchLogs(dispatchRows || []); setAssets(assetRows);
      setCustomerExposure(customerExposureRows || []);
      setVendorExposure(vendorExposureRows || []);
      setAccountingSettings(settingsMap); setDbInfo(info || { folderPath: '', dbPath: '' });
      setMetrics({
        receivables: metricsRows[0]?.amount || 0,
        overdue: metricsRows[1]?.amount || 0,
        payables: metricsRows[2]?.amount || 0,
        cash: metricsRows[3]?.amount || 0,
        outputTax: metricsRows[4]?.amount || 0,
        inputTax: metricsRows[5]?.amount || 0,
        assetBase: metricsRows[6]?.amount || 0,
        pendingJournals: metricsRows[7]?.count || 0,
        hsnGaps: metricsRows[8]?.count || 0
      });
      setBridge({ customers: bridgeRows[0]?.count || 0, vendors: bridgeRows[1]?.count || 0, orders: bridgeRows[2]?.count || 0, grns: bridgeRows[3]?.count || 0 });
    } catch (err) {
      flash('error', err.message);
    } finally {
      setLoading(false);
    }
  };

  const postJournal = async (voucherType, referenceType, referenceId, narration, lines, autoPosted = true) => {
    const journalId = generateId();
    const voucherNumber = `${accountingSettings.journal_prefix || 'JV'}-${Date.now()}`;
    await accountingDb.run(
      'INSERT INTO journal_entries (id,voucher_number,voucher_type,voucher_date,posting_status,reference_type,reference_id,narration,source_module,auto_posted,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [journalId, voucherNumber, voucherType, today(), 'posted', referenceType, referenceId, narration, 'accounting', autoPosted ? 1 : 0, currentUser?.id || 'system']
    );
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      await accountingDb.run(
        'INSERT INTO journal_lines (id,journal_id,line_number,account_id,account_code,account_name,description,debit_amount,credit_amount) VALUES (?,?,?,?,?,?,?,?,?)',
        [generateId(), journalId, i + 1, line.account_id, line.account_code, line.account_name, narration, Number(line.debit_amount || 0), Number(line.credit_amount || 0)]
      );
    }
  };

  const setProductLine = (form, setForm, index, productId) => {
    const product = products.find((entry) => entry.id === productId);
    if (!product) return;
    const items = [...form.items];
    items[index] = { ...items[index], product_id: product.id, product_name: product.name, hsn_sac: product.hsn_code || '', unit: product.unit || 'PCS', rate: product.selling_price || product.cost_price || 0, gst_rate: product.gst_rate || 18 };
    setForm({ ...form, items });
  };

  const setParty = (type, id) => {
    const party = (type === 'customer' ? customers : vendors).find((entry) => entry.id === id);
    if (!party) return;
    if (type === 'customer') {
      applyCustomerToSalesForm(party);
    }
    if (type === 'vendor') {
      applyVendorToPurchaseForm(party);
    }
  };

  const openCustomerContactEditor = (customer = null) => {
    setEditingCustomerId(customer?.id || null);
    setCustomerContactForm({ ...newCustomerContactForm(), ...(customer || {}), type: 'customer' });
    setCustomerContactErrors({});
    setCustomerEditorOpen(true);
  };

  const closeCustomerContactEditor = () => {
    setCustomerEditorOpen(false);
    setEditingCustomerId(null);
    setCustomerContactForm(newCustomerContactForm());
    setCustomerContactErrors({});
  };

  const updateCustomerContactField = (field, value) => {
    setCustomerContactForm((prev) => ({ ...prev, [field]: value }));
    setCustomerContactErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const saveCustomerContact = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!`${customerContactForm.name || ''}`.trim()) errors.name = 'Contact name is required.';
    if (!`${customerContactForm.company || ''}`.trim()) errors.company = 'Company name is required.';
    if (Object.keys(errors).length) {
      setCustomerContactErrors(errors);
      return;
    }

    const payload = [
      'customer',
      customerContactForm.name.trim(),
      customerContactForm.company.trim(),
      customerContactForm.email.trim(),
      customerContactForm.phone.trim(),
      customerContactForm.address.trim(),
      customerContactForm.city.trim(),
      customerContactForm.state.trim(),
      customerContactForm.gst_number.trim(),
      customerContactForm.pan_number.trim(),
      Number(customerContactForm.credit_limit || 0),
      customerContactForm.account_holder_name.trim(),
      customerContactForm.bank_name.trim(),
      customerContactForm.branch_name.trim(),
      customerContactForm.account_number.trim(),
      customerContactForm.account_type || 'current',
      customerContactForm.ifsc_code.trim(),
      customerContactForm.swift_code.trim(),
      customerContactForm.iban.trim(),
      customerContactForm.upi_id.trim(),
      customerContactForm.preferred_payment_method || 'bank_transfer',
      Number(customerContactForm.payment_terms_days || 0),
      customerContactForm.bank_address.trim(),
      customerContactForm.notes.trim()
    ];

    try {
      const contactId = editingCustomerId || generateId();
      if (editingCustomerId) {
        await db.run(
          `UPDATE contacts
           SET type=?,name=?,company=?,email=?,phone=?,address=?,city=?,state=?,gst_number=?,pan_number=?,credit_limit=?,
               account_holder_name=?,bank_name=?,branch_name=?,account_number=?,account_type=?,ifsc_code=?,swift_code=?,
               iban=?,upi_id=?,preferred_payment_method=?,payment_terms_days=?,bank_address=?,notes=?
           WHERE id=?`,
          [...payload, contactId]
        );
      } else {
        await db.run(
          `INSERT INTO contacts (
            id,type,name,company,email,phone,address,city,state,gst_number,pan_number,credit_limit,
            account_holder_name,bank_name,branch_name,account_number,account_type,ifsc_code,swift_code,
            iban,upi_id,preferred_payment_method,payment_terms_days,bank_address,notes
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [contactId, ...payload]
        );
      }

      const savedCustomer = await db.get(
        `SELECT id, name, company, email, phone, gst_number, state, credit_limit, account_holder_name,
                bank_name, branch_name, account_number, account_type, ifsc_code, swift_code, iban, upi_id,
                preferred_payment_method, payment_terms_days, address, city, pan_number, bank_address, notes
         FROM contacts
         WHERE id = ?`,
        [contactId]
      );

      setCustomers((prev) => {
        const next = prev.some((entry) => entry.id === contactId)
          ? prev.map((entry) => (entry.id === contactId ? savedCustomer : entry))
          : [...prev, savedCustomer];
        return next.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      });
      applyCustomerToSalesForm(savedCustomer);
      setCustomerSearchModal(false);
      setCustomerSearch('');
      closeCustomerContactEditor();
      flash('success', `${savedCustomer.company || savedCustomer.name} saved and selected.`);
    } catch (err) {
      flash('error', err.message);
    }
  };

  const openVendorContactEditor = (vendor = null) => {
    setEditingVendorId(vendor?.id || null);
    setVendorContactForm({ ...newVendorContactForm(), ...(vendor || {}), type: 'vendor' });
    setVendorContactErrors({});
    setVendorEditorOpen(true);
  };

  const closeVendorContactEditor = () => {
    setVendorEditorOpen(false);
    setEditingVendorId(null);
    setVendorContactForm(newVendorContactForm());
    setVendorContactErrors({});
  };

  const updateVendorContactField = (field, value) => {
    setVendorContactForm((prev) => ({ ...prev, [field]: value }));
    setVendorContactErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const saveVendorContact = async (event) => {
    event.preventDefault();
    const errors = {};
    if (!`${vendorContactForm.name || ''}`.trim()) errors.name = 'Contact name is required.';
    if (!`${vendorContactForm.company || ''}`.trim()) errors.company = 'Company name is required.';
    if (Object.keys(errors).length) {
      setVendorContactErrors(errors);
      return;
    }

    const payload = [
      'vendor',
      vendorContactForm.name.trim(),
      vendorContactForm.company.trim(),
      vendorContactForm.email.trim(),
      vendorContactForm.phone.trim(),
      vendorContactForm.address.trim(),
      vendorContactForm.city.trim(),
      vendorContactForm.state.trim(),
      vendorContactForm.gst_number.trim(),
      vendorContactForm.pan_number.trim(),
      Number(vendorContactForm.credit_limit || 0),
      vendorContactForm.account_holder_name.trim(),
      vendorContactForm.bank_name.trim(),
      vendorContactForm.branch_name.trim(),
      vendorContactForm.account_number.trim(),
      vendorContactForm.account_type || 'current',
      vendorContactForm.ifsc_code.trim(),
      vendorContactForm.swift_code.trim(),
      vendorContactForm.iban.trim(),
      vendorContactForm.upi_id.trim(),
      vendorContactForm.preferred_payment_method || 'bank_transfer',
      Number(vendorContactForm.payment_terms_days || 0),
      vendorContactForm.bank_address.trim(),
      vendorContactForm.notes.trim()
    ];

    try {
      const contactId = editingVendorId || generateId();
      if (editingVendorId) {
        await db.run(
          `UPDATE contacts
           SET type=?,name=?,company=?,email=?,phone=?,address=?,city=?,state=?,gst_number=?,pan_number=?,credit_limit=?,
               account_holder_name=?,bank_name=?,branch_name=?,account_number=?,account_type=?,ifsc_code=?,swift_code=?,
               iban=?,upi_id=?,preferred_payment_method=?,payment_terms_days=?,bank_address=?,notes=?
           WHERE id=?`,
          [...payload, contactId]
        );
      } else {
        await db.run(
          `INSERT INTO contacts (
            id,type,name,company,email,phone,address,city,state,gst_number,pan_number,credit_limit,
            account_holder_name,bank_name,branch_name,account_number,account_type,ifsc_code,swift_code,
            iban,upi_id,preferred_payment_method,payment_terms_days,bank_address,notes
          ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [contactId, ...payload]
        );
      }

      const savedVendor = await db.get(
        `SELECT id, name, company, email, phone, gst_number, state, credit_limit, account_holder_name,
                bank_name, branch_name, account_number, account_type, ifsc_code, swift_code, iban, upi_id,
                preferred_payment_method, payment_terms_days, address, city, pan_number, bank_address, notes
         FROM contacts
         WHERE id = ?`,
        [contactId]
      );

      setVendors((prev) => {
        const next = prev.some((entry) => entry.id === contactId)
          ? prev.map((entry) => (entry.id === contactId ? savedVendor : entry))
          : [...prev, savedVendor];
        return next.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      });
      applyVendorToPurchaseForm(savedVendor);
      setVendorSearchModal(false);
      setVendorSearch('');
      closeVendorContactEditor();
      flash('success', `${savedVendor.company || savedVendor.name} saved and selected.`);
    } catch (err) {
      flash('error', err.message);
    }
  };

  const createSalesInvoice = async (e) => {
    e.preventDefault();
    if (!salesForm.customer_name || !salesPreview.items.some((item) => item.product_name)) return flash('error', 'Customer and invoice lines are required.');
    const invoiceId = generateId();
    const invoiceNumber = `${accountingSettings.sales_invoice_prefix || 'INV'}-${Date.now()}`;
    const sourceId = salesForm.source_proforma_id || salesForm.source_order_id || null;
    const sourceModule = salesForm.source_proforma_id ? 'proforma' : salesForm.source_order_id ? 'orders' : 'sales';
    await accountingDb.run('INSERT INTO sales_invoices (id,invoice_number,customer_id,customer_name,customer_gst,source_order_id,source_module,invoice_date,due_date,status,place_of_supply,supply_type,subtotal_amount,discount_amount,taxable_amount,cgst_amount,sgst_amount,igst_amount,total_tax,total_amount,outstanding_amount,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [invoiceId, invoiceNumber, salesForm.customer_id, salesForm.customer_name, salesForm.customer_gst, sourceId, sourceModule, salesForm.invoice_date, salesForm.due_date, 'open', salesForm.place_of_supply, salesForm.supply_type, salesPreview.taxable, 0, salesPreview.taxable, salesPreview.cgst, salesPreview.sgst, salesPreview.igst, salesPreview.totalTax, salesPreview.total, salesPreview.total, salesForm.notes]);
    for (let i = 0; i < salesPreview.items.length; i += 1) {
      const item = salesPreview.items[i];
      if (!item.product_name) continue;
      await accountingDb.run('INSERT INTO sales_invoice_items (id,invoice_id,line_number,product_id,product_name,hsn_sac,quantity,unit,rate,discount_percent,taxable_amount,gst_rate,cgst_amount,sgst_amount,igst_amount,line_total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [generateId(), invoiceId, i + 1, item.product_id || null, item.product_name, item.hsn_sac, item.quantity, item.unit, item.rate, 0, item.taxable_amount, item.gst_rate, item.cgst_amount, item.sgst_amount, item.igst_amount, item.line_total]);
    }
    const lines = [{ ...accountByCode('1100', 'Accounts Receivable'), debit_amount: salesPreview.total, credit_amount: 0 }, { ...accountByCode('4000', 'Sales Revenue'), debit_amount: 0, credit_amount: salesPreview.taxable }];
    if (salesPreview.cgst) lines.push({ ...accountByCode('2100', 'Output CGST'), debit_amount: 0, credit_amount: salesPreview.cgst });
    if (salesPreview.sgst) lines.push({ ...accountByCode('2110', 'Output SGST'), debit_amount: 0, credit_amount: salesPreview.sgst });
    if (salesPreview.igst) lines.push({ ...accountByCode('2120', 'Output IGST'), debit_amount: 0, credit_amount: salesPreview.igst });
    await postJournal('sales-invoice', 'sales_invoice', invoiceId, `Auto sales invoice ${invoiceNumber}`, lines, true);
    await addNotification?.('success', 'Sales invoice posted', invoiceNumber, invoiceId, 'sales_invoice');
    setSalesForm({ ...salesForm, customer_id: '', customer_name: '', customer_gst: '', source_order_id: '', source_proforma_id: '', source_proforma_number: '', notes: '', items: [newLine()] });
    flash('success', `${invoiceNumber} created.`);
    loadAll();
  };

  const createPurchaseBill = async (e) => {
    e.preventDefault();
    if (!purchaseForm.vendor_name || !purchasePreview.items.some((item) => item.product_name)) return flash('error', 'Vendor and bill lines are required.');
    const billId = generateId();
    const billNumber = `${accountingSettings.purchase_bill_prefix || 'BILL'}-${Date.now()}`;
    await accountingDb.run('INSERT INTO purchase_bills (id,bill_number,vendor_id,vendor_name,vendor_gst,source_grn_id,source_module,bill_date,due_date,status,place_of_supply,supply_type,subtotal_amount,discount_amount,taxable_amount,cgst_amount,sgst_amount,igst_amount,total_tax,total_amount,outstanding_amount,itc_eligible,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [billId, billNumber, purchaseForm.vendor_id, purchaseForm.vendor_name, purchaseForm.vendor_gst, purchaseForm.source_grn_id || null, purchaseForm.source_grn_id ? 'grn' : 'purchase', purchaseForm.bill_date, purchaseForm.due_date, 'open', purchaseForm.place_of_supply, purchaseForm.supply_type, purchasePreview.taxable, 0, purchasePreview.taxable, purchasePreview.cgst, purchasePreview.sgst, purchasePreview.igst, purchasePreview.totalTax, purchasePreview.total, purchasePreview.total, purchaseForm.itc_eligible ? 1 : 0, purchaseForm.notes]);
    for (let i = 0; i < purchasePreview.items.length; i += 1) {
      const item = purchasePreview.items[i];
      if (!item.product_name) continue;
      await accountingDb.run('INSERT INTO purchase_bill_items (id,bill_id,line_number,product_id,product_name,hsn_sac,quantity,unit,rate,discount_percent,taxable_amount,gst_rate,cgst_amount,sgst_amount,igst_amount,line_total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', [generateId(), billId, i + 1, item.product_id || null, item.product_name, item.hsn_sac, item.quantity, item.unit, item.rate, 0, item.taxable_amount, item.gst_rate, item.cgst_amount, item.sgst_amount, item.igst_amount, item.line_total]);
    }
    const lines = [{ ...accountByCode('5100', 'Purchase Expense'), debit_amount: purchasePreview.taxable, credit_amount: 0 }];
    if (purchaseForm.itc_eligible && purchasePreview.cgst) lines.push({ ...accountByCode('1200', 'Input CGST'), debit_amount: purchasePreview.cgst, credit_amount: 0 });
    if (purchaseForm.itc_eligible && purchasePreview.sgst) lines.push({ ...accountByCode('1210', 'Input SGST'), debit_amount: purchasePreview.sgst, credit_amount: 0 });
    if (purchaseForm.itc_eligible && purchasePreview.igst) lines.push({ ...accountByCode('1220', 'Input IGST'), debit_amount: purchasePreview.igst, credit_amount: 0 });
    lines.push({ ...accountByCode('2000', 'Accounts Payable'), debit_amount: 0, credit_amount: purchasePreview.total });
    await postJournal('purchase-bill', 'purchase_bill', billId, `Auto purchase bill ${billNumber}`, lines, true);
    setPurchaseForm({ ...purchaseForm, vendor_id: '', vendor_name: '', vendor_gst: '', source_grn_id: '', notes: '', items: [newLine()] });
    flash('success', `${billNumber} created.`);
    loadAll();
  };

  const createManualJournal = async (e) => {
    e.preventDefault();
    const debit = journalForm.lines.reduce((sum, line) => sum + Number(line.debit_amount || 0), 0);
    const credit = journalForm.lines.reduce((sum, line) => sum + Number(line.credit_amount || 0), 0);
    if (!journalForm.narration || Math.abs(debit - credit) > 0.001 || debit <= 0) return flash('error', 'Balanced journal and narration required.');
    await postJournal('manual-journal', 'journal', null, journalForm.narration, journalForm.lines.map((line) => ({ ...accountByCode(line.account_code, line.account_code), debit_amount: line.debit_amount, credit_amount: line.credit_amount })), false);
    setJournalForm({ narration: '', lines: [{ account_code: '5300', debit_amount: 0, credit_amount: 0 }, { account_code: '1000', debit_amount: 0, credit_amount: 0 }] });
    flash('success', 'Journal posted.');
    loadAll();
  };

  const createAsset = async (e) => {
    e.preventDefault();
    if (!assetForm.asset_name || Number(assetForm.gross_value || 0) <= 0) return flash('error', 'Asset name and gross value are required.');
    const assetId = generateId();
    const code = `FA-${Date.now()}`;
    const gross = Number(assetForm.gross_value || 0);
    const salvage = Number(assetForm.salvage_value || 0);
    await accountingDb.run('INSERT INTO fixed_assets (id,asset_code,asset_name,category,capitalization_date,gross_value,salvage_value,useful_life_months,depreciation_method,accumulated_depreciation,carrying_value,status,linked_purchase_bill_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)', [assetId, code, assetForm.asset_name, assetForm.category, assetForm.capitalization_date, gross, salvage, Number(assetForm.useful_life_months || 60), assetForm.depreciation_method, 0, gross - salvage, 'active', assetForm.linked_purchase_bill_id || null]);
    await postJournal('asset-capitalization', 'fixed_asset', assetId, `Asset capitalization ${code}`, [{ ...accountByCode('1500', 'Fixed Assets'), debit_amount: gross, credit_amount: 0 }, { ...accountByCode('2000', 'Accounts Payable'), debit_amount: 0, credit_amount: gross }], true);
    setAssetForm({ asset_name: '', category: 'Plant & Machinery', capitalization_date: today(), gross_value: 0, salvage_value: 0, useful_life_months: 60, depreciation_method: 'SLM', linked_purchase_bill_id: '' });
    flash('success', `${code} capitalized.`);
    loadAll();
  };

  const saveAccountingSettings = async () => {
    for (const [key, value] of Object.entries(accountingSettings)) {
      await accountingDb.run("INSERT OR REPLACE INTO accounting_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))", [key, value]);
    }
    flash('success', 'Accounting settings saved.');
  };

  const buildCompanySnapshot = () => ({
    name: settings.company_name || 'Your Company',
    address: settings.company_address || '',
    email: settings.company_email || '',
    phone: settings.company_phone || '',
    gst: settings.company_gst || ''
  });

  const loadOpenInvoicesForCustomer = async (customerId) => {
    if (!customerId) return [];
    return accountingDb.all(
      `SELECT id, invoice_number, invoice_date, due_date, total_amount, outstanding_amount
       FROM sales_invoices
       WHERE customer_id = ? AND outstanding_amount > 0
       ORDER BY due_date, invoice_date`,
      [customerId]
    );
  };

  const loadOpenBillsForVendor = async (vendorId) => {
    if (!vendorId) return [];
    return accountingDb.all(
      `SELECT id, bill_number, bill_date, due_date, total_amount, outstanding_amount
       FROM purchase_bills
       WHERE vendor_id = ? AND outstanding_amount > 0
       ORDER BY due_date, bill_date`,
      [vendorId]
    );
  };

  const setReceiptCustomer = async (customerId) => {
    const allocations = (await loadOpenInvoicesForCustomer(customerId)).map((row) => ({
      ...row,
      allocated_amount: 0
    }));
    setReceiptForm((prev) => ({ ...prev, customer_id: customerId, allocations }));
  };

  const setPaymentVendor = async (vendorId) => {
    const allocations = (await loadOpenBillsForVendor(vendorId)).map((row) => ({
      ...row,
      allocated_amount: 0
    }));
    setPaymentForm((prev) => ({ ...prev, vendor_id: vendorId, allocations }));
  };

  const updateReceiptAllocation = (invoiceId, value) => {
    setReceiptForm((prev) => ({
      ...prev,
      allocations: prev.allocations.map((row) => row.id === invoiceId ? { ...row, allocated_amount: Math.max(0, Number(value || 0)) } : row)
    }));
  };

  const updatePaymentAllocation = (billId, value) => {
    setPaymentForm((prev) => ({
      ...prev,
      allocations: prev.allocations.map((row) => row.id === billId ? { ...row, allocated_amount: Math.max(0, Number(value || 0)) } : row)
    }));
  };

  const prepareSettlementForParty = async (partyType, partyId) => {
    if (partyType === 'customer') {
      await setReceiptCustomer(partyId);
      setReceiptForm((prev) => ({ ...prev, customer_id: partyId }));
      setActiveTab('settlement');
      return;
    }
    await setPaymentVendor(partyId);
    setPaymentForm((prev) => ({ ...prev, vendor_id: partyId }));
    setActiveTab('settlement');
  };

  const createBankTransaction = async ({ bankAccountId, referenceType, referenceId, transactionDate, description, transactionType, amount, paymentMode }) => {
    const bankAccount = bankAccountMap[bankAccountId];
    const signedAmount = transactionType === 'credit' ? Number(amount || 0) : -Math.abs(Number(amount || 0));
    const balanceAfter = Number(bankAccount?.current_balance || 0) + signedAmount;
    await accountingDb.run(
      `INSERT INTO bank_transactions (
        id, bank_account_id, reference_type, reference_id, transaction_date, description, transaction_type, amount, balance_after, payment_mode
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [
        generateId(),
        bankAccountId,
        referenceType,
        referenceId,
        transactionDate,
        description,
        transactionType,
        Math.abs(Number(amount || 0)),
        balanceAfter,
        paymentMode
      ]
    );
    await accountingDb.run('UPDATE bank_accounts SET current_balance = ? WHERE id = ?', [balanceAfter, bankAccountId]);
  };

  const postReceiptVoucher = async (e) => {
    e?.preventDefault?.();
    const customer = customers.find((entry) => entry.id === receiptForm.customer_id);
    const validAllocations = receiptForm.allocations.filter((row) => Number(row.allocated_amount || 0) > 0);
    if (!customer || !receiptForm.bank_account_id || validAllocations.length === 0) {
      return flash('error', 'Customer, bank account, and at least one invoice allocation are required.');
    }

    const amount = validAllocations.reduce((sum, row) => sum + Number(row.allocated_amount || 0), 0);
    for (const row of validAllocations) {
      if (Number(row.allocated_amount || 0) > Number(row.outstanding_amount || 0)) {
        return flash('error', `Allocated amount exceeds outstanding for ${row.invoice_number}.`);
      }
    }

    const voucherId = generateId();
    const receiptNumber = generateVoucherNumber(accountingSettings.receipt_prefix || 'RCPT');
    await accountingDb.run(
      `INSERT INTO receipt_vouchers (
        id, receipt_number, customer_id, customer_name, bank_account_id, receipt_date, amount, payment_mode, reference_number, narration, status, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        voucherId,
        receiptNumber,
        customer.id,
        customer.company || customer.name,
        receiptForm.bank_account_id,
        receiptForm.receipt_date,
        amount,
        receiptForm.payment_mode,
        receiptForm.reference_number,
        receiptForm.narration,
        'posted',
        currentUser?.id || currentUser?.username || 'system'
      ]
    );

    for (const row of validAllocations) {
      await accountingDb.run(
        `INSERT INTO receipt_voucher_allocations (
          id, receipt_voucher_id, sales_invoice_id, invoice_number, allocated_amount
        ) VALUES (?,?,?,?,?)`,
        [generateId(), voucherId, row.id, row.invoice_number, Number(row.allocated_amount || 0)]
      );
      const nextOutstanding = Math.max(0, Number(row.outstanding_amount || 0) - Number(row.allocated_amount || 0));
      await accountingDb.run(
        'UPDATE sales_invoices SET outstanding_amount = ?, status = ? WHERE id = ?',
        [nextOutstanding, nextOutstanding <= 0.0001 ? 'paid' : 'part_paid', row.id]
      );
    }

    await createBankTransaction({
      bankAccountId: receiptForm.bank_account_id,
      referenceType: 'receipt_voucher',
      referenceId: voucherId,
      transactionDate: receiptForm.receipt_date,
      description: `Receipt ${receiptNumber} - ${customer.company || customer.name}`,
      transactionType: 'credit',
      amount,
      paymentMode: receiptForm.payment_mode
    });

    await postJournal('receipt-voucher', 'receipt_voucher', voucherId, `Customer receipt ${receiptNumber}`, [
      { ...accountByCode('1000', 'Cash & Bank'), debit_amount: amount, credit_amount: 0 },
      { ...accountByCode('1100', 'Accounts Receivable'), debit_amount: 0, credit_amount: amount }
    ], true);

    setReceiptForm({ customer_id: '', bank_account_id: '', receipt_date: today(), payment_mode: 'bank_transfer', reference_number: '', narration: '', allocations: [] });
    flash('success', `${receiptNumber} posted successfully.`);
    loadAll();
  };

  const postPaymentVoucher = async (e) => {
    e?.preventDefault?.();
    const vendor = vendors.find((entry) => entry.id === paymentForm.vendor_id);
    const validAllocations = paymentForm.allocations.filter((row) => Number(row.allocated_amount || 0) > 0);
    if (!vendor || !paymentForm.bank_account_id || validAllocations.length === 0) {
      return flash('error', 'Vendor, bank account, and at least one bill allocation are required.');
    }

    const amount = validAllocations.reduce((sum, row) => sum + Number(row.allocated_amount || 0), 0);
    for (const row of validAllocations) {
      if (Number(row.allocated_amount || 0) > Number(row.outstanding_amount || 0)) {
        return flash('error', `Allocated amount exceeds outstanding for ${row.bill_number}.`);
      }
    }

    const voucherId = generateId();
    const paymentNumber = generateVoucherNumber(accountingSettings.payment_prefix || 'PAY');
    await accountingDb.run(
      `INSERT INTO payment_vouchers (
        id, payment_number, vendor_id, vendor_name, bank_account_id, payment_date, amount, payment_mode, reference_number, narration, status, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        voucherId,
        paymentNumber,
        vendor.id,
        vendor.company || vendor.name,
        paymentForm.bank_account_id,
        paymentForm.payment_date,
        amount,
        paymentForm.payment_mode,
        paymentForm.reference_number,
        paymentForm.narration,
        'posted',
        currentUser?.id || currentUser?.username || 'system'
      ]
    );

    for (const row of validAllocations) {
      await accountingDb.run(
        `INSERT INTO payment_voucher_allocations (
          id, payment_voucher_id, purchase_bill_id, bill_number, allocated_amount
        ) VALUES (?,?,?,?,?)`,
        [generateId(), voucherId, row.id, row.bill_number, Number(row.allocated_amount || 0)]
      );
      const nextOutstanding = Math.max(0, Number(row.outstanding_amount || 0) - Number(row.allocated_amount || 0));
      await accountingDb.run(
        'UPDATE purchase_bills SET outstanding_amount = ?, status = ? WHERE id = ?',
        [nextOutstanding, nextOutstanding <= 0.0001 ? 'paid' : 'part_paid', row.id]
      );
    }

    await createBankTransaction({
      bankAccountId: paymentForm.bank_account_id,
      referenceType: 'payment_voucher',
      referenceId: voucherId,
      transactionDate: paymentForm.payment_date,
      description: `Payment ${paymentNumber} - ${vendor.company || vendor.name}`,
      transactionType: 'debit',
      amount,
      paymentMode: paymentForm.payment_mode
    });

    await postJournal('payment-voucher', 'payment_voucher', voucherId, `Vendor payment ${paymentNumber}`, [
      { ...accountByCode('2000', 'Accounts Payable'), debit_amount: amount, credit_amount: 0 },
      { ...accountByCode('1000', 'Cash & Bank'), debit_amount: 0, credit_amount: amount }
    ], true);

    setPaymentForm({ vendor_id: '', bank_account_id: '', payment_date: today(), payment_mode: 'bank_transfer', reference_number: '', narration: '', allocations: [] });
    flash('success', `${paymentNumber} posted successfully.`);
    loadAll();
  };

  const addReconciliationLine = async (e) => {
    e?.preventDefault?.();
    if (!reconciliationForm.bank_account_id || !reconciliationForm.amount) {
      return flash('error', 'Bank account and amount are required for reconciliation line.');
    }
    await accountingDb.run(
      `INSERT INTO bank_reconciliation_lines (
        id, bank_account_id, statement_date, reference_number, description, entry_type, amount, notes, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        generateId(),
        reconciliationForm.bank_account_id,
        reconciliationForm.statement_date,
        reconciliationForm.reference_number,
        reconciliationForm.description,
        reconciliationForm.entry_type,
        Number(reconciliationForm.amount || 0),
        reconciliationForm.notes,
        currentUser?.id || currentUser?.username || 'system'
      ]
    );
    setReconciliationForm((prev) => ({ ...prev, statement_date: today(), reference_number: '', description: '', entry_type: 'credit', amount: '', notes: '' }));
    flash('success', 'Bank statement line added for reconciliation.');
    loadAll();
  };

  const matchReconciliationLine = async (lineId, bankTransactionId) => {
    if (!bankTransactionId) return flash('error', 'Choose a bank book transaction to reconcile.');
    await accountingDb.run(
      `UPDATE bank_reconciliation_lines
       SET bank_transaction_id = ?, status = 'matched', matched_at = datetime('now')
       WHERE id = ?`,
      [bankTransactionId, lineId]
    );
    flash('success', 'Statement line reconciled successfully.');
    loadAll();
  };

  const markReconciliationStatus = async (lineId, statusValue) => {
    await accountingDb.run('UPDATE bank_reconciliation_lines SET status = ?, matched_at = CASE WHEN ? = \'matched\' THEN datetime(\'now\') ELSE NULL END WHERE id = ?', [statusValue, statusValue, lineId]);
    flash('success', `Reconciliation line marked as ${statusValue}.`);
    loadAll();
  };

  const buildProformaPdf = async (record = null) => {
    const docData = await composeProformaDocument(record);
    const customer = customers.find((entry) => entry.id === docData.customer_id) || selectedProformaCustomer;
    const company = buildCompanySnapshot();
    const document = new jsPDF();
    const pageWidth = document.internal.pageSize.getWidth();
    let y = 18;

    document.setFont('helvetica', 'bold');
    document.setFontSize(18);
    document.setTextColor(30, 64, 175);
    document.text('PROFORMA INVOICE', 15, y);
    document.setFontSize(10);
    document.setTextColor(100, 116, 139);
    document.text('Pre-billing commercial document for customer approval and advance processing', 15, y + 6);
    document.setDrawColor(30, 64, 175);
    document.line(15, y + 10, pageWidth - 15, y + 10);
    y += 20;

    document.setFontSize(11);
    document.setTextColor(15, 23, 42);
    document.setFont('helvetica', 'bold');
    document.text(company.name, 15, y);
    document.setFont('helvetica', 'normal');
    if (company.address) document.text(document.splitTextToSize(company.address, 80), 15, y + 6);
    document.text(`Email: ${company.email || '-'}`, 15, y + 18);
    document.text(`Phone: ${company.phone || '-'}`, 15, y + 24);
    document.text(`GSTIN: ${company.gst || '-'}`, 15, y + 30);

    document.setFont('helvetica', 'bold');
    document.text(`Proforma No: ${docData.proforma_number}`, pageWidth - 78, y);
    document.setFont('helvetica', 'normal');
    document.text(`Issue Date: ${docData.issue_date || today()}`, pageWidth - 78, y + 8);
    document.text(`Valid Till: ${docData.valid_till || '-'}`, pageWidth - 78, y + 14);
    document.text(`Status: ${docData.status || 'draft'}`, pageWidth - 78, y + 20);
    document.text(`Source Order: ${docData.order_number || '-'}`, pageWidth - 78, y + 26);
    y += 42;

    document.setFont('helvetica', 'bold');
    document.text('Bill To', 15, y);
    document.setFont('helvetica', 'normal');
    document.text(customer?.company || customer?.name || docData.customer_name || '-', 15, y + 7);
    document.text(`Email: ${customer?.email || docData.customer_email || '-'}`, 15, y + 13);
    document.text(`Phone: ${customer?.phone || docData.customer_phone || '-'}`, 15, y + 19);
    document.text(`GSTIN: ${customer?.gst_number || docData.customer_gst || '-'}`, 15, y + 25);

    document.setFont('helvetica', 'bold');
    document.text('Sender', pageWidth - 78, y);
    document.setFont('helvetica', 'normal');
    document.text(docData.sender_name || '-', pageWidth - 78, y + 7);
    document.text(docData.sender_email || '-', pageWidth - 78, y + 13);
    y += 36;

    if (docData.subject) {
      document.setFont('helvetica', 'bold');
      document.text('Subject', 15, y);
      document.setFont('helvetica', 'normal');
      document.text(document.splitTextToSize(docData.subject, pageWidth - 30), 15, y + 7);
      y += 16;
    }

    autoTable(document, {
      startY: y,
      head: [['#', 'Description', 'Qty', 'Rate', 'Tax %', 'Amount']],
      body: (docData.items || []).map((item, index) => [
        String(index + 1),
        item.description || '-',
        String(Number(item.quantity || 0)),
        formatCurrency(item.unit_price || 0, currencySymbol),
        `${Number(item.tax_rate || 0)}%`,
        formatCurrency(item.total || item.lineTotal || 0, currencySymbol)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { left: 15, right: 15 }
    });

    y = document.lastAutoTable.finalY + 12;
    document.setFont('helvetica', 'bold');
    document.text(`Subtotal: ${formatCurrency(docData.subtotal_amount ?? proformaPreview.subtotal, currencySymbol)}`, 15, y);
    document.text(`Tax: ${formatCurrency(docData.tax_amount ?? proformaPreview.tax, currencySymbol)}`, 15, y + 7);
    document.setTextColor(30, 64, 175);
    document.text(`Total: ${formatCurrency(docData.total_amount ?? proformaPreview.total, currencySymbol)}`, 15, y + 15);
    document.setTextColor(15, 23, 42);

    if (docData.mail_draft) {
      y += 28;
      document.setFont('helvetica', 'normal');
      document.text(document.splitTextToSize(docData.mail_draft, pageWidth - 30), 15, y);
    }

    if (docData.notes) {
      y += 24;
      document.setFont('helvetica', 'bold');
      document.text('Notes', 15, y);
      document.setFont('helvetica', 'normal');
      document.text(document.splitTextToSize(docData.notes, pageWidth - 30), 15, y + 7);
    }

    if (docData.terms) {
      y += 26;
      document.setFont('helvetica', 'bold');
      document.text('Terms', 15, y);
      document.setFont('helvetica', 'normal');
      document.text(document.splitTextToSize(docData.terms, pageWidth - 30), 15, y + 7);
    }

    return { document, docData };
  };

  const composeSalesInvoiceDocument = async (record) => {
    if (!record?.id) return null;
    const items = await accountingDb.all('SELECT * FROM sales_invoice_items WHERE invoice_id = ? ORDER BY line_number', [record.id]);
    return { ...record, items };
  };

  const buildSalesInvoicePdf = async (record) => {
    const docData = await composeSalesInvoiceDocument(record);
    if (!docData) throw new Error('Invoice data not found.');
    const customer = customers.find((entry) => entry.id === docData.customer_id) || null;
    const company = buildCompanySnapshot();
    const document = new jsPDF();
    const pageWidth = document.internal.pageSize.getWidth();
    let y = 18;

    document.setFont('helvetica', 'bold');
    document.setFontSize(18);
    document.setTextColor(22, 101, 52);
    document.text('TAX INVOICE', 15, y);
    document.setTextColor(15, 23, 42);
    document.setFontSize(11);
    document.text(company.name, 15, y + 8);
    document.setFont('helvetica', 'normal');
    if (company.address) document.text(document.splitTextToSize(company.address, 80), 15, y + 15);
    document.text(`Email: ${company.email || '-'}`, 15, y + 28);
    document.text(`Phone: ${company.phone || '-'}`, 15, y + 34);
    document.text(`GSTIN: ${company.gst || '-'}`, 15, y + 40);

    document.setFont('helvetica', 'bold');
    document.text(`Invoice No: ${docData.invoice_number}`, pageWidth - 82, y);
    document.setFont('helvetica', 'normal');
    document.text(`Invoice Date: ${docData.invoice_date}`, pageWidth - 82, y + 8);
    document.text(`Due Date: ${docData.due_date || '-'}`, pageWidth - 82, y + 14);
    document.text(`Status: ${docData.status || 'open'}`, pageWidth - 82, y + 20);
    y += 56;

    document.setFont('helvetica', 'bold');
    document.text('Customer', 15, y);
    document.setFont('helvetica', 'normal');
    document.text(customer?.company || customer?.name || docData.customer_name || '-', 15, y + 7);
    document.text(`GSTIN: ${docData.customer_gst || customer?.gst_number || '-'}`, 15, y + 13);
    document.text(`Place of Supply: ${docData.place_of_supply || '-'}`, 15, y + 19);

    autoTable(document, {
      startY: y + 28,
      head: [['#', 'Product', 'Qty', 'Rate', 'GST', 'Amount']],
      body: (docData.items || []).map((item, index) => [
        String(index + 1),
        item.product_name || '-',
        String(Number(item.quantity || 0)),
        formatCurrency(item.rate || 0, currencySymbol),
        `${Number(item.gst_rate || 0)}%`,
        formatCurrency(item.line_total || 0, currencySymbol)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [22, 101, 52], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { left: 15, right: 15 }
    });

    y = document.lastAutoTable.finalY + 12;
    document.setFont('helvetica', 'bold');
    document.text(`Taxable: ${formatCurrency(docData.taxable_amount || 0, currencySymbol)}`, 15, y);
    document.text(`Tax: ${formatCurrency(docData.total_tax || 0, currencySymbol)}`, 15, y + 7);
    document.setTextColor(22, 101, 52);
    document.text(`Total: ${formatCurrency(docData.total_amount || 0, currencySymbol)}`, 15, y + 15);
    document.setTextColor(15, 23, 42);
    document.text(`Outstanding: ${formatCurrency(docData.outstanding_amount || 0, currencySymbol)}`, 15, y + 22);
    if (docData.notes) {
      y += 34;
      document.setFont('helvetica', 'bold');
      document.text('Notes', 15, y);
      document.setFont('helvetica', 'normal');
      document.text(document.splitTextToSize(docData.notes, pageWidth - 30), 15, y + 7);
    }
    return { document, docData };
  };

  const exportSalesInvoicePdf = async (record) => {
    const built = await buildSalesInvoicePdf(record);
    built.document.save(`${built.docData.invoice_number || 'invoice'}.pdf`);
    flash('success', 'Invoice PDF generated.');
  };

  const buildPartyStatementPdf = async (statementData) => {
    const document = new jsPDF();
    const company = buildCompanySnapshot();
    const pageWidth = document.internal.pageSize.getWidth();
    const { party, openDocuments, ledgerRows, agingBuckets } = statementData;
    let y = 18;

    document.setFont('helvetica', 'bold');
    document.setFontSize(18);
    document.setTextColor(30, 64, 175);
    document.text('Party Statement', 15, y);
    document.setTextColor(15, 23, 42);
    document.setFontSize(11);
    document.text(company.name, 15, y + 8);
    document.setFont('helvetica', 'normal');
    document.text(`Party: ${party.company || party.name}`, 15, y + 16);
    document.text(`Email: ${party.email || '-'}`, 15, y + 22);
    document.text(`Phone: ${party.phone || '-'}`, 15, y + 28);
    document.text(`Generated: ${today()}`, pageWidth - 60, y + 8);

    autoTable(document, {
      startY: y + 38,
      head: [['Current', '1-30', '31-60', '61-90', '90+']],
      body: [[
        formatCurrency(agingBuckets.current, currencySymbol),
        formatCurrency(agingBuckets.bucket30, currencySymbol),
        formatCurrency(agingBuckets.bucket60, currencySymbol),
        formatCurrency(agingBuckets.bucket90, currencySymbol),
        formatCurrency(agingBuckets.bucket120, currencySymbol)
      ]],
      theme: 'grid',
      headStyles: { fillColor: [30, 64, 175], textColor: 255 },
      styles: { fontSize: 9, cellPadding: 3 },
      margin: { left: 15, right: 15 }
    });

    autoTable(document, {
      startY: document.lastAutoTable.finalY + 10,
      head: [['Date', 'Document', 'Type', 'Debit', 'Credit', 'Running']],
      body: ledgerRows.map((row) => [
        formatDate(row.date),
        row.document_number,
        row.kind,
        formatCurrency(row.debit || 0, currencySymbol),
        formatCurrency(row.credit || 0, currencySymbol),
        formatCurrency(row.running_balance || 0, currencySymbol)
      ]),
      theme: 'grid',
      headStyles: { fillColor: [15, 23, 42], textColor: 255 },
      styles: { fontSize: 8.5, cellPadding: 3 },
      margin: { left: 15, right: 15 }
    });

    if (openDocuments.length) {
      autoTable(document, {
        startY: document.lastAutoTable.finalY + 10,
        head: [['Open Document', 'Date', 'Due', 'Total', 'Outstanding']],
        body: openDocuments.map((row) => [
          row.invoice_number || row.bill_number || '-',
          formatDate(row.invoice_date || row.bill_date),
          formatDate(row.due_date),
          formatCurrency(row.total_amount || 0, currencySymbol),
          formatCurrency(row.outstanding_amount || 0, currencySymbol)
        ]),
        theme: 'grid',
        headStyles: { fillColor: [22, 101, 52], textColor: 255 },
        styles: { fontSize: 8.5, cellPadding: 3 },
        margin: { left: 15, right: 15 }
      });
    }

    return document;
  };

  const saveDispatchLog = async ({ documentType, documentId, documentNumber, recipientEmail, senderEmail, status: logStatus, subject, errorMessage }) => {
    await accountingDb.run(
      `INSERT INTO document_dispatch_logs (
        id, document_type, document_id, document_number, recipient_email, sender_email, channel, status, subject, error_message, sent_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [
        generateId(),
        documentType,
        documentId || null,
        documentNumber || '',
        recipientEmail,
        senderEmail || '',
        'email',
        logStatus,
        subject || '',
        errorMessage || '',
        currentUser?.id || currentUser?.username || 'system'
      ]
    );
  };

  const sendDispatchEmail = async () => {
    if (!window.electronAPI?.sendDocumentEmail) return flash('error', 'Desktop email dispatch is available only in the Electron app.');
    if (!dispatchForm.recipient_email || !dispatchForm.subject || !dispatchForm.attachment_base64) {
      return flash('error', 'Recipient, subject, and document attachment are required.');
    }

    const sender = senderOptions.find((option) => option.key === dispatchForm.sender_key) || senderOptions[0] || null;
    const senderEmail = sender?.email || accountingSettings.smtp_from_email || settings.company_email || '';
    if (!accountingSettings.smtp_host || !accountingSettings.smtp_user || !accountingSettings.smtp_pass) {
      return flash('error', 'Configure SMTP settings in Data Control before sending documents.');
    }

    setDispatchBusy(true);
    const result = await window.electronAPI.sendDocumentEmail({
      transport: {
        host: accountingSettings.smtp_host,
        port: accountingSettings.smtp_port || 587,
        secure: accountingSettings.smtp_secure || 'false',
        user: accountingSettings.smtp_user,
        pass: accountingSettings.smtp_pass,
        fromEmail: accountingSettings.smtp_from_email || senderEmail
      },
      fromEmail: accountingSettings.smtp_from_email || senderEmail,
      fromName: sender?.name || accountingSettings.smtp_from_name || settings.company_name || 'Accounts',
      to: dispatchForm.recipient_email,
      subject: dispatchForm.subject,
      text: dispatchForm.body,
      attachments: [{
        filename: dispatchForm.attachment_name,
        contentBase64: dispatchForm.attachment_base64,
        contentType: 'application/pdf'
      }]
    });
    setDispatchBusy(false);

    await saveDispatchLog({
      documentType: dispatchForm.document_type,
      documentId: dispatchForm.document_id,
      documentNumber: dispatchForm.document_number,
      recipientEmail: dispatchForm.recipient_email,
      senderEmail: accountingSettings.smtp_from_email || senderEmail,
      status: result.success ? 'sent' : 'failed',
      subject: dispatchForm.subject,
      errorMessage: result.success ? '' : result.error
    });

    if (!result.success) {
      flash('error', result.error || 'Unable to send email.');
      loadAll();
      return;
    }

    if (dispatchForm.document_type === 'proforma' && dispatchForm.document_id) {
      await db.run("UPDATE proforma_invoices SET status = 'sent', updated_at = datetime('now') WHERE id = ?", [dispatchForm.document_id]);
    }

    setDispatchModalOpen(false);
    setDispatchForm({ document_type: '', document_id: '', document_number: '', recipient_email: '', sender_key: senderOptions[0]?.key || 'company', subject: '', body: '', attachment_name: '', attachment_base64: '', related_party_id: '', related_party_type: '' });
    flash('success', 'Document emailed successfully.');
    loadAll();
  };

  const openDispatchComposer = async (mode, record, context = {}) => {
    let document;
    let documentNumber = '';
    let recipientEmail = '';
    let subject = '';
    let body = '';
    let documentId = record?.id || '';

    if (mode === 'proforma') {
      const built = await buildProformaPdf(record);
      document = built.document;
      documentNumber = built.docData.proforma_number;
      const customer = customers.find((entry) => entry.id === built.docData.customer_id) || selectedProformaCustomer;
      recipientEmail = customer?.email || built.docData.customer_email || '';
      subject = built.docData.subject || `Proforma Invoice ${built.docData.proforma_number}`;
      body = `${built.docData.mail_draft || 'Please find attached our proforma invoice.'}\n\nDocument: ${built.docData.proforma_number}`;
    }

    if (mode === 'invoice') {
      const built = await buildSalesInvoicePdf(record);
      document = built.document;
      documentNumber = built.docData.invoice_number;
      const customer = customers.find((entry) => entry.id === built.docData.customer_id);
      recipientEmail = customer?.email || '';
      subject = `Tax Invoice ${built.docData.invoice_number}`;
      body = `Dear ${customer?.name || customer?.company || 'Customer'},\n\nPlease find attached invoice ${built.docData.invoice_number} for ${formatCurrency(built.docData.total_amount || 0, currencySymbol)}.\n\nRegards,\n${settings.company_name || 'Accounts Team'}`;
    }

    if (mode === 'statement') {
      const statementDoc = await buildPartyStatementPdf(context.statementData);
      document = statementDoc;
      documentNumber = `${context.statementData.partyType === 'customer' ? 'CUST' : 'VEND'}-STMT-${today()}`;
      recipientEmail = context.statementData.party.email || '';
      subject = `${context.statementData.partyType === 'customer' ? 'Account Statement' : 'Vendor Statement'} - ${context.statementData.party.company || context.statementData.party.name}`;
      body = `Dear ${context.statementData.party.name || context.statementData.party.company},\n\nPlease find attached your account statement as on ${today()}.\n\nRegards,\n${settings.company_name || 'Accounts Team'}`;
      documentId = '';
    }

    const attachmentBase64 = encodeArrayBufferToBase64(document.output('arraybuffer'));
    setDispatchForm({
      document_type: mode,
      document_id: documentId,
      document_number: documentNumber,
      recipient_email: recipientEmail,
      sender_key: senderOptions[0]?.key || 'company',
      subject,
      body,
      attachment_name: `${documentNumber}.pdf`,
      attachment_base64: attachmentBase64,
      related_party_id: context.statementData?.party?.id || '',
      related_party_type: context.statementData?.partyType || ''
    });
    setDispatchModalOpen(true);
  };

  const openPartyLedger = async (partyType, partyId) => {
    const party = [...customers, ...vendors].find((entry) => entry.id === partyId);
    if (!party) return flash('error', 'Party not found.');
    setPartyLedgerLoading(true);
    setPartyLedgerModalOpen(true);

    const openDocuments = partyType === 'customer'
      ? await accountingDb.all('SELECT * FROM sales_invoices WHERE customer_id = ? ORDER BY invoice_date DESC', [partyId])
      : await accountingDb.all('SELECT * FROM purchase_bills WHERE vendor_id = ? ORDER BY bill_date DESC', [partyId]);
    const voucherRows = partyType === 'customer'
      ? await accountingDb.all(
        `SELECT rv.id, rv.receipt_number as document_number, rv.receipt_date as posting_date, rv.amount
         FROM receipt_vouchers rv
         WHERE rv.customer_id = ?
         ORDER BY rv.receipt_date DESC, rv.created_at DESC`,
        [partyId]
      )
      : await accountingDb.all(
        `SELECT pv.id, pv.payment_number as document_number, pv.payment_date as posting_date, pv.amount
         FROM payment_vouchers pv
         WHERE pv.vendor_id = ?
         ORDER BY pv.payment_date DESC, pv.created_at DESC`,
        [partyId]
      );
    const followups = await accountingDb.all('SELECT * FROM party_followups WHERE party_type = ? AND party_id = ? ORDER BY due_date ASC, created_at DESC', [partyType, partyId]);

    const ledgerRows = [
      ...openDocuments.map((row) => ({
        id: row.id,
        date: row.invoice_date || row.bill_date,
        document_number: row.invoice_number || row.bill_number,
        kind: partyType === 'customer' ? 'Invoice' : 'Bill',
        debit: Number(row.total_amount || 0),
        credit: 0
      })),
      ...voucherRows.map((row) => ({
        id: row.id,
        date: row.posting_date,
        document_number: row.document_number,
        kind: partyType === 'customer' ? 'Receipt' : 'Payment',
        debit: 0,
        credit: Number(row.amount || 0)
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

    let runningBalance = 0;
    const normalizedLedger = ledgerRows.map((row) => {
      runningBalance += Number(row.debit || 0) - Number(row.credit || 0);
      return { ...row, running_balance: runningBalance };
    });

    const agingBuckets = calculateAgingBuckets(
      openDocuments.filter((row) => Number(row.outstanding_amount || 0) > 0),
      'outstanding_amount'
    );

    setPartyLedgerData({
      partyType,
      party,
      openDocuments,
      ledgerRows: normalizedLedger,
      agingBuckets,
      followups
    });
    setFollowupForm({ followup_type: 'statement', subject: '', notes: '', due_date: today(), assigned_to: currentUser?.id || '' });
    setPartyLedgerLoading(false);
  };

  const savePartyFollowup = async () => {
    if (!partyLedgerData?.party?.id || !followupForm.subject) {
      return flash('error', 'Follow-up subject is required.');
    }
    await accountingDb.run(
      `INSERT INTO party_followups (
        id, party_type, party_id, party_name, document_type, document_id, document_number, followup_type, subject, notes, due_date, status, assigned_to, created_by
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        generateId(),
        partyLedgerData.partyType,
        partyLedgerData.party.id,
        partyLedgerData.party.company || partyLedgerData.party.name,
        null,
        null,
        null,
        followupForm.followup_type,
        followupForm.subject,
        followupForm.notes,
        followupForm.due_date,
        'open',
        followupForm.assigned_to || currentUser?.id || null,
        currentUser?.id || currentUser?.username || 'system'
      ]
    );
    flash('success', 'Party follow-up saved.');
    openPartyLedger(partyLedgerData.partyType, partyLedgerData.party.id);
    loadAll();
  };

  const exportPartyStatementPdf = async () => {
    if (!partyLedgerData) return;
    const document = await buildPartyStatementPdf(partyLedgerData);
    document.save(`${partyLedgerData.party.company || partyLedgerData.party.name}-statement.pdf`);
    flash('success', 'Party statement PDF generated.');
  };

  const renderPartySettlementPanel = (party, role) => {
    if (!party) return null;

    const bankSummary = party.bank_name
      ? `${party.bank_name}${party.branch_name ? `, ${party.branch_name}` : ''}`
      : 'Bank not set';
    const routingKey = party.ifsc_code || party.upi_id || party.swift_code || party.iban || 'Routing key pending';

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
        <div className="catalogue-summary-card">
          <span className="catalogue-summary-title">{role === 'customer' ? 'Collection Account' : 'Vendor Bank'}</span>
          <strong style={{ fontSize: 16 }}>{bankSummary}</strong>
          <span className="text-secondary text-sm">{party.account_holder_name || party.company || party.name}</span>
          <span className="text-secondary text-sm">A/c: {maskAccountNumber(party.account_number)}</span>
        </div>
        <div className="catalogue-summary-card">
          <span className="catalogue-summary-title">Payment Rail</span>
          <strong style={{ fontSize: 16 }}>{formatPaymentMethod(party.preferred_payment_method)}</strong>
          <span className="text-secondary text-sm">{routingKey}</span>
          <span className="text-secondary text-sm">{party.account_type ? `Account type: ${party.account_type}` : 'Account type pending'}</span>
        </div>
        <div className="catalogue-summary-card">
          <span className="catalogue-summary-title">Commercial Policy</span>
          <strong style={{ fontSize: 16 }}>{Number(party.payment_terms_days || 0)} day terms</strong>
          <span className="text-secondary text-sm">Credit limit: {formatCurrency(party.credit_limit || 0, currencySymbol)}</span>
          <span className="text-secondary text-sm">{party.gst_number || 'GST not set'}</span>
        </div>
      </div>
    );
  };

  const openProformaEditor = async (record = null) => {
    if (record?.id) {
      const itemRows = await db.all(
        `SELECT pii.*, p.name as product_name
         FROM proforma_invoice_items pii
         LEFT JOIN products p ON p.id = pii.product_id
         WHERE pii.proforma_invoice_id = ?
         ORDER BY pii.sort_order, pii.rowid`,
        [record.id]
      );

      setProformaForm({
        proforma_number: record.proforma_number,
        customer_id: record.customer_id || '',
        source_order_id: record.source_order_id || '',
        sender_key: record.sender_type === 'user' && record.sender_id ? `user:${record.sender_id}` : 'company',
        issue_date: record.issue_date || today(),
        valid_till: record.valid_till || shiftDate(record.issue_date || today(), 7),
        status: record.status || 'draft',
        subject: record.subject || '',
        mail_draft: record.mail_draft || '',
        notes: record.notes || '',
        terms: record.terms || '',
        items: itemRows.length
          ? itemRows.map((item) => ({
              id: item.id,
              product_id: item.product_id || '',
              description: item.description || item.product_name || '',
              quantity: Number(item.quantity || 1),
              unit_price: Number(item.unit_price || 0),
              tax_rate: Number(item.tax_rate || 18)
            }))
          : [newProformaLine()]
      });
      setEditingProformaId(record.id);
    } else {
      setProformaForm({
        proforma_number: generateProformaNumber(),
        customer_id: '',
        source_order_id: '',
        sender_key: senderOptions[0]?.key || 'company',
        issue_date: today(),
        valid_till: shiftDate(today(), 7),
        status: 'draft',
        subject: proformaDefaults.subject,
        mail_draft: proformaDefaults.mailDraft,
        notes: '',
        terms: proformaDefaults.terms,
        items: [newProformaLine()]
      });
      setEditingProformaId(null);
    }

    setProformaModalOpen(true);
  };

  const closeProformaEditor = () => {
    setProformaModalOpen(false);
    setEditingProformaId(null);
  };

  const updateProformaItem = (id, field, value) => {
    setProformaForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id
          ? { ...item, [field]: field === 'description' || field === 'product_id' ? value : Number(value || 0) }
          : item
      )
    }));
  };

  const setProformaProduct = (id, productId) => {
    const product = products.find((entry) => entry.id === productId);
    setProformaForm((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === id
          ? {
              ...item,
              product_id: productId,
              description: product?.description || product?.name || item.description,
              unit_price: Number(product?.selling_price || item.unit_price || 0),
              tax_rate: Number(product?.gst_rate || item.tax_rate || 18)
            }
          : item
      )
    }));
  };

  const convertProformaToSalesInvoice = async (record) => {
    if (!record?.id) return;

    try {
      const [itemRows, customer] = await Promise.all([
        db.all(
          `SELECT pii.*, p.name as product_name, p.hsn_code, p.unit, p.gst_rate
           FROM proforma_invoice_items pii
           LEFT JOIN products p ON p.id = pii.product_id
           WHERE pii.proforma_invoice_id = ?
           ORDER BY pii.sort_order, pii.rowid`,
          [record.id]
        ),
        record.customer_id ? db.get('SELECT * FROM contacts WHERE id = ?', [record.customer_id]) : Promise.resolve(null)
      ]);

      if (!customer) return flash('error', 'Customer is missing for this proforma invoice.');
      if (!itemRows.length) return flash('error', 'No line items found in this proforma invoice.');

      const supplyType = customer.state && customer.state !== companyState ? 'inter-state' : 'intra-state';
      const paymentTermsDays = Number(customer.payment_terms_days || 0);
      const invoiceDate = today();
      const convertedItems = itemRows.map((item) => ({
        product_id: item.product_id || '',
        product_name: item.product_name || item.description || 'Proforma item',
        hsn_sac: item.hsn_code || '',
        quantity: Number(item.quantity || 1),
        unit: item.unit || 'PCS',
        rate: Number(item.unit_price || 0),
        gst_rate: Number(item.tax_rate ?? item.gst_rate ?? 18)
      }));

      setSalesForm({
        customer_id: customer.id,
        customer_name: customer.company || customer.name,
        customer_gst: customer.gst_number || '',
        source_order_id: '',
        source_proforma_id: record.id,
        source_proforma_number: record.proforma_number,
        invoice_date: invoiceDate,
        due_date: shiftDate(invoiceDate, paymentTermsDays),
        place_of_supply: customer.state || companyState,
        supply_type: supplyType,
        notes: `Converted from proforma invoice ${record.proforma_number || ''}`.trim(),
        items: convertedItems.length ? convertedItems : [newLine()]
      });
      setActiveTab('billing');
      flash('success', `${record.proforma_number} loaded into Sales Invoice.`);
    } catch (err) {
      flash('error', err.message);
    }
  };

  const openQuickProductEditor = (lineId) => {
    const line = proformaForm.items.find((item) => item.id === lineId);
    setQuickProductLineId(lineId);
    setQuickProductForm({ ...newQuickProductForm(), name: line?.description || '', description: line?.description || '', selling_price: Number(line?.unit_price || 0), gst_rate: Number(line?.tax_rate || 18) });
    setQuickProductModalOpen(true);
  };

  const closeQuickProductEditor = () => {
    setQuickProductModalOpen(false);
    setQuickProductLineId(null);
    setQuickProductForm(newQuickProductForm());
  };

  const saveQuickProduct = async () => {
    const name = quickProductForm.name.trim();
    const code = quickProductForm.code.trim();
    if (!name) return flash('error', 'Product name is required.');

    try {
      const id = generateId();
      const createdProduct = {
        id,
        name,
        code,
        description: quickProductForm.description.trim(),
        unit: quickProductForm.unit || 'PCS',
        hsn_code: quickProductForm.hsn_code.trim(),
        gst_rate: Number(quickProductForm.gst_rate || 0),
        selling_price: Number(quickProductForm.selling_price || 0),
        cost_price: Number(quickProductForm.cost_price || 0)
      };

      await db.run(
        `INSERT INTO products (id,name,code,description,unit,hsn_code,gst_rate,selling_price,cost_price)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          createdProduct.id,
          createdProduct.name,
          createdProduct.code || null,
          createdProduct.description,
          createdProduct.unit,
          createdProduct.hsn_code,
          createdProduct.gst_rate,
          createdProduct.selling_price,
          createdProduct.cost_price
        ]
      );
      await db.run('INSERT INTO inventory (id, product_id, quantity) VALUES (?,?,0)', [generateId(), id]);

      setProducts((prev) => [...prev, createdProduct].sort((a, b) => a.name.localeCompare(b.name)));
      setProformaForm((prev) => ({
        ...prev,
        items: prev.items.map((item) =>
          item.id === quickProductLineId
            ? {
                ...item,
                product_id: createdProduct.id,
                description: createdProduct.description || createdProduct.name,
                unit_price: createdProduct.selling_price,
                tax_rate: createdProduct.gst_rate || item.tax_rate || 18
              }
            : item
        )
      }));
      flash('success', `${createdProduct.name} added and selected.`);
      closeQuickProductEditor();
    } catch (err) {
      flash('error', err.message);
    }
  };

  const addProformaItem = () => {
    setProformaForm((prev) => ({ ...prev, items: [...prev.items, newProformaLine()] }));
  };

  const removeProformaItem = (id) => {
    setProformaForm((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((item) => item.id !== id) : prev.items
    }));
  };

  const applyOrderToProforma = async (orderId) => {
    if (!orderId) {
      setProformaForm((prev) => ({ ...prev, source_order_id: '', items: [newProformaLine()] }));
      return;
    }

    const orderRow = await db.get('SELECT * FROM orders WHERE id = ?', [orderId]);
    const itemRows = await db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId]);

    setProformaForm((prev) => ({
      ...prev,
      source_order_id: orderId,
      customer_id: orderRow?.customer_id || prev.customer_id,
      subject: prev.subject || `Proforma Invoice for ${orderRow?.order_number || 'Sales Order'}`,
      items: itemRows.length
        ? itemRows.map((item) => ({
            id: generateId(),
            product_id: item.product_id || '',
            description: item.description || '',
            quantity: Number(item.quantity || 1),
            unit_price: Number(item.unit_price || 0),
            tax_rate: 18
          }))
        : [newProformaLine()]
    }));
  };

  const saveProforma = async () => {
    if (!proformaForm.customer_id) return flash('error', 'Select a customer for the proforma invoice.');
    if (!proformaForm.items.some((item) => item.description)) return flash('error', 'Add at least one line item.');

    const sender = activeSender;
    const documentId = editingProformaId || generateId();

    if (editingProformaId) {
      await db.run(
        `UPDATE proforma_invoices
         SET customer_id=?,source_order_id=?,sender_type=?,sender_id=?,sender_name=?,sender_email=?,issue_date=?,valid_till=?,status=?,subject=?,mail_draft=?,notes=?,terms=?,subtotal_amount=?,tax_amount=?,total_amount=?,updated_at=datetime('now')
         WHERE id=?`,
        [
          proformaForm.customer_id,
          proformaForm.source_order_id || null,
          sender?.userId ? 'user' : 'company',
          sender?.userId || null,
          sender?.name || settings.company_name || currentUser?.full_name || 'Sender',
          sender?.email || settings.company_email || '',
          proformaForm.issue_date,
          proformaForm.valid_till,
          proformaForm.status,
          proformaForm.subject || `Proforma Invoice ${proformaForm.proforma_number}`,
          proformaForm.mail_draft,
          proformaForm.notes,
          proformaForm.terms,
          proformaPreview.subtotal,
          proformaPreview.tax,
          proformaPreview.total,
          documentId
        ]
      );
      await db.run('DELETE FROM proforma_invoice_items WHERE proforma_invoice_id = ?', [documentId]);
    } else {
      await db.run(
        `INSERT INTO proforma_invoices (
          id,proforma_number,customer_id,source_order_id,sender_type,sender_id,sender_name,sender_email,
          issue_date,valid_till,status,subject,mail_draft,notes,terms,subtotal_amount,tax_amount,total_amount,created_by
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          documentId,
          proformaForm.proforma_number,
          proformaForm.customer_id,
          proformaForm.source_order_id || null,
          sender?.userId ? 'user' : 'company',
          sender?.userId || null,
          sender?.name || settings.company_name || currentUser?.full_name || 'Sender',
          sender?.email || settings.company_email || '',
          proformaForm.issue_date,
          proformaForm.valid_till,
          proformaForm.status,
          proformaForm.subject || `Proforma Invoice ${proformaForm.proforma_number}`,
          proformaForm.mail_draft,
          proformaForm.notes,
          proformaForm.terms,
          proformaPreview.subtotal,
          proformaPreview.tax,
          proformaPreview.total,
          currentUser?.id || currentUser?.username || 'system'
        ]
      );
    }

    for (let index = 0; index < proformaPreview.items.length; index += 1) {
      const item = proformaPreview.items[index];
      if (!item.description) continue;
      await db.run(
        `INSERT INTO proforma_invoice_items (id,proforma_invoice_id,product_id,description,quantity,unit_price,tax_rate,total,sort_order)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [
          generateId(),
          documentId,
          item.product_id || null,
          item.description,
          Number(item.quantity || 0),
          Number(item.unit_price || 0),
          Number(item.tax_rate || 0),
          Number(item.lineTotal || 0),
          index
        ]
      );
    }

    flash('success', `${proformaForm.proforma_number} saved successfully.`);
    closeProformaEditor();
    loadAll();
  };

  const composeProformaDocument = async (record = null) => {
    if (record?.id) {
      const items = await db.all('SELECT * FROM proforma_invoice_items WHERE proforma_invoice_id = ? ORDER BY sort_order', [record.id]);
      return {
        ...record,
        sender_name: record.sender_name || activeSender?.name || settings.company_name || 'Sender',
        sender_email: record.sender_email || activeSender?.email || settings.company_email || '',
        items: items.map((item) => ({
          ...item,
          lineTotal: Number(item.total || ((Number(item.quantity || 0) * Number(item.unit_price || 0)) * (1 + Number(item.tax_rate || 0) / 100)))
        }))
      };
    }

    return {
      ...proformaForm,
      sender_name: activeSender?.name || settings.company_name || 'Sender',
      sender_email: activeSender?.email || settings.company_email || '',
      customer_name: selectedProformaCustomer?.company || selectedProformaCustomer?.name || '',
      customer_email: selectedProformaCustomer?.email || '',
      customer_phone: selectedProformaCustomer?.phone || '',
      customer_gst: selectedProformaCustomer?.gst_number || '',
      order_number: orders.find((entry) => entry.id === proformaForm.source_order_id)?.order_number || '',
      items: proformaPreview.items.map((item) => ({ ...item, total: item.lineTotal }))
    };
  };

  const exportProformaPdf = async (record = null) => {
    const built = await buildProformaPdf(record);
    built.document.save(`${built.docData.proforma_number || 'proforma-invoice'}.pdf`);
    flash('success', 'Proforma invoice PDF generated.');
  };

  const emailProforma = async (record = null) => {
    await openDispatchComposer('proforma', record);
  };

  const changeDbLocation = async () => {
    if (!window.electronAPI?.changeAccountingDatabaseLocation) return flash('error', 'Desktop app required.');
    const result = await window.electronAPI.changeAccountingDatabaseLocation();
    if (result?.success) { flash('success', result.message); loadAll(); }
  };

  const backupDb = async () => {
    if (!window.electronAPI?.backupAccountingDatabase) return flash('error', 'Desktop app required.');
    const result = await window.electronAPI.backupAccountingDatabase();
    flash(result.success ? 'success' : 'error', result.success ? `Backup saved to ${result.path}` : result.error);
  };

  if (loading) {
    return (
      <div className="page">
        <div className="page-header">
          <div className="page-title">
            <h2>Accounting</h2>
            <span className="page-subtitle">Loading financial workspace</span>
          </div>
        </div>
        <div className="page-content">
          <div className="empty-state">
            <RefreshCw className="loading" size={32} />
            <p>Loading accounting workspace...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Accounting</h2>
          <span className="page-subtitle">Separate books, integrated ERP relations, GST-aware billing, and advisor guidance</span>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={loadAll}><RefreshCw size={14} />Refresh</button>
        </div>
      </div>

      {status && (
        <div style={{ padding: '0 24px 12px' }}>
          <div style={{ padding: 12, borderRadius: 12, background: status.type === 'error' ? 'rgba(239,68,68,0.08)' : 'rgba(34,197,94,0.08)', border: `1px solid ${status.type === 'error' ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`, color: status.type === 'error' ? 'var(--danger)' : 'var(--success)' }}>
            {status.message}
          </div>
        </div>
      )}

      <div style={{ padding: '0 24px 12px' }}>
        <div className="tabs" style={{ width: 'fit-content' }}>
          {ACCOUNTING_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              title={`${tab.label} (${tab.hotkey})`}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, minWidth: 74 }}
            >
              <span>{tab.label}</span>
              <span style={{ fontSize: 10, letterSpacing: 0.4, opacity: activeTab === tab.id ? 0.95 : 0.7 }}>{tab.hotkey}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {activeTab === 'overview' && (
          <>
            <div style={{ borderRadius: 20, padding: 24, border: '1px solid var(--border)', background: 'radial-gradient(circle at top right, rgba(61,127,255,0.18), transparent 32%), var(--bg-card)' }}>
              <div className="catalogue-hero-kicker"><Landmark size={12} />Financial backbone</div>
              <h3 style={{ fontSize: 28, marginTop: 16, marginBottom: 10 }}>Sales, payables, GST, treasury, and assets now post into one accounting spine.</h3>
              <p className="text-secondary">Dedicated accounting books stay synced with operational contacts, products, orders, and receipts so commercial control remains connected without fragmenting the party view.</p>
            </div>

            <div className="grid-3">
              {[
                ['Receivables', formatCurrency(metrics.receivables, currencySymbol), `${formatCurrency(metrics.overdue, currencySymbol)} overdue`, ReceiptText, '#3d7fff'],
                ['Payables', formatCurrency(metrics.payables, currencySymbol), `${unifiedPartyStats.total} tracked parties`, Scale, '#f97316'],
                ['Cash & Bank', formatCurrency(metrics.cash, currencySymbol), `${bankAccounts.length} tracked accounts`, Wallet, '#22c55e'],
                ['Net GST', formatCurrency(metrics.outputTax - metrics.inputTax, currencySymbol), `${taxCodes.length} tax masters`, ShieldCheck, '#06b6d4'],
                ['Asset Base', formatCurrency(metrics.assetBase, currencySymbol), `${assets.length} capitalized assets`, Building2, '#a855f7'],
                ['ERP Bridge', `${bridge.orders} live orders`, `${bridge.customers} customers · ${bridge.grns} GRNs`, BookOpen, '#eab308']
              ].map(([label, value, meta, Icon, tone]) => (
                <div key={label} className="stat-card">
                  <div>
                    <div className="stat-card-value" style={{ color: tone }}>{value}</div>
                    <div className="stat-card-label">{label}</div>
                    <div className="text-secondary text-sm mt-2">{meta}</div>
                  </div>
                  <div className="stat-card-icon" style={{ background: `${tone}22` }}>
                    <Icon size={20} color={tone} />
                  </div>
                </div>
              ))}
            </div>

            <div className="grid-2" style={{ display: 'none' }}>
              <div className="card">
                <div className="card-header"><h4>General Ledger & Tax Structure</h4></div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    'Auto journal posting from sales invoices, purchase bills, and fixed assets',
                    'Separate Input and Output GST ledgers for CGST / SGST / IGST',
                    'Manual journals available for month-end entries and controlled adjustments',
                    'Fixed asset capitalization posts directly into the GL base'
                  ].map((item) => (
                    <div key={item} style={{ display: 'flex', gap: 10 }}>
                      <CheckCircle2 size={14} color="var(--success)" />
                      <span className="text-secondary">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="card-header"><h4>Control Watchlist</h4></div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {[
                    ['Pending journals', metrics.pendingJournals],
                    ['Products missing HSN/SAC', metrics.hsnGaps],
                    ['High priority advisor flags', suggestions.filter((item) => item.priority === 'high').length]
                  ].map(([label, value]) => (
                    <div key={label} className="catalogue-summary-card">
                      <span className="catalogue-summary-title">{label}</span>
                      <strong>{value}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'billing' && (
          <>
            <div className="grid-3">
              <div className="catalogue-summary-card"><span className="catalogue-summary-title">Sales invoices</span><strong>{salesInvoices.length}</strong></div>
              <div className="catalogue-summary-card"><span className="catalogue-summary-title">Purchase bills</span><strong>{purchaseBills.length}</strong></div>
              <div className="catalogue-summary-card"><span className="catalogue-summary-title">Open tax position</span><strong>{formatCurrency(metrics.outputTax - metrics.inputTax, currencySymbol)}</strong></div>
            </div>
            <div className="grid-2">
            <div className="card">
              <div className="card-header"><h4>Create Sales Invoice</h4></div>
              <form className="card-body" onSubmit={createSalesInvoice} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                
                {/* Customer Selection - Enhanced UI */}
                {salesForm.customer_id ? (
                  <div style={{ padding: '12px 14px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.05))', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Customer Selected</div>
                        <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: 'var(--text)' }}>{selectedCustomer?.company || selectedCustomer?.name}</div>
                        {selectedCustomer?.gst_number && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>GST: {selectedCustomer.gst_number}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openCustomerContactEditor(selectedCustomer)}><Edit2 size={13} />Edit</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setCustomerSearchModal(true)}>Change</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="btn btn-outline" onClick={() => setCustomerSearchModal(true)} style={{ padding: '12px 16px', justifyContent: 'center', background: 'var(--bg-secondary)', border: '2px dashed var(--border)' }}>
                    <User size={16} style={{ marginRight: 8 }} />
                    <span>Select Customer</span>
                  </button>
                )}

                {/* Customer Search Modal */}
                {customerSearchModal && (
                  <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setCustomerSearchModal(false)}>
                    <div className="modal modal-lg" style={{ maxWidth: '600px' }}>
                      <div className="modal-header">
                        <div>
                          <h3>Select Customer</h3>
                          <div className="text-secondary text-sm" style={{ marginTop: 4 }}>Choose an existing customer or maintain the contact master without leaving Billing.</div>
                        </div>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => openCustomerContactEditor()}><Plus size={13} />Add New Customer</button>
                        <button className="close-btn" onClick={() => { setCustomerSearchModal(false); setCustomerSearch(''); }}><X size={16} /></button>
                      </div>
                      <div className="modal-body" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        <div className="form-group" style={{ marginBottom: 12 }}>
                          <input 
                            className="form-control" 
                            placeholder="Search by name, company, phone, or email..."
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value.toLowerCase())}
                            autoFocus
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {customers.filter((c) => !customerSearch || c.name?.toLowerCase().includes(customerSearch) || c.company?.toLowerCase().includes(customerSearch) || c.phone?.includes(customerSearch) || c.email?.toLowerCase().includes(customerSearch)).map((c) => (
                            <div
                              key={c.id}
                              style={{
                                padding: '12px 14px',
                                borderRadius: 10,
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textAlign: 'left'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{c.company || c.name}</div>
                                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    {c.phone && <span><Phone size={12} style={{ display: 'inline', marginRight: 4 }} />{c.phone}</span>}
                                    {c.email && <span>{c.email}</span>}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>Credit Limit: {formatCurrency(c.credit_limit || 0, currencySymbol)}</div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => openCustomerContactEditor(c)}
                                  >
                                    <Edit2 size={13} />Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => {
                                      setParty('customer', c.id);
                                      setCustomerSearchModal(false);
                                      setCustomerSearch('');
                                    }}
                                  >
                                    Select
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {customerEditorOpen && (
                  <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeCustomerContactEditor()}>
                    <div className="modal modal-xl">
                      <div className="modal-header">
                        <div>
                          <h3>{editingCustomerId ? 'Edit Customer Contact' : 'Add New Customer'}</h3>
                          <div className="text-secondary text-sm" style={{ marginTop: 4 }}>Customer master details used by Billing, Accounting, and settlement workflows.</div>
                        </div>
                        <button className="close-btn" onClick={closeCustomerContactEditor}><X size={16} /></button>
                      </div>
                      <form onSubmit={saveCustomerContact}>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                          <div className="catalogue-form-section">
                            <div className="catalogue-form-section-header">
                              <h4>Customer Identity</h4>
                              <span>Maintain the legal and billing contact details used on invoices.</span>
                            </div>
                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">Contact Name *</label>
                                <input className="form-control" value={customerContactForm.name} onChange={(e) => updateCustomerContactField('name', e.target.value)} autoFocus />
                                {customerContactErrors.name && <span className="text-xs" style={{ color: 'var(--danger)' }}>{customerContactErrors.name}</span>}
                              </div>
                              <div className="form-group">
                                <label className="form-label">Company Name *</label>
                                <input className="form-control" value={customerContactForm.company} onChange={(e) => updateCustomerContactField('company', e.target.value)} />
                                {customerContactErrors.company && <span className="text-xs" style={{ color: 'var(--danger)' }}>{customerContactErrors.company}</span>}
                              </div>
                            </div>
                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input className="form-control" value={customerContactForm.phone} onChange={(e) => updateCustomerContactField('phone', e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Email</label>
                                <input className="form-control" type="email" value={customerContactForm.email} onChange={(e) => updateCustomerContactField('email', e.target.value)} />
                              </div>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Address</label>
                              <textarea className="form-control" rows={3} value={customerContactForm.address} onChange={(e) => updateCustomerContactField('address', e.target.value)} />
                            </div>
                            <div className="grid-3">
                              <div className="form-group">
                                <label className="form-label">City</label>
                                <input className="form-control" value={customerContactForm.city} onChange={(e) => updateCustomerContactField('city', e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">State</label>
                                <input className="form-control" value={customerContactForm.state} onChange={(e) => updateCustomerContactField('state', e.target.value)} placeholder={companyState} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Payment Terms Days</label>
                                <input className="form-control" type="number" min="0" value={customerContactForm.payment_terms_days} onChange={(e) => updateCustomerContactField('payment_terms_days', e.target.value)} />
                              </div>
                            </div>
                          </div>

                          <div className="catalogue-form-section">
                            <div className="catalogue-form-section-header">
                              <h4>Compliance & Credit</h4>
                              <span>These values flow into GST-aware billing and receivable control.</span>
                            </div>
                            <div className="grid-3">
                              <div className="form-group">
                                <label className="form-label">GST Number</label>
                                <input className="form-control" value={customerContactForm.gst_number} onChange={(e) => updateCustomerContactField('gst_number', e.target.value.toUpperCase())} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">PAN Number</label>
                                <input className="form-control" value={customerContactForm.pan_number} onChange={(e) => updateCustomerContactField('pan_number', e.target.value.toUpperCase())} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Credit Limit</label>
                                <input className="form-control" type="number" min="0" step="0.01" value={customerContactForm.credit_limit} onChange={(e) => updateCustomerContactField('credit_limit', e.target.value)} />
                              </div>
                            </div>
                          </div>

                          <div className="catalogue-form-section">
                            <div className="catalogue-form-section-header">
                              <h4>Bank & Settlement</h4>
                              <span>Optional payment details for receipts and customer settlement follow-up.</span>
                            </div>
                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">Account Holder</label>
                                <input className="form-control" value={customerContactForm.account_holder_name} onChange={(e) => updateCustomerContactField('account_holder_name', e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Bank Name</label>
                                <input className="form-control" value={customerContactForm.bank_name} onChange={(e) => updateCustomerContactField('bank_name', e.target.value)} />
                              </div>
                            </div>
                            <div className="grid-3">
                              <div className="form-group">
                                <label className="form-label">Account Number</label>
                                <input className="form-control" value={customerContactForm.account_number} onChange={(e) => updateCustomerContactField('account_number', e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">IFSC</label>
                                <input className="form-control" value={customerContactForm.ifsc_code} onChange={(e) => updateCustomerContactField('ifsc_code', e.target.value.toUpperCase())} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">UPI ID</label>
                                <input className="form-control" value={customerContactForm.upi_id} onChange={(e) => updateCustomerContactField('upi_id', e.target.value)} />
                              </div>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Internal Notes</label>
                              <textarea className="form-control" rows={2} value={customerContactForm.notes} onChange={(e) => updateCustomerContactField('notes', e.target.value)} />
                            </div>
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button type="button" className="btn btn-secondary" onClick={closeCustomerContactEditor}>Cancel</button>
                          <button type="submit" className="btn btn-primary"><Save size={14} />Save & Select</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {selectedCustomer && renderPartySettlementPanel(selectedCustomer, 'customer')}
                {salesForm.source_proforma_id && (
                  <div style={{ padding: '10px 12px', borderRadius: 10, background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--text-primary)', fontSize: 13 }}>
                    <strong>Source:</strong> Proforma invoice {salesForm.source_proforma_number}
                  </div>
                )}
                <div className="grid-2">
                  <input className="form-control" type="date" value={salesForm.invoice_date} onChange={(e) => setSalesForm({ ...salesForm, invoice_date: e.target.value })} />
                  <input className="form-control" type="date" value={salesForm.due_date} onChange={(e) => setSalesForm({ ...salesForm, due_date: e.target.value })} />
                </div>
                <div className="grid-2">
                  <select className="form-control" value={salesForm.source_order_id} onChange={(e) => setSalesForm({ ...salesForm, source_order_id: e.target.value, source_proforma_id: '', source_proforma_number: '' })}>
                    <option value="">Standalone invoice</option>
                    {orders.map((row) => <option key={row.id} value={row.id}>{row.order_number}</option>)}
                  </select>
                  <select className="form-control" value={salesForm.supply_type} onChange={(e) => setSalesForm({ ...salesForm, supply_type: e.target.value })}>
                    <option value="intra-state">Intra-state</option>
                    <option value="inter-state">Inter-state</option>
                  </select>
                </div>

                {/* Product Lines */}
                <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase' }}>Line Items</div>
                  {salesForm.items.map((item, index) => (
                    <div key={`sales-${index}`} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)', marginBottom: 8, border: '1px solid var(--border)' }}>
                      <div className="grid-4" style={{ gap: 8 }}>
                        <input 
                          className="form-control" 
                          value={item.product_name}
                          placeholder="Product / Service"
                          style={{ fontSize: 13 }}
                          readOnly
                        />
                        <input className="form-control" type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => { const items = [...salesForm.items]; items[index] = { ...items[index], quantity: e.target.value }; setSalesForm({ ...salesForm, items }); }} placeholder="Qty" style={{ fontSize: 13 }} />
                        <input className="form-control" type="number" min="0" step="0.01" value={item.rate} onChange={(e) => { const items = [...salesForm.items]; items[index] = { ...items[index], rate: e.target.value }; setSalesForm({ ...salesForm, items }); }} placeholder="Rate" style={{ fontSize: 13 }} />
                        <div style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--bg-primary)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          {formatCurrency(salesPreview.items[index]?.line_total || 0, currencySymbol)}
                          <button type="button" onClick={() => { const items = salesForm.items.filter((_, i) => i !== index); setSalesForm({ ...salesForm, items: items.length === 0 ? [newLine()] : items }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}><Trash size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setSalesForm({ ...salesForm, items: [...salesForm.items, newLine()] })} style={{ flex: 1, justifyContent: 'center' }}>
                    <Plus size={16} style={{ marginRight: 6 }} />
                    Add Product
                  </button>
                </div>

                <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div className="grid-2">
                    <input className="form-control" value={salesForm.place_of_supply} onChange={(e) => setSalesForm({ ...salesForm, place_of_supply: e.target.value })} placeholder="Place of supply" />
                  </div>
                </div>

                <textarea className="form-control" value={salesForm.notes} onChange={(e) => setSalesForm({ ...salesForm, notes: e.target.value })} placeholder="Invoice notes" rows={2} style={{ fontSize: 13 }} />

                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'linear-gradient(135deg, rgba(99,102,241,0.1), rgba(99,102,241,0.05))', border: '1px solid rgba(99,102,241,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Invoice Total</div>
                      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: 'var(--text)' }}>{formatCurrency(salesPreview.total, currencySymbol)}</div>
                    </div>
                    <button type="submit" className="btn btn-primary"><Save size={14} />Post Invoice</button>
                  </div>
                </div>
              </form>
            </div>

            <div className="card">
              <div className="card-header"><h4>Create Purchase Bill</h4></div>
              <form className="card-body" onSubmit={createPurchaseBill} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                
                {/* Vendor Selection - Enhanced UI */}
                {purchaseForm.vendor_id ? (
                  <div style={{ padding: '12px 14px', borderRadius: 12, background: 'linear-gradient(135deg, rgba(249,115,22,0.1), rgba(249,115,22,0.05))', border: '1px solid rgba(249,115,22,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 8 }}>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Vendor Selected</div>
                        <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: 'var(--text)' }}>{selectedVendor?.company || selectedVendor?.name}</div>
                        {selectedVendor?.gst_number && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>GST: {selectedVendor.gst_number}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => openVendorContactEditor(selectedVendor)}><Edit2 size={13} />Edit</button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVendorSearchModal(true)}>Change</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button type="button" className="btn btn-outline" onClick={() => setVendorSearchModal(true)} style={{ padding: '12px 16px', justifyContent: 'center', background: 'var(--bg-secondary)', border: '2px dashed var(--border)' }}>
                    <Building2 size={16} style={{ marginRight: 8 }} />
                    <span>Select Vendor</span>
                  </button>
                )}

                {/* Vendor Search Modal */}
                {vendorSearchModal && (
                  <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setVendorSearchModal(false)}>
                    <div className="modal modal-lg" style={{ maxWidth: '600px' }}>
                      <div className="modal-header">
                        <div>
                          <h3>Select Vendor</h3>
                          <div className="text-secondary text-sm" style={{ marginTop: 4 }}>Choose an existing vendor or maintain the contact master without leaving Billing.</div>
                        </div>
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => openVendorContactEditor()}><Plus size={13} />Add New Vendor</button>
                        <button className="close-btn" onClick={() => { setVendorSearchModal(false); setVendorSearch(''); }}><X size={16} /></button>
                      </div>
                      <div className="modal-body" style={{ maxHeight: '500px', overflowY: 'auto' }}>
                        <div className="form-group" style={{ marginBottom: 12 }}>
                          <input 
                            className="form-control" 
                            placeholder="Search by name, company, phone, or email..."
                            value={vendorSearch}
                            onChange={(e) => setVendorSearch(e.target.value.toLowerCase())}
                            autoFocus
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {vendors.filter((v) => !vendorSearch || v.name?.toLowerCase().includes(vendorSearch) || v.company?.toLowerCase().includes(vendorSearch) || v.phone?.includes(vendorSearch) || v.email?.toLowerCase().includes(vendorSearch)).map((v) => (
                            <div
                              key={v.id}
                              style={{
                                padding: '12px 14px',
                                borderRadius: 10,
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                textAlign: 'left'
                              }}
                              onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
                              onMouseOut={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{v.company || v.name}</div>
                                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                    {v.phone && <span><Phone size={12} style={{ display: 'inline', marginRight: 4 }} />{v.phone}</span>}
                                    {v.email && <span>{v.email}</span>}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>Payment Terms: {v.payment_terms_days} days</div>
                                </div>
                                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => openVendorContactEditor(v)}
                                  >
                                    <Edit2 size={13} />Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={() => {
                                      setParty('vendor', v.id);
                                      setVendorSearchModal(false);
                                      setVendorSearch('');
                                    }}
                                  >
                                    Select
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {vendorEditorOpen && (
                  <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeVendorContactEditor()}>
                    <div className="modal modal-xl">
                      <div className="modal-header">
                        <div>
                          <h3>{editingVendorId ? 'Edit Vendor Contact' : 'Add New Vendor'}</h3>
                          <div className="text-secondary text-sm" style={{ marginTop: 4 }}>Vendor master details used by Purchase Billing, Accounting, and settlement workflows.</div>
                        </div>
                        <button className="close-btn" onClick={closeVendorContactEditor}><X size={16} /></button>
                      </div>
                      <form onSubmit={saveVendorContact}>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                          <div className="catalogue-form-section">
                            <div className="catalogue-form-section-header">
                              <h4>Vendor Identity</h4>
                              <span>Maintain the legal and payable contact details used on purchase bills.</span>
                            </div>
                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">Contact Name *</label>
                                <input className="form-control" value={vendorContactForm.name} onChange={(e) => updateVendorContactField('name', e.target.value)} autoFocus />
                                {vendorContactErrors.name && <span className="text-xs" style={{ color: 'var(--danger)' }}>{vendorContactErrors.name}</span>}
                              </div>
                              <div className="form-group">
                                <label className="form-label">Company Name *</label>
                                <input className="form-control" value={vendorContactForm.company} onChange={(e) => updateVendorContactField('company', e.target.value)} />
                                {vendorContactErrors.company && <span className="text-xs" style={{ color: 'var(--danger)' }}>{vendorContactErrors.company}</span>}
                              </div>
                            </div>
                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">Phone</label>
                                <input className="form-control" value={vendorContactForm.phone} onChange={(e) => updateVendorContactField('phone', e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Email</label>
                                <input className="form-control" type="email" value={vendorContactForm.email} onChange={(e) => updateVendorContactField('email', e.target.value)} />
                              </div>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Address</label>
                              <textarea className="form-control" rows={3} value={vendorContactForm.address} onChange={(e) => updateVendorContactField('address', e.target.value)} />
                            </div>
                            <div className="grid-3">
                              <div className="form-group">
                                <label className="form-label">City</label>
                                <input className="form-control" value={vendorContactForm.city} onChange={(e) => updateVendorContactField('city', e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">State</label>
                                <input className="form-control" value={vendorContactForm.state} onChange={(e) => updateVendorContactField('state', e.target.value)} placeholder={companyState} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Payment Terms Days</label>
                                <input className="form-control" type="number" min="0" value={vendorContactForm.payment_terms_days} onChange={(e) => updateVendorContactField('payment_terms_days', e.target.value)} />
                              </div>
                            </div>
                          </div>

                          <div className="catalogue-form-section">
                            <div className="catalogue-form-section-header">
                              <h4>Compliance & Payables</h4>
                              <span>These values flow into GST-aware purchase billing and payable control.</span>
                            </div>
                            <div className="grid-3">
                              <div className="form-group">
                                <label className="form-label">GST Number</label>
                                <input className="form-control" value={vendorContactForm.gst_number} onChange={(e) => updateVendorContactField('gst_number', e.target.value.toUpperCase())} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">PAN Number</label>
                                <input className="form-control" value={vendorContactForm.pan_number} onChange={(e) => updateVendorContactField('pan_number', e.target.value.toUpperCase())} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Credit Limit</label>
                                <input className="form-control" type="number" min="0" step="0.01" value={vendorContactForm.credit_limit} onChange={(e) => updateVendorContactField('credit_limit', e.target.value)} />
                              </div>
                            </div>
                          </div>

                          <div className="catalogue-form-section">
                            <div className="catalogue-form-section-header">
                              <h4>Bank & Settlement</h4>
                              <span>Optional payment details for vendor settlement and remittance follow-up.</span>
                            </div>
                            <div className="grid-2">
                              <div className="form-group">
                                <label className="form-label">Account Holder</label>
                                <input className="form-control" value={vendorContactForm.account_holder_name} onChange={(e) => updateVendorContactField('account_holder_name', e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">Bank Name</label>
                                <input className="form-control" value={vendorContactForm.bank_name} onChange={(e) => updateVendorContactField('bank_name', e.target.value)} />
                              </div>
                            </div>
                            <div className="grid-3">
                              <div className="form-group">
                                <label className="form-label">Account Number</label>
                                <input className="form-control" value={vendorContactForm.account_number} onChange={(e) => updateVendorContactField('account_number', e.target.value)} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">IFSC</label>
                                <input className="form-control" value={vendorContactForm.ifsc_code} onChange={(e) => updateVendorContactField('ifsc_code', e.target.value.toUpperCase())} />
                              </div>
                              <div className="form-group">
                                <label className="form-label">UPI ID</label>
                                <input className="form-control" value={vendorContactForm.upi_id} onChange={(e) => updateVendorContactField('upi_id', e.target.value)} />
                              </div>
                            </div>
                            <div className="form-group">
                              <label className="form-label">Internal Notes</label>
                              <textarea className="form-control" rows={2} value={vendorContactForm.notes} onChange={(e) => updateVendorContactField('notes', e.target.value)} />
                            </div>
                          </div>
                        </div>
                        <div className="modal-footer">
                          <button type="button" className="btn btn-secondary" onClick={closeVendorContactEditor}>Cancel</button>
                          <button type="submit" className="btn btn-primary"><Save size={14} />Save & Select</button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {selectedVendor && renderPartySettlementPanel(selectedVendor, 'vendor')}
                <div className="grid-2">
                  <input className="form-control" type="date" value={purchaseForm.bill_date} onChange={(e) => setPurchaseForm({ ...purchaseForm, bill_date: e.target.value })} />
                  <input className="form-control" type="date" value={purchaseForm.due_date} onChange={(e) => setPurchaseForm({ ...purchaseForm, due_date: e.target.value })} />
                </div>
                <div className="grid-2">
                  <select className="form-control" value={purchaseForm.source_grn_id} onChange={(e) => setPurchaseForm({ ...purchaseForm, source_grn_id: e.target.value })}>
                    <option value="">Standalone bill</option>
                    {grns.map((row) => <option key={row.id} value={row.id}>{row.grn_number}</option>)}
                  </select>
                  <select className="form-control" value={purchaseForm.supply_type} onChange={(e) => setPurchaseForm({ ...purchaseForm, supply_type: e.target.value })}>
                    <option value="intra-state">Intra-state</option>
                    <option value="inter-state">Inter-state</option>
                  </select>
                </div>

                {/* Product Lines */}
                <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, textTransform: 'uppercase' }}>Line Items</div>
                  {purchaseForm.items.map((item, index) => (
                    <div key={`purchase-${index}`} style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg-secondary)', marginBottom: 8, border: '1px solid var(--border)' }}>
                      <div className="grid-4" style={{ gap: 8 }}>
                        <input 
                          className="form-control" 
                          value={item.product_name}
                          placeholder="Product / Service"
                          style={{ fontSize: 13 }}
                          readOnly
                        />
                        <input className="form-control" type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => { const items = [...purchaseForm.items]; items[index] = { ...items[index], quantity: e.target.value }; setPurchaseForm({ ...purchaseForm, items }); }} placeholder="Qty" style={{ fontSize: 13 }} />
                        <input className="form-control" type="number" min="0" step="0.01" value={item.rate} onChange={(e) => { const items = [...purchaseForm.items]; items[index] = { ...items[index], rate: e.target.value }; setPurchaseForm({ ...purchaseForm, items }); }} placeholder="Rate" style={{ fontSize: 13 }} />
                        <div style={{ padding: '8px 12px', borderRadius: 6, background: 'var(--bg-primary)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          {formatCurrency(purchasePreview.items[index]?.line_total || 0, currencySymbol)}
                          <button type="button" onClick={() => { const items = purchaseForm.items.filter((_, i) => i !== index); setPurchaseForm({ ...purchaseForm, items: items.length === 0 ? [newLine()] : items }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--text-muted)' }}><Trash size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setPurchaseForm({ ...purchaseForm, items: [...purchaseForm.items, newLine()] })} style={{ flex: 1, justifyContent: 'center' }}>
                    <Plus size={16} style={{ marginRight: 6 }} />
                    Add Product
                  </button>
                </div>

                <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div className="grid-2">
                    <input className="form-control" value={purchaseForm.place_of_supply} onChange={(e) => setPurchaseForm({ ...purchaseForm, place_of_supply: e.target.value })} placeholder="Place of supply" />
                  </div>
                </div>

                <label style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: 'var(--bg-secondary)' }}>
                  <input type="checkbox" checked={purchaseForm.itc_eligible} onChange={(e) => setPurchaseForm({ ...purchaseForm, itc_eligible: e.target.checked })} style={{ cursor: 'pointer' }} />
                  <span className="text-secondary" style={{ cursor: 'pointer' }}>ITC eligible</span>
                </label>

                <textarea className="form-control" value={purchaseForm.notes} onChange={(e) => setPurchaseForm({ ...purchaseForm, notes: e.target.value })} placeholder="Bill notes" rows={2} style={{ fontSize: 13 }} />

                <div style={{ padding: '12px 14px', borderRadius: 10, background: 'linear-gradient(135deg, rgba(249,115,22,0.1), rgba(249,115,22,0.05))', border: '1px solid rgba(249,115,22,0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Bill Total</div>
                      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: 'var(--text)' }}>{formatCurrency(purchasePreview.total, currencySymbol)}</div>
                    </div>
                    <button type="submit" className="btn btn-primary"><Save size={14} />Post Bill</button>
                  </div>
                </div>
              </form>
            </div>
            </div>
            <div className="grid-2">
              <div className="card">
                <div className="card-header"><h4>Sales Invoice Register</h4></div>
                <div className="table-container" style={{ maxHeight: 320 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Customer</th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Outstanding</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesInvoices.length ? salesInvoices.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <div className="font-mono text-accent">{row.invoice_number}</div>
                            <span className={`badge ${row.status === 'paid' ? 'badge-success' : row.status === 'part_paid' ? 'badge-warning' : 'badge-secondary'}`}>{row.status}</span>
                          </td>
                          <td>{row.customer_name}</td>
                          <td>{formatDate(row.invoice_date)}</td>
                          <td>{formatCurrency(row.total_amount || 0, currencySymbol)}</td>
                          <td>{formatCurrency(row.outstanding_amount || 0, currencySymbol)}</td>
                          <td>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button className="btn btn-secondary btn-sm" onClick={() => exportSalesInvoicePdf(row)}><Download size={13} />PDF</button>
                              <button className="btn btn-secondary btn-sm" onClick={() => openDispatchComposer('invoice', row)}><ReceiptText size={13} />Email</button>
                              <button className="btn btn-primary btn-sm" onClick={() => prepareSettlementForParty('customer', row.customer_id)}><Wallet size={13} />Receive</button>
                            </div>
                          </td>
                        </tr>
                      )) : <tr><td colSpan={6} className="text-center text-muted">No sales invoices yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><h4>Purchase Bill Register</h4></div>
                <div className="table-container" style={{ maxHeight: 320 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Bill</th>
                        <th>Vendor</th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Outstanding</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {purchaseBills.length ? purchaseBills.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <div className="font-mono text-accent">{row.bill_number}</div>
                            <span className={`badge ${row.status === 'paid' ? 'badge-success' : row.status === 'part_paid' ? 'badge-warning' : 'badge-secondary'}`}>{row.status}</span>
                          </td>
                          <td>{row.vendor_name}</td>
                          <td>{formatDate(row.bill_date)}</td>
                          <td>{formatCurrency(row.total_amount || 0, currencySymbol)}</td>
                          <td>{formatCurrency(row.outstanding_amount || 0, currencySymbol)}</td>
                          <td><button className="btn btn-primary btn-sm" onClick={() => prepareSettlementForParty('vendor', row.vendor_id)}><Wallet size={13} />Pay</button></td>
                        </tr>
                      )) : <tr><td colSpan={6} className="text-center text-muted">No purchase bills yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'settlement' && (
          <>
            <div className="grid-3">
              <div className="catalogue-summary-card"><span className="catalogue-summary-title">Receipts Posted</span><strong>{receiptVouchers.length}</strong><span className="text-secondary text-sm">{formatCurrency(receiptVouchers.reduce((sum, row) => sum + Number(row.amount || 0), 0), currencySymbol)} collected</span></div>
              <div className="catalogue-summary-card"><span className="catalogue-summary-title">Payments Posted</span><strong>{paymentVouchers.length}</strong><span className="text-secondary text-sm">{formatCurrency(paymentVouchers.reduce((sum, row) => sum + Number(row.amount || 0), 0), currencySymbol)} released</span></div>
              <div className="catalogue-summary-card"><span className="catalogue-summary-title">Banking Base</span><strong>{bankAccounts.length}</strong><span className="text-secondary text-sm">{formatCurrency(metrics.cash, currencySymbol)} available across tracked accounts</span></div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-header"><h4>Post Receipt Voucher</h4></div>
                <form className="card-body" onSubmit={postReceiptVoucher} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="grid-2">
                    <select className="form-control" value={receiptForm.customer_id} onChange={(e) => setReceiptCustomer(e.target.value)}>
                      <option value="">Select customer</option>
                      {customers.map((row) => <option key={row.id} value={row.id}>{row.company || row.name}</option>)}
                    </select>
                    <select className="form-control" value={receiptForm.bank_account_id} onChange={(e) => setReceiptForm({ ...receiptForm, bank_account_id: e.target.value })}>
                      <option value="">Collection bank</option>
                      {bankAccounts.map((row) => <option key={row.id} value={row.id}>{row.account_name}</option>)}
                    </select>
                  </div>
                  <div className="grid-3">
                    <input className="form-control" type="date" value={receiptForm.receipt_date} onChange={(e) => setReceiptForm({ ...receiptForm, receipt_date: e.target.value })} />
                    <select className="form-control" value={receiptForm.payment_mode} onChange={(e) => setReceiptForm({ ...receiptForm, payment_mode: e.target.value })}>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="upi">UPI</option>
                      <option value="cheque">Cheque</option>
                      <option value="cash">Cash</option>
                    </select>
                    <input className="form-control" value={receiptForm.reference_number} onChange={(e) => setReceiptForm({ ...receiptForm, reference_number: e.target.value })} placeholder="UTR / cheque / ref no." />
                  </div>
                  <textarea className="form-control" rows={2} value={receiptForm.narration} onChange={(e) => setReceiptForm({ ...receiptForm, narration: e.target.value })} placeholder="Narration" />
                  <div className="table-container" style={{ maxHeight: 220 }}>
                    <table className="data-table">
                      <thead><tr><th>Invoice</th><th>Due</th><th>Outstanding</th><th>Allocate</th></tr></thead>
                      <tbody>
                        {receiptForm.allocations.length ? receiptForm.allocations.map((row) => (
                          <tr key={row.id}>
                            <td>{row.invoice_number}</td>
                            <td>{formatDate(row.due_date)}</td>
                            <td>{formatCurrency(row.outstanding_amount || 0, currencySymbol)}</td>
                            <td><input className="form-control" type="number" min="0" step="0.01" value={row.allocated_amount || ''} onChange={(e) => updateReceiptAllocation(row.id, e.target.value)} /></td>
                          </tr>
                        )) : <tr><td colSpan={4} className="text-center text-muted">Choose a customer with open invoices</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="catalogue-summary-card" style={{ minWidth: 220 }}><span className="catalogue-summary-title">Receipt Amount</span><strong>{formatCurrency(receiptAmount, currencySymbol)}</strong></div>
                    <button type="submit" className="btn btn-primary"><Save size={14} />Post Receipt</button>
                  </div>
                </form>
              </div>

              <div className="card">
                <div className="card-header"><h4>Post Payment Voucher</h4></div>
                <form className="card-body" onSubmit={postPaymentVoucher} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="grid-2">
                    <select className="form-control" value={paymentForm.vendor_id} onChange={(e) => setPaymentVendor(e.target.value)}>
                      <option value="">Select vendor</option>
                      {vendors.map((row) => <option key={row.id} value={row.id}>{row.company || row.name}</option>)}
                    </select>
                    <select className="form-control" value={paymentForm.bank_account_id} onChange={(e) => setPaymentForm({ ...paymentForm, bank_account_id: e.target.value })}>
                      <option value="">Payment bank</option>
                      {bankAccounts.map((row) => <option key={row.id} value={row.id}>{row.account_name}</option>)}
                    </select>
                  </div>
                  <div className="grid-3">
                    <input className="form-control" type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
                    <select className="form-control" value={paymentForm.payment_mode} onChange={(e) => setPaymentForm({ ...paymentForm, payment_mode: e.target.value })}>
                      <option value="bank_transfer">Bank Transfer</option>
                      <option value="upi">UPI</option>
                      <option value="cheque">Cheque</option>
                      <option value="cash">Cash</option>
                    </select>
                    <input className="form-control" value={paymentForm.reference_number} onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })} placeholder="UTR / cheque / ref no." />
                  </div>
                  <textarea className="form-control" rows={2} value={paymentForm.narration} onChange={(e) => setPaymentForm({ ...paymentForm, narration: e.target.value })} placeholder="Narration" />
                  <div className="table-container" style={{ maxHeight: 220 }}>
                    <table className="data-table">
                      <thead><tr><th>Bill</th><th>Due</th><th>Outstanding</th><th>Allocate</th></tr></thead>
                      <tbody>
                        {paymentForm.allocations.length ? paymentForm.allocations.map((row) => (
                          <tr key={row.id}>
                            <td>{row.bill_number}</td>
                            <td>{formatDate(row.due_date)}</td>
                            <td>{formatCurrency(row.outstanding_amount || 0, currencySymbol)}</td>
                            <td><input className="form-control" type="number" min="0" step="0.01" value={row.allocated_amount || ''} onChange={(e) => updatePaymentAllocation(row.id, e.target.value)} /></td>
                          </tr>
                        )) : <tr><td colSpan={4} className="text-center text-muted">Choose a vendor with open bills</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div className="catalogue-summary-card" style={{ minWidth: 220 }}><span className="catalogue-summary-title">Payment Amount</span><strong>{formatCurrency(paymentAmount, currencySymbol)}</strong></div>
                    <button type="submit" className="btn btn-primary"><Save size={14} />Post Payment</button>
                  </div>
                </form>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-header"><h4>Recent Receipt Vouchers</h4></div>
                <div className="table-container" style={{ maxHeight: 260 }}>
                  <table className="data-table">
                    <thead><tr><th>Receipt</th><th>Customer</th><th>Date</th><th>Bank</th><th>Amount</th></tr></thead>
                    <tbody>
                      {receiptVouchers.length ? receiptVouchers.map((row) => (
                        <tr key={row.id}>
                          <td className="font-mono text-accent">{row.receipt_number}</td>
                          <td>{row.customer_name}</td>
                          <td>{formatDate(row.receipt_date)}</td>
                          <td>{row.account_name || '-'}</td>
                          <td>{formatCurrency(row.amount || 0, currencySymbol)}</td>
                        </tr>
                      )) : <tr><td colSpan={5} className="text-center text-muted">No receipt vouchers yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="card">
                <div className="card-header"><h4>Recent Payment Vouchers</h4></div>
                <div className="table-container" style={{ maxHeight: 260 }}>
                  <table className="data-table">
                    <thead><tr><th>Payment</th><th>Vendor</th><th>Date</th><th>Bank</th><th>Amount</th></tr></thead>
                    <tbody>
                      {paymentVouchers.length ? paymentVouchers.map((row) => (
                        <tr key={row.id}>
                          <td className="font-mono text-accent">{row.payment_number}</td>
                          <td>{row.vendor_name}</td>
                          <td>{formatDate(row.payment_date)}</td>
                          <td>{row.account_name || '-'}</td>
                          <td>{formatCurrency(row.amount || 0, currencySymbol)}</td>
                        </tr>
                      )) : <tr><td colSpan={5} className="text-center text-muted">No payment vouchers yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'proforma' && (
          <>
            <div style={{ borderRadius: 20, padding: 24, border: '1px solid var(--border)', background: 'radial-gradient(circle at top right, rgba(34,197,94,0.16), transparent 34%), var(--bg-card)' }}>
              <div className="catalogue-hero-kicker"><ReceiptText size={12} />Commercial pre-billing</div>
              <h3 style={{ fontSize: 28, marginTop: 16, marginBottom: 10 }}>Proforma invoices sit between quotation intent and final accounting invoice.</h3>
              <p className="text-secondary">
                Use proforma invoices for advance requests, customer approval loops, dispatch preparation, and commercial confirmation before a tax invoice is posted into books.
              </p>
              <div className="catalogue-chip-row" style={{ marginTop: 16 }}>
                <span className="catalogue-chip">Editable commercial document</span>
                <span className="catalogue-chip">Customer and order linked</span>
                <span className="catalogue-chip">PDF and email ready</span>
              </div>
            </div>

            <div className="grid-3">
              <div className="catalogue-summary-card">
                <span className="catalogue-summary-title">Proforma Invoices</span>
                <strong>{proformas.length}</strong>
                <span className="text-secondary text-sm">{proformas.filter((row) => row.status === 'draft').length} drafts in progress</span>
              </div>
              <div className="catalogue-summary-card">
                <span className="catalogue-summary-title">Draft Value</span>
                <strong>{formatCurrency(proformas.filter((row) => row.status === 'draft').reduce((sum, row) => sum + Number(row.total_amount || 0), 0), currencySymbol)}</strong>
                <span className="text-secondary text-sm">Commercial value not yet posted to statutory books.</span>
              </div>
              <div className="catalogue-summary-card">
                <span className="catalogue-summary-title">Sender Profiles</span>
                <strong>{senderOptions.length}</strong>
                <span className="text-secondary text-sm">Company and user senders available for outbound communication.</span>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <div>
                  <h4>Proforma Invoice Register</h4>
                  <div className="text-secondary text-sm">Create, revise, export, and email customer-ready proforma documents.</div>
                </div>
                <button className="btn btn-primary" onClick={() => openProformaEditor()}><Plus size={14} />New Proforma</button>
              </div>
              <div className="table-container" style={{ maxHeight: 420 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Document</th>
                      <th>Customer</th>
                      <th>Source</th>
                      <th>Sender</th>
                      <th>Validity</th>
                      <th>Total</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proformas.length === 0 ? (
                      <tr><td colSpan={7} className="text-center text-muted">No proforma invoices yet</td></tr>
                    ) : proformas.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="font-mono text-accent">{row.proforma_number}</div>
                          <span className={`badge ${row.status === 'sent' ? 'badge-info' : row.status === 'approved' ? 'badge-success' : 'badge-secondary'}`}>{row.status}</span>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{row.customer_company || row.customer_name || '-'}</div>
                        </td>
                        <td>
                          <div>{row.order_number || 'Standalone'}</div>
                        </td>
                        <td>
                          <div>{row.sender_name || '-'}</div>
                          <div className="text-secondary text-sm">{row.sender_email || '-'}</div>
                        </td>
                        <td>
                          <div>{formatDate(row.issue_date)}</div>
                          <div className="text-secondary text-sm">Till {formatDate(row.valid_till)}</div>
                        </td>
                        <td>{formatCurrency(row.total_amount || 0, currencySymbol)}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openProformaEditor(row)}><CheckCircle2 size={13} />Edit</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => exportProformaPdf(row)}><Download size={13} />PDF</button>
                            <button className="btn btn-primary btn-sm" onClick={() => emailProforma(row)}><ReceiptText size={13} />Email</button>
                            <button className="btn btn-success btn-sm" onClick={() => convertProformaToSalesInvoice(row)}><ReceiptText size={13} />Convert</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'voucher' && (
          <VoucherWorkbench
            customers={customers}
            vendors={vendors}
            products={products}
            bankAccounts={bankAccounts}
            accounts={accounts}
            orders={orders}
            grns={grns}
            salesInvoices={salesInvoices}
            purchaseBills={purchaseBills}
            currencySymbol={currencySymbol}
            companyState={companyState}
            onRefresh={loadAll}
            flash={flash}
          />
        )}

        {activeTab === 'parties' && (
          <>
            <div className="grid-3">
              <div className="catalogue-summary-card">
                <span className="catalogue-summary-title">Party Directory</span>
                <strong>{unifiedPartyStats.total}</strong>
                <span className="text-secondary text-sm">{unifiedPartyStats.dualSide} operate on both receivable and payable flows</span>
              </div>
              <div className="catalogue-summary-card">
                <span className="catalogue-summary-title">Banking Readiness</span>
                <strong>{unifiedPartyStats.bankReady}</strong>
                <span className="text-secondary text-sm">{Math.max(unifiedPartyStats.total - unifiedPartyStats.bankReady, 0)} still need settlement rails</span>
              </div>
              <div className="catalogue-summary-card">
                <span className="catalogue-summary-title">Operational Bridge</span>
                <strong>{bridge.orders + bridge.grns}</strong>
                <span className="text-secondary text-sm">{bridge.orders} active orders, {bridge.grns} GRNs, and {partyFollowups.length} saved party follow-ups.</span>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h4>Collection Control</h4></div>
              <div className="table-container" style={{ maxHeight: 420 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Party</th>
                      <th>Banking</th>
                      <th>Receivable</th>
                      <th>Payable</th>
                      <th>Overdue</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unifiedParties.length === 0 ? (
                      <tr><td colSpan={6} className="text-center text-muted">No parties</td></tr>
                    ) : unifiedParties.map((row) => (
                      <tr key={row.key}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{row.displayName}</div>
                          <div className="text-secondary text-sm">{row.relationshipSummary}</div>
                        </td>
                        <td>
                          <div>{row.bank_name || 'Bank not set'}</div>
                          <div className="text-secondary text-sm">{row.routing}</div>
                          <span className={`badge ${row.bankReady ? 'badge-success' : 'badge-secondary'}`}>{row.bankReady ? 'Ready' : 'Pending'}</span>
                        </td>
                        <td>{formatCurrency(row.receivable || 0, currencySymbol)}</td>
                        <td>{formatCurrency(row.payable || 0, currencySymbol)}</td>
                        <td>
                          <span className={`badge ${Number(row.overdue || 0) > 0 ? 'badge-danger' : 'badge-success'}`}>
                            {formatCurrency(row.overdue || 0, currencySymbol)}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => openPartyLedger(row.customer ? 'customer' : 'vendor', row.customer?.id || row.vendor?.id)}><BookOpen size={13} />Ledger</button>
                            {row.customer ? <button className="btn btn-primary btn-sm" onClick={() => prepareSettlementForParty('customer', row.customer.id)}><Wallet size={13} />Receive</button> : null}
                            {row.vendor ? <button className="btn btn-secondary btn-sm" onClick={() => prepareSettlementForParty('vendor', row.vendor.id)}><Wallet size={13} />Pay</button> : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ display: 'none' }}>

            <div className="grid-3">
              <div className="catalogue-summary-card">
                <span className="catalogue-summary-title">Party Directory</span>
                <strong>{unifiedPartyStats.total}</strong>
                <span className="text-secondary text-sm">{unifiedPartyStats.dualSide} operate on both receivable and payable flows</span>
              </div>
              <div className="catalogue-summary-card">
                <span className="catalogue-summary-title">Banking Readiness</span>
                <strong>{unifiedPartyStats.bankReady}</strong>
                <span className="text-secondary text-sm">{Math.max(unifiedPartyStats.total - unifiedPartyStats.bankReady, 0)} still need settlement rails</span>
              </div>
              <div className="catalogue-summary-card">
                <span className="catalogue-summary-title">Operational Bridge</span>
                <strong>{bridge.orders + bridge.grns}</strong>
                <span className="text-secondary text-sm">{bridge.orders} active orders, {bridge.grns} GRNs, and {partyFollowups.length} saved party follow-ups.</span>
              </div>
            </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-header"><h4>Customer Collections Control</h4></div>
                <div className="table-container" style={{ maxHeight: 360 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Banking</th>
                        <th>Outstanding</th>
                        <th>Overdue</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {customers.length === 0 ? (
                        <tr><td colSpan={5} className="text-center text-muted">No customers</td></tr>
                      ) : customers.map((row) => {
                        const exposure = customerExposureMap[row.id] || {};
                        const routing = row.ifsc_code || row.upi_id || row.swift_code || row.iban || 'Pending';
                        const bankReady = (row.bank_name || row.account_number || row.upi_id) && routing !== 'Pending';
                        return (
                          <tr key={row.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{row.company || row.name}</div>
                              <div className="text-secondary text-sm">{Number(row.payment_terms_days || 0)} day terms · Limit {formatCurrency(row.credit_limit || 0, currencySymbol)}</div>
                            </td>
                            <td>
                              <div>{row.bank_name || 'Bank not set'}</div>
                              <div className="text-secondary text-sm">{routing}</div>
                              <span className={`badge ${bankReady ? 'badge-success' : 'badge-secondary'}`}>{bankReady ? 'Ready' : 'Pending'}</span>
                            </td>
                            <td>{formatCurrency(exposure.outstanding_amount || 0, currencySymbol)}</td>
                            <td>
                              <span className={`badge ${Number(exposure.overdue_amount || 0) > 0 ? 'badge-danger' : 'badge-success'}`}>
                                {formatCurrency(exposure.overdue_amount || 0, currencySymbol)}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => openPartyLedger('customer', row.id)}><BookOpen size={13} />Ledger</button>
                                <button className="btn btn-primary btn-sm" onClick={() => prepareSettlementForParty('customer', row.id)}><Wallet size={13} />Receive</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="card">
                <div className="card-header"><h4>Vendor Settlement Control</h4></div>
                <div className="table-container" style={{ maxHeight: 360 }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Vendor</th>
                        <th>Banking</th>
                        <th>Payable</th>
                        <th>Overdue</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendors.length === 0 ? (
                        <tr><td colSpan={5} className="text-center text-muted">No vendors</td></tr>
                      ) : vendors.map((row) => {
                        const exposure = vendorExposureMap[row.id] || {};
                        const routing = row.ifsc_code || row.upi_id || row.swift_code || row.iban || 'Pending';
                        const bankReady = (row.bank_name || row.account_number || row.upi_id) && routing !== 'Pending';
                        return (
                          <tr key={row.id}>
                            <td>
                              <div style={{ fontWeight: 600 }}>{row.company || row.name}</div>
                              <div className="text-secondary text-sm">{Number(row.payment_terms_days || 0)} day terms · Preferred {formatPaymentMethod(row.preferred_payment_method)}</div>
                            </td>
                            <td>
                              <div>{row.bank_name || 'Bank not set'}</div>
                              <div className="text-secondary text-sm">{routing}</div>
                              <span className={`badge ${bankReady ? 'badge-success' : 'badge-secondary'}`}>{bankReady ? 'Ready' : 'Pending'}</span>
                            </td>
                            <td>{formatCurrency(exposure.outstanding_amount || 0, currencySymbol)}</td>
                            <td>
                              <span className={`badge ${Number(exposure.overdue_amount || 0) > 0 ? 'badge-danger' : 'badge-success'}`}>
                                {formatCurrency(exposure.overdue_amount || 0, currencySymbol)}
                              </span>
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button className="btn btn-secondary btn-sm" onClick={() => openPartyLedger('vendor', row.id)}><BookOpen size={13} />Ledger</button>
                                <button className="btn btn-primary btn-sm" onClick={() => prepareSettlementForParty('vendor', row.id)}><Wallet size={13} />Pay</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'banking' && (
          <>
            <div className="grid-3">
              <div className="catalogue-summary-card"><span className="catalogue-summary-title">Bank Accounts</span><strong>{bankAccounts.length}</strong><span className="text-secondary text-sm">{formatCurrency(metrics.cash, currencySymbol)} live balance</span></div>
              <div className="catalogue-summary-card"><span className="catalogue-summary-title">Unmatched Statement Lines</span><strong>{reconciliationLines.filter((row) => row.status === 'unmatched').length}</strong><span className="text-secondary text-sm">Awaiting reconciliation against books</span></div>
              <div className="catalogue-summary-card"><span className="catalogue-summary-title">Unreconciled Bank Book</span><strong>{bankTransactions.filter((row) => !unreconciledBankTransactionIds.has(row.id)).length}</strong><span className="text-secondary text-sm">Book entries still not matched to statement</span></div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-header"><h4>Add Bank Statement Line</h4></div>
                <form className="card-body" onSubmit={addReconciliationLine} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="grid-2">
                    <select className="form-control" value={reconciliationForm.bank_account_id} onChange={(e) => setReconciliationForm({ ...reconciliationForm, bank_account_id: e.target.value })}>
                      <option value="">Select bank account</option>
                      {bankAccounts.map((row) => <option key={row.id} value={row.id}>{row.account_name}</option>)}
                    </select>
                    <input className="form-control" type="date" value={reconciliationForm.statement_date} onChange={(e) => setReconciliationForm({ ...reconciliationForm, statement_date: e.target.value })} />
                  </div>
                  <div className="grid-3">
                    <input className="form-control" value={reconciliationForm.reference_number} onChange={(e) => setReconciliationForm({ ...reconciliationForm, reference_number: e.target.value })} placeholder="Bank reference" />
                    <select className="form-control" value={reconciliationForm.entry_type} onChange={(e) => setReconciliationForm({ ...reconciliationForm, entry_type: e.target.value })}>
                      <option value="credit">Credit</option>
                      <option value="debit">Debit</option>
                    </select>
                    <input className="form-control" type="number" min="0" step="0.01" value={reconciliationForm.amount} onChange={(e) => setReconciliationForm({ ...reconciliationForm, amount: e.target.value })} placeholder="Amount" />
                  </div>
                  <input className="form-control" value={reconciliationForm.description} onChange={(e) => setReconciliationForm({ ...reconciliationForm, description: e.target.value })} placeholder="Description" />
                  <textarea className="form-control" rows={2} value={reconciliationForm.notes} onChange={(e) => setReconciliationForm({ ...reconciliationForm, notes: e.target.value })} placeholder="Notes" />
                  <button type="submit" className="btn btn-primary"><Save size={14} />Add Statement Entry</button>
                </form>
              </div>

              <div className="card">
                <div className="card-header"><h4>Bank Book Feed</h4></div>
                <div className="table-container" style={{ maxHeight: 320 }}>
                  <table className="data-table">
                    <thead><tr><th>Date</th><th>Description</th><th>Bank</th><th>Type</th><th>Amount</th><th>Status</th></tr></thead>
                    <tbody>
                      {bankTransactions.length ? bankTransactions.map((row) => (
                        <tr key={row.id}>
                          <td>{formatDate(row.transaction_date)}</td>
                          <td>{row.description || '-'}</td>
                          <td>{row.account_name || '-'}</td>
                          <td><span className={`badge ${row.transaction_type === 'credit' ? 'badge-success' : 'badge-warning'}`}>{row.transaction_type}</span></td>
                          <td>{formatCurrency(row.amount || 0, currencySymbol)}</td>
                          <td><span className={`badge ${unreconciledBankTransactionIds.has(row.id) ? 'badge-success' : 'badge-secondary'}`}>{unreconciledBankTransactionIds.has(row.id) ? 'Matched' : 'Open'}</span></td>
                        </tr>
                      )) : <tr><td colSpan={6} className="text-center text-muted">No bank transactions yet</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h4>Statement Matching Workspace</h4></div>
              <div className="table-container" style={{ maxHeight: 360 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Statement Line</th>
                      <th>Bank</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Match To</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconciliationLines.length ? reconciliationLines.map((row) => {
                      const matchCandidates = bankTransactions.filter((txn) => txn.bank_account_id === row.bank_account_id && !unreconciledBankTransactionIds.has(txn.id));
                      return (
                        <tr key={row.id}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{row.reference_number || row.description || 'Statement entry'}</div>
                            <div className="text-secondary text-sm">{formatDate(row.statement_date)}</div>
                          </td>
                          <td>{row.account_name || '-'}</td>
                          <td>{formatCurrency(row.amount || 0, currencySymbol)}</td>
                          <td><span className={`badge ${row.status === 'matched' ? 'badge-success' : row.status === 'ignored' ? 'badge-warning' : 'badge-secondary'}`}>{row.status}</span></td>
                          <td>
                            {row.status === 'matched'
                              ? <span className="text-secondary text-sm">{row.bank_transaction_description || 'Matched transaction'}</span>
                              : (
                                <select className="form-control" defaultValue="" onChange={(e) => e.target.value && matchReconciliationLine(row.id, e.target.value)}>
                                  <option value="">Select book entry</option>
                                  {matchCandidates.map((txn) => <option key={txn.id} value={txn.id}>{formatDate(txn.transaction_date)} · {txn.description || txn.reference_type || 'Bank entry'} · {formatCurrency(txn.amount || 0, currencySymbol)}</option>)}
                                </select>
                              )}
                          </td>
                          <td>
                            {row.status !== 'matched' && <button className="btn btn-secondary btn-sm" onClick={() => markReconciliationStatus(row.id, 'ignored')}>Ignore</button>}
                          </td>
                        </tr>
                      );
                    }) : <tr><td colSpan={6} className="text-center text-muted">No reconciliation lines yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {activeTab === 'ledger' && (
          <>
            <div className="grid-2">
              <div className="card">
                <div className="card-header"><h4>Chart of Accounts</h4></div>
                <div className="table-container" style={{ maxHeight: 340 }}>
                  <table className="data-table"><thead><tr><th>Code</th><th>Name</th><th>Type</th></tr></thead><tbody>{accounts.map((row) => <tr key={row.id}><td className="font-mono">{row.code}</td><td>{row.name}</td><td><span className="badge badge-secondary">{row.account_type}</span></td></tr>)}</tbody></table>
                </div>
              </div>
              <div className="card">
                <div className="card-header"><h4>Recent Journals</h4></div>
                <div className="table-container" style={{ maxHeight: 340 }}>
                  <table className="data-table"><thead><tr><th>Voucher</th><th>Type</th><th>Date</th></tr></thead><tbody>{journals.length ? journals.map((row) => <tr key={row.id}><td className="font-mono text-accent">{row.voucher_number}</td><td>{row.voucher_type}</td><td>{formatDate(row.voucher_date)}</td></tr>) : <tr><td colSpan={3} className="text-center text-muted">No journals</td></tr>}</tbody></table>
                </div>
              </div>
            </div>
            <div className="grid-2">
              <div className="card">
                <div className="card-header"><h4>Manual Journal</h4></div>
                <form className="card-body" onSubmit={createManualJournal} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <input className="form-control" value={journalForm.narration} onChange={(e) => setJournalForm({ ...journalForm, narration: e.target.value })} placeholder="Narration" />
                  {journalForm.lines.map((line, index) => (
                    <div key={`journal-${index}`} className="grid-3">
                      <select className="form-control" value={line.account_code} onChange={(e) => { const lines = [...journalForm.lines]; lines[index] = { ...lines[index], account_code: e.target.value }; setJournalForm({ ...journalForm, lines }); }}>
                        <option value="">Choose account</option>
                        {accounts.map((row) => <option key={row.id} value={row.code}>{row.code} - {row.name}</option>)}
                      </select>
                      <input className="form-control" type="number" min="0" step="0.01" value={line.debit_amount} onChange={(e) => { const lines = [...journalForm.lines]; lines[index] = { ...lines[index], debit_amount: e.target.value }; setJournalForm({ ...journalForm, lines }); }} placeholder="Debit" />
                      <input className="form-control" type="number" min="0" step="0.01" value={line.credit_amount} onChange={(e) => { const lines = [...journalForm.lines]; lines[index] = { ...lines[index], credit_amount: e.target.value }; setJournalForm({ ...journalForm, lines }); }} placeholder="Credit" />
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setJournalForm({ ...journalForm, lines: [...journalForm.lines, { account_code: '', debit_amount: 0, credit_amount: 0 }] })}><Plus size={13} />Add Line</button>
                    <button type="submit" className="btn btn-primary"><Save size={14} />Post Journal</button>
                  </div>
                </form>
              </div>
              <div className="card">
                <div className="card-header"><h4>Assets, Treasury, and GST Masters</h4></div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <form onSubmit={createAsset} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="grid-2">
                      <input className="form-control" value={assetForm.asset_name} onChange={(e) => setAssetForm({ ...assetForm, asset_name: e.target.value })} placeholder="Asset name" />
                      <input className="form-control" type="number" min="0" step="0.01" value={assetForm.gross_value} onChange={(e) => setAssetForm({ ...assetForm, gross_value: e.target.value })} placeholder="Gross value" />
                    </div>
                    <div className="grid-2">
                      <select className="form-control" value={assetForm.depreciation_method} onChange={(e) => setAssetForm({ ...assetForm, depreciation_method: e.target.value })}><option value="SLM">SLM</option><option value="WDV">WDV</option></select>
                      <button type="submit" className="btn btn-primary"><Save size={14} />Capitalize Asset</button>
                    </div>
                  </form>
                  <div className="table-container" style={{ maxHeight: 150 }}>
                    <table className="data-table"><thead><tr><th>Bank</th><th>Balance</th></tr></thead><tbody>{bankAccounts.map((row) => <tr key={row.id}><td>{row.account_name}</td><td>{formatCurrency(row.current_balance, currencySymbol)}</td></tr>)}</tbody></table>
                  </div>
                  <div className="table-container" style={{ maxHeight: 150 }}>
                    <table className="data-table"><thead><tr><th>Tax Code</th><th>Rate</th></tr></thead><tbody>{taxCodes.map((row) => <tr key={row.id}><td>{row.code}</td><td>{row.rate}%</td></tr>)}</tbody></table>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'advisor' && (
          <div className="grid-2">
            <div className="card">
              <div className="card-header"><h4>Advisor Suggestions</h4></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {suggestions.map((item) => (
                  <div key={item.id} style={{ padding: 16, borderRadius: 16, border: '1px solid var(--border)', background: item.priority === 'high' ? 'rgba(239,68,68,0.08)' : item.priority === 'medium' ? 'rgba(245,158,11,0.08)' : 'rgba(34,197,94,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                      <strong>{item.title}</strong>
                      <span className={`badge ${item.priority === 'high' ? 'badge-danger' : item.priority === 'medium' ? 'badge-warning' : 'badge-success'}`}>{item.priority}</span>
                    </div>
                    <div className="text-secondary mt-2">{item.detail}</div>
                    <div className="text-accent text-sm mt-2">{item.action}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h4>Ask the Advisor</h4></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <textarea className="form-control" rows={6} value={advisorQuestion} onChange={(e) => setAdvisorQuestion(e.target.value)} placeholder="Ask about GST, collections, payables, cash flow, journals, or assets" />
                <button className="btn btn-primary" onClick={() => setAdvisorAnswer(answerAccountingQuestion(advisorQuestion, { receivablesOutstanding: metrics.receivables, overdueReceivables: metrics.overdue, payablesOutstanding: metrics.payables, availableCash: metrics.cash, outputTax: metrics.outputTax, inputTax: metrics.inputTax, assetBase: metrics.assetBase, unpostedJournals: metrics.pendingJournals }, { currencySymbol }))}><BrainCircuit size={14} />Generate Guidance</button>
                <div style={{ minHeight: 180, padding: 16, borderRadius: 16, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  <div className="catalogue-summary-title">Advisor response</div>
                  <p className="text-secondary mt-2">{advisorAnswer || 'This advisor is a bookkeeping and control copilot. GST advice should still be checked against current law and your chartered accountant before filing.'}</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <AlertTriangle size={16} color="var(--warning)" />
                  <span className="text-secondary text-sm">Use this as internal guidance, not a statutory filing substitute.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'control' && (
          <>
            <div className="grid-2">
              <div className="card">
                <div className="card-header"><h4>Accounting Database</h4></div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="catalogue-summary-card"><span className="catalogue-summary-title">Folder</span><strong style={{ fontSize: 14 }}>{dbInfo.folderPath || 'Unavailable'}</strong></div>
                  <div className="catalogue-summary-card"><span className="catalogue-summary-title">Database File</span><strong style={{ fontSize: 14 }}>{dbInfo.dbPath || 'Unavailable'}</strong></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-secondary" onClick={changeDbLocation}><Database size={14} />Change Location</button>
                    <button className="btn btn-primary" onClick={backupDb}><Download size={14} />Backup</button>
                  </div>
                </div>
              </div>
              <div className="card">
                <div className="card-header"><h4>Accounting Settings</h4></div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="grid-2">
                    <input className="form-control" value={accountingSettings.default_company_state || companyState} onChange={(e) => setAccountingSettings({ ...accountingSettings, default_company_state: e.target.value })} placeholder="Default company state" />
                    <select className="form-control" value={accountingSettings.gst_return_frequency || 'monthly'} onChange={(e) => setAccountingSettings({ ...accountingSettings, gst_return_frequency: e.target.value })}><option value="monthly">Monthly GST</option><option value="quarterly">Quarterly GST</option></select>
                  </div>
                  <div className="grid-2">
                    <input className="form-control" value={accountingSettings.sales_invoice_prefix || 'INV'} onChange={(e) => setAccountingSettings({ ...accountingSettings, sales_invoice_prefix: e.target.value })} placeholder="Sales invoice prefix" />
                    <input className="form-control" value={accountingSettings.purchase_bill_prefix || 'BILL'} onChange={(e) => setAccountingSettings({ ...accountingSettings, purchase_bill_prefix: e.target.value })} placeholder="Purchase bill prefix" />
                  </div>
                  <div className="grid-2">
                    <input className="form-control" value={accountingSettings.receipt_prefix || 'RCPT'} onChange={(e) => setAccountingSettings({ ...accountingSettings, receipt_prefix: e.target.value })} placeholder="Receipt prefix" />
                    <input className="form-control" value={accountingSettings.payment_prefix || 'PAY'} onChange={(e) => setAccountingSettings({ ...accountingSettings, payment_prefix: e.target.value })} placeholder="Payment prefix" />
                  </div>
                  <div className="catalogue-summary-title">SMTP Dispatch</div>
                  <div className="grid-2">
                    <input className="form-control" value={accountingSettings.smtp_host || ''} onChange={(e) => setAccountingSettings({ ...accountingSettings, smtp_host: e.target.value })} placeholder="SMTP host" />
                    <input className="form-control" value={accountingSettings.smtp_port || '587'} onChange={(e) => setAccountingSettings({ ...accountingSettings, smtp_port: e.target.value })} placeholder="SMTP port" />
                  </div>
                  <div className="grid-2">
                    <input className="form-control" value={accountingSettings.smtp_user || ''} onChange={(e) => setAccountingSettings({ ...accountingSettings, smtp_user: e.target.value })} placeholder="SMTP username" />
                    <input className="form-control" type="password" value={accountingSettings.smtp_pass || ''} onChange={(e) => setAccountingSettings({ ...accountingSettings, smtp_pass: e.target.value })} placeholder="SMTP password / app password" />
                  </div>
                  <div className="grid-2">
                    <input className="form-control" value={accountingSettings.smtp_from_email || ''} onChange={(e) => setAccountingSettings({ ...accountingSettings, smtp_from_email: e.target.value })} placeholder="From email" />
                    <input className="form-control" value={accountingSettings.smtp_from_name || ''} onChange={(e) => setAccountingSettings({ ...accountingSettings, smtp_from_name: e.target.value })} placeholder="From name" />
                  </div>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="checkbox" checked={`${accountingSettings.smtp_secure || 'false'}` === 'true'} onChange={(e) => setAccountingSettings({ ...accountingSettings, smtp_secure: e.target.checked ? 'true' : 'false' })} />
                    <span className="text-secondary">Use secure SMTP</span>
                  </label>
                  <button className="btn btn-primary" onClick={saveAccountingSettings}><Save size={14} />Save Settings</button>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header"><h4>Recent Dispatch Log</h4></div>
              <div className="table-container" style={{ maxHeight: 320 }}>
                <table className="data-table">
                  <thead><tr><th>Document</th><th>Recipient</th><th>Sender</th><th>Status</th><th>Created</th></tr></thead>
                  <tbody>
                    {dispatchLogs.length ? dispatchLogs.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{row.document_number || row.document_type}</div>
                          <div className="text-secondary text-sm">{row.subject || '-'}</div>
                        </td>
                        <td>{row.recipient_email}</td>
                        <td>{row.sender_email || '-'}</td>
                        <td><span className={`badge ${row.status === 'sent' ? 'badge-success' : row.status === 'failed' ? 'badge-danger' : 'badge-secondary'}`}>{row.status}</span></td>
                        <td>{formatDate(row.created_at)}</td>
                      </tr>
                    )) : <tr><td colSpan={5} className="text-center text-muted">No dispatch history yet</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {partyLedgerModalOpen && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setPartyLedgerModalOpen(false)}>
            <div className="modal modal-xl">
              <div className="modal-header">
                <div className="catalogue-modal-title">
                  <div className="catalogue-modal-title-icon"><BookOpen size={18} /></div>
                  <div>
                    <h3>Party Ledger</h3>
                    <p>Statement, aging, follow-up actions, and settlement drilldown in one workspace.</p>
                  </div>
                </div>
                <button className="close-btn" onClick={() => setPartyLedgerModalOpen(false)}><X size={16} /></button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {partyLedgerLoading || !partyLedgerData ? (
                  <div className="empty-state"><RefreshCw className="loading" size={28} /><p>Loading party ledger...</p></div>
                ) : (
                  <>
                    <div className="catalogue-modal-insights">
                      <div className="catalogue-modal-insight"><span className="catalogue-summary-title">Party</span><strong>{partyLedgerData.party.company || partyLedgerData.party.name}</strong><span className="text-secondary text-sm">{partyLedgerData.party.email || 'No email'}</span></div>
                      <div className="catalogue-modal-insight"><span className="catalogue-summary-title">Outstanding</span><strong>{formatCurrency(partyLedgerData.openDocuments.reduce((sum, row) => sum + Number(row.outstanding_amount || 0), 0), currencySymbol)}</strong><span className="text-secondary text-sm">Across {partyLedgerData.openDocuments.filter((row) => Number(row.outstanding_amount || 0) > 0).length} open documents</span></div>
                      <div className="catalogue-modal-insight"><span className="catalogue-summary-title">Aging 31-60</span><strong>{formatCurrency(partyLedgerData.agingBuckets.bucket60, currencySymbol)}</strong><span className="text-secondary text-sm">Mid aging watchlist</span></div>
                      <div className="catalogue-modal-insight"><span className="catalogue-summary-title">Follow-ups</span><strong>{partyLedgerData.followups.length}</strong><span className="text-secondary text-sm">Saved credit-control actions</span></div>
                    </div>

                    <div className="grid-2">
                      <div className="card">
                        <div className="card-header"><h4>Open Documents & Aging</h4></div>
                        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div className="grid-2">
                            <div className="catalogue-summary-card"><span className="catalogue-summary-title">Current</span><strong>{formatCurrency(partyLedgerData.agingBuckets.current, currencySymbol)}</strong></div>
                            <div className="catalogue-summary-card"><span className="catalogue-summary-title">1-30 Days</span><strong>{formatCurrency(partyLedgerData.agingBuckets.bucket30, currencySymbol)}</strong></div>
                            <div className="catalogue-summary-card"><span className="catalogue-summary-title">31-60 Days</span><strong>{formatCurrency(partyLedgerData.agingBuckets.bucket60, currencySymbol)}</strong></div>
                            <div className="catalogue-summary-card"><span className="catalogue-summary-title">61+ Days</span><strong>{formatCurrency(partyLedgerData.agingBuckets.bucket90 + partyLedgerData.agingBuckets.bucket120, currencySymbol)}</strong></div>
                          </div>
                          <div className="table-container" style={{ maxHeight: 220 }}>
                            <table className="data-table">
                              <thead><tr><th>Document</th><th>Date</th><th>Due</th><th>Total</th><th>Outstanding</th></tr></thead>
                              <tbody>
                                {partyLedgerData.openDocuments.length ? partyLedgerData.openDocuments.map((row) => (
                                  <tr key={row.id}>
                                    <td>{row.invoice_number || row.bill_number}</td>
                                    <td>{formatDate(row.invoice_date || row.bill_date)}</td>
                                    <td>{formatDate(row.due_date)}</td>
                                    <td>{formatCurrency(row.total_amount || 0, currencySymbol)}</td>
                                    <td>{formatCurrency(row.outstanding_amount || 0, currencySymbol)}</td>
                                  </tr>
                                )) : <tr><td colSpan={5} className="text-center text-muted">No documents yet</td></tr>}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      <div className="card">
                        <div className="card-header"><h4>Follow-up Actions</h4></div>
                        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          <div className="grid-2">
                            <select className="form-control" value={followupForm.followup_type} onChange={(e) => setFollowupForm({ ...followupForm, followup_type: e.target.value })}>
                              <option value="statement">Statement</option>
                              <option value="collection_call">Collection Call</option>
                              <option value="payment_commitment">Payment Commitment</option>
                              <option value="vendor_coordination">Vendor Coordination</option>
                            </select>
                            <input className="form-control" type="date" value={followupForm.due_date} onChange={(e) => setFollowupForm({ ...followupForm, due_date: e.target.value })} />
                          </div>
                          <input className="form-control" value={followupForm.subject} onChange={(e) => setFollowupForm({ ...followupForm, subject: e.target.value })} placeholder="Follow-up subject" />
                          <textarea className="form-control" rows={3} value={followupForm.notes} onChange={(e) => setFollowupForm({ ...followupForm, notes: e.target.value })} placeholder="Action notes" />
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn btn-secondary" onClick={exportPartyStatementPdf}><Download size={14} />Statement PDF</button>
                            <button className="btn btn-secondary" onClick={() => openDispatchComposer('statement', null, { statementData: partyLedgerData })}><ReceiptText size={14} />Email Statement</button>
                            <button className="btn btn-primary" onClick={savePartyFollowup}><Save size={14} />Save Follow-up</button>
                          </div>
                          <div className="table-container" style={{ maxHeight: 180 }}>
                            <table className="data-table">
                              <thead><tr><th>Type</th><th>Subject</th><th>Due</th><th>Status</th></tr></thead>
                              <tbody>
                                {partyLedgerData.followups.length ? partyLedgerData.followups.map((row) => (
                                  <tr key={row.id}>
                                    <td>{row.followup_type}</td>
                                    <td>{row.subject}</td>
                                    <td>{formatDate(row.due_date)}</td>
                                    <td><span className={`badge ${row.status === 'open' ? 'badge-warning' : 'badge-success'}`}>{row.status}</span></td>
                                  </tr>
                                )) : <tr><td colSpan={4} className="text-center text-muted">No follow-ups yet</td></tr>}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="card">
                      <div className="card-header"><h4>Party Ledger Timeline</h4></div>
                      <div className="table-container" style={{ maxHeight: 260 }}>
                        <table className="data-table">
                          <thead><tr><th>Date</th><th>Document</th><th>Type</th><th>Debit</th><th>Credit</th><th>Running</th></tr></thead>
                          <tbody>
                            {partyLedgerData.ledgerRows.length ? partyLedgerData.ledgerRows.map((row) => (
                              <tr key={`${row.kind}-${row.id}`}>
                                <td>{formatDate(row.date)}</td>
                                <td>{row.document_number}</td>
                                <td>{row.kind}</td>
                                <td>{formatCurrency(row.debit || 0, currencySymbol)}</td>
                                <td>{formatCurrency(row.credit || 0, currencySymbol)}</td>
                                <td>{formatCurrency(row.running_balance || 0, currencySymbol)}</td>
                              </tr>
                            )) : <tr><td colSpan={6} className="text-center text-muted">No ledger activity yet</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {dispatchModalOpen && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setDispatchModalOpen(false)}>
            <div className="modal" style={{ width: 760, maxWidth: '92vw' }}>
              <div className="modal-header">
                <div className="catalogue-modal-title">
                  <div className="catalogue-modal-title-icon"><ReceiptText size={18} /></div>
                  <div>
                    <h3>Email Document</h3>
                    <p>SMTP-backed dispatch with PDF attachment from the accounting workspace.</p>
                  </div>
                </div>
                <button className="close-btn" onClick={() => setDispatchModalOpen(false)}><X size={16} /></button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="catalogue-modal-insights">
                  <div className="catalogue-modal-insight"><span className="catalogue-summary-title">Document</span><strong>{dispatchForm.document_number || '-'}</strong><span className="text-secondary text-sm">{dispatchForm.attachment_name || 'PDF attachment'}</span></div>
                  <div className="catalogue-modal-insight"><span className="catalogue-summary-title">Recipient</span><strong>{dispatchForm.recipient_email || 'Enter recipient'}</strong><span className="text-secondary text-sm">Direct backend dispatch</span></div>
                  <div className="catalogue-modal-insight"><span className="catalogue-summary-title">Sender</span><strong>{(senderOptions.find((option) => option.key === dispatchForm.sender_key) || senderOptions[0] || {}).name || 'Configure sender'}</strong><span className="text-secondary text-sm">{(senderOptions.find((option) => option.key === dispatchForm.sender_key) || senderOptions[0] || {}).email || accountingSettings.smtp_from_email || 'No sender email'}</span></div>
                </div>
                <div className="grid-2">
                  <input className="form-control" type="email" value={dispatchForm.recipient_email} onChange={(e) => setDispatchForm({ ...dispatchForm, recipient_email: e.target.value })} placeholder="Recipient email" />
                  <select className="form-control" value={dispatchForm.sender_key} onChange={(e) => setDispatchForm({ ...dispatchForm, sender_key: e.target.value })}>
                    {senderOptions.length ? senderOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>) : <option value="">No sender configured</option>}
                  </select>
                </div>
                <input className="form-control" value={dispatchForm.subject} onChange={(e) => setDispatchForm({ ...dispatchForm, subject: e.target.value })} placeholder="Email subject" />
                <textarea className="form-control" rows={8} value={dispatchForm.body} onChange={(e) => setDispatchForm({ ...dispatchForm, body: e.target.value })} placeholder="Write your message" />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setDispatchModalOpen(false)}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={sendDispatchEmail} disabled={dispatchBusy}>{dispatchBusy ? 'Sending...' : 'Send Email'}</button>
              </div>
            </div>
          </div>
        )}

        {proformaModalOpen && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeProformaEditor()}>
            <div className="modal modal-xl">
              <div className="modal-header">
                <div className="catalogue-modal-title">
                  <div className="catalogue-modal-title-icon">
                    <ReceiptText size={18} />
                  </div>
                  <div>
                    <h3>{editingProformaId ? 'Edit Proforma Invoice' : 'Create Proforma Invoice'}</h3>
                    <p>Commercial pre-billing document with sender selection, customer linkage, PDF export, and email handoff.</p>
                  </div>
                </div>
                <button className="close-btn" onClick={closeProformaEditor}><X size={16} /></button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="catalogue-modal-insights">
                  <div className="catalogue-modal-insight">
                    <span className="catalogue-summary-title">Document No.</span>
                    <strong>{proformaForm.proforma_number}</strong>
                    <span className="text-secondary text-sm">Unique proforma reference</span>
                  </div>
                  <div className="catalogue-modal-insight">
                    <span className="catalogue-summary-title">Sender</span>
                    <strong>{activeSender?.name || 'Choose sender'}</strong>
                    <span className="text-secondary text-sm">{activeSender?.email || 'Email pending'}</span>
                  </div>
                  <div className="catalogue-modal-insight">
                    <span className="catalogue-summary-title">Customer</span>
                    <strong>{selectedProformaCustomer?.company || selectedProformaCustomer?.name || 'Choose customer'}</strong>
                    <span className="text-secondary text-sm">{selectedProformaCustomer?.email || 'Email pending'}</span>
                  </div>
                  <div className="catalogue-modal-insight">
                    <span className="catalogue-summary-title">Document Value</span>
                    <strong>{formatCurrency(proformaPreview.total, currencySymbol)}</strong>
                    <span className="text-secondary text-sm">{proformaPreview.items.filter((item) => item.description).length} commercial line(s)</span>
                  </div>
                </div>

                <div className="catalogue-form-section">
                  <div className="catalogue-form-section-header">
                    <h4>Document Setup</h4>
                    <span>Choose the commercial party, source order, sender identity, and validity period.</span>
                  </div>
                  <div className="grid-3">
                    <div className="form-group">
                      <label className="form-label">Customer</label>
                      <select className="form-control" value={proformaForm.customer_id} onChange={(e) => setProformaForm({ ...proformaForm, customer_id: e.target.value })}>
                        <option value="">Select customer</option>
                        {customers.map((row) => <option key={row.id} value={row.id}>{row.company || row.name}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Source Order</label>
                      <select className="form-control" value={proformaForm.source_order_id} onChange={(e) => applyOrderToProforma(e.target.value)}>
                        <option value="">Standalone</option>
                        {orders.map((row) => <option key={row.id} value={row.id}>{row.order_number}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Sender</label>
                      <select className="form-control" value={proformaForm.sender_key} onChange={(e) => setProformaForm({ ...proformaForm, sender_key: e.target.value })}>
                        {senderOptions.length === 0 ? <option value="">No sender configured</option> : senderOptions.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="grid-3">
                    <div className="form-group">
                      <label className="form-label">Issue Date</label>
                      <input className="form-control" type="date" value={proformaForm.issue_date} onChange={(e) => setProformaForm({ ...proformaForm, issue_date: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Valid Till</label>
                      <input className="form-control" type="date" value={proformaForm.valid_till} onChange={(e) => setProformaForm({ ...proformaForm, valid_till: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Status</label>
                      <select className="form-control" value={proformaForm.status} onChange={(e) => setProformaForm({ ...proformaForm, status: e.target.value })}>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="approved">Approved</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="catalogue-form-section">
                  <div className="catalogue-form-section-header">
                    <h4>Commercial Message</h4>
                    <span>Control the subject, the customer-facing mail text, and your commercial narrative.</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subject</label>
                    <input className="form-control" value={proformaForm.subject} onChange={(e) => setProformaForm({ ...proformaForm, subject: e.target.value })} placeholder="Proforma invoice for your approval" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mail Draft</label>
                    <textarea className="form-control" rows={4} value={proformaForm.mail_draft} onChange={(e) => setProformaForm({ ...proformaForm, mail_draft: e.target.value })} />
                  </div>
                </div>

                <div className="catalogue-form-section">
                  <div className="catalogue-form-section-header">
                    <h4>Line Items</h4>
                    <span>Editable commercial lines with customer pricing and tax preview.</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {proformaForm.items.map((item, index) => (
                      <div key={item.id} className="grid-4" style={{ alignItems: 'end' }}>
                        <div className="form-group">
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                            <label className="form-label">Product</label>
                            <button className="btn btn-secondary btn-sm" type="button" onClick={() => openQuickProductEditor(item.id)} title="Add product to catalogue">
                              <Plus size={12} />New
                            </button>
                          </div>
                          <select className="form-control" value={item.product_id} onChange={(e) => setProformaProduct(item.id, e.target.value)}>
                            <option value="">Select product</option>
                            {products.map((row) => <option key={row.id} value={row.id}>{row.name}{row.code ? ` (${row.code})` : ''}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label">Description</label>
                          <input className="form-control" value={item.description} onChange={(e) => updateProformaItem(item.id, 'description', e.target.value)} placeholder="Commercial description" />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Qty</label>
                          <input className="form-control" type="number" min="0" step="0.01" value={item.quantity} onChange={(e) => updateProformaItem(item.id, 'quantity', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Rate</label>
                          <input className="form-control" type="number" min="0" step="0.01" value={item.unit_price} onChange={(e) => updateProformaItem(item.id, 'unit_price', e.target.value)} />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Tax %</label>
                          <input className="form-control" type="number" min="0" step="0.01" value={item.tax_rate} onChange={(e) => updateProformaItem(item.id, 'tax_rate', e.target.value)} />
                        </div>
                        <div className="bom-static-field">{formatCurrency(proformaPreview.items[index]?.lineTotal || 0, currencySymbol)}</div>
                        <button className="btn btn-danger btn-sm" type="button" onClick={() => removeProformaItem(item.id)}><Plus size={12} style={{ transform: 'rotate(45deg)' }} />Remove</button>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <button className="btn btn-secondary btn-sm" type="button" onClick={addProformaItem}><Plus size={13} />Add Line</button>
                      <div className="catalogue-summary-card" style={{ minWidth: 240 }}>
                        <span className="catalogue-summary-title">Total</span>
                        <strong>{formatCurrency(proformaPreview.total, currencySymbol)}</strong>
                        <span className="text-secondary text-sm">Subtotal {formatCurrency(proformaPreview.subtotal, currencySymbol)} · Tax {formatCurrency(proformaPreview.tax, currencySymbol)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid-2">
                  <div className="catalogue-form-section">
                    <div className="catalogue-form-section-header">
                      <h4>Notes</h4>
                      <span>Commercial remarks for the customer.</span>
                    </div>
                    <textarea className="form-control" rows={4} value={proformaForm.notes} onChange={(e) => setProformaForm({ ...proformaForm, notes: e.target.value })} />
                  </div>
                  <div className="catalogue-form-section">
                    <div className="catalogue-form-section-header">
                      <h4>Terms</h4>
                      <span>Validity, tax disclaimer, payment terms, and dispatch assumptions.</span>
                    </div>
                    <textarea className="form-control" rows={4} value={proformaForm.terms} onChange={(e) => setProformaForm({ ...proformaForm, terms: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeProformaEditor}>Cancel</button>
                <button type="button" className="btn btn-secondary" onClick={() => exportProformaPdf()}><Download size={14} />PDF</button>
                <button type="button" className="btn btn-secondary" onClick={() => emailProforma()}><ReceiptText size={14} />Email</button>
                <button type="button" className="btn btn-primary" onClick={saveProforma}><Save size={14} />Save Proforma</button>
              </div>
            </div>
          </div>
        )}

        {quickProductModalOpen && (
          <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && closeQuickProductEditor()}>
            <div className="modal modal-lg">
              <div className="modal-header">
                <div className="catalogue-modal-title">
                  <div className="catalogue-modal-title-icon">
                    <Package size={18} />
                  </div>
                  <div>
                    <h3>Add Product</h3>
                    <p>Create a catalogue item and attach it to this proforma line.</p>
                  </div>
                </div>
                <button className="close-btn" onClick={closeQuickProductEditor}><X size={16} /></button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Product Name *</label>
                    <input className="form-control" value={quickProductForm.name} onChange={(e) => setQuickProductForm({ ...quickProductForm, name: e.target.value })} placeholder="MCB 16A" autoFocus />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Product Code</label>
                    <input className="form-control" value={quickProductForm.code} onChange={(e) => setQuickProductForm({ ...quickProductForm, code: e.target.value })} placeholder="Optional SKU" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" rows={3} value={quickProductForm.description} onChange={(e) => setQuickProductForm({ ...quickProductForm, description: e.target.value })} placeholder="Customer-facing product description" />
                </div>
                <div className="grid-3">
                  <div className="form-group">
                    <label className="form-label">Unit</label>
                    <input className="form-control" value={quickProductForm.unit} onChange={(e) => setQuickProductForm({ ...quickProductForm, unit: e.target.value })} placeholder="PCS" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">HSN Code</label>
                    <input className="form-control" value={quickProductForm.hsn_code} onChange={(e) => setQuickProductForm({ ...quickProductForm, hsn_code: e.target.value })} placeholder="Optional HSN" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">GST %</label>
                    <input className="form-control" type="number" min="0" step="0.01" value={quickProductForm.gst_rate} onChange={(e) => setQuickProductForm({ ...quickProductForm, gst_rate: e.target.value })} />
                  </div>
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">Selling Price</label>
                    <input className="form-control" type="number" min="0" step="0.01" value={quickProductForm.selling_price} onChange={(e) => setQuickProductForm({ ...quickProductForm, selling_price: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Cost Price</label>
                    <input className="form-control" type="number" min="0" step="0.01" value={quickProductForm.cost_price} onChange={(e) => setQuickProductForm({ ...quickProductForm, cost_price: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeQuickProductEditor}>Cancel</button>
                <button type="button" className="btn btn-primary" onClick={saveQuickProduct}><Save size={14} />Add Product</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
