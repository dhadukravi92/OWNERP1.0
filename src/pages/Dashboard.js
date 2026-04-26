import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/appStore';
import db, { formatCurrency, formatDate } from '../utils/database';
import {
  AlertTriangle, ArrowRight, Boxes, Briefcase, CheckCircle, ClipboardList,
  Clock3, FileText, Flame, LayoutGrid, Package, ShoppingCart, Sparkles,
  TrendingUp, Truck, Users, Wallet, Zap
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';

const chartColors = ['#3d7fff', '#22c55e', '#f59e0b', '#a78bfa', '#06b6d4', '#f97316'];

const MoneyTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(13, 18, 30, 0.96)', border: '1px solid rgba(61, 127, 255, 0.24)', borderRadius: 12, padding: '10px 12px', backdropFilter: 'blur(8px)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      {payload.map((entry) => (
        <div key={entry.dataKey} style={{ color: entry.color, fontSize: 12, fontWeight: 600 }}>
          {entry.name}: {formatCurrency(entry.value || 0)}
        </div>
      ))}
    </div>
  );
};

const CountTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'rgba(13, 18, 30, 0.96)', border: '1px solid rgba(61, 127, 255, 0.24)', borderRadius: 12, padding: '10px 12px', backdropFilter: 'blur(8px)' }}>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ color: payload[0].color, fontSize: 12, fontWeight: 600 }}>{payload[0].value} orders</div>
    </div>
  );
};

const TrendChip = ({ value, label, tone = 'var(--accent)' }) => (
  <div
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      padding: '9px 12px',
      borderRadius: 999,
      border: `1px solid ${tone}33`,
      background: `${tone}14`,
      color: tone,
      fontSize: 12,
      fontWeight: 600
    }}
  >
    <span>{value}</span>
    <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</span>
  </div>
);

export default function Dashboard() {
  const { dashboardStats, loadDashboardStats, settings, currentUser, theme } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [recentOrders, setRecentOrders] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [orderStatusData, setOrderStatusData] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [headline, setHeadline] = useState({
    inventoryValue: 0,
    monthlyOrderValue: 0,
    monthlyOrderCount: 0,
    productionQueue: 0,
    deliveredThisMonth: 0,
    quotationValue: 0
  });

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    setLoading(true);
    await loadDashboardStats();

    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${`${now.getMonth() + 1}`.padStart(2, '0')}`;

    const [
      orders,
      stock,
      inventoryValueRow,
      orderValueRow,
      orderCountRow,
      productionQueueRow,
      deliveredRow,
      quotationValueRow,
      customerValueRows,
      orderStatusRows
    ] = await Promise.all([
      db.all(`SELECT o.*, c.name as customer_name, c.company as customer_company
        FROM orders o LEFT JOIN contacts c ON o.customer_id = c.id
        ORDER BY o.created_at DESC LIMIT 6`),
      db.all(`SELECT p.name, p.code, i.quantity, p.min_stock, p.unit, p.selling_price
        FROM inventory i JOIN products p ON i.product_id = p.id
        WHERE i.quantity <= p.min_stock
        ORDER BY (i.quantity - p.min_stock) ASC LIMIT 8`),
      db.get(`SELECT COALESCE(SUM(i.quantity * COALESCE(p.selling_price, 0)), 0) as total
        FROM inventory i JOIN products p ON i.product_id = p.id`),
      db.get(`SELECT COALESCE(SUM(total_amount), 0) as total
        FROM orders WHERE strftime('%Y-%m', created_at) = ?`, [yearMonth]),
      db.get(`SELECT COUNT(*) as count
        FROM orders WHERE strftime('%Y-%m', created_at) = ?`, [yearMonth]),
      db.get(`SELECT COUNT(*) as count FROM orders WHERE status = 'in_production'`),
      db.get(`SELECT COUNT(*) as count
        FROM orders WHERE status = 'delivered' AND strftime('%Y-%m', created_at) = ?`, [yearMonth]),
      db.get(`SELECT COALESCE(SUM(total_amount), 0) as total
        FROM quotations WHERE status IN ('draft', 'sent')`),
      db.all(`SELECT COALESCE(c.company, c.name, 'Walk-in') as customer_name,
          COALESCE(SUM(o.total_amount), 0) as total
        FROM orders o
        LEFT JOIN contacts c ON c.id = o.customer_id
        GROUP BY COALESCE(c.company, c.name, 'Walk-in')
        ORDER BY total DESC
        LIMIT 5`),
      db.all(`SELECT status, COUNT(*) as count
        FROM orders
        GROUP BY status
        ORDER BY count DESC`)
    ]);

    const months = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const mon = d.toLocaleString('en', { month: 'short' });
      const yr = d.getFullYear();
      const mon2 = `${d.getMonth() + 1}`.padStart(2, '0');
      const [orderRevenue, quoteRevenue, orderCount] = await Promise.all([
        db.get(`SELECT COALESCE(SUM(total_amount), 0) as total FROM orders WHERE strftime('%Y-%m', created_at) = ?`, [`${yr}-${mon2}`]),
        db.get(`SELECT COALESCE(SUM(total_amount), 0) as total FROM quotations WHERE strftime('%Y-%m', created_at) = ?`, [`${yr}-${mon2}`]),
        db.get(`SELECT COUNT(*) as count FROM orders WHERE strftime('%Y-%m', created_at) = ?`, [`${yr}-${mon2}`])
      ]);
      months.push({
        month: mon,
        revenue: orderRevenue?.total || 0,
        quotations: quoteRevenue?.total || 0,
        orders: orderCount?.count || 0
      });
    }

    setRecentOrders(orders || []);
    setLowStockItems(stock || []);
    setChartData(months);
    setTopCustomers(customerValueRows || []);
    setOrderStatusData((orderStatusRows || []).map((row, index) => ({
      ...row,
      fill: chartColors[index % chartColors.length]
    })));
    setHeadline({
      inventoryValue: inventoryValueRow?.total || 0,
      monthlyOrderValue: orderValueRow?.total || 0,
      monthlyOrderCount: orderCountRow?.count || 0,
      productionQueue: productionQueueRow?.count || 0,
      deliveredThisMonth: deliveredRow?.count || 0,
      quotationValue: quotationValueRow?.total || 0
    });
    setLoading(false);
  };

  const currencySymbol = settings?.currency_symbol || '\u20B9';
  const userName = currentUser?.full_name || 'Operator';
  const totalRevenueWindow = useMemo(() => chartData.reduce((sum, row) => sum + Number(row.revenue || 0), 0), [chartData]);
  const totalQuotationWindow = useMemo(() => chartData.reduce((sum, row) => sum + Number(row.quotations || 0), 0), [chartData]);

  const signalCards = [
    {
      label: 'Inventory Footprint',
      value: formatCurrency(headline.inventoryValue, currencySymbol),
      meta: `${dashboardStats.totalProducts} live SKUs under watch`,
      icon: Boxes,
      color: '#3d7fff',
      bg: 'rgba(61,127,255,0.12)'
    },
    {
      label: 'Monthly Order Intake',
      value: formatCurrency(headline.monthlyOrderValue, currencySymbol),
      meta: `${headline.monthlyOrderCount} orders booked this month`,
      icon: TrendingUp,
      color: '#22c55e',
      bg: 'rgba(34,197,94,0.12)'
    },
    {
      label: 'Commercial Pipeline',
      value: formatCurrency(headline.quotationValue, currencySymbol),
      meta: `${dashboardStats.pendingQuotations} quotations still active`,
      icon: Briefcase,
      color: '#a78bfa',
      bg: 'rgba(167,139,250,0.12)'
    },
    {
      label: 'Execution Pressure',
      value: `${headline.productionQueue}`,
      meta: `${dashboardStats.pendingOrders} order(s) waiting on fulfilment`,
      icon: Flame,
      color: '#f97316',
      bg: 'rgba(249,115,22,0.12)'
    }
  ];

  const operationsCards = [
    { label: 'Low Stock Risks', value: dashboardStats.lowStockItems, icon: AlertTriangle, color: '#f59e0b', meta: lowStockItems.length ? `${lowStockItems[0].name} is closest to stock floor` : 'No immediate stock break risk' },
    { label: 'Customers', value: dashboardStats.totalCustomers, icon: Users, color: '#22c55e', meta: topCustomers.length ? `${topCustomers[0].customer_name} leads order value` : 'Customer base is still empty' },
    { label: 'Vendors', value: dashboardStats.totalVendors, icon: Truck, color: '#06b6d4', meta: 'Supplier network linked to purchasing and inward' },
    { label: 'Delivered This Month', value: headline.deliveredThisMonth, icon: CheckCircle, color: '#10b981', meta: 'Closed deliveries contributing to revenue realization' }
  ];

  const statusMap = {
    pending: { label: 'Pending', cls: 'badge-warning' },
    in_production: { label: 'In Production', cls: 'badge-info' },
    shipped: { label: 'Shipped', cls: 'badge-success' },
    delivered: { label: 'Delivered', cls: 'badge-success' },
    cancelled: { label: 'Cancelled', cls: 'badge-danger' }
  };

  const getStatusBadge = (status) => {
    const meta = statusMap[status] || { label: status, cls: 'badge-secondary' };
    return <span className={`badge ${meta.cls}`}>{meta.label}</span>;
  };

  const quickActions = [
    { label: 'Create Order', route: '/orders', icon: ShoppingCart, tone: '#3d7fff' },
    { label: 'New Quotation', route: '/crm', icon: FileText, tone: '#a78bfa' },
    { label: 'Review Inventory', route: '/inventory', icon: Package, tone: '#06b6d4' },
    { label: 'Open Accounting', route: '/accounting', icon: Wallet, tone: '#22c55e' }
  ];
  const isLightTheme = theme === 'light';

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Dashboard</h2>
          <span className="page-subtitle">Operational command view for sales, stock, execution, and commercial momentum</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 14px',
              borderRadius: 999,
              border: '1px solid rgba(34,197,94,0.22)',
              background: 'rgba(34,197,94,0.10)',
              color: 'var(--success)',
              fontSize: 12,
              fontWeight: 600
            }}
          >
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--success)', animation: 'pulse 2s infinite' }} />
            System Online
          </div>
        </div>
      </div>

      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div
          style={{
            borderRadius: 24,
            padding: 24,
            border: '1px solid var(--border)',
            background: 'radial-gradient(circle at top right, rgba(61,127,255,0.22), transparent 28%), radial-gradient(circle at bottom left, rgba(34,197,94,0.10), transparent 24%), linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0)), var(--bg-card)',
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.9fr) minmax(280px, 0.9fr)',
            gap: 18
          }}
        >
          <div>
            <div className="catalogue-hero-kicker"><Sparkles size={12} /> Executive View</div>
            <h3 style={{ fontSize: 30, marginTop: 16, marginBottom: 10, maxWidth: 760 }}>
              Good {new Date().getHours() >= 17 ? 'evening' : new Date().getHours() >= 12 ? 'afternoon' : 'morning'}, {userName}. Your ERP is ready with the signals that matter today.
            </h3>
            <p className="text-secondary" style={{ maxWidth: 760, fontSize: 14 }}>
              This workspace now combines demand, stock pressure, open commercial value, and fulfilment movement so you can spot where the business needs attention before it turns into delay.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 18 }}>
              <TrendChip value={`${headline.monthlyOrderCount}`} label="orders this month" tone="#3d7fff" />
              <TrendChip value={formatCurrency(totalRevenueWindow, currencySymbol)} label="6-month booked value" tone="#22c55e" />
              <TrendChip value={formatCurrency(totalQuotationWindow, currencySymbol)} label="quotation flow window" tone="#a78bfa" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginTop: 20 }}>
              {signalCards.map((card) => (
                <div
                  key={card.label}
                  style={{
                    borderRadius: 18,
                    padding: 16,
                    border: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.02)',
                    minHeight: 118
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                    <span className="catalogue-summary-title">{card.label}</span>
                    <div className="stat-card-icon" style={{ background: card.bg }}><card.icon size={18} color={card.color} /></div>
                  </div>
                  <div style={{ fontSize: 24, fontWeight: 700, marginTop: 16, color: card.color, lineHeight: 1.05 }}>{card.value}</div>
                  <div className="text-secondary text-sm mt-2">{card.meta}</div>
                </div>
              ))}
            </div>
          </div>

          <div
            style={{
              borderRadius: 20,
              padding: 18,
              border: '1px solid var(--border)',
              background: isLightTheme
                ? 'radial-gradient(circle at top right, rgba(61,127,255,0.12), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.82)), var(--bg-secondary)'
                : 'radial-gradient(circle at top right, rgba(61,127,255,0.16), transparent 34%), linear-gradient(180deg, rgba(11,17,32,0.96), rgba(11,17,32,0.90)), var(--bg-secondary)',
              boxShadow: isLightTheme ? '0 12px 28px rgba(148,163,184,0.10)' : '0 18px 34px rgba(0,0,0,0.28)',
              display: 'flex',
              flexDirection: 'column',
              gap: 12
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div className="catalogue-summary-title">Today at a Glance</div>
                <strong style={{ display: 'block', marginTop: 6, fontSize: 22 }}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
              </div>
              <div className="catalogue-modal-title-icon"><LayoutGrid size={18} /></div>
            </div>
            {operationsCards.map((card) => (
              <div
                key={card.label}
                style={{
                  borderRadius: 16,
                  padding: 14,
                  border: '1px solid var(--border)',
                  background: isLightTheme
                    ? `linear-gradient(180deg, ${card.color}12, rgba(255,255,255,0.82))`
                    : `linear-gradient(180deg, ${card.color}16, rgba(15,23,42,0.92))`
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span className="catalogue-summary-title">{card.label}</span>
                  <card.icon size={16} color={card.color} />
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.color, marginTop: 10 }}>{card.value}</div>
                <div className="text-secondary text-sm mt-2">{card.meta}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.1fr', gap: 18 }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="card-header">
              <div>
                <h4>Revenue & Quotation Momentum</h4>
                <p className="text-secondary text-sm">Booked order value against quotation flow over the last 6 months</p>
              </div>
              <TrendingUp size={18} color="var(--accent)" />
            </div>
            <div style={{ padding: '18px 12px 10px', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="dashboardRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3d7fff" stopOpacity={0.32} />
                      <stop offset="95%" stopColor="#3d7fff" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dashboardQuotes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(148,163,184,0.08)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={70} />
                  <Tooltip content={<MoneyTooltip />} />
                  <Area type="monotone" dataKey="quotations" name="Quotations" stroke="#a78bfa" strokeWidth={2} fill="url(#dashboardQuotes)" />
                  <Area type="monotone" dataKey="revenue" name="Orders" stroke="#3d7fff" strokeWidth={2.5} fill="url(#dashboardRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h4>Fulfilment Mix</h4>
                <p className="text-secondary text-sm">Order load by execution stage</p>
              </div>
              <ClipboardList size={18} color="var(--warning)" />
            </div>
            <div style={{ padding: '18px 12px 8px', height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={orderStatusData} layout="vertical" margin={{ top: 4, right: 18, bottom: 4, left: 24 }}>
                  <CartesianGrid stroke="rgba(148,163,184,0.08)" horizontal={true} vertical={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="status" type="category" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip content={<CountTooltip />} />
                  <Bar dataKey="count" radius={[0, 10, 10, 0]} barSize={18}>
                    {orderStatusData.map((entry) => <Cell key={entry.status} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr 1fr', gap: 18 }}>
          <div className="card">
            <div className="card-header">
              <div>
                <h4>Critical Stock Watchlist</h4>
                <p className="text-secondary text-sm">{lowStockItems.length} material signal{lowStockItems.length === 1 ? '' : 's'} below minimum</p>
              </div>
              <AlertTriangle size={18} color="var(--warning)" />
            </div>
            {lowStockItems.length === 0 ? (
              <div className="empty-state" style={{ minHeight: 255 }}>
                <CheckCircle size={34} color="var(--success)" />
                <p>All stock levels are healthy right now.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 18px 18px' }}>
                {lowStockItems.map((item) => {
                  const stockRatio = Math.max(0, Math.min(1, Number(item.quantity || 0) / Math.max(Number(item.min_stock || 1), 1)));
                  return (
                    <div key={item.code} style={{ borderRadius: 16, border: '1px solid var(--border)', padding: 14, background: 'rgba(255,255,255,0.02)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</div>
                          <div className="text-secondary text-sm">{item.code}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: Number(item.quantity || 0) === 0 ? 'var(--danger)' : 'var(--warning)' }}>
                            {item.quantity} {item.unit}
                          </div>
                          <div className="text-secondary text-sm">Min {item.min_stock}</div>
                        </div>
                      </div>
                      <div style={{ height: 8, borderRadius: 999, background: 'rgba(148,163,184,0.12)', marginTop: 12, overflow: 'hidden' }}>
                        <div style={{ width: `${Math.max(stockRatio * 100, 6)}%`, height: '100%', background: Number(item.quantity || 0) === 0 ? 'var(--danger)' : 'linear-gradient(90deg, #f97316, #f59e0b)' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h4>Top Customers by Order Value</h4>
                <p className="text-secondary text-sm">Who is driving the booked pipeline</p>
              </div>
              <Users size={18} color="var(--success)" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 18px 18px' }}>
              {topCustomers.length ? topCustomers.map((row, index) => (
                <div
                  key={`${row.customer_name}-${index}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 12,
                    padding: '14px 14px',
                    borderRadius: 16,
                    border: '1px solid var(--border)',
                    background: index === 0 ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.02)'
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{row.customer_name}</div>
                    <div className="text-secondary text-sm">Rank #{index + 1}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: index === 0 ? 'var(--success)' : 'var(--text-primary)' }}>
                    {formatCurrency(row.total || 0, currencySymbol)}
                  </div>
                </div>
              )) : (
                <div className="empty-state" style={{ minHeight: 255 }}>
                  <Users size={32} />
                  <p>No order-led customer data available yet.</p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div>
                <h4>Quick Actions</h4>
                <p className="text-secondary text-sm">Jump into the busiest ERP workflows</p>
              </div>
              <Zap size={18} color="var(--accent)" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 18px 18px' }}>
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  className="btn btn-secondary"
                  style={{
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderRadius: 16,
                    background: `${action.tone}12`,
                    borderColor: `${action.tone}26`,
                    color: 'var(--text-primary)'
                  }}
                  onClick={() => { window.location.hash = action.route; }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ width: 34, height: 34, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: `${action.tone}1c` }}>
                      <action.icon size={17} color={action.tone} />
                    </span>
                    <span>{action.label}</span>
                  </span>
                  <ArrowRight size={16} />
                </button>
              ))}
              <div
                style={{
                  borderRadius: 18,
                  padding: 16,
                  border: '1px solid var(--border)',
                  background: 'radial-gradient(circle at top right, rgba(61,127,255,0.16), transparent 32%), rgba(255,255,255,0.02)'
                }}
              >
                <div className="catalogue-summary-title">Operational Pulse</div>
                <div style={{ fontSize: 24, fontWeight: 700, marginTop: 10 }}>{loading ? '...' : `${dashboardStats.pendingOrders + dashboardStats.lowStockItems}`}</div>
                <div className="text-secondary text-sm mt-2">Total open operational pressure signals across fulfilment and materials.</div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <h4>Recent Orders</h4>
              <p className="text-secondary text-sm">Latest customer orders with commercial and fulfilment context</p>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={() => { window.location.hash = '/orders'; }}>
              View All <ArrowRight size={13} />
            </button>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Booked</th>
                  <th>Amount</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-muted" style={{ padding: 36 }}>No orders yet. Create your first order to activate the live dashboard view.</td></tr>
                ) : recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td><span className="font-mono text-accent">{order.order_number}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{order.customer_company || order.customer_name || '-'}</div>
                      <div className="text-secondary text-sm">{order.notes ? `${order.notes}`.slice(0, 48) : 'No order note added yet'}</div>
                    </td>
                    <td>
                      <div>{formatDate(order.order_date)}</div>
                      <div className="text-secondary text-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Clock3 size={12} /> Created {formatDate(order.created_at || order.order_date)}
                      </div>
                    </td>
                    <td className="font-semibold">{formatCurrency(order.total_amount || 0, currencySymbol)}</td>
                    <td>{getStatusBadge(order.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
