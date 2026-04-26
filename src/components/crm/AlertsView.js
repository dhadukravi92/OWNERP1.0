import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle, AlertTriangle, XCircle, Trash2, Plus, Search } from 'lucide-react';
import { useAppStore } from '../../store/appStore';

const AlertsView = () => {
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    setAlerts([
      { id: 'a1', type: 'followup', message: 'Lead “Retail Traders” follow-up due tomorrow', date: '2026-03-31', priority: 'high', resolved: false },
      { id: 'a2', type: 'quotation', message: 'Quotation for “Tech Solutions” created', date: '2026-03-24', priority: 'medium', resolved: true }
    ]);
  }, []);

  const filtered = alerts.filter(item => {
    const passesSearch = search ? item.message.toLowerCase().includes(search.toLowerCase()) : true;
    const passesStatus = filter === 'all' ? true : (filter === 'open' ? !item.resolved : item.resolved);
    return passesSearch && passesStatus;
  });

  const toggleResolved = id => setAlerts(prev => prev.map(x => x.id === id ? { ...x, resolved: !x.resolved } : x));
  const deleteAlert = id => { if (window.confirm('Remove alert?')) setAlerts(prev => prev.filter(x => x.id !== id)); };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <div>
          <h1 style={{ margin: 0, color: 'var(--text)', fontSize: 26 }}>Alerts & Reminders</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text-muted)' }}>Realtime selling signals and prevent missed actions.</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 16 }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search alerts..." style={{ padding: '10px 12px 10px 32px', borderRadius: 8, border: '1px solid var(--border)', minWidth: 220 }} />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: 10, borderRadius: 8, border: '1px solid var(--border)' }}>
          <option value="all">All</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>
        <button style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 14px', cursor: 'pointer' }}><Plus size={14}/>Create alert</button>
      </div>

      <div style={{ display: 'grid', gap: 12 }}>
        {filtered.length === 0 && <div style={{ color: 'var(--text-muted)', padding: 16, border: '1px solid var(--border)', borderRadius: 10 }}>No alerts found for your filters.</div>}
        {filtered.map(alert => (
          <div key={alert.id} style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: alert.resolved ? 'var(--success-dim)' : 'var(--bg-secondary)' }}>
            <div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                {alert.priority === 'high' ? <AlertTriangle color="var(--danger)" size={16}/> : <Bell color="var(--accent)" size={16}/>} 
                <strong style={{ color: 'var(--text)' }}>{alert.message}</strong>
              </div>
              <small style={{ color: 'var(--text-muted)' }}>{alert.date} • {alert.type} • {alert.priority.toUpperCase()}</small>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => toggleResolved(alert.id)} style={{ border: '1px solid var(--border)', background: alert.resolved ? 'var(--success-dim)' : 'var(--warning-dim)', color: alert.resolved ? 'var(--success)' : 'var(--warning)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}>
                {alert.resolved ? <><CheckCircle size={14}/>Resolved</> : <><XCircle size={14}/>Mark done</>}
              </button>
              <button onClick={() => deleteAlert(alert.id)} style={{ border: '1px solid var(--border)', background: 'var(--danger-dim)', color: 'var(--danger)', borderRadius: 6, padding: '6px 10px', cursor: 'pointer' }}><Trash2 size={14}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlertsView;
