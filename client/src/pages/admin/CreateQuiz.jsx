import { useState, useEffect } from 'react';
import { createQuizTemplate, listQuizTemplates, toggleQuizTemplate, deleteQuizTemplate, getQuestions, updateQuizTemplate } from '../../services/api';

function DeleteModal({ template, onClose, onConfirm, deleting }) {
  return (
    <div className="modal-overlay" onClick={() => !deleting && onClose()}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ color: 'var(--danger)' }}>🗑 Delete "{template.title}"</div>
            <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginTop: '.25rem' }}>
              {template.totalAttempts > 0
                ? `${template.totalAttempts} student attempt(s) recorded`
                : 'No attempts recorded yet'}
            </div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={deleting}>✕</button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '.9rem', marginBottom: '1.25rem' }}>
          Choose what to delete:
        </p>

        <button
          onClick={() => onConfirm('quiz-only')}
          disabled={deleting}
          style={{
            width: '100%', textAlign: 'left', padding: '1rem 1.25rem',
            background: 'var(--bg-input)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)', cursor: 'pointer', marginBottom: '.75rem',
            color: 'var(--text-primary)', fontFamily: 'var(--font)', transition: 'border-color .2s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--warning)'}
          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
        >
          <div style={{ fontWeight: 700, marginBottom: '.25rem' }}>⚡ Delete this quiz only</div>
          <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
            Removes the quiz template &amp; its attempt history.<br />
            <strong style={{ color: 'var(--success)' }}>Questions stay in the database</strong> — you can create new quizzes from them.
          </div>
        </button>

        <button
          onClick={() => onConfirm('full')}
          disabled={deleting}
          style={{
            width: '100%', textAlign: 'left', padding: '1rem 1.25rem',
            background: 'var(--danger-bg)', border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)', cursor: 'pointer',
            color: 'var(--text-primary)', fontFamily: 'var(--font)', transition: 'background .2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,.2)'}
          onMouseLeave={e => e.currentTarget.style.background = 'var(--danger-bg)'}
        >
          <div style={{ fontWeight: 700, marginBottom: '.25rem', color: 'var(--danger)' }}>🔥 Delete everything</div>
          <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
            Removes ALL quizzes, ALL questions, ALL attempt history &amp; upload jobs.<br />
            <strong style={{ color: 'var(--danger)' }}>This cannot be undone.</strong>
          </div>
        </button>

        <button className="btn btn-secondary" style={{ width: '100%', marginTop: '.75rem' }}
          onClick={onClose} disabled={deleting}>
          Cancel
        </button>

        {deleting && (
          <div style={{ textAlign: 'center', marginTop: '.75rem', color: 'var(--text-muted)', fontSize: '.85rem' }}>
            <div className="spinner" style={{ margin: '0 auto .5rem' }} />
            Deleting...
          </div>
        )}
      </div>
    </div>
  );
}

const DEFAULT_FORM = { title: '', questionCount: 10, timePerQuestion: 30, difficulty: 'mixed', category: 'all', maxAttempts: 1, startsAt: '', endsAt: '' };

function QuizForm({ initial = DEFAULT_FORM, categories, onSubmit, onCancel, submitting, isEdit }) {
  const [form, setForm] = useState(initial);

  const totalMin = Math.ceil(form.questionCount * form.timePerQuestion / 60);

  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit(form); }}>
      <div className="form-group" style={{ marginBottom: '1rem' }}>
        <label className="form-label">Quiz Title</label>
        <input className="input" placeholder="e.g. Week 3 Assessment — Cybersecurity Basics"
          value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '.75rem', marginBottom: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Questions</label>
          <input className="input" type="number" min={1} max={100} value={form.questionCount}
            onChange={e => setForm(f => ({ ...f, questionCount: parseInt(e.target.value) || 1 }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Time/Question</label>
          <select className="select" value={form.timePerQuestion}
            onChange={e => setForm(f => ({ ...f, timePerQuestion: parseInt(e.target.value) }))}>
            <option value={15}>15 sec</option>
            <option value={30}>30 sec</option>
            <option value={45}>45 sec</option>
            <option value={60}>60 sec</option>
            <option value={90}>90 sec</option>
            <option value={120}>2 min</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Difficulty</label>
          <select className="select" value={form.difficulty}
            onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}>
            <option value="mixed">Mixed</option>
            <option value="easy">Easy</option>
            <option value="medium">Medium</option>
            <option value="hard">Hard</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Category</label>
          <select className="select" value={form.category}
            onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
            <option value="all">All</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Max Attempts</label>
          <select className="select" value={form.maxAttempts}
            onChange={e => setForm(f => ({ ...f, maxAttempts: parseInt(e.target.value) }))}>
            <option value={1}>1</option>
            <option value={2}>2</option>
            <option value={3}>3</option>
            <option value={0}>Unlimited</option>
          </select>
        </div>
      </div>

      {/* Scheduling */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '.75rem', marginBottom: '1rem' }}>
        <div className="form-group">
          <label className="form-label">Starts At <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
          <input className="input" type="datetime-local"
            value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Ends At <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
          <input className="input" type="datetime-local"
            value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} />
        </div>
      </div>

      <div style={{ padding: '.75rem', background: 'var(--bg-input)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
        📋 {form.questionCount} questions · ⏱ {form.timePerQuestion}s each · ⏳ {totalMin} min total
        {form.startsAt && <> · 📅 Opens {new Date(form.startsAt).toLocaleString()}</>}
        {form.endsAt && <> · ⛔ Closes {new Date(form.endsAt).toLocaleString()}</>}
      </div>

      <div style={{ display: 'flex', gap: '.5rem' }}>
        <button className="btn btn-secondary" type="button" onClick={onCancel}>Cancel</button>
        <button className="btn btn-primary" type="submit" disabled={submitting}>
          {submitting ? (isEdit ? 'Saving...' : 'Creating...') : (isEdit ? 'Save Changes' : 'Create & Get Code')}
        </button>
      </div>
    </form>
  );
}

export default function CreateQuiz({ addToast }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [categories, setCategories] = useState([]);
  const [copiedCode, setCopiedCode] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null); // { id, form }

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [tRes, qRes] = await Promise.all([
        listQuizTemplates(),
        getQuestions({ limit: 1 }),
      ]);
      setTemplates(tRes.data.templates);
      setCategories(qRes.data.categories || []);
    } catch { }
    setLoading(false);
  };

  const handleCreate = async (form) => {
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        startsAt: form.startsAt || null,
        endsAt: form.endsAt || null,
      };
      const res = await createQuizTemplate(payload);
      const created = { ...res.data.template, _id: res.data.template._id || res.data.template.id, createdAt: new Date() };
      setTemplates(prev => [created, ...prev]);
      setShowForm(false);
      addToast?.(`Quiz created! Code: ${res.data.template.code}`, 'success');
    } catch (err) {
      addToast?.(err.response?.data?.error || 'Failed to create quiz', 'error');
    }
    setSubmitting(false);
  };

  const handleEdit = async (form) => {
    if (!editingTemplate) return;
    setSubmitting(true);
    try {
      const payload = { ...form, startsAt: form.startsAt || null, endsAt: form.endsAt || null };
      const res = await updateQuizTemplate(editingTemplate.id, payload);
      setTemplates(prev => prev.map(t => t._id === editingTemplate.id ? { ...t, ...res.data.template } : t));
      setEditingTemplate(null);
      addToast?.('Quiz updated successfully', 'success');
    } catch (err) {
      addToast?.(err.response?.data?.error || 'Failed to update quiz', 'error');
    }
    setSubmitting(false);
  };

  const startEdit = (t) => {
    setEditingTemplate({
      id: t._id,
      form: {
        title: t.title,
        questionCount: t.questionCount,
        timePerQuestion: t.timePerQuestion,
        difficulty: t.difficulty,
        category: t.category,
        maxAttempts: t.maxAttempts,
        startsAt: t.startsAt ? new Date(t.startsAt).toISOString().slice(0, 16) : '',
        endsAt: t.endsAt ? new Date(t.endsAt).toISOString().slice(0, 16) : '',
      }
    });
    setShowForm(false);
  };

  const handleToggle = async (id) => {
    try {
      const res = await toggleQuizTemplate(id);
      setTemplates(prev => prev.map(t => t._id === id ? { ...t, isActive: res.data.isActive } : t));
    } catch { }
  };

  const handleDelete = async (mode) => {
    if (!deleteModal) return;
    setDeleting(true);
    try {
      const res = await deleteQuizTemplate(deleteModal.id, mode);
      const d = res.data.deleted;
      if (mode === 'full') {
        addToast?.(`Everything deleted: ${d.questions} questions, ${d.attempts} attempts`, 'success');
        setTemplates([]);
      } else {
        addToast?.(`Quiz deleted (${d.attempts} attempt records removed)`, 'success');
        setTemplates(prev => prev.filter(t => t._id !== deleteModal.id));
      }
      setDeleteModal(null);
    } catch (err) {
      addToast?.(err.response?.data?.error || 'Failed to delete', 'error');
    }
    setDeleting(false);
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;

  return (
    <div className="fade-in">

      {deleteModal && (
        <DeleteModal
          template={deleteModal}
          onClose={() => setDeleteModal(null)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Manage Quizzes</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '.25rem' }}>
            Create quizzes and share the code with students
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => { setShowForm(s => !s); setEditingTemplate(null); }}>
          {showForm ? 'Cancel' : '+ Create Quiz'}
        </button>
      </div>

      {/* Create quiz form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--accent)' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>New Quiz</h3>
          <QuizForm
            categories={categories}
            onSubmit={handleCreate}
            onCancel={() => setShowForm(false)}
            submitting={submitting}
            isEdit={false}
          />
        </div>
      )}

      {/* Edit quiz form */}
      {editingTemplate && (
        <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--warning)' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 700 }}>✏️ Edit Quiz</h3>
          <QuizForm
            initial={editingTemplate.form}
            categories={categories}
            onSubmit={handleEdit}
            onCancel={() => setEditingTemplate(null)}
            submitting={submitting}
            isEdit={true}
          />
        </div>
      )}

      {/* Quiz templates list */}
      {templates.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ fontSize: '2rem', marginBottom: '.5rem' }}>📝</p>
          <p style={{ color: 'var(--text-muted)' }}>No quizzes created yet. Click "Create Quiz" to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {templates.map(t => (
            <div key={t._id} className="card" style={{ opacity: t.isActive ? 1 : 0.6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.75rem', marginBottom: '.5rem', flexWrap: 'wrap' }}>
                    <h3 style={{ fontWeight: 700, fontSize: '1.1rem' }}>{t.title}</h3>
                    <span className={`badge ${t.isActive ? 'badge-easy' : 'badge-hard'}`}>
                      {t.isActive ? 'Active' : 'Paused'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '1.25rem', fontSize: '.8rem', color: 'var(--text-muted)', flexWrap: 'wrap' }}>
                    <span>📝 {t.questionCount} Q</span>
                    <span>⏱ {t.timePerQuestion}s each</span>
                    <span>🎯 {t.difficulty}</span>
                    <span>🔄 {t.maxAttempts === 0 ? '∞' : t.maxAttempts} attempts</span>
                    <span>👥 {t.totalAttempts || 0} taken</span>
                    {t.startsAt && <span>📅 Opens {new Date(t.startsAt).toLocaleDateString()}</span>}
                    {t.endsAt && <span>⛔ Closes {new Date(t.endsAt).toLocaleDateString()}</span>}
                  </div>
                </div>

                {/* Quiz Code */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '.7rem', color: 'var(--text-muted)', marginBottom: '.25rem', textTransform: 'uppercase', letterSpacing: '.05em' }}>Quiz Code</div>
                  <button onClick={() => copyCode(t.code)}
                    style={{
                      background: 'var(--bg-input)', border: '2px dashed var(--accent)',
                      borderRadius: 'var(--radius-sm)', padding: '.5rem 1rem',
                      fontSize: '1.3rem', fontWeight: 800, letterSpacing: '.15em', fontFamily: 'monospace',
                      color: 'var(--accent)', cursor: 'pointer',
                    }}>
                    {t.code}
                  </button>
                  <div style={{ fontSize: '.7rem', color: copiedCode === t.code ? 'var(--success)' : 'var(--text-muted)', marginTop: '.25rem' }}>
                    {copiedCode === t.code ? '✓ Copied!' : 'Click to copy'}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem', borderTop: '1px solid var(--border)', paddingTop: '.75rem', flexWrap: 'wrap' }}>
                <button className="btn btn-ghost btn-sm" onClick={() => handleToggle(t._id)}>
                  {t.isActive ? '⏸ Pause' : '▶ Resume'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => startEdit(t)}>
                  ✏️ Edit
                </button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }}
                  onClick={() => setDeleteModal({ id: t._id, title: t.title, totalAttempts: t.totalAttempts || 0 })}>
                  🗑 Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
