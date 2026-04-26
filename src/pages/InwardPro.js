import React, { useEffect, useState } from 'react';
import db, { formatCurrency, formatDate, generateDocNumber, generateId, getNextSequence } from '../utils/database';
import {
  AlertTriangle,
  BadgeIndianRupee,
  Boxes,
  CheckCircle2,
  Package,
  Plus,
  Search,
  Sparkles,
  Truck,
  X
} from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';
import { useAppStore } from '../store/appStore';

const DEFAULT_CURRENCY = '\u20B9';

function GRNModal({ currencySymbol, onClose, onSave }) {
  const { currentUser } = useAppStore();
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ vendor_id: '', invoice_number: '', invoice_date: '', notes: '' });
  const [items, setItems] = useState([{ id: generateId(), product_id: '', received_qty: 1, unit_price: 0 }]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function loadData() {
      const [vendorRows, productRows] = await Promise.all([
        db.all("SELECT * FROM contacts WHERE type='vendor' AND is_active=1 ORDER BY name"),
        db.all(`SELECT p.*, COALESCE(i.quantity, 0) as stock
          FROM products p
          LEFT JOIN inventory i ON i.product_id = p.id
          WHERE p.is_active=1
          ORDER BY p.name`)
      ]);

      if (!active) return;
      setVendors(vendorRows);
      setProducts(productRows);
    }
    loadData();
    return () => {
      active = false;
    };
  }, []);

  const addItem = () => {
    setItems((prev) => [...prev, { id: generateId(), product_id: '', received_qty: 1, unit_price: 0 }]);
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === 'product_id') {
          const product = products.find((entry) => entry.id === value);
          if (product) {
            updated.unit_price = Number(product.cost_price) || 0;
            updated.stock = Number(product.stock) || 0;
            updated.product_name = product.name;
            updated.product_code = product.code;
          }
        }
        return updated;
      })
    );
  };

  const vendor = vendors.find((entry) => entry.id === form.vendor_id);
  const vendorOptions = vendors.map((entry) => ({ value: entry.id, label: entry.name }));
  const productOptions = products.map((product) => ({
    value: product.id,
    label: `${product.name}${product.code ? ` (${product.code})` : ''}`
  }));
  const validItems = items.filter((item) => item.product_id && Number(item.received_qty) > 0);
  const total = validItems.reduce(
    (sum, item) => sum + ((Number(item.received_qty) || 0) * (Number(item.unit_price) || 0)),
    0
  );
  const quantityTotal = validItems.reduce((sum, item) => sum + (Number(item.received_qty) || 0), 0);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.vendor_id) {
      setError('Select a vendor before saving the GRN.');
      return;
    }

    if (!validItems.length) {
      setError('Add at least one received product.');
      return;
    }

    setError('');

    const seq = await getNextSequence('grn', 'grn_number', 'GRN');
    const grnId = generateId();

    await db.run(
      'INSERT INTO grn (id,grn_number,vendor_id,invoice_number,invoice_date,total_amount,notes,created_by) VALUES (?,?,?,?,?,?,?,?)',
      [
        grnId,
        generateDocNumber('GRN', seq),
        form.vendor_id,
        form.invoice_number,
        form.invoice_date,
        total,
        form.notes,
        currentUser?.username
      ]
    );

    for (const item of validItems) {
      await db.run(
        'INSERT INTO grn_items (id,grn_id,product_id,received_qty,unit_price,total) VALUES (?,?,?,?,?,?)',
        [
          generateId(),
          grnId,
          item.product_id,
          Number(item.received_qty) || 0,
          Number(item.unit_price) || 0,
          (Number(item.received_qty) || 0) * (Number(item.unit_price) || 0)
        ]
      );

      const existing = await db.get('SELECT * FROM inventory WHERE product_id=?', [item.product_id]);
      if (existing) {
        await db.run(
          "UPDATE inventory SET quantity = quantity + ?, last_updated = datetime('now') WHERE product_id = ?",
          [Number(item.received_qty) || 0, item.product_id]
        );
      } else {
        await db.run(
          'INSERT INTO inventory (id,product_id,quantity) VALUES (?,?,?)',
          [generateId(), item.product_id, Number(item.received_qty) || 0]
        );
      }

      await db.run(
        'INSERT INTO inventory_transactions (id,product_id,transaction_type,quantity,reference_id,reference_type,created_by) VALUES (?,?,?,?,?,?,?)',
        [generateId(), item.product_id, 'grn', Number(item.received_qty) || 0, grnId, 'grn', currentUser?.username]
      );

      await db.run('UPDATE products SET cost_price=? WHERE id=?', [Number(item.unit_price) || 0, item.product_id]);
    }

    onSave();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <div className="catalogue-modal-title">
            <div className="catalogue-modal-title-icon">
              <Truck size={18} />
            </div>
            <div>
              <h3>New Goods Receipt Note</h3>
              <p>Capture vendor receipt details, update stock accurately, and refresh landed cost discipline.</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="catalogue-modal-insights">
              <div className="catalogue-modal-insight">
                <span className="catalogue-modal-insight-label">GRN Value</span>
                <strong>{formatCurrency(total, currencySymbol)}</strong>
                <span className="text-muted text-sm">Current receipt valuation</span>
              </div>
              <div className="catalogue-modal-insight">
                <span className="catalogue-modal-insight-label">Receipt Lines</span>
                <strong>{validItems.length}</strong>
                <span className="text-muted text-sm">Distinct inward lines</span>
              </div>
              <div className="catalogue-modal-insight">
                <span className="catalogue-modal-insight-label">Total Qty</span>
                <strong>{quantityTotal}</strong>
                <span className="text-muted text-sm">Units being received now</span>
              </div>
              <div className="catalogue-modal-insight">
                <span className="catalogue-modal-insight-label">Vendor</span>
                <strong>{vendor?.name || 'Pending'}</strong>
                <span className="text-muted text-sm">{form.invoice_number || 'Invoice number pending'}</span>
              </div>
            </div>

            {error && (
              <div className="catalogue-form-alert">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            )}

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header">
                <h4>Receipt Header</h4>
                <span>Professional GRN flows keep supplier, invoice, and receipt notes together for audit traceability.</span>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Vendor *</label>
                  <SearchableSelect
                    value={form.vendor_id}
                    onChange={(nextValue) => setForm((prev) => ({ ...prev, vendor_id: nextValue }))}
                    options={vendorOptions}
                    placeholder="Write vendor name..."
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Invoice Number</label>
                  <input
                    className="form-control"
                    value={form.invoice_number}
                    onChange={(e) => setForm((prev) => ({ ...prev, invoice_number: e.target.value }))}
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Invoice Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.invoice_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, invoice_date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Notes</label>
                  <input
                    className="form-control"
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Packing condition, transport note, discrepancies"
                  />
                </div>
              </div>
            </div>

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header inward-section-head">
                <div>
                  <h4>Received Items</h4>
                  <span>Receiving teams should see prior stock, incoming qty, and updated cost all in the same line.</span>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
                  <Plus size={13} /> Add Item
                </button>
              </div>

              <div className="order-line-grid order-line-grid-head">
                <span>Product</span>
                <span>Current Stock</span>
                <span>Qty Received</span>
                <span>Unit Cost</span>
                <span>Line Total</span>
                <span>Post Receipt</span>
                <span></span>
              </div>

              <div className="order-line-list">
                {items.map((item) => {
                  const postReceipt = (Number(item.stock) || 0) + (Number(item.received_qty) || 0);
                  const lineTotal = (Number(item.received_qty) || 0) * (Number(item.unit_price) || 0);
                  return (
                    <div key={item.id} className="order-line-grid order-line-item">
                      <div>
                        <SearchableSelect
                          value={item.product_id}
                          onChange={(nextValue) => updateItem(item.id, 'product_id', nextValue)}
                          options={productOptions}
                          placeholder="Write product name..."
                          clearable
                        />
                      </div>
                      <div className="bom-static-field">{item.product_id ? Number(item.stock) || 0 : '-'}</div>
                      <input
                        type="number"
                        className="form-control"
                        value={item.received_qty}
                        onChange={(e) => updateItem(item.id, 'received_qty', parseFloat(e.target.value) || 0)}
                        min="0.001"
                        step="0.001"
                      />
                      <input
                        type="number"
                        className="form-control"
                        value={item.unit_price}
                        onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                        min="0"
                      />
                      <div className="bom-static-field font-semibold">{formatCurrency(lineTotal, currencySymbol)}</div>
                      <div className="bom-static-field">{item.product_id ? postReceipt : '-'}</div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {items.length > 1 && (
                          <button type="button" className="btn btn-danger btn-icon btn-sm" onClick={() => removeItem(item.id)}>
                            <AlertTriangle size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="inward-confirmation-note">
                <CheckCircle2 size={14} />
                <span>Saving this GRN will update stock, record inward transactions, and refresh the latest cost price for each product received.</span>
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

export default function InwardPro() {
  const { settings } = useAppStore();
  const [grns, setGrns] = useState([]);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await db.all(`SELECT g.*, c.name as vendor_name, COUNT(gi.id) as item_count
      FROM grn g
      LEFT JOIN contacts c ON g.vendor_id = c.id
      LEFT JOIN grn_items gi ON g.id = gi.grn_id
      GROUP BY g.id
      ORDER BY g.created_at DESC`);
    setGrns(data);
    setLoading(false);
  };

  const filtered = grns.filter((grn) => {
    const query = search.toLowerCase();
    return !query ||
      (grn.grn_number || '').toLowerCase().includes(query) ||
      (grn.vendor_name || '').toLowerCase().includes(query) ||
      (grn.invoice_number || '').toLowerCase().includes(query);
  });

  const sym = settings?.currency_symbol || DEFAULT_CURRENCY;
  const monthKey = new Date().toISOString().slice(0, 7);
  const thisMonthReceipts = grns.filter((grn) => (grn.created_at || '').startsWith(monthKey));
  const totalInwardValue = grns.reduce((sum, grn) => sum + (Number(grn.total_amount) || 0), 0);
  const monthlyInwardValue = thisMonthReceipts.reduce((sum, grn) => sum + (Number(grn.total_amount) || 0), 0);
  const uniqueVendors = new Set(grns.map((grn) => grn.vendor_id).filter(Boolean)).size;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Inward / GRN</h2>
          <span className="page-subtitle">Goods Receipt Notes</span>
        </div>
        <button className="btn btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={15} /> New GRN
        </button>
      </div>

      <div className="catalogue-hero">
        <div className="catalogue-hero-main">
          <div className="catalogue-hero-kicker">
            <Sparkles size={14} />
            <span>Receiving control workspace</span>
          </div>
          <h3>Capture inbound stock with cleaner audit, cost updates, and warehouse certainty.</h3>
          <p>
            Strong ERP inward modules connect the purchase-side receipt to inventory movement, supplier traceability, and updated stock value in one flow.
          </p>
          <div className="catalogue-chip-row">
            <span className="catalogue-chip">Vendor-linked inward traceability</span>
            <span className="catalogue-chip">Instant stock movement posting</span>
            <span className="catalogue-chip">Cost refresh on receipt</span>
          </div>
        </div>
        <div className="catalogue-hero-side">
          <div className="catalogue-hero-side-label">Receiving Volume</div>
          <strong>{formatCurrency(monthlyInwardValue, sym)}</strong>
          <span>Inward value recorded in the current month.</span>
        </div>
      </div>

      <div className="catalogue-stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{grns.length}</div>
            <div className="stat-card-label">Total GRNs</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
            <Truck size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{formatCurrency(totalInwardValue, sym)}</div>
            <div className="stat-card-label">Total Inward Value</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(6, 182, 212, 0.12)', color: 'var(--info)' }}>
            <BadgeIndianRupee size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{thisMonthReceipts.length}</div>
            <div className="stat-card-label">This Month</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <Boxes size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{uniqueVendors}</div>
            <div className="stat-card-label">Active Vendors</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}>
            <Package size={20} />
          </div>
        </div>
      </div>

      <div className="catalogue-summary-grid">
        <div className="catalogue-summary-card">
          <div className="catalogue-summary-title">Average GRN Value</div>
          <strong>{formatCurrency(grns.length ? totalInwardValue / grns.length : 0, sym)}</strong>
          <span className="text-muted text-sm">Mean value of recorded receipts.</span>
        </div>
        <div className="catalogue-summary-card">
          <div className="catalogue-summary-title">Largest Receipt</div>
          <strong>{grns.length ? formatCurrency(Math.max(...grns.map((grn) => Number(grn.total_amount) || 0)), sym) : '-'}</strong>
          <span className="text-muted text-sm">Highest inward value currently recorded.</span>
        </div>
        <div className="catalogue-summary-card">
          <div className="catalogue-summary-title">Recent Activity</div>
          <strong>{thisMonthReceipts.length}</strong>
          <span className="text-muted text-sm">Receipts logged during the current month.</span>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-bar">
          <Search size={14} color="var(--text-muted)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search GRN..." />
        </div>
        <span className="text-muted text-sm" style={{ marginLeft: 'auto' }}>{filtered.length} GRNs</span>
      </div>

      <div className="page-content" style={{ padding: 0 }}>
        <div className="table-container" style={{ height: '100%' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>GRN</th>
                <th>Vendor</th>
                <th>Invoice</th>
                <th>Structure</th>
                <th>Value</th>
                <th>Received On</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 40 }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state"><Truck size={40} /><p>No GRNs recorded yet</p></div></td></tr>
              ) : filtered.map((grn) => (
                <tr key={grn.id} className="catalogue-row">
                  <td>
                    <div className="catalogue-product-cell">
                      <div className="catalogue-product-avatar">
                        <Truck size={16} />
                      </div>
                      <div>
                        <div className="catalogue-product-title">{grn.grn_number}</div>
                        <div className="catalogue-product-meta">
                          <span>{grn.invoice_number || 'No invoice number'}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="order-detail-block">
                      <strong>{grn.vendor_name || '-'}</strong>
                      <span className="text-muted text-sm">{grn.notes || 'No notes'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="order-detail-block">
                      <strong>{grn.invoice_number || '-'}</strong>
                      <span className="text-muted text-sm">{grn.invoice_date ? formatDate(grn.invoice_date) : 'No invoice date'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="order-detail-block">
                      <strong>{grn.item_count} item(s)</strong>
                      <span className="text-muted text-sm">Receipt structure recorded</span>
                    </div>
                  </td>
                  <td>
                    <div className="order-detail-block">
                      <strong>{formatCurrency(grn.total_amount || 0, sym)}</strong>
                      <span className="text-muted text-sm">Receipt valuation</span>
                    </div>
                  </td>
                  <td className="text-secondary text-sm">{formatDate(grn.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <GRNModal
          currencySymbol={sym}
          onClose={() => setShowModal(false)}
          onSave={() => {
            setShowModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
