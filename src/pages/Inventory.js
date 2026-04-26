import React, { useState, useEffect } from 'react';
import db, { generateId, formatDate } from '../utils/database';
import { Search, Plus, ArrowDownCircle, ArrowUpCircle, History, Filter, Warehouse } from 'lucide-react';

function AdjustModal({ item, type, onClose, onSave }) {
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const { currentUser } = require('../store/appStore').useAppStore.getState();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const quantity = parseFloat(qty);
    if (!quantity || quantity <= 0) return;
    
    const currentQty = item.quantity || 0;
    const newQty = type === 'in' ? currentQty + quantity : Math.max(0, currentQty - quantity);
    
    await db.run(
  "UPDATE inventory SET quantity = ?, last_updated = datetime('now') WHERE product_id = ?",  [newQty, item.product_id]);
    await db.run(
      'INSERT INTO inventory_transactions (id, product_id, transaction_type, quantity, notes, created_by) VALUES (?,?,?,?,?,?)',
      [generateId(), item.product_id, type === 'in' ? 'manual_in' : 'manual_out', quantity, notes, currentUser?.username]
    );
    onSave();
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {type === 'in'
              ? <ArrowDownCircle size={20} color="var(--success)" />
              : <ArrowUpCircle size={20} color="var(--danger)" />
            }
            <h3>{type === 'in' ? 'Stock In' : 'Stock Out'}</h3>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: 8, marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 600 }}>{item.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Current stock: <strong style={{ color: 'var(--accent)' }}>{item.quantity} {item.unit}</strong></div>
            </div>
            <div className="form-group">
              <label className="form-label">Quantity *</label>
              <input type="number" className="form-control" value={qty} onChange={e => setQty(e.target.value)} required min="0.01" step="0.01" placeholder={`Enter quantity in ${item.unit}`} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea className="form-control" value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Reason for adjustment..." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className={`btn ${type === 'in' ? 'btn-success' : 'btn-danger'}`}>
              {type === 'in' ? 'Add Stock' : 'Remove Stock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const inv = await db.all(`
      SELECT i.*, p.name, p.code, p.min_stock, p.unit, p.selling_price, p.cost_price, c.name as category_name
      FROM inventory i 
      JOIN products p ON i.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_active = 1
      ORDER BY p.name
    `);
    setInventory(inv);
    setLoading(false);
  };

  const loadHistory = async () => {
    const txns = await db.all(`
      SELECT t.*, p.name as product_name, p.unit
      FROM inventory_transactions t JOIN products p ON t.product_id = p.id
      ORDER BY t.created_at DESC LIMIT 100
    `);
    setTransactions(txns);
    setShowHistory(true);
  };

  const getStockStatus = (item) => {
    if (item.quantity === 0) return { label: 'Out of Stock', cls: 'badge-danger' };
    if (item.quantity <= item.min_stock) return { label: 'Low Stock', cls: 'badge-warning' };
    return { label: 'In Stock', cls: 'badge-success' };
  };

  const filtered = inventory.filter(i => {
    const q = search.toLowerCase();
    const match = !q || i.name.toLowerCase().includes(q) || (i.code || '').toLowerCase().includes(q);
    const status = getStockStatus(i);
    const statusMatch = filterStatus === 'all' || 
      (filterStatus === 'low' && (i.quantity <= i.min_stock && i.quantity > 0)) ||
      (filterStatus === 'out' && i.quantity === 0) ||
      (filterStatus === 'ok' && i.quantity > i.min_stock);
    return match && statusMatch;
  });

  const stats = {
    total: inventory.length,
    low: inventory.filter(i => i.quantity <= i.min_stock && i.quantity > 0).length,
    out: inventory.filter(i => i.quantity === 0).length,
    value: inventory.reduce((s, i) => s + (i.quantity * i.cost_price), 0)
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Inventory Management</h2>
          <span className="page-subtitle">Real-time stock tracking</span>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={loadHistory}><History size={14} /> History</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '0 24px 16px' }}>
        {[
          { label: 'Total Items', value: stats.total, color: 'var(--accent)' },
          { label: 'Low Stock', value: stats.low, color: 'var(--warning)' },
          { label: 'Out of Stock', value: stats.out, color: 'var(--danger)' },
          { label: 'Stock Value', value: `₹${(stats.value / 1000).toFixed(1)}K`, color: 'var(--success)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div className="filter-bar">
        <div className="search-bar">
          <Search size={14} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." />
        </div>
        <div className="tabs">
          {['all', 'ok', 'low', 'out'].map(s => (
            <button key={s} className={`tab ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)}>
              {s === 'all' ? 'All' : s === 'ok' ? 'In Stock' : s === 'low' ? 'Low Stock' : 'Out of Stock'}
            </button>
          ))}
        </div>
      </div>

      <div className="page-content" style={{ padding: 0 }}>
        <div className="table-container" style={{ height: '100%' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Product</th>
                <th>Category</th>
                <th>Current Stock</th>
                <th>Min. Level</th>
                <th>Stock Value</th>
                <th>Status</th>
                <th>Last Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center text-muted" style={{ padding: 40 }}>Loading...</td></tr>
              ) : filtered.map(item => {
                const status = getStockStatus(item);
                return (
                  <tr key={item.product_id}>
                    <td><span className="font-mono text-sm text-secondary">{item.code}</span></td>
                    <td><span style={{ fontWeight: 500 }}>{item.name}</span></td>
                    <td><span className="badge badge-secondary">{item.category_name || '-'}</span></td>
                    <td>
                      <span style={{
                        fontWeight: 700, fontSize: 15,
                        color: item.quantity === 0 ? 'var(--danger)' : item.quantity <= item.min_stock ? 'var(--warning)' : 'var(--success)'
                      }}>
                        {item.quantity}
                      </span>
                      <span className="text-muted text-sm"> {item.unit}</span>
                    </td>
                    <td className="text-secondary">{item.min_stock} {item.unit}</td>
                    <td className="font-mono text-sm">₹{(item.quantity * item.cost_price).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    <td><span className={`badge ${status.cls}`}>{status.label}</span></td>
                    <td className="text-secondary text-sm">{formatDate(item.last_updated)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-success btn-sm btn-icon" onClick={() => setModal({ item, type: 'in' })} title="Stock In">
                          <ArrowDownCircle size={14} />
                        </button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => setModal({ item, type: 'out' })} title="Stock Out" disabled={item.quantity === 0}>
                          <ArrowUpCircle size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <AdjustModal
          item={modal.item}
          type={modal.type}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); loadData(); }}
        />
      )}

      {showHistory && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowHistory(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>Stock Transaction History</h3>
              <button className="close-btn" onClick={() => setShowHistory(false)}><X size={16} /></button>
            </div>
            <div style={{ maxHeight: 500, overflowY: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr><th>Date</th><th>Product</th><th>Type</th><th>Quantity</th><th>Notes</th><th>By</th></tr>
                </thead>
                <tbody>
                  {transactions.map(t => (
                    <tr key={t.id}>
                      <td className="text-sm text-secondary">{formatDate(t.created_at)}</td>
                      <td>{t.product_name}</td>
                      <td>
                        <span className={`badge ${t.transaction_type.includes('in') ? 'badge-success' : 'badge-danger'}`}>
                          {t.transaction_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="font-mono">{t.quantity} {t.unit}</td>
                      <td className="text-secondary text-sm">{t.notes || '-'}</td>
                      <td className="text-secondary text-sm">{t.created_by || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Fix missing X import
const { X } = require('lucide-react');
