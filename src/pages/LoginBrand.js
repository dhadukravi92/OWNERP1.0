import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { getAppBrandLogoUrl, getErpName, getErpNameParts } from '../utils/branding';
import { Zap, Lock, User, AlertCircle, Mail, X } from 'lucide-react';

export default function LoginBrand() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetForm, setResetForm] = useState({
    username: '',
    email: '',
    newPassword: '',
    confirmPassword: ''
  });
  const login = useAppStore(s => s.login);
  const resetPasswordWithEmail = useAppStore(s => s.resetPasswordWithEmail);
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

  const updateResetField = (field, value) => {
    setResetForm((prev) => ({ ...prev, [field]: value }));
  };

  const closeResetModal = () => {
    setResetOpen(false);
    setResetLoading(false);
    setResetError('');
    setResetMessage('');
    setResetForm({ username: '', email: '', newPassword: '', confirmPassword: '' });
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetMessage('');

    if (resetForm.newPassword !== resetForm.confirmPassword) {
      setResetError('New password and confirm password must match.');
      return;
    }

    setResetLoading(true);
    const result = await resetPasswordWithEmail(
      resetForm.username,
      resetForm.email,
      resetForm.newPassword
    );
    setResetLoading(false);

    if (!result.success) {
      setResetError(result.error || 'Unable to reset password.');
      return;
    }

    setResetMessage('Password reset successful. Sign in with the new password.');
    setPassword(resetForm.newPassword);
    setUsername(resetForm.username);
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
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        opacity: 0.3
      }} />

      <div style={{
        position: 'absolute', width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(61,127,255,0.08) 0%, transparent 70%)',
        top: '50%', left: '50%', transform: 'translate(-50%,-50%)'
      }} />

      <div style={{ position: 'relative', width: 420 }}>
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

          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Use your assigned credentials to access {erpName}.
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setResetOpen(true)}>
              <Mail size={14} /> Reset Password By Email
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 11, marginTop: 20 }}>
          {erpName} v1.0.0 &nbsp;|&nbsp; Customizable ERP Workspace
        </p>
      </div>

      {resetOpen && (
        <div
          className="modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeResetModal()}
          style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 50 }}
        >
          <div className="modal" style={{ maxWidth: 480, width: '100%' }}>
            <div className="modal-header">
              <h3>Reset Password</h3>
              <button className="close-btn" onClick={closeResetModal}><X size={16} /></button>
            </div>
            <form onSubmit={handleResetPassword}>
              <div className="modal-body" style={{ display: 'grid', gap: 14 }}>
                <div className="text-secondary" style={{ fontSize: 13, lineHeight: 1.7 }}>
                  Reset access using the email ID saved on the account. Developer access is recoverable only through its registered email.
                </div>

                {resetError && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 14px', background: 'var(--danger-dim)',
                    border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8,
                    color: 'var(--danger)', fontSize: 13
                  }}>
                    <AlertCircle size={16} />
                    {resetError}
                  </div>
                )}

                {resetMessage && (
                  <div style={{
                    padding: '10px 14px',
                    background: 'var(--success-dim)',
                    border: '1px solid rgba(34,197,94,0.25)',
                    borderRadius: 8,
                    color: 'var(--success)',
                    fontSize: 13
                  }}>
                    {resetMessage}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input className="form-control" value={resetForm.username} onChange={(e) => updateResetField('username', e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Registered Email</label>
                  <input type="email" className="form-control" value={resetForm.email} onChange={(e) => updateResetField('email', e.target.value)} required />
                </div>
                <div className="grid-2">
                  <div className="form-group">
                    <label className="form-label">New Password</label>
                    <input type="password" className="form-control" value={resetForm.newPassword} onChange={(e) => updateResetField('newPassword', e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Confirm Password</label>
                    <input type="password" className="form-control" value={resetForm.confirmPassword} onChange={(e) => updateResetField('confirmPassword', e.target.value)} required />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={closeResetModal}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={resetLoading}>
                  {resetLoading ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
