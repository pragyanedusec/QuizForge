import { useState, useEffect } from 'react';
import { getAdminStats } from '../../services/api';

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStats()
      .then(res => setStats(res.data.stats))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

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
          <div className="stat-value">{stats?.totalQuestions || 0}</div>
          <div className="stat-label">Total Questions</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value">{diffMap.easy || 0}</div>
          <div className="stat-label">Easy Questions</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value">{diffMap.medium || 0}</div>
          <div className="stat-label">Medium Questions</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-value">{diffMap.hard || 0}</div>
          <div className="stat-label">Hard Questions</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.totalAttempts || 0}</div>
          <div className="stat-label">Total Attempts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.categoryBreakdown?.length || 0}</div>
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
