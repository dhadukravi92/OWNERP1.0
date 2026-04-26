import React, { useEffect, useMemo, useState } from 'react';
import db, { generateId } from '../utils/database';
import {
  Plus, Search, Edit2, Trash2, Users, X, Phone, Mail, Building2,
  Landmark, CreditCard
} from 'lucide-react';

const CONTACT_DEFAULTS = {
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
};

const PAYMENT_METHOD_OPTIONS = [
  { value: 'bank_transfer', label: 'Bank Transfer / NEFT / RTGS' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card / POS' },
  { value: 'other', label: 'Other' }
];

const ACCOUNT_TYPE_OPTIONS = [
  { value: 'current', label: 'Current' },
  { value: 'savings', label: 'Savings' },
  { value: 'cc_od', label: 'CC / OD' },
  { value: 'escrow', label: 'Escrow' },
  { value: 'other', label: 'Other' }
];

const PAYMENT_METHOD_LABELS = PAYMENT_METHOD_OPTIONS.reduce((acc, option) => {
  acc[option.value] = option.label;
  return acc;
}, {});

const formatMoney = (value) => `Rs. ${Math.round(Number(value || 0)).toLocaleString('en-IN')}`;

const maskAccountNumber = (value) => {
  const clean = `${value || ''}`.replace(/\s+/g, '');
  if (!clean) return '-';
  if (clean.length <= 4) return clean;
  return `${'*'.repeat(Math.max(clean.length - 4, 0))}${clean.slice(-4)}`;
};

function ContactModal({ contact, onClose, onSave }) {
  const [form, setForm] = useState({ ...CONTACT_DEFAULTS, ...(contact || {}) });
  const f = (field, val) => setForm((prev) => ({ ...prev, [field]: val }));

  const hasBankingDetails = Boolean(
    `${form.bank_name || ''}`.trim() ||
    `${form.account_number || ''}`.trim() ||
    `${form.upi_id || ''}`.trim()
  );
  const settlementReady = Boolean(
    hasBankingDetails &&
    (`${form.ifsc_code || ''}`.trim() || `${form.swift_code || ''}`.trim() || `${form.iban || ''}`.trim() || `${form.upi_id || ''}`.trim())
  );
  const primaryDisplayName = (form.company || form.name || 'Contact master').trim();

  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = [
      form.type,
      form.name,
      form.company,
      form.email,
      form.phone,
      form.address,
      form.city,
      form.state,
      form.gst_number,
      form.pan_number,
      Number(form.credit_limit || 0),
      form.account_holder_name,
      form.bank_name,
      form.branch_name,
      form.account_number,
      form.account_type,
      form.ifsc_code,
      form.swift_code,
      form.iban,
      form.upi_id,
      form.preferred_payment_method,
      Number(form.payment_terms_days || 0),
      form.bank_address,
      form.notes
    ];

    if (contact?.id) {
      await db.run(
        `UPDATE contacts
         SET type=?,name=?,company=?,email=?,phone=?,address=?,city=?,state=?,gst_number=?,pan_number=?,credit_limit=?,
             account_holder_name=?,bank_name=?,branch_name=?,account_number=?,account_type=?,ifsc_code=?,swift_code=?,
             iban=?,upi_id=?,preferred_payment_method=?,payment_terms_days=?,bank_address=?,notes=?
         WHERE id=?`,
        [...payload, contact.id]
      );
    } else {
      await db.run(
        `INSERT INTO contacts (
          id,type,name,company,email,phone,address,city,state,gst_number,pan_number,credit_limit,
          account_holder_name,bank_name,branch_name,account_number,account_type,ifsc_code,swift_code,
          iban,upi_id,preferred_payment_method,payment_terms_days,bank_address,notes
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [generateId(), ...payload]
      );
    }

    onSave();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <div>
            <h3>{contact ? 'Edit Contact Banking Master' : 'Add Contact Banking Master'}</h3>
            <div className="text-secondary text-sm" style={{ marginTop: 4 }}>
              Customer and vendor masters now carry settlement instructions that Accounting can read directly during billing and payable processing.
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ padding: 18, borderRadius: 18, border: '1px solid var(--border)', background: 'linear-gradient(135deg, rgba(61,127,255,0.16), rgba(6,182,212,0.08))' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div className="text-secondary text-sm">Party Type</div>
                  <div className="tabs" style={{ width: 'fit-content', marginTop: 10 }}>
                    <button type="button" className={`tab ${form.type === 'customer' ? 'active' : ''}`} onClick={() => f('type', 'customer')}>Customer</button>
                    <button type="button" className={`tab ${form.type === 'vendor' ? 'active' : ''}`} onClick={() => f('type', 'vendor')}>Vendor</button>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Accounting Identity</div>
                  <div style={{ marginTop: 4, fontSize: 18, fontWeight: 700 }}>{primaryDisplayName}</div>
                  <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-secondary)' }}>
                    {form.type === 'customer' ? 'Receivables and collection-ready master' : 'Payables and vendor settlement-ready master'}
                  </div>
                </div>
              </div>

              <div className="catalogue-modal-insights">
                <div className="catalogue-modal-insight">
                  <span className="catalogue-summary-title">Credit Policy</span>
                  <strong>{formatMoney(form.credit_limit)}</strong>
                  <span className="text-secondary text-sm">Exposure ceiling available to accounting and order review.</span>
                </div>
                <div className="catalogue-modal-insight">
                  <span className="catalogue-summary-title">Payment Terms</span>
                  <strong>{Number(form.payment_terms_days || 0)} days</strong>
                  <span className="text-secondary text-sm">Used to guide invoice and bill due dates.</span>
                </div>
                <div className="catalogue-modal-insight">
                  <span className="catalogue-summary-title">Settlement Rail</span>
                  <strong>{PAYMENT_METHOD_LABELS[form.preferred_payment_method] || 'Not set'}</strong>
                  <span className="text-secondary text-sm">Preferred disbursement or collection mode.</span>
                </div>
                <div className="catalogue-modal-insight">
                  <span className="catalogue-summary-title">Accounting Readiness</span>
                  <strong>{settlementReady ? 'Ready' : hasBankingDetails ? 'Partial' : 'Pending'}</strong>
                  <span className="text-secondary text-sm">Checks banking and identification completeness.</span>
                </div>
              </div>
            </div>

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header">
                <h4>Identity and Communication</h4>
                <span>Operational identity used across CRM, orders, quotations, and party masters.</span>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Contact Name *</label>
                  <input className="form-control" value={form.name} onChange={(e) => f('name', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Company Name</label>
                  <input className="form-control" value={form.company} onChange={(e) => f('company', e.target.value)} />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-control" value={form.phone} onChange={(e) => f('phone', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className="form-control" value={form.email} onChange={(e) => f('email', e.target.value)} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <textarea className="form-control" value={form.address} onChange={(e) => f('address', e.target.value)} rows={2} />
              </div>

              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">City</label>
                  <input className="form-control" value={form.city} onChange={(e) => f('city', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">State</label>
                  <input className="form-control" value={form.state} onChange={(e) => f('state', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Credit Limit</label>
                  <input type="number" min="0" className="form-control" value={form.credit_limit} onChange={(e) => f('credit_limit', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header">
                <h4>Compliance and Commercial Controls</h4>
                <span>Tax identity and settlement policy used during invoicing, billing, and party selection in Accounting.</span>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">GST Number</label>
                  <input className="form-control" value={form.gst_number} onChange={(e) => f('gst_number', e.target.value)} placeholder="15-digit GSTIN" />
                </div>
                <div className="form-group">
                  <label className="form-label">PAN Number</label>
                  <input className="form-control" value={form.pan_number} onChange={(e) => f('pan_number', e.target.value.toUpperCase())} />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Preferred Payment Method</label>
                  <select className="form-control" value={form.preferred_payment_method} onChange={(e) => f('preferred_payment_method', e.target.value)}>
                    {PAYMENT_METHOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Payment Terms (Days)</label>
                  <input type="number" min="0" className="form-control" value={form.payment_terms_days} onChange={(e) => f('payment_terms_days', e.target.value)} />
                </div>
              </div>
            </div>

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header">
                <h4>Banking and Settlement Details</h4>
                <span>Professional ERP banking master inspired by enterprise customer and supplier records used for collections and payouts.</span>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Account Holder Name</label>
                  <input className="form-control" value={form.account_holder_name} onChange={(e) => f('account_holder_name', e.target.value)} placeholder="Beneficiary or account holder" />
                </div>
                <div className="form-group">
                  <label className="form-label">Bank Name</label>
                  <input className="form-control" value={form.bank_name} onChange={(e) => f('bank_name', e.target.value)} placeholder="Name of the bank" />
                </div>
              </div>

              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Branch Name</label>
                  <input className="form-control" value={form.branch_name} onChange={(e) => f('branch_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Type</label>
                  <select className="form-control" value={form.account_type} onChange={(e) => f('account_type', e.target.value)}>
                    {ACCOUNT_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">UPI ID</label>
                  <input className="form-control" value={form.upi_id} onChange={(e) => f('upi_id', e.target.value)} placeholder="name@bank" />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Account Number</label>
                  <input className="form-control" value={form.account_number} onChange={(e) => f('account_number', e.target.value)} placeholder="Bank account number" />
                </div>
                <div className="form-group">
                  <label className="form-label">IFSC Code</label>
                  <input className="form-control" value={form.ifsc_code} onChange={(e) => f('ifsc_code', e.target.value.toUpperCase())} placeholder="Indian bank IFSC" />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">SWIFT Code</label>
                  <input className="form-control" value={form.swift_code} onChange={(e) => f('swift_code', e.target.value.toUpperCase())} placeholder="International SWIFT / BIC" />
                </div>
                <div className="form-group">
                  <label className="form-label">IBAN</label>
                  <input className="form-control" value={form.iban} onChange={(e) => f('iban', e.target.value.toUpperCase())} placeholder="IBAN for international remittance" />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Bank Address</label>
                <textarea className="form-control" value={form.bank_address} onChange={(e) => f('bank_address', e.target.value)} rows={2} placeholder="Branch or bank mailing address" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr', gap: 12 }}>
                <div className="catalogue-summary-card">
                  <span className="catalogue-summary-title">Primary Banking Summary</span>
                  <strong style={{ fontSize: 16 }}>{form.bank_name || 'Bank not set'}</strong>
                  <span className="text-secondary text-sm">{form.account_holder_name || 'Account holder not set'}</span>
                  <span className="text-secondary text-sm">A/c: {maskAccountNumber(form.account_number)}</span>
                </div>
                <div className="catalogue-summary-card">
                  <span className="catalogue-summary-title">Collection or Payout Rail</span>
                  <strong style={{ fontSize: 16 }}>{PAYMENT_METHOD_LABELS[form.preferred_payment_method] || 'Not set'}</strong>
                  <span className="text-secondary text-sm">{form.ifsc_code || form.upi_id || form.swift_code || 'Routing key pending'}</span>
                </div>
                <div className="catalogue-summary-card">
                  <span className="catalogue-summary-title">Accounting Link</span>
                  <strong style={{ fontSize: 16 }}>{Number(form.payment_terms_days || 0)} day terms</strong>
                  <span className="text-secondary text-sm">Will inform due-date guidance in Accounting.</span>
                </div>
              </div>
            </div>

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header">
                <h4>Internal Notes</h4>
                <span>Use this for settlement instructions, relationship notes, or collection remarks.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" value={form.notes} onChange={(e) => f('notes', e.target.value)} rows={3} />
              </div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <Landmark size={18} color="var(--accent)" />
                <div className="text-secondary text-sm">
                  The Accounting module will read this contact&apos;s bank name, account number, IFSC / SWIFT / IBAN, payment method, credit limit, and payment terms when the party is selected for billing or payables.
                </div>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary"><Plus size={14} /> {contact ? 'Update Contact' : 'Add Contact'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await db.all('SELECT * FROM contacts WHERE is_active = 1 ORDER BY name');
    setContacts(data);
    setLoading(false);
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return contacts.filter((c) => {
      const match = !q || [
        c.name,
        c.company,
        c.phone,
        c.email,
        c.city,
        c.state,
        c.gst_number,
        c.pan_number,
        c.bank_name,
        c.account_number,
        c.ifsc_code,
        c.upi_id
      ].some((value) => `${value || ''}`.toLowerCase().includes(q));
      const typeMatch = filterType === 'all' || c.type === filterType;
      return match && typeMatch;
    });
  }, [contacts, filterType, search]);

  const summary = useMemo(() => ({
    customers: contacts.filter((c) => c.type === 'customer').length,
    vendors: contacts.filter((c) => c.type === 'vendor').length,
    accountingReady: contacts.filter((c) => (c.bank_name || c.account_number || c.upi_id) && (c.ifsc_code || c.swift_code || c.iban || c.upi_id)).length,
    withCreditPolicy: contacts.filter((c) => Number(c.credit_limit || 0) > 0 || Number(c.payment_terms_days || 0) > 0).length
  }), [contacts]);

  const deleteContact = async (id) => {
    if (window.confirm('Remove this contact?')) {
      await db.run('UPDATE contacts SET is_active = 0 WHERE id = ?', [id]);
      loadData();
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Contacts</h2>
          <span className="page-subtitle">{summary.customers} customers · {summary.vendors} vendors</span>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={15} /> Add Contact</button>
      </div>

      <div className="catalogue-hero" style={{ marginBottom: 18 }}>
        <div className="catalogue-hero-main">
          <div className="catalogue-hero-kicker">
            <Landmark size={14} />
            <span>Party master and settlement workspace</span>
          </div>
          <h3>Build customer and vendor records that Accounting can trust.</h3>
          <p>
            Professional ERP contacts need commercial identity, tax compliance, banking rails, and settlement policy in one place so collections, payables, and billing stay aligned.
          </p>
          <div className="catalogue-chip-row">
            <span className="catalogue-chip">Banking-ready masters</span>
            <span className="catalogue-chip">Credit and terms governance</span>
            <span className="catalogue-chip">Vendor and customer settlement context</span>
          </div>
        </div>
        <div className="catalogue-hero-side">
          <div className="catalogue-hero-side-label">Accounting-Ready Masters</div>
          <strong>{summary.accountingReady}</strong>
          <span>{summary.withCreditPolicy} contacts already carry credit or payment policy data.</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16, marginBottom: 18 }}>
        <div className="catalogue-summary-card">
          <span className="catalogue-summary-title">Customers</span>
          <strong>{summary.customers}</strong>
        </div>
        <div className="catalogue-summary-card">
          <span className="catalogue-summary-title">Vendors</span>
          <strong>{summary.vendors}</strong>
        </div>
        <div className="catalogue-summary-card">
          <span className="catalogue-summary-title">Banking Ready</span>
          <strong>{summary.accountingReady}</strong>
        </div>
        <div className="catalogue-summary-card">
          <span className="catalogue-summary-title">Commercial Policy Set</span>
          <strong>{summary.withCreditPolicy}</strong>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-bar">
          <Search size={14} color="var(--text-muted)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by party, company, GST, IFSC, account, phone..." />
        </div>
        <div className="tabs">
          {['all', 'customer', 'vendor'].map((t) => (
            <button key={t} className={`tab ${filterType === t ? 'active' : ''}`} onClick={() => setFilterType(t)}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        <span className="text-muted text-sm" style={{ marginLeft: 'auto' }}>{filtered.length} contacts</span>
      </div>

      <div className="page-content" style={{ padding: 0 }}>
        <div className="table-container" style={{ height: '100%' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Party</th>
                <th>Contact</th>
                <th>Location</th>
                <th>Banking</th>
                <th>Terms & Limits</th>
                <th>GST / PAN</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center text-muted" style={{ padding: 40 }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={8}><div className="empty-state"><Users size={40} /><p>No contacts found</p></div></td></tr>
              ) : filtered.map((c) => {
                const bankingReady = (c.bank_name || c.account_number || c.upi_id) && (c.ifsc_code || c.swift_code || c.iban || c.upi_id);
                return (
                  <tr key={c.id} onDoubleClick={() => setModal(c)}>
                    <td>
                      <span className={`badge ${c.type === 'customer' ? 'badge-info' : 'badge-warning'}`}>{c.type}</span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      <div className="text-secondary text-sm" style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
                        <Building2 size={12} />
                        <span>{c.company || 'Individual / Sole party'}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}><Phone size={12} />{c.phone || '-'}</span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-secondary)' }}><Mail size={12} />{c.email || '-'}</span>
                      </div>
                    </td>
                    <td className="text-secondary">
                      <div>{c.city || '-'}</div>
                      <div className="text-sm">{c.state || '-'}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Landmark size={12} color="var(--accent)" />
                          <span>{c.bank_name || 'Bank not set'}</span>
                        </span>
                        <span className="text-secondary text-sm">{maskAccountNumber(c.account_number)}</span>
                        <span className={`badge ${bankingReady ? 'badge-success' : 'badge-secondary'}`} style={{ width: 'fit-content' }}>
                          {bankingReady ? 'Settlement ready' : 'Pending'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CreditCard size={12} color="var(--warning)" />
                          <span>{PAYMENT_METHOD_LABELS[c.preferred_payment_method] || 'Not set'}</span>
                        </span>
                        <span className="text-secondary text-sm">{Number(c.payment_terms_days || 0)} day terms</span>
                        <span className="text-secondary text-sm">{formatMoney(c.credit_limit || 0)} limit</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <span className="font-mono text-sm text-muted">{c.gst_number || '-'}</span>
                        <span className="font-mono text-sm text-muted">{c.pan_number || '-'}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setModal(c)}><Edit2 size={13} /></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteContact(c.id)}><Trash2 size={13} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal !== null && (
        <ContactModal
          contact={modal?.id ? modal : null}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); loadData(); }}
        />
      )}
    </div>
  );
}
