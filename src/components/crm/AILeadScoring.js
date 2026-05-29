import React, { useState, useEffect } from 'react';
import { useAppStore } from '../../store/appStore';
import {
  Brain, TrendingUp, Target, AlertTriangle, CheckCircle,
  Zap, Settings, RefreshCw, BarChart3
} from 'lucide-react';

const AILeadScoring = () => {
  const { currentUser } = useAppStore();
  const [leads, setLeads] = useState([]);
  const [scoringRules, setScoringRules] = useState({
    industryWeight: 25,
    companySizeWeight: 20,
    budgetWeight: 30,
    timelineWeight: 15,
    sourceWeight: 10
  });
  const [isTraining, setIsTraining] = useState(false);

  useEffect(() => {
    loadLeadsAndScore();
  }, []);

  const loadLeadsAndScore = async () => {
    // Mock data - in real implementation, this would query the database
    const mockLeads = [
      {
        id: '1',
        lead_number: 'LEAD-001',
        customer_name: 'Rajesh Kumar',
        company: 'ABC Industries',
        industry: 'Retail',
        company_size: 'Large',
        budget: 'High',
        timeline: 'Urgent',
        source: 'IndiaMART',
        probability: 65,
        score: 85,
        last_activity: '2024-01-15'
      },
      {
        id: '2',
        lead_number: 'LEAD-002',
        customer_name: 'Priya Sharma',
        company: 'XYZ Corp',
        industry: 'Technology',
        company_size: 'Medium',
        budget: 'Medium',
        timeline: 'Normal',
        source: 'Website',
        probability: 45,
        score: 72,
        last_activity: '2024-01-14'
      },
      {
        id: '3',
        lead_number: 'LEAD-003',
        customer_name: 'Amit Patel',
        company: 'DEF Ltd',
        industry: 'Construction',
        company_size: 'Small',
        budget: 'Low',
        timeline: 'Flexible',
        source: 'Referral',
        probability: 25,
        score: 45,
        last_activity: '2024-01-13'
      }
    ];

    // Apply AI scoring
    const scoredLeads = mockLeads.map(lead => ({
      ...lead,
      ai_score: calculateAIScore(lead),
      prediction: predictConversion(lead)
    }));

    setLeads(scoredLeads);
  };

  const calculateAIScore = (lead) => {
    let score = 0;

    // Industry scoring
    const industryScores = {
      'Manufacturing': 25,
      'Technology': 22,
      'Construction': 18,
      'Healthcare': 20,
      'Retail': 15,
      'Other': 10
    };
    score += (industryScores[lead.industry] || 10) * (scoringRules.industryWeight / 100);

    // Company size scoring
    const sizeScores = {
      'Large': 25,
      'Medium': 15,
      'Small': 5
    };
    score += (sizeScores[lead.company_size] || 10) * (scoringRules.companySizeWeight / 100);

    // Budget scoring
    const budgetScores = {
      'High': 30,
      'Medium': 15,
      'Low': 5
    };
    score += (budgetScores[lead.budget] || 10) * (scoringRules.budgetWeight / 100);

    // Timeline scoring
    const timelineScores = {
      'Urgent': 15,
      'Normal': 10,
      'Flexible': 5
    };
    score += (timelineScores[lead.timeline] || 5) * (scoringRules.timelineWeight / 100);

    // Source scoring
    const sourceScores = {
      'IndiaMART': 10,
      'Website': 8,
      'Referral': 12,
      'Direct': 6,
      'Other': 4
    };
    score += (sourceScores[lead.source] || 4) * (scoringRules.sourceWeight / 100);

    // Activity-based scoring
    const daysSinceActivity = Math.floor((new Date() - new Date(lead.last_activity)) / (1000 * 60 * 60 * 24));
    const activityBonus = Math.max(0, 10 - daysSinceActivity);
    score += activityBonus;

    return Math.min(100, Math.round(score));
  };

  const predictConversion = (lead) => {
    const score = lead.ai_score;
    if (score >= 80) return { probability: 85, label: 'Hot', color: '#ef4444' };
    if (score >= 60) return { probability: 65, label: 'Warm', color: '#f59e0b' };
    if (score >= 40) return { probability: 35, label: 'Cold', color: '#06b6d4' };
    return { probability: 15, label: 'Ice Cold', color: '#8b5cf6' };
  };

  const trainModel = async () => {
    setIsTraining(true);
    // Simulate AI training
    setTimeout(() => {
      setIsTraining(false);
      alert('AI model trained successfully with historical data!');
    }, 3000);
  };

  const updateScoringRules = (rule, value) => {
    setScoringRules(prev => ({
      ...prev,
      [rule]: value
    }));
  };

  const getScoreColor = (score) => {
    if (score >= 80) return '#ef4444';
    if (score >= 60) return '#f59e0b';
    if (score >= 40) return '#06b6d4';
    return '#8b5cf6';
  };

  const getScoreLabel = (score) => {
    if (score >= 80) return 'Hot Lead';
    if (score >= 60) return 'Warm Lead';
    if (score >= 40) return 'Cold Lead';
    return 'Ice Cold';
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, color: 'var(--text)' }}>
            AI Lead Scoring
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: 16 }}>
            Intelligent lead prioritization using machine learning algorithms
          </p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={trainModel}
            disabled={isTraining}
            style={{
              background: isTraining ? 'var(--text-muted)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '8px 16px',
              cursor: isTraining ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <Brain size={16} />
            {isTraining ? 'Training...' : 'Train Model'}
          </button>
          <button
            onClick={() => loadLeadsAndScore()}
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
            <RefreshCw size={16} />
            Refresh Scores
          </button>
        </div>
      </div>

      {/* Scoring Rules Configuration */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 24,
        marginBottom: 24
      }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text)' }}>
          Scoring Rules Configuration
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
          {Object.entries(scoringRules).map(([rule, value]) => (
            <div key={rule}>
              <label style={{
                display: 'block',
                fontSize: 14,
                fontWeight: 600,
                color: 'var(--text)',
                marginBottom: 8,
                textTransform: 'capitalize'
              }}>
                {rule.replace('Weight', '')} Weight
              </label>
              <input
                type="range"
                min="0"
                max="50"
                value={value}
                onChange={e => updateScoringRules(rule, parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                {value}%
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 20,
        marginBottom: 32
      }}>
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'var(--success-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <TrendingUp size={20} color="var(--success)" />
            </div>
            <div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Hot Leads</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
                {leads.filter(l => l.ai_score >= 80).length}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Leads with 80%+ AI score - High conversion potential
          </div>
        </div>

        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'var(--warning-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Target size={20} color="var(--warning)" />
            </div>
            <div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Avg AI Score</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
                {leads.length > 0 ? Math.round(leads.reduce((sum, l) => sum + l.ai_score, 0) / leads.length) : 0}%
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Overall lead quality score across all leads
          </div>
        </div>

        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: 20
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'var(--info-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Zap size={20} color="var(--info)" />
            </div>
            <div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>AI Predictions</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>
                {leads.filter(l => l.prediction.probability > 50).length}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            Leads with >50% conversion probability
          </div>
        </div>
      </div>

      {/* Leads Scoring Table */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        overflow: 'hidden'
      }}>
        <div style={{
          padding: 16,
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          gap: 12,
          alignItems: 'center'
        }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <input
              placeholder="Search leads..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: 6,
                background: 'var(--bg-primary)',
                color: 'var(--text)',
                fontSize: 14
              }}
            />
          </div>
          <button style={{
            padding: '8px 12px',
            border: '1px solid var(--border)',
            borderRadius: 6,
            background: 'var(--bg-primary)',
            color: 'var(--text)',
            cursor: 'pointer'
          }}>
            Filter
          </button>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Lead</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>AI Score</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Prediction</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Industry</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Source</th>
                <th style={{ padding: 12, textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Last Activity</th>
                <th style={{ padding: 12, textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 2 }}>
                      {lead.customer_name}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {lead.company} • {lead.lead_number}
                    </div>
                  </td>
                  <td style={{ padding: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: getScoreColor(lead.ai_score)
                      }}></div>
                      <span style={{ fontSize: 14, fontWeight: 600, color: getScoreColor(lead.ai_score) }}>
                        {lead.ai_score}%
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      {getScoreLabel(lead.ai_score)}
                    </div>
                  </td>
                  <td style={{ padding: 12 }}>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '4px 8px',
                      borderRadius: 12,
                      fontSize: 12,
                      fontWeight: 600,
                      background: `${lead.prediction.color}20`,
                      color: lead.prediction.color
                    }}>
                      {lead.prediction.probability > 50 ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
                      {lead.prediction.label} ({lead.prediction.probability}%)
                    </div>
                  </td>
                  <td style={{ padding: 12, fontSize: 14, color: 'var(--text)' }}>{lead.industry}</td>
                  <td style={{ padding: 12, fontSize: 14, color: 'var(--text)' }}>{lead.source}</td>
                  <td style={{ padding: 12, fontSize: 14, color: 'var(--text)' }}>
                    {new Date(lead.last_activity).toLocaleDateString()}
                  </td>
                  <td style={{ padding: 12, textAlign: 'center' }}>
                    <button style={{
                      background: 'var(--accent)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '6px 12px',
                      fontSize: 12,
                      cursor: 'pointer'
                    }}>
                      Prioritize
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AILeadScoring;
