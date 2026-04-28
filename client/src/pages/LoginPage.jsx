import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authLogin, authRegister } from '../services/api';

export default function LoginPage() {
  const registrationEnabled = import.meta.env.VITE_ALLOW_ADMIN_REGISTRATION === 'true';
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ email: '', password: '', name: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = isLogin
        ? await authLogin({ email: form.email, password: form.password })
        : await authRegister(form);
      login(res.data.token, res.data.admin);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ width: '56px', height: '56px', background: 'var(--gradient-1)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', margin: '0 auto 1rem', boxShadow: 'var(--shadow-glow)' }}>⚡</div>
          <h1 style={{ fontSize: '1.8rem', fontWeight: 800, letterSpacing: '-.02em' }}>QuizForge</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '.25rem', fontSize: '.9rem' }}>
            {isLogin ? 'Sign in to admin panel' : 'Create admin account'}
          </p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit}>
            {!isLogin && (
              <div className="form-group" style={{ marginBottom: '1rem' }}>
                <label className="form-label">Full Name</label>
                <input className="input" placeholder="John Doe" value={form.name}
                  onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required={!isLogin} />
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label">Email</label>
              <input className="input" type="email" placeholder="admin@example.com" value={form.email}
                onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} required />
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPassword ? 'text' : 'password'} placeholder="••••••••" value={form.password}
                  onChange={(e) => setForm(f => ({ ...f, password: e.target.value }))} required minLength={6}
                  style={{ paddingRight: '3rem' }} />
                <button type="button" onClick={() => setShowPassword(s => !s)}
                  style={{
                    position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px',
                    color: 'var(--text-muted)', fontSize: '1rem', lineHeight: 1,
                  }}>
                  {showPassword ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ padding: '.75rem', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '.85rem', marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {registrationEnabled && (
            <div style={{ textAlign: 'center', marginTop: '1.25rem' }}>
              <button className="btn btn-ghost" onClick={() => { setIsLogin(!isLogin); setError(''); }}>
                {isLogin ? "Don't have an account? Register" : 'Already have an account? Sign In'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
