import React, { useEffect, useState } from 'react';
import db, { generateId, formatCurrency } from '../utils/database';
import {
  AlertTriangle,
  BadgeIndianRupee,
  Boxes,
  Edit2,
  GitBranch,
  Layers,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import SearchableSelect from '../components/ui/SearchableSelect';
import { useAppStore } from '../store/appStore';

const DEFAULT_CURRENCY = '\u20B9';

function getMaterialRisk(item) {
  const stock = Number(item.stock) || 0;
  const minStock = Number(item.min_stock) || 0;

  if (!item.material_id) {
    return { tone: 'neutral', label: 'Pending', helper: 'Select a component' };
  }

  if (stock <= 0) {
    return { tone: 'critical', label: 'Out of stock', helper: 'Cannot build reliably' };
  }

  if (stock <= minStock) {
    return { tone: 'warning', label: 'Low stock', helper: 'Below reorder level' };
  }

  if (stock <= minStock * 1.5) {
    return { tone: 'watch', label: 'Watch', helper: 'Monitor before release' };
  }

  return { tone: 'healthy', label: 'Healthy', helper: 'Ready for production' };
}

function summarizeBom(items, finishedProduct) {
  const validItems = items.filter((item) => item.material_id);
  const estimatedCost = validItems.reduce(
    (sum, item) => sum + ((Number(item.cost_price) || 0) * (Number(item.quantity) || 0)),
    0
  );
  const riskCount = validItems.filter((item) => {
    const risk = getMaterialRisk(item);
    return risk.tone === 'critical' || risk.tone === 'warning';
  }).length;
  const grossProfit = (Number(finishedProduct?.selling_price) || 0) - estimatedCost;
  const grossMargin = Number(finishedProduct?.selling_price) > 0
    ? (grossProfit / Number(finishedProduct.selling_price)) * 100
    : 0;

  return {
    componentCount: validItems.length,
    estimatedCost,
    riskCount,
    grossProfit,
    grossMargin
  };
}

function enrichMaterial(products, materialId, existing = {}) {
  const product = products.find((item) => item.id === materialId);
  if (!product) return existing;

  return {
    ...existing,
    material_id: materialId,
    material_name: product.name,
    material_code: product.code,
    quantity: existing.quantity || 1,
    unit: product.unit,
    notes: existing.notes || '',
    cost_price: Number(product.cost_price) || 0,
    stock: Number(product.stock) || 0,
    min_stock: Number(product.min_stock) || 0
  };
}

function BOMModal({ bom, products, currencySymbol, onClose, onSave }) {
  const [form, setForm] = useState(
    bom || { name: '', product_id: '', version: '1.0', description: '' }
  );
  const [items, setItems] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;

    async function loadItems() {
      if (!bom?.id) {
        setItems([]);
        return;
      }

      const rows = await db.all(
        `SELECT bi.*, p.name as material_name, p.code as material_code, p.cost_price,
          p.min_stock, p.unit as product_unit, COALESCE(i.quantity, 0) as stock
         FROM bom_items bi
         JOIN products p ON bi.material_id = p.id
         LEFT JOIN inventory i ON i.product_id = p.id
         WHERE bi.bom_id = ?
         ORDER BY p.name`,
        [bom.id]
      );

      if (!active) return;

      setItems(
        rows.map((row) => ({
          ...row,
          unit: row.unit || row.product_unit,
          quantity: Number(row.quantity) || 0,
          cost_price: Number(row.cost_price) || 0,
          stock: Number(row.stock) || 0,
          min_stock: Number(row.min_stock) || 0
        }))
      );
    }

    loadItems();
    return () => {
      active = false;
    };
  }, [bom?.id]);

  useEffect(() => {
    if (form.name || !form.product_id) return;
    const product = products.find((item) => item.id === form.product_id);
    if (!product) return;
    setForm((prev) => ({ ...prev, name: `${product.name} BOM` }));
  }, [form.product_id, form.name, products]);

  const finishedProduct = products.find((item) => item.id === form.product_id) || null;
  const productOptions = products.map((product) => ({
    value: product.id,
    label: `${product.name}${product.code ? ` (${product.code})` : ''}`
  }));
  const summary = summarizeBom(items, finishedProduct);

  const addItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: generateId(),
        material_id: '',
        material_name: '',
        material_code: '',
        quantity: 1,
        unit: 'PCS',
        notes: '',
        cost_price: 0,
        stock: 0,
        min_stock: 0
      }
    ]);
  };

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        if (field === 'material_id') {
          return enrichMaterial(products, value, { ...item, material_id: value });
        }
        return { ...item, [field]: value };
      })
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const trimmedName = form.name.trim();
    const validItems = items.filter((item) => item.material_id);
    const materialIds = validItems.map((item) => item.material_id);
    const hasDuplicates = new Set(materialIds).size !== materialIds.length;

    if (!trimmedName) {
      setError('BOM name is required.');
      return;
    }

    if (!form.product_id) {
      setError('Select the finished product for this BOM.');
      return;
    }

    if (validItems.length === 0) {
      setError('Add at least one material or component.');
      return;
    }

    if (hasDuplicates) {
      setError('Each material should appear only once. Increase quantity instead of adding duplicates.');
      return;
    }

    setError('');

    let bomId = bom?.id;
    if (bomId) {
      await db.run(
        'UPDATE bom SET name=?,product_id=?,version=?,description=? WHERE id=?',
        [trimmedName, form.product_id, form.version, form.description, bomId]
      );
      await db.run('DELETE FROM bom_items WHERE bom_id=?', [bomId]);
    } else {
      bomId = generateId();
      await db.run(
        'INSERT INTO bom (id,name,product_id,version,description) VALUES (?,?,?,?,?)',
        [bomId, trimmedName, form.product_id, form.version, form.description]
      );
    }

    for (const item of validItems) {
      await db.run(
        'INSERT INTO bom_items (id,bom_id,material_id,quantity,unit,notes) VALUES (?,?,?,?,?,?)',
        [
          generateId(),
          bomId,
          item.material_id,
          Number(item.quantity) || 0,
          item.unit,
          item.notes
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
              <Layers size={18} />
            </div>
            <div>
              <h3>{bom ? 'Edit Bill of Materials' : 'Create Bill of Materials'}</h3>
              <p>Define product structure, control component risk, and estimate build cost before release.</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="catalogue-modal-insights">
              <div className="catalogue-modal-insight">
                <span className="catalogue-modal-insight-label">Component Count</span>
                <strong>{summary.componentCount}</strong>
                <span className="text-muted text-sm">Active materials in this BOM</span>
              </div>
              <div className="catalogue-modal-insight">
                <span className="catalogue-modal-insight-label">Estimated Build Cost</span>
                <strong>{formatCurrency(summary.estimatedCost, currencySymbol)}</strong>
                <span className="text-muted text-sm">Rolled up from component cost prices</span>
              </div>
              <div className="catalogue-modal-insight">
                <span className="catalogue-modal-insight-label">Material Risk</span>
                <strong>{summary.riskCount}</strong>
                <span className={summary.riskCount > 0 ? 'text-warning text-sm' : 'text-success text-sm'}>
                  {summary.riskCount > 0 ? 'Needs supply attention' : 'Ready for build'}
                </span>
              </div>
              <div className="catalogue-modal-insight">
                <span className="catalogue-modal-insight-label">Estimated Gross Margin</span>
                <strong>{summary.grossMargin.toFixed(1)}%</strong>
                <span className="text-muted text-sm">
                  {finishedProduct ? `${formatCurrency(summary.grossProfit, currencySymbol)} gross profit` : 'Select a finished product'}
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
                <h4>BOM Identity</h4>
                <span>ERP-grade BOMs should clearly connect a finished product, revision, and engineering intent.</span>
              </div>
              <div className="grid-3">
                <div className="form-group">
                  <label className="form-label">BOM Name *</label>
                  <input
                    className="form-control"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    required
                    placeholder="e.g. Distribution Panel 63A"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Finished Product *</label>
                  <SearchableSelect
                    value={form.product_id}
                    onChange={(nextValue) => setForm((prev) => ({ ...prev, product_id: nextValue }))}
                    options={productOptions}
                    placeholder="Write finished product..."
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Version</label>
                  <input
                    className="form-control"
                    value={form.version}
                    onChange={(e) => setForm((prev) => ({ ...prev, version: e.target.value }))}
                    placeholder="e.g. 1.0"
                  />
                </div>
              </div>
            </div>

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header bom-section-head">
                <div>
                  <h4>Materials / Components</h4>
                  <span>Good BOM editors surface line cost, stock posture, and duplicate-entry mistakes immediately.</span>
                </div>
                <button type="button" className="btn btn-secondary btn-sm" onClick={addItem}>
                  <Plus size={13} /> Add Material
                </button>
              </div>

              <div className="bom-line-grid bom-line-grid-head">
                <span>Material</span>
                <span>Qty</span>
                <span>Unit</span>
                <span>Stock</span>
                <span>Unit Cost</span>
                <span>Line Total</span>
                <span>Notes</span>
                <span></span>
              </div>

              <div className="bom-line-list">
                {items.length === 0 ? (
                  <div className="bom-empty-lines">
                    <Layers size={28} />
                    <span>No materials added yet. Start with the primary components used in production.</span>
                  </div>
                ) : items.map((item) => {
                  const risk = getMaterialRisk(item);
                  const lineTotal = (Number(item.cost_price) || 0) * (Number(item.quantity) || 0);
                  return (
                    <div key={item.id} className="bom-line-grid bom-line-item">
                      <div>
                        <SearchableSelect
                          value={item.material_id}
                          onChange={(nextValue) => updateItem(item.id, 'material_id', nextValue)}
                          options={productOptions}
                          placeholder="Write material name..."
                          clearable
                        />
                        {item.material_id && (
                          <div className="bom-line-meta">
                            <span className="font-mono text-sm text-accent">{item.material_code || 'No code'}</span>
                            <span className={`bom-risk-pill tone-${risk.tone}`}>{risk.label}</span>
                          </div>
                        )}
                      </div>
                      <input
                        type="number"
                        className="form-control"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                        min="0.001"
                        step="0.001"
                      />
                      <div className="bom-static-field">{item.unit || '-'}</div>
                      <div className="bom-static-field">
                        {item.material_id ? `${Number(item.stock) || 0} ${item.unit}` : '-'}
                      </div>
                      <div className="bom-static-field">
                        {item.material_id ? formatCurrency(item.cost_price, currencySymbol) : '-'}
                      </div>
                      <div className="bom-static-field font-semibold">
                        {item.material_id ? formatCurrency(lineTotal, currencySymbol) : '-'}
                      </div>
                      <input
                        className="form-control"
                        value={item.notes || ''}
                        onChange={(e) => updateItem(item.id, 'notes', e.target.value)}
                        placeholder="Optional note"
                      />
                      <button
                        type="button"
                        className="btn btn-danger btn-icon btn-sm"
                        onClick={() => removeItem(item.id)}
                        title="Remove material"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header">
                <h4>Engineering Notes</h4>
                <span>Describe intended use, assembly assumptions, or revision purpose for downstream teams.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  value={form.description}
                  onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                />
              </div>
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

export default function BOMPro() {
  const { settings } = useAppStore();
  const [boms, setBoms] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [healthFilter, setHealthFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);

    const [bomRows, bomItems, productRows] = await Promise.all([
      db.all(
        `SELECT b.*, p.name as product_name, p.code as product_code, p.selling_price
         FROM bom b
         LEFT JOIN products p ON b.product_id = p.id
         WHERE b.is_active = 1
         ORDER BY b.name`
      ),
      db.all(
        `SELECT bi.*, p.name as material_name, p.code as material_code, p.cost_price, p.min_stock,
          p.unit as product_unit, COALESCE(i.quantity, 0) as stock
         FROM bom_items bi
         JOIN products p ON p.id = bi.material_id
         LEFT JOIN inventory i ON i.product_id = p.id`
      ),
      db.all(
        `SELECT p.*, COALESCE(i.quantity, 0) as stock
         FROM products p
         LEFT JOIN inventory i ON i.product_id = p.id
         WHERE p.is_active = 1
         ORDER BY p.name`
      )
    ]);

    const itemMap = bomItems.reduce((acc, item) => {
      if (!acc[item.bom_id]) acc[item.bom_id] = [];
      acc[item.bom_id].push({
        ...item,
        unit: item.unit || item.product_unit,
        cost_price: Number(item.cost_price) || 0,
        stock: Number(item.stock) || 0,
        min_stock: Number(item.min_stock) || 0,
        quantity: Number(item.quantity) || 0
      });
      return acc;
    }, {});

    const enrichedBoms = bomRows.map((bom) => {
      const items = itemMap[bom.id] || [];
      const summary = summarizeBom(items, bom);
      const searchHaystack = [
        bom.name,
        bom.product_name,
        bom.product_code,
        bom.version,
        ...items.map((item) => item.material_name),
        ...items.map((item) => item.material_code)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return {
        ...bom,
        items,
        item_count: summary.componentCount,
        estimated_cost: summary.estimatedCost,
        risk_count: summary.riskCount,
        gross_margin: summary.grossMargin,
        searchHaystack
      };
    });

    setBoms(enrichedBoms);
    setProducts(productRows.map((product) => ({
      ...product,
      cost_price: Number(product.cost_price) || 0,
      selling_price: Number(product.selling_price) || 0,
      min_stock: Number(product.min_stock) || 0,
      stock: Number(product.stock) || 0
    })));
    setLoading(false);
  };

  const filtered = boms.filter((bom) => {
    const query = search.trim().toLowerCase();
    const matchSearch = !query || bom.searchHaystack.includes(query);
    const matchHealth =
      healthFilter === 'all' ||
      (healthFilter === 'ready' && bom.risk_count === 0) ||
      (healthFilter === 'attention' && bom.risk_count > 0) ||
      (healthFilter === 'complex' && bom.item_count >= 5);

    return matchSearch && matchHealth;
  });

  const sym = settings?.currency_symbol || DEFAULT_CURRENCY;
  const totalEstimatedCost = boms.reduce((sum, bom) => sum + (Number(bom.estimated_cost) || 0), 0);
  const totalComponents = boms.reduce((sum, bom) => sum + (Number(bom.item_count) || 0), 0);
  const averageComponents = boms.length ? totalComponents / boms.length : 0;
  const atRiskBoms = boms.filter((bom) => bom.risk_count > 0).length;
  const highestCostBom = [...boms].sort((a, b) => (b.estimated_cost || 0) - (a.estimated_cost || 0))[0];
  const healthiestCount = boms.filter((bom) => bom.risk_count === 0).length;

  const healthTabs = [
    { key: 'all', label: 'All BOMs', count: boms.length },
    { key: 'ready', label: 'Production Ready', count: healthiestCount },
    { key: 'attention', label: 'Needs Attention', count: atRiskBoms },
    { key: 'complex', label: 'Complex Builds', count: boms.filter((bom) => bom.item_count >= 5).length }
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Bill of Materials</h2>
          <span className="page-subtitle">{boms.length} BOMs defined</span>
        </div>
        <button className="btn btn-primary" onClick={() => setModal({})}>
          <Plus size={15} /> Create BOM
        </button>
      </div>

      <div className="catalogue-hero">
        <div className="catalogue-hero-main">
          <div className="catalogue-hero-kicker">
            <Sparkles size={14} />
            <span>Manufacturing structure workspace</span>
          </div>
          <h3>Design BOMs with cost, revision, and component readiness in view.</h3>
          <p>
            Leading ERP manufacturing modules treat BOMs as controlled business objects: versioned, analyzable, and connected to component availability before production starts.
          </p>
          <div className="catalogue-chip-row">
            <span className="catalogue-chip">Version control for engineering changes</span>
            <span className="catalogue-chip">Live material risk visibility</span>
            <span className="catalogue-chip">Cost rollup before manufacturing</span>
          </div>
        </div>
        <div className="catalogue-hero-side">
          <div className="catalogue-hero-side-label">Release Posture</div>
          <strong>{atRiskBoms === 0 ? 'Stable' : `${atRiskBoms} BOMs at risk`}</strong>
          <span>{healthiestCount} BOMs have no low-stock inputs right now.</span>
        </div>
      </div>

      <div className="catalogue-stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{boms.length}</div>
            <div className="stat-card-label">Active BOMs</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
            <Layers size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{averageComponents.toFixed(1)}</div>
            <div className="stat-card-label">Avg Components</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(6, 182, 212, 0.12)', color: 'var(--info)' }}>
            <Boxes size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{atRiskBoms}</div>
            <div className="stat-card-label">Material Risks</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}>
            <AlertTriangle size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{formatCurrency(totalEstimatedCost, sym)}</div>
            <div className="stat-card-label">Rolled-up Cost</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <BadgeIndianRupee size={20} />
          </div>
        </div>
      </div>

      <div className="catalogue-summary-grid">
        <div className="catalogue-summary-card">
          <div className="catalogue-summary-title">Highest Cost BOM</div>
          <strong>{highestCostBom ? highestCostBom.name : '-'}</strong>
          <span className="text-muted text-sm">
            {highestCostBom ? formatCurrency(highestCostBom.estimated_cost, sym) : 'No BOMs yet'}
          </span>
        </div>
        <div className="catalogue-summary-card">
          <div className="catalogue-summary-title">Production-ready BOMs</div>
          <strong>{healthiestCount}/{boms.length}</strong>
          <span className="text-muted text-sm">No low-stock or out-of-stock material lines.</span>
        </div>
        <div className="catalogue-summary-card">
          <div className="catalogue-summary-title">Revision Discipline</div>
          <strong>{boms.filter((bom) => bom.version).length}/{boms.length}</strong>
          <span className="text-muted text-sm">BOMs carrying explicit version identifiers.</span>
        </div>
      </div>

      <div className="filter-bar">
        <div className="search-bar">
          <Search size={14} color="var(--text-muted)" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by BOM, product, version, or material..."
          />
        </div>
        <div className="catalogue-tab-strip">
          {healthTabs.map((tab) => (
            <button
              key={tab.key}
              className={`catalogue-tab-pill ${healthFilter === tab.key ? 'active' : ''}`}
              onClick={() => setHealthFilter(tab.key)}
            >
              <span>{tab.label}</span>
              <strong>{tab.count}</strong>
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
                <th>BOM</th>
                <th>Finished Product</th>
                <th>Revision</th>
                <th>Structure</th>
                <th>Cost / Margin</th>
                <th>Readiness</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="text-center text-muted" style={{ padding: 40 }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><Layers size={40} /><p>No BOMs created yet</p></div></td></tr>
              ) : filtered.map((bom) => (
                <tr key={bom.id} onDoubleClick={() => setModal(bom)} className="catalogue-row">
                  <td>
                    <div className="catalogue-product-cell">
                      <div className="catalogue-product-avatar">
                        <Layers size={16} />
                      </div>
                      <div>
                        <div className="catalogue-product-title">{bom.name}</div>
                        <div className="catalogue-product-meta">
                          <span className="font-mono text-sm text-accent">{bom.id?.slice(0, 8)}</span>
                          <span>{bom.description ? bom.description.substring(0, 42) : 'No description'}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="bom-product-block">
                      <strong>{bom.product_name || 'Unlinked product'}</strong>
                      <span className="text-muted text-sm">{bom.product_code || 'No product code'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="bom-revision-pill">
                      <GitBranch size={12} />
                      <span>v{bom.version || '1.0'}</span>
                    </div>
                  </td>
                  <td>
                    <div className="bom-structure-block">
                      <strong>{bom.item_count} items</strong>
                      <span className="text-muted text-sm">
                        {bom.item_count > 0 ? `${bom.items[0]?.material_name || ''}${bom.item_count > 1 ? ` + ${bom.item_count - 1} more` : ''}` : 'No components'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="bom-structure-block">
                      <strong>{formatCurrency(bom.estimated_cost, sym)}</strong>
                      <span className={bom.gross_margin >= 0 ? 'text-success text-sm' : 'text-danger text-sm'}>
                        {bom.gross_margin.toFixed(1)}% gross margin
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className={`bom-readiness-card ${bom.risk_count > 0 ? 'attention' : 'healthy'}`}>
                      <div className="bom-readiness-head">
                        {bom.risk_count > 0 ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
                        <strong>{bom.risk_count > 0 ? `${bom.risk_count} risks` : 'Ready'}</strong>
                      </div>
                      <span>{bom.risk_count > 0 ? 'Materials need replenishment review' : 'Component stock supports build'}</span>
                    </div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setModal(bom)} title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button
                        className="btn btn-danger btn-icon btn-sm"
                        onClick={async () => {
                          if (window.confirm('Mark this BOM as inactive?')) {
                            await db.run('UPDATE bom SET is_active=0 WHERE id=?', [bom.id]);
                            loadData();
                          }
                        }}
                        title="Delete"
                      >
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
        <BOMModal
          bom={modal?.id ? modal : null}
          products={products}
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
