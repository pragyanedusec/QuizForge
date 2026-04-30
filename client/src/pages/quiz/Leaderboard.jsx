import { useState, useEffect } from 'react';
import { getLeaderboard } from '../../services/api';

function LeaderboardSkeleton() {
  return (
    <div className="fade-in" style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <div className="skeleton skeleton-heading" style={{ width: '50%', margin: '0 auto 8px' }} />
        <div className="skeleton skeleton-text" style={{ width: '40%', margin: '0 auto' }} />
      </div>
      <div className="skeleton-card" style={{ padding: 0 }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="skeleton-row">
            <div className="skeleton" style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0 }} />
            <div className="skeleton skeleton-text" style={{ flex: 1, marginBottom: 0 }} />
            <div className="skeleton" style={{ width: '48px', height: '14px' }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Leaderboard() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [quizCodeInput, setQuizCodeInput] = useState('');
  const [filteredCode, setFilteredCode] = useState('');
  const [error, setError] = useState('');

  const fetchLeaderboard = async (code = '') => {
    setLoading(true);
    setError('');
    try {
      const params = code ? { quizCode: code.toUpperCase() } : {};
      const res = await getLeaderboard(params);
      if (res.data.disabled) {
        setEntries([]);
        setError('Leaderboard is disabled for this quiz.');
      } else {
        setEntries(res.data.leaderboard);
        if (code && res.data.leaderboard.length === 0) {
          setError(`No attempts found for quiz code "${code.toUpperCase()}".`);
        }
      }
    } catch {
      setError('Failed to load leaderboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const handleFilter = (e) => {
    e.preventDefault();
    const code = quizCodeInput.trim();
    setFilteredCode(code);
    fetchLeaderboard(code);
  };

  const handleClear = () => {
    setQuizCodeInput('');
    setFilteredCode('');
    fetchLeaderboard('');
  };

  if (loading) return <LeaderboardSkeleton />;

  return (
    <div className="fade-in" style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>🏆 Leaderboard</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          {filteredCode
            ? `Results for quiz "${filteredCode}"`
            : 'Top performers across all quizzes'}
        </p>
      </div>

      {/* Quiz code filter */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <form onSubmit={handleFilter} style={{ display: 'flex', gap: '.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ flex: 1, minWidth: '160px', marginBottom: 0 }}>
            <label className="form-label">Filter by Quiz Code</label>
            <input
              className="input"
              placeholder="Enter quiz code (e.g. ABC123)"
              value={quizCodeInput}
              onChange={e => setQuizCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
              maxLength={6}
              style={{ fontFamily: 'monospace', letterSpacing: '.08em', textTransform: 'uppercase' }}
            />
          </div>
          <button className="btn btn-primary btn-sm" type="submit" disabled={!quizCodeInput.trim()}>
            Filter
          </button>
          {filteredCode && (
            <button className="btn btn-ghost btn-sm" type="button" onClick={handleClear}>
              ✕ Show All
            </button>
          )}
        </form>
      </div>

      {error ? (
        <div className="empty-state">
          <div className="icon">🔍</div>
          <p>{error}</p>
        </div>
      ) : entries.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🏅</div>
          <p>No attempts yet. Be the first to take a quiz!</p>
          <a href="/quiz" className="btn btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
            Take a Quiz →
          </a>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {entries.map((e, i) => (
            <div key={e._id} className="leaderboard-item">
              <div className={`leaderboard-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div className="leaderboard-name">{e.userName}</div>
                {e.quizCode && (
                  <div style={{ fontSize: '.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                    {e.quizCode}
                  </div>
                )}
              </div>
              <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', minWidth: '50px', textAlign: 'center' }}>
                {e.score}/{e.totalQuestions}
              </div>
              <div className="leaderboard-score">{e.percentage}%</div>
              <div className="leaderboard-time" style={{ fontSize: '.75rem', color: 'var(--text-muted)', minWidth: '60px', textAlign: 'right' }}>
                {Math.floor(e.timeTaken / 60)}:{String(e.timeTaken % 60).padStart(2, '0')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
