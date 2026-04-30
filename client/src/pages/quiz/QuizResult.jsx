import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getResult } from '../../services/api';
import Confetti from '../../components/Confetti';

function AnimatedScore({ target, duration = 1200 }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef();

  useEffect(() => {
    const start = performance.now();
    const animate = (now) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);

  return <>{display}%</>;
}

export default function QuizResult() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAnswers, setShowAnswers] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    getResult(id)
      .then(res => {
        setResult(res.data.result);
        setShowAnswers(res.data.result.showCorrectAnswers !== false);
      })
      .catch(() => navigate('/quiz'))
      .finally(() => setLoading(false));
  }, [id, navigate]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2500);
  };

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /><p>Loading results...</p></div>;
  }
  if (!result) return null;

  const grade = result.percentage >= 80 ? '🏆 Excellent!' :
    result.percentage >= 60 ? '👏 Good Job!' :
    result.percentage >= 40 ? '💪 Keep Trying!' : '📚 Study More!';

  const gradeColor = result.percentage >= 80 ? 'var(--success)' :
    result.percentage >= 60 ? 'var(--accent)' :
    result.percentage >= 40 ? 'var(--warning)' : 'var(--danger)';

  const minutes = Math.floor(result.timeTaken / 60);
  const seconds = result.timeTaken % 60;

  return (
    <div className="quiz-container fade-in">
      <Confetti trigger={result.percentage >= 70} />

      <div className="result-hero">
        <div className="result-score" style={{ animation: 'count-pop .6s ease .3s both' }}>
          <AnimatedScore target={result.percentage} />
        </div>
        <div className="result-label" style={{ fontSize: '1.3rem', color: gradeColor, fontWeight: 700 }}>
          {grade}
        </div>
        <p style={{ color: 'var(--text-muted)', marginTop: '.5rem' }}>
          {result.userName || 'Anonymous'}
        </p>

        <div className="result-details">
          <div className="stat-card" style={{ textAlign: 'center' }}>
            <div className="stat-value" style={{ fontSize: '1.5rem' }}>{result.score}/{result.totalQuestions}</div>
            <div className="stat-label">Correct</div>
          </div>
          <div className="stat-card" style={{ textAlign: 'center' }}>
            <div className="stat-value" style={{ fontSize: '1.5rem' }}>
              {result.totalQuestions - result.score}
            </div>
            <div className="stat-label">Incorrect</div>
          </div>
          <div className="stat-card" style={{ textAlign: 'center' }}>
            <div className="stat-value" style={{ fontSize: '1.5rem' }}>
              {minutes}:{String(seconds).padStart(2, '0')}
            </div>
            <div className="stat-label">Time Taken</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '.75rem', justifyContent: 'center', marginBottom: '2rem', flexWrap: 'wrap', padding: '0 .5rem' }}>
        <button className="btn btn-primary" onClick={() => navigate('/quiz')}>
          Take Another Quiz
        </button>
        {result.showCorrectAnswers !== false && (
          <button className="btn btn-secondary" onClick={() => setShowAnswers(s => !s)}>
            {showAnswers ? 'Hide Answers' : 'Review Answers'}
          </button>
        )}
        <button className="btn btn-secondary" onClick={() => navigate('/leaderboard')}>
          Leaderboard
        </button>
        <button
          className="btn btn-ghost"
          onClick={handleCopyLink}
          style={{ borderColor: linkCopied ? 'var(--success)' : undefined, color: linkCopied ? 'var(--success)' : undefined }}
        >
          {linkCopied ? '✓ Link Copied!' : '🔗 Share Result'}
        </button>
      </div>

      {result.showCorrectAnswers === false && (
        <div className="card" style={{ marginBottom: '1rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>
            Correct answers are hidden for this quiz.
          </p>
        </div>
      )}

      {showAnswers && result.answers?.map((a, idx) => (
        <div key={idx} className="question-card" style={{
          marginBottom: '.75rem',
          borderColor: a.isCorrect ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)',
        }}>
          <div className="question-number" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Question {idx + 1}</span>
            {a.isCorrect ? (
              <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓ Correct</span>
            ) : (
              <span style={{ color: 'var(--danger)', fontWeight: 700 }}>✕ Incorrect</span>
            )}
          </div>

          <div className="question-text" style={{ fontSize: '1rem' }}>{a.question}</div>

          {a.options?.length > 0 ? (
            <div className="options-list">
              {a.options.map((opt, i) => {
                let cls = '';
                if (opt === a.correctAnswer) cls = 'correct';
                else if (opt === a.selectedAnswer && !a.isCorrect) cls = 'incorrect';
                return (
                  <div key={i} className={`option-btn ${cls}`} style={{ cursor: 'default' }}>
                    <span className="option-marker">{String.fromCharCode(65 + i)}</span>
                    <span style={{ flex: 1 }}>{opt}</span>
                    {opt === a.correctAnswer && (
                      <span style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--success)', flexShrink: 0 }}>
                        ✓ Correct
                      </span>
                    )}
                    {opt === a.selectedAnswer && !a.isCorrect && (
                      <span style={{ fontSize: '.75rem', fontWeight: 700, color: 'var(--danger)', flexShrink: 0 }}>
                        Your answer
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ marginTop: '.5rem' }}>
              {!a.isCorrect && a.selectedAnswer && (
                <p style={{ fontSize: '.85rem', color: 'var(--danger)', marginBottom: '.4rem' }}>
                  ✕ Your answer: <strong>{a.selectedAnswer}</strong>
                </p>
              )}
              <p style={{ fontSize: '.85rem', color: 'var(--success)' }}>
                ✓ Correct answer: <strong>{a.correctAnswer}</strong>
              </p>
            </div>
          )}

          {!a.isCorrect && (
            <div style={{
              marginTop: '.75rem', padding: '.6rem 1rem',
              background: 'rgba(34,197,94,.08)', borderRadius: 'var(--radius-sm)',
              borderLeft: '3px solid var(--success)',
            }}>
              <span style={{ fontSize: '.85rem', color: 'var(--success)', fontWeight: 600 }}>
                ✓ Correct answer: {a.correctAnswer}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
