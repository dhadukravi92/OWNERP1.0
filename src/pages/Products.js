import React, { useState, useEffect } from 'react';
import db, { generateId, formatCurrency } from '../utils/database';
import { Plus, Search, Edit2, Trash2, Package, X, Filter } from 'lucide-react';
import { useAppStore } from '../store/appStore';

function ProductModal({ product, categories, onClose, onSave }) {
  const [form, setForm] = useState(product || {
    name: '', code: '', category_id: '', description: '',
    unit: 'PCS', hsn_code: '', gst_rate: 18,
    selling_price: 0, cost_price: 0, min_stock: 0, specifications: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (product?.id) {
      await db.run(`UPDATE products SET name=?,code=?,category_id=?,description=?,unit=?,hsn_code=?,
        gst_rate=?,selling_price=?,cost_price=?,min_stock=?,specifications=? WHERE id=?`,
        [form.name, form.code, form.category_id, form.description, form.unit, form.hsn_code,
         form.gst_rate, form.selling_price, form.cost_price, form.min_stock, form.specifications, product.id]);
    } else {
      const id = generateId();
      await db.run(`INSERT INTO products (id,name,code,category_id,description,unit,hsn_code,gst_rate,selling_price,cost_price,min_stock,specifications)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, form.name, form.code, form.category_id, form.description, form.unit, form.hsn_code,
         form.gst_rate, form.selling_price, form.cost_price, form.min_stock, form.specifications]);
      await db.run('INSERT INTO inventory (id, product_id, quantity) VALUES (?,?,0)', [generateId(), id]);
    }
    onSave();
  };

  const f = (field, val) => setForm(p => ({ ...p, [field]: val }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>{product ? 'Edit Product' : 'Add New Product'}</h3>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Product Name *</label>
                <input className="form-control" value={form.name} onChange={e => f('name', e.target.value)} required placeholder="e.g. MCB 16A Single Pole" />
              </div>
              <div className="form-group">
                <label className="form-label">Product Code</label>
                <input className="form-control" value={form.code} onChange={e => f('code', e.target.value)} placeholder="e.g. MCB-16A-SP" />
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="form-control" value={form.category_id} onChange={e => f('category_id', e.target.value)}>
                  <option value="">Select Category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Unit</label>
                <select className="form-control" value={form.unit} onChange={e => f('unit', e.target.value)}>
                  {['PCS', 'MTR', 'KG', 'SET', 'ROLL', 'BOX', 'LTR'].map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div className="grid-3">
              <div className="form-group">
                <label className="form-label">Cost Price (₹)</label>
                <input type="number" className="form-control" value={form.cost_price} onChange={e => f('cost_price', e.target.value)} min="0" step="0.01" />
              </div>
              <div className="form-group">
                <label className="form-label">Selling Price (₹)</label>
                <input type="number" className="form-control" value={form.selling_price} onChange={e => f('selling_price', e.target.value)} min="0" step="0.01" />
              </div>
              <div className="form-group">
                <label className="form-label">GST Rate (%)</label>
                <select className="form-control" value={form.gst_rate} onChange={e => f('gst_rate', e.target.value)}>
                  {[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">HSN Code</label>
                <input className="form-control" value={form.hsn_code} onChange={e => f('hsn_code', e.target.value)} placeholder="HSN/SAC code" />
              </div>
              <div className="form-group">
                <label className="form-label">Min. Stock Level</label>
                <input type="number" className="form-control" value={form.min_stock} onChange={e => f('min_stock', e.target.value)} min="0" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="form-control" value={form.description} onChange={e => f('description', e.target.value)} rows={2} />
            </div>

            <div className="form-group">
              <label className="form-label">Technical Specifications</label>
              <textarea className="form-control" value={form.specifications} onChange={e => f('specifications', e.target.value)} rows={3} placeholder="Voltage, Current rating, Standards compliance, etc." />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary"><Plus size={14} /> {product ? 'Update' : 'Add Product'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Products() {
  const { settings } = useAppStore();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [prods, cats] = await Promise.all([
      db.all(`SELECT p.*, c.name as category_name, COALESCE(i.quantity, 0) as stock 
        FROM products p LEFT JOIN categories c ON p.category_id = c.id
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE p.is_active = 1 ORDER BY p.name`),
      db.all('SELECT * FROM categories ORDER BY name')
    ]);
    setProducts(prods);
    setCategories(cats);
    setLoading(false);
  };

  const filtered = products.filter(p => {
    const q = search.toLowerCase();
    const match = !q || p.name.toLowerCase().includes(q) || (p.code || '').toLowerCase().includes(q);
    const catMatch = !filterCat || p.category_id === filterCat;
    return match && catMatch;
  });

  const deleteProduct = async (id) => {
    if (window.confirm('Mark this product as inactive?')) {
      await db.run('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
      loadData();
    }
  };

  const sym = settings?.currency_symbol || '₹';

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Product Catalogue</h2>
          <span className="page-subtitle">{products.length} products in catalogue</span>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setModal({})}>
            <Plus size={15} /> Add Product
          </button>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-bar">
          <Search size={14} color="var(--text-muted)" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." />
        </div>
        <Filter size={14} color="var(--text-muted)" />
        <select className="form-control" style={{ width: 180 }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span className="text-muted text-sm" style={{ marginLeft: 'auto' }}>{filtered.length} results</span>
      </div>

      <div className="page-content" style={{ padding: 0 }}>
        <div className="table-container" style={{ height: '100%' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Product Name</th>
                <th>Category</th>
                <th>Unit</th>
                <th>Cost</th>
                <th>Selling</th>
                <th>GST</th>
                <th>Stock</th>
                <th>Min Stock</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} className="text-center text-muted" style={{ padding: 40 }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={10}>
                  <div className="empty-state"><Package size={40} /><p>No products found</p></div>
                </td></tr>
              ) : filtered.map(p => (
                <tr key={p.id} onDoubleClick={() => setModal(p)}>
                  <td><span className="font-mono text-sm text-accent">{p.code || '-'}</span></td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{p.name}</div>
                    {p.description && <div className="text-xs text-muted">{p.description.substring(0, 50)}</div>}
                  </td>
                  <td><span className="badge badge-secondary">{p.category_name || 'Uncategorized'}</span></td>
                  <td className="text-secondary">{p.unit}</td>
                  <td className="font-mono">{formatCurrency(p.cost_price, sym)}</td>
                  <td className="font-mono font-semibold">{formatCurrency(p.selling_price, sym)}</td>
                  <td className="text-secondary">{p.gst_rate}%</td>
                  <td>
                    <span style={{ color: p.stock <= p.min_stock ? 'var(--warning)' : 'var(--success)', fontWeight: 600 }}>
                      {p.stock} {p.unit}
                    </span>
                  </td>
                  <td className="text-secondary">{p.min_stock}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setModal(p)} title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteProduct(p.id)} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal !== null && (
        <ProductModal
          product={modal?.id ? modal : null}
          categories={categories}
          onClose={() => setModal(null)}
          onSave={() => { setModal(null); loadData(); }}
        />
      )}
    </div>
  );
}
