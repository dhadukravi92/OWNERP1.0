import React, { useState, useEffect } from 'react';
import db, { generateId, formatDate, getNextSequence, generateDocNumber } from '../utils/database';
import { Plus, Search, Truck, X, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';

function GRNModal({ onClose, onSave }) {
  const { currentUser } = useAppStore();
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ vendor_id: '', invoice_number: '', invoice_date: '', notes: '' });
  const [items, setItems] = useState([{ id: generateId(), product_id: '', received_qty: 1, unit_price: 0 }]);

  useEffect(() => {
    Promise.all([
      db.all("SELECT * FROM contacts WHERE type='vendor' AND is_active=1 ORDER BY name"),
      db.all("SELECT * FROM products WHERE is_active=1 ORDER BY name")
    ]).then(([v, p]) => { setVendors(v); setProducts(p); });
  }, []);

  const addItem = () => setItems(p => [...p, { id: generateId(), product_id: '', received_qty: 1, unit_price: 0 }]);
  const removeItem = (id) => setItems(p => p.filter(i => i.id !== id));
  const updateItem = (id, field, val) => setItems(p => p.map(i => {
    if (i.id !== id) return i;
    const u = { ...i, [field]: val };
    if (field === 'product_id') {
      const prod = products.find(p => p.id === val);
      if (prod) u.unit_price = prod.cost_price;
    }
    return u;
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validItems = items.filter(i => i.product_id && i.received_qty > 0);
    if (!validItems.length) { alert('Please add at least one item'); return; }
    
    const total = validItems.reduce((s, i) => s + (i.received_qty * i.unit_price), 0);
    const seq = await getNextSequence('grn', 'grn_number', 'GRN');
    const grnId = generateId();
    
    await db.run('INSERT INTO grn (id,grn_number,vendor_id,invoice_number,invoice_date,total_amount,notes,created_by) VALUES (?,?,?,?,?,?,?,?)',
      [grnId, generateDocNumber('GRN', seq), form.vendor_id, form.invoice_number, form.invoice_date, total, form.notes, currentUser?.username]);
    
    for (const item of validItems) {
      await db.run('INSERT INTO grn_items (id,grn_id,product_id,received_qty,unit_price,total) VALUES (?,?,?,?,?,?)',
        [generateId(), grnId, item.product_id, item.received_qty, item.unit_price, item.received_qty * item.unit_price]);
      
      // Update inventory
      const existing = await db.get('SELECT * FROM inventory WHERE product_id=?', [item.product_id]);
      if (existing) {
  await db.run("UPDATE inventory SET quantity = quantity + ?, last_updated = datetime('now') WHERE product_id = ?",[item.received_qty, item.product_id]);
      } else {
        await db.run('INSERT INTO inventory (id,product_id,quantity) VALUES (?,?,?)', [generateId(), item.product_id, item.received_qty]);
      }
      
      // Record transaction
      await db.run('INSERT INTO inventory_transactions (id,product_id,transaction_type,quantity,reference_id,reference_type,created_by) VALUES (?,?,?,?,?,?,?)',
        [generateId(), item.product_id, 'grn', item.received_qty, grnId, 'grn', currentUser?.username]);
      
      // Update cost price
      await db.run('UPDATE products SET cost_price=? WHERE id=?', [item.unit_price, item.product_id]);
    }
    onSave();
  };

  const total = items.reduce((s, i) => s + ((parseFloat(i.received_qty) || 0) * (parseFloat(i.unit_price) || 0)), 0);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <h3>New Goods Receipt Note (GRN)</h3>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Vendor *</label>
                <select className="form-control" value={form.vendor_id} onChange={e => setForm(p => ({ ...p, vendor_id: e.target.value }))} required>
                  <option value="">Select vendor...</option>
                  {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Invoice Number</label>
                <input className="form-control" value={form.invoice_number} onChange={e => setForm(p => ({ ...p, invoice_number: e.target.value }))} />
              </div>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Invoice Date</label>
                <input type="date" className="form-control" value={form.invoice_date} onChange={e => setForm(p => ({ ...p, invoice_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-control" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4>Received Items</h4>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={13} /> Add Item</button>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead style={{ background: 'var(--bg-secondary)' }}>
                    <tr>
                      <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Product</th>
                      <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, width: 100 }}>Qty Received</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, width: 110 }}>Unit Cost</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, width: 110 }}>Total</th>
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => (
                      <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                        <td style={{ padding: '6px 8px' }}>
                          <select className="form-control" style={{ fontSize: 13 }} value={item.product_id} onChange={e => updateItem(item.id, 'product_id', e.target.value)} required>
                            <option value="">Select product...</option>
                            {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                          </select>
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <input type="number" className="form-control" style={{ textAlign: 'center' }} value={item.received_qty} onChange={e => updateItem(item.id, 'received_qty', parseFloat(e.target.value) || 0)} min="0.001" step="0.001" />
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <input type="number" className="form-control" style={{ textAlign: 'right' }} value={item.unit_price} onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)} min="0" />
                        </td>
                        <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                          ₹{((parseFloat(item.received_qty) || 0) * (parseFloat(item.unit_price) || 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                          {items.length > 1 && <button type="button" className="btn btn-danger btn-icon btn-sm" onClick={() => removeItem(item.id)}><Trash2 size={12} /></button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ borderTop: '2px solid var(--border)' }}>
                      <td colSpan={3} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Total GRN Value</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--accent)', fontFamily: 'var(--font-mono)', fontSize: 15 }}>
                        ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div style={{ padding: '10px 12px', background: 'var(--success-dim)', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, marginTop: 8, fontSize: 12, color: 'var(--success)' }}>
                ✓ Stock will be automatically updated and cost prices will be refreshed upon saving.
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save GRN & Update Stock</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Inward() {
  const [grns, setGrns] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await db.all(`SELECT g.*, c.name as vendor_name, COUNT(gi.id) as item_count
      FROM grn g LEFT JOIN contacts c ON g.vendor_id = c.id
      LEFT JOIN grn_items gi ON g.id = gi.grn_id
      GROUP BY g.id ORDER BY g.created_at DESC`);
    setGrns(data);
    setLoading(false);
  };

  const filtered = grns.filter(g => !search || (g.grn_number || '').toLowerCase().includes(search.toLowerCase()) || (g.vendor_name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Inward / GRN</h2>
          <span className="page-subtitle">Goods Receipt Notes</span>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}><Plus size={15} /> New GRN</button>
      </div>
      <div className="filter-bar">
        <div className="search-bar">
          <Search size={14} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search GRN..." />
        </div>
      </div>
      <div className="page-content" style={{ padding: 0 }}>
        <div className="table-container" style={{ height: '100%' }}>
          <table className="data-table">
            <thead>
              <tr><th>GRN Number</th><th>Vendor</th><th>Invoice #</th><th>Invoice Date</th><th>Items</th><th>Total Value</th><th>Received On</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-center text-muted" style={{ padding: 40 }}>Loading...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={7}><div className="empty-state"><Truck size={40} /><p>No GRNs recorded yet</p></div></td></tr>
              : filtered.map(g => (
                <tr key={g.id}>
                  <td><span className="font-mono text-accent">{g.grn_number}</span></td>
                  <td style={{ fontWeight: 500 }}>{g.vendor_name || '-'}</td>
                  <td className="font-mono text-secondary text-sm">{g.invoice_number || '-'}</td>
                  <td className="text-secondary text-sm">{g.invoice_date ? formatDate(g.invoice_date) : '-'}</td>
                  <td><span className="badge badge-secondary">{g.item_count} items</span></td>
                  <td className="font-mono font-semibold">₹{(g.total_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td className="text-secondary text-sm">{formatDate(g.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showModal && <GRNModal onClose={() => setShowModal(false)} onSave={() => { setShowModal(false); loadData(); }} />}
    </div>
  );
}
