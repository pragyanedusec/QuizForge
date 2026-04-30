import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { submitQuiz } from '../../services/api';

export default function QuizAttempt({ addToast }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { quiz, userName } = location.state || {};

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [questionTimeLeft, setQuestionTimeLeft] = useState(quiz?.timePerQuestion || 30);
  const [submitting, setSubmitting] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [flashRed, setFlashRed] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const timerRef = useRef(null);
  const submittedRef = useRef(false);

  const timePerQuestion = quiz?.timePerQuestion || 30;
  const questions = quiz?.questions || [];

  // Redirect if no quiz data
  useEffect(() => {
    if (!quiz) navigate('/quiz');
  }, [quiz, navigate]);

  // Warn before leaving page during active quiz
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!submittedRef.current) {
        e.preventDefault();
        e.returnValue = 'Your quiz progress will be lost if you leave. Are you sure?';
        return e.returnValue;
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Reset per-question timer whenever current question changes
  useEffect(() => {
    setQuestionTimeLeft(timePerQuestion);
    setShowWarning(false);
    setFlashRed(false);

    if (timerRef.current) clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setQuestionTimeLeft(prev => {
        if (prev <= 6 && prev > 5) setShowWarning(true);
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [current, timePerQuestion]);

  // Auto-advance when per-question timer hits 0
  useEffect(() => {
    if (questionTimeLeft === 0) {
      clearInterval(timerRef.current);
      setFlashRed(true);

      // Brief flash then advance
      setTimeout(() => {
        if (current < questions.length - 1) {
          setCurrent(c => c + 1);
        } else {
          // Last question — auto-submit
          handleSubmit();
        }
      }, 800);
    }
  }, [questionTimeLeft, current, questions.length]);

  // Dismiss warning
  useEffect(() => {
    if (showWarning) {
      const t = setTimeout(() => setShowWarning(false), 3000);
      return () => clearTimeout(t);
    }
  }, [showWarning]);

  // Submit quiz (actual submission)
  const handleSubmit = useCallback(async () => {
    if (submittedRef.current || submitting) return;
    submittedRef.current = true;
    setSubmitting(true);
    setShowConfirmModal(false);
    clearInterval(timerRef.current);

    try {
      const answerList = questions.map(q => ({
        questionId: q.questionId,
        selectedAnswer: answers[q.questionId] || null,
      }));

      const res = await submitQuiz({
        quizId: quiz.quizId,
        answers: answerList,
        userName,
      });

      navigate(`/quiz/result/${res.data.result.attemptId}`, { replace: true });
    } catch (err) {
      submittedRef.current = false;
      setSubmitting(false);
      addToast?.('Failed to submit quiz', 'error');
    }
  }, [quiz, answers, userName, navigate, addToast, submitting, questions]);

  // Request confirmation before submitting
  const requestSubmit = useCallback(() => {
    const unanswered = questions.filter(q => !answers[q.questionId]).length;
    if (unanswered > 0) {
      setShowConfirmModal(true);
    } else {
      handleSubmit();
    }
  }, [questions, answers, handleSubmit]);

  if (!quiz) return null;

  const q = questions[current];
  const answered = Object.keys(answers).length;
  const unanswered = questions.length - answered;
  const currentAnswered = !!answers[q?.questionId];
  const timerClass = questionTimeLeft <= 5 ? 'danger' : questionTimeLeft <= 10 ? 'warning' : '';

  // Circular progress for per-question timer
  const timerPercent = (questionTimeLeft / timePerQuestion) * 100;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>

      {/* Submit Confirmation Modal */}
      {showConfirmModal && (
        <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <div className="modal-title">⚠️ Submit Quiz?</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowConfirmModal(false)}>✕</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '.95rem', marginBottom: '1.25rem' }}>
              You have <strong style={{ color: 'var(--warning)' }}>{unanswered} unanswered</strong> question{unanswered !== 1 ? 's' : ''}.
              Unanswered questions will be marked as incorrect.
            </p>
            <div style={{ display: 'flex', gap: '.75rem' }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowConfirmModal(false)}>
                Go Back
              </button>
              <button className="btn btn-success" style={{ flex: 1 }} onClick={handleSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Submit Anyway'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fixed top bar */}
      <div className="quiz-top-bar" style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: 'rgba(17,24,39,.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border)', padding: '.75rem 2rem',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ fontSize: '.85rem', color: 'var(--text-secondary)' }}>
          <strong style={{ color: 'var(--text-primary)' }}>QuizForge</strong>
          {' · '}Q{current + 1}/{questions.length} · {answered} answered
          {unanswered > 0 && (
            <span style={{ color: 'var(--warning)', marginLeft: '.5rem' }}>· {unanswered} skipped</span>
          )}
        </div>

        {/* Per-question timer */}
        <div className="quiz-top-center" style={{ display: 'flex', alignItems: 'center', gap: '.75rem' }}>
          <div style={{
            position: 'relative', width: '44px', height: '44px',
          }}>
            <svg width="44" height="44" viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="22" cy="22" r="18" fill="none"
                stroke="var(--border)" strokeWidth="3" />
              <circle cx="22" cy="22" r="18" fill="none"
                stroke={questionTimeLeft <= 5 ? '#ef4444' : questionTimeLeft <= 10 ? '#f59e0b' : '#6366f1'}
                strokeWidth="3"
                strokeDasharray={`${2 * Math.PI * 18}`}
                strokeDashoffset={`${2 * Math.PI * 18 * (1 - timerPercent / 100)}`}
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s ease' }}
              />
            </svg>
            <div style={{
              position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '.8rem', fontWeight: 700, fontFamily: 'monospace',
              color: questionTimeLeft <= 5 ? '#ef4444' : questionTimeLeft <= 10 ? '#f59e0b' : 'var(--text-primary)',
            }}>
              {questionTimeLeft}
            </div>
          </div>
          <span style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>{timePerQuestion}s each</span>
        </div>

        <button className="btn btn-success btn-sm" onClick={requestSubmit} disabled={submitting}>
          {submitting ? 'Submitting...' : 'Submit Quiz'}
        </button>
      </div>

      {/* Time-up warning toast */}
      {showWarning && (
        <div style={{
          position: 'fixed', top: '70px', left: '50%', transform: 'translateX(-50%)', zIndex: 200,
          background: '#92400e', color: '#fef3c7', padding: '.75rem 1.5rem', borderRadius: 'var(--radius-md)',
          fontSize: '.85rem', fontWeight: 600, boxShadow: 'var(--shadow-lg)', animation: 'slide-up .3s ease',
        }}>
          ⚠ 5 seconds left for this question!
        </div>
      )}

      {/* Quiz content */}
      <div className="quiz-container" style={{ paddingTop: '80px' }}>
        {/* Overall progress bar */}
        <div style={{ height: '4px', background: 'var(--border)', borderRadius: '2px', marginBottom: '1.5rem', overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: 'var(--gradient-1)', borderRadius: '2px',
            width: `${(answered / questions.length) * 100}%`, transition: 'width .3s ease',
          }} />
        </div>

        {/* Question card */}
        <div className={`question-card slide-up ${flashRed ? 'flash-timeout' : ''}`} key={current}
          style={flashRed ? { borderColor: '#ef4444', boxShadow: '0 0 20px rgba(239,68,68,.2)' } : {}}>

          {/* Per-question time bar */}
          <div style={{ height: '3px', background: 'var(--border)', borderRadius: '2px', marginBottom: '1rem', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '2px',
              width: `${timerPercent}%`,
              background: questionTimeLeft <= 5 ? '#ef4444' : questionTimeLeft <= 10 ? '#f59e0b' : 'var(--accent)',
              transition: 'width 1s linear, background .3s ease',
            }} />
          </div>

          <div className="question-number">Question {current + 1} of {questions.length}</div>
          <div className="question-text">{q.question}</div>

          <div className="options-list">
            {q.options.map((opt, i) => {
              const isSelected = answers[q.questionId] === opt;
              return (
                <button key={i} className={`option-btn ${isSelected ? 'selected' : ''}`}
                  onClick={() => setAnswers(prev => ({ ...prev, [q.questionId]: opt }))}>
                  <span className="option-marker">{String.fromCharCode(65 + i)}</span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Question navigation grid */}
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', justifyContent: 'center', margin: '1.5rem 0' }}>
          {questions.map((_, i) => (
            <button key={i} className="btn btn-icon"
              style={{
                width: '34px', height: '34px', fontSize: '.75rem', fontWeight: 700,
                background: i === current ? 'var(--accent)' : answers[questions[i].questionId] ? 'rgba(99,102,241,.2)' : 'var(--bg-card)',
                color: i === current ? '#fff' : answers[questions[i].questionId] ? 'var(--accent)' : 'var(--text-muted)',
                border: `1px solid ${i === current ? 'var(--accent)' : 'var(--border)'}`,
              }}
              onClick={() => setCurrent(i)}>
              {i + 1}
            </button>
          ))}
        </div>

        {/* Prev / Next — Next is always enabled (skip allowed) */}
        <div className="quiz-nav">
          <button className="btn btn-secondary" disabled={current === 0}
            onClick={() => setCurrent(c => c - 1)}>← Previous</button>
          {current < questions.length - 1 ? (
            <button className="btn btn-primary"
              onClick={() => setCurrent(c => c + 1)}>
              {currentAnswered ? 'Next →' : 'Skip →'}
            </button>
          ) : (
            <button className="btn btn-success" onClick={requestSubmit} disabled={submitting}>
              {submitting ? 'Submitting...' : 'Submit Quiz'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
