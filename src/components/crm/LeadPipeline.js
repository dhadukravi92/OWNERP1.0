import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { Plus, MoreVertical, User, Calendar, Phone, Mail } from 'lucide-react';

const LeadPipeline = () => {
  const { createLead, scheduleFollowup } = useAppStore();
  const [leads, setLeads] = useState([]);

  // Mock data - in real app, this would come from database
  useEffect(() => {
    setLeads([
      {
        id: '1',
        lead_number: 'LEAD-001',
        customer_name: 'Rajesh Kumar',
        company: 'ABC Industries',
        value: 150000,
        status: 'new',
        probability: 20,
        expected_close_date: '2024-02-15',
        last_activity: '2024-01-15'
      },
      {
        id: '2',
        lead_number: 'LEAD-002',
        customer_name: 'Priya Sharma',
        company: 'XYZ Corp',
        value: 250000,
        status: 'qualified',
        probability: 60,
        expected_close_date: '2024-01-30',
        last_activity: '2024-01-14'
      }
    ]);
  }, []);

  const stages = [
    { id: 'new', label: 'New', color: '#6366f1' },
    { id: 'contacted', label: 'Contacted', color: '#8b5cf6' },
    { id: 'qualified', label: 'Qualified', color: '#06b6d4' },
    { id: 'proposal', label: 'Proposal', color: '#10b981' },
    { id: 'negotiation', label: 'Negotiation', color: '#f59e0b' },
    { id: 'closed_won', label: 'Closed Won', color: '#22c55e' },
    { id: 'closed_lost', label: 'Closed Lost', color: '#ef4444' }
  ];

  const getLeadsByStage = (stageId) => {
    return leads.filter(lead => lead.status === stageId);
  };

  const LeadCard = ({ lead }) => (
    <div style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border)',
      borderRadius: 8,
      padding: 16,
      marginBottom: 12,
      cursor: 'pointer',
      transition: 'all 0.2s ease'
    }}
    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{lead.customer_name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lead.company}</div>
        </div>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <MoreVertical size={14} color="var(--text-muted)" />
        </button>
      </div>

      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--success)' }}>
          {lead.value.toLocaleString()}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: lead.probability > 50 ? 'var(--success)' : lead.probability > 25 ? 'var(--warning)' : 'var(--danger)'
        }}></div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lead.probability}% probability</span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 8 }}>
        <Calendar size={12} color="var(--text-muted)" />
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Expected: {new Date(lead.expected_close_date).toLocaleDateString()}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={{
          flex: 1,
          background: 'var(--accent-dim)',
          color: 'var(--accent)',
          border: 'none',
          borderRadius: 4,
          padding: '6px 8px',
          fontSize: 12,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4
        }}>
          <Phone size={12} />
          Call
        </button>
        <button style={{
          flex: 1,
          background: 'var(--primary-dim)',
          color: 'var(--primary)',
          border: 'none',
          borderRadius: 4,
          padding: '6px 8px',
          fontSize: 12,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4
        }}>
          <Mail size={12} />
          Email
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>Lead Pipeline</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>Visualize and manage your sales pipeline</p>
        </div>
        <button
          onClick={() => {
            // Open create lead modal
          }}
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
          Add Lead
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20,
        overflowX: 'auto',
        paddingBottom: 20
      }}>
        {stages.map(stage => (
          <div key={stage.id} style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 16,
            minHeight: 400
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: '1px solid var(--border)'
            }}>
              <div style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: stage.color
              }}></div>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                {stage.label}
              </h3>
              <span style={{
                background: 'var(--bg-primary)',
                color: 'var(--text-muted)',
                padding: '2px 6px',
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 600
              }}>
                {getLeadsByStage(stage.id).length}
              </span>
            </div>

            <div>
              {getLeadsByStage(stage.id).map(lead => (
                <LeadCard key={lead.id} lead={lead} />
              ))}

              {getLeadsByStage(stage.id).length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: 32,
                  color: 'var(--text-muted)',
                  fontSize: 14
                }}>
                  No leads in this stage
                </div>
              )}
            </div>

            <button style={{
              width: '100%',
              background: 'none',
              border: '1px dashed var(--border)',
              borderRadius: 8,
              padding: 12,
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: 14,
              marginTop: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}>
              <Plus size={16} />
              Add Lead
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default LeadPipeline;
