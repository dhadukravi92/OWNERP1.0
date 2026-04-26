import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import {
  Zap, Plus, Settings, Play, Pause, Trash2,
  ArrowRight, Clock, Mail, MessageSquare, User,
  CheckCircle, AlertTriangle, Edit
} from 'lucide-react';

const WorkflowAutomation = () => {
  const { currentUser } = useAppStore();
  const [workflows, setWorkflows] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const [newWorkflow, setNewWorkflow] = useState({
    name: '',
    description: '',
    trigger: 'lead_created',
    conditions: [],
    actions: [],
    is_active: true
  });

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = () => {
    const mockWorkflows = [
      {
        id: '1',
        name: 'Lead Follow-up Reminder',
        description: 'Send email reminder 3 days after lead creation if no activity',
        trigger: 'lead_created',
        conditions: [
          { field: 'days_since_creation', operator: 'equals', value: '3' },
          { field: 'last_activity', operator: 'is_null', value: '' }
        ],
        actions: [
          { type: 'send_email', template: 'followup_reminder', recipient: 'lead_owner' },
          { type: 'create_alert', title: 'Follow-up Required', priority: 'medium' }
        ],
        is_active: true,
        created_at: '2024-01-01',
        executions: 45,
        success_rate: 92
      },
      {
        id: '2',
        name: 'High-Value Lead Escalation',
        description: 'Escalate leads with value > ₹100,000 to manager',
        trigger: 'lead_updated',
        conditions: [
          { field: 'value', operator: 'greater_than', value: '100000' },
          { field: 'probability', operator: 'greater_than', value: '70' }
        ],
        actions: [
          { type: 'assign_to', user: 'manager' },
          { type: 'send_notification', message: 'High-value lead requires attention', priority: 'high' },
          { type: 'update_priority', priority: 'high' }
        ],
        is_active: true,
        created_at: '2024-01-05',
        executions: 12,
        success_rate: 100
      },
      {
        id: '3',
        name: 'Quotation Expiry Alert',
        description: 'Send alert 2 days before quotation expires',
        trigger: 'scheduled',
        schedule: 'daily',
        conditions: [
          { field: 'quotation_expiry', operator: 'less_than', value: '2_days' },
          { field: 'status', operator: 'not_equals', value: 'expired' }
        ],
        actions: [
          { type: 'create_alert', title: 'Quotation Expiring Soon', priority: 'high' },
          { type: 'send_email', template: 'quotation_expiry', recipient: 'sales_rep' }
        ],
        is_active: false,
        created_at: '2024-01-10',
        executions: 8,
        success_rate: 85
      }
    ];
    setWorkflows(mockWorkflows);
  };

  const triggers = [
    { value: 'lead_created', label: 'Lead Created' },
    { value: 'lead_updated', label: 'Lead Updated' },
    { value: 'quotation_created', label: 'Quotation Created' },
    { value: 'quotation_sent', label: 'Quotation Sent' },
    { value: 'followup_completed', label: 'Follow-up Completed' },
    { value: 'scheduled', label: 'Scheduled (Time-based)' }
  ];

  const conditions = [
    { field: 'value', label: 'Lead Value', type: 'number' },
    { field: 'probability', label: 'Probability (%)', type: 'number' },
    { field: 'industry', label: 'Industry', type: 'text' },
    { field: 'source', label: 'Lead Source', type: 'text' },
    { field: 'days_since_creation', label: 'Days Since Creation', type: 'number' },
    { field: 'last_activity', label: 'Last Activity', type: 'date' },
    { field: 'quotation_expiry', label: 'Quotation Expiry', type: 'date' },
    { field: 'status', label: 'Status', type: 'text' }
  ];

  const operators = [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Not Equals' },
    { value: 'greater_than', label: 'Greater Than' },
    { value: 'less_than', label: 'Less Than' },
    { value: 'contains', label: 'Contains' },
    { value: 'is_null', label: 'Is Empty' },
    { value: 'is_not_null', label: 'Is Not Empty' }
  ];

  const actions = [
    { type: 'send_email', label: 'Send Email', icon: Mail },
    { type: 'send_sms', label: 'Send SMS', icon: MessageSquare },
    { type: 'create_alert', label: 'Create Alert', icon: AlertTriangle },
    { type: 'assign_to', label: 'Assign To User', icon: User },
    { type: 'update_priority', label: 'Update Priority', icon: Zap },
    { type: 'send_notification', label: 'Send Notification', icon: CheckCircle }
  ];

  const addCondition = () => {
    setNewWorkflow({
      ...newWorkflow,
      conditions: [...newWorkflow.conditions, { field: '', operator: '', value: '' }]
    });
  };

  const addAction = () => {
    setNewWorkflow({
      ...newWorkflow,
      actions: [...newWorkflow.actions, { type: '', template: '', recipient: '', priority: 'medium' }]
    });
  };

  const saveWorkflow = () => {
    if (editingWorkflow) {
      setWorkflows(workflows.map(w => w.id === editingWorkflow.id ? { ...newWorkflow, id: editingWorkflow.id } : w));
    } else {
      const workflow = {
        ...newWorkflow,
        id: Date.now().toString(),
        created_at: new Date().toISOString().split('T')[0],
        executions: 0,
        success_rate: 0
      };
      setWorkflows([...workflows, workflow]);
    }
    setShowCreateModal(false);
    setEditingWorkflow(null);
    setNewWorkflow({
      name: '',
      description: '',
      trigger: 'lead_created',
      conditions: [],
      actions: [],
      is_active: true
    });
  };

  const toggleWorkflow = (id) => {
    setWorkflows(workflows.map(w =>
      w.id === id ? { ...w, is_active: !w.is_active } : w
    ));
  };

  const deleteWorkflow = (id) => {
    if (window.confirm('Are you sure you want to delete this workflow?')) { // eslint-disable-line no-restricted-globals
      setWorkflows(workflows.filter(w => w.id !== id));
    }
  };

  const editWorkflow = (workflow) => {
    setEditingWorkflow(workflow);
    setNewWorkflow(workflow);
    setShowCreateModal(true);
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>
            Workflow Automation
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
            Create custom rules and triggers to automate your CRM processes
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
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
          Create Workflow
        </button>
      </div>

      {/* Workflow Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 20,
        marginBottom: 32
      }}>
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
          textAlign: 'center'
        }}>
          <Zap size={32} color="var(--accent)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {workflows.filter(w => w.is_active).length}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Active Workflows</div>
        </div>

        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
          textAlign: 'center'
        }}>
          <Play size={32} color="var(--success)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {workflows.reduce((sum, w) => sum + w.executions, 0)}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Total Executions</div>
        </div>

        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20,
          textAlign: 'center'
        }}>
          <CheckCircle size={32} color="var(--info)" style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {Math.round(workflows.reduce((sum, w) => sum + w.success_rate, 0) / workflows.length) || 0}%
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Avg Success Rate</div>
        </div>
      </div>

      {/* Workflows List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {workflows.map(workflow => (
          <div key={workflow.id} style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 24
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                    {workflow.name}
                  </h3>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '4px 8px',
                    borderRadius: 12,
                    fontSize: 12,
                    fontWeight: 600,
                    background: workflow.is_active ? 'var(--success-dim)' : 'var(--text-muted-dim)',
                    color: workflow.is_active ? 'var(--success)' : 'var(--text-muted)'
                  }}>
                    {workflow.is_active ? <Play size={12} /> : <Pause size={12} />}
                    {workflow.is_active ? 'Active' : 'Inactive'}
                  </div>
                </div>
                <p style={{ color: 'var(--text-muted)', margin: 0, marginBottom: 12 }}>
                  {workflow.description}
                </p>
                <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                  <span>Trigger: {triggers.find(t => t.value === workflow.trigger)?.label}</span>
                  <span>Created: {workflow.created_at}</span>
                  <span>Executions: {workflow.executions}</span>
                  <span>Success Rate: {workflow.success_rate}%</span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => toggleWorkflow(workflow.id)}
                  style={{
                    background: workflow.is_active ? 'var(--warning-dim)' : 'var(--success-dim)',
                    color: workflow.is_active ? 'var(--warning)' : 'var(--success)',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px',
                    cursor: 'pointer'
                  }}
                >
                  {workflow.is_active ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  onClick={() => editWorkflow(workflow)}
                  style={{
                    background: 'var(--primary-dim)',
                    color: 'var(--primary)',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <Edit size={16} />
                </button>
                <button
                  onClick={() => deleteWorkflow(workflow.id)}
                  style={{
                    background: 'var(--danger-dim)',
                    color: 'var(--danger)',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            {/* Workflow Logic Preview */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: 12,
                fontSize: 14,
                color: 'var(--text)'
              }}>
                <strong>WHEN</strong> {triggers.find(t => t.value === workflow.trigger)?.label}
              </div>

              {workflow.conditions.length > 0 && (
                <>
                  <ArrowRight size={16} color="var(--text-muted)" />
                  <div style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    color: 'var(--text)'
                  }}>
                    <strong>IF</strong> {workflow.conditions.length} condition{workflow.conditions.length > 1 ? 's' : ''}
                  </div>
                </>
              )}

              {workflow.actions.length > 0 && (
                <>
                  <ArrowRight size={16} color="var(--text-muted)" />
                  <div style={{
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: 12,
                    fontSize: 14,
                    color: 'var(--text)'
                  }}>
                    <strong>THEN</strong> {workflow.actions.length} action{workflow.actions.length > 1 ? 's' : ''}
                  </div>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Create/Edit Workflow Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 24,
            width: '800px',
            maxWidth: '90vw',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
              {editingWorkflow ? 'Edit Workflow' : 'Create New Workflow'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                    Workflow Name
                  </label>
                  <input
                    type="text"
                    value={newWorkflow.name}
                    onChange={e => setNewWorkflow({...newWorkflow, name: e.target.value})}
                    placeholder="Enter workflow name"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      background: 'var(--bg-secondary)',
                      color: 'var(--text)',
                      fontSize: 14
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                    Trigger Event
                  </label>
                  <select
                    value={newWorkflow.trigger}
                    onChange={e => setNewWorkflow({...newWorkflow, trigger: e.target.value})}
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      border: '1px solid var(--border)',
                      borderRadius: 6,
                      background: 'var(--bg-secondary)',
                      color: 'var(--text)',
                      fontSize: 14
                    }}
                  >
                    {triggers.map(trigger => (
                      <option key={trigger.value} value={trigger.value}>{trigger.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  Description
                </label>
                <textarea
                  value={newWorkflow.description}
                  onChange={e => setNewWorkflow({...newWorkflow, description: e.target.value})}
                  placeholder="Describe what this workflow does"
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                    background: 'var(--bg-secondary)',
                    color: 'var(--text)',
                    fontSize: 14,
                    resize: 'vertical'
                  }}
                />
              </div>

              {/* Conditions */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                    Conditions (All must be true)
                  </h4>
                  <button
                    onClick={addCondition}
                    style={{
                      background: 'var(--accent-dim)',
                      color: 'var(--accent)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 12px',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Plus size={14} />
                    Add Condition
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {newWorkflow.conditions.map((condition, index) => (
                    <div key={index} style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 2fr auto',
                      gap: 8,
                      alignItems: 'center'
                    }}>
                      <select
                        value={condition.field}
                        onChange={e => {
                          const newConditions = [...newWorkflow.conditions];
                          newConditions[index].field = e.target.value;
                          setNewWorkflow({...newWorkflow, conditions: newConditions});
                        }}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          background: 'var(--bg-secondary)',
                          color: 'var(--text)',
                          fontSize: 12
                        }}
                      >
                        <option value="">Select Field</option>
                        {conditions.map(cond => (
                          <option key={cond.field} value={cond.field}>{cond.label}</option>
                        ))}
                      </select>
                      <select
                        value={condition.operator}
                        onChange={e => {
                          const newConditions = [...newWorkflow.conditions];
                          newConditions[index].operator = e.target.value;
                          setNewWorkflow({...newWorkflow, conditions: newConditions});
                        }}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          background: 'var(--bg-secondary)',
                          color: 'var(--text)',
                          fontSize: 12
                        }}
                      >
                        <option value="">Operator</option>
                        {operators.map(op => (
                          <option key={op.value} value={op.value}>{op.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={condition.value}
                        onChange={e => {
                          const newConditions = [...newWorkflow.conditions];
                          newConditions[index].value = e.target.value;
                          setNewWorkflow({...newWorkflow, conditions: newConditions});
                        }}
                        placeholder="Value"
                        style={{
                          padding: '8px 12px',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          background: 'var(--bg-secondary)',
                          color: 'var(--text)',
                          fontSize: 12
                        }}
                      />
                      <button
                        onClick={() => {
                          const newConditions = newWorkflow.conditions.filter((_, i) => i !== index);
                          setNewWorkflow({...newWorkflow, conditions: newConditions});
                        }}
                        style={{
                          background: 'var(--danger-dim)',
                          color: 'var(--danger)',
                          border: 'none',
                          borderRadius: 4,
                          padding: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
                    Actions (Execute in order)
                  </h4>
                  <button
                    onClick={addAction}
                    style={{
                      background: 'var(--accent-dim)',
                      color: 'var(--accent)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 12px',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Plus size={14} />
                    Add Action
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {newWorkflow.actions.map((action, index) => (
                    <div key={index} style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr auto',
                      gap: 8,
                      alignItems: 'center'
                    }}>
                      <select
                        value={action.type}
                        onChange={e => {
                          const newActions = [...newWorkflow.actions];
                          newActions[index].type = e.target.value;
                          setNewWorkflow({...newWorkflow, actions: newActions});
                        }}
                        style={{
                          padding: '8px 12px',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          background: 'var(--bg-secondary)',
                          color: 'var(--text)',
                          fontSize: 12
                        }}
                      >
                        <option value="">Select Action</option>
                        {actions.map(act => (
                          <option key={act.type} value={act.type}>{act.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={action.template || action.recipient || action.message || ''}
                        onChange={e => {
                          const newActions = [...newWorkflow.actions];
                          if (action.type.includes('email') || action.type.includes('sms')) {
                            newActions[index].template = e.target.value;
                          } else if (action.type.includes('notification') || action.type.includes('alert')) {
                            newActions[index].message = e.target.value;
                          } else {
                            newActions[index].recipient = e.target.value;
                          }
                          setNewWorkflow({...newWorkflow, actions: newActions});
                        }}
                        placeholder="Template/Recipient/Message"
                        style={{
                          padding: '8px 12px',
                          border: '1px solid var(--border)',
                          borderRadius: 4,
                          background: 'var(--bg-secondary)',
                          color: 'var(--text)',
                          fontSize: 12
                        }}
                      />
                      <button
                        onClick={() => {
                          const newActions = newWorkflow.actions.filter((_, i) => i !== index);
                          setNewWorkflow({...newWorkflow, actions: newActions});
                        }}
                        style={{
                          background: 'var(--danger-dim)',
                          color: 'var(--danger)',
                          border: 'none',
                          borderRadius: 4,
                          padding: '8px',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 20 }}>
                <button
                  onClick={saveWorkflow}
                  style={{
                    background: 'var(--accent)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '12px 20px',
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {editingWorkflow ? 'Update Workflow' : 'Create Workflow'}
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setEditingWorkflow(null);
                    setNewWorkflow({
                      name: '',
                      description: '',
                      trigger: 'lead_created',
                      conditions: [],
                      actions: [],
                      is_active: true
                    });
                  }}
                  style={{
                    background: 'var(--bg-secondary)',
                    color: 'var(--text)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '12px 20px',
                    fontSize: 14,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowAutomation;