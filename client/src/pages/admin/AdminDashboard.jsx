import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

/* Mini bar chart (pure CSS/SVG, no library) */
function BarChart({ data, height = 80 }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  const colors = { easy: '#22c55e', medium: '#f59e0b', hard: '#ef4444', General: '#6366f1' };
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: `${height + 24}px` }}>
      {data.map((d, i) => {
        const pct = (d.value / max) * height;
        const color = colors[d.label] || `hsl(${(i * 60 + 200) % 360}, 70%, 55%)`;
        return (
          <div key={d.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, gap: '4px' }}>
            <span style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--text-secondary)' }}>{d.value}</span>
            <div style={{
              width: '100%', height: `${pct}px`, background: color, borderRadius: '4px 4px 0 0',
              transition: 'height .6s cubic-bezier(.34,1.56,.64,1)',
              minHeight: d.value > 0 ? '4px' : '0',
            }} />
            <span style={{ fontSize: '.68rem', color: 'var(--text-muted)', textAlign: 'center', wordBreak: 'break-word' }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

/* Mini donut chart (SVG) */
function DonutChart({ segments, size = 80 }) {
  if (!segments || segments.length === 0) return null;
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) return null;
  const r = 28, cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const colors = ['#22c55e', '#f59e0b', '#ef4444', '#6366f1', '#06b6d4'];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {segments.map((seg, i) => {
        const dash = (seg.value / total) * circumference;
        const gap = circumference - dash;
        const el = (
          <circle key={seg.label} cx={cx} cy={cy} r={r}
            fill="none"
            stroke={colors[i % colors.length]}
            strokeWidth={10}
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        );
        offset += dash;
        return el;
      })}
      <circle cx={cx} cy={cy} r={r - 6} fill="var(--bg-card)" />
    </svg>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    getAdminStats()
      .then(res => setStats(res.data.stats))
      .catch(() => setStats(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  const diffMap = {};
  (stats?.difficultyBreakdown || []).forEach(d => { diffMap[d._id] = d.count; });

  const diffChartData = ['easy', 'medium', 'hard']
    .map(d => ({ label: d.charAt(0).toUpperCase() + d.slice(1), value: diffMap[d] || 0 }))
    .filter(d => d.value > 0);

  const catChartData = (stats?.categoryBreakdown || [])
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .map(c => ({ label: c._id, value: c.count }));

  const donutSegments = (stats?.categoryBreakdown || []).map(c => ({ label: c._id, value: c.count }));

  // Average score from template analytics
  const avgScore = stats?.templateAnalytics?.length > 0
    ? Math.round(stats.templateAnalytics.reduce((s, t) => s + t.avgScore, 0) / stats.templateAnalytics.length)
    : null;

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

      {/* Quick Actions */}
      <div className="quick-actions" style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        {[
          { icon: '📄', label: 'Upload PDF', to: '/admin/upload', color: 'var(--accent)' },
          { icon: '❓', label: 'Questions', to: '/admin/questions', color: 'var(--success)' },
          { icon: '📝', label: 'Create Quiz', to: '/admin/quizzes', color: 'var(--warning)' },
          { icon: '📊', label: 'Reports', to: '/admin/reports', color: '#06b6d4' },
        ].map(({ icon, label, to, color }) => (
          <button key={to} onClick={() => navigate(to)}
            style={{
              display: 'flex', alignItems: 'center', gap: '.5rem',
              padding: '.6rem 1.1rem', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-card)', border: `1px solid var(--border)`,
              color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font)',
              fontSize: '.85rem', fontWeight: 600, transition: 'all .2s',
              outline: 'none',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = color; e.currentTarget.style.color = color; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          >
            <span>{icon}</span> {label}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="stats-grid" style={{ marginBottom: '2rem' }}>
        <div className="stat-card">
          <div className="stat-value"><CountUp target={stats?.totalQuestions || 0} /></div>
          <div className="stat-label">Total Questions</div>
        </div>
        <div className="stat-card success">
          <div className="stat-value"><CountUp target={diffMap.easy || 0} /></div>
          <div className="stat-label">Easy</div>
        </div>
        <div className="stat-card warning">
          <div className="stat-value"><CountUp target={diffMap.medium || 0} /></div>
          <div className="stat-label">Medium</div>
        </div>
        <div className="stat-card danger">
          <div className="stat-value"><CountUp target={diffMap.hard || 0} /></div>
          <div className="stat-label">Hard</div>
        </div>
        <div className="stat-card">
          <div className="stat-value"><CountUp target={stats?.totalAttempts || 0} /></div>
          <div className="stat-label">Total Attempts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value"><CountUp target={stats?.categoryBreakdown?.length || 0} /></div>
          <div className="stat-label">Categories</div>
        </div>
        {avgScore !== null && (
          <div className="stat-card" style={{ gridColumn: 'span 1' }}>
            <div className="stat-value" style={{ color: avgScore >= 70 ? 'var(--success)' : avgScore >= 40 ? 'var(--warning)' : 'var(--danger)' }}>
              <CountUp target={avgScore} />%
            </div>
            <div className="stat-label">Platform Avg Score</div>
          </div>
        )}
      </div>

      {/* Charts Row */}
      {(diffChartData.length > 0 || catChartData.length > 0) && (
        <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>

          {/* Difficulty breakdown */}
          {diffChartData.length > 0 && (
            <div className="card">
              <div className="card-header" style={{ marginBottom: '1.25rem' }}>
                <h2 className="card-title">📊 Difficulty Breakdown</h2>
              </div>
              <BarChart data={diffChartData} height={90} />
            </div>
          )}

          {/* Category breakdown */}
          {catChartData.length > 0 && (
            <div className="card">
              <div className="card-header" style={{ marginBottom: '1rem' }}>
                <h2 className="card-title">🗂 Category Spread</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <DonutChart segments={donutSegments} size={90} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                  {donutSegments.slice(0, 5).map((seg, i) => {
                    const colors = ['#22c55e', '#f59e0b', '#ef4444', '#6366f1', '#06b6d4'];
                    return (
                      <div key={seg.label} style={{ display: 'flex', alignItems: 'center', gap: '.4rem', fontSize: '.8rem' }}>
                        <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: colors[i], flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-secondary)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.label}</span>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{seg.value}</span>
                      </div>
                    );
                  })}
                  {donutSegments.length > 5 && (
                    <div style={{ fontSize: '.75rem', color: 'var(--text-muted)' }}>+{donutSegments.length - 5} more</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Template performance */}
          {stats?.templateAnalytics?.length > 0 && (
            <div className="card">
              <div className="card-header" style={{ marginBottom: '1rem' }}>
                <h2 className="card-title">🏆 Top Quizzes</h2>
              </div>
              <BarChart
                data={stats.templateAnalytics.slice(0, 5).map(t => ({ label: t.quizCode, value: t.avgScore }))}
                height={80}
              />
              <div style={{ fontSize: '.75rem', color: 'var(--text-muted)', marginTop: '.5rem', textAlign: 'center' }}>
                Average score per quiz (%)
              </div>
            </div>
          )}
        </div>
      )}

      {/* Categories tags */}
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

      {/* Recent attempts */}
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
          <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/admin/upload')}>
            Upload PDF →
          </button>
        </div>
      )}
    </div>
  );
}
