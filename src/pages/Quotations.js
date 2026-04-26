import React, { useState, useEffect } from 'react';
import db, { generateId, formatCurrency, formatDate, getNextSequence, generateDocNumber } from '../utils/database';
import { Plus, Search, Edit2, Copy, FileText, Printer, X, Trash2 } from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';
import { useAppStore } from '../store/appStore';

function QuotationModal({ quotation, onClose, onSave }) {
  const { currentUser, settings } = useAppStore();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    customer_id: '',
    valid_till: '',
    discount_percent: 0,
    subject: '',
    mail_draft: '',
    notes: '',
    terms: ''
  });
  const [items, setItems] = useState([{ id: generateId(), product_id: '', description: '', quantity: 1, unit_price: 0, tax_rate: 18, discount_percent: 0 }]);

  useEffect(() => {
    loadLookups();
    if (quotation?.id) loadQuotation();
  }, []);

  const loadLookups = async () => {
    const [custs, prods] = await Promise.all([
      db.all("SELECT * FROM contacts WHERE type='customer' AND is_active=1 ORDER BY name"),
      db.all("SELECT * FROM products WHERE is_active=1 ORDER BY name")
    ]);
    setCustomers(custs);
    setProducts(prods);
  };

  const loadQuotation = async () => {
    setForm({
      customer_id: quotation.customer_id,
      valid_till: quotation.valid_till,
      discount_percent: quotation.discount_percent,
      subject: quotation.subject || '',
      mail_draft: quotation.mail_draft || '',
      notes: quotation.notes || '',
      terms: quotation.terms || ''
    });
    const qItems = await db.all('SELECT * FROM quotation_items WHERE quotation_id = ? ORDER BY sort_order', [quotation.id]);
    if (qItems.length) setItems(qItems);
  };

  const calcTotals = () => {
    let subtotal = 0, taxTotal = 0;
    items.forEach(item => {
      const lineTotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
      const tax = lineTotal * (item.tax_rate || 0) / 100;
      subtotal += lineTotal;
      taxTotal += tax;
    });
    const discount = subtotal * (form.discount_percent || 0) / 100;
    return { subtotal, discount, taxTotal, total: subtotal - discount + taxTotal };
  };

  const addItem = () => setItems(p => [...p, { id: generateId(), product_id: '', description: '', quantity: 1, unit_price: 0, tax_rate: 18, discount_percent: 0 }]);
  const removeItem = (id) => setItems(p => p.filter(i => i.id !== id));
  const updateItem = (id, field, val) => setItems(p => p.map(i => {
    if (i.id !== id) return i;
    const updated = { ...i, [field]: val };
    if (field === 'product_id') {
      const prod = products.find(p => p.id === val);
      if (prod) { updated.description = prod.name; updated.unit_price = prod.selling_price; updated.tax_rate = prod.gst_rate; }
    }
    return updated;
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const totals = calcTotals();
    
    if (quotation?.id) {
      await db.run(`UPDATE quotations SET customer_id=?,valid_till=?,discount_percent=?,tax_amount=?,total_amount=?,subject=?,mail_draft=?,notes=?,terms=?,updated_at=datetime('now') WHERE id=?`,
        [form.customer_id, form.valid_till, form.discount_percent, totals.taxTotal, totals.total, form.subject, form.mail_draft, form.notes, form.terms, quotation.id]);
      await db.run('DELETE FROM quotation_items WHERE quotation_id = ?', [quotation.id]);
    } else {
      const seq = await getNextSequence('quotations', 'quotation_number', 'QT');
      const qId = generateId();
      const qNum = generateDocNumber('QT', seq);
      await db.run(`INSERT INTO quotations (id,quotation_number,customer_id,status,valid_till,discount_percent,tax_amount,total_amount,subject,mail_draft,notes,terms,created_by)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [qId, qNum, form.customer_id, 'draft', form.valid_till, form.discount_percent, totals.taxTotal, totals.total, form.subject, form.mail_draft, form.notes, form.terms, currentUser?.username]);
      quotation = { id: qId };
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const lineTotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
      await db.run(`INSERT INTO quotation_items (id,quotation_id,product_id,description,quantity,unit_price,discount_percent,tax_rate,total,sort_order)
        VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [generateId(), quotation.id, item.product_id || null, item.description, item.quantity, item.unit_price, item.discount_percent || 0, item.tax_rate || 0, lineTotal, i]);
    }
    onSave();
  };

  const totals = calcTotals();
  const sym = settings?.currency_symbol || '₹';
  const customerOptions = customers.map(c => ({ value: c.id, label: `${c.name}${c.company ? ` (${c.company})` : ''}` }));
  const productOptions = products.map(p => ({ value: p.id, label: p.name }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <h3>{quotation?.id ? 'Edit Quotation' : 'New Quotation'}</h3>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Customer</label>
                <SearchableSelect
                  value={form.customer_id}
                  onChange={nextValue => setForm(p => ({ ...p, customer_id: nextValue }))}
                  options={customerOptions}
                  placeholder="Write customer name..."
                  clearable
                />
              </div>
              <div className="form-group">
                <label className="form-label">Valid Till</label>
                <input type="date" className="form-control" value={form.valid_till} onChange={e => setForm(p => ({ ...p, valid_till: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Overall Discount (%)</label>
                <input type="number" className="form-control" value={form.discount_percent} onChange={e => setForm(p => ({ ...p, discount_percent: e.target.value }))} min="0" max="100" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Subject</label>
              <input
                className="form-control"
                value={form.subject}
                onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
                placeholder="Example: Quotation for ACDB LT Panel"
              />
            </div>

            <div className="form-group">
              <label className="form-label">General Mail Draft</label>
              <textarea
                className="form-control"
                value={form.mail_draft}
                onChange={e => setForm(p => ({ ...p, mail_draft: e.target.value }))}
                rows={5}
                placeholder={'Dear Sir/Madam,\n\nPlease find our quotation attached for your review.\n\nThanks & Regards,'}
              />
            </div>

            {/* Line items */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4>Line Items</h4>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={13} /> Add Row</button>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Product</th>
                      <th style={{ padding: '8px 10px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Description</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, width: 70 }}>Qty</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, width: 100 }}>Unit Price</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, width: 60 }}>Disc%</th>
                      <th style={{ padding: '8px 10px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, width: 60 }}>GST%</th>
                      <th style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, width: 100 }}>Total</th>
                      <th style={{ width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, idx) => {
                      const lineTotal = item.quantity * item.unit_price * (1 - (item.discount_percent || 0) / 100);
                      return (
                        <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                          <td style={{ padding: '6px 8px' }}>
                            <SearchableSelect
                              value={item.product_id}
                              onChange={nextValue => updateItem(item.id, 'product_id', nextValue)}
                              options={productOptions}
                              placeholder="Write product name..."
                              clearable
                            />
                          </td>
                          <td style={{ padding: '6px 8px' }}>
                            <input className="form-control" style={{ fontSize: 12 }} value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} placeholder="Item description" />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input type="number" className="form-control" style={{ fontSize: 12, textAlign: 'center' }} value={item.quantity} onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} min="0" />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input type="number" className="form-control" style={{ fontSize: 12, textAlign: 'right' }} value={item.unit_price} onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)} min="0" />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input type="number" className="form-control" style={{ fontSize: 12, textAlign: 'center' }} value={item.discount_percent} onChange={e => updateItem(item.id, 'discount_percent', parseFloat(e.target.value) || 0)} min="0" max="100" />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input type="number" className="form-control" style={{ fontSize: 12, textAlign: 'center' }} value={item.tax_rate} onChange={e => updateItem(item.id, 'tax_rate', parseFloat(e.target.value) || 0)} min="0" />
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 600, fontSize: 13, fontFamily: 'var(--font-mono)' }}>
                            {sym}{lineTotal.toFixed(2)}
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            {items.length > 1 && (
                              <button type="button" className="btn btn-danger btn-icon btn-sm" onClick={() => removeItem(item.id)}>
                                <Trash2 size={12} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <div style={{ width: 280, background: 'var(--bg-secondary)', borderRadius: 8, padding: 16, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="text-secondary">Subtotal</span>
                  <span className="font-mono">{formatCurrency(totals.subtotal, sym)}</span>
                </div>
                {totals.discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
                    <span>Discount ({form.discount_percent}%)</span>
                    <span className="font-mono">-{formatCurrency(totals.discount, sym)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                  <span>GST</span>
                  <span className="font-mono">{formatCurrency(totals.taxTotal, sym)}</span>
                </div>
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 16 }}>
                  <span>Total</span>
                  <span className="font-mono" style={{ color: 'var(--accent)' }}>{formatCurrency(totals.total, sym)}</span>
                </div>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2} />
              </div>
              <div className="form-group">
                <label className="form-label">Terms & Conditions</label>
                <textarea className="form-control" value={form.terms} onChange={e => setForm(p => ({ ...p, terms: e.target.value }))} rows={2} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Quotation</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Quotations() {
  const [quotations, setQuotations] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await db.all(`SELECT q.*, c.name as customer_name 
      FROM quotations q LEFT JOIN contacts c ON q.customer_id = c.id 
      ORDER BY q.created_at DESC`);
    setQuotations(data);
    setLoading(false);
  };

  const updateStatus = async (id, status) => {
    await db.run("UPDATE quotations SET status=? WHERE id=?", [status, id]);
    loadData();
  };

  const filtered = quotations.filter(q => {
    const s = search.toLowerCase();
    return !s || (q.quotation_number || '').toLowerCase().includes(s) || (q.customer_name || '').toLowerCase().includes(s);
  });

  const getStatusBadge = (status) => {
    const m = { draft: 'badge-secondary', sent: 'badge-info', approved: 'badge-success', rejected: 'badge-danger', expired: 'badge-warning' };
    return <span className={`badge ${m[status] || 'badge-secondary'}`}>{status}</span>;
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Quotations</h2>
          <span className="page-subtitle">{quotations.length} quotations total</span>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={15} /> New Quotation</button>
      </div>

      <div className="filter-bar">
        <div className="search-bar">
          <Search size={14} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search quotations..." />
        </div>
        <span className="text-muted text-sm" style={{ marginLeft: 'auto' }}>{filtered.length} results</span>
      </div>

      <div className="page-content" style={{ padding: 0 }}>
        <div className="table-container" style={{ height: '100%' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Quotation #</th>
                <th>Customer</th>
                <th>Date</th>
                <th>Valid Till</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center text-muted" style={{ padding: 40 }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><FileText size={40} /><p>No quotations yet</p></div></td></tr>
              ) : filtered.map(q => (
                <tr key={q.id}>
                  <td><span className="font-mono text-accent">{q.quotation_number}</span></td>
                  <td style={{ fontWeight: 500 }}>{q.customer_name || 'No customer'}</td>
                  <td className="text-secondary">{formatDate(q.created_at)}</td>
                  <td className="text-secondary">{q.valid_till ? formatDate(q.valid_till) : '-'}</td>
                  <td className="font-mono font-semibold">₹{(q.total_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td>{getStatusBadge(q.status)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setModal(q)} title="Edit"><Edit2 size={13} /></button>
                      {q.status === 'draft' && (
                        <button className="btn btn-info btn-icon btn-sm" onClick={() => updateStatus(q.id, 'sent')} title="Mark Sent" style={{ background: 'var(--info-dim)', color: 'var(--info)', border: '1px solid rgba(6,182,212,0.2)' }}>
                          <Printer size={13} />
                        </button>
                      )}
                      {q.status === 'sent' && (
                        <button className="btn btn-success btn-icon btn-sm" onClick={() => updateStatus(q.id, 'approved')} title="Approve">
                          ✓
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal !== null && (
        <QuotationModal
          quotation={modal?.id ? modal : null}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); loadData(); }}
        />
      )}
    </div>
  );
}
