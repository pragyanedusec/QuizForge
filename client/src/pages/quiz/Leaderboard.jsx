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

  useEffect(() => {
    getLeaderboard()
      .then(res => setEntries(res.data.leaderboard))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LeaderboardSkeleton />;

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
