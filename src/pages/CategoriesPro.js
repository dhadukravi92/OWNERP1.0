import React, { useEffect, useMemo, useState } from 'react';
import db, { generateId } from '../utils/database';
import SearchableSelect from '../components/ui/SearchableSelect';
import { Edit2, FolderTree, Package, Plus, Search, Tags, Trash2, X } from 'lucide-react';

const EMPTY_FORM = {
  name: '',
  parent_id: '',
  description: ''
};

function CategoryModal({ category, categories, onClose, onSave }) {
  const [form, setForm] = useState({
    ...EMPTY_FORM,
    ...(category || {}),
    parent_id: category?.parent_id || ''
  });
  const [error, setError] = useState('');

  const parentOptions = categories
    .filter((item) => item.id !== category?.id)
    .map((item) => ({ value: item.id, label: item.name }));
  const hasParentOptions = parentOptions.length > 0;

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const normalizedName = `${form.name || ''}`.trim().replace(/\s+/g, ' ');
    if (!normalizedName) {
      setError('Category name is required.');
      return;
    }

    const duplicate = categories.find((item) => {
      if (item.id === category?.id) return false;
      return `${item.name || ''}`.trim().toLowerCase() === normalizedName.toLowerCase();
    });
    if (duplicate) {
      setError(`Category "${normalizedName}" already exists.`);
      return;
    }

    if (form.parent_id && form.parent_id === category?.id) {
      setError('Parent category cannot be the same as the current category.');
      return;
    }

    if (form.parent_id && !categories.some((item) => item.id === form.parent_id)) {
      setError('Selected parent category is no longer available. Please reselect.');
      return;
    }

    // Prevent circular parent chains on edit (A -> ... -> A).
    if (category?.id && form.parent_id) {
      const byId = new Map(categories.map((item) => [item.id, item]));
      let cursor = form.parent_id;
      const visited = new Set();
      while (cursor && !visited.has(cursor)) {
        if (cursor === category.id) {
          setError('Circular hierarchy is not allowed. Choose a different parent category.');
          return;
        }
        visited.add(cursor);
        cursor = byId.get(cursor)?.parent_id || '';
      }
    }

    if (category?.id) {
      await db.run(
        'UPDATE categories SET name=?, parent_id=?, description=? WHERE id=?',
        [normalizedName, form.parent_id || null, `${form.description || ''}`.trim(), category.id]
      );
    } else {
      await db.run(
        'INSERT INTO categories (id, name, parent_id, description) VALUES (?,?,?,?)',
        [generateId(), normalizedName, form.parent_id || null, `${form.description || ''}`.trim()]
      );
    }

    onSave();
  };

  return (
    <div className="modal-overlay" onClick={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="catalogue-modal-title">
            <div className="catalogue-modal-title-icon">
              <Tags size={18} />
            </div>
            <div>
              <h3>{category ? 'Edit Category' : 'Add Category'}</h3>
              <p>Keep your product classification clean so product search, reporting, and stock analytics remain accurate.</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {error && (
              <div className="catalogue-form-alert">
                <span>{error}</span>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Category Name *</label>
              <input
                className="form-control"
                value={form.name}
                onChange={(event) => updateField('name', event.target.value)}
                required
                placeholder="e.g. Switchgear"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Parent Category (optional)</label>
              <SearchableSelect
                value={form.parent_id}
                onChange={(nextValue) => updateField('parent_id', nextValue)}
                options={parentOptions}
                placeholder={hasParentOptions ? 'Search parent category...' : 'No parent categories available yet'}
                emptyLabel="No matching parent category"
                disabled={!hasParentOptions}
                clearable
              />
              {!hasParentOptions && (
                <span className="text-xs text-muted">
                  Create this category first. Parent selection becomes available after at least one category exists.
                </span>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                className="form-control"
                rows={3}
                value={form.description}
                onChange={(event) => updateField('description', event.target.value)}
                placeholder="Add short context for team usage (optional)"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{category ? 'Update Category' : 'Save Category'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CategoriesPro() {
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const loadData = async () => {
    setLoading(true);
    const rows = await db.all(`
      SELECT
        c.*,
        parent.name AS parent_name,
        COUNT(p.id) AS product_count
      FROM categories c
      LEFT JOIN categories parent ON parent.id = c.parent_id
      LEFT JOIN products p ON p.category_id = c.id AND p.is_active = 1
      GROUP BY c.id
      ORDER BY c.name
    `);
    setCategories(rows || []);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const query = `${search || ''}`.trim().toLowerCase();
    if (!query) return categories;
    return categories.filter((category) => {
      const haystack = [
        category.name,
        category.parent_name,
        category.description
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [categories, search]);

  const deleteCategory = async (category) => {
    if (!category?.id) return;

    const hasProducts = Number(category.product_count || 0) > 0;
    const hasChildren = categories.some((item) => item.parent_id === category.id);

    if (hasProducts) {
      window.alert(`"${category.name}" is linked with active products. Reassign those products before deleting this category.`);
      return;
    }

    if (hasChildren) {
      window.alert(`"${category.name}" has child categories. Reassign or remove child categories first.`);
      return;
    }

    const confirmed = window.confirm(`Delete category "${category.name}"?`);
    if (!confirmed) return;

    await db.run('DELETE FROM categories WHERE id = ?', [category.id]);
    loadData();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="page-title">
          <h2>Category Masters</h2>
          <span className="page-subtitle">Central place to create and maintain product categories used in Product Catalogue.</span>
        </div>
        <div className="page-actions">
          <div className="search-bar">
            <Search size={14} />
            <input
              placeholder="Search category..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <button className="btn btn-primary btn-sm" onClick={() => setModal({})}>
            <Plus size={14} /> Add Category
          </button>
        </div>
      </div>

      <div className="page-content">
        <div className="catalogue-summary-grid" style={{ marginBottom: 16 }}>
          <div className="catalogue-summary-card">
            <span className="catalogue-summary-title">Total Categories</span>
            <strong>{categories.length}</strong>
            <span className="text-secondary text-sm">Category records in master.</span>
          </div>
          <div className="catalogue-summary-card">
            <span className="catalogue-summary-title">Root Categories</span>
            <strong>{categories.filter((item) => !item.parent_id).length}</strong>
            <span className="text-secondary text-sm">Top-level buckets without parent.</span>
          </div>
          <div className="catalogue-summary-card">
            <span className="catalogue-summary-title">Categories In Use</span>
            <strong>{categories.filter((item) => Number(item.product_count || 0) > 0).length}</strong>
            <span className="text-secondary text-sm">Linked to at least one active product.</span>
          </div>
        </div>

        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Parent</th>
                  <th>Active Products</th>
                  <th>Description</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center text-muted" style={{ padding: 32 }}>Loading categories...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5}>
                      <div className="empty-state">
                        <FolderTree size={40} />
                        <p>No categories found</p>
                      </div>
                    </td>
                  </tr>
                ) : filtered.map((category) => (
                  <tr key={category.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Tags size={14} />
                        <strong>{category.name}</strong>
                      </div>
                    </td>
                    <td>{category.parent_name || '-'}</td>
                    <td>
                      <span className="badge badge-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Package size={12} />
                        {Number(category.product_count || 0)}
                      </span>
                    </td>
                    <td className="text-secondary">{category.description || '-'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-icon btn-sm" onClick={() => setModal(category)} title="Edit">
                          <Edit2 size={13} />
                        </button>
                        <button className="btn btn-danger btn-icon btn-sm" onClick={() => deleteCategory(category)} title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {modal !== null && (
        <CategoryModal
          category={modal?.id ? modal : null}
          categories={categories}
          onClose={() => setModal(null)}
          onSave={() => {
            setModal(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
