// BOM.js - Bill of Materials
import React, { useState, useEffect } from 'react';
import db, { generateId, formatCurrency } from '../utils/database';
import { Plus, Search, Edit2, Trash2, Layers, X } from 'lucide-react';

function BOMModal({ bom, onClose, onSave }) {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(bom || { name: '', product_id: '', version: '1.0', description: '' });
  const [items, setItems] = useState([]);

  useEffect(() => {
    db.all('SELECT * FROM products WHERE is_active=1 ORDER BY name').then(setProducts);
    if (bom?.id) db.all('SELECT bi.*, p.name as material_name, p.unit FROM bom_items bi JOIN products p ON bi.material_id = p.id WHERE bi.bom_id = ?', [bom.id]).then(setItems);
  }, []);

  const addItem = () => setItems(p => [...p, { id: generateId(), material_id: '', quantity: 1, unit: 'PCS', notes: '' }]);
  const removeItem = (id) => setItems(p => p.filter(i => i.id !== id));
  const updateItem = (id, field, val) => setItems(p => p.map(i => {
    if (i.id !== id) return i;
    const updated = { ...i, [field]: val };
    if (field === 'material_id') {
      const prod = products.find(p => p.id === val);
      if (prod) updated.unit = prod.unit;
    }
    return updated;
  }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    let bomId = bom?.id;
    if (bomId) {
      await db.run('UPDATE bom SET name=?,product_id=?,version=?,description=? WHERE id=?', [form.name, form.product_id, form.version, form.description, bomId]);
      await db.run('DELETE FROM bom_items WHERE bom_id=?', [bomId]);
    } else {
      bomId = generateId();
      await db.run('INSERT INTO bom (id,name,product_id,version,description) VALUES (?,?,?,?,?)', [bomId, form.name, form.product_id, form.version, form.description]);
    }
    for (const item of items) {
      if (item.material_id) await db.run('INSERT INTO bom_items (id,bom_id,material_id,quantity,unit,notes) VALUES (?,?,?,?,?,?)', [generateId(), bomId, item.material_id, item.quantity, item.unit, item.notes]);
    }
    onSave();
  };

  const calcCost = async () => {
    let total = 0;
    for (const item of items) {
      if (item.material_id) {
        const prod = await db.get('SELECT cost_price FROM products WHERE id=?', [item.material_id]);
        if (prod) total += prod.cost_price * item.quantity;
      }
    }
    alert(`Estimated BOM Cost: ₹${total.toFixed(2)}`);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <h3>{bom ? 'Edit BOM' : 'Create Bill of Materials'}</h3>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">BOM Name *</label>
                <input className="form-control" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required placeholder="e.g. Distribution Panel 63A" />
              </div>
              <div className="form-group">
                <label className="form-label">Finished Product</label>
                <select className="form-control" value={form.product_id} onChange={e => setForm(p => ({ ...p, product_id: e.target.value }))}>
                  <option value="">Select product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Version</label>
                <input className="form-control" value={form.version} onChange={e => setForm(p => ({ ...p, version: e.target.value }))} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4>Materials / Components</h4>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={calcCost}>Estimate Cost</button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={13} /> Add Material</button>
                </div>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', fontSize: 13 }}>
                <thead style={{ background: 'var(--bg-secondary)' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Material</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, width: 80 }}>Qty</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, width: 80 }}>Unit</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Notes</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 8px' }}>
                        <select className="form-control" style={{ fontSize: 13 }} value={item.material_id} onChange={e => updateItem(item.id, 'material_id', e.target.value)}>
                          <option value="">Select material...</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.code})</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <input type="number" className="form-control" style={{ textAlign: 'center' }} value={item.quantity} onChange={e => updateItem(item.id, 'quantity', e.target.value)} min="0.001" step="0.001" />
                      </td>
                      <td style={{ padding: '6px 4px', color: 'var(--text-secondary)', textAlign: 'center' }}>{item.unit || '-'}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <input className="form-control" style={{ fontSize: 13 }} value={item.notes} onChange={e => updateItem(item.id, 'notes', e.target.value)} placeholder="Optional notes" />
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        <button type="button" className="btn btn-danger btn-icon btn-sm" onClick={() => removeItem(item.id)}><Trash2 size={12} /></button>
                      </td>
                    </tr>
                  ))}
                  {items.length === 0 && (
                    <tr><td colSpan={5} className="text-center text-muted" style={{ padding: 24 }}>No materials added. Click "Add Material" to start.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-control" value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save BOM</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BOM() {
  const [boms, setBoms] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await db.all(`SELECT b.*, p.name as product_name, COUNT(bi.id) as item_count
      FROM bom b LEFT JOIN products p ON b.product_id = p.id
      LEFT JOIN bom_items bi ON b.id = bi.bom_id
      WHERE b.is_active = 1 GROUP BY b.id ORDER BY b.name`);
    setBoms(data);
    setLoading(false);
  };

  const filtered = boms.filter(b => !search || b.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Bill of Materials</h2>
          <span className="page-subtitle">{boms.length} BOMs defined</span>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={15} /> Create BOM</button>
      </div>
      <div className="filter-bar">
        <div className="search-bar">
          <Search size={14} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search BOMs..." />
        </div>
      </div>
      <div className="page-content" style={{ padding: 0 }}>
        <div className="table-container" style={{ height: '100%' }}>
          <table className="data-table">
            <thead>
              <tr><th>BOM Name</th><th>Product</th><th>Version</th><th>Components</th><th>Description</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 40 }}>Loading...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={6}><div className="empty-state"><Layers size={40} /><p>No BOMs created yet</p></div></td></tr>
              : filtered.map(b => (
                <tr key={b.id} onDoubleClick={() => setModal(b)}>
                  <td style={{ fontWeight: 500 }}>{b.name}</td>
                  <td className="text-secondary">{b.product_name || '-'}</td>
                  <td><span className="badge badge-info">v{b.version}</span></td>
                  <td><span className="badge badge-secondary">{b.item_count} items</span></td>
                  <td className="text-secondary text-sm">{b.description?.substring(0, 50) || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setModal(b)}><Edit2 size={13} /></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={async () => { if (window.confirm('Delete BOM?')) { await db.run('UPDATE bom SET is_active=0 WHERE id=?', [b.id]); loadData(); } }}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal !== null && <BOMModal bom={modal?.id ? modal : null} onClose={() => setModal(null)} onSave={() => { setModal(null); loadData(); }} />}
    </div>
  );
}
