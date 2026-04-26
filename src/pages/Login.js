import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { getAppBrandLogoUrl, getErpName, getErpNameParts } from '../utils/branding';
import { Zap, Lock, User, AlertCircle } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAppStore(s => s.login);
  const settings = useAppStore(s => s.settings);
  const erpName = getErpName(settings);
  const erpNameParts = getErpNameParts(settings);
  const logoUrl = getAppBrandLogoUrl();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const result = await login(username, password);
    setLoading(false);
    if (!result.success) setError(result.error);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Background grid */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        opacity: 0.3
      }} />
      
      {/* Glow */}
      <div style={{
        position: 'absolute', width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(61,127,255,0.08) 0%, transparent 70%)',
        top: '50%', left: '50%', transform: 'translate(-50%,-50%)'
      }} />

      <div style={{ position: 'relative', width: 420 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Company logo"
              style={{
                width: 64,
                height: 64,
                borderRadius: 16,
                objectFit: 'contain',
                padding: 6,
                margin: '0 auto 16px',
                boxShadow: '0 16px 40px rgba(61,127,255,0.2)',
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.04)',
                display: 'block'
              }}
            />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: 16,
              background: 'linear-gradient(135deg, var(--accent), #0050ff)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px', boxShadow: '0 16px 40px rgba(61,127,255,0.3)'
            }}>
              <Zap size={32} color="#fff" strokeWidth={2.5} />
            </div>
          )}
          <h1 style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>
            {erpNameParts.primary}
            {erpNameParts.accent && <span style={{ color: 'var(--accent)' }}>{erpNameParts.accent}</span>}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
            Sign in to manage your business with {erpName}
          </p>
        </div>

        {/* Login card */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 16,
          padding: '32px',
          boxShadow: 'var(--shadow)'
        }}>
          <h3 style={{ marginBottom: 24, color: 'var(--text-secondary)', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 }}>
            Sign in to continue
          </h3>

          {error && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '10px 14px', background: 'var(--danger-dim)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
              marginBottom: 16, color: 'var(--danger)', fontSize: 13
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="form-group">
              <label className="form-label">Username</label>
              <div style={{ position: 'relative' }}>
                <User size={15} style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <input
                  className="form-control"
                  style={{ paddingLeft: 36 }}
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{
                  position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <input
                  type="password"
                  className="form-control"
                  style={{ paddingLeft: 36 }}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div style={{
            marginTop: 20, padding: '12px 16px',
            background: 'var(--accent-dim)', borderRadius: 8,
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8
          }}>
            <strong style={{ color: 'var(--accent)' }}>Default credentials:</strong><br />
            Username: <span style={{ fontFamily: 'var(--font-mono)' }}>admin</span> &nbsp;|&nbsp;
            Password: <span style={{ fontFamily: 'var(--font-mono)' }}>admin123</span>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, marginTop: 20 }}>
          {erpName} v1.0.0 &nbsp;|&nbsp; Customizable ERP Workspace
        </p>
      </div>
    </div>
  );
}
