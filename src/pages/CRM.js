import React, { useState, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import db, { generateId } from '../utils/database';
import { isDeveloperUser } from '../utils/modules';
import LeadPipeline from '../components/crm/LeadPipeline';
import IndiaMARTIntegration from '../components/crm/IndiaMARTIntegration';
import AdvancedAnalytics from '../components/crm/AdvancedAnalytics';
import AILeadScoring from '../components/crm/AILeadScoring';
import CommunicationIntegration from '../components/crm/CommunicationIntegration';
import WorkflowAutomation from '../components/crm/WorkflowAutomation';
import LeadsView from '../components/crm/LeadsView';
import FollowupsView from '../components/crm/FollowupsView';
import QuotationsView from '../components/crm/QuotationsView';
import {
  Users, TrendingUp, Clock, FileText, Bell, Plus,
  Search, Filter, MoreVertical, Eye, Edit, Phone,
  Mail, Calendar, CheckCircle, XCircle, AlertTriangle,
  BarChart3, PieChart, Activity, Target, DollarSign,
  Settings, RefreshCw, ExternalLink
} from 'lucide-react';

const INQUIRY_DEFAULT = {
  source: 'manual',
  customer_name: '',
  company: '',
  email: '',
  phone: '',
  product_interest: '',
  quantity: '',
  requirements: '',
  priority: 'medium',
  assigned_to: ''
};

const CRM = () => {
  const {
    crmStats, loadCrmStats, currentUser,
    createInquiry, createLead, scheduleFollowup, createCrmQuotation,
    loadCrmAlerts, completeAlert
  } = useAppStore();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [alerts, setAlerts] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [companySuggestions, setCompanySuggestions] = useState([]);
  const [inquirySearch, setInquirySearch] = useState('');
  const [inquiryStatusFilter, setInquiryStatusFilter] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalType, setModalType] = useState('inquiry');
  const [inquiryForm, setInquiryForm] = useState(INQUIRY_DEFAULT);
  const [inquirySaving, setInquirySaving] = useState(false);
  const [inquiryError, setInquiryError] = useState('');

  // Role-based access control
  const userRole = currentUser?.role || 'operator';
  const isAdmin = userRole === 'admin';
  const isManager = userRole === 'manager';
  const isSales = userRole === 'sales';
  const isDeveloper = isDeveloperUser(currentUser);
  const isDevMode = process.env.NODE_ENV === 'development';
  const canAccessCRM = isDevMode || isDeveloper || isAdmin || isManager || isSales;

  // Define accessible tabs based on role
  const getAccessibleTabs = () => {
    const allTabs = [
      { id: 'dashboard', label: 'Dashboard', icon: BarChart3, roles: ['admin', 'manager', 'sales'] },
      { id: 'pipeline', label: 'Pipeline', icon: Activity, roles: ['admin', 'manager', 'sales'] },
      { id: 'inquiries', label: 'Inquiries', icon: Search, roles: ['admin', 'manager', 'sales'] },
      { id: 'leads', label: 'Leads', icon: Users, roles: ['admin', 'manager', 'sales'] },
      { id: 'followups', label: 'Follow-ups', icon: Calendar, roles: ['admin', 'manager', 'sales'] },
      { id: 'quotations', label: 'Quotations', icon: FileText, roles: ['admin', 'manager', 'sales'] },
      { id: 'alerts', label: 'Alerts', icon: Bell, roles: ['admin', 'manager', 'sales'] },
      { id: 'indiamart', label: 'IndiaMART', icon: ExternalLink, roles: ['admin', 'manager'] },
      { id: 'analytics', label: 'Analytics', icon: TrendingUp, roles: ['admin', 'manager'] },
      { id: 'ai-scoring', label: 'AI Scoring', icon: Target, roles: ['admin', 'manager'] },
      { id: 'communication', label: 'Communication', icon: Mail, roles: ['admin', 'manager'] },
      { id: 'automation', label: 'Automation', icon: Settings, roles: ['admin', 'manager'] },
      { id: 'reports', label: 'Reports', icon: PieChart, roles: ['admin', 'manager'] }
    ];

    if (isDevMode || isDeveloper) {
      return allTabs; // Show every CRM tab in development mode for easier testing
    }
    return allTabs.filter(tab => tab.roles.includes(userRole));
  };

  const tabs = getAccessibleTabs();

  useEffect(() => {
    if (canAccessCRM) {
      loadCrmStats();
      loadAlerts();
      loadInquiries();
      loadCompanySuggestions();
    }
  }, []);

  const loadAlerts = async () => {
    const alertData = await loadCrmAlerts();
    setAlerts(alertData);
  };

  const loadInquiries = async () => {
    const rows = await db.all(`
      SELECT i.*, u.full_name AS assigned_user
      FROM crm_inquiries i
      LEFT JOIN users u ON i.assigned_to = u.id
      ORDER BY datetime(i.created_at) DESC, i.inquiry_number DESC
    `);
    setInquiries(rows || []);
  };

  const loadCompanySuggestions = async () => {
    const rows = await db.all(`
      SELECT DISTINCT company
      FROM contacts
      WHERE type = 'customer'
        AND is_active = 1
        AND company IS NOT NULL
        AND TRIM(company) <> ''
      ORDER BY company
      LIMIT 100
    `);
    setCompanySuggestions(rows || []);
  };

  const companySuggestionOptions = useMemo(
    () => companySuggestions
      .map((row) => `${row.company || ''}`.trim())
      .filter(Boolean),
    [companySuggestions]
  );

  const openInquiryModal = () => {
    setModalType('inquiry');
    setInquiryForm(INQUIRY_DEFAULT);
    setInquiryError('');
    setInquirySaving(false);
    setShowCreateModal(true);
  };

  const closeInquiryModal = () => {
    setShowCreateModal(false);
    setInquiryForm(INQUIRY_DEFAULT);
    setInquiryError('');
    setInquirySaving(false);
  };

  const normalizePhone = (value) => `${value || ''}`.replace(/\D/g, '');

  const ensureInquiryContact = async (inquiry) => {
    if (inquiry.email) {
      const byEmail = await db.get(
        'SELECT id FROM contacts WHERE type = ? AND LOWER(email) = LOWER(?) AND is_active = 1',
        ['customer', inquiry.email]
      );
      if (byEmail?.id) return byEmail.id;
    }

    if (inquiry.phone) {
      const phoneDigits = normalizePhone(inquiry.phone);
      const contacts = await db.all('SELECT id, phone FROM contacts WHERE type = ? AND is_active = 1', ['customer']);
      const byPhone = contacts.find((contact) => normalizePhone(contact.phone) === phoneDigits);
      if (byPhone?.id) return byPhone.id;
    }

    const id = generateId();
    await db.run(
      `INSERT INTO contacts (id, type, name, company, email, phone)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, 'customer', inquiry.customer_name || inquiry.company || 'CRM Lead', inquiry.company || '', inquiry.email || '', inquiry.phone || '']
    );
    return id;
  };

  const convertInquiryToLead = async (inquiry) => {
    const customerId = await ensureInquiryContact(inquiry);
    const duplicate = await db.get(
      `SELECT id, lead_number FROM crm_leads
       WHERE inquiry_id = ? AND status NOT IN ('closed_won', 'closed_lost')
       LIMIT 1`,
      [inquiry.id]
    );
    if (duplicate?.id) {
      window.alert(`This inquiry is already linked to lead ${duplicate.lead_number || duplicate.id}.`);
      return;
    }

    const result = await createLead({
      inquiry_id: inquiry.id,
      customer_id: customerId,
      status: 'qualified',
      value: 0,
      probability: 30,
      expected_close_date: '',
      industry: '',
      lead_source: inquiry.source || 'manual',
      priority: inquiry.priority || 'medium',
      notes: [inquiry.product_interest, inquiry.requirements].filter(Boolean).join('\n'),
      assigned_to: inquiry.assigned_to || currentUser?.id || ''
    });

    if (!result?.success) {
      window.alert(result?.error || 'Unable to convert inquiry to lead.');
      return;
    }

    await db.run("UPDATE crm_inquiries SET status='converted', updated_at=datetime('now') WHERE id=?", [inquiry.id]);
    await Promise.all([loadInquiries(), loadCrmStats()]);
    setActiveTab('leads');
  };

  // Check access
  if (!canAccessCRM) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
        <AlertTriangle size={48} color="var(--warning)" style={{ marginBottom: 16 }} />
        <h2 style={{ fontSize: 24, marginBottom: 16 }}>Access Denied</h2>
        <p>You don't have permission to access the CRM module.</p>
        <p style={{ fontSize: 14, marginTop: 8 }}>Required roles: Developer, Admin, Manager, or Sales</p>
      </div>
    );
  }

  const StatCard = ({ title, value, icon: Icon, color, trend }) => (
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
      <div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>{value}</div>
        {trend && (
          <div style={{ fontSize: 12, color: trend > 0 ? 'var(--success)' : 'var(--danger)', marginTop: 2 }}>
            {trend > 0 ? '+' : ''}{trend}% from last month
          </div>
        )}
      </div>
    </div>
  );

  const DashboardView = () => (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>CRM Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>Customer Relationship Management Overview</p>
      </div>

      {/* Stats Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20,
        marginBottom: 32
      }}>
        <StatCard
          title="Total Inquiries"
          value={crmStats.totalInquiries}
          icon={Search}
          color="var(--accent)"
          trend={12}
        />
        <StatCard
          title="New Leads"
          value={crmStats.newLeads}
          icon={Users}
          color="var(--primary)"
          trend={8}
        />
        <StatCard
          title="Active Leads"
          value={crmStats.activeLeads}
          icon={Activity}
          color="var(--success)"
          trend={15}
        />
        <StatCard
          title="Pending Follow-ups"
          value={crmStats.pendingFollowups}
          icon={Clock}
          color="var(--warning)"
          trend={-5}
        />
        <StatCard
          title="Pending Quotations"
          value={crmStats.pendingQuotations}
          icon={FileText}
          color="var(--info)"
          trend={20}
        />
        <StatCard
          title="Won Deals"
          value={crmStats.wonDeals}
          icon={Target}
          color="var(--success)"
          trend={25}
        />
      </div>

      {/* Pipeline View */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24
      }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>Sales Pipeline</h3>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 16
        }}>
          {[
            { stage: 'New', count: 15, value: 250000, color: '#6366f1' },
            { stage: 'Contacted', count: 12, value: 180000, color: '#8b5cf6' },
            { stage: 'Qualified', count: 8, value: 120000, color: '#06b6d4' },
            { stage: 'Proposal', count: 5, value: 80000, color: '#10b981' },
            { stage: 'Negotiation', count: 3, value: 45000, color: '#f59e0b' },
            { stage: 'Closed Won', count: 7, value: 95000, color: '#22c55e' }
          ].map(stage => (
            <div key={stage.stage} style={{
              textAlign: 'center',
              padding: 16,
              borderRadius: 8,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)'
            }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>{stage.stage}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: stage.color, marginBottom: 4 }}>{stage.count}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>₹{stage.value.toLocaleString()}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Activities */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 24
      }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>Recent Activities</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { type: 'inquiry', message: 'New inquiry from ABC Industries', time: '2 hours ago', icon: Search },
            { type: 'lead', message: 'Lead LEAD-001 moved to Qualified', time: '4 hours ago', icon: Users },
            { type: 'followup', message: 'Follow-up scheduled with XYZ Corp', time: '6 hours ago', icon: Calendar },
            { type: 'quotation', message: 'Quotation CRM-Q-001 sent to DEF Ltd', time: '1 day ago', icon: FileText }
          ].map((activity, index) => (
            <div key={index} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: 12,
              borderRadius: 8,
              background: 'var(--bg-primary)',
              border: '1px solid var(--border)'
            }}>
              <div style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'var(--accent-dim)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <activity.icon size={16} color="var(--accent)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>{activity.message}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{activity.time}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const InquiriesView = () => {
    const filteredInquiries = inquiries.filter((item) => {
      const query = `${inquirySearch || ''}`.trim().toLowerCase();
      const searchMatch = !query || [
        item.inquiry_number,
        item.customer_name,
        item.company,
        item.product_interest,
        item.source,
        item.phone,
        item.email
      ].join(' ').toLowerCase().includes(query);
      const statusMatch = inquiryStatusFilter === 'all' || `${item.status || ''}`.toLowerCase() === inquiryStatusFilter;
      return searchMatch && statusMatch;
    });

    return (
      <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>Inquiries</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>Manage customer inquiries from various sources</p>
        </div>
        <button
          onClick={openInquiryModal}
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '12px 20px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <Plus size={16} />
          New Inquiry
        </button>
      </div>

      {/* Inquiries Table */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden'
      }}>
        <div style={{
          padding: 16,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: 12,
          alignItems: 'center'
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              placeholder="Search inquiries..."
              value={inquirySearch}
              onChange={(event) => setInquirySearch(event.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg-primary)',
                color: 'var(--text)',
                fontSize: 14
              }}
            />
          </div>
          <select
            value={inquiryStatusFilter}
            onChange={(event) => setInquiryStatusFilter(event.target.value)}
            style={{
            padding: '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg-primary)',
            color: 'var(--text)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            <option value="all">All status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Inquiry #</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Customer</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Product</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Source</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Created</th>
                <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredInquiries.map((item) => (
                  <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: 12, fontSize: 14, color: 'var(--text)' }}>{item.inquiry_number || '-'}</td>
                    <td style={{ padding: 12, fontSize: 14, color: 'var(--text)' }}>
                      {item.customer_name || '-'}
                      <br />
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{item.company || '-'}</span>
                    </td>
                    <td style={{ padding: 12, fontSize: 14, color: 'var(--text)' }}>{item.product_interest || '-'}</td>
                    <td style={{ padding: 12 }}>
                      <span style={{ background: '#06b6d415', color: '#06b6d4', padding: '4px 8px', borderRadius: 4, fontSize: 12 }}>
                        {`${item.source || 'manual'}`.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: 12 }}>
                      <span style={{ background: '#6366f115', color: '#6366f1', padding: '4px 8px', borderRadius: 4, fontSize: 12, textTransform: 'capitalize' }}>
                        {item.status || 'new'}
                      </span>
                    </td>
                    <td style={{ padding: 12, fontSize: 14, color: 'var(--text)' }}>
                      {item.created_at ? new Date(item.created_at).toLocaleDateString('en-IN') : '-'}
                    </td>
                    <td style={{ padding: 12, textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          disabled={item.status === 'converted'}
                          onClick={() => convertInquiryToLead(item)}
                        >
                          <Users size={13} />Convert
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              {!filteredInquiries.length && (
                <tr>
                  <td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
                    {inquiries.length
                      ? 'No inquiries match your current search/filter.'
                      : 'No inquiries yet. Click "New Inquiry" to create the first one.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
    );
  };

  const InquiryCreateModal = () => {
    const updateField = (field, value) => {
      setInquiryForm((prev) => ({ ...prev, [field]: value }));
    };

    const submitInquiry = async (event) => {
      event.preventDefault();
      const customerName = `${inquiryForm.customer_name || ''}`.trim();
      const productInterest = `${inquiryForm.product_interest || ''}`.trim();
      if (!customerName || !productInterest) {
        setInquiryError('Customer name and product are required.');
        return;
      }

      setInquirySaving(true);
      setInquiryError('');
      const result = await createInquiry({
        ...inquiryForm,
        customer_name: customerName,
        product_interest: productInterest,
        quantity: Number(inquiryForm.quantity || 0)
      });
      setInquirySaving(false);

      if (!result?.success) {
        setInquiryError(result?.error || 'Unable to create inquiry.');
        return;
      }

      closeInquiryModal();
      await Promise.all([loadInquiries(), loadCrmStats()]);
    };

    return (
      <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && closeInquiryModal()}>
        <div className="modal">
          <div className="modal-header">
            <div>
              <h3 style={{ marginBottom: 4 }}>Create Inquiry</h3>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Capture lead intent before qualification and follow-up.</div>
            </div>
            <button className="close-btn" onClick={closeInquiryModal}>x</button>
          </div>
          <form onSubmit={submitInquiry}>
            <div className="modal-body" style={{ display: 'grid', gap: 12 }}>
              {inquiryError && (
                <div className="catalogue-form-alert">
                  <span>{inquiryError}</span>
                </div>
              )}

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Customer Name *</label>
                  <input className="form-control" value={inquiryForm.customer_name} onChange={(event) => updateField('customer_name', event.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Company</label>
                  <input
                    className="form-control"
                    value={inquiryForm.company}
                    onChange={(event) => updateField('company', event.target.value)}
                    list="crm-inquiry-company-suggestions"
                    autoComplete="off"
                  />
                  <datalist id="crm-inquiry-company-suggestions">
                    {companySuggestionOptions.map((company) => (
                      <option key={company} value={company} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-control" value={inquiryForm.phone} onChange={(event) => updateField('phone', event.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-control" type="email" value={inquiryForm.email} onChange={(event) => updateField('email', event.target.value)} />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Product Interest *</label>
                  <input className="form-control" value={inquiryForm.product_interest} onChange={(event) => updateField('product_interest', event.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Quantity</label>
                  <input className="form-control" type="number" min="0" step="1" value={inquiryForm.quantity} onChange={(event) => updateField('quantity', event.target.value)} />
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Source</label>
                  <select className="form-control" value={inquiryForm.source} onChange={(event) => updateField('source', event.target.value)}>
                    <option value="manual">Manual</option>
                    <option value="indiamart">IndiaMART</option>
                    <option value="website">Website</option>
                    <option value="referral">Referral</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-control" value={inquiryForm.priority} onChange={(event) => updateField('priority', event.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Requirements</label>
                <textarea className="form-control" rows={3} value={inquiryForm.requirements} onChange={(event) => updateField('requirements', event.target.value)} />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeInquiryModal}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={inquirySaving}>{inquirySaving ? 'Saving...' : 'Save Inquiry'}</button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  const AlertsView = () => (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>Alerts & Reminders</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>Manage CRM alerts and follow-up reminders</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {alerts.map(alert => (
          <div key={alert.id} style={{
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
              background: alert.priority === 'high' ? '#ef444415' : '#f59e0b15',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bell size={24} color={alert.priority === 'high' ? '#ef4444' : '#f59e0b'} />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{alert.title}</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>{alert.message}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Scheduled: {new Date(alert.scheduled_date).toLocaleString()}
                {alert.lead_number && ` • Lead: ${alert.lead_number}`}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => completeAlert(alert.id).then(() => loadAlerts())}
                style={{
                  background: 'var(--success)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '8px 16px',
                  fontSize: 14,
                  cursor: 'pointer'
                }}
              >
                Mark Complete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Tab Navigation */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-primary)',
        display: 'flex',
        gap: 0
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '16px 20px',
                border: 'none',
                background: isActive ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'dashboard' && DashboardView()}
        {activeTab === 'pipeline' && <LeadPipeline />}
        {activeTab === 'inquiries' && InquiriesView()}
        {activeTab === 'leads' && <LeadsView />}
        {activeTab === 'followups' && <FollowupsView />}
        {activeTab === 'quotations' && <QuotationsView />}
        {activeTab === 'alerts' && AlertsView()}
        {activeTab === 'indiamart' && <IndiaMARTIntegration />}
        {activeTab === 'analytics' && <AdvancedAnalytics />}
        {activeTab === 'ai-scoring' && <AILeadScoring />}
        {activeTab === 'communication' && <CommunicationIntegration />}
        {activeTab === 'automation' && <WorkflowAutomation />}
        {activeTab === 'reports' && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
            <h2 style={{ fontSize: 24, marginBottom: 16 }}>Reports Module</h2>
            <p>This module is under development. Full implementation coming soon.</p>
          </div>
        )}
      </div>

      {showCreateModal && modalType === 'inquiry' && InquiryCreateModal()}
    </div>
  );
};

export default CRM;
