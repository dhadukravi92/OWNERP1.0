import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  ClipboardMinus,
  ClipboardPlus,
  FileDown,
  FileOutput,
  FilePlus2,
  FileSpreadsheet,
  HandCoins,
  Handshake,
  PackageCheck,
  ReceiptText,
  Save,
  ScrollText,
  ShoppingCart,
  Truck,
  Users,
  Wallet
} from 'lucide-react';
import SearchableSelect from '../ui/SearchableSelect';
import accountingDb from '../../utils/accountingDatabase';
import db, { formatCurrency, generateId } from '../../utils/database';
import { useAppStore } from '../../store/appStore';

const today = () => new Date().toISOString().slice(0, 10);

const VOUCHER_MODULES = [
  { key: 'contra', title: 'Contra', hotkey: 'F4', prefix: 'CON', tone: '#3d7fff', description: 'Funds transfer between cash and bank accounts.', icon: ArrowRightLeft },
  { key: 'payment', title: 'Payment', hotkey: 'F5', prefix: 'PAY', tone: '#f97316', description: 'Recording all bank and cash payments.', icon: Wallet },
  { key: 'receipt', title: 'Receipt', hotkey: 'F6', prefix: 'RCT', tone: '#22c55e', description: 'Recording all bank and cash receipts.', icon: HandCoins },
  { key: 'journal', title: 'Journal', hotkey: 'F7', prefix: 'JRN', tone: '#8b5cf6', description: 'Adjustment entries and ledger corrections.', icon: ScrollText },
  { key: 'sales', title: 'Sales', hotkey: 'F8', prefix: 'SAL', tone: '#06b6d4', description: 'Recording statutory sales invoices.', icon: FileOutput },
  { key: 'purchase', title: 'Purchase', hotkey: 'F9', prefix: 'PUR', tone: '#f59e0b', description: 'Recording statutory purchase invoices.', icon: FileDown },
  { key: 'credit_note', title: 'Credit Note', hotkey: 'Alt+F6', prefix: 'CRN', tone: '#ef4444', description: 'Sales returns or invoice reductions.', icon: ClipboardMinus },
  { key: 'debit_note', title: 'Debit Note', hotkey: 'Alt+F5', prefix: 'DBN', tone: '#14b8a6', description: 'Purchase returns or supplier adjustments.', icon: ClipboardPlus },
  { key: 'delivery_note', title: 'Delivery Note', hotkey: 'Alt+F8', prefix: 'DLY', tone: '#38bdf8', description: 'Delivering goods against an order.', icon: Truck },
  { key: 'receipt_note', title: 'Receipt Note', hotkey: 'Alt+F9', prefix: 'RCN', tone: '#10b981', description: 'Receiving goods against an order.', icon: PackageCheck },
  { key: 'physical_stock', title: 'Physical Stock', hotkey: 'Alt+F10', prefix: 'PHY', tone: '#84cc16', description: 'Recording physical stock verification.', icon: FileSpreadsheet },
  { key: 'rejections_in', title: 'Rejections In', hotkey: 'Ctrl+F6', prefix: 'RJI', tone: '#6366f1', description: 'Goods rejected by customers.', icon: ClipboardPlus },
  { key: 'rejections_out', title: 'Rejections Out', hotkey: 'Ctrl+F5', prefix: 'RJO', tone: '#f43f5e', description: 'Goods rejected to suppliers.', icon: ClipboardMinus },
  { key: 'purchase_order', title: 'Purchase Order', hotkey: 'Ctrl+F9', prefix: 'PO', tone: '#eab308', description: 'Issuing a purchase order.', icon: ShoppingCart },
  { key: 'sales_order', title: 'Sales Order', hotkey: 'Ctrl+F8', prefix: 'SO', tone: '#0ea5e9', description: 'Receiving a sales order.', icon: Handshake },
  { key: 'payroll', title: 'Payroll', hotkey: 'Ctrl+F4', prefix: 'PRL', tone: '#a855f7', description: 'Managing employee payroll transactions.', icon: Users },
  { key: 'memorandum', title: 'Memorandum', hotkey: 'Ctrl+F10', prefix: 'MEM', tone: '#94a3b8', description: 'Non-accounting, suspense, or memo vouchers.', icon: ReceiptText }
];

const PAYMENT_MODE_OPTIONS = [
  { value: 'bank_transfer', label: 'Bank Transfer / NEFT / RTGS' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' }
];

const ACCOUNTING_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'posted', label: 'Posted' },
  { value: 'cancelled', label: 'Cancelled' }
];

const STOCK_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' }
];

const MEMO_STATUS_OPTIONS = [
  { value: 'memo', label: 'Memo' },
  { value: 'hold', label: 'On Hold' },
  { value: 'review', label: 'Review' }
];

const NEW_JOURNAL_LINE = () => ({ id: generateId(), account_code: '5300', debit_amount: 0, credit_amount: 0, description: '' });
const NEW_ITEM_LINE = () => ({ id: generateId(), product_id: '', description: '', quantity: 1, rate: 0, tax_rate: 18, unit: 'PCS', physical_qty: '', amount: 0 });

function generateDocNumber(prefix) {
  return `${prefix}-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function getModuleByKey(key) {
  return VOUCHER_MODULES.find((module) => module.key === key) || VOUCHER_MODULES[0];
}

function getHotkeySignature(value) {
  return `${value || ''}`.replace(/\s+/g, '').toUpperCase();
}

function getEventHotkeySignature(event) {
  const key = `${event.key || ''}`.toUpperCase();
  if (!/^F\d{1,2}$/.test(key)) return '';
  const modifiers = [];
  if (event.ctrlKey) modifiers.push('CTRL');
  if (event.altKey) modifiers.push('ALT');
  return [...modifiers, key].join('+');
}

function createInitialForm(moduleKey) {
  return {
    voucher_date: today(),
    party_id: '',
    bank_account_id: '',
    second_bank_account_id: '',
    payment_mode: 'bank_transfer',
    reference_number: '',
    narration: '',
    due_date: today(),
    source_id: '',
    place_of_supply: '',
    supply_type: 'intra-state',
    status: moduleKey === 'memorandum' ? 'memo' : 'posted',
    amount: '',
    employee_id: '',
    warehouse_name: 'Main Warehouse',
    notes: '',
    itc_eligible: true,
    lines: moduleKey === 'journal' ? [NEW_JOURNAL_LINE(), NEW_JOURNAL_LINE()] : [NEW_ITEM_LINE()]
  };
}

function sumVoucherLines(lines) {
  return lines.reduce((sum, line) => sum + ((Number(line.quantity || 0) || 0) * (Number(line.rate || 0) || 0)), 0);
}

function calculateCommercialTotals(lines, supplyType) {
  const normalized = lines.map((line) => {
    const quantity = Number(line.quantity || 0);
    const rate = Number(line.rate || 0);
    const gstRate = Number(line.tax_rate || 0);
    const taxable = quantity * rate;
    const tax = taxable * (gstRate / 100);
    return {
      ...line,
      taxable,
      cgst_amount: supplyType === 'intra-state' ? tax / 2 : 0,
      sgst_amount: supplyType === 'intra-state' ? tax / 2 : 0,
      igst_amount: supplyType === 'inter-state' ? tax : 0,
      line_total: taxable + tax
    };
  });

  return {
    lines: normalized,
    taxable: normalized.reduce((sum, line) => sum + line.taxable, 0),
    cgst: normalized.reduce((sum, line) => sum + line.cgst_amount, 0),
    sgst: normalized.reduce((sum, line) => sum + line.sgst_amount, 0),
    igst: normalized.reduce((sum, line) => sum + line.igst_amount, 0),
    totalTax: normalized.reduce((sum, line) => sum + line.cgst_amount + line.sgst_amount + line.igst_amount, 0),
    total: normalized.reduce((sum, line) => sum + line.line_total, 0)
  };
}

function getCashBankLedger(accountSelection) {
  return accountSelection === 'cash'
    ? { account_code: '1000', account_name: 'Cash in Hand' }
    : { account_code: '1010', account_name: 'Main Current Account' };
}

export default function VoucherWorkbench(props) {
  const { currentUser, addNotification } = useAppStore();
  const {
    customers,
    vendors,
    bankAccounts,
    accounts,
    orders,
    grns,
    salesInvoices,
    purchaseBills,
    currencySymbol,
    companyState,
    onRefresh,
    flash
  } = props;
  const [selectedModule, setSelectedModule] = useState('contra');
  const [form, setForm] = useState(createInitialForm('contra'));
  const [recentVouchers, setRecentVouchers] = useState([]);
  const [inventoryProducts, setInventoryProducts] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [saving, setSaving] = useState(false);
  const moduleHotkeyMap = useMemo(
    () => Object.fromEntries(VOUCHER_MODULES.map((module) => [getHotkeySignature(module.hotkey), module.key])),
    []
  );

  const currentModule = getModuleByKey(selectedModule);
  const CurrentModuleIcon = currentModule.icon;

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  useEffect(() => {
    const handleKeydown = (event) => {
      if (event.defaultPrevented || event.isComposing || event.metaKey || event.shiftKey) return;
      const moduleKey = moduleHotkeyMap[getEventHotkeySignature(event)];
      if (!moduleKey) return;
      event.preventDefault();
      event.stopPropagation();
      setSelectedModule(moduleKey);
      setForm(createInitialForm(moduleKey));
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  }, [moduleHotkeyMap]);

  const loadWorkspaceData = async () => {
    const [voucherRows, inventoryRows, employeeRows] = await Promise.all([
      accountingDb.all('SELECT * FROM accounting_vouchers ORDER BY created_at DESC LIMIT 18'),
      db.all(`SELECT p.id, p.name, p.code, p.unit, p.hsn_code, p.gst_rate, p.selling_price, p.cost_price, COALESCE(i.quantity, 0) as stock
        FROM products p
        LEFT JOIN inventory i ON i.product_id = p.id
        WHERE p.is_active = 1
        ORDER BY p.name`),
      db.all('SELECT id, employee_code, full_name FROM hr_employees WHERE status = "active" ORDER BY full_name')
    ]);

    setRecentVouchers(voucherRows || []);
    setInventoryProducts(inventoryRows || []);
    setEmployees(employeeRows || []);
  };

  const customerOptions = useMemo(
    () => customers.map((row) => ({ value: row.id, label: row.company || row.name, keywords: `${row.name || ''} ${row.company || ''}` })),
    [customers]
  );
  const vendorOptions = useMemo(
    () => vendors.map((row) => ({ value: row.id, label: row.company || row.name, keywords: `${row.name || ''} ${row.company || ''}` })),
    [vendors]
  );
  const orderOptions = useMemo(() => orders.map((row) => ({ value: row.id, label: row.order_number })), [orders]);
  const grnOptions = useMemo(() => grns.map((row) => ({ value: row.id, label: row.grn_number })), [grns]);
  const productOptions = useMemo(
    () => inventoryProducts.map((row) => ({ value: row.id, label: `${row.name}${row.code ? ` (${row.code})` : ''}` })),
    [inventoryProducts]
  );
  const bankAccountOptions = useMemo(
    () => [{ value: 'cash', label: 'Cash in Hand' }, ...bankAccounts.map((row) => ({ value: row.id, label: row.account_name }))],
    [bankAccounts]
  );
  const accountOptions = useMemo(
    () => accounts.map((row) => ({ value: row.code, label: `${row.code} - ${row.name}` })),
    [accounts]
  );
  const employeeOptions = useMemo(
    () => employees.map((row) => ({ value: row.id, label: `${row.full_name}${row.employee_code ? ` (${row.employee_code})` : ''}` })),
    [employees]
  );
  const salesInvoiceOptions = useMemo(
    () => salesInvoices.map((row) => ({ value: row.id, label: `${row.invoice_number} - ${row.customer_name}` })),
    [salesInvoices]
  );
  const purchaseBillOptions = useMemo(
    () => purchaseBills.map((row) => ({ value: row.id, label: `${row.bill_number} - ${row.vendor_name}` })),
    [purchaseBills]
  );

  const selectedParty = useMemo(() => {
    if (!form.party_id) return null;
    const source = ['payment', 'purchase', 'debit_note', 'receipt_note', 'purchase_order', 'rejections_out'].includes(selectedModule) ? vendors : customers;
    return source.find((row) => row.id === form.party_id) || null;
  }, [customers, form.party_id, selectedModule, vendors]);

  const visibleLines = useMemo(() => form.lines || [], [form.lines]);
  const journalTotals = useMemo(() => ({
    debit: visibleLines.reduce((sum, line) => sum + Number(line.debit_amount || 0), 0),
    credit: visibleLines.reduce((sum, line) => sum + Number(line.credit_amount || 0), 0)
  }), [visibleLines]);
  const commercialPreview = useMemo(
    () => calculateCommercialTotals(visibleLines.filter((line) => line.product_id || line.description), form.supply_type),
    [form.supply_type, visibleLines]
  );
  const simpleAmount = ['contra', 'payment', 'receipt', 'credit_note', 'debit_note', 'payroll', 'memorandum'].includes(selectedModule)
    ? Number(form.amount || 0)
    : 0;
  const stockAmount = selectedModule === 'physical_stock'
    ? visibleLines.reduce((sum, line) => sum + ((Number(line.physical_qty || 0) || 0) * (Number(line.rate || 0) || 0)), 0)
    : sumVoucherLines(visibleLines);
  const currentAmount = selectedModule === 'journal'
    ? journalTotals.debit
    : ['sales', 'purchase'].includes(selectedModule)
      ? commercialPreview.total
      : ['sales_order', 'purchase_order', 'delivery_note', 'receipt_note', 'physical_stock', 'rejections_in', 'rejections_out'].includes(selectedModule)
        ? stockAmount
        : simpleAmount;

  const handleModuleSelect = (moduleKey) => {
    setSelectedModule(moduleKey);
    setForm(createInitialForm(moduleKey));
  };

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const updateLine = (lineId, field, value) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => line.id === lineId ? { ...line, [field]: value } : line)
    }));
  };

  const selectProductForLine = (lineId, productId) => {
    const product = inventoryProducts.find((row) => row.id === productId);
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => line.id === lineId ? {
        ...line,
        product_id: productId,
        description: product?.name || line.description,
        quantity: line.quantity || 1,
        rate: Number(product?.selling_price || product?.cost_price || 0),
        tax_rate: Number(product?.gst_rate || 18),
        unit: product?.unit || line.unit || 'PCS',
        amount: Number(product?.cost_price || 0)
      } : line)
    }));
  };

  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, selectedModule === 'journal' ? NEW_JOURNAL_LINE() : NEW_ITEM_LINE()]
    }));
  };

  const removeLine = (lineId) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.length > 1 ? prev.lines.filter((line) => line.id !== lineId) : prev.lines
    }));
  };

  const getAccountByCode = (code, fallbackName = code) => {
    const row = accounts.find((account) => account.code === code);
    return { account_id: row?.id || null, account_code: code, account_name: row?.name || fallbackName };
  };

  const postJournal = async ({ voucherType, referenceType, referenceId, narration, lines, autoPosted = true, voucherDate = today() }) => {
    const journalId = generateId();
    const voucherNumber = generateDocNumber('JV');

    await accountingDb.run(
      'INSERT INTO journal_entries (id,voucher_number,voucher_type,voucher_date,posting_status,reference_type,reference_id,narration,source_module,auto_posted,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [journalId, voucherNumber, voucherType, voucherDate, 'posted', referenceType, referenceId, narration, 'voucher-workbench', autoPosted ? 1 : 0, currentUser?.id || currentUser?.username || 'system']
    );

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      await accountingDb.run(
        'INSERT INTO journal_lines (id,journal_id,line_number,account_id,account_code,account_name,description,debit_amount,credit_amount) VALUES (?,?,?,?,?,?,?,?,?)',
        [generateId(), journalId, index + 1, line.account_id || null, line.account_code, line.account_name, line.description || narration, Number(line.debit_amount || 0), Number(line.credit_amount || 0)]
      );
    }

    return { journalId, journalVoucherNumber: voucherNumber };
  };

  const createBankTransaction = async ({ bankAccountId, referenceType, referenceId, transactionDate, description, transactionType, amount, paymentMode }) => {
    if (!bankAccountId || bankAccountId === 'cash') return;
    const account = bankAccounts.find((row) => row.id === bankAccountId);
    const signedAmount = transactionType === 'credit' ? Number(amount || 0) : -Math.abs(Number(amount || 0));
    const balanceAfter = Number(account?.current_balance || 0) + signedAmount;

    await accountingDb.run(
      `INSERT INTO bank_transactions (
        id, bank_account_id, reference_type, reference_id, transaction_date, description, transaction_type, amount, balance_after, payment_mode
      ) VALUES (?,?,?,?,?,?,?,?,?,?)`,
      [generateId(), bankAccountId, referenceType, referenceId, transactionDate, description, transactionType, Math.abs(Number(amount || 0)), balanceAfter, paymentMode]
    );
    await accountingDb.run('UPDATE bank_accounts SET current_balance = ? WHERE id = ?', [balanceAfter, bankAccountId]);
  };

  const persistVoucherRecord = async ({ moduleKey, voucherNumber, totalAmount, taxAmount = 0, partyType = '', partyName = '', metadata = {}, lines = [], relatedReferenceType = '', relatedReferenceId = '' }) => {
    const voucherId = generateId();
    const fromAccount = bankAccountOptions.find((row) => row.value === form.bank_account_id);
    const toAccount = bankAccountOptions.find((row) => row.value === form.second_bank_account_id);
    await accountingDb.run(
      `INSERT INTO accounting_vouchers (
        id, voucher_number, voucher_type, voucher_label, voucher_date, party_type, party_id, party_name, status,
        reference_number, narration, from_account_id, from_account_name, to_account_id, to_account_name,
        related_reference_type, related_reference_id, total_amount, tax_amount, metadata_json, created_by, updated_at
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))`,
      [
        voucherId,
        voucherNumber,
        moduleKey,
        getModuleByKey(moduleKey).title,
        form.voucher_date,
        partyType,
        form.party_id || null,
        partyName,
        form.status || 'posted',
        form.reference_number || null,
        form.narration || form.notes || '',
        form.bank_account_id || null,
        fromAccount?.label || '',
        form.second_bank_account_id || null,
        toAccount?.label || '',
        relatedReferenceType || null,
        relatedReferenceId || null,
        Number(totalAmount || 0),
        Number(taxAmount || 0),
        JSON.stringify(metadata || {}),
        currentUser?.id || currentUser?.username || 'system'
      ]
    );

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      await accountingDb.run(
        `INSERT INTO accounting_voucher_items (
          id, voucher_id, line_number, product_id, product_name, description, quantity, unit, rate, tax_rate, line_total, metadata_json
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          generateId(),
          voucherId,
          index + 1,
          line.product_id || null,
          inventoryProducts.find((row) => row.id === line.product_id)?.name || '',
          line.description || '',
          Number(line.quantity || line.physical_qty || 0),
          line.unit || '',
          Number(line.rate || line.amount || 0),
          Number(line.tax_rate || 0),
          Number(line.line_total || (Number(line.quantity || 0) * Number(line.rate || 0)) || line.amount || 0),
          JSON.stringify({
            physical_qty: line.physical_qty || '',
            account_code: line.account_code || '',
            debit_amount: Number(line.debit_amount || 0),
            credit_amount: Number(line.credit_amount || 0)
          })
        ]
      );
    }

    return voucherId;
  };

  const updateInventory = async ({ productId, quantityDelta, transactionType, referenceId, notes }) => {
    if (!productId || !quantityDelta) return;
    const existing = await db.get('SELECT * FROM inventory WHERE product_id = ?', [productId]);
    if (existing) {
      await db.run("UPDATE inventory SET quantity = quantity + ?, last_updated = datetime('now') WHERE product_id = ?", [quantityDelta, productId]);
    } else {
      await db.run('INSERT INTO inventory (id, product_id, quantity) VALUES (?,?,?)', [generateId(), productId, quantityDelta]);
    }
    await db.run(
      'INSERT INTO inventory_transactions (id,product_id,transaction_type,quantity,reference_id,reference_type,notes,created_by) VALUES (?,?,?,?,?,?,?,?)',
      [generateId(), productId, transactionType, Math.abs(Number(quantityDelta)), referenceId, transactionType, notes || '', currentUser?.username || 'system']
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const partyName = selectedParty ? (selectedParty.company || selectedParty.name) : '';
      const paymentMode = form.payment_mode;
      const validItemLines = visibleLines.filter((line) => line.product_id || line.description || Number(line.quantity || 0) > 0 || Number(line.debit_amount || 0) > 0 || Number(line.credit_amount || 0) > 0);
      let voucherNumber = generateDocNumber(currentModule.prefix);
      let relatedReferenceType = '';
      let relatedReferenceId = '';
      let notificationTitle = `${currentModule.title} saved`;

      if (selectedModule === 'contra') {
        if (!form.bank_account_id || !form.second_bank_account_id || !Number(form.amount || 0)) throw new Error('Choose source, destination, and amount for contra.');
        if (form.bank_account_id === form.second_bank_account_id) throw new Error('Choose different source and destination accounts.');
        const amount = Number(form.amount || 0);
        await createBankTransaction({ bankAccountId: form.bank_account_id, referenceType: 'accounting_voucher', referenceId: voucherNumber, transactionDate: form.voucher_date, description: `Contra ${voucherNumber}`, transactionType: 'debit', amount, paymentMode: 'contra' });
        await createBankTransaction({ bankAccountId: form.second_bank_account_id, referenceType: 'accounting_voucher', referenceId: voucherNumber, transactionDate: form.voucher_date, description: `Contra ${voucherNumber}`, transactionType: 'credit', amount, paymentMode: 'contra' });
        await postJournal({
          voucherType: 'contra-voucher',
          referenceType: 'accounting_voucher',
          referenceId: voucherNumber,
          voucherDate: form.voucher_date,
          narration: form.narration || `Contra transfer ${voucherNumber}`,
          lines: [
            { ...getAccountByCode(getCashBankLedger(form.second_bank_account_id).account_code, getCashBankLedger(form.second_bank_account_id).account_name), debit_amount: amount, credit_amount: 0 },
            { ...getAccountByCode(getCashBankLedger(form.bank_account_id).account_code, getCashBankLedger(form.bank_account_id).account_name), debit_amount: 0, credit_amount: amount }
          ]
        });
      } else if (selectedModule === 'payment') {
        if (!form.bank_account_id || !Number(form.amount || 0)) throw new Error('Choose payment account and amount.');
        const amount = Number(form.amount || 0);
        await createBankTransaction({ bankAccountId: form.bank_account_id, referenceType: 'accounting_voucher', referenceId: voucherNumber, transactionDate: form.voucher_date, description: `Payment ${voucherNumber}`, transactionType: 'debit', amount, paymentMode });
        await postJournal({
          voucherType: 'payment-voucher',
          referenceType: 'accounting_voucher',
          referenceId: voucherNumber,
          voucherDate: form.voucher_date,
          narration: form.narration || `Payment ${voucherNumber}`,
          lines: [
            { ...getAccountByCode(form.party_id ? '2000' : '5300', form.party_id ? 'Accounts Payable' : 'Administrative Expense'), debit_amount: amount, credit_amount: 0 },
            { ...getAccountByCode(getCashBankLedger(form.bank_account_id).account_code, getCashBankLedger(form.bank_account_id).account_name), debit_amount: 0, credit_amount: amount }
          ]
        });
      } else if (selectedModule === 'receipt') {
        if (!form.bank_account_id || !Number(form.amount || 0)) throw new Error('Choose receipt account and amount.');
        const amount = Number(form.amount || 0);
        await createBankTransaction({ bankAccountId: form.bank_account_id, referenceType: 'accounting_voucher', referenceId: voucherNumber, transactionDate: form.voucher_date, description: `Receipt ${voucherNumber}`, transactionType: 'credit', amount, paymentMode });
        await postJournal({
          voucherType: 'receipt-voucher',
          referenceType: 'accounting_voucher',
          referenceId: voucherNumber,
          voucherDate: form.voucher_date,
          narration: form.narration || `Receipt ${voucherNumber}`,
          lines: [
            { ...getAccountByCode(getCashBankLedger(form.bank_account_id).account_code, getCashBankLedger(form.bank_account_id).account_name), debit_amount: amount, credit_amount: 0 },
            { ...getAccountByCode(form.party_id ? '1100' : '4000', form.party_id ? 'Accounts Receivable' : 'Sales Revenue'), debit_amount: 0, credit_amount: amount }
          ]
        });
      } else if (selectedModule === 'journal') {
        if (!form.narration) throw new Error('Narration is required for journal.');
        if (Math.abs(journalTotals.debit - journalTotals.credit) > 0.001 || journalTotals.debit <= 0) throw new Error('Journal lines must be balanced.');
        const lines = validItemLines.map((line) => ({ ...getAccountByCode(line.account_code, line.account_code), debit_amount: Number(line.debit_amount || 0), credit_amount: Number(line.credit_amount || 0), description: line.description || form.narration }));
        const posted = await postJournal({ voucherType: 'manual-journal', referenceType: 'accounting_voucher', referenceId: voucherNumber, voucherDate: form.voucher_date, narration: form.narration, lines, autoPosted: false });
        relatedReferenceType = 'journal_entry';
        relatedReferenceId = posted.journalId;
      } else if (selectedModule === 'sales') {
        if (!form.party_id || commercialPreview.lines.length === 0) throw new Error('Customer and at least one sales line are required.');
        const invoiceId = generateId();
        voucherNumber = generateDocNumber('INV');
        await accountingDb.run(
          'INSERT INTO sales_invoices (id,invoice_number,customer_id,customer_name,customer_gst,source_order_id,source_module,invoice_date,due_date,status,place_of_supply,supply_type,subtotal_amount,discount_amount,taxable_amount,cgst_amount,sgst_amount,igst_amount,total_tax,total_amount,outstanding_amount,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [invoiceId, voucherNumber, form.party_id, partyName, selectedParty?.gst_number || '', form.source_id || null, form.source_id ? 'orders' : 'sales', form.voucher_date, form.due_date, 'open', form.place_of_supply || selectedParty?.state || companyState, form.supply_type, commercialPreview.taxable, 0, commercialPreview.taxable, commercialPreview.cgst, commercialPreview.sgst, commercialPreview.igst, commercialPreview.totalTax, commercialPreview.total, commercialPreview.total, form.narration]
        );
        for (let index = 0; index < commercialPreview.lines.length; index += 1) {
          const line = commercialPreview.lines[index];
          await accountingDb.run(
            'INSERT INTO sales_invoice_items (id,invoice_id,line_number,product_id,product_name,hsn_sac,quantity,unit,rate,discount_percent,taxable_amount,gst_rate,cgst_amount,sgst_amount,igst_amount,line_total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [generateId(), invoiceId, index + 1, line.product_id || null, line.description, inventoryProducts.find((row) => row.id === line.product_id)?.hsn_code || '', Number(line.quantity || 0), line.unit || 'PCS', Number(line.rate || 0), 0, line.taxable, Number(line.tax_rate || 0), line.cgst_amount, line.sgst_amount, line.igst_amount, line.line_total]
          );
        }
        await postJournal({
          voucherType: 'sales-invoice',
          referenceType: 'sales_invoice',
          referenceId: invoiceId,
          voucherDate: form.voucher_date,
          narration: form.narration || `Sales invoice ${voucherNumber}`,
          lines: [
            { ...getAccountByCode('1100', 'Accounts Receivable'), debit_amount: commercialPreview.total, credit_amount: 0 },
            { ...getAccountByCode('4000', 'Sales Revenue'), debit_amount: 0, credit_amount: commercialPreview.taxable },
            ...(commercialPreview.cgst ? [{ ...getAccountByCode('2100', 'Output CGST'), debit_amount: 0, credit_amount: commercialPreview.cgst }] : []),
            ...(commercialPreview.sgst ? [{ ...getAccountByCode('2110', 'Output SGST'), debit_amount: 0, credit_amount: commercialPreview.sgst }] : []),
            ...(commercialPreview.igst ? [{ ...getAccountByCode('2120', 'Output IGST'), debit_amount: 0, credit_amount: commercialPreview.igst }] : [])
          ]
        });
        relatedReferenceType = 'sales_invoice';
        relatedReferenceId = invoiceId;
        notificationTitle = 'Sales invoice posted';
      } else if (selectedModule === 'purchase') {
        if (!form.party_id || commercialPreview.lines.length === 0) throw new Error('Vendor and at least one purchase line are required.');
        const billId = generateId();
        voucherNumber = generateDocNumber('BILL');
        await accountingDb.run(
          'INSERT INTO purchase_bills (id,bill_number,vendor_id,vendor_name,vendor_gst,source_grn_id,source_module,bill_date,due_date,status,place_of_supply,supply_type,subtotal_amount,discount_amount,taxable_amount,cgst_amount,sgst_amount,igst_amount,total_tax,total_amount,outstanding_amount,itc_eligible,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [billId, voucherNumber, form.party_id, partyName, selectedParty?.gst_number || '', form.source_id || null, form.source_id ? 'grn' : 'purchase', form.voucher_date, form.due_date, 'open', form.place_of_supply || selectedParty?.state || companyState, form.supply_type, commercialPreview.taxable, 0, commercialPreview.taxable, commercialPreview.cgst, commercialPreview.sgst, commercialPreview.igst, commercialPreview.totalTax, commercialPreview.total, commercialPreview.total, form.itc_eligible ? 1 : 0, form.narration]
        );
        for (let index = 0; index < commercialPreview.lines.length; index += 1) {
          const line = commercialPreview.lines[index];
          await accountingDb.run(
            'INSERT INTO purchase_bill_items (id,bill_id,line_number,product_id,product_name,hsn_sac,quantity,unit,rate,discount_percent,taxable_amount,gst_rate,cgst_amount,sgst_amount,igst_amount,line_total) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
            [generateId(), billId, index + 1, line.product_id || null, line.description, inventoryProducts.find((row) => row.id === line.product_id)?.hsn_code || '', Number(line.quantity || 0), line.unit || 'PCS', Number(line.rate || 0), 0, line.taxable, Number(line.tax_rate || 0), line.cgst_amount, line.sgst_amount, line.igst_amount, line.line_total]
          );
        }
        await postJournal({
          voucherType: 'purchase-bill',
          referenceType: 'purchase_bill',
          referenceId: billId,
          voucherDate: form.voucher_date,
          narration: form.narration || `Purchase bill ${voucherNumber}`,
          lines: [
            { ...getAccountByCode('5100', 'Purchase Expense'), debit_amount: commercialPreview.taxable, credit_amount: 0 },
            ...(form.itc_eligible && commercialPreview.cgst ? [{ ...getAccountByCode('1200', 'Input CGST'), debit_amount: commercialPreview.cgst, credit_amount: 0 }] : []),
            ...(form.itc_eligible && commercialPreview.sgst ? [{ ...getAccountByCode('1210', 'Input SGST'), debit_amount: commercialPreview.sgst, credit_amount: 0 }] : []),
            ...(form.itc_eligible && commercialPreview.igst ? [{ ...getAccountByCode('1220', 'Input IGST'), debit_amount: commercialPreview.igst, credit_amount: 0 }] : []),
            { ...getAccountByCode('2000', 'Accounts Payable'), debit_amount: 0, credit_amount: commercialPreview.total }
          ]
        });
        relatedReferenceType = 'purchase_bill';
        relatedReferenceId = billId;
        notificationTitle = 'Purchase bill posted';
      } else if (selectedModule === 'credit_note') {
        if (!form.party_id || !Number(form.amount || 0)) throw new Error('Customer and amount are required for credit note.');
        const amount = Number(form.amount || 0);
        await postJournal({ voucherType: 'credit-note', referenceType: 'sales_invoice', referenceId: form.source_id || null, voucherDate: form.voucher_date, narration: form.narration || `Credit note ${voucherNumber}`, lines: [{ ...getAccountByCode('4000', 'Sales Revenue'), debit_amount: amount, credit_amount: 0 }, { ...getAccountByCode('1100', 'Accounts Receivable'), debit_amount: 0, credit_amount: amount }] });
      } else if (selectedModule === 'debit_note') {
        if (!form.party_id || !Number(form.amount || 0)) throw new Error('Vendor and amount are required for debit note.');
        const amount = Number(form.amount || 0);
        await postJournal({ voucherType: 'debit-note', referenceType: 'purchase_bill', referenceId: form.source_id || null, voucherDate: form.voucher_date, narration: form.narration || `Debit note ${voucherNumber}`, lines: [{ ...getAccountByCode('2000', 'Accounts Payable'), debit_amount: amount, credit_amount: 0 }, { ...getAccountByCode('5100', 'Purchase Expense'), debit_amount: 0, credit_amount: amount }] });
      } else if (selectedModule === 'sales_order') {
        if (!form.party_id || validItemLines.length === 0) throw new Error('Customer and at least one order line are required.');
        const orderId = generateId();
        await db.run('INSERT INTO orders (id,order_number,customer_id,delivery_date,total_amount,notes,created_by) VALUES (?,?,?,?,?,?,?)', [orderId, voucherNumber, form.party_id, form.due_date, sumVoucherLines(validItemLines), form.narration, currentUser?.username || 'system']);
        for (const line of validItemLines) {
          await db.run('INSERT INTO order_items (id,order_id,product_id,description,quantity,unit_price,total) VALUES (?,?,?,?,?,?,?)', [generateId(), orderId, line.product_id || null, line.description, Number(line.quantity || 0), Number(line.rate || 0), Number(line.quantity || 0) * Number(line.rate || 0)]);
        }
        relatedReferenceType = 'sales_order';
        relatedReferenceId = orderId;
      } else if (selectedModule === 'purchase_order') {
        if (!form.party_id || validItemLines.length === 0) throw new Error('Vendor and at least one PO line are required.');
        const poId = generateId();
        await db.run('INSERT INTO purchase_orders (id,po_number,vendor_id,expected_date,total_amount,notes,created_by) VALUES (?,?,?,?,?,?,?)', [poId, voucherNumber, form.party_id, form.due_date, sumVoucherLines(validItemLines), form.narration, currentUser?.username || 'system']);
        for (const line of validItemLines) {
          await db.run('INSERT INTO purchase_order_items (id,po_id,product_id,quantity,unit_price,total) VALUES (?,?,?,?,?,?)', [generateId(), poId, line.product_id || null, Number(line.quantity || 0), Number(line.rate || 0), Number(line.quantity || 0) * Number(line.rate || 0)]);
        }
        relatedReferenceType = 'purchase_order';
        relatedReferenceId = poId;
      } else if (selectedModule === 'receipt_note') {
        if (!form.party_id || validItemLines.length === 0) throw new Error('Vendor and at least one received line are required.');
        const grnId = generateId();
        await db.run('INSERT INTO grn (id,grn_number,po_id,vendor_id,received_date,invoice_number,total_amount,notes,created_by) VALUES (?,?,?,?,?,?,?,?,?)', [grnId, voucherNumber, form.source_id || null, form.party_id, form.voucher_date, form.reference_number || '', sumVoucherLines(validItemLines), form.narration, currentUser?.username || 'system']);
        for (const line of validItemLines) {
          await db.run('INSERT INTO grn_items (id,grn_id,product_id,received_qty,unit_price,total) VALUES (?,?,?,?,?,?)', [generateId(), grnId, line.product_id || null, Number(line.quantity || 0), Number(line.rate || 0), Number(line.quantity || 0) * Number(line.rate || 0)]);
          await updateInventory({ productId: line.product_id, quantityDelta: Number(line.quantity || 0), transactionType: 'receipt_note', referenceId: grnId, notes: form.narration });
        }
        relatedReferenceType = 'grn';
        relatedReferenceId = grnId;
      } else if (selectedModule === 'delivery_note') {
        if (!form.party_id || validItemLines.length === 0) throw new Error('Customer and at least one delivered line are required.');
        for (const line of validItemLines) {
          await updateInventory({ productId: line.product_id, quantityDelta: -Math.abs(Number(line.quantity || 0)), transactionType: 'delivery_note', referenceId: voucherNumber, notes: form.narration });
        }
      } else if (selectedModule === 'rejections_in') {
        if (!form.party_id || validItemLines.length === 0) throw new Error('Customer and at least one rejection line are required.');
        for (const line of validItemLines) {
          await updateInventory({ productId: line.product_id, quantityDelta: Math.abs(Number(line.quantity || 0)), transactionType: 'rejections_in', referenceId: voucherNumber, notes: form.narration });
        }
      } else if (selectedModule === 'rejections_out') {
        if (!form.party_id || validItemLines.length === 0) throw new Error('Vendor and at least one rejection line are required.');
        for (const line of validItemLines) {
          await updateInventory({ productId: line.product_id, quantityDelta: -Math.abs(Number(line.quantity || 0)), transactionType: 'rejections_out', referenceId: voucherNumber, notes: form.narration });
        }
      } else if (selectedModule === 'physical_stock') {
        const stockLines = validItemLines.filter((line) => line.product_id && line.physical_qty !== '');
        if (stockLines.length === 0) throw new Error('Enter at least one physical stock count.');
        for (const line of stockLines) {
          const product = inventoryProducts.find((row) => row.id === line.product_id);
          const physicalQty = Number(line.physical_qty || 0);
          const systemQty = Number(product?.stock || 0);
          const delta = physicalQty - systemQty;
          if (delta !== 0) {
            await updateInventory({ productId: line.product_id, quantityDelta: delta, transactionType: 'physical_stock', referenceId: voucherNumber, notes: `System ${systemQty}, physical ${physicalQty}` });
          }
        }
      } else if (selectedModule === 'payroll') {
        if (!form.employee_id || !Number(form.amount || 0)) throw new Error('Employee and amount are required for payroll.');
        const amount = Number(form.amount || 0);
        await postJournal({
          voucherType: 'payroll-voucher',
          referenceType: 'employee',
          referenceId: form.employee_id,
          voucherDate: form.voucher_date,
          narration: form.narration || `Payroll ${voucherNumber}`,
          lines: [
            { ...getAccountByCode('5200', 'Payroll Expense'), debit_amount: amount, credit_amount: 0 },
            { ...getAccountByCode('2310', 'Payroll Payable'), debit_amount: 0, credit_amount: amount }
          ]
        });
      } else if (selectedModule === 'memorandum') {
        notificationTitle = 'Memorandum recorded';
      }

      const voucherId = await persistVoucherRecord({
        moduleKey: selectedModule,
        voucherNumber,
        totalAmount: currentAmount,
        taxAmount: ['sales', 'purchase'].includes(selectedModule) ? commercialPreview.totalTax : 0,
        partyType: ['payment', 'purchase', 'debit_note', 'receipt_note', 'purchase_order', 'rejections_out'].includes(selectedModule) ? 'vendor' : selectedParty ? 'customer' : '',
        partyName,
        metadata: {
          payment_mode: form.payment_mode,
          due_date: form.due_date,
          source_id: form.source_id,
          place_of_supply: form.place_of_supply,
          supply_type: form.supply_type,
          employee_id: form.employee_id,
          notes: form.notes
        },
        lines: validItemLines,
        relatedReferenceType,
        relatedReferenceId
      });

      await addNotification?.('success', notificationTitle, voucherNumber, voucherId, 'accounting_voucher');
      flash?.('success', `${currentModule.title} ${voucherNumber} saved successfully.`);
      setForm(createInitialForm(selectedModule));
      await loadWorkspaceData();
      await onRefresh?.();
    } catch (error) {
      flash?.('error', error.message || 'Unable to save voucher.');
    } finally {
      setSaving(false);
    }
  };

  const renderPartyField = () => {
    if (['payment', 'purchase', 'debit_note', 'receipt_note', 'purchase_order', 'rejections_out'].includes(selectedModule)) {
      return <div className="form-group"><label className="form-label">Party</label><SearchableSelect value={form.party_id} onChange={(value) => setField('party_id', value)} options={vendorOptions} placeholder="Write company name..." clearable /></div>;
    }
    if (['receipt', 'sales', 'credit_note', 'delivery_note', 'sales_order', 'rejections_in'].includes(selectedModule)) {
      return <div className="form-group"><label className="form-label">Party</label><SearchableSelect value={form.party_id} onChange={(value) => setField('party_id', value)} options={customerOptions} placeholder="Write company name..." clearable /></div>;
    }
    return null;
  };

  const renderItemLines = (label, stockMode = false) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4>{label}</h4>
        <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}><FilePlus2 size={13} />Add Line</button>
      </div>
      {visibleLines.map((line) => {
        const product = inventoryProducts.find((row) => row.id === line.product_id);
        return (
          <div key={line.id} style={{ display: 'grid', gridTemplateColumns: stockMode ? '2.2fr 1.2fr 1fr 1fr 1fr auto' : '2.2fr 1.4fr 1fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
            <div className="form-group">
              <label className="form-label">Product</label>
              <SearchableSelect value={line.product_id} onChange={(value) => selectProductForLine(line.id, value)} options={productOptions} placeholder="Write product name..." clearable />
            </div>
            <div className="form-group">
              <label className="form-label">{stockMode ? 'System Qty' : 'Description'}</label>
              {stockMode ? <div className="bom-static-field">{product ? `${Number(product.stock || 0)} ${product.unit || ''}` : '-'}</div> : <input className="form-control" value={line.description || ''} onChange={(event) => updateLine(line.id, 'description', event.target.value)} placeholder="Line description" />}
            </div>
            <div className="form-group">
              <label className="form-label">{stockMode ? 'Physical Qty' : 'Qty'}</label>
              <input className="form-control" type="number" min="0" step="0.01" value={stockMode ? line.physical_qty : line.quantity} onChange={(event) => updateLine(line.id, stockMode ? 'physical_qty' : 'quantity', event.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Rate</label>
              <input className="form-control" type="number" min="0" step="0.01" value={line.rate} onChange={(event) => updateLine(line.id, 'rate', event.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">{stockMode ? 'Adj. Value' : 'Tax %'}</label>
              {stockMode ? <div className="bom-static-field">{formatCurrency((Number(line.physical_qty || 0) || 0) * Number(line.rate || 0), currencySymbol)}</div> : <input className="form-control" type="number" min="0" step="0.01" value={line.tax_rate} onChange={(event) => updateLine(line.id, 'tax_rate', event.target.value)} />}
            </div>
            <button type="button" className="btn btn-danger btn-sm" onClick={() => removeLine(line.id)}>Remove</button>
          </div>
        );
      })}
    </div>
  );

  const renderJournalLines = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4>Journal Lines</h4>
        <button type="button" className="btn btn-secondary btn-sm" onClick={addLine}><FilePlus2 size={13} />Add Line</button>
      </div>
      {visibleLines.map((line) => (
        <div key={line.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.2fr 1fr 1fr auto', gap: 10, alignItems: 'end' }}>
          <div className="form-group"><label className="form-label">Account</label><SearchableSelect value={line.account_code} onChange={(value) => updateLine(line.id, 'account_code', value)} options={accountOptions} placeholder="Write account code..." /></div>
          <div className="form-group"><label className="form-label">Description</label><input className="form-control" value={line.description || ''} onChange={(event) => updateLine(line.id, 'description', event.target.value)} placeholder="Line note" /></div>
          <div className="form-group"><label className="form-label">Debit</label><input className="form-control" type="number" min="0" step="0.01" value={line.debit_amount} onChange={(event) => updateLine(line.id, 'debit_amount', event.target.value)} /></div>
          <div className="form-group"><label className="form-label">Credit</label><input className="form-control" type="number" min="0" step="0.01" value={line.credit_amount} onChange={(event) => updateLine(line.id, 'credit_amount', event.target.value)} /></div>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => removeLine(line.id)}>Remove</button>
        </div>
      ))}
    </div>
  );

  const renderFormCanvas = () => {
    if (selectedModule === 'contra') {
      return <>
        <div className="grid-3">
          <div className="form-group"><label className="form-label">Date</label><input className="form-control" type="date" value={form.voucher_date} onChange={(event) => setField('voucher_date', event.target.value)} /></div>
          <div className="form-group"><label className="form-label">From</label><SearchableSelect value={form.bank_account_id} onChange={(value) => setField('bank_account_id', value)} options={bankAccountOptions} placeholder="Write source account..." /></div>
          <div className="form-group"><label className="form-label">To</label><SearchableSelect value={form.second_bank_account_id} onChange={(value) => setField('second_bank_account_id', value)} options={bankAccountOptions} placeholder="Write destination account..." /></div>
        </div>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">Amount</label><input className="form-control" type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setField('amount', event.target.value)} placeholder="Transfer amount" /></div>
          <div className="form-group"><label className="form-label">Reference</label><input className="form-control" value={form.reference_number} onChange={(event) => setField('reference_number', event.target.value)} placeholder="Slip / transfer reference" /></div>
        </div>
      </>;
    }

    if (['payment', 'receipt'].includes(selectedModule)) {
      return <>
        <div className="grid-4">
          <div className="form-group"><label className="form-label">Date</label><input className="form-control" type="date" value={form.voucher_date} onChange={(event) => setField('voucher_date', event.target.value)} /></div>
          {renderPartyField()}
          <div className="form-group"><label className="form-label">Cash / Bank</label><SearchableSelect value={form.bank_account_id} onChange={(value) => setField('bank_account_id', value)} options={bankAccountOptions} placeholder="Write cash or bank..." /></div>
          <div className="form-group"><label className="form-label">Mode</label><SearchableSelect value={form.payment_mode} onChange={(value) => setField('payment_mode', value)} options={PAYMENT_MODE_OPTIONS} placeholder="Write mode..." /></div>
        </div>
        <div className="grid-3">
          <div className="form-group"><label className="form-label">Amount</label><input className="form-control" type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setField('amount', event.target.value)} placeholder="Voucher amount" /></div>
          <div className="form-group"><label className="form-label">Reference</label><input className="form-control" value={form.reference_number} onChange={(event) => setField('reference_number', event.target.value)} placeholder="UTR / cheque / receipt ref." /></div>
          <div className="form-group"><label className="form-label">Status</label><SearchableSelect value={form.status} onChange={(value) => setField('status', value)} options={ACCOUNTING_STATUS_OPTIONS} placeholder="Write status..." /></div>
        </div>
      </>;
    }

    if (selectedModule === 'journal') {
      return <>
        <div className="grid-2">
          <div className="form-group"><label className="form-label">Date</label><input className="form-control" type="date" value={form.voucher_date} onChange={(event) => setField('voucher_date', event.target.value)} /></div>
          <div className="form-group"><label className="form-label">Status</label><SearchableSelect value={form.status} onChange={(value) => setField('status', value)} options={ACCOUNTING_STATUS_OPTIONS} placeholder="Write status..." /></div>
        </div>
        {renderJournalLines()}
        <div className="catalogue-summary-card"><span className="catalogue-summary-title">Balance Check</span><strong>{formatCurrency(journalTotals.debit, currencySymbol)} / {formatCurrency(journalTotals.credit, currencySymbol)}</strong><span className="text-secondary text-sm">{Math.abs(journalTotals.debit - journalTotals.credit) < 0.001 ? 'Balanced journal ready to post' : 'Debit and credit must match'}</span></div>
      </>;
    }

    if (['sales', 'purchase'].includes(selectedModule)) {
      return <>
        <div className="grid-4">
          <div className="form-group"><label className="form-label">{selectedModule === 'sales' ? 'Invoice Date' : 'Bill Date'}</label><input className="form-control" type="date" value={form.voucher_date} onChange={(event) => setField('voucher_date', event.target.value)} /></div>
          {renderPartyField()}
          <div className="form-group"><label className="form-label">{selectedModule === 'sales' ? 'Source Order' : 'Source GRN'}</label><SearchableSelect value={form.source_id} onChange={(value) => setField('source_id', value)} options={selectedModule === 'sales' ? orderOptions : grnOptions} placeholder={`Write ${selectedModule === 'sales' ? 'order' : 'GRN'}...`} clearable /></div>
          <div className="form-group"><label className="form-label">Due Date</label><input className="form-control" type="date" value={form.due_date} onChange={(event) => setField('due_date', event.target.value)} /></div>
        </div>
        <div className="grid-3">
          <div className="form-group"><label className="form-label">Place Of Supply</label><input className="form-control" value={form.place_of_supply || selectedParty?.state || companyState} onChange={(event) => setField('place_of_supply', event.target.value)} placeholder="Place of supply" /></div>
          <div className="form-group"><label className="form-label">Supply Type</label><SearchableSelect value={form.supply_type} onChange={(value) => setField('supply_type', value)} options={[{ value: 'intra-state', label: 'Intra-state' }, { value: 'inter-state', label: 'Inter-state' }]} placeholder="Write supply type..." /></div>
          {selectedModule === 'purchase' ? <div className="form-group" style={{ justifyContent: 'flex-end' }}><label className="form-label">ITC Eligible</label><label style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 38 }}><input type="checkbox" checked={Boolean(form.itc_eligible)} onChange={(event) => setField('itc_eligible', event.target.checked)} /><span className="text-secondary">Claim input tax credit</span></label></div> : <div />}
        </div>
        {renderItemLines(selectedModule === 'sales' ? 'Invoice Lines' : 'Bill Lines')}
        <div className="catalogue-summary-card"><span className="catalogue-summary-title">Commercial Total</span><strong>{formatCurrency(commercialPreview.total, currencySymbol)}</strong><span className="text-secondary text-sm">Taxable {formatCurrency(commercialPreview.taxable, currencySymbol)} · Tax {formatCurrency(commercialPreview.totalTax, currencySymbol)}</span></div>
      </>;
    }

    if (['credit_note', 'debit_note'].includes(selectedModule)) {
      return <div className="grid-4">
        <div className="form-group"><label className="form-label">Date</label><input className="form-control" type="date" value={form.voucher_date} onChange={(event) => setField('voucher_date', event.target.value)} /></div>
        {renderPartyField()}
        <div className="form-group"><label className="form-label">Against</label><SearchableSelect value={form.source_id} onChange={(value) => setField('source_id', value)} options={selectedModule === 'credit_note' ? salesInvoiceOptions : purchaseBillOptions} placeholder="Write reference document..." clearable /></div>
        <div className="form-group"><label className="form-label">Amount</label><input className="form-control" type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setField('amount', event.target.value)} placeholder="Adjustment amount" /></div>
      </div>;
    }

    if (['sales_order', 'purchase_order'].includes(selectedModule)) {
      return <>
        <div className="grid-3">
          <div className="form-group"><label className="form-label">Date</label><input className="form-control" type="date" value={form.voucher_date} onChange={(event) => setField('voucher_date', event.target.value)} /></div>
          {renderPartyField()}
          <div className="form-group"><label className="form-label">{selectedModule === 'sales_order' ? 'Delivery Date' : 'Expected Date'}</label><input className="form-control" type="date" value={form.due_date} onChange={(event) => setField('due_date', event.target.value)} /></div>
        </div>
        {renderItemLines(selectedModule === 'sales_order' ? 'Sales Order Lines' : 'Purchase Order Lines')}
      </>;
    }

    if (['delivery_note', 'receipt_note', 'rejections_in', 'rejections_out', 'physical_stock'].includes(selectedModule)) {
      return <>
        <div className="grid-4">
          <div className="form-group"><label className="form-label">Date</label><input className="form-control" type="date" value={form.voucher_date} onChange={(event) => setField('voucher_date', event.target.value)} /></div>
          {selectedModule !== 'physical_stock' ? renderPartyField() : <div className="form-group"><label className="form-label">Warehouse</label><input className="form-control" value={form.warehouse_name} onChange={(event) => setField('warehouse_name', event.target.value)} placeholder="Warehouse / store" /></div>}
          <div className="form-group"><label className="form-label">Reference</label><SearchableSelect value={form.source_id} onChange={(value) => setField('source_id', value)} options={orderOptions} placeholder="Write linked order..." clearable /></div>
          <div className="form-group"><label className="form-label">Status</label><SearchableSelect value={form.status} onChange={(value) => setField('status', value)} options={STOCK_STATUS_OPTIONS} placeholder="Write status..." /></div>
        </div>
        {renderItemLines(selectedModule === 'physical_stock' ? 'Counted Stock Lines' : 'Stock Movement Lines', selectedModule === 'physical_stock')}
      </>;
    }

    if (selectedModule === 'payroll') {
      return <div className="grid-4">
        <div className="form-group"><label className="form-label">Payroll Date</label><input className="form-control" type="date" value={form.voucher_date} onChange={(event) => setField('voucher_date', event.target.value)} /></div>
        <div className="form-group"><label className="form-label">Employee</label><SearchableSelect value={form.employee_id} onChange={(value) => setField('employee_id', value)} options={employeeOptions} placeholder="Write employee name..." /></div>
        <div className="form-group"><label className="form-label">Amount</label><input className="form-control" type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setField('amount', event.target.value)} placeholder="Net pay / accrual" /></div>
        <div className="form-group"><label className="form-label">Status</label><SearchableSelect value={form.status} onChange={(value) => setField('status', value)} options={ACCOUNTING_STATUS_OPTIONS} placeholder="Write status..." /></div>
      </div>;
    }

    return <div className="grid-3">
      <div className="form-group"><label className="form-label">Date</label><input className="form-control" type="date" value={form.voucher_date} onChange={(event) => setField('voucher_date', event.target.value)} /></div>
      <div className="form-group"><label className="form-label">Status</label><SearchableSelect value={form.status} onChange={(value) => setField('status', value)} options={MEMO_STATUS_OPTIONS} placeholder="Write memo status..." /></div>
      <div className="form-group"><label className="form-label">Amount</label><input className="form-control" type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setField('amount', event.target.value)} placeholder="Optional suspense amount" /></div>
    </div>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ borderRadius: 22, padding: 24, border: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(61,127,255,0.18), rgba(10,15,28,0.92) 42%, rgba(16,185,129,0.10))' }}>
        <div className="catalogue-hero-kicker"><ReceiptText size={12} /><span>Voucher control center</span></div>
        <h3 style={{ fontSize: 30, marginTop: 14, marginBottom: 8 }}>Work every accounting and stock-facing voucher from one professional desk.</h3>
        <p className="text-secondary" style={{ maxWidth: 900 }}>Pick a module from the left, complete the form on the canvas, and let the workspace write the right voucher, inventory movement, order record, GRN, or journal entry behind the scenes.</p>
        <div className="catalogue-chip-row" style={{ marginTop: 16 }}>{VOUCHER_MODULES.slice(0, 6).map((module) => <span key={module.key} className="catalogue-chip">{module.title} {module.hotkey}</span>)}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr)', gap: 16, alignItems: 'start' }}>
        <div className="card" style={{ position: 'sticky', top: 0 }}>
          <div className="card-header"><div><h4>Voucher Modules</h4><div className="text-secondary text-sm">Select a module to open its working form.</div></div></div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 12 }}>
            {VOUCHER_MODULES.map((module) => {
              const Icon = module.icon;
              const active = module.key === selectedModule;
              return (
                <button key={module.key} type="button" onClick={() => handleModuleSelect(module.key)} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, width: '100%', borderRadius: 14, border: `1px solid ${active ? `${module.tone}55` : 'var(--border)'}`, background: active ? `${module.tone}18` : 'var(--bg-secondary)', padding: '12px 14px', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 12, background: active ? `${module.tone}25` : 'var(--bg-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={16} color={module.tone} /></div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <strong style={{ flex: 1, minWidth: 0 }}>{module.title}</strong>
                      <span
                        className="text-secondary text-sm"
                        style={{
                          flexShrink: 0,
                          minWidth: 64,
                          textAlign: 'right',
                          fontVariantNumeric: 'tabular-nums',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {module.hotkey}
                      </span>
                    </div>
                    <div className="text-secondary text-sm" style={{ marginTop: 4 }}>{module.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div className="card-header" style={{ alignItems: 'flex-start' }}>
              <div>
                <div className="catalogue-hero-kicker" style={{ color: currentModule.tone }}><CurrentModuleIcon size={12} /><span>{currentModule.hotkey}</span></div>
                <h4 style={{ marginTop: 10 }}>{currentModule.title} Workspace</h4>
                <div className="text-secondary text-sm" style={{ marginTop: 4 }}>{currentModule.description}</div>
              </div>
              <div className="catalogue-summary-card" style={{ minWidth: 220 }}>
                <span className="catalogue-summary-title">Current Value</span>
                <strong>{formatCurrency(currentAmount, currencySymbol)}</strong>
                <span className="text-secondary text-sm">{selectedParty ? (selectedParty.company || selectedParty.name) : (employees.find((row) => row.id === form.employee_id)?.full_name || 'No party selected yet')}</span>
              </div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {renderFormCanvas()}
              <div className="form-group"><label className="form-label">Narration / Notes</label><textarea className="form-control" rows={4} value={form.narration} onChange={(event) => setField('narration', event.target.value)} placeholder={`Write the ${currentModule.title.toLowerCase()} narration, operational note, or approval context`} /></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div className="grid-3" style={{ flex: 1 }}>
                  <div className="catalogue-summary-card"><span className="catalogue-summary-title">Voucher Type</span><strong>{currentModule.title}</strong><span className="text-secondary text-sm">{currentModule.hotkey}</span></div>
                  <div className="catalogue-summary-card"><span className="catalogue-summary-title">Party / Anchor</span><strong>{selectedParty ? (selectedParty.company || selectedParty.name) : (employees.find((row) => row.id === form.employee_id)?.full_name || 'Independent voucher')}</strong><span className="text-secondary text-sm">{form.reference_number || 'No external reference yet'}</span></div>
                  <div className="catalogue-summary-card"><span className="catalogue-summary-title">Posting Readiness</span><strong>{saving ? 'Saving...' : 'Ready'}</strong><span className="text-secondary text-sm">{selectedModule === 'journal' ? `${formatCurrency(journalTotals.debit, currencySymbol)} debits` : `${visibleLines.length} line(s)`}</span></div>
                </div>
                <button type="button" className="btn btn-primary btn-lg" onClick={handleSave} disabled={saving}><Save size={14} /> {saving ? 'Saving...' : `Save ${currentModule.title}`}</button>
              </div>
            </div>
          </div>

          <div className="grid-3">
            <div className="catalogue-summary-card"><span className="catalogue-summary-title">Recorded Vouchers</span><strong>{recentVouchers.length}</strong><span className="text-secondary text-sm">Latest records in the unified voucher register.</span></div>
            <div className="catalogue-summary-card"><span className="catalogue-summary-title">Bank Masters</span><strong>{bankAccounts.length + 1}</strong><span className="text-secondary text-sm">Cash plus tracked bank accounts available for posting.</span></div>
            <div className="catalogue-summary-card"><span className="catalogue-summary-title">Inventory-aware SKUs</span><strong>{inventoryProducts.length}</strong><span className="text-secondary text-sm">Products available for stock and commercial vouchers.</span></div>
          </div>

          <div className="card">
            <div className="card-header"><div><h4>Recent Voucher Register</h4><div className="text-secondary text-sm">Unified log of the new voucher workspace across accounting, stock, and order-facing documents.</div></div></div>
            <div className="table-container" style={{ maxHeight: 360 }}>
              <table className="data-table">
                <thead><tr><th>Voucher</th><th>Type</th><th>Party</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead>
                <tbody>
                  {recentVouchers.length ? recentVouchers.map((row) => (
                    <tr key={row.id}>
                      <td><div className="font-mono text-accent">{row.voucher_number}</div><div className="text-secondary text-sm">{row.reference_number || row.related_reference_type || 'Direct voucher'}</div></td>
                      <td><span className="badge badge-secondary">{row.voucher_label || row.voucher_type}</span></td>
                      <td>{row.party_name || '-'}</td>
                      <td>{row.voucher_date}</td>
                      <td>{formatCurrency(row.total_amount || 0, currencySymbol)}</td>
                      <td><span className="badge badge-info">{row.status || 'posted'}</span></td>
                    </tr>
                  )) : <tr><td colSpan={6} className="text-center text-muted">No vouchers recorded from the workspace yet</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
