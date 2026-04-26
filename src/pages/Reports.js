import React, { useState, useEffect } from 'react';
import db, { formatCurrency, formatDate } from '../utils/database';
import { BarChart2, Download, TrendingUp, Package, Users, Truck } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const COLORS = ['#3d7fff', '#22c55e', '#f59e0b', '#ef4444', '#a78bfa', '#06b6d4'];

export default function Reports() {
  const [activeReport, setActiveReport] = useState('stock');
  const [stockReport, setStockReport] = useState([]);
  const [orderReport, setOrderReport] = useState([]);
  const [vendorReport, setVendorReport] = useState([]);
  const [categoryReport, setCategoryReport] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadReports(); }, []);

  const loadReports = async () => {
    setLoading(true);
    const [stock, orders, vendors, cats] = await Promise.all([
      db.all(`SELECT p.name, p.code, p.unit, i.quantity, p.min_stock, p.cost_price, 
        (i.quantity * p.cost_price) as total_value, c.name as category
        FROM inventory i JOIN products p ON i.product_id = p.id
        LEFT JOIN categories c ON p.category_id = c.id
        WHERE p.is_active=1 ORDER BY total_value DESC`),
      db.all(`SELECT strftime('%Y-%m', created_at) as month, 
        COUNT(*) as order_count, SUM(total_amount) as revenue,
        status FROM orders GROUP BY month, status ORDER BY month DESC LIMIT 12`),
      db.all(`SELECT c.name, COUNT(g.id) as grn_count, SUM(g.total_amount) as total_purchased
        FROM grn g LEFT JOIN contacts c ON g.vendor_id = c.id
        GROUP BY g.vendor_id ORDER BY total_purchased DESC LIMIT 10`),
      db.all(`SELECT cat.name, COUNT(p.id) as product_count, SUM(i.quantity * p.cost_price) as stock_value
        FROM categories cat LEFT JOIN products p ON cat.id = p.category_id
        LEFT JOIN inventory i ON p.id = i.product_id
        WHERE p.is_active=1 GROUP BY cat.id ORDER BY stock_value DESC`)
    ]);
    setStockReport(stock);
    setOrderReport(orders);
    setVendorReport(vendors);
    setCategoryReport(cats.map(c => ({ ...c, stock_value: c.stock_value || 0 })));
    setLoading(false);
  };

  const exportToCSV = (data, filename) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(','), ...data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename + '.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const reports = [
    { id: 'stock', label: 'Stock Report', icon: Package },
    { id: 'orders', label: 'Order Revenue', icon: TrendingUp },
    { id: 'vendor', label: 'Vendor Report', icon: Truck },
    { id: 'category', label: 'Category Analysis', icon: BarChart2 },
  ];

  const totalStockValue = stockReport.reduce((s, i) => s + (i.total_value || 0), 0);
  const lowStockCount = stockReport.filter(i => i.quantity <= i.min_stock).length;

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Reports & Analytics</h2>
          <span className="page-subtitle">Business insights and data export</span>
        </div>
        <button className="btn btn-secondary" onClick={loadReports}>↻ Refresh</button>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: '0 24px 16px' }}>
        {[
          { label: 'Total Stock Value', value: `₹${(totalStockValue / 1000).toFixed(1)}K`, color: 'var(--accent)' },
          { label: 'Low Stock Items', value: lowStockCount, color: 'var(--warning)' },
          { label: 'Total Products', value: stockReport.length, color: 'var(--success)' },
          { label: 'Active Vendors', value: vendorReport.length, color: 'var(--info)' },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: 'var(--font-mono)' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ padding: '0 24px 12px', display: 'flex', gap: 8 }}>
        {reports.map(r => (
          <button key={r.id} className={`btn ${activeReport === r.id ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveReport(r.id)}>
            <r.icon size={13} /> {r.label}
          </button>
        ))}
      </div>

      <div className="page-content">
        {activeReport === 'stock' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="grid-2">
              <div className="card">
                <div className="card-header">
                  <h4>Stock by Category</h4>
                </div>
                <div style={{ height: 220, padding: '16px 8px 8px' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={categoryReport} dataKey="stock_value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                        {categoryReport.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={v => `₹${(v / 1000).toFixed(1)}K`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="card">
                <div className="card-header">
                  <h4>Top Value Items</h4>
                </div>
                <div style={{ height: 220, padding: '16px 0 8px' }}>
                  <ResponsiveContainer>
                    <BarChart data={stockReport.slice(0, 8)} layout="vertical" margin={{ left: 60, right: 20 }}>
                      <XAxis type="number" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}K`} />
                      <YAxis type="category" dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 10 }} axisLine={false} tickLine={false} width={55} />
                      <Tooltip formatter={v => `₹${v.toLocaleString('en-IN')}`} />
                      <Bar dataKey="total_value" fill="#3d7fff" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h4>Full Stock Report</h4>
                <button className="btn btn-secondary btn-sm" onClick={() => exportToCSV(stockReport, 'stock_report')}>
                  <Download size={13} /> Export CSV
                </button>
              </div>
              <div className="table-container" style={{ maxHeight: 300 }}>
                <table className="data-table">
                  <thead>
                    <tr><th>Product</th><th>Code</th><th>Category</th><th>Stock</th><th>Min</th><th>Cost/Unit</th><th>Total Value</th><th>Status</th></tr>
                  </thead>
                  <tbody>
                    {stockReport.map((item, i) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 500 }}>{item.name}</td>
                        <td><span className="font-mono text-sm text-muted">{item.code}</span></td>
                        <td className="text-secondary">{item.category || '-'}</td>
                        <td className="font-mono">{item.quantity} {item.unit}</td>
                        <td className="text-muted">{item.min_stock}</td>
                        <td className="font-mono">₹{item.cost_price}</td>
                        <td className="font-mono font-semibold">₹{(item.total_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td>
                          {item.quantity === 0
                            ? <span className="badge badge-danger">Out</span>
                            : item.quantity <= item.min_stock
                            ? <span className="badge badge-warning">Low</span>
                            : <span className="badge badge-success">OK</span>}
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
          <div className="card">
            <div className="card-header">
              <h4>Monthly Order Revenue</h4>
              <button className="btn btn-secondary btn-sm" onClick={() => exportToCSV(orderReport, 'order_report')}>
                <Download size={13} /> Export CSV
              </button>
            </div>
            <div style={{ height: 280, padding: '16px 8px 8px' }}>
              <ResponsiveContainer>
                <BarChart data={Object.values(orderReport.reduce((acc, o) => {
                  if (!acc[o.month]) acc[o.month] = { month: o.month, revenue: 0, orders: 0 };
                  acc[o.month].revenue += o.revenue || 0;
                  acc[o.month].orders += o.order_count || 0;
                  return acc;
                }, {})).reverse()}>
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v, n) => n === 'revenue' ? `₹${v.toLocaleString('en-IN')}` : v} />
                  <Bar dataKey="revenue" fill="#3d7fff" radius={[4, 4, 0, 0]} name="Revenue" />
                </BarChart>
              </ResponsiveContainer>
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
                  <tr><th>#</th><th>Vendor</th><th>GRN Count</th><th>Total Purchased</th></tr>
                </thead>
                <tbody>
                  {vendorReport.length === 0 ? (
                    <tr><td colSpan={4} className="text-center text-muted" style={{ padding: 40 }}>No vendor data available</td></tr>
                  ) : vendorReport.map((v, i) => (
                    <tr key={i}>
                      <td className="text-muted">{i + 1}</td>
                      <td style={{ fontWeight: 500 }}>{v.name || 'Unknown'}</td>
                      <td><span className="badge badge-info">{v.grn_count} GRNs</span></td>
                      <td className="font-mono font-semibold">₹{(v.total_purchased || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeReport === 'category' && (
          <div className="card">
            <div className="card-header">
              <h4>Category-wise Stock Analysis</h4>
              <button className="btn btn-secondary btn-sm" onClick={() => exportToCSV(categoryReport, 'category_report')}>
                <Download size={13} /> Export CSV
              </button>
            </div>
            <div style={{ height: 260, padding: '16px 8px 8px' }}>
              <ResponsiveContainer>
                <BarChart data={categoryReport}>
                  <XAxis dataKey="name" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}K`} />
                  <Tooltip formatter={v => `₹${(v || 0).toLocaleString('en-IN')}`} />
                  <Bar dataKey="stock_value" fill="#22c55e" radius={[4, 4, 0, 0]} name="Stock Value" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr><th>Category</th><th>Products</th><th>Stock Value</th></tr>
                </thead>
                <tbody>
                  {categoryReport.map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{c.name}</td>
                      <td><span className="badge badge-secondary">{c.product_count} items</span></td>
                      <td className="font-mono font-semibold">₹{(c.stock_value || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
