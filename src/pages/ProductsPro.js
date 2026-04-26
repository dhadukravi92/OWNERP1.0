import React, { useEffect, useState } from 'react';
import db, { generateId, formatCurrency } from '../utils/database';
import {
  AlertTriangle,
  BadgeIndianRupee,
  Boxes,
  Edit2,
  Filter,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
  TrendingUp,
  X
} from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';
import { useAppStore } from '../store/appStore';

const DEFAULT_CURRENCY = '\u20B9';
const PRODUCT_UNITS = ['PCS', 'MTR', 'KG', 'SET', 'ROLL', 'BOX', 'LTR'];
const GST_RATES = [0, 5, 12, 18, 28];

function createCodeFromName(name) {
  const cleaned = (name || '')
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, ' ')
    .trim();

  if (!cleaned) return '';

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length === 1) return tokens[0].slice(0, 12);

  return tokens
    .slice(0, 4)
    .map((token) => token.slice(0, token.length > 4 ? 3 : token.length))
    .join('-')
    .slice(0, 18);
}

function getMarginMetrics(costPrice, sellingPrice) {
  const cost = Number(costPrice) || 0;
  const selling = Number(sellingPrice) || 0;
  const profit = selling - cost;
  const markup = cost > 0 ? (profit / cost) * 100 : 0;
  const margin = selling > 0 ? (profit / selling) * 100 : 0;

  return { profit, markup, margin };
}

function getStockStage(product) {
  const stock = Number(product.stock) || 0;
  const minStock = Number(product.min_stock) || 0;

  if (stock <= 0) {
    return { tone: 'critical', label: 'Out of stock', helper: 'Immediate replenishment required' };
  }

  if (stock <= minStock) {
    return { tone: 'warning', label: 'Below minimum', helper: 'At or below reorder level' };
  }

  if (stock <= minStock * 1.5) {
    return { tone: 'watch', label: 'Watch closely', helper: 'Approaching reorder level' };
  }

  return { tone: 'healthy', label: 'Healthy stock', helper: 'Comfortable availability' };
}

function ProductModal({ product, categories, products, currencySymbol, onClose, onSave, onCategoryCreated }) {
  const [form, setForm] = useState(product || {
    name: '',
    code: '',
    category_id: '',
    description: '',
    unit: 'PCS',
    hsn_code: '',
    gst_rate: 18,
    selling_price: 0,
    cost_price: 0,
    min_stock: 0,
    specifications: ''
  });
  const [codeTouched, setCodeTouched] = useState(Boolean(product?.code));
  const [error, setError] = useState('');

  useEffect(() => {
    if (product?.id || codeTouched || form.code || !form.name) return;
    setForm((prev) => ({ ...prev, code: createCodeFromName(form.name) }));
  }, [form.name, form.code, product?.id, codeTouched]);

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const metrics = getMarginMetrics(form.cost_price, form.selling_price);
  const taxAmount = (Number(form.selling_price) || 0) * ((Number(form.gst_rate) || 0) / 100);
  const categoryName = categories.find((item) => item.id === form.category_id)?.name || 'Uncategorized';
  const categoryOptions = categories.map((category) => ({ value: category.id, label: category.name }));
  const unitOptions = PRODUCT_UNITS.map((unit) => ({ value: unit, label: unit }));
  const gstRateOptions = GST_RATES.map((rate) => ({ value: String(rate), label: `${rate}%` }));

  const createCategoryFromQuery = async (rawQuery) => {
    const nextCategoryName = `${rawQuery || ''}`.trim().replace(/\s+/g, ' ');
    if (!nextCategoryName) {
      setError('Write a category name before creating it.');
      return;
    }

    const duplicateCategory = categories.find((item) => item.name?.trim().toLowerCase() === nextCategoryName.toLowerCase());
    if (duplicateCategory) {
      updateField('category_id', duplicateCategory.id);
      setError('');
      return;
    }

    try {
      const id = generateId();
      await db.run(
        'INSERT INTO categories (id, name, parent_id, description) VALUES (?,?,?,?)',
        [id, nextCategoryName, null, '']
      );
      onCategoryCreated?.({ id, name: nextCategoryName, parent_id: null, description: '' });
      updateField('category_id', id);
      setError('');
    } catch (err) {
      setError(`Unable to create category. ${err.message || ''}`.trim());
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedName = form.name.trim();
    const trimmedCode = form.code.trim();
    const duplicateCode = trimmedCode
      ? products.find((item) => item.code?.toLowerCase() === trimmedCode.toLowerCase() && item.id !== product?.id)
      : null;

    if (!trimmedName) {
      setError('Product name is required.');
      return;
    }

    if (duplicateCode) {
      setError(`Product code "${trimmedCode}" is already used by ${duplicateCode.name}.`);
      return;
    }

    setError('');

    const params = [
      trimmedName,
      trimmedCode,
      form.category_id,
      form.description,
      form.unit,
      form.hsn_code,
      Number(form.gst_rate) || 0,
      Number(form.selling_price) || 0,
      Number(form.cost_price) || 0,
      Number(form.min_stock) || 0,
      form.specifications
    ];

    if (product?.id) {
      await db.run(
        `UPDATE products SET name=?,code=?,category_id=?,description=?,unit=?,hsn_code=?,
        gst_rate=?,selling_price=?,cost_price=?,min_stock=?,specifications=? WHERE id=?`,
        [...params, product.id]
      );
    } else {
      const id = generateId();
      await db.run(
        `INSERT INTO products (id,name,code,category_id,description,unit,hsn_code,gst_rate,selling_price,cost_price,min_stock,specifications)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, ...params]
      );
      await db.run('INSERT INTO inventory (id, product_id, quantity) VALUES (?,?,0)', [generateId(), id]);
    }

    onSave();
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="catalogue-modal-title">
            <div className="catalogue-modal-title-icon">
              <Sparkles size={18} />
            </div>
            <div>
              <h3>{product ? 'Edit Product' : 'Add New Product'}</h3>
              <p>{product ? 'Refine master data, pricing, and replenishment rules.' : 'Create a complete product master with pricing and stock controls.'}</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="catalogue-modal-insights">
              <div className="catalogue-modal-insight">
                <span className="catalogue-modal-insight-label">Gross Profit</span>
                <strong>{formatCurrency(metrics.profit, currencySymbol)}</strong>
                <span className={metrics.profit >= 0 ? 'text-success text-sm' : 'text-danger text-sm'}>
                  {metrics.margin.toFixed(1)}% margin
                </span>
              </div>
              <div className="catalogue-modal-insight">
                <span className="catalogue-modal-insight-label">Markup</span>
                <strong>{metrics.markup.toFixed(1)}%</strong>
                <span className="text-muted text-sm">vs cost price</span>
              </div>
              <div className="catalogue-modal-insight">
                <span className="catalogue-modal-insight-label">Tax on Selling Price</span>
                <strong>{formatCurrency(taxAmount, currencySymbol)}</strong>
                <span className="text-muted text-sm">{Number(form.gst_rate) || 0}% GST</span>
              </div>
              <div className="catalogue-modal-insight">
                <span className="catalogue-modal-insight-label">Catalogue Placement</span>
                <strong>{categoryName}</strong>
                <span className="text-muted text-sm">{form.unit} stocking unit</span>
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
                <h4>Identity</h4>
                <span>Strong product masters make downstream BOM, stock, and pricing workflows faster.</span>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Product Name *</label>
                  <input
                    className="form-control"
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    required
                    placeholder="e.g. MCB 16A Single Pole"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Product Code</label>
                  <input
                    className="form-control"
                    value={form.code}
                    onChange={(e) => {
                      setCodeTouched(true);
                      updateField('code', e.target.value.toUpperCase());
                    }}
                    placeholder="e.g. MCB-16A-SP"
                  />
                  <span className="text-xs text-muted">
                    {codeTouched ? 'Custom code enabled.' : 'Auto-generated from product name until you edit it.'}
                  </span>
                </div>
              </div>
            </div>

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header">
                <h4>Classification</h4>
                <span>Keep categories and stocking units clean so search, reporting, and purchasing stay accurate.</span>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <SearchableSelect
                    value={form.category_id}
                    onChange={(nextValue) => updateField('category_id', nextValue)}
                    options={categoryOptions}
                    placeholder="Write category name..."
                    clearable
                    noResultsAction={({ query }) => {
                      if (!query) {
                        return <div className="searchable-select__empty">No results found</div>;
                      }

                      return (
                        <button
                          type="button"
                          className="searchable-select__option"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => createCategoryFromQuery(query)}
                        >
                          Add category "{query}"
                        </button>
                      );
                    }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit</label>
                  <SearchableSelect
                    value={form.unit}
                    onChange={(nextValue) => updateField('unit', nextValue)}
                    options={unitOptions}
                    placeholder="Write unit..."
                  />
                </div>
              </div>
            </div>

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header">
                <h4>Commercials</h4>
                <span>High-performing ERP screens surface margin quality, not just raw price fields.</span>
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">Cost Price ({currencySymbol})</label>
                  <input type="number" className="form-control" value={form.cost_price} onChange={(e) => updateField('cost_price', e.target.value)} min="0" step="0.01" />
                </div>
                <div className="form-group">
                  <label className="form-label">Selling Price ({currencySymbol})</label>
                  <input type="number" className="form-control" value={form.selling_price} onChange={(e) => updateField('selling_price', e.target.value)} min="0" step="0.01" />
                </div>
                <div className="form-group">
                  <label className="form-label">GST Rate (%)</label>
                  <SearchableSelect
                    value={form.gst_rate}
                    onChange={(nextValue) => updateField('gst_rate', nextValue)}
                    options={gstRateOptions}
                    placeholder="Write GST rate..."
                  />
                </div>
              </div>
            </div>

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header">
                <h4>Inventory Control</h4>
                <span>Reorder data should be explicit so planners can act before shortages hit production.</span>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">HSN Code</label>
                  <input className="form-control" value={form.hsn_code} onChange={(e) => updateField('hsn_code', e.target.value)} placeholder="HSN/SAC code" />
                </div>
                <div className="form-group">
                  <label className="form-label">Min. Stock Level</label>
                  <input type="number" className="form-control" value={form.min_stock} onChange={(e) => updateField('min_stock', e.target.value)} min="0" />
                </div>
              </div>
            </div>

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header">
                <h4>Product Details</h4>
                <span>Add enough context for sales, engineering, and stores teams to use the same product master.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-control" value={form.description} onChange={(e) => updateField('description', e.target.value)} rows={2} />
              </div>

              <div className="form-group">
                <label className="form-label">Technical Specifications</label>
                <textarea className="form-control" value={form.specifications} onChange={(e) => updateField('specifications', e.target.value)} rows={3} placeholder="Voltage, Current rating, Standards compliance, etc." />
              </div>
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

export default function ProductsPro() {
  const { settings } = useAppStore();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [stockFilter, setStockFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

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

  const registerCreatedCategory = (category) => {
    if (!category?.id) return;
    setCategories((prev) => {
      if (prev.some((item) => item.id === category.id)) return prev;
      return [...prev, category].sort((a, b) => `${a.name || ''}`.localeCompare(`${b.name || ''}`));
    });
  };

  const filtered = products.filter((product) => {
    const query = search.toLowerCase();
    const matchSearch = !query ||
      product.name.toLowerCase().includes(query) ||
      (product.code || '').toLowerCase().includes(query) ||
      (product.hsn_code || '').toLowerCase().includes(query);
    const matchCategory = !filterCat || product.category_id === filterCat;
    const stage = getStockStage(product);
    const matchStock =
      stockFilter === 'all' ||
      (stockFilter === 'healthy' && stage.tone === 'healthy') ||
      (stockFilter === 'watch' && stage.tone === 'watch') ||
      (stockFilter === 'warning' && stage.tone === 'warning') ||
      (stockFilter === 'critical' && stage.tone === 'critical');

    return matchSearch && matchCategory && matchStock;
  });

  const deleteProduct = async (id) => {
    if (window.confirm('Mark this product as inactive?')) {
      await db.run('UPDATE products SET is_active = 0 WHERE id = ?', [id]);
      loadData();
    }
  };

  const sym = settings?.currency_symbol || DEFAULT_CURRENCY;
  const lowStockCount = products.filter((product) => {
    const stage = getStockStage(product);
    return stage.tone === 'critical' || stage.tone === 'warning';
  }).length;
  const totalInventoryValue = products.reduce((sum, product) => sum + ((Number(product.stock) || 0) * (Number(product.cost_price) || 0)), 0);
  const totalSalesPotential = products.reduce((sum, product) => sum + ((Number(product.stock) || 0) * (Number(product.selling_price) || 0)), 0);
  const marginAverage = products.length
    ? products.reduce((sum, product) => sum + getMarginMetrics(product.cost_price, product.selling_price).margin, 0) / products.length
    : 0;

  const topCategories = categories
    .map((category) => ({
      name: category.name,
      count: products.filter((product) => product.category_id === category.id).length
    }))
    .filter((category) => category.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  const stockFilterOptions = [
    { key: 'all', label: 'All Products', count: products.length },
    { key: 'healthy', label: 'Healthy', count: products.filter((product) => getStockStage(product).tone === 'healthy').length },
    { key: 'watch', label: 'Watchlist', count: products.filter((product) => getStockStage(product).tone === 'watch').length },
    { key: 'warning', label: 'Low Stock', count: products.filter((product) => getStockStage(product).tone === 'warning').length },
    { key: 'critical', label: 'Out of Stock', count: products.filter((product) => getStockStage(product).tone === 'critical').length }
  ];
  const categoryFilterOptions = categories.map((category) => ({ value: category.id, label: category.name }));

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

      <div className="catalogue-hero">
        <div className="catalogue-hero-main">
          <div className="catalogue-hero-kicker">
            <Sparkles size={14} />
            <span>Product intelligence workspace</span>
          </div>
          <h3>Run catalogue, pricing, and stock readiness from one view.</h3>
          <p>
            Strong ERP catalogue modules reduce lookup time, expose margin quality, and make replenishment issues visible before they become production delays.
          </p>
          <div className="catalogue-chip-row">
            {topCategories.length > 0 ? topCategories.map((category) => (
              <span key={category.name} className="catalogue-chip">
                {category.name} · {category.count}
              </span>
            )) : (
              <span className="catalogue-chip">Build categories to unlock cleaner analytics</span>
            )}
          </div>
        </div>
        <div className="catalogue-hero-side">
          <div className="catalogue-hero-side-label">Catalogue Health</div>
          <strong>{lowStockCount === 0 ? 'Stable' : `${lowStockCount} attention items`}</strong>
          <span>{products.length} active SKUs tracked across pricing and inventory.</span>
        </div>
      </div>

      <div className="catalogue-stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{products.length}</div>
            <div className="stat-card-label">Active Products</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
            <Boxes size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{lowStockCount}</div>
            <div className="stat-card-label">Reorder Attention</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}>
            <AlertTriangle size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{marginAverage.toFixed(1)}%</div>
            <div className="stat-card-label">Avg Margin</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <TrendingUp size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{formatCurrency(totalInventoryValue, sym)}</div>
            <div className="stat-card-label">Inventory Value</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)' }}>
            <BadgeIndianRupee size={20} />
          </div>
        </div>
      </div>

      <div className="catalogue-summary-grid">
        <div className="catalogue-summary-card">
          <div className="catalogue-summary-title">Sales Potential</div>
          <strong>{formatCurrency(totalSalesPotential, sym)}</strong>
          <span className="text-muted text-sm">Based on current stock multiplied by selling price.</span>
        </div>
        <div className="catalogue-summary-card">
          <div className="catalogue-summary-title">Category Coverage</div>
          <strong>{categories.length}</strong>
          <span className="text-muted text-sm">Categories available for product master classification.</span>
        </div>
        <div className="catalogue-summary-card">
          <div className="catalogue-summary-title">Data Discipline</div>
          <strong>{products.filter((product) => product.hsn_code).length}/{products.length}</strong>
          <span className="text-muted text-sm">Products with HSN codes already maintained.</span>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-bar">
          <Search size={14} color="var(--text-muted)" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by product, code, or HSN..." />
        </div>
        <div className="catalogue-filter-group">
          <Filter size={14} color="var(--text-muted)" />
          <SearchableSelect
            value={filterCat}
            onChange={setFilterCat}
            options={categoryFilterOptions}
            placeholder="Search category..."
            clearable
            style={{ width: 220 }}
          />
        </div>
        <div className="catalogue-tab-strip">
          {stockFilterOptions.map((option) => (
            <button
              key={option.key}
              className={`catalogue-tab-pill ${stockFilter === option.key ? 'active' : ''}`}
              onClick={() => setStockFilter(option.key)}
            >
              <span>{option.label}</span>
              <strong>{option.count}</strong>
            </button>
          ))}
        </div>
        <span className="text-muted text-sm" style={{ marginLeft: 'auto' }}>{filtered.length} results</span>
      </div>

      <div className="page-content" style={{ padding: 0 }}>
        <div className="table-container" style={{ height: '100%' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Category</th>
                <th>Commercials</th>
                <th>Compliance</th>
                <th>Stock Health</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="text-center text-muted" style={{ padding: 40 }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state"><Package size={40} /><p>No products found</p></div></td></tr>
              ) : filtered.map((product) => {
                const stockStage = getStockStage(product);
                const marginMetrics = getMarginMetrics(product.cost_price, product.selling_price);
                const stockRatio = ((Number(product.stock) || 0) / Math.max((Number(product.min_stock) || 1), 1)) * 100;

                return (
                  <tr key={product.id} onDoubleClick={() => setModal(product)} className="catalogue-row">
                    <td>
                      <div className="catalogue-product-cell">
                        <div className="catalogue-product-avatar">
                          <Package size={16} />
                        </div>
                        <div>
                          <div className="catalogue-product-title">{product.name}</div>
                          <div className="catalogue-product-meta">
                            <span className="font-mono text-sm text-accent">{product.code || 'No code'}</span>
                            <span>{product.unit}</span>
                          </div>
                          {product.description && <div className="text-xs text-muted">{product.description.substring(0, 72)}</div>}
                        </div>
                      </div>
                    </td>
                    <td><span className="badge badge-secondary">{product.category_name || 'Uncategorized'}</span></td>
                    <td>
                      <div className="catalogue-commercials">
                        <div>
                          <span className="catalogue-metric-label">Cost</span>
                          <strong>{formatCurrency(product.cost_price, sym)}</strong>
                        </div>
                        <div>
                          <span className="catalogue-metric-label">Selling</span>
                          <strong>{formatCurrency(product.selling_price, sym)}</strong>
                        </div>
                        <div>
                          <span className="catalogue-metric-label">Margin</span>
                          <strong className={marginMetrics.profit >= 0 ? 'text-success' : 'text-danger'}>
                            {marginMetrics.margin.toFixed(1)}%
                          </strong>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="catalogue-compliance">
                        <span className="catalogue-metric-label">GST {product.gst_rate}%</span>
                        <strong>{product.hsn_code || 'HSN pending'}</strong>
                      </div>
                    </td>
                    <td>
                      <div className={`catalogue-stock-card tone-${stockStage.tone}`}>
                        <div className="catalogue-stock-head">
                          <strong>{Number(product.stock) || 0} {product.unit}</strong>
                          <span>{stockStage.label}</span>
                        </div>
                        <div className="catalogue-stock-bar">
                          <span style={{ width: `${Math.min(100, Math.max(stockRatio, 8))}%` }} />
                        </div>
                        <div className="catalogue-stock-foot">
                          <span>{stockStage.helper}</span>
                          <span>Min {Number(product.min_stock) || 0}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setModal(product)} title="Edit">
                          <Edit2 size={13} />
                        </button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteProduct(product.id)} title="Delete">
                          <Trash2 size={13} />
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

      {modal !== null && (
        <ProductModal
          product={modal?.id ? modal : null}
          categories={categories}
          products={products}
          currencySymbol={sym}
          onCategoryCreated={registerCreatedCategory}
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
