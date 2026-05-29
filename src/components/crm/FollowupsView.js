import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, CheckCircle, Edit, Plus, Search, Trash2 } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import db, { generateId } from '../../utils/database';

const today = () => new Date().toISOString().slice(0, 10);

const emptyForm = (currentUser) => ({
  lead_id: '',
  followup_type: 'call',
  scheduled_date: today(),
  notes: '',
  outcome: '',
  next_followup_date: '',
  assigned_to: currentUser?.id || ''
});

const followupTypes = [
  { value: 'call', label: 'Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'demo', label: 'Demo' },
  { value: 'site_visit', label: 'Site Visit' }
];

export default function FollowupsView() {
  const { currentUser, loadCrmStats } = useAppStore();
  const [followups, setFollowups] = useState([]);
  const [leads, setLeads] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm(currentUser));
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const text = search.trim().toLowerCase();
    if (!text) {
      setFiltered(followups);
      return;
    }
    setFiltered(followups.filter((item) => [
      item.lead_number,
      item.company_name,
      item.contact_person,
      item.followup_type,
      item.notes,
      item.outcome
    ].filter(Boolean).join(' ').toLowerCase().includes(text)));
  }, [followups, search]);

  const loadData = async () => {
    const [followupRows, leadRows] = await Promise.all([
      db.all(`
        SELECT f.*, l.lead_number, l.status AS lead_status, c.company AS company_name, c.name AS contact_person,
          u.full_name AS created_by_name
        FROM crm_followups f
        JOIN crm_leads l ON l.id = f.lead_id
        LEFT JOIN contacts c ON c.id = l.customer_id
        LEFT JOIN users u ON u.id = f.created_by
        ORDER BY COALESCE(f.actual_date, f.scheduled_date) ASC, datetime(f.created_at) DESC
      `),
      db.all(`
        SELECT l.id, l.lead_number, c.company AS company_name, c.name AS contact_person
        FROM crm_leads l
        LEFT JOIN contacts c ON c.id = l.customer_id
        WHERE l.status NOT IN ('closed_won', 'closed_lost')
        ORDER BY datetime(l.updated_at) DESC, datetime(l.created_at) DESC
      `)
    ]);
    setFollowups(followupRows || []);
    setLeads(leadRows || []);
  };

  const counts = useMemo(() => {
    const pending = followups.filter((item) => !item.actual_date).length;
    const overdue = followups.filter((item) => !item.actual_date && item.scheduled_date < today()).length;
    const done = followups.filter((item) => item.actual_date).length;
    return { pending, overdue, done };
  }, [followups]);

  const openForm = (item = null) => {
    setError('');
    if (item) {
      setForm({
        lead_id: item.lead_id || '',
        followup_type: item.followup_type || 'call',
        scheduled_date: (item.scheduled_date || '').slice(0, 10),
        notes: item.notes || '',
        outcome: item.outcome || '',
        next_followup_date: (item.next_followup_date || '').slice(0, 10),
        assigned_to: currentUser?.id || ''
      });
      setEditing(item);
    } else {
      setForm(emptyForm(currentUser));
      setEditing(null);
    }
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditing(null);
    setError('');
    setForm(emptyForm(currentUser));
  };

  const saveFollowup = async () => {
    if (!form.lead_id || !form.scheduled_date) {
      setError('Lead and scheduled date are required.');
      return;
    }

    if (editing?.id) {
      await db.run(
        `UPDATE crm_followups
         SET lead_id=?, followup_type=?, scheduled_date=?, notes=?, outcome=?, next_followup_date=?
         WHERE id=?`,
        [
          form.lead_id,
          form.followup_type,
          form.scheduled_date,
          form.notes,
          form.outcome,
          form.next_followup_date || null,
          editing.id
        ]
      );
    } else {
      const id = generateId();
      await db.run(
        `INSERT INTO crm_followups (id, lead_id, followup_type, scheduled_date, notes, outcome, next_followup_date, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          form.lead_id,
          form.followup_type,
          form.scheduled_date,
          form.notes,
          form.outcome,
          form.next_followup_date || null,
          currentUser?.id || null
        ]
      );
      await db.run(
        `INSERT INTO crm_alerts (id, type, title, message, scheduled_date, lead_id, followup_id, assigned_to, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          generateId(),
          'followup',
          'Follow-up Reminder',
          `Follow-up scheduled for ${form.scheduled_date}`,
          form.scheduled_date,
          form.lead_id,
          id,
          form.assigned_to || currentUser?.id || null,
          currentUser?.id || null
        ]
      );
    }

    closeForm();
    await Promise.all([loadData(), loadCrmStats?.()]);
  };

  const completeFollowup = async (item) => {
    await db.run(
      `UPDATE crm_followups
       SET actual_date = COALESCE(actual_date, date('now')),
        outcome = COALESCE(NULLIF(outcome, ''), 'Completed')
       WHERE id=?`,
      [item.id]
    );
    await db.run('UPDATE crm_alerts SET is_completed=1, completed_at=datetime("now") WHERE followup_id=?', [item.id]);
    await Promise.all([loadData(), loadCrmStats?.()]);
  };

  const removeFollowup = async (id) => {
    if (!window.confirm('Delete this follow-up?')) return;
    await db.run('DELETE FROM crm_followups WHERE id=?', [id]);
    await db.run('UPDATE crm_alerts SET is_active=0 WHERE followup_id=?', [id]);
    await Promise.all([loadData(), loadCrmStats?.()]);
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 26, color: 'var(--text)', margin: 0 }}>Follow-ups Module</h1>
          <p style={{ color: 'var(--text-muted)' }}>Every row is linked to a CRM lead and updates CRM reminders.</p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div className="search-bar" style={{ minWidth: 260 }}>
            <Search size={16} color="var(--text-muted)" />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search follow-ups..." />
          </div>
          <button className="btn btn-primary" onClick={() => openForm()}><Plus size={16} />New Follow-up</button>
        </div>
      </div>

      <div className="catalogue-summary-grid" style={{ marginBottom: 18 }}>
        <div className="catalogue-summary-card"><div className="catalogue-summary-title">Pending</div><strong>{counts.pending}</strong><span className="text-muted text-sm">Open actions</span></div>
        <div className="catalogue-summary-card"><div className="catalogue-summary-title">Overdue</div><strong>{counts.overdue}</strong><span className={counts.overdue ? 'text-danger text-sm' : 'text-success text-sm'}>{counts.overdue ? 'Needs attention' : 'No overdue work'}</span></div>
        <div className="catalogue-summary-card"><div className="catalogue-summary-title">Completed</div><strong>{counts.done}</strong><span className="text-muted text-sm">Closed follow-ups</span></div>
      </div>

      <div className="page-content" style={{ padding: 0 }}>
        <div className="table-container" style={{ height: '100%' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Lead</th>
                <th>Type</th>
                <th>Scheduled</th>
                <th>Status</th>
                <th>Outcome / Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={6}><div className="empty-state"><Calendar size={40} /><p>No follow-ups found</p></div></td></tr>
              ) : filtered.map((item) => {
                const isDone = Boolean(item.actual_date);
                const isOverdue = !isDone && item.scheduled_date < today();
                return (
                  <tr key={item.id}>
                    <td>
                      <div className="catalogue-product-title">{item.company_name || item.contact_person || 'Unlinked lead'}</div>
                      <div className="catalogue-product-meta"><span className="font-mono text-sm text-accent">{item.lead_number}</span><span>{item.contact_person || '-'}</span></div>
                    </td>
                    <td>{followupTypes.find((type) => type.value === item.followup_type)?.label || item.followup_type}</td>
                    <td>{item.scheduled_date || '-'}</td>
                    <td>
                      <span className="badge" style={{ color: isDone ? 'var(--success)' : isOverdue ? 'var(--danger)' : 'var(--warning)', background: isDone ? 'var(--success-dim)' : isOverdue ? 'var(--danger-dim)' : 'var(--warning-dim)' }}>
                        {isDone ? 'Done' : isOverdue ? 'Overdue' : 'Pending'}
                      </span>
                    </td>
                    <td>
                      <div>{item.outcome || '-'}</div>
                      <div className="text-muted text-sm">{item.notes || '-'}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {!isDone && <button className="btn btn-secondary btn-icon btn-sm" onClick={() => completeFollowup(item)} title="Complete"><CheckCircle size={14} /></button>}
                        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => openForm(item)} title="Edit"><Edit size={14} /></button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => removeFollowup(item.id)} title="Delete"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && closeForm()}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <div>
                <h3>{editing ? 'Edit Follow-up' : 'Create Follow-up'}</h3>
                <div className="text-secondary text-sm" style={{ marginTop: 4 }}>Select a CRM lead so this action appears in the lead timeline and dashboard.</div>
              </div>
              <button className="close-btn" onClick={closeForm}>x</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 14 }}>
              {error && <div className="catalogue-form-alert"><span>{error}</span></div>}
              <div className="form-group">
                <label className="form-label">Lead *</label>
                <select className="form-control" value={form.lead_id} onChange={(e) => setForm({ ...form, lead_id: e.target.value })}>
                  <option value="">Select lead...</option>
                  {leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.lead_number} - {lead.company_name || lead.contact_person || 'Lead'}</option>)}
                </select>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <select className="form-control" value={form.followup_type} onChange={(e) => setForm({ ...form, followup_type: e.target.value })}>
                    {followupTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Scheduled Date *</label>
                  <input className="form-control" type="date" value={form.scheduled_date} onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })} />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Outcome</label>
                  <input className="form-control" value={form.outcome} onChange={(e) => setForm({ ...form, outcome: e.target.value })} placeholder="Interested, demo requested..." />
                </div>
                <div className="form-group">
                  <label className="form-label">Next Follow-up</label>
                  <input className="form-control" type="date" value={form.next_followup_date} onChange={(e) => setForm({ ...form, next_followup_date: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeForm}>Cancel</button>
              <button className="btn btn-primary" onClick={saveFollowup}>{editing ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
