import React, { useEffect, useMemo, useState } from 'react';
import db, { formatCurrency } from '../utils/database';
import {
  BarChart2,
  Download,
  Package,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Truck,
  Users
} from 'lucide-react';
import { BarChart, Bar, Cell, PieChart, Pie, ResponsiveContainer, Tooltip, XAxis, YAxis, LineChart, Line, CartesianGrid } from 'recharts';
import { useAppStore } from '../store/appStore';

const DEFAULT_CURRENCY = '\u20B9';
const COLORS = ['#3d7fff', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#a78bfa'];

function exportToCSV(data, filename) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const csv = [headers.join(','), ...data.map((row) => headers.map((header) => `"${row[header] ?? ''}"`).join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${filename}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPro() {
  const { settings } = useAppStore();
  const [activeReport, setActiveReport] = useState('stock');
  const [stockReport, setStockReport] = useState([]);
  const [orderReport, setOrderReport] = useState([]);
  const [vendorReport, setVendorReport] = useState([]);
  const [categoryReport, setCategoryReport] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    setLoading(true);
    const [stock, orders, vendors, categories] = await Promise.all([
      db.all(`SELECT p.name, p.code, p.unit, i.quantity, p.min_stock, p.cost_price,
        (i.quantity * p.cost_price) as total_value, c.name as category
        FROM inventory i
        JOIN products p ON i.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_active=1
        ORDER BY total_value DESC`),
      db.all(`SELECT strftime('%Y-%m', created_at) as month,
        COUNT(*) as order_count, SUM(total_amount) as revenue, status
        FROM orders
        GROUP BY month, status
        ORDER BY month DESC
        LIMIT 18`),
      db.all(`SELECT c.name, COUNT(g.id) as grn_count, SUM(g.total_amount) as total_purchased
        FROM grn g
        LEFT JOIN contacts c ON g.vendor_id = c.id
        GROUP BY g.vendor_id
        ORDER BY total_purchased DESC
        LIMIT 10`),
      db.all(`SELECT cat.name, COUNT(p.id) as product_count, SUM(i.quantity * p.cost_price) as stock_value
        FROM categories cat
        LEFT JOIN products p ON cat.id = p.category_id
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE p.is_active=1
        GROUP BY cat.id
        ORDER BY stock_value DESC`)
    ]);

    setStockReport(stock);
    setOrderReport(orders);
    setVendorReport(vendors);
    setCategoryReport(categories.map((item) => ({ ...item, stock_value: item.stock_value || 0 })));
    setLoading(false);
  };

  const sym = settings?.currency_symbol || DEFAULT_CURRENCY;
  const totalStockValue = stockReport.reduce((sum, item) => sum + (Number(item.total_value) || 0), 0);
  const lowStockCount = stockReport.filter((item) => Number(item.quantity) <= Number(item.min_stock)).length;
  const activeVendors = vendorReport.filter((item) => Number(item.total_purchased) > 0).length;
  const consolidatedOrderTrend = Object.values(
    orderReport.reduce((acc, row) => {
      if (!acc[row.month]) acc[row.month] = { month: row.month, revenue: 0, orders: 0 };
      acc[row.month].revenue += Number(row.revenue) || 0;
      acc[row.month].orders += Number(row.order_count) || 0;
      return acc;
    }, {})
  ).reverse();
  const recentRevenue = consolidatedOrderTrend.reduce((sum, row) => sum + (Number(row.revenue) || 0), 0);

  const reports = [
    { id: 'stock', label: 'Stock Command', icon: Package },
    { id: 'orders', label: 'Revenue Trend', icon: TrendingUp },
    { id: 'vendor', label: 'Vendor Spend', icon: Truck },
    { id: 'category', label: 'Category Mix', icon: BarChart2 }
  ];

  const heroCopy = useMemo(() => {
    if (activeReport === 'orders') {
      return {
        title: 'See revenue movement and order throughput before it becomes a backlog problem.',
        subtitle: 'Commercial reporting should explain momentum, not just dump order rows.'
      };
    }
    if (activeReport === 'vendor') {
      return {
        title: 'Understand where procurement spend is concentrating across your vendor base.',
        subtitle: 'Smart ERP reporting turns receipts into supplier intelligence.'
      };
    }
    if (activeReport === 'category') {
      return {
        title: 'Read category concentration so inventory value is easier to rebalance.',
        subtitle: 'Category dashboards should reveal value exposure, not only quantity.'
      };
    }
    return {
      title: 'Run stock, commercial, and procurement decisions from one reporting workspace.',
      subtitle: 'Best-in-class ERP reporting turns raw data into immediate operating insight.'
    };
  }, [activeReport]);

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Reports & Analytics</h2>
          <span className="page-subtitle">Business insight, exports, and operating signals</span>
        </div>
        <button className="btn btn-secondary" onClick={loadReports}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="catalogue-hero">
        <div className="catalogue-hero-main">
          <div className="catalogue-hero-kicker">
            <Sparkles size={14} />
            <span>Executive analytics workspace</span>
          </div>
          <h3>{heroCopy.title}</h3>
          <p>{heroCopy.subtitle}</p>
          <div className="catalogue-chip-row">
            <span className="catalogue-chip">Inventory value concentration</span>
            <span className="catalogue-chip">Revenue momentum tracking</span>
            <span className="catalogue-chip">Vendor spend visibility</span>
          </div>
        </div>
        <div className="catalogue-hero-side">
          <div className="catalogue-hero-side-label">Recent Revenue</div>
          <strong>{formatCurrency(recentRevenue, sym)}</strong>
          <span>Aggregated from the loaded order history window.</span>
        </div>
      </div>

      <div className="catalogue-stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{formatCurrency(totalStockValue, sym)}</div>
            <div className="stat-card-label">Stock Value</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
            <Package size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{lowStockCount}</div>
            <div className="stat-card-label">Low Stock Items</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}>
            <TrendingUp size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{stockReport.length}</div>
            <div className="stat-card-label">Tracked Products</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(6, 182, 212, 0.12)', color: 'var(--info)' }}>
            <BarChart2 size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{activeVendors}</div>
            <div className="stat-card-label">Active Vendors</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <Users size={20} />
          </div>
        </div>
      </div>

      <div className="reports-tab-row">
        {reports.map((report) => (
          <button
            key={report.id}
            className={`btn ${activeReport === report.id ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveReport(report.id)}
          >
            <report.icon size={13} /> {report.label}
          </button>
        ))}
      </div>

      <div className="page-content">
        {activeReport === 'stock' && (
          <div className="reports-stack">
            <div className="grid-2">
              <div className="card">
                <div className="card-header">
                  <h4>Stock Value by Category</h4>
                </div>
                <div className="reports-chart-wrap">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={categoryReport}
                        dataKey="stock_value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={86}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        labelLine={false}
                      >
                        {categoryReport.map((item, index) => (
                          <Cell key={`${item.name}-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value || 0, sym)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h4>Top Value Items</h4>
                </div>
                <div className="reports-chart-wrap">
                  <ResponsiveContainer>
                    <BarChart data={stockReport.slice(0, 8)} layout="vertical" margin={{ left: 60, right: 20 }}>
                      <XAxis
                        type="number"
                        tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(value) => `${Math.round((value || 0) / 1000)}K`}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                        axisLine={false}
                        tickLine={false}
                        width={60}
                      />
                      <Tooltip formatter={(value) => formatCurrency(value || 0, sym)} />
                      <Bar dataKey="total_value" fill="#3d7fff" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h4>Detailed Stock Report</h4>
                <button className="btn btn-secondary btn-sm" onClick={() => exportToCSV(stockReport, 'stock_report')}>
                  <Download size={13} /> Export CSV
                </button>
              </div>
              <div className="table-container" style={{ maxHeight: 340 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Code</th>
                      <th>Category</th>
                      <th>Stock</th>
                      <th>Min</th>
                      <th>Cost / Unit</th>
                      <th>Total Value</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockReport.map((item, index) => (
                      <tr key={`${item.code}-${index}`}>
                        <td style={{ fontWeight: 500 }}>{item.name}</td>
                        <td><span className="font-mono text-sm text-muted">{item.code}</span></td>
                        <td className="text-secondary">{item.category || '-'}</td>
                        <td className="font-mono">{item.quantity} {item.unit}</td>
                        <td className="text-muted">{item.min_stock}</td>
                        <td className="font-mono">{formatCurrency(item.cost_price || 0, sym)}</td>
                        <td className="font-mono font-semibold">{formatCurrency(item.total_value || 0, sym)}</td>
                        <td>
                          {Number(item.quantity) === 0 ? (
                            <span className="badge badge-danger">Out</span>
                          ) : Number(item.quantity) <= Number(item.min_stock) ? (
                            <span className="badge badge-warning">Low</span>
                          ) : (
                            <span className="badge badge-success">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeReport === 'orders' && (
          <div className="reports-stack">
            <div className="card">
              <div className="card-header">
                <h4>Monthly Order Revenue</h4>
                <button className="btn btn-secondary btn-sm" onClick={() => exportToCSV(orderReport, 'order_report')}>
                  <Download size={13} /> Export CSV
                </button>
              </div>
              <div className="reports-chart-wrap">
                <ResponsiveContainer>
                  <LineChart data={consolidatedOrderTrend}>
                    <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round((value || 0) / 1000)}K`} />
                    <Tooltip formatter={(value, name) => name === 'revenue' ? formatCurrency(value || 0, sym) : value} />
                    <Line type="monotone" dataKey="revenue" stroke="#3d7fff" strokeWidth={3} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="grid-2">
              <div className="card">
                <div className="card-header">
                  <h4>Order Throughput</h4>
                </div>
                <div className="reports-chart-wrap">
                  <ResponsiveContainer>
                    <BarChart data={consolidatedOrderTrend}>
                      <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                      <Tooltip />
                      <Bar dataKey="orders" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h4>Status Split</h4>
                </div>
                <div className="reports-chart-wrap">
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie
                        data={Object.entries(orderReport.reduce((acc, item) => {
                          acc[item.status] = (acc[item.status] || 0) + (Number(item.order_count) || 0);
                          return acc;
                        }, {})).map(([status, count]) => ({ status, count }))}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        outerRadius={86}
                      >
                        {orderReport.map((item, index) => (
                          <Cell key={`${item.status}-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name, ctx) => `${ctx.payload.status}: ${value}`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeReport === 'vendor' && (
          <div className="card">
            <div className="card-header">
              <h4>Vendor Purchase Report</h4>
              <button className="btn btn-secondary btn-sm" onClick={() => exportToCSV(vendorReport, 'vendor_report')}>
                <Download size={13} /> Export CSV
              </button>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Vendor</th>
                    <th>GRN Count</th>
                    <th>Total Purchased</th>
                  </tr>
                </thead>
                <tbody>
                  {vendorReport.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-muted" style={{ padding: 40 }}>No vendor data available</td></tr>
                  ) : vendorReport.map((vendor, index) => (
                    <tr key={`${vendor.name}-${index}`}>
                      <td className="text-muted">{index + 1}</td>
                      <td style={{ fontWeight: 500 }}>{vendor.name || 'Unknown'}</td>
                      <td><span className="badge badge-info">{vendor.grn_count} GRNs</span></td>
                      <td className="font-mono font-semibold">{formatCurrency(vendor.total_purchased || 0, sym)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === 'category' && (
          <div className="reports-stack">
            <div className="card">
              <div className="card-header">
                <h4>Category-wise Stock Analysis</h4>
                <button className="btn btn-secondary btn-sm" onClick={() => exportToCSV(categoryReport, 'category_report')}>
                  <Download size={13} /> Export CSV
                </button>
              </div>
              <div className="reports-chart-wrap">
                <ResponsiveContainer>
                  <BarChart data={categoryReport}>
                    <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(value) => `${Math.round((value || 0) / 1000)}K`} />
                    <Tooltip formatter={(value) => formatCurrency(value || 0, sym)} />
                    <Bar dataKey="stock_value" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h4>Category Detail</h4>
              </div>
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Products</th>
                      <th>Stock Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categoryReport.map((category, index) => (
                      <tr key={`${category.name}-${index}`}>
                        <td style={{ fontWeight: 500 }}>{category.name}</td>
                        <td><span className="badge badge-secondary">{category.product_count} items</span></td>
                        <td className="font-mono font-semibold">{formatCurrency(category.stock_value || 0, sym)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {loading && <div className="text-center text-muted mt-4">Refreshing reports...</div>}
      </div>
    </div>
  );
}
