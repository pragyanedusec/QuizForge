import { useState, useEffect } from 'react';
import { getQuestions, updateQuestion, deleteQuestion, deleteAllQuestions } from '../../services/api';

export default function ManageQuestions({ addToast }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ difficulty: 'all', category: 'all' });
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null);
  const [editData, setEditData] = useState({});

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
    if (!confirm('Delete this question?')) return;
    try {
      await deleteQuestion(id);
      addToast('Question deleted', 'success');
      fetchQuestions();
    } catch {
      addToast('Failed to delete', 'error');
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm(`⚠️ Delete ALL ${total} questions and related data (quiz templates, attempts, upload jobs)? This cannot be undone.`)) return;
    if (!confirm('Are you absolutely sure? Everything will be permanently removed.')) return;
    try {
      const res = await deleteAllQuestions();
      const d = res.data.deleted;
      addToast(`Cleared: ${d.questions} questions, ${d.quizTemplates} quizzes, ${d.attempts} attempts, ${d.uploadJobs} jobs`, 'success');
      setQuestions([]);
      setTotal(0);
    } catch {
      addToast('Failed to delete all data', 'error');
    }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Manage Questions</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '.25rem' }}>
            {total} questions in database
          </p>
        </div>
        {total > 0 && (
          <button className="btn btn-ghost btn-sm"
            style={{ color: 'var(--danger)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)' }}
            onClick={handleDeleteAll}>
            🗑 Delete All ({total})
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ minWidth: '160px' }}>
            <label className="form-label">Difficulty</label>
            <select className="select" value={filters.difficulty}
              onChange={(e) => { setFilters(f => ({ ...f, difficulty: e.target.value })); setPage(1); }}>
              <option value="all">All</option>
              <option value="easy">Easy</option>
              <option value="medium">Medium</option>
              <option value="hard">Hard</option>
            </select>
          </div>
          <div className="form-group" style={{ minWidth: '160px' }}>
            <label className="form-label">Category</label>
            <select className="select" value={filters.category}
              onChange={(e) => { setFilters(f => ({ ...f, category: e.target.value })); setPage(1); }}>
              <option value="all">All</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /><p>Loading...</p></div>
      ) : questions.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📭</div>
          <p>No questions found. Upload a PDF first!</p>
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
