import React, { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { Bell, CheckCircle, AlertTriangle, Info, X, Check } from 'lucide-react';
import { formatDate } from '../utils/database';

export default function Notifications() {
  const { notifications, loadNotifications, markNotificationRead } = useAppStore();

  useEffect(() => { loadNotifications(); }, []);

  const unread = notifications.filter(n => !n.is_read);
  const read = notifications.filter(n => n.is_read);

  const getIcon = (type) => {
    switch (type) {
      case 'warning': return <AlertTriangle size={16} color="var(--warning)" />;
      case 'success': return <CheckCircle size={16} color="var(--success)" />;
      case 'danger': return <X size={16} color="var(--danger)" />;
      default: return <Info size={16} color="var(--info)" />;
    }
  };

  const getBorder = (type) => {
    switch (type) {
      case 'warning': return 'var(--warning)';
      case 'success': return 'var(--success)';
      case 'danger': return 'var(--danger)';
      default: return 'var(--info)';
    }
  };

  const NotifCard = ({ n }) => (
    <div style={{
      background: n.is_read ? 'var(--bg-secondary)' : 'var(--bg-card)',
      border: `1px solid ${n.is_read ? 'var(--border)' : getBorder(n.type) + '40'}`,
      borderLeft: `3px solid ${getBorder(n.type)}`,
      borderRadius: 10,
      padding: '14px 16px',
      display: 'flex', alignItems: 'flex-start', gap: 12,
      opacity: n.is_read ? 0.7 : 1,
      transition: 'all 0.2s'
    }}>
      <div style={{ flexShrink: 0, marginTop: 2 }}>{getIcon(n.type)}</div>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{n.title}</div>
        {n.message && <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{n.message}</div>}
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{formatDate(n.created_at)}</div>
      </div>
      {!n.is_read && (
        <button
          className="btn btn-secondary btn-icon btn-sm"
          onClick={() => markNotificationRead(n.id)}
          title="Mark as read"
          style={{ flexShrink: 0 }}
        >
          <Check size={13} />
        </button>
      )}
    </div>
  );

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Alerts & Notifications</h2>
          <span className="page-subtitle">{unread.length} unread notifications</span>
        </div>
        {unread.length > 0 && (
          <button className="btn btn-secondary btn-sm" onClick={() => unread.forEach(n => markNotificationRead(n.id))}>
            <Check size={13} /> Mark All Read
          </button>
        )}
      </div>

      <div className="page-content">
        {notifications.length === 0 ? (
          <div className="empty-state" style={{ paddingTop: 80 }}>
            <Bell size={48} />
            <h3>No notifications</h3>
            <p>System alerts will appear here</p>
          </div>
        ) : (
          <div style={{ maxWidth: 700, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {unread.length > 0 && (
              <div>
                <h4 style={{ marginBottom: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                  Unread ({unread.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {unread.map(n => <NotifCard key={n.id} n={n} />)}
                </div>
              </div>
            )}
            {read.length > 0 && (
              <div>
                <h4 style={{ marginBottom: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.5 }}>
                  Read ({read.length})
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {read.slice(0, 20).map(n => <NotifCard key={n.id} n={n} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
