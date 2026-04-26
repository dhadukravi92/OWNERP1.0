import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { RefreshCw, Settings, CheckCircle, AlertTriangle, ExternalLink, Clock } from 'lucide-react';

const IndiaMARTIntegration = () => {
  const {
    indiamartSettings,
    loadIndiamartSettings,
    updateIndiamartSettings,
    syncIndiamartInquiries
  } = useAppStore();

  const [isSyncing, setIsSyncing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    api_key: '',
    api_secret: '',
    is_active: false,
    sync_interval: 15
  });

  useEffect(() => {
    loadIndiamartSettings();
  }, []);

  useEffect(() => {
    if (indiamartSettings) {
      setSettings(indiamartSettings);
    }
  }, [indiamartSettings]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncIndiamartInquiries();
      if (result.success) {
        alert(`Successfully synced ${result.synced} inquiries from IndiaMART`);
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } catch (error) {
      alert(`Sync error: ${error.message}`);
    }
    setIsSyncing(false);
  };

  const handleSaveSettings = async () => {
    const result = await updateIndiamartSettings(settings);
    if (result.success) {
      setShowSettings(false);
      alert('IndiaMART settings saved successfully');
    } else {
      alert(`Failed to save settings: ${result.error}`);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>IndiaMART Integration</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>Connect and sync inquiries from IndiaMART platform</p>
      </div>

      {/* Status Card */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: 0 }}>Integration Status</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => setShowSettings(true)}
              style={{
                background: 'var(--bg-primary)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 16px',
                color: 'var(--text)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <Settings size={16} />
              Settings
            </button>
            <button
              onClick={handleSync}
              disabled={isSyncing || !settings.is_active}
              style={{
                background: settings.is_active ? 'var(--accent)' : 'var(--text-muted)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '8px 16px',
                cursor: settings.is_active && !isSyncing ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: settings.is_active ? 'var(--success)' : 'var(--danger)'
            }}></div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Status</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {settings.is_active ? 'Active' : 'Inactive'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Clock size={16} color="var(--text-muted)" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Last Sync</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {settings.last_sync ? new Date(settings.last_sync).toLocaleString() : 'Never'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <RefreshCw size={16} color="var(--text-muted)" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>Sync Interval</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {settings.sync_interval} minutes
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Inquiries */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 24
      }}>
        <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>Recent IndiaMART Inquiries</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Sample data - in real app, this would come from database */}
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 16
          }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              background: '#06b6d415',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ExternalLink size={20} color="#06b6d4" />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Control Panels Inquiry
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 8 }}>
                Rajesh Kumar from ABC Industries
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>Quantity: 5 units</span>
                <span>Received: 2 hours ago</span>
                <span style={{ color: '#06b6d4' }}>IndiaMART</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={{
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 14,
                cursor: 'pointer'
              }}>
                Convert to Lead
              </button>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
          <p>No recent inquiries from IndiaMART</p>
          <p style={{ fontSize: 14, marginTop: 8 }}>
            Inquiries will appear here once the integration is active and configured
          </p>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettings && (
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
            width: '500px',
            maxWidth: '90vw'
          }}>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 20 }}>
              IndiaMART Settings
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  API Key
                </label>
                <input
                  type="text"
                  value={settings.api_key}
                  onChange={e => setSettings({...settings, api_key: e.target.value})}
                  placeholder="Enter your IndiaMART API Key"
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
                  API Secret
                </label>
                <input
                  type="password"
                  value={settings.api_secret}
                  onChange={e => setSettings({...settings, api_secret: e.target.value})}
                  placeholder="Enter your IndiaMART API Secret"
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
                  Sync Interval (minutes)
                </label>
                <input
                  type="number"
                  value={settings.sync_interval}
                  onChange={e => setSettings({...settings, sync_interval: parseInt(e.target.value) || 15})}
                  min="5"
                  max="1440"
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

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input
                  type="checkbox"
                  id="is_active"
                  checked={settings.is_active}
                  onChange={e => setSettings({...settings, is_active: e.target.checked})}
                  style={{ width: 16, height: 16 }}
                />
                <label htmlFor="is_active" style={{ fontSize: 14, color: 'var(--text)' }}>
                  Enable IndiaMART Integration
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={handleSaveSettings}
                style={{
                  flex: 1,
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  padding: '12px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Save Settings
              </button>
              <button
                onClick={() => setShowSettings(false)}
                style={{
                  flex: 1,
                  background: 'var(--bg-secondary)',
                  color: 'var(--text)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  padding: '12px',
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

export default IndiaMARTIntegration;