import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { joinQuizByCode, startQuiz } from '../../services/api';

export default function StartQuiz() {
  const navigate = useNavigate();
  const [step, setStep] = useState('code'); // 'code' → 'name' → start
  const [code, setCode] = useState('');
  const [userName, setUserName] = useState('');
  const [quizInfo, setQuizInfo] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);

  // Step 1: Enter quiz code
  const handleJoin = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError('');
    setLoading(true);
    try {
      const res = await joinQuizByCode(code.trim());
      setQuizInfo(res.data.quiz);
      setStep('name');
    } catch (err) {
      setError(err.response?.data?.error || 'Invalid quiz code');
    }
    setLoading(false);
  };

  // Step 2: Enter name and start
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
        quizCode: quizInfo.code,  // link session to template
      });
      navigate('/quiz/attempt', {
        state: {
          quiz: res.data.quiz,
          userName: userName.trim(),
        },
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
          /* ── Step 1: Enter Code ── */
          <form onSubmit={handleJoin}>
            <div className="form-group" style={{ marginBottom: '1.25rem' }}>
              <label className="form-label">Quiz Code</label>
              <input
                className="input"
                placeholder="e.g. A3B7K9"
                value={code}
                onChange={e => setCode(e.target.value.toUpperCase())}
                autoFocus
                maxLength={6}
                style={{
                  textAlign: 'center', fontSize: '1.8rem', fontWeight: 800,
                  letterSpacing: '.2em', fontFamily: 'monospace',
                }}
              />
            </div>

            {error && (
              <div style={{ padding: '.75rem', background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-sm)', color: 'var(--danger)', fontSize: '.85rem', marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <button className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading || code.length < 4}>
              {loading ? 'Checking...' : 'Join Quiz →'}
            </button>
          </form>
        ) : (
          /* ── Step 2: Quiz Info + Name ── */
          <div>
            {/* Quiz details */}
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
              </div>
            </div>

            {/* Name input */}
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
