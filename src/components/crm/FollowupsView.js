import React, { useState, useEffect } from 'react';
import { Calendar, Clock, User, Edit, Trash2, Plus, Search } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

const FollowupsView = () => {
  const { currentUser } = useAppStore();
  const [followups, setFollowups] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    lead: '',
    owner: currentUser?.name || '',
    contactDate: '',
    dueDate: '',
    status: 'pending',
    notes: ''
  });

  useEffect(() => { loadInitial(); }, []);
  useEffect(() => { filterTable(); }, [followups, search]);

  const loadInitial = () => {
    const data = [
      { id: 'f1', lead: 'Tech Solutions Pvt Ltd', owner: 'Ravi', contactDate: '2026-03-25', dueDate: '2026-04-02', status: 'pending', notes: 'Discuss prototype', createdAt: '2026-03-25' },
      { id: 'f2', lead: 'Manufacturing Corp', owner: 'Priya', contactDate: '2026-03-22', dueDate: '2026-03-29', status: 'done', notes: 'Shared quote request', createdAt: '2026-03-22' }
    ];
    setFollowups(data);
  };

  const filterTable = () => {
    const text = search.trim().toLowerCase();
    if (!text) return setFiltered(followups);
    setFiltered(followups.filter(item =>
      item.lead.toLowerCase().includes(text) ||
      item.owner.toLowerCase().includes(text) ||
      item.notes.toLowerCase().includes(text)
    ));
  };

  const openForm = (item = null) => {
    if (item) setForm(item);
    else setForm({ lead: '', owner: currentUser?.name || '', contactDate: '', dueDate: '', status: 'pending', notes: '' });
    setEditing(item);
    setShowForm(true);
  };

  const saveFollowup = () => {
    if (!form.lead || !form.dueDate || !form.contactDate) return;
    if (editing) {
      setFollowups(prev => prev.map(x => (x.id === editing.id ? { ...x, ...form } : x)));
    } else {
      setFollowups(prev => [...prev, { id: `f${Date.now()}`, ...form, createdAt: new Date().toISOString().slice(0, 10) }]);
    }
    setShowForm(false);
    setEditing(null);
  };

  const removeFollowup = (id) => {
    if (!window.confirm('Delete this follow-up?')) return;
    setFollowups(prev => prev.filter(x => x.id !== id));
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 26, color: 'var(--text)', margin: 0 }}>Follow-ups Module</h1>
          <p style={{ color: 'var(--text-muted)' }}>Track and act on every sales follow-up with clear timelines and status.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: 10, top: 12, color: 'var(--text-muted)' }} />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search follow-ups..."
              style={{ padding: '10px 12px 10px 32px', borderRadius: 8, border: '1px solid var(--border)', minWidth: 240 }} />
          </div>
          <button onClick={() => openForm()} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', border: 'none', color: '#fff', borderRadius: 8, padding: '10px 14px', cursor: 'pointer' }}><Plus size={16}/>New follow-up</button>
        </div>
      </div>

      <div style={{ overflowX: 'auto', marginBottom: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: 'var(--bg-secondary)' }}>
            <th style={{ padding: '12px 10px', textAlign: 'left' }}>Lead</th>
            <th style={{ padding: '12px 10px', textAlign: 'left' }}>Owner</th>
            <th style={{ padding: '12px 10px', textAlign: 'left' }}>Contact</th>
            <th style={{ padding: '12px 10px', textAlign: 'left' }}>Due</th>
            <th style={{ padding: '12px 10px', textAlign: 'left' }}>Status</th>
            <th style={{ padding: '12px 10px', textAlign: 'left' }}>Notes</th>
            <th style={{ padding: '12px 10px', textAlign: 'center' }}>Actions</th>
          </tr></thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 18, textAlign: 'center', color: 'var(--text-muted)' }}>No follow-ups found.</td></tr>}
            {filtered.map(item => (
              <tr key={item.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td style={{ padding: '10px' }}>{item.lead}</td>
                <td style={{ padding: '10px' }}>{item.owner}</td>
                <td style={{ padding: '10px' }}>{item.contactDate}</td>
                <td style={{ padding: '10px' }}>{item.dueDate}</td>
                <td style={{ padding: '10px', color: item.status === 'done' ? 'var(--success)' : 'var(--warning)' }}>{item.status}</td>
                <td style={{ padding: '10px' }}>{item.notes}</td>
                <td style={{ padding: '10px', textAlign: 'center' }}>
                  <button onClick={() => openForm(item)} style={{ marginRight: 8, background: 'var(--primary-dim)', color: 'var(--primary)', border: '1px solid var(--border)', padding: 8, borderRadius: 6, cursor: 'pointer' }}><Edit size={14}/></button>
                  <button onClick={() => removeFollowup(item.id)} style={{ background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid var(--border)', padding: 8, borderRadius: 6, cursor: 'pointer' }}><Trash2 size={14}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 20 }}>
          <div style={{ width: '720px', maxWidth: '100%', background: 'var(--bg-primary)', padding: 20, borderRadius: 12, boxShadow: '0 10px 28px rgba(0,0,0,.35)' }}>
            <h2 style={{ margin: 0, marginBottom: 14, color: 'var(--text)' }}>{editing ? 'Edit Follow-up' : 'Create Follow-up'}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Lead
                <input type="text" value={form.lead} onChange={e => setForm({ ...form, lead: e.target.value })} style={{ marginTop: 6, width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }} />
              </label>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Owner
                <input type="text" value={form.owner} onChange={e => setForm({ ...form, owner: e.target.value })} style={{ marginTop: 6, width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }} />
              </label>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Contact Date
                <input type="date" value={form.contactDate} onChange={e => setForm({ ...form, contactDate: e.target.value })} style={{ marginTop: 6, width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }} />
              </label>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Due Date
                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} style={{ marginTop: 6, width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }} />
              </label>
              <label style={{ fontSize: 13, color: 'var(--text-muted)' }}>Status
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })} style={{ marginTop: 6, width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </label>
              <label style={{ gridColumn: 'span 2', fontSize: 13, color: 'var(--text-muted)' }}>Notes
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} style={{ marginTop: 6, width: '100%', padding: 8, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }} />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
              <button onClick={() => setShowForm(false)} style={{ background: 'var(--bg-secondary)', color: 'var(--text)', border: '1px solid var(--border)', padding: '8px 16px', borderRadius: 8 }}>Cancel</button>
              <button onClick={saveFollowup} style={{ background: 'var(--accent)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: 8 }}>{editing ? 'Update' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FollowupsView;
