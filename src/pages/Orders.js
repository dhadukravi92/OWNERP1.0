import React, { useState, useEffect } from 'react';
import db, { generateId, formatCurrency, formatDate, getNextSequence, generateDocNumber } from '../utils/database';
import { Plus, Search, Edit2, ShoppingCart, X, Trash2 } from 'lucide-react';
import { useAppStore } from '../store/appStore';

const STATUS_OPTIONS = ['pending', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled'];
const STATUS_COLORS = { pending: 'badge-warning', confirmed: 'badge-info', in_production: 'badge-info', ready: 'badge-success', shipped: 'badge-success', delivered: 'badge-success', cancelled: 'badge-danger' };

function OrderModal({ order, onClose, onSave }) {
  const { currentUser } = useAppStore();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ customer_id: '', delivery_date: '', notes: '' });
  const [items, setItems] = useState([{ id: generateId(), product_id: '', description: '', quantity: 1, unit_price: 0 }]);

  useEffect(() => {
    Promise.all([
      db.all("SELECT * FROM contacts WHERE type='customer' AND is_active=1 ORDER BY name"),
      db.all("SELECT * FROM products WHERE is_active=1 ORDER BY name")
    ]).then(([c, p]) => { setCustomers(c); setProducts(p); });
    if (order?.id) {
      setForm({ customer_id: order.customer_id || '', delivery_date: order.delivery_date || '', notes: order.notes || '' });
      db.all('SELECT * FROM order_items WHERE order_id=?', [order.id]).then(setItems);
    }
  }, []);

  const addItem = () => setItems(p => [...p, { id: generateId(), product_id: '', description: '', quantity: 1, unit_price: 0 }]);
  const removeItem = (id) => setItems(p => p.filter(i => i.id !== id));
  const updateItem = (id, field, val) => setItems(p => p.map(i => {
    if (i.id !== id) return i;
    const u = { ...i, [field]: val };
    if (field === 'product_id') {
      const prod = products.find(p => p.id === val);
      if (prod) { u.description = prod.name; u.unit_price = prod.selling_price; }
    }
    return u;
  }));

  const total = items.reduce((s, i) => s + (i.quantity * i.unit_price), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    let orderId = order?.id;
    if (orderId) {
      await db.run('UPDATE orders SET customer_id=?,delivery_date=?,notes=?,total_amount=? WHERE id=?', [form.customer_id, form.delivery_date, form.notes, total, orderId]);
      await db.run('DELETE FROM order_items WHERE order_id=?', [orderId]);
    } else {
      orderId = generateId();
      const seq = await getNextSequence('orders', 'order_number', 'ORD');
      await db.run('INSERT INTO orders (id,order_number,customer_id,delivery_date,notes,total_amount,created_by) VALUES (?,?,?,?,?,?,?)',
        [orderId, generateDocNumber('ORD', seq), form.customer_id, form.delivery_date, form.notes, total, currentUser?.username]);
    }
    for (const item of items) {
      if (item.description || item.product_id) {
        await db.run('INSERT INTO order_items (id,order_id,product_id,description,quantity,unit_price,total) VALUES (?,?,?,?,?,?,?)',
          [generateId(), orderId, item.product_id || null, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price]);
      }
    }
    onSave();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <h3>{order ? 'Edit Order' : 'New Order'}</h3>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Customer *</label>
                <select className="form-control" value={form.customer_id} onChange={e => setForm(p => ({ ...p, customer_id: e.target.value }))} required>
                  <option value="">Select customer...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Expected Delivery</label>
                <input type="date" className="form-control" value={form.delivery_date} onChange={e => setForm(p => ({ ...p, delivery_date: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <input className="form-control" value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h4>Order Items</h4>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}><Plus size={13} /> Add Item</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', fontSize: 13 }}>
                <thead style={{ background: 'var(--bg-secondary)' }}>
                  <tr>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Product</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600 }}>Description</th>
                    <th style={{ padding: '8px 12px', textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, width: 80 }}>Qty</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, width: 110 }}>Unit Price</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', color: 'var(--text-muted)', fontWeight: 600, width: 110 }}>Total</th>
                    <th style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 8px' }}>
                        <select className="form-control" style={{ fontSize: 13 }} value={item.product_id} onChange={e => updateItem(item.id, 'product_id', e.target.value)}>
                          <option value="">Custom</option>
                          {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input className="form-control" value={item.description} onChange={e => updateItem(item.id, 'description', e.target.value)} />
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <input type="number" className="form-control" style={{ textAlign: 'center' }} value={item.quantity} onChange={e => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)} min="1" />
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <input type="number" className="form-control" style={{ textAlign: 'right' }} value={item.unit_price} onChange={e => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)} min="0" />
                      </td>
                      <td style={{ padding: '6px 12px', textAlign: 'right', fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                        ₹{(item.quantity * item.unit_price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                        {items.length > 1 && <button type="button" className="btn btn-danger btn-icon btn-sm" onClick={() => removeItem(item.id)}><Trash2 size={12} /></button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)' }}>
                    <td colSpan={4} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Total</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontSize: 15 }}>
                      ₹{total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Order</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await db.all(`SELECT o.*, c.name as customer_name FROM orders o LEFT JOIN contacts c ON o.customer_id = c.id ORDER BY o.created_at DESC`);
    setOrders(data);
    setLoading(false);
  };

  const updateStatus = async (id, status) => {
    await db.run('UPDATE orders SET status=? WHERE id=?', [status, id]);
    loadData();
  };

  const filtered = orders.filter(o => {
    const q = search.toLowerCase();
    const match = !q || (o.order_number || '').toLowerCase().includes(q) || (o.customer_name || '').toLowerCase().includes(q);
    const sm = filterStatus === 'all' || o.status === filterStatus;
    return match && sm;
  });

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Orders</h2>
          <span className="page-subtitle">{orders.filter(o => ['pending', 'confirmed', 'in_production'].includes(o.status)).length} active orders</span>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({})}><Plus size={15} /> New Order</button>
      </div>

      <div className="filter-bar">
        <div className="search-bar">
          <Search size={14} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders..." />
        </div>
        <select className="form-control" style={{ width: 160 }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">All Status</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
        </select>
        <span className="text-muted text-sm" style={{ marginLeft: 'auto' }}>{filtered.length} orders</span>
      </div>

      <div className="page-content" style={{ padding: 0 }}>
        <div className="table-container" style={{ height: '100%' }}>
          <table className="data-table">
            <thead>
              <tr><th>Order #</th><th>Customer</th><th>Order Date</th><th>Delivery Date</th><th>Amount</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-center text-muted" style={{ padding: 40 }}>Loading...</td></tr>
              : filtered.length === 0 ? <tr><td colSpan={7}><div className="empty-state"><ShoppingCart size={40} /><p>No orders found</p></div></td></tr>
              : filtered.map(o => (
                <tr key={o.id} onDoubleClick={() => setModal(o)}>
                  <td><span className="font-mono text-accent">{o.order_number}</span></td>
                  <td style={{ fontWeight: 500 }}>{o.customer_name || '-'}</td>
                  <td className="text-secondary text-sm">{formatDate(o.order_date)}</td>
                  <td className="text-secondary text-sm">{o.delivery_date ? formatDate(o.delivery_date) : '-'}</td>
                  <td className="font-mono font-semibold">₹{(o.total_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                  <td><span className={`badge ${STATUS_COLORS[o.status] || 'badge-secondary'}`}>{o.status?.replace(/_/g, ' ')}</span></td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setModal(o)}><Edit2 size={13} /></button>
                      <select style={{ fontSize: 11, padding: '3px 6px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-secondary)', cursor: 'pointer' }}
                        value={o.status} onChange={e => updateStatus(o.id, e.target.value)}>
                        {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {modal !== null && <OrderModal order={modal?.id ? modal : null} onClose={() => setModal(null)} onSave={() => { setModal(null); loadData(); }} />}
    </div>
  );
}
