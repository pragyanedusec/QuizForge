import { useState, useEffect, useRef } from 'react';
import { getAdminStats } from '../../services/api';

function CountUp({ target, duration = 1000 }) {
  const [value, setValue] = useState(0);
  const ref = useRef();

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const animate = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) ref.current = requestAnimationFrame(animate);
    };
    ref.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(ref.current);
  }, [target, duration]);

  return <>{value}</>;
}

function DashboardSkeleton() {
  return (
    <div className="fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <div className="skeleton skeleton-heading" />
        <div className="skeleton skeleton-text short" />
      </div>
      <div className="stats-grid">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton skeleton-stat" />
        ))}
      </div>
      <div className="skeleton-card">
        <div className="skeleton skeleton-heading" style={{ width: '30%' }} />
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton" style={{ width: '80px', height: '28px', borderRadius: '20px' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats()
      .then(res => setStats(res.data.stats))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  const diffMap = {};
  (stats?.difficultyBreakdown || []).forEach(d => { diffMap[d._id] = d.count; });

  return (
    <div className="fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-.02em' }}>
          Dashboard
        </h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '.25rem' }}>
          Overview of your QuizForge instance
        </p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value"><CountUp target={stats?.totalQuestions || 0} /></div>
          <div className="stat-label">Total Questions</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value"><CountUp target={diffMap.easy || 0} /></div>
          <div className="stat-label">Easy Questions</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value"><CountUp target={diffMap.medium || 0} /></div>
          <div className="stat-label">Medium Questions</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-value"><CountUp target={diffMap.hard || 0} /></div>
          <div className="stat-label">Hard Questions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value"><CountUp target={stats?.totalAttempts || 0} /></div>
          <div className="stat-label">Total Attempts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value"><CountUp target={stats?.categoryBreakdown?.length || 0} /></div>
          <div className="stat-label">Categories</div>
        </div>
      </div>

      {stats?.categoryBreakdown?.length > 0 && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h2 className="card-title">Categories</h2>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem' }}>
            {stats.categoryBreakdown.map(c => (
              <span key={c._id} className="badge badge-info">
                {c._id} ({c.count})
              </span>
            ))}
          </div>
        </div>
      )}

      {stats?.recentAttempts?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Attempts</h2>
          </div>
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Score</th>
                  <th>Percentage</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentAttempts.map(a => (
                  <tr key={a._id}>
                    <td style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                      {a.userName}
                    </td>
                    <td>{a.score}/{a.totalQuestions}</td>
                    <td>
                      <span className={`badge ${a.percentage >= 70 ? 'badge-easy' : a.percentage >= 40 ? 'badge-medium' : 'badge-hard'}`}>
                        {a.percentage}%
                      </span>
                    </td>
                    <td>{new Date(a.submissionTime).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!stats?.totalQuestions && (
        <div className="empty-state">
          <div className="icon">📋</div>
          <p>No questions yet. Upload a PDF to get started!</p>
        </div>
      )}
    </div>
  );
}
