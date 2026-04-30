import { useState, useEffect } from 'react';
import { getTenantSettings, updateTenantSettings } from '../../services/api';

function Toggle({ label, description, checked, onChange }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      padding: '1rem 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ flex: 1, paddingRight: '1rem' }}>
        <div style={{ fontWeight: 600, fontSize: '.95rem', marginBottom: '.2rem' }}>{label}</div>
        {description && <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{description}</div>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        style={{
          width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer',
          background: checked ? 'var(--accent)' : 'var(--border)',
          position: 'relative', transition: 'background .2s', flexShrink: 0,
        }}
        role="switch"
        aria-checked={checked}
      >
        <div style={{
          position: 'absolute', top: '3px',
          left: checked ? '23px' : '3px',
          width: '18px', height: '18px', borderRadius: '50%',
          background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)',
        }} />
      </button>
    </div>
  );
}

function NumberSetting({ label, description, value, onChange, min = 1, max = 300, unit = '' }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '1rem 0', borderBottom: '1px solid var(--border)', flexWrap: 'wrap', gap: '.5rem',
    }}>
      <div style={{ flex: 1, paddingRight: '1rem' }}>
        <div style={{ fontWeight: 600, fontSize: '.95rem', marginBottom: '.2rem' }}>{label}</div>
        {description && <div style={{ fontSize: '.8rem', color: 'var(--text-muted)' }}>{description}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexShrink: 0 }}>
        <input
          type="number"
          className="input"
          style={{ width: '80px', textAlign: 'center' }}
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(parseInt(e.target.value) || min)}
        />
        {unit && <span style={{ fontSize: '.85rem', color: 'var(--text-muted)' }}>{unit}</span>}
      </div>
    </div>
  );
}

export default function TenantSettings({ addToast }) {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getTenantSettings()
      .then(res => setSettings(res.data.settings))
      .catch(() => addToast?.('Failed to load settings', 'error'))
      .finally(() => setLoading(false));
  }, []);

  const update = (key, value) => {
    setSettings(s => ({ ...s, [key]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await updateTenantSettings(settings);
      setSettings(res.data.settings);
      setDirty(false);
      addToast?.('Settings saved successfully', 'success');
    } catch (err) {
      addToast?.(err.response?.data?.error || 'Failed to save settings', 'error');
    }
    setSaving(false);
  };

  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  if (!settings) return <div className="empty-state"><div className="icon">⚠️</div><p>Could not load settings.</p></div>;

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>⚙️ Settings</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '.25rem' }}>
            Configure your QuizForge instance behaviour
          </p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !dirty}>
          {saving ? 'Saving...' : dirty ? 'Save Changes' : 'Saved ✓'}
        </button>
      </div>

      {/* Quiz Defaults */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="card-title" style={{ marginBottom: '.25rem' }}>📋 Quiz Defaults</h2>
        <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Default values used when students take a free quiz (without a quiz code).
        </p>
        <NumberSetting
          label="Default Question Count"
          description="How many questions per quiz by default"
          value={settings.defaultQuestionCount}
          onChange={v => update('defaultQuestionCount', v)}
          min={1} max={100}
          unit="questions"
        />
        <NumberSetting
          label="Default Time per Question"
          description="Seconds allowed per question by default"
          value={settings.defaultTimePerQuestion}
          onChange={v => update('defaultTimePerQuestion', v)}
          min={5} max={300}
          unit="seconds"
        />
      </div>

      {/* Feature Toggles */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="card-title" style={{ marginBottom: '1rem' }}>🔧 Feature Toggles</h2>
        <Toggle
          label="Shuffle Answer Options"
          description="Randomize the order of answer choices each session"
          checked={settings.shuffleOptions}
          onChange={v => update('shuffleOptions', v)}
        />
        <Toggle
          label="Leaderboard Enabled"
          description="Show the leaderboard to students after completing a quiz"
          checked={settings.leaderboardEnabled}
          onChange={v => update('leaderboardEnabled', v)}
        />
        <Toggle
          label="Timer Enabled"
          description="Enforce per-question time limits during quizzes"
          checked={settings.timerEnabled}
          onChange={v => update('timerEnabled', v)}
        />
        <Toggle
          label="Show Correct Answers"
          description="Let students see which answers were correct after submission"
          checked={settings.showCorrectAnswers}
          onChange={v => update('showCorrectAnswers', v)}
        />
        <Toggle
          label="Allow Retakes"
          description="Allow students to take the same quiz again (subject to maxAttempts)"
          checked={settings.allowRetake}
          onChange={v => update('allowRetake', v)}
        />
        <Toggle
          label="Gamification"
          description="Enable badges and achievement system (future feature)"
          checked={settings.gamificationEnabled}
          onChange={v => update('gamificationEnabled', v)}
        />
      </div>

      {/* Security */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h2 className="card-title" style={{ marginBottom: '1rem' }}>🔒 Security & Anti-Cheat</h2>
        <Toggle
          label="Anti-Cheat Mode"
          description="Expire any previous in-progress session when a student starts a new one"
          checked={settings.antiCheat}
          onChange={v => update('antiCheat', v)}
        />
        <NumberSetting
          label="Global Max Attempts"
          description="Maximum attempts across all quizzes (0 = unlimited, overridden per-quiz)"
          value={settings.maxAttempts}
          onChange={v => update('maxAttempts', v)}
          min={0} max={100}
          unit={settings.maxAttempts === 0 ? '(unlimited)' : 'attempts'}
        />
      </div>

      {dirty && (
        <div style={{
          position: 'fixed', bottom: '2rem', right: '2rem', zIndex: 200,
          background: 'var(--accent)', color: '#fff', padding: '.85rem 1.5rem',
          borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)',
          display: 'flex', gap: '.75rem', alignItems: 'center',
        }}>
          <span style={{ fontSize: '.9rem', fontWeight: 600 }}>Unsaved changes</span>
          <button
            onClick={handleSave} disabled={saving}
            style={{ background: '#fff', color: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-sm)', padding: '.4rem .9rem', fontWeight: 700, cursor: 'pointer' }}
          >
            {saving ? '...' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
