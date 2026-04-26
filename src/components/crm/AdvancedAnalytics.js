import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, DollarSign, Target, Activity,
  Calendar, BarChart3, PieChart as PieChartIcon, Filter, Download
} from 'lucide-react';

const AdvancedAnalytics = () => {
  const { currentUser } = useAppStore();
  const [timeRange, setTimeRange] = useState('30d');
  const [analyticsData, setAnalyticsData] = useState({
    leadConversion: [],
    revenueByMonth: [],
    leadSources: [],
    pipelineValue: [],
    teamPerformance: [],
    activityTrends: []
  });

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange]);

  const loadAnalyticsData = async () => {
    // Mock data - in real implementation, this would query the database
    const mockData = {
      leadConversion: [
        { month: 'Jan', inquiries: 45, leads: 32, opportunities: 18, won: 12 },
        { month: 'Feb', inquiries: 52, leads: 38, opportunities: 22, won: 15 },
        { month: 'Mar', inquiries: 48, leads: 35, opportunities: 20, won: 14 },
        { month: 'Apr', inquiries: 61, leads: 44, opportunities: 28, won: 19 }
      ],
      revenueByMonth: [
        { month: 'Jan', revenue: 125000, target: 150000 },
        { month: 'Feb', revenue: 145000, target: 150000 },
        { month: 'Mar', revenue: 138000, target: 150000 },
        { month: 'Apr', revenue: 168000, target: 150000 }
      ],
      leadSources: [
        { name: 'IndiaMART', value: 35, color: '#6366f1' },
        { name: 'Website', value: 25, color: '#10b981' },
        { name: 'Referral', value: 20, color: '#f59e0b' },
        { name: 'Direct', value: 12, color: '#ef4444' },
        { name: 'Others', value: 8, color: '#8b5cf6' }
      ],
      pipelineValue: [
        { stage: 'New', value: 250000, count: 15 },
        { stage: 'Contacted', value: 180000, count: 12 },
        { stage: 'Qualified', value: 120000, count: 8 },
        { stage: 'Proposal', value: 80000, count: 5 },
        { stage: 'Negotiation', value: 45000, count: 3 },
        { stage: 'Closed Won', value: 95000, count: 7 }
      ],
      teamPerformance: [
        { name: 'Rajesh K', leads: 25, conversions: 18, revenue: 45000 },
        { name: 'Priya S', leads: 22, conversions: 15, revenue: 38000 },
        { name: 'Amit P', leads: 20, conversions: 12, revenue: 32000 },
        { name: 'Sneha M', leads: 18, conversions: 14, revenue: 35000 }
      ],
      activityTrends: [
        { date: '2024-01-01', calls: 12, emails: 8, meetings: 3 },
        { date: '2024-01-02', calls: 15, emails: 10, meetings: 4 },
        { date: '2024-01-03', calls: 8, emails: 12, meetings: 2 },
        { date: '2024-01-04', calls: 18, emails: 15, meetings: 5 },
        { date: '2024-01-05', calls: 22, emails: 18, meetings: 6 }
      ]
    };

    setAnalyticsData(mockData);
  };

  const MetricCard = ({ title, value, change, icon: Icon, color }) => (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: 20,
      display: 'flex',
      alignItems: 'center',
      gap: 16
    }}>
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: `${color}15`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <Icon size={24} color={color} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          {typeof value === 'number' && value > 1000 ? `₹${value.toLocaleString()}` : value}
        </div>
        {change && (
          <div style={{
            fontSize: 12,
            color: change > 0 ? 'var(--success)' : 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            gap: 4
          }}>
            {change > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {Math.abs(change)}% from last period
          </div>
        )}
      </div>
    </div>
  );

  const exportData = () => {
    // Implementation for exporting analytics data
    console.log('Exporting analytics data...');
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>
            Advanced Analytics
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
            Comprehensive CRM performance insights and business intelligence
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <select
            value={timeRange}
            onChange={e => setTimeRange(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--bg-primary)',
              color: 'var(--text)'
            }}
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>
          <button
            onClick={exportData}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Download size={16} />
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20,
        marginBottom: 32
      }}>
        <MetricCard
          title="Total Revenue"
          value={576000}
          change={12.5}
          icon={DollarSign}
          color="var(--success)"
        />
        <MetricCard
          title="Lead Conversion Rate"
          value="31.2%"
          change={8.3}
          icon={Target}
          color="var(--accent)"
        />
        <MetricCard
          title="Active Leads"
          value={47}
          change={-2.1}
          icon={Users}
          color="var(--primary)"
        />
        <MetricCard
          title="Avg Deal Size"
          value="₹38,400"
          change={15.7}
          icon={BarChart3}
          color="var(--info)"
        />
      </div>

      {/* Charts Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: 24, marginBottom: 24 }}>

        {/* Lead Conversion Funnel */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
            Lead Conversion Funnel
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.leadConversion}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="inquiries" fill="#6366f1" name="Inquiries" />
              <Bar dataKey="leads" fill="#10b981" name="Leads" />
              <Bar dataKey="opportunities" fill="#f59e0b" name="Opportunities" />
              <Bar dataKey="won" fill="#22c55e" name="Won" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Revenue vs Target */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
            Revenue vs Target
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={analyticsData.revenueByMonth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(value) => [`₹${value.toLocaleString()}`, '']} />
              <Area type="monotone" dataKey="revenue" stackId="1" stroke="#22c55e" fill="#22c55e" fillOpacity={0.6} />
              <Area type="monotone" dataKey="target" stackId="2" stroke="#ef4444" fill="#ef4444" fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Lead Sources */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
            Lead Sources Distribution
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analyticsData.leadSources}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {analyticsData.leadSources.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Pipeline Value */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
            Pipeline Value by Stage
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={analyticsData.pipelineValue} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="stage" type="category" width={80} />
              <Tooltip formatter={(value) => [`₹${value.toLocaleString()}`, 'Value']} />
              <Bar dataKey="value" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>

      {/* Team Performance & Activity Trends */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: 24 }}>

        {/* Team Performance */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
            Team Performance
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Sales Rep</th>
                  <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Leads</th>
                  <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Conversions</th>
                  <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData.teamPerformance.map((rep, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 12, fontSize: 14, color: 'var(--text)' }}>{rep.name}</td>
                    <td style={{ padding: 12, textAlign: 'center', fontSize: 14, color: 'var(--text)' }}>{rep.leads}</td>
                    <td style={{ padding: 12, textAlign: 'center', fontSize: 14, color: 'var(--text)' }}>{rep.conversions}</td>
                    <td style={{ padding: 12, textAlign: 'center', fontSize: 14, color: 'var(--text)' }}>₹{rep.revenue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Trends */}
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 24
        }}>
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
            Activity Trends
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analyticsData.activityTrends}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="calls" stroke="#6366f1" strokeWidth={2} name="Calls" />
              <Line type="monotone" dataKey="emails" stroke="#10b981" strokeWidth={2} name="Emails" />
              <Line type="monotone" dataKey="meetings" stroke="#f59e0b" strokeWidth={2} name="Meetings" />
            </LineChart>
          </ResponsiveContainer>
        </div>

      </div>
    </div>
  );
};

export default AdvancedAnalytics;