import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Mail, Phone, Plus } from 'lucide-react';
import db, { formatCurrency } from '../../utils/database';
import { useAppStore } from '../../store/appStore';

const stages = [
  { id: 'new', label: 'New', color: '#6366f1' },
  { id: 'contacted', label: 'Contacted', color: '#8b5cf6' },
  { id: 'qualified', label: 'Qualified', color: '#06b6d4' },
  { id: 'proposal', label: 'Proposal', color: '#10b981' },
  { id: 'negotiation', label: 'Negotiation', color: '#f59e0b' },
  { id: 'closed_won', label: 'Closed Won', color: '#22c55e' },
  { id: 'closed_lost', label: 'Closed Lost', color: '#ef4444' }
];

export default function LeadPipeline() {
  const { settings } = useAppStore();
  const [leads, setLeads] = useState([]);
  const currency = settings?.currency_symbol || '\u20B9';

  useEffect(() => {
    loadLeads();
  }, []);

  const loadLeads = async () => {
    const rows = await db.all(`
      SELECT l.*, c.name AS customer_name, c.company, c.email, c.phone,
        MAX(f.scheduled_date) AS next_followup_date
      FROM crm_leads l
      LEFT JOIN contacts c ON c.id = l.customer_id
      LEFT JOIN crm_followups f ON f.lead_id = l.id AND f.actual_date IS NULL
      GROUP BY l.id
      ORDER BY datetime(l.updated_at) DESC, datetime(l.created_at) DESC
    `);
    setLeads(rows || []);
  };

  const totalsByStage = useMemo(() => {
    return stages.reduce((acc, stage) => {
      const rows = leads.filter((lead) => lead.status === stage.id);
      acc[stage.id] = {
        count: rows.length,
        value: rows.reduce((sum, lead) => sum + Number(lead.value || 0), 0)
      };
      return acc;
    }, {});
  }, [leads]);

  const updateStage = async (lead, status) => {
    await db.run('UPDATE crm_leads SET status=?, updated_at=datetime("now") WHERE id=?', [status, lead.id]);
    await loadLeads();
  };

  const LeadCard = ({ lead }) => (
    <div style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: 14,
      marginBottom: 12
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>{lead.company || lead.customer_name || 'Unlinked lead'}</div>
          <div className="text-muted text-sm">{lead.customer_name || lead.lead_number}</div>
        </div>
        <strong style={{ color: 'var(--success)', whiteSpace: 'nowrap' }}>{formatCurrency(lead.value || 0, currency)}</strong>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: Number(lead.probability || 0) >= 60 ? 'var(--success)' : Number(lead.probability || 0) >= 30 ? 'var(--warning)' : 'var(--danger)' }} />
        <span className="text-muted text-sm">{Number(lead.probability || 0)}% probability</span>
      </div>
      <div className="text-muted text-sm" style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 10 }}>
        <span><Calendar size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{lead.next_followup_date || lead.expected_close_date || 'No date set'}</span>
        {lead.phone && <span><Phone size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{lead.phone}</span>}
        {lead.email && <span><Mail size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />{lead.email}</span>}
      </div>
      <select className="form-control" value={lead.status} onChange={(event) => updateStage(lead, event.target.value)}>
        {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.label}</option>)}
      </select>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>Lead Pipeline</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>Live pipeline grouped from CRM lead records.</p>
        </div>
        <button className="btn btn-secondary" onClick={loadLeads}><Plus size={16} />Refresh Pipeline</button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))',
        gap: 18,
        overflowX: 'auto',
        paddingBottom: 20
      }}>
        {stages.map((stage) => {
          const rows = leads.filter((lead) => lead.status === stage.id);
          return (
            <div key={stage.id} style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: 14,
              minHeight: 360
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: stage.color }} />
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>{stage.label}</h3>
                <span className="badge badge-secondary">{totalsByStage[stage.id]?.count || 0}</span>
              </div>
              <div className="text-muted text-sm" style={{ marginBottom: 12 }}>{formatCurrency(totalsByStage[stage.id]?.value || 0, currency)} pipeline value</div>
              {rows.length ? rows.map((lead) => <LeadCard key={lead.id} lead={lead} />) : (
                <div style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)', fontSize: 14 }}>No leads in this stage</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
