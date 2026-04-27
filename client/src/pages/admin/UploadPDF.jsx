import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadPDF, getUploadStatus, saveQuestions } from '../../services/api';

// ── Confidence pill ────────────────────────────────────────────────────────
function ConfidenceBadge({ score }) {
  if (score == null) return null;
  const pct = Math.round(score * 100);
  const color = score >= 0.7 ? 'var(--success)' : score >= 0.5 ? 'var(--warning)' : 'var(--danger)';
  const label = score >= 0.7 ? 'High' : score >= 0.5 ? 'Medium' : 'Low';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '.3rem',
      padding: '.2rem .55rem', borderRadius: '99px',
      fontSize: '.72rem', fontWeight: 700,
      background: `${color}22`, color,
      border: `1px solid ${color}55`,
    }}>
      {pct}% {label}
    </span>
  );
}

// ── Card border color by confidence ───────────────────────────────────────
function cardBorder(q) {
  if (!q.needsReview && q.confidence >= 0.7) return 'var(--border)';
  if (q.confidence >= 0.5) return 'rgba(245,158,11,.4)';
  return 'rgba(239,68,68,.4)';
}

export default function UploadPDF({ addToast }) {
  const [dragOver, setDragOver]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId]         = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [extracted, setExtracted] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [filter, setFilter]       = useState('all'); // all | review | ok
  const fileRef  = useRef();
  const pollRef  = useRef();
  const navigate = useNavigate();

  // Poll upload job status
  const pollStatus = useCallback(async (id) => {
    try {
      const res = await getUploadStatus(id);
      const job = res.data.job;
      setJobStatus(job);

      if (job.status === 'completed') {
        clearInterval(pollRef.current);
        setExtracted(job.questions || []);
        setUploading(false);
        const reviewCount = (job.questions || []).filter(q => q.needsReview).length;
        if (reviewCount > 0) {
          addToast(
            `Extracted ${job.extractedCount} questions — ${reviewCount} flagged for review`,
            'info'
          );
        } else {
          addToast(`Extracted ${job.extractedCount} questions!`, 'success');
        }
      } else if (job.status === 'failed') {
        clearInterval(pollRef.current);
        setUploading(false);
        addToast(job.error || 'PDF processing failed', 'error');
      }
    } catch {
      clearInterval(pollRef.current);
      setUploading(false);
    }
  }, [addToast]);

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const handleFile = async (file) => {
    if (!file || file.type !== 'application/pdf') {
      addToast('Please select a PDF file', 'error');
      return;
    }
    setUploading(true);
    setJobStatus(null);
    setExtracted(null);
    try {
      const fd = new FormData();
      fd.append('pdf', file);
      const res = await uploadPDF(fd);
      const id = res.data.jobId;
      setJobId(id);
      pollRef.current = setInterval(() => pollStatus(id), 1500);
    } catch (err) {
      setUploading(false);
      addToast(err.response?.data?.error || 'Upload failed', 'error');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const updateQuestion = (idx, field, value) => {
    setExtracted(prev => {
      const copy = [...prev];
      if (field.startsWith('options.')) {
        const oi = parseInt(field.split('.')[1]);
        copy[idx] = {
          ...copy[idx],
          options: copy[idx].options.map((o, i) => i === oi ? value : o),
        };
      } else {
        copy[idx] = { ...copy[idx], [field]: value };
      }
      // Re-check needsReview after edit: clear it if answer is now set
      if (field === 'correctAnswer' && value) {
        copy[idx] = { ...copy[idx], needsReview: false };
      }
      return copy;
    });
  };

  const removeQuestion = (idx) => {
    setExtracted(prev => prev.filter((_, i) => i !== idx));
  };

  // Guard: cannot save if any question has no correct answer
  const missingAnswers = extracted?.filter(q => !q.correctAnswer || q.correctAnswer.trim() === '') || [];
  const canSave = extracted?.length > 0 && missingAnswers.length === 0;

  const handleSave = async () => {
    if (!canSave) {
      addToast(`${missingAnswers.length} question(s) still need a correct answer`, 'error');
      return;
    }
    setSaving(true);
    try {
      // Strip client-only fields before saving
      const clean = extracted.map(({ confidence, validationErrors, rejectionReasons, ...q }) => ({
        ...q,
        source: 'pdf',
      }));
      await saveQuestions(clean);
      addToast(`Saved ${clean.length} questions!`, 'success');
      setExtracted(null);
      setJobStatus(null);
      navigate('/admin/questions');
    } catch (err) {
      addToast(err.response?.data?.error || 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Filtered view
  const displayed = extracted
    ? extracted.filter(q => {
        if (filter === 'review') return q.needsReview || q.confidence < 0.7;
        if (filter === 'ok')     return !q.needsReview && q.confidence >= 0.7;
        return true;
      })
    : [];

  const reviewCount  = extracted?.filter(q => q.needsReview || q.confidence < 0.7).length ?? 0;
  const lowConfCount = extracted?.filter(q => q.confidence < 0.7).length ?? 0;

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Upload PDF</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '.25rem' }}>
          Upload a PDF containing MCQ questions — each question is validated and confidence-scored before review
        </p>
      </div>

      {!extracted ? (
        <div>
          {/* ── Drop zone ─────────────────────────────────────────────────── */}
          <div
            className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && fileRef.current?.click()}
            style={{ cursor: uploading ? 'default' : 'pointer' }}
          >
            <input ref={fileRef} type="file" accept=".pdf" style={{ display: 'none' }}
              onChange={(e) => handleFile(e.target.files[0])} />

            {uploading ? (
              <div>
                <div className="spinner" style={{ margin: '0 auto 1rem' }} />
                <p className="upload-text">Processing PDF...</p>
                {jobStatus && (
                  <div style={{ marginTop: '1.25rem', maxWidth: '300px', marginInline: 'auto' }}>
                    <div style={{ height: '6px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden', marginBottom: '.5rem' }}>
                      <div style={{
                        height: '100%',
                        width: `${jobStatus.progress}%`,
                        background: 'var(--gradient-1)',
                        borderRadius: '3px',
                        transition: 'width .5s ease',
                      }} />
                    </div>
                    <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      {jobStatus.progress}% — {jobStatus.status === 'processing' ? 'Extracting & validating questions...' : jobStatus.status}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <div className="upload-icon">📄</div>
                <p className="upload-text">
                  Drag &amp; drop a PDF here, or <strong style={{ color: 'var(--accent)' }}>click to browse</strong>
                </p>
                <p className="upload-hint">Supports MCQ format with numbered questions and A/B/C/D options (max 10MB)</p>
              </>
            )}
          </div>

          {jobStatus?.status === 'failed' && (
            <div className="card" style={{ marginTop: '1rem', borderColor: 'var(--danger)' }}>
              <p style={{ color: 'var(--danger)', fontWeight: 600 }}>⚠ Processing Failed</p>
              <p style={{ color: 'var(--text-muted)', fontSize: '.85rem', marginTop: '.25rem' }}>{jobStatus.error}</p>
              <button className="btn btn-secondary btn-sm" style={{ marginTop: '.75rem' }}
                onClick={() => { setJobStatus(null); setUploading(false); }}>Try Again</button>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* ── Summary bar ───────────────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>
                Review Extracted Questions ({extracted.length})
              </h2>
              <div style={{ display: 'flex', gap: '.5rem', marginTop: '.5rem', flexWrap: 'wrap' }}>
                {reviewCount > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '.3rem',
                    padding: '.2rem .65rem', borderRadius: '99px',
                    fontSize: '.75rem', fontWeight: 700,
                    background: 'rgba(245,158,11,.12)', color: 'var(--warning)',
                    border: '1px solid rgba(245,158,11,.3)',
                  }}>
                    ⚠ {reviewCount} need review
                  </span>
                )}
                {missingAnswers.length > 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '.3rem',
                    padding: '.2rem .65rem', borderRadius: '99px',
                    fontSize: '.75rem', fontWeight: 700,
                    background: 'rgba(239,68,68,.12)', color: 'var(--danger)',
                    border: '1px solid rgba(239,68,68,.3)',
                  }}>
                    ✕ {missingAnswers.length} missing answer
                  </span>
                )}
                {reviewCount === 0 && missingAnswers.length === 0 && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: '.3rem',
                    padding: '.2rem .65rem', borderRadius: '99px',
                    fontSize: '.75rem', fontWeight: 700,
                    background: 'rgba(34,197,94,.12)', color: 'var(--success)',
                    border: '1px solid rgba(34,197,94,.3)',
                  }}>
                    ✓ All questions validated
                  </span>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              {/* Filter tabs */}
              <div style={{ display: 'flex', gap: '.25rem', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)', padding: '.2rem' }}>
                {[['all', 'All'], ['review', '⚠ Needs Review'], ['ok', '✓ Good']].map(([val, label]) => (
                  <button key={val} onClick={() => setFilter(val)}
                    className={`btn btn-sm ${filter === val ? 'btn-primary' : 'btn-ghost'}`}
                    style={{ fontSize: '.75rem' }}>
                    {label}
                  </button>
                ))}
              </div>
              <button className="btn btn-secondary" onClick={() => { setExtracted(null); setJobStatus(null); }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSave}
                disabled={saving || !canSave}
                title={!canSave ? 'Set correct answers for all questions first' : ''}
              >
                {saving ? 'Saving...' : `Save All (${extracted.length})`}
              </button>
            </div>
          </div>

          {/* ── Missing answer warning banner ─────────────────────────────── */}
          {missingAnswers.length > 0 && (
            <div style={{
              padding: '1rem 1.25rem', marginBottom: '1.25rem',
              background: 'rgba(239,68,68,.08)', borderRadius: 'var(--radius-sm)',
              borderLeft: '4px solid var(--danger)',
            }}>
              <p style={{ color: 'var(--danger)', fontWeight: 700, marginBottom: '.25rem' }}>
                ✕ Cannot save yet — {missingAnswers.length} question{missingAnswers.length > 1 ? 's' : ''} missing a correct answer
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>
                Select a correct answer in each red-highlighted card before saving.
              </p>
            </div>
          )}

          {/* ── Question cards ────────────────────────────────────────────── */}
          {displayed.length === 0 && (
            <div className="empty-state">
              <p>No questions match this filter.</p>
              <button className="btn btn-ghost btn-sm" onClick={() => setFilter('all')}>Show All</button>
            </div>
          )}

          {displayed.map((q, dispIdx) => {
            // find real index in extracted[] for updates
            const realIdx = extracted.indexOf(q);
            const isMissingAnswer = !q.correctAnswer || q.correctAnswer.trim() === '';
            const isLowConf = q.confidence != null && q.confidence < 0.7;

            return (
              <div key={realIdx} className="card" style={{
                marginBottom: '1rem',
                borderColor: isMissingAnswer ? 'var(--danger)' : cardBorder(q),
                borderWidth: (isMissingAnswer || isLowConf) ? '1.5px' : '1px',
              }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className="badge badge-info">Q{realIdx + 1}</span>
                    <span className="badge" style={{ background: 'rgba(99,102,241,.1)', color: 'var(--accent)' }}>PDF</span>
                    <ConfidenceBadge score={q.confidence} />
                    {q.needsReview && (
                      <span className="badge" style={{ background: 'rgba(245,158,11,.12)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,.3)' }}>
                        ⚠ Needs Review
                      </span>
                    )}
                    {isMissingAnswer && (
                      <span className="badge" style={{ background: 'rgba(239,68,68,.12)', color: 'var(--danger)', border: '1px solid rgba(239,68,68,.3)' }}>
                        ✕ Answer Required
                      </span>
                    )}
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeQuestion(realIdx)} title="Remove">✕</button>
                </div>

                {/* Validation errors */}
                {q.validationErrors?.length > 0 && (
                  <div style={{
                    padding: '.5rem .75rem', marginBottom: '.75rem',
                    background: 'rgba(239,68,68,.07)', borderRadius: 'var(--radius-sm)',
                    borderLeft: '3px solid var(--danger)',
                  }}>
                    {q.validationErrors.map((e, i) => (
                      <p key={i} style={{ fontSize: '.78rem', color: 'var(--danger)', margin: 0 }}>• {e}</p>
                    ))}
                  </div>
                )}

                {/* Question text */}
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label">Question</label>
                  <textarea className="textarea" value={q.question}
                    onChange={(e) => updateQuestion(realIdx, 'question', e.target.value)} rows={2} />
                </div>

                {/* Options */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.75rem', marginBottom: '1rem' }}>
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="form-group">
                      <label className="form-label">Option {String.fromCharCode(65 + oi)}</label>
                      <input className="input" value={opt}
                        onChange={(e) => updateQuestion(realIdx, `options.${oi}`, e.target.value)}
                        style={opt === q.correctAnswer ? { borderColor: 'var(--success)' } : {}} />
                    </div>
                  ))}
                </div>

                {/* Correct answer + meta */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '.75rem' }}>
                  <div className="form-group">
                    <label className="form-label" style={isMissingAnswer ? { color: 'var(--danger)' } : {}}>
                      {isMissingAnswer ? '✕ Correct Answer *' : 'Correct Answer'}
                    </label>
                    <select
                      className="select"
                      value={q.correctAnswer || ''}
                      onChange={(e) => updateQuestion(realIdx, 'correctAnswer', e.target.value)}
                      style={isMissingAnswer ? { borderColor: 'var(--danger)' } : { borderColor: 'var(--success)' }}
                    >
                      <option value="">— Select answer —</option>
                      {q.options.map((opt, oi) => (
                        <option key={oi} value={opt}>{String.fromCharCode(65 + oi)}: {opt.substring(0, 40)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Difficulty</label>
                    <select className="select" value={q.difficulty || 'medium'}
                      onChange={(e) => updateQuestion(realIdx, 'difficulty', e.target.value)}>
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <input className="input" value={q.category || 'General'}
                      onChange={(e) => updateQuestion(realIdx, 'category', e.target.value)}
                      placeholder="e.g. Science" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
