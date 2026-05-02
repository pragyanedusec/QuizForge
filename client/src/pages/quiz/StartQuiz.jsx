import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { joinQuizByCode, startQuiz } from '../../services/api';

function OtpInput({ length = 6, value, onChange }) {
  const inputs = useRef([]);

  const handleChange = (i, val) => {
    const char = val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(-1);
    const newCode = value.split('');
    newCode[i] = char;
    const result = newCode.join('');
    onChange(result);
    if (char && i < length - 1) inputs.current[i + 1]?.focus();
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace' && !value[i] && i > 0) {
      inputs.current[i - 1]?.focus();
    }
  };

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, length);
    onChange(pasted.padEnd(length, ''));
    const focusIdx = Math.min(pasted.length, length - 1);
    inputs.current[focusIdx]?.focus();
  }, [length, onChange]);

  return (
    <div className="otp-container">
      {Array.from({ length }, (_, i) => (
        <input
          key={i}
          ref={el => inputs.current[i] = el}
          className={`otp-box ${value[i] ? 'filled' : ''}`}
          type="text"
          inputMode="text"
          maxLength={1}
          value={value[i] || ''}
          onChange={e => handleChange(i, e.target.value)}
          onKeyDown={e => handleKeyDown(i, e)}
          onPaste={handlePaste}
          autoFocus={i === 0}
        />
      ))}
    </div>
  );
}

export default function StartQuiz() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState('code');
  const [code, setCode] = useState('');
  const [userName, setUserName] = useState('');
  const [quizInfo, setQuizInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const autoJoinAttempted = useRef(false);

  // Auto-join if ?code= is in the URL (from QR scan)
  useEffect(() => {
    const urlCode = searchParams.get('code');
    if (urlCode && !autoJoinAttempted.current) {
      autoJoinAttempted.current = true;
      const cleaned = urlCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (cleaned.length >= 4) {
        setCode(cleaned);
        // Auto-join after a brief delay so the UI renders first
        setLoading(true);
        joinQuizByCode(cleaned)
          .then(res => {
            setQuizInfo(res.data.quiz);
            setStep('name');
          })
          .catch(err => {
            setError(err.response?.data?.error || 'Invalid quiz code from QR. Please enter manually.');
          })
          .finally(() => setLoading(false));
      }
    }
  }, [searchParams]);

  const handleJoin = async (e) => {
    e?.preventDefault();
    const trimmed = code.replace(/\s/g, '');
    if (trimmed.length < 4) return;
    setError('');
    setLoading(true);
    try {
      const res = await joinQuizByCode(trimmed);
      setQuizInfo(res.data.quiz);
      setStep('name');
    } catch (err) {
      if (err.response?.data?.error) {
        setError(err.response.data.error);
      } else if (!err.response) {
        setError('Network error — please hard-refresh the page (Ctrl+Shift+R) and try again.');
      } else {
        setError('Invalid quiz code. Please check and try again.');
      }
    }
    setLoading(false);
  };

  const handleStart = async () => {
    if (!userName.trim()) {
      setError('Please enter your name');
      return;
    }
    setStarting(true);
    setError('');
    try {
      const res = await startQuiz({
        userName: userName.trim(),
        userId: 'student_' + Date.now(),
        count: quizInfo.questionCount,
        difficulty: quizInfo.difficulty,
        category: quizInfo.category,
        timePerQuestion: quizInfo.timePerQuestion,
        quizCode: quizInfo.code,
      });
      navigate('/quiz/attempt', {
        state: { quiz: res.data.quiz, userName: userName.trim() },
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start quiz');
      setStarting(false);
    }
  };

  const totalTime = quizInfo ? Math.ceil(quizInfo.questionCount * quizInfo.timePerQuestion / 60) : 0;

  return (
    <div className="start-hero fade-in">
      <h1>
        {step === 'code'
          ? <>Enter <span className="gradient">Quiz Code</span></>
          : <>Ready to <span className="gradient">Begin</span>?</>
        }
      </h1>
      <p>
        {step === 'code'
          ? 'Enter the quiz code provided by your instructor to start.'
          : `You're about to take: ${quizInfo?.title}`
        }
      </p>

      <div className="config-card card">
        {step === 'code' ? (
          <form onSubmit={handleJoin}>
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ textAlign: 'center', marginBottom: '.75rem' }}>Quiz Code</label>
              <OtpInput length={6} value={code} onChange={setCode} />
            </div>

            {error && (
              <div style={{ padding: '.75rem', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '.85rem', marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading || code.replace(/\s/g, '').length < 4}>
              {loading ? 'Checking...' : 'Join Quiz →'}
            </button>
          </form>
        ) : (
          <div>
            <div style={{
              padding: '1.25rem', background: 'var(--bg-input)',
              borderRadius: 'var(--radius-sm)', marginBottom: '1.25rem',
            }}>
              <h3 style={{ fontWeight: 700, fontSize: '1.1rem', marginBottom: '.75rem' }}>
                {quizInfo.title}
              </h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '.5rem', fontSize: '.85rem', color: 'var(--text-secondary)' }}>
                <span>📝 {quizInfo.questionCount} questions</span>
                <span>⏱ {quizInfo.timePerQuestion}s per question</span>
                <span>⏳ ~{totalTime} min total</span>
                <span>🎯 {quizInfo.difficulty}</span>
                <span>👥 {quizInfo.totalAttempts || 0} student{(quizInfo.totalAttempts || 0) !== 1 ? 's' : ''} joined</span>
                {quizInfo.maxAttempts > 0 && <span>🔄 {quizInfo.maxAttempts} attempt{quizInfo.maxAttempts !== 1 ? 's' : ''} max</span>}
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Your Full Name</label>
              <input
                className="input"
                placeholder="Enter your name..."
                value={userName}
                onChange={e => setUserName(e.target.value)}
                autoFocus
              />
            </div>

            {error && (
              <div style={{ padding: '.75rem', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '.85rem', marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: '.75rem' }}>
              <button className="btn btn-secondary" onClick={() => { setStep('code'); setError(''); }}>
                ← Back
              </button>
              <button className="btn btn-primary btn-lg" style={{ flex: 1 }}
                onClick={handleStart} disabled={starting}>
                {starting ? 'Starting Quiz...' : 'Start Quiz →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
