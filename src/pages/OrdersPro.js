import React, { useEffect, useMemo, useState } from 'react';
import db, {
  formatCurrency,
  formatDate,
  generateDocNumber,
  generateId,
  getNextSequence
} from '../utils/database';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Edit2,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';
import { useAppStore } from '../store/appStore';

const DEFAULT_CURRENCY = '\u20B9';
const STATUS_OPTIONS = ['pending', 'confirmed', 'in_production', 'ready', 'shipped', 'delivered', 'cancelled'];
const STATUS_COLORS = {
  pending: 'badge-warning',
  confirmed: 'badge-info',
  in_production: 'badge-info',
  ready: 'badge-success',
  shipped: 'badge-success',
  delivered: 'badge-success',
  cancelled: 'badge-danger'
};

function getDeliveryHealth(dateValue, status) {
  if (!dateValue) return { tone: 'neutral', label: 'No date', helper: 'Delivery commitment pending' };
  if (status === 'delivered' || status === 'cancelled') {
    return { tone: 'healthy', label: 'Closed', helper: 'Order already finalized' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateValue);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((target - today) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return { tone: 'critical', label: 'Overdue', helper: `${Math.abs(diffDays)} day(s) late` };
  if (diffDays <= 2) return { tone: 'warning', label: 'Due soon', helper: `${diffDays} day(s) left` };
  return { tone: 'healthy', label: 'On track', helper: `${diffDays} day(s) left` };
}

function OrderModal({ order, currencySymbol, onClose, onSave }) {
  const { currentUser } = useAppStore();
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ customer_id: '', delivery_date: '', notes: '' });
  const [items, setItems] = useState([{ id: generateId(), product_id: '', description: '', quantity: 1, unit_price: 0 }]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadData() {
      const [customerRows, productRows] = await Promise.all([
        db.all("SELECT * FROM contacts WHERE type='customer' AND is_active=1 ORDER BY name"),
        db.all(`SELECT p.*, COALESCE(i.quantity, 0) as stock
          FROM products p
          LEFT JOIN inventory i ON i.product_id = p.id
          WHERE p.is_active=1
          ORDER BY p.name`)
      ]);

      if (!active) return;

      setCustomers(customerRows);
      setProducts(productRows);

      if (order?.id) {
        setForm({
          customer_id: order.customer_id || '',
          delivery_date: order.delivery_date || '',
          notes: order.notes || ''
        });
        const itemRows = await db.all(
          `SELECT oi.*, p.code as product_code, COALESCE(i.quantity, 0) as stock
           FROM order_items oi
           LEFT JOIN products p ON p.id = oi.product_id
           LEFT JOIN inventory i ON i.product_id = oi.product_id
           WHERE oi.order_id=?`,
          [order.id]
        );
        if (!active) return;
        setItems(itemRows.length ? itemRows : [{ id: generateId(), product_id: '', description: '', quantity: 1, unit_price: 0 }]);
      }
    }

    loadData();
    return () => {
      active = false;
    };
  }, [order?.id]);

  const addItem = () => {
    setItems((prev) => [...prev, { id: generateId(), product_id: '', description: '', quantity: 1, unit_price: 0 }]);
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
            updated.description = product.name;
            updated.unit_price = Number(product.selling_price) || 0;
            updated.stock = Number(product.stock) || 0;
            updated.product_code = product.code;
          }
        }
        return updated;
      })
    );
  };

  const customer = customers.find((entry) => entry.id === form.customer_id);
  const customerOptions = customers.map((entry) => ({ value: entry.id, label: entry.name }));
  const productOptions = products.map((product) => ({
    value: product.id,
    label: `${product.name}${product.code ? ` (${product.code})` : ''}`
  }));
  const validItems = items.filter((item) => item.description || item.product_id);
  const subtotal = validItems.reduce(
    (sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unit_price) || 0)),
    0
  );
  const stockRiskCount = validItems.filter(
    (item) => item.product_id && Number(item.stock) < Number(item.quantity)
  ).length;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.customer_id) {
      setError('Select a customer before saving the order.');
      return;
    }

    if (!validItems.length) {
      setError('Add at least one order line.');
      return;
    }

    setError('');

    let orderId = order?.id;
    if (orderId) {
      await db.run(
        'UPDATE orders SET customer_id=?,delivery_date=?,notes=?,total_amount=? WHERE id=?',
        [form.customer_id, form.delivery_date, form.notes, subtotal, orderId]
      );
      await db.run('DELETE FROM order_items WHERE order_id=?', [orderId]);
    } else {
      orderId = generateId();
      const seq = await getNextSequence('orders', 'order_number', 'ORD');
      await db.run(
        'INSERT INTO orders (id,order_number,customer_id,delivery_date,notes,total_amount,created_by) VALUES (?,?,?,?,?,?,?)',
        [
          orderId,
          generateDocNumber('ORD', seq),
          form.customer_id,
          form.delivery_date,
          form.notes,
          subtotal,
          currentUser?.username
        ]
      );
    }

    for (const item of validItems) {
      await db.run(
        'INSERT INTO order_items (id,order_id,product_id,description,quantity,unit_price,total) VALUES (?,?,?,?,?,?,?)',
        [
          generateId(),
          orderId,
          item.product_id || null,
          item.description,
          Number(item.quantity) || 0,
          Number(item.unit_price) || 0,
          (Number(item.quantity) || 0) * (Number(item.unit_price) || 0)
        ]
      );
    }

    onSave();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-xl">
        <div className="modal-header">
          <div className="catalogue-modal-title">
            <div className="catalogue-modal-title-icon">
              <ShoppingCart size={18} />
            </div>
            <div>
              <h3>{order ? 'Edit Sales Order' : 'Create Sales Order'}</h3>
              <p>Capture customer demand, track delivery commitment, and validate line value before release.</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="catalogue-modal-insights">
              <div className="catalogue-modal-insight">
                <span className="catalogue-modal-insight-label">Order Value</span>
                <strong>{formatCurrency(subtotal, currencySymbol)}</strong>
                <span className="text-muted text-sm">Current subtotal across all lines</span>
              </div>
              <div className="catalogue-modal-insight">
                <span className="catalogue-modal-insight-label">Line Count</span>
                <strong>{validItems.length}</strong>
                <span className="text-muted text-sm">Distinct billable lines</span>
              </div>
              <div className="catalogue-modal-insight">
                <span className="catalogue-modal-insight-label">Delivery Commitment</span>
                <strong>{form.delivery_date ? formatDate(form.delivery_date) : 'Pending'}</strong>
                <span className="text-muted text-sm">{getDeliveryHealth(form.delivery_date, order?.status).helper}</span>
              </div>
              <div className="catalogue-modal-insight">
                <span className="catalogue-modal-insight-label">Stock Risk</span>
                <strong>{stockRiskCount}</strong>
                <span className={stockRiskCount > 0 ? 'text-warning text-sm' : 'text-success text-sm'}>
                  {stockRiskCount > 0 ? 'Line items exceed available stock' : 'Current stock supports order'}
                </span>
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
                <h4>Commercial Header</h4>
                <span>Senior ERP order screens keep the customer, promise date, and commercial notes visible together.</span>
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Customer *</label>
                  <SearchableSelect
                    value={form.customer_id}
                    onChange={(nextValue) => setForm((prev) => ({ ...prev, customer_id: nextValue }))}
                    options={customerOptions}
                    placeholder="Write customer name..."
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Expected Delivery</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.delivery_date}
                    onChange={(e) => setForm((prev) => ({ ...prev, delivery_date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Commercial Notes</label>
                  <input
                    className="form-control"
                    value={form.notes}
                    onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Scope, delivery note, commercial commitment"
                  />
                </div>
              </div>
              {customer && (
                <div className="order-customer-brief">
                  <strong>{customer.name}</strong>
                  <span>{customer.phone || 'No phone'} · {customer.email || 'No email'}</span>
                </div>
              )}
            </div>

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header order-section-head">
                <div>
                  <h4>Order Lines</h4>
                  <span>Good order desks surface product defaults, stock posture, and line value directly inside the editor.</span>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
                  <Plus size={13} /> Add Item
                </button>
              </div>

              <div className="order-line-grid order-line-grid-head">
                <span>Product</span>
                <span>Description</span>
                <span>Qty</span>
                <span>Stock</span>
                <span>Unit Price</span>
                <span>Line Total</span>
                <span></span>
              </div>

              <div className="order-line-list">
                {items.map((item) => {
                  const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_price) || 0);
                  const hasStockRisk = item.product_id && Number(item.stock) < Number(item.quantity);

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
                        {item.product_id ? (
                          <div className="order-line-meta">
                            <span className="font-mono text-sm text-accent">{item.product_code || 'No code'}</span>
                            <span className={`bom-risk-pill ${hasStockRisk ? 'tone-warning' : 'tone-healthy'}`}>
                              {hasStockRisk ? 'Stock short' : 'Stock ready'}
                            </span>
                          </div>
                        ) : null}
                      </div>
                      <input
                        className="form-control"
                        value={item.description}
                        onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                        placeholder="Product or custom description"
                      />
                      <input
                        type="number"
                        className="form-control"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                        min="1"
                      />
                      <div className="bom-static-field">
                        {item.product_id ? `${Number(item.stock) || 0}` : '-'}
                      </div>
                      <input
                        type="number"
                        className="form-control"
                        value={item.unit_price}
                        onChange={(e) => updateItem(item.id, 'unit_price', parseFloat(e.target.value) || 0)}
                        min="0"
                      />
                      <div className="bom-static-field font-semibold">{formatCurrency(lineTotal, currencySymbol)}</div>
                      <div style={{ display: 'flex', justifyContent: 'center' }}>
                        {items.length > 1 && (
                          <button type="button" className="btn btn-danger btn-icon btn-sm" onClick={() => removeItem(item.id)}>
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
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

export default function OrdersPro() {
  const { settings } = useAppStore();
  const [orders, setOrders] = useState([]);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await db.all(`SELECT o.*, c.name as customer_name
      FROM orders o
      LEFT JOIN contacts c ON o.customer_id = c.id
      ORDER BY o.created_at DESC`);
    const items = await db.all('SELECT order_id, COUNT(*) as item_count FROM order_items GROUP BY order_id');
    const itemMap = items.reduce((acc, item) => ({ ...acc, [item.order_id]: Number(item.item_count) || 0 }), {});
    setOrders(data.map((entry) => ({ ...entry, item_count: itemMap[entry.id] || 0 })));
    setLoading(false);
  };

  const filtered = orders.filter((order) => {
    const query = search.toLowerCase();
    const matchSearch = !query ||
      (order.order_number || '').toLowerCase().includes(query) ||
      (order.customer_name || '').toLowerCase().includes(query);
    const matchStatus = filterStatus === 'all' || order.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const updateStatus = async (id, status) => {
    await db.run('UPDATE orders SET status=? WHERE id=?', [status, id]);
    loadData();
  };

  const sym = settings?.currency_symbol || DEFAULT_CURRENCY;
  const activeOrders = orders.filter((order) => ['pending', 'confirmed', 'in_production', 'ready'].includes(order.status));
  const overdueOrders = orders.filter((order) => getDeliveryHealth(order.delivery_date, order.status).tone === 'critical');
  const orderValue = activeOrders.reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);
  const deliveredRevenue = orders
    .filter((order) => ['shipped', 'delivered'].includes(order.status))
    .reduce((sum, order) => sum + (Number(order.total_amount) || 0), 0);

  const statusTabs = [
    { key: 'all', label: 'All Orders', count: orders.length },
    { key: 'pending', label: 'Pending', count: orders.filter((order) => order.status === 'pending').length },
    { key: 'confirmed', label: 'Confirmed', count: orders.filter((order) => order.status === 'confirmed').length },
    { key: 'in_production', label: 'In Production', count: orders.filter((order) => order.status === 'in_production').length },
    { key: 'ready', label: 'Ready', count: orders.filter((order) => order.status === 'ready').length }
  ];
  const statusOptions = STATUS_OPTIONS.map((status) => ({ value: status, label: status.replace(/_/g, ' ') }));

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Orders</h2>
          <span className="page-subtitle">{activeOrders.length} active orders</span>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <Plus size={15} /> New Order
        </button>
      </div>

      <div className="catalogue-hero">
        <div className="catalogue-hero-main">
          <div className="catalogue-hero-kicker">
            <Sparkles size={14} />
            <span>Commercial execution workspace</span>
          </div>
          <h3>Track demand, delivery promises, and order value without losing operational clarity.</h3>
          <p>
            Modern ERP order modules combine order capture with delivery risk, line readiness, and commercial visibility so teams can act quickly.
          </p>
          <div className="catalogue-chip-row">
            <span className="catalogue-chip">Promise-date visibility</span>
            <span className="catalogue-chip">Order-line stock posture</span>
            <span className="catalogue-chip">Fast status progression</span>
          </div>
        </div>
        <div className="catalogue-hero-side">
          <div className="catalogue-hero-side-label">Delivery Pulse</div>
          <strong>{overdueOrders.length === 0 ? 'Stable' : `${overdueOrders.length} overdue`}</strong>
          <span>{activeOrders.length} orders still need production, dispatch, or closure.</span>
        </div>
      </div>

      <div className="catalogue-stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{activeOrders.length}</div>
            <div className="stat-card-label">Active Orders</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
            <ShoppingCart size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{formatCurrency(orderValue, sym)}</div>
            <div className="stat-card-label">Open Order Value</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(6, 182, 212, 0.12)', color: 'var(--info)' }}>
            <Package size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{overdueOrders.length}</div>
            <div className="stat-card-label">Overdue Commitments</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}>
            <Clock3 size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{formatCurrency(deliveredRevenue, sym)}</div>
            <div className="stat-card-label">Closed Revenue</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <CheckCircle2 size={20} />
          </div>
        </div>
      </div>

      <div className="catalogue-summary-grid">
        <div className="catalogue-summary-card">
          <div className="catalogue-summary-title">Average Order Value</div>
          <strong>{formatCurrency(orders.length ? orderValue / Math.max(activeOrders.length, 1) : 0, sym)}</strong>
          <span className="text-muted text-sm">Based on currently active commercial pipeline.</span>
        </div>
        <div className="catalogue-summary-card">
          <div className="catalogue-summary-title">Production Load</div>
          <strong>{orders.filter((order) => order.status === 'in_production').length}</strong>
          <span className="text-muted text-sm">Orders actively consuming team capacity.</span>
        </div>
        <div className="catalogue-summary-card">
          <div className="catalogue-summary-title">Ready to Dispatch</div>
          <strong>{orders.filter((order) => order.status === 'ready').length}</strong>
          <span className="text-muted text-sm">Orders finished and waiting for shipment closure.</span>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-bar">
          <Search size={14} color="var(--text-muted)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search orders..." />
        </div>
        <div className="catalogue-tab-strip">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              className={`catalogue-tab-pill ${filterStatus === tab.key ? 'active' : ''}`}
              onClick={() => setFilterStatus(tab.key)}
            >
              <span>{tab.label}</span>
              <strong>{tab.count}</strong>
            </button>
          ))}
        </div>
        <span className="text-muted text-sm" style={{ marginLeft: 'auto' }}>{filtered.length} orders</span>
      </div>

      <div className="page-content" style={{ padding: 0 }}>
        <div className="table-container" style={{ height: '100%' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Customer</th>
                <th>Commercials</th>
                <th>Delivery</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 40 }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state"><ShoppingCart size={40} /><p>No orders found</p></div></td></tr>
              ) : filtered.map((order) => {
                const deliveryHealth = getDeliveryHealth(order.delivery_date, order.status);
                return (
                  <tr key={order.id} onDoubleClick={() => setModal(order)} className="catalogue-row">
                    <td>
                      <div className="catalogue-product-cell">
                        <div className="catalogue-product-avatar">
                          <ShoppingCart size={16} />
                        </div>
                        <div>
                          <div className="catalogue-product-title">{order.order_number}</div>
                          <div className="catalogue-product-meta">
                            <span>{formatDate(order.created_at || order.order_date)}</span>
                            <span>{order.item_count} line(s)</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="order-detail-block">
                        <strong>{order.customer_name || '-'}</strong>
                        <span className="text-muted text-sm">{order.notes || 'No notes'}</span>
                      </div>
                    </td>
                    <td>
                      <div className="order-detail-block">
                        <strong>{formatCurrency(order.total_amount || 0, sym)}</strong>
                        <span className="text-muted text-sm">{order.item_count} commercial line(s)</span>
                      </div>
                    </td>
                    <td>
                      <div className={`bom-readiness-card ${deliveryHealth.tone === 'critical' ? 'attention' : 'healthy'}`}>
                        <div className="bom-readiness-head">
                          {deliveryHealth.tone === 'critical' ? <AlertTriangle size={14} /> : <Clock3 size={14} />}
                          <strong>{deliveryHealth.label}</strong>
                        </div>
                        <span>{deliveryHealth.helper}</span>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[order.status] || 'badge-secondary'}`}>
                        {order.status?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setModal(order)}>
                          <Edit2 size={13} />
                        </button>
                        <SearchableSelect
                          value={order.status}
                          onChange={(nextValue) => updateStatus(order.id, nextValue)}
                          options={statusOptions}
                          placeholder="Update status..."
                          style={{ minWidth: 180 }}
                        />
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
        <OrderModal
          order={modal?.id ? modal : null}
          currencySymbol={sym}
          onClose={() => setModal(null)}
          onSave={() => {
            setModal(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
