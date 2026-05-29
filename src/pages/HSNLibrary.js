import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BookOpen,
  Edit2,
  Filter,
  Package,
  Plus,
  Save,
  Search,
  Sparkles,
  Trash2,
  X
} from 'lucide-react';
import db, { generateId } from '../utils/database';
import SearchableSelect from '../components/ui/SearchableSelect';

const GST_RATE_OPTIONS = [0, 5, 12, 18, 28].map((rate) => ({ value: String(rate), label: `${rate}%` }));

function parseKeywords(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  try {
    const parsed = JSON.parse(`${value || ''}`.trim() || '[]');
    if (Array.isArray(parsed)) return parsed.filter(Boolean);
  } catch {
    // Fall through to CSV parsing.
  }
  return `${value || ''}`
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeHsnCode(value) {
  return `${value || ''}`.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
}

function scoreAskMatch(code, query) {
  const normalizedQuery = `${query || ''}`.trim().toLowerCase();
  if (!normalizedQuery) return 0;

  const gstMatch = normalizedQuery.match(/(\d{1,2})\s*%/);
  const gstRate = gstMatch ? Number(gstMatch[1]) : null;
  const codeMatch = normalizedQuery.match(/\b\d{2,8}\b/);
  const compactCode = codeMatch ? codeMatch[0] : '';
  const searchHaystack = [
    code.code,
    code.description,
    code.chapter_code,
    code.chapter_title,
    ...(code.keywordList || [])
  ].join(' ').toLowerCase();

  let score = 0;
  const tokens = normalizedQuery
    .replace(/[^a-z0-9%\s-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

  tokens.forEach((token) => {
    if (searchHaystack.includes(token)) score += token.length > 3 ? 4 : 2;
    if (code.code.startsWith(token)) score += 6;
  });

  if (compactCode && code.code.startsWith(compactCode)) score += 10;
  if (gstRate !== null && Number(code.gst_rate || 0) === gstRate) score += 5;
  if (searchHaystack.includes(normalizedQuery)) score += 8;

  return score;
}

function HsnModal({ record, existingCodes, onClose, onSave }) {
  const [form, setForm] = useState(record || {
    code: '',
    description: '',
    chapter_code: '',
    chapter_title: '',
    gst_rate: 18,
    keywords: '',
    notes: '',
    source_type: 'custom'
  });
  const [error, setError] = useState('');

  const updateField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (event) => {
    event.preventDefault();

    const nextCode = normalizeHsnCode(form.code);
    const nextDescription = `${form.description || ''}`.trim();
    const duplicate = existingCodes.find((item) => item.code === nextCode && item.id !== record?.id);

    if (!nextCode) {
      setError('HSN or SAC code is required.');
      return;
    }
    if (!nextDescription) {
      setError('Description is required.');
      return;
    }
    if (duplicate) {
      setError(`Code ${nextCode} already exists in the HSN library.`);
      return;
    }

    const params = [
      nextCode,
      nextDescription,
      `${form.chapter_code || ''}`.trim(),
      `${form.chapter_title || ''}`.trim(),
      Number(form.gst_rate || 0),
      JSON.stringify(parseKeywords(form.keywords)),
      `${form.notes || ''}`.trim(),
      `${form.source_type || 'custom'}`.trim() || 'custom'
    ];

    if (record?.id) {
      await db.run(
        `UPDATE hsn_codes
         SET code=?, description=?, chapter_code=?, chapter_title=?, gst_rate=?, keywords=?, notes=?, source_type=?, updated_at=datetime('now')
         WHERE id=?`,
        [...params, record.id]
      );
    } else {
      await db.run(
        `INSERT INTO hsn_codes (
          id, code, description, chapter_code, chapter_title, gst_rate, keywords, notes, source_type, source_reference, is_active, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, datetime('now'))`,
        [generateId(), ...params, 'manual-entry']
      );
    }

    onSave();
  };

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <div className="catalogue-modal-title">
            <div className="catalogue-modal-title-icon">
              <BookOpen size={18} />
            </div>
            <div>
              <h3>{record ? 'Edit HSN Record' : 'Add HSN Record'}</h3>
              <p>Maintain the searchable HSN master that products, GST logic, and commercial documents can reuse.</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error ? (
              <div className="catalogue-form-alert">
                <AlertTriangle size={16} />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header">
                <h4>Classification</h4>
                <span>Use standard HSN structure, then enrich it with business-friendly chapter and keyword context.</span>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">HSN / SAC Code</label>
                  <input
                    className="form-control"
                    value={form.code}
                    onChange={(event) => updateField('code', normalizeHsnCode(event.target.value))}
                    placeholder="85362020"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">GST Rate</label>
                  <SearchableSelect
                    value={String(form.gst_rate ?? 18)}
                    onChange={(value) => updateField('gst_rate', Number(value || 0))}
                    options={GST_RATE_OPTIONS}
                    placeholder="Search GST rate..."
                  />
                </div>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Chapter Code</label>
                  <input className="form-control" value={form.chapter_code || ''} onChange={(event) => updateField('chapter_code', event.target.value)} placeholder="85" />
                </div>
                <div className="form-group">
                  <label className="form-label">Chapter Title</label>
                  <input className="form-control" value={form.chapter_title || ''} onChange={(event) => updateField('chapter_title', event.target.value)} placeholder="Electrical machinery and equipment" />
                </div>
              </div>
            </div>

            <div className="catalogue-form-section">
              <div className="catalogue-form-section-header">
                <h4>Search Quality</h4>
                <span>Better descriptions and keywords make the code searchable by product teams, accounts, and store staff.</span>
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-control" rows={3} value={form.description || ''} onChange={(event) => updateField('description', event.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Keywords</label>
                <input className="form-control" value={form.keywords || ''} onChange={(event) => updateField('keywords', event.target.value)} placeholder="mcb, breaker, circuit protection" />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-control" rows={3} value={form.notes || ''} onChange={(event) => updateField('notes', event.target.value)} placeholder="Internal classification note or customer naming pattern" />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary"><Save size={14} /> {record ? 'Update HSN' : 'Add HSN'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function HSNLibrary() {
  const navigate = useNavigate();
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [askQuery, setAskQuery] = useState('');
  const [chapterFilter, setChapterFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const rows = await db.all(`
      SELECT
        hc.*,
        COUNT(p.id) AS linked_products,
        GROUP_CONCAT(p.name, ' | ') AS linked_product_names
      FROM hsn_codes hc
      LEFT JOIN products p ON p.hsn_code = hc.code AND p.is_active = 1
      WHERE hc.is_active = 1
      GROUP BY hc.id
      ORDER BY hc.chapter_code, hc.code
    `);

    setRecords((rows || []).map((row) => ({
      ...row,
      linked_products: Number(row.linked_products || 0),
      keywordList: parseKeywords(row.keywords)
    })));
    setLoading(false);
  };

  const chapterOptions = useMemo(() => {
    const map = new Map();
    records.forEach((row) => {
      const key = `${row.chapter_code || ''}`.trim();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          value: key,
          label: `Chapter ${key} - ${row.chapter_title || 'Unspecified'}`
        });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.value.localeCompare(b.value));
  }, [records]);

  const chapterCards = useMemo(() => {
    return chapterOptions.map((option) => {
      const rows = records.filter((record) => record.chapter_code === option.value);
      return {
        ...option,
        count: rows.length,
        linkedProducts: rows.reduce((sum, row) => sum + row.linked_products, 0)
      };
    });
  }, [chapterOptions, records]);

  const filteredRecords = useMemo(() => {
    const searchQuery = search.trim().toLowerCase();
    const askValue = askQuery.trim();

    return records
      .filter((record) => {
        const sourceOk = sourceFilter === 'all' || record.source_type === sourceFilter;
        const chapterOk = !chapterFilter || record.chapter_code === chapterFilter;
        if (!sourceOk || !chapterOk) return false;

        const haystack = [
          record.code,
          record.description,
          record.chapter_title,
          record.chapter_code,
          ...(record.keywordList || [])
        ].join(' ').toLowerCase();

        const searchOk = !searchQuery || haystack.includes(searchQuery);
        const askScore = askValue ? scoreAskMatch(record, askValue) : 0;
        return searchOk && (!askValue || askScore > 0);
      })
      .sort((left, right) => {
        if (askQuery.trim()) {
          return scoreAskMatch(right, askQuery) - scoreAskMatch(left, askQuery);
        }
        return `${left.chapter_code || ''}${left.code}`.localeCompare(`${right.chapter_code || ''}${right.code}`);
      });
  }, [records, search, askQuery, chapterFilter, sourceFilter]);

  const stats = useMemo(() => {
    const linked = records.filter((record) => record.linked_products > 0);
    const systemRows = records.filter((record) => record.source_type === 'system').length;
    const customRows = records.filter((record) => record.source_type !== 'system').length;
    return {
      total: records.length,
      linked: linked.length,
      chapters: chapterOptions.length,
      custom: customRows,
      system: systemRows
    };
  }, [chapterOptions.length, records]);

  const deleteRecord = async (record) => {
    const inUse = Number(record.linked_products || 0) > 0;
    const confirmed = window.confirm(
      inUse
        ? `Code ${record.code} is linked to ${record.linked_products} active product(s). Mark it inactive anyway?`
        : `Mark HSN code ${record.code} as inactive?`
    );
    if (!confirmed) return;
    await db.run('UPDATE hsn_codes SET is_active = 0, updated_at = datetime(\'now\') WHERE id = ?', [record.id]);
    loadData();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>HSN Library</h2>
          <span className="page-subtitle">Search, browse, and maintain the HSN master that products and GST logic can reuse.</span>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => navigate('/products')}>
            <Package size={14} /> Open Catalogue
          </button>
          <button className="btn btn-primary" onClick={() => setModal({})}>
            <Plus size={14} /> Add HSN
          </button>
        </div>
      </div>

      <div className="catalogue-hero">
        <div className="catalogue-hero-main">
          <div className="catalogue-hero-kicker">
            <Sparkles size={14} />
            <span>HSN command desk</span>
          </div>
          <h3>Find HSN by code, chapter, GST rate, or plain-language product meaning.</h3>
          <p>
            The workspace follows the strongest ERP pattern: keep HSN as reusable master data, let users add their own list, and link products by a searchable code library instead of manual repeated typing.
          </p>
          <div className="catalogue-chip-row">
            <span className="catalogue-chip">Search by product words</span>
            <span className="catalogue-chip">Browse chapter-wise list</span>
            <span className="catalogue-chip">Link products to HSN</span>
            <span className="catalogue-chip">Maintain custom company codes</span>
          </div>
        </div>
        <div className="catalogue-hero-side">
          <div className="catalogue-hero-side-label">Coverage</div>
          <strong>{stats.total}</strong>
          <span>{stats.system} starter codes plus {stats.custom} user-maintained entries ready for product linking.</span>
        </div>
      </div>

      <div className="catalogue-stats-grid">
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{stats.total}</div>
            <div className="stat-card-label">Active HSN Codes</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
            <BookOpen size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{stats.linked}</div>
            <div className="stat-card-label">Linked To Products</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'var(--success-dim)', color: 'var(--success)' }}>
            <Package size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{stats.chapters}</div>
            <div className="stat-card-label">Browsable Chapters</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'var(--warning-dim)', color: 'var(--warning)' }}>
            <Filter size={20} />
          </div>
        </div>
        <div className="stat-card">
          <div>
            <div className="stat-card-value">{stats.custom}</div>
            <div className="stat-card-label">Custom Records</div>
          </div>
          <div className="stat-card-icon" style={{ background: 'var(--info-dim)', color: 'var(--info)' }}>
            <Plus size={20} />
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 16px', display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.8fr)', gap: 16 }}>
        <div className="card">
          <div className="card-body" style={{ display: 'grid', gap: 14 }}>
            <div className="form-group">
              <label className="form-label">Ask HSN In Plain Language</label>
              <div className="search-bar" style={{ maxWidth: '100%' }}>
                <Search size={14} color="var(--text-muted)" />
                <input
                  value={askQuery}
                  onChange={(event) => setAskQuery(event.target.value)}
                  placeholder="Example: circuit breaker 18%, copper cable, electric motor"
                />
              </div>
              <span className="text-secondary text-sm">This ranks codes by description, chapter, keywords, GST hints, and matching code prefix.</span>
            </div>
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Search Library</label>
                <div className="search-bar" style={{ maxWidth: '100%' }}>
                  <Search size={14} color="var(--text-muted)" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search code, description, chapter, or keyword"
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Chapter Filter</label>
                <SearchableSelect
                  value={chapterFilter}
                  onChange={setChapterFilter}
                  options={chapterOptions}
                  placeholder="Browse chapter..."
                  clearable
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ display: 'grid', gap: 12 }}>
            <div className="form-group">
              <label className="form-label">Source Filter</label>
              <div className="tabs" style={{ width: '100%' }}>
                {[
                  { value: 'all', label: 'All' },
                  { value: 'system', label: 'Starter' },
                  { value: 'custom', label: 'Custom' }
                ].map((option) => (
                  <button
                    key={option.value}
                    className={`tab ${sourceFilter === option.value ? 'active' : ''}`}
                    onClick={() => setSourceFilter(option.value)}
                    type="button"
                    style={{ flex: 1 }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="catalogue-summary-card">
              <span className="catalogue-summary-title">Current Result Set</span>
              <strong>{filteredRecords.length}</strong>
              <span className="text-secondary text-sm">
                {askQuery.trim() ? 'Ask-ranking is active on the visible list.' : 'Use ask mode for plain-language lookup.'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          {chapterCards.map((chapter) => {
            const active = chapterFilter === chapter.value;
            return (
              <button
                key={chapter.value}
                type="button"
                onClick={() => setChapterFilter(active ? '' : chapter.value)}
                style={{
                  textAlign: 'left',
                  padding: 16,
                  borderRadius: 16,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--accent-dim)' : 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  cursor: 'pointer'
                }}
              >
                <div className="catalogue-summary-title">Chapter {chapter.value}</div>
                <strong style={{ display: 'block', marginTop: 8, fontSize: 17 }}>{chapter.label.replace(`Chapter ${chapter.value} - `, '')}</strong>
                <div className="text-secondary text-sm" style={{ marginTop: 6 }}>
                  {chapter.count} codes • {chapter.linkedProducts} product links
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="page-content" style={{ paddingTop: 0 }}>
        <div className="card">
          <div className="card-header">
            <div>
              <h4>HSN Master List</h4>
              <div className="text-secondary text-sm">Browse the shown list, inspect chapter coverage, and maintain records used by the product catalogue.</div>
            </div>
          </div>
          <div className="table-container" style={{ maxHeight: '100%' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>HSN</th>
                  <th>Description</th>
                  <th>Chapter</th>
                  <th>GST</th>
                  <th>Product Links</th>
                  <th>Source</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="text-center text-muted">Loading HSN library...</td></tr>
                ) : filteredRecords.length ? filteredRecords.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div className="font-mono text-accent">{record.code}</div>
                      {record.keywordList.length ? <div className="text-secondary text-sm">{record.keywordList.slice(0, 3).join(', ')}</div> : null}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{record.description}</div>
                      {record.notes ? <div className="text-secondary text-sm">{record.notes}</div> : null}
                    </td>
                    <td>
                      <div>Chapter {record.chapter_code || '-'}</div>
                      <div className="text-secondary text-sm">{record.chapter_title || 'Unspecified'}</div>
                    </td>
                    <td><span className="badge badge-info">{Number(record.gst_rate || 0)}%</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{record.linked_products}</div>
                      <div className="text-secondary text-sm">
                        {record.linked_product_names ? record.linked_product_names.split(' | ').slice(0, 2).join(', ') : 'No products linked yet'}
                      </div>
                    </td>
                    <td><span className={`badge ${record.source_type === 'system' ? 'badge-secondary' : 'badge-success'}`}>{record.source_type === 'system' ? 'Starter' : 'Custom'}</span></td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setModal(record)} title="Edit HSN">
                          <Edit2 size={13} />
                        </button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteRecord(record)} title="Archive HSN">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={7}>
                      <div className="empty-state">
                        <BookOpen size={40} />
                        <p>No HSN records matched the current filters.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal !== null ? (
        <HsnModal
          record={modal?.id ? modal : null}
          existingCodes={records}
          onClose={() => setModal(null)}
          onSave={() => {
            setModal(null);
            loadData();
          }}
        />
      ) : null}
    </div>
  );
}
