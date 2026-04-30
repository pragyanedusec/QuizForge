import { useState, useEffect } from 'react';
import { getQuestions, updateQuestion, deleteQuestion, deleteAllQuestions, saveQuestions } from '../../services/api';

const EMPTY_FORM = {
  question: '',
  options: ['', '', '', ''],
  correctAnswer: '',
  difficulty: 'medium',
  category: '',
};

function DeleteModal({ count, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        <div className="modal-header">
          <div className="modal-title" style={{ color: 'var(--danger)' }}>🗑 Delete All Questions</div>
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>✕</button>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem', marginBottom: '1.25rem' }}>
          This will permanently delete <strong style={{ color: 'var(--danger)' }}>{count} questions</strong> and all related quiz templates, attempts, and upload jobs. <strong>This cannot be undone.</strong>
        </p>
        <div style={{ display: 'flex', gap: '.75rem' }}>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" style={{ flex: 1 }} onClick={onConfirm}>Delete Everything</button>
        </div>
      </div>
    </div>
  );
}

function AddQuestionForm({ categories, onSave, onCancel }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleOptionChange = (i, val) => {
    const opts = [...form.options];
    opts[i] = val;
    const updated = { ...form, options: opts };
    // If correct answer was this option, clear it
    if (form.correctAnswer === form.options[i]) updated.correctAnswer = '';
    setForm(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    const filled = form.options.filter(o => o.trim());
    if (filled.length < 2) return setError('At least 2 options are required.');
    if (!form.correctAnswer) return setError('Please select the correct answer.');
    if (!form.question.trim()) return setError('Question text is required.');
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message || 'Failed to save');
    }
    setSaving(false);
  };

  return (
    <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--accent)' }}>
      <h3 style={{ fontWeight: 700, marginBottom: '1rem' }}>➕ Add Question Manually</h3>
      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ marginBottom: '.75rem' }}>
          <label className="form-label">Question Text</label>
          <textarea className="textarea" rows={2} placeholder="Enter the question..."
            value={form.question} onChange={e => setForm(f => ({ ...f, question: e.target.value }))} required />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', marginBottom: '.75rem' }}>
          {form.options.map((opt, i) => (
            <div key={i} className="form-group">
              <label className="form-label">Option {String.fromCharCode(65 + i)}</label>
              <input className="input" placeholder={`Option ${String.fromCharCode(65 + i)}`}
                value={opt} onChange={e => handleOptionChange(i, e.target.value)} />
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.5rem', marginBottom: '.75rem' }}>
          <div className="form-group">
            <label className="form-label">Correct Answer</label>
            <select className="select" value={form.correctAnswer}
              onChange={e => setForm(f => ({ ...f, correctAnswer: e.target.value }))}>
              <option value="">— Select —</option>
              {form.options.map((opt, i) => opt.trim() && (
                <option key={i} value={opt}>{String.fromCharCode(65 + i)}: {opt.substring(0, 30)}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Difficulty</label>
            <select className="select" value={form.difficulty}
              onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Category</label>
            <input className="input" placeholder="e.g. Networking"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              list="cat-suggestions" />
            <datalist id="cat-suggestions">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
        </div>

        {error && (
          <div style={{ padding: '.6rem 1rem', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '.85rem', marginBottom: '.75rem' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: '.5rem' }}>
          <button className="btn btn-secondary btn-sm" type="button" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary btn-sm" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Save Question'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function ManageQuestions({ addToast }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ difficulty: 'all', category: 'all', search: '' });
  const [searchInput, setSearchInput] = useState('');
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [editData, setEditData] = useState({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await getQuestions({ ...filters, page, limit: 20 });
      setQuestions(res.data.questions);
      setTotal(res.data.total);
      setCategories(res.data.categories || []);
    } catch {
      addToast('Failed to load questions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQuestions(); }, [filters, page]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters(f => ({ ...f, search: searchInput }));
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchInput]);

  const handleEdit = (q) => {
    setEditing(q._id);
    setEditData({
      question: q.question,
      options: [...q.options],
      correctAnswer: q.correctAnswer,
      difficulty: q.difficulty,
      category: q.category,
    });
  };

  const handleSaveEdit = async () => {
    try {
      await updateQuestion(editing, editData);
      addToast('Question updated', 'success');
      setEditing(null);
      fetchQuestions();
    } catch {
      addToast('Failed to update', 'error');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteQuestion(id);
      addToast('Question deleted', 'success');
      fetchQuestions();
    } catch {
      addToast('Failed to delete', 'error');
    }
  };

  const handleDeleteAll = async () => {
    setShowDeleteAllModal(false);
    try {
      const res = await deleteAllQuestions();
      const d = res.data.deleted;
      addToast(`Cleared: ${d.questions} questions, ${d.quizTemplates} quizzes, ${d.attempts} attempts`, 'success');
      setQuestions([]);
      setTotal(0);
    } catch {
      addToast('Failed to delete all data', 'error');
    }
  };

  const handleAddQuestion = async (form) => {
    const q = {
      question: form.question.trim(),
      options: form.options.map(o => o.trim()).filter(Boolean),
      correctAnswer: form.correctAnswer,
      difficulty: form.difficulty,
      category: form.category.trim() || 'General',
      source: 'manual',
    };
    // Pad to 4 options if needed
    while (q.options.length < 4) q.options.push('');
    await saveQuestions([q]);
    addToast('Question added successfully', 'success');
    setShowAddForm(false);
    fetchQuestions();
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="fade-in">
      {showDeleteAllModal && (
        <DeleteModal
          count={total}
          onConfirm={handleDeleteAll}
          onCancel={() => setShowDeleteAllModal(false)}
        />
      )}

      <div className="admin-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Manage Questions</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '.25rem' }}>
            {total} question{total !== 1 ? 's' : ''} in database
          </p>
        </div>
        <div className="btn-group" style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShowAddForm(s => !s)}>
            {showAddForm ? '✕ Cancel' : '➕ Add Question'}
          </button>
          {total > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)' }}
              onClick={() => setShowDeleteAllModal(true)}>
              🗑 Delete All ({total})
            </button>
          )}
        </div>
      </div>

      {/* Add Question Form */}
      {showAddForm && (
        <AddQuestionForm
          categories={categories}
          onSave={handleAddQuestion}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ flex: 2, minWidth: '200px' }}>
            <label className="form-label">Search</label>
            <input className="input" placeholder="Search questions..."
              value={searchInput} onChange={e => setSearchInput(e.target.value)} />
          </div>
          <div className="form-group" style={{ minWidth: '140px' }}>
            <label className="form-label">Difficulty</label>
            <select className="select" value={filters.difficulty}
              onChange={(e) => { setFilters(f => ({ ...f, difficulty: e.target.value })); setPage(1); }}>
              <option value="all">All</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="form-group" style={{ minWidth: '140px' }}>
            <label className="form-label">Category</label>
            <select className="select" value={filters.category}
              onChange={(e) => { setFilters(f => ({ ...f, category: e.target.value })); setPage(1); }}>
              <option value="all">All</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {(filters.search || filters.difficulty !== 'all' || filters.category !== 'all') && (
            <button className="btn btn-ghost btn-sm" style={{ alignSelf: 'flex-end' }}
              onClick={() => { setFilters({ difficulty: 'all', category: 'all', search: '' }); setSearchInput(''); setPage(1); }}>
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>
      ) : questions.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📭</div>
          <p>{filters.search ? `No questions matching "${filters.search}"` : 'No questions found. Upload a PDF or add one manually!'}</p>
        </div>
      ) : (
        <>
          {questions.map(q => (
            <div key={q._id} className="card" style={{ marginBottom: '.75rem' }}>
              {editing === q._id ? (
                /* Edit Mode */
                <div>
                  <div className="form-group" style={{ marginBottom: '.75rem' }}>
                    <label className="form-label">Question</label>
                    <textarea className="textarea" value={editData.question}
                      onChange={(e) => setEditData(d => ({ ...d, question: e.target.value }))} rows={2} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', marginBottom: '.75rem' }}>
                    {editData.options.map((opt, i) => (
                      <div key={i} className="form-group">
                        <label className="form-label">Option {String.fromCharCode(65 + i)}</label>
                        <input className="input" value={opt}
                          onChange={(e) => {
                            const opts = [...editData.options];
                            opts[i] = e.target.value;
                            setEditData(d => ({ ...d, options: opts }));
                          }} />
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.5rem', marginBottom: '.75rem' }}>
                    <div className="form-group">
                      <label className="form-label">Correct Answer</label>
                      <select className="select" value={editData.correctAnswer}
                        onChange={(e) => setEditData(d => ({ ...d, correctAnswer: e.target.value }))}>
                        {editData.options.map((opt, i) => <option key={i} value={opt}>{String.fromCharCode(65 + i)}: {opt.substring(0, 30)}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Difficulty</label>
                      <select className="select" value={editData.difficulty}
                        onChange={(e) => setEditData(d => ({ ...d, difficulty: e.target.value }))}>
                        <option value="easy">Easy</option>
                        <option value="medium">Medium</option>
                        <option value="hard">Hard</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Category</label>
                      <input className="input" value={editData.category}
                        onChange={(e) => setEditData(d => ({ ...d, category: e.target.value }))} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '.5rem', justifyContent: 'flex-end' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                    <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>Save</button>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '.5rem', marginBottom: '.5rem', flexWrap: 'wrap' }}>
                      <span className={`badge badge-${q.difficulty}`}>{q.difficulty}</span>
                      <span className="badge badge-info">{q.category}</span>
                      {q.source === 'manual' && <span className="badge" style={{ background: 'rgba(99,102,241,.15)', color: 'var(--accent)' }}>manual</span>}
                    </div>
                    <p style={{ fontWeight: 600, marginBottom: '.5rem' }}>{q.question}</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.25rem .75rem', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
                      {q.options.map((opt, i) => (
                        <span key={i} style={{ color: opt === q.correctAnswer ? 'var(--success)' : undefined, fontWeight: opt === q.correctAnswer ? 600 : 400 }}>
                          {String.fromCharCode(65 + i)}. {opt}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '.25rem', flexShrink: 0 }}>
                    <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(q)}>Edit</button>
                    <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                      onClick={() => handleDelete(q._id)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '.5rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary btn-sm" disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ padding: '.5rem 1rem', color: 'var(--text-muted)', fontSize: '.85rem' }}>
                Page {page} of {totalPages}
              </span>
              <button className="btn btn-secondary btn-sm" disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
