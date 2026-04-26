import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import {
  Users, Plus, Search, Filter, MoreVertical, Eye, Edit, Trash2,
  Phone, Mail, Calendar, MapPin, DollarSign, TrendingUp,
  CheckCircle, XCircle, AlertTriangle, Clock, Star
} from 'lucide-react';

const LeadsView = () => {
  const { currentUser } = useAppStore();
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSource, setFilterSource] = useState('all');

  const [newLead, setNewLead] = useState({
    company_name: '',
    contact_person: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    industry: '',
    source: 'indiamart',
    value: '',
    probability: 50,
    status: 'new',
    priority: 'medium',
    notes: '',
    assigned_to: currentUser?.id || '',
    expected_close_date: ''
  });

  useEffect(() => {
    loadLeads();
  }, []);

  useEffect(() => {
    filterLeads();
  }, [leads, searchTerm, filterStatus, filterSource]);

  const loadLeads = () => {
    // Mock data - in real app, this would come from the database
    const mockLeads = [
      {
        id: '1',
        company_name: 'Tech Solutions Pvt Ltd',
        contact_person: 'Rajesh Kumar',
        email: 'rajesh@techsolutions.com',
        phone: '+91-9876543210',
        address: '123 Business Park',
        city: 'Mumbai',
        state: 'Maharashtra',
        pincode: '400001',
        industry: 'IT Services',
        source: 'indiamart',
        value: 250000,
        probability: 75,
        status: 'qualified',
        priority: 'high',
        notes: 'Interested in ERP implementation',
        assigned_to: 'sales1',
        created_at: '2024-01-15',
        updated_at: '2024-01-20',
        expected_close_date: '2024-02-15',
        last_contact: '2024-01-20'
      },
      {
        id: '2',
        company_name: 'Manufacturing Corp',
        contact_person: 'Priya Sharma',
        email: 'priya@manufacturing.com',
        phone: '+91-8765432109',
        address: '456 Industrial Area',
        city: 'Delhi',
        state: 'Delhi',
        pincode: '110001',
        industry: 'Manufacturing',
        source: 'website',
        value: 500000,
        probability: 60,
        status: 'contacted',
        priority: 'medium',
        notes: 'Needs inventory management system',
        assigned_to: 'sales2',
        created_at: '2024-01-10',
        updated_at: '2024-01-18',
        expected_close_date: '2024-03-01',
        last_contact: '2024-01-18'
      },
      {
        id: '3',
        company_name: 'Retail Traders Ltd',
        contact_person: 'Amit Singh',
        email: 'amit@retailtraders.com',
        phone: '+91-7654321098',
        address: '789 Market Street',
        city: 'Bangalore',
        state: 'Karnataka',
        pincode: '560001',
        industry: 'Retail',
        source: 'referral',
        value: 150000,
        probability: 40,
        status: 'new',
        priority: 'low',
        notes: 'Small business looking for basic CRM',
        assigned_to: 'sales1',
        created_at: '2024-01-22',
        updated_at: '2024-01-22',
        expected_close_date: '2024-04-01',
        last_contact: null
      }
    ];
    setLeads(mockLeads);
  };

  const filterLeads = () => {
    let filtered = leads;

    if (searchTerm) {
      filtered = filtered.filter(lead =>
        lead.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.contact_person.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lead.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(lead => lead.status === filterStatus);
    }

    if (filterSource !== 'all') {
      filtered = filtered.filter(lead => lead.source === filterSource);
    }

    setFilteredLeads(filtered);
  };

  const saveLead = () => {
    if (editingLead) {
      setLeads(leads.map(lead =>
        lead.id === editingLead.id
          ? { ...newLead, id: editingLead.id, updated_at: new Date().toISOString().split('T')[0] }
          : lead
      ));
    } else {
      const lead = {
        ...newLead,
        id: Date.now().toString(),
        created_at: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString().split('T')[0]
      };
      setLeads([...leads, lead]);
    }
    setShowCreateModal(false);
    setEditingLead(null);
    resetForm();
  };

  const deleteLead = (id) => {
    if (window.confirm('Are you sure you want to delete this lead?')) { // eslint-disable-line no-restricted-globals
      setLeads(leads.filter(lead => lead.id !== id));
    }
  };

  const editLead = (lead) => {
    setEditingLead(lead);
    setNewLead(lead);
    setShowCreateModal(true);
  };

  const resetForm = () => {
    setNewLead({
      company_name: '',
      contact_person: '',
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      industry: '',
      source: 'indiamart',
      value: '',
      probability: 50,
      status: 'new',
      priority: 'medium',
      notes: '',
      assigned_to: currentUser?.id || '',
      expected_close_date: ''
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'new': return 'var(--info)';
      case 'contacted': return 'var(--warning)';
      case 'qualified': return 'var(--success)';
      case 'proposal': return 'var(--primary)';
      case 'negotiation': return 'var(--accent)';
      case 'won': return 'var(--success)';
      case 'lost': return 'var(--danger)';
      default: return 'var(--text-muted)';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'var(--danger)';
      case 'medium': return 'var(--warning)';
      case 'low': return 'var(--info)';
      default: return 'var(--text-muted)';
    }
  };

  const statusOptions = [
    { value: 'new', label: 'New' },
    { value: 'contacted', label: 'Contacted' },
    { value: 'qualified', label: 'Qualified' },
    { value: 'proposal', label: 'Proposal Sent' },
    { value: 'negotiation', label: 'Negotiation' },
    { value: 'won', label: 'Won' },
    { value: 'lost', label: 'Lost' }
  ];

  const sourceOptions = [
    { value: 'indiamart', label: 'IndiaMART' },
    { value: 'website', label: 'Website' },
    { value: 'referral', label: 'Referral' },
    { value: 'cold_call', label: 'Cold Call' },
    { value: 'social_media', label: 'Social Media' },
    { value: 'trade_show', label: 'Trade Show' },
    { value: 'other', label: 'Other' }
  ];

  const industryOptions = [
    'IT Services', 'Manufacturing', 'Retail', 'Healthcare', 'Education',
    'Finance', 'Construction', 'Automotive', 'Food & Beverage', 'Other'
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>
            Leads Management
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
            Manage and track all your sales leads
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
          Add New Lead
        </button>
      </div>

      {/* Filters */}
      <div style={{
        display: 'flex',
        gap: 16,
        marginBottom: 24,
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 300 }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search leads..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--bg-secondary)',
              color: 'var(--text)',
              fontSize: 14
            }}
          />
        </div>

        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          style={{
            padding: '10px 12px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg-secondary)',
            color: 'var(--text)',
            fontSize: 14,
            minWidth: 120
          }}
        >
          <option value="all">All Status</option>
          {statusOptions.map(status => (
            <option key={status.value} value={status.value}>{status.label}</option>
          ))}
        </select>

        <select
          value={filterSource}
          onChange={e => setFilterSource(e.target.value)}
          style={{
            padding: '10px 12px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg-secondary)',
            color: 'var(--text)',
            fontSize: 14,
            minWidth: 120
          }}
        >
          <option value="all">All Sources</option>
          {sourceOptions.map(source => (
            <option key={source.value} value={source.value}>{source.label}</option>
          ))}
        </select>
      </div>

      {/* Leads Grid */}
      <div style={{ display: 'grid', gap: 16 }}>
        {filteredLeads.map(lead => (
          <div key={lead.id} style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: 20,
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr auto',
            gap: 16,
            alignItems: 'center'
          }}>
            {/* Lead Info */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                  {lead.company_name}
                </h3>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  background: `${getStatusColor(lead.status)}15`,
                  color: getStatusColor(lead.status)
                }}>
                  {statusOptions.find(s => s.value === lead.status)?.label}
                </div>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  background: `${getPriorityColor(lead.priority)}15`,
                  color: getPriorityColor(lead.priority)
                }}>
                  {lead.priority}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 14, color: 'var(--text-muted)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Users size={14} />
                  {lead.contact_person}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Mail size={14} />
                  {lead.email}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Phone size={14} />
                  {lead.phone}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {lead.city}, {lead.state} • {sourceOptions.find(s => s.value === lead.source)?.label}
              </div>
            </div>

            {/* Value */}
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>
                ₹{lead.value.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {lead.probability}% probability
              </div>
            </div>

            {/* Industry */}
            <div>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>{lead.industry}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{lead.source}</div>
            </div>

            {/* Dates */}
            <div>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>
                <Calendar size={14} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                {lead.expected_close_date}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Last: {lead.last_contact || 'Never'}
              </div>
            </div>

            {/* Assigned To */}
            <div>
              <div style={{ fontSize: 14, color: 'var(--text)' }}>{lead.assigned_to}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Sales Rep</div>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => editLead(lead)}
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
                onClick={() => deleteLead(lead.id)}
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
        ))}
      </div>

      {/* Create/Edit Modal */}
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
              {editingLead ? 'Edit Lead' : 'Create New Lead'}
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  Company Name *
                </label>
                <input
                  type="text"
                  value={newLead.company_name}
                  onChange={e => setNewLead({...newLead, company_name: e.target.value})}
                  placeholder="Enter company name"
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
                  Contact Person *
                </label>
                <input
                  type="text"
                  value={newLead.contact_person}
                  onChange={e => setNewLead({...newLead, contact_person: e.target.value})}
                  placeholder="Enter contact person name"
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
                  Email *
                </label>
                <input
                  type="email"
                  value={newLead.email}
                  onChange={e => setNewLead({...newLead, email: e.target.value})}
                  placeholder="Enter email address"
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
                  Phone *
                </label>
                <input
                  type="tel"
                  value={newLead.phone}
                  onChange={e => setNewLead({...newLead, phone: e.target.value})}
                  placeholder="Enter phone number"
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

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  Address
                </label>
                <input
                  type="text"
                  value={newLead.address}
                  onChange={e => setNewLead({...newLead, address: e.target.value})}
                  placeholder="Enter address"
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
                  City
                </label>
                <input
                  type="text"
                  value={newLead.city}
                  onChange={e => setNewLead({...newLead, city: e.target.value})}
                  placeholder="Enter city"
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
                  State
                </label>
                <input
                  type="text"
                  value={newLead.state}
                  onChange={e => setNewLead({...newLead, state: e.target.value})}
                  placeholder="Enter state"
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
                  Pincode
                </label>
                <input
                  type="text"
                  value={newLead.pincode}
                  onChange={e => setNewLead({...newLead, pincode: e.target.value})}
                  placeholder="Enter pincode"
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
                  Industry
                </label>
                <select
                  value={newLead.industry}
                  onChange={e => setNewLead({...newLead, industry: e.target.value})}
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
                  <option value="">Select Industry</option>
                  {industryOptions.map(industry => (
                    <option key={industry} value={industry}>{industry}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  Lead Source
                </label>
                <select
                  value={newLead.source}
                  onChange={e => setNewLead({...newLead, source: e.target.value})}
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
                  {sourceOptions.map(source => (
                    <option key={source.value} value={source.value}>{source.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  Deal Value (₹)
                </label>
                <input
                  type="number"
                  value={newLead.value}
                  onChange={e => setNewLead({...newLead, value: e.target.value})}
                  placeholder="Enter deal value"
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
                  Probability (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newLead.probability}
                  onChange={e => setNewLead({...newLead, probability: parseInt(e.target.value) || 0})}
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
                  Status
                </label>
                <select
                  value={newLead.status}
                  onChange={e => setNewLead({...newLead, status: e.target.value})}
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
                  {statusOptions.map(status => (
                    <option key={status.value} value={status.value}>{status.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  Priority
                </label>
                <select
                  value={newLead.priority}
                  onChange={e => setNewLead({...newLead, priority: e.target.value})}
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
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  Expected Close Date
                </label>
                <input
                  type="date"
                  value={newLead.expected_close_date}
                  onChange={e => setNewLead({...newLead, expected_close_date: e.target.value})}
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
                  Assigned To
                </label>
                <input
                  type="text"
                  value={newLead.assigned_to}
                  onChange={e => setNewLead({...newLead, assigned_to: e.target.value})}
                  placeholder="Assign to sales rep"
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

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  Notes
                </label>
                <textarea
                  value={newLead.notes}
                  onChange={e => setNewLead({...newLead, notes: e.target.value})}
                  placeholder="Additional notes about the lead"
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
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={saveLead}
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
                {editingLead ? 'Update Lead' : 'Create Lead'}
              </button>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setEditingLead(null);
                  resetForm();
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
      )}
    </div>
  );
};

export default LeadsView;