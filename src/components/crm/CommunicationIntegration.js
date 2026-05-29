import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import { getErpName } from '../../utils/branding';
import {
  Mail, MessageSquare, Settings, Send, CheckCircle,
  AlertTriangle, Clock, Users, FileText, Phone
} from 'lucide-react';

const CommunicationIntegration = () => {
  const { currentUser, settings } = useAppStore();
  const [activeTab, setActiveTab] = useState('email');
  const [emailSettings, setEmailSettings] = useState({
    provider: 'smtp',
    smtp_host: '',
    smtp_port: 587,
    smtp_user: '',
    smtp_pass: '',
    from_email: '',
    from_name: ''
  });
  const [smsSettings, setSmsSettings] = useState({
    provider: 'twilio',
    account_sid: '',
    auth_token: '',
    phone_number: ''
  });
  const [templates, setTemplates] = useState([]);
  const [sending, setSending] = useState(false);
  const erpName = getErpName(settings);

  useEffect(() => {
    loadSettings();
    loadTemplates();
  }, []);

  const loadSettings = async () => {
    // Load settings from database
    const mockEmailSettings = {
      provider: 'smtp',
      smtp_host: 'smtp.gmail.com',
      smtp_port: 587,
      smtp_user: 'crm@ownerp.com',
      smtp_pass: '••••••••',
      from_email: 'crm@ownerp.com',
      from_name: `${erpName} CRM`
    };
    const mockSmsSettings = {
      provider: 'twilio',
      account_sid: 'AC••••••••••••••••••••••••••••••',
      auth_token: '••••••••••••••••••••••••••••',
      phone_number: '+1234567890'
    };

    setEmailSettings(mockEmailSettings);
    setSmsSettings(mockSmsSettings);
  };

  const loadTemplates = () => {
    const mockTemplates = [
      {
        id: '1',
        name: 'Lead Follow-up',
        type: 'email',
        subject: 'Following up on your inquiry - {{customer_name}}',
        content: 'Dear {{customer_name}},\n\nThank you for your interest in our products. We wanted to follow up on your recent inquiry...\n\nBest regards,\n{{sender_name}}'
      },
      {
        id: '2',
        name: 'Quotation Sent',
        type: 'email',
        subject: 'Quotation for your requirements - {{quotation_number}}',
        content: 'Dear {{customer_name}},\n\nPlease find attached our quotation {{quotation_number}} for your requirements...\n\nBest regards,\n{{sender_name}}'
      },
      {
        id: '3',
        name: 'Meeting Reminder',
        type: 'sms',
        content: 'Hi {{customer_name}}, reminder: We have a meeting scheduled for {{meeting_time}}. Please confirm your attendance.'
      }
    ];
    setTemplates(mockTemplates);
  };

  const saveEmailSettings = async () => {
    // Save to database
    alert('Email settings saved successfully!');
  };

  const saveSmsSettings = async () => {
    // Save to database
    alert('SMS settings saved successfully!');
  };

  const sendTestEmail = async () => {
    setSending(true);
    // Simulate sending
    setTimeout(() => {
      setSending(false);
      alert('Test email sent successfully!');
    }, 2000);
  };

  const sendTestSMS = async () => {
    setSending(true);
    // Simulate sending
    setTimeout(() => {
      setSending(false);
      alert('Test SMS sent successfully!');
    }, 2000);
  };

  const EmailSettings = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
          Email Provider
        </label>
        <select
          value={emailSettings.provider}
          onChange={e => setEmailSettings({...emailSettings, provider: e.target.value})}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg-primary)',
            color: 'var(--text)',
            fontSize: 14
          }}
        >
          <option value="smtp">SMTP</option>
          <option value="sendgrid">SendGrid</option>
          <option value="mailgun">Mailgun</option>
          <option value="ses">Amazon SES</option>
        </select>
      </div>

      {emailSettings.provider === 'smtp' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                SMTP Host
              </label>
              <input
                type="text"
                value={emailSettings.smtp_host}
                onChange={e => setEmailSettings({...emailSettings, smtp_host: e.target.value})}
                placeholder="smtp.gmail.com"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-primary)',
                  color: 'var(--text)',
                  fontSize: 14
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                SMTP Port
              </label>
              <input
                type="number"
                value={emailSettings.smtp_port}
                onChange={e => setEmailSettings({...emailSettings, smtp_port: parseInt(e.target.value)})}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-primary)',
                  color: 'var(--text)',
                  fontSize: 14
                }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                SMTP Username
              </label>
              <input
                type="text"
                value={emailSettings.smtp_user}
                onChange={e => setEmailSettings({...emailSettings, smtp_user: e.target.value})}
                placeholder="your-email@gmail.com"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-primary)',
                  color: 'var(--text)',
                  fontSize: 14
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                SMTP Password
              </label>
              <input
                type="password"
                value={emailSettings.smtp_pass}
                onChange={e => setEmailSettings({...emailSettings, smtp_pass: e.target.value})}
                placeholder="App password or SMTP password"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid var(--border)',
                  borderRadius: 6,
                  background: 'var(--bg-primary)',
                  color: 'var(--text)',
                  fontSize: 14
                }}
              />
            </div>
          </div>
        </>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            From Email
          </label>
          <input
            type="email"
            value={emailSettings.from_email}
            onChange={e => setEmailSettings({...emailSettings, from_email: e.target.value})}
            placeholder="crm@yourcompany.com"
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--bg-primary)',
              color: 'var(--text)',
              fontSize: 14
            }}
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            From Name
          </label>
          <input
            type="text"
            value={emailSettings.from_name}
            onChange={e => setEmailSettings({...emailSettings, from_name: e.target.value})}
            placeholder={`${erpName} CRM`}
            style={{
              width: '100%',
              padding: '10px 12px',
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--bg-primary)',
              color: 'var(--text)',
              fontSize: 14
            }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={saveEmailSettings}
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
          Save Email Settings
        </button>
        <button
          onClick={sendTestEmail}
          disabled={sending}
          style={{
            background: 'var(--success)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '12px 20px',
            fontSize: 14,
            fontWeight: 600,
            cursor: sending ? 'not-allowed' : 'pointer',
            opacity: sending ? 0.6 : 1
          }}
        >
          {sending ? 'Sending...' : 'Send Test Email'}
        </button>
      </div>
    </div>
  );

  const SmsSettings = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
          SMS Provider
        </label>
        <select
          value={smsSettings.provider}
          onChange={e => setSmsSettings({...smsSettings, provider: e.target.value})}
          style={{
            width: '100%',
            padding: '10px 12px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg-primary)',
            color: 'var(--text)',
            fontSize: 14
          }}
        >
          <option value="twilio">Twilio</option>
          <option value="aws-sns">AWS SNS</option>
          <option value="messagebird">MessageBird</option>
          <option value="nexmo">Nexmo</option>
        </select>
      </div>

      {smsSettings.provider === 'twilio' && (
        <>
          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              Account SID
            </label>
            <input
              type="text"
              value={smsSettings.account_sid}
              onChange={e => setSmsSettings({...smsSettings, account_sid: e.target.value})}
              placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg-primary)',
                color: 'var(--text)',
                fontSize: 14
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              Auth Token
            </label>
            <input
              type="password"
              value={smsSettings.auth_token}
              onChange={e => setSmsSettings({...smsSettings, auth_token: e.target.value})}
              placeholder="Your Twilio Auth Token"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg-primary)',
                color: 'var(--text)',
                fontSize: 14
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
              Twilio Phone Number
            </label>
            <input
              type="text"
              value={smsSettings.phone_number}
              onChange={e => setSmsSettings({...smsSettings, phone_number: e.target.value})}
              placeholder="+1234567890"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg-primary)',
                color: 'var(--text)',
                fontSize: 14
              }}
            />
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={saveSmsSettings}
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
          Save SMS Settings
        </button>
        <button
          onClick={sendTestSMS}
          disabled={sending}
          style={{
            background: 'var(--success)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '12px 20px',
            fontSize: 14,
            fontWeight: 600,
            cursor: sending ? 'not-allowed' : 'pointer',
            opacity: sending ? 0.6 : 1
          }}
        >
          {sending ? 'Sending...' : 'Send Test SMS'}
        </button>
      </div>
    </div>
  );

  const TemplatesView = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
          Communication Templates
        </h3>
        <button style={{
          background: 'var(--accent)',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: 14,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <FileText size={16} />
          New Template
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>
        {templates.map(template => (
          <div key={template.id} style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            padding: 16
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <h4 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', margin: 0, marginBottom: 4 }}>
                  {template.name}
                </h4>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                  background: template.type === 'email' ? 'var(--primary-dim)' : 'var(--success-dim)',
                  color: template.type === 'email' ? 'var(--primary)' : 'var(--success)'
                }}>
                  {template.type === 'email' ? <Mail size={12} /> : <MessageSquare size={12} />}
                  {template.type.toUpperCase()}
                </div>
              </div>
              <button style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                color: 'var(--text-muted)'
              }}>
                ⋯
              </button>
            </div>

            {template.subject && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Subject:</div>
                <div style={{ fontSize: 14, color: 'var(--text)' }}>{template.subject}</div>
              </div>
            )}

            <div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Content:</div>
              <div style={{
                fontSize: 13,
                color: 'var(--text)',
                lineHeight: 1.4,
                maxHeight: 60,
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {template.content.substring(0, 100)}...
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button style={{
                flex: 1,
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                border: 'none',
                borderRadius: 4,
                padding: '6px 12px',
                fontSize: 12,
                cursor: 'pointer'
              }}>
                Edit
              </button>
              <button style={{
                flex: 1,
                background: 'var(--success-dim)',
                color: 'var(--success)',
                border: 'none',
                borderRadius: 4,
                padding: '6px 12px',
                fontSize: 12,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4
              }}>
                <Send size={12} />
                Use
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>
          Communication Integration
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
          Configure email and SMS integration for automated CRM communications
        </p>
      </div>

      {/* Tab Navigation */}
      <div style={{
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-primary)',
        display: 'flex',
        gap: 0,
        marginBottom: 24
      }}>
        {[
          { id: 'email', label: 'Email Settings', icon: Mail },
          { id: 'sms', label: 'SMS Settings', icon: MessageSquare },
          { id: 'templates', label: 'Templates', icon: FileText }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '16px 20px',
                border: 'none',
                background: isActive ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                fontSize: 14,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 24
      }}>
        {activeTab === 'email' && <EmailSettings />}
        {activeTab === 'sms' && <SmsSettings />}
        {activeTab === 'templates' && <TemplatesView />}
      </div>
    </div>
  );
};

export default CommunicationIntegration;
