import { useState, useEffect } from 'react';
import { getLeaderboard } from '../../services/api';

export default function Leaderboard() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLeaderboard()
      .then(res => setEntries(res.data.leaderboard))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading-screen"><div className="spinner" /><p>Loading leaderboard...</p></div>;
  }

  return (
    <div className="fade-in" style={{ maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>🏆 Leaderboard</h1>
        <p style={{ color: 'var(--text-muted)' }}>Top performers across all quizzes</p>
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          <div className="icon">🏅</div>
          <p>No attempts yet. Be the first to take a quiz!</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {entries.map((e, i) => (
            <div key={e._id} className="leaderboard-item">
              <div className={`leaderboard-rank ${i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : ''}`}>
                {i + 1}
              </div>
              <div className="leaderboard-name">{e.userName}</div>
              <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>
                {e.score}/{e.totalQuestions}
              </div>
              <div className="leaderboard-score">{e.percentage}%</div>
              <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', minWidth: '60px', textAlign: 'right' }}>
                {Math.floor(e.timeTaken / 60)}:{String(e.timeTaken % 60).padStart(2, '0')}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
