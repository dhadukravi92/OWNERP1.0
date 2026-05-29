import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Edit, Mail, Phone, Plus, Search, Trash2, Users } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import db, { formatCurrency, generateDocNumber, generateId, getNextSequence } from '../../utils/database';

const today = () => new Date().toISOString().slice(0, 10);

const emptyLeadForm = (currentUser) => ({
  contact_id: '',
  company_name: '',
  contact_person: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  industry: '',
  lead_source: 'manual',
  value: '',
  probability: 25,
  status: 'new',
  priority: 'medium',
  notes: '',
  assigned_to: currentUser?.id || '',
  expected_close_date: '',
  next_followup_date: ''
});

const statusOptions = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'qualified', label: 'Qualified' },
  { value: 'proposal', label: 'Proposal' },
  { value: 'negotiation', label: 'Negotiation' },
  { value: 'closed_won', label: 'Closed Won' },
  { value: 'closed_lost', label: 'Closed Lost' }
];

const sourceOptions = [
  { value: 'manual', label: 'Manual' },
  { value: 'indiamart', label: 'IndiaMART' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'cold_call', label: 'Cold Call' },
  { value: 'trade_show', label: 'Trade Show' },
  { value: 'other', label: 'Other' }
];

const industryOptions = [
  'Manufacturing', 'Electrical Panels', 'Industrial Automation', 'Retail', 'Healthcare',
  'Education', 'Finance', 'Construction', 'Automotive', 'Other'
];

function normalizePhone(value) {
  return `${value || ''}`.replace(/\D/g, '');
}

function getOwnerName(currentUser) {
  return currentUser?.full_name || currentUser?.username || currentUser?.name || '';
}

function getStatusColor(status) {
  switch (status) {
    case 'new': return 'var(--info)';
    case 'contacted': return 'var(--warning)';
    case 'qualified': return 'var(--success)';
    case 'proposal': return 'var(--primary)';
    case 'negotiation': return 'var(--accent)';
    case 'closed_won': return 'var(--success)';
    case 'closed_lost': return 'var(--danger)';
    default: return 'var(--text-muted)';
  }
}

function getPriorityColor(priority) {
  switch (priority) {
    case 'high': return 'var(--danger)';
    case 'medium': return 'var(--warning)';
    case 'low': return 'var(--info)';
    default: return 'var(--text-muted)';
  }
}

export default function LeadsView() {
  const { currentUser, settings, loadCrmStats } = useAppStore();
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [form, setForm] = useState(emptyLeadForm(currentUser));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');
  const [error, setError] = useState('');
  const currency = settings?.currency_symbol || '\u20B9';

  useEffect(() => {
    loadLeads();
    db.all('SELECT id, username, full_name FROM users WHERE is_active = 1 ORDER BY full_name, username').then((rows) => setUsers(rows || []));
  }, []);

  const loadLeads = async () => {
    const rows = await db.all(`
      SELECT l.*, c.name AS contact_person, c.company AS company_name, c.email, c.phone,
        c.address, c.city, c.state, u.full_name AS assigned_user,
        MAX(f.scheduled_date) AS next_followup_date,
        MAX(f.actual_date) AS last_contact
      FROM crm_leads l
      LEFT JOIN contacts c ON c.id = l.customer_id
      LEFT JOIN users u ON u.id = l.assigned_to
      LEFT JOIN crm_followups f ON f.lead_id = l.id
      GROUP BY l.id
      ORDER BY datetime(l.updated_at) DESC, datetime(l.created_at) DESC
    `);
    setLeads(rows || []);
  };

  const filteredLeads = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return leads.filter((lead) => {
      const haystack = [
        lead.lead_number,
        lead.company_name,
        lead.contact_person,
        lead.email,
        lead.phone,
        lead.industry,
        lead.notes
      ].filter(Boolean).join(' ').toLowerCase();
      return (!term || haystack.includes(term))
        && (filterStatus === 'all' || lead.status === filterStatus)
        && (filterSource === 'all' || lead.lead_source === filterSource);
    });
  }, [leads, searchTerm, filterStatus, filterSource]);

  const openEditor = (lead = null) => {
    setEditingLead(lead);
    setError('');
    if (lead) {
      setForm({
        contact_id: lead.customer_id || '',
        company_name: lead.company_name || '',
        contact_person: lead.contact_person || '',
        email: lead.email || '',
        phone: lead.phone || '',
        address: lead.address || '',
        city: lead.city || '',
        state: lead.state || '',
        industry: lead.industry || '',
        lead_source: lead.lead_source || 'manual',
        value: lead.value || '',
        probability: Number(lead.probability || 0),
        status: lead.status || 'new',
        priority: lead.priority || 'medium',
        notes: lead.notes || '',
        assigned_to: lead.assigned_to || currentUser?.id || '',
        expected_close_date: lead.expected_close_date || '',
        next_followup_date: ''
      });
    } else {
      setForm(emptyLeadForm(currentUser));
    }
    setShowCreateModal(true);
  };

  const closeEditor = () => {
    setShowCreateModal(false);
    setEditingLead(null);
    setError('');
    setForm(emptyLeadForm(currentUser));
  };

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const findExistingContact = async () => {
    const phone = normalizePhone(form.phone);
    if (form.email) {
      const byEmail = await db.get('SELECT * FROM contacts WHERE type = ? AND LOWER(email) = LOWER(?) AND is_active = 1', ['customer', form.email.trim()]);
      if (byEmail) return byEmail;
    }
    if (phone) {
      const contacts = await db.all('SELECT * FROM contacts WHERE type = ? AND is_active = 1', ['customer']);
      return contacts.find((contact) => normalizePhone(contact.phone) === phone) || null;
    }
    return null;
  };

  const ensureContact = async () => {
    const existing = form.contact_id
      ? await db.get('SELECT * FROM contacts WHERE id = ?', [form.contact_id])
      : await findExistingContact();
    const payload = [
      'customer',
      form.contact_person.trim(),
      form.company_name.trim(),
      form.email.trim(),
      form.phone.trim(),
      form.address,
      form.city,
      form.state
    ];

    if (existing?.id) {
      await db.run(
        `UPDATE contacts SET type=?, name=?, company=?, email=?, phone=?, address=?, city=?, state=?
         WHERE id=?`,
        [...payload, existing.id]
      );
      return existing.id;
    }

    const id = generateId();
    await db.run(
      `INSERT INTO contacts (id, type, name, company, email, phone, address, city, state)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, ...payload]
    );
    return id;
  };

  const saveLead = async () => {
    const companyName = form.company_name.trim();
    const contactName = form.contact_person.trim();
    if (!companyName || !contactName) {
      setError('Company name and contact person are required.');
      return;
    }

    const existingContact = await findExistingContact();
    if (!editingLead && existingContact?.id) {
      const duplicateLead = await db.get(
        `SELECT id, lead_number FROM crm_leads
         WHERE customer_id = ? AND status NOT IN ('closed_won', 'closed_lost')
         LIMIT 1`,
        [existingContact.id]
      );
      if (duplicateLead) {
        setError(`Possible duplicate: active lead ${duplicateLead.lead_number || duplicateLead.id} already exists for this contact.`);
        return;
      }
    }

    const customerId = await ensureContact();
    const nowUser = currentUser?.id || null;
    const leadValues = [
      customerId,
      form.status,
      Number(form.value || 0),
      Number(form.probability || 0),
      form.expected_close_date || null,
      form.industry,
      form.lead_source,
      form.notes,
      form.assigned_to || nowUser,
      form.priority
    ];

    if (editingLead?.id) {
      await db.run(
        `UPDATE crm_leads
         SET customer_id=?, status=?, value=?, probability=?, expected_close_date=?, industry=?,
          lead_source=?, notes=?, assigned_to=?, priority=?, updated_at=datetime('now')
         WHERE id=?`,
        [...leadValues, editingLead.id]
      );
    } else {
      const seq = await getNextSequence('crm_leads', 'lead_number', 'LEAD');
      const leadNumber = generateDocNumber('LEAD', seq);
      const id = generateId();
      await db.run(
        `INSERT INTO crm_leads (
          id, lead_number, customer_id, status, value, probability, expected_close_date,
          industry, lead_source, notes, assigned_to, priority, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [id, leadNumber, ...leadValues, nowUser]
      );
      await db.run(
        'INSERT INTO crm_activities (id, lead_id, activity_type, description, created_by) VALUES (?, ?, ?, ?, ?)',
        [generateId(), id, 'created', 'Lead created from CRM lead form', nowUser]
      );
      if (form.next_followup_date) {
        await db.run(
          `INSERT INTO crm_followups (id, lead_id, followup_type, scheduled_date, notes, created_by)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [generateId(), id, 'call', form.next_followup_date, 'Initial lead follow-up', nowUser]
        );
      }
    }

    closeEditor();
    await Promise.all([loadLeads(), loadCrmStats?.()]);
  };

  const closeLead = async (lead) => {
    if (!window.confirm('Mark this lead as closed lost?')) return;
    await db.run("UPDATE crm_leads SET status='closed_lost', updated_at=datetime('now') WHERE id=?", [lead.id]);
    await loadLeads();
    await loadCrmStats?.();
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>Leads Management</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>Database-backed lead control from contact capture to follow-up and conversion.</p>
        </div>
        <button className="btn btn-primary" onClick={() => openEditor()}><Plus size={16} />Add New Lead</button>
      </div>

      <div className="filter-bar">
        <div className="search-bar">
          <Search size={16} color="var(--text-muted)" />
          <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search lead, company, phone, email..." />
        </div>
        <select className="form-control" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ maxWidth: 170 }}>
          <option value="all">All Status</option>
          {statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
        </select>
        <select className="form-control" value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={{ maxWidth: 170 }}>
          <option value="all">All Sources</option>
          {sourceOptions.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}
        </select>
        <span className="text-muted text-sm" style={{ marginLeft: 'auto' }}>{filteredLeads.length} leads</span>
      </div>

      <div className="page-content" style={{ padding: 0 }}>
        <div className="table-container" style={{ height: '100%' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Contact</th>
                <th>Value</th>
                <th>Stage</th>
                <th>Next Action</th>
                <th>Owner</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.length === 0 ? (
                <tr><td colSpan={7}><div className="empty-state"><Users size={40} /><p>No leads found</p></div></td></tr>
              ) : filteredLeads.map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <div className="catalogue-product-title">{lead.company_name || 'Unlinked customer'}</div>
                    <div className="catalogue-product-meta">
                      <span className="font-mono text-sm text-accent">{lead.lead_number || lead.id.slice(0, 8)}</span>
                      <span>{lead.industry || 'No industry'}</span>
                    </div>
                  </td>
                  <td>
                    <div>{lead.contact_person || '-'}</div>
                    <div className="text-muted text-sm" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {lead.phone && <span><Phone size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{lead.phone}</span>}
                      {lead.email && <span><Mail size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{lead.email}</span>}
                    </div>
                  </td>
                  <td>
                    <strong>{formatCurrency(lead.value || 0, currency)}</strong>
                    <div className="text-muted text-sm">{Number(lead.probability || 0)}% probability</div>
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span className="badge" style={{ color: getStatusColor(lead.status), background: `${getStatusColor(lead.status)}18` }}>
                        {statusOptions.find((status) => status.value === lead.status)?.label || lead.status}
                      </span>
                      <span className="badge" style={{ color: getPriorityColor(lead.priority), background: `${getPriorityColor(lead.priority)}18` }}>
                        {lead.priority || 'medium'}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div><Calendar size={13} style={{ verticalAlign: 'middle', marginRight: 4 }} />{lead.next_followup_date || lead.expected_close_date || '-'}</div>
                    <div className="text-muted text-sm">Last: {lead.last_contact || 'Never'}</div>
                  </td>
                  <td>{lead.assigned_user || lead.assigned_to || getOwnerName(currentUser) || '-'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openEditor(lead)} title="Edit"><Edit size={14} /></button>
                      <button className="btn btn-danger btn-icon btn-sm" onClick={() => closeLead(lead)} title="Close lost"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreateModal && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && closeEditor()}>
          <div className="modal modal-xl">
            <div className="modal-header">
              <div>
                <h3>{editingLead ? 'Edit Lead' : 'Create Lead'}</h3>
                <div className="text-secondary text-sm" style={{ marginTop: 4 }}>Create one customer master, one active lead, and an optional first follow-up.</div>
              </div>
              <button className="close-btn" onClick={closeEditor}>x</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {error && <div className="catalogue-form-alert"><span>{error}</span></div>}
              <div className="catalogue-form-section">
                <div className="catalogue-form-section-header"><h4>Customer</h4><span>Duplicate checks use phone and email before creating a new contact.</span></div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Company Name *</label><input className="form-control" value={form.company_name} onChange={(e) => updateField('company_name', e.target.value)} autoFocus /></div>
                  <div className="form-group"><label className="form-label">Contact Person *</label><input className="form-control" value={form.contact_person} onChange={(e) => updateField('contact_person', e.target.value)} /></div>
                </div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">Phone</label><input className="form-control" value={form.phone} onChange={(e) => updateField('phone', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Email</label><input className="form-control" type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} /></div>
                </div>
                <div className="form-group"><label className="form-label">Address</label><input className="form-control" value={form.address} onChange={(e) => updateField('address', e.target.value)} /></div>
                <div className="grid-2">
                  <div className="form-group"><label className="form-label">City</label><input className="form-control" value={form.city} onChange={(e) => updateField('city', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">State</label><input className="form-control" value={form.state} onChange={(e) => updateField('state', e.target.value)} /></div>
                </div>
              </div>

              <div className="catalogue-form-section">
                <div className="catalogue-form-section-header"><h4>Opportunity</h4><span>Status, value, probability, and owner drive pipeline and performance dashboards.</span></div>
                <div className="grid-3">
                  <div className="form-group"><label className="form-label">Source</label><select className="form-control" value={form.lead_source} onChange={(e) => updateField('lead_source', e.target.value)}>{sourceOptions.map((source) => <option key={source.value} value={source.value}>{source.label}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Industry</label><select className="form-control" value={form.industry} onChange={(e) => updateField('industry', e.target.value)}><option value="">Select industry</option>{industryOptions.map((industry) => <option key={industry} value={industry}>{industry}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Value</label><input className="form-control" type="number" min="0" step="0.01" value={form.value} onChange={(e) => updateField('value', e.target.value)} /></div>
                </div>
                <div className="grid-3">
                  <div className="form-group"><label className="form-label">Probability %</label><input className="form-control" type="number" min="0" max="100" value={form.probability} onChange={(e) => updateField('probability', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Status</label><select className="form-control" value={form.status} onChange={(e) => updateField('status', e.target.value)}>{statusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></div>
                  <div className="form-group"><label className="form-label">Priority</label><select className="form-control" value={form.priority} onChange={(e) => updateField('priority', e.target.value)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
                </div>
                <div className="grid-3">
                  <div className="form-group"><label className="form-label">Expected Close</label><input className="form-control" type="date" value={form.expected_close_date} onChange={(e) => updateField('expected_close_date', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">First Follow-up</label><input className="form-control" type="date" min={today()} value={form.next_followup_date} onChange={(e) => updateField('next_followup_date', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Owner</label><select className="form-control" value={form.assigned_to} onChange={(e) => updateField('assigned_to', e.target.value)}><option value="">Unassigned</option>{users.map((user) => <option key={user.id} value={user.id}>{user.full_name || user.username}</option>)}</select></div>
                </div>
                <div className="form-group"><label className="form-label">Notes</label><textarea className="form-control" rows={3} value={form.notes} onChange={(e) => updateField('notes', e.target.value)} /></div>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={closeEditor}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={saveLead}>{editingLead ? 'Update Lead' : 'Create Lead'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
