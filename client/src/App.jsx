import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/admin/AdminDashboard';
import UploadPDF from './pages/admin/UploadPDF';
import ManageQuestions from './pages/admin/ManageQuestions';
import CreateQuiz from './pages/admin/CreateQuiz';
import QuizReports from './pages/admin/QuizReports';
import StartQuiz from './pages/quiz/StartQuiz';
import QuizAttempt from './pages/quiz/QuizAttempt';
import QuizResult from './pages/quiz/QuizResult';
import Leaderboard from './pages/quiz/Leaderboard';
import Toast from './components/Toast';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="loading-screen"><div className="spinner" /></div>;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function AppContent() {
  const location = useLocation();
  const { isAuthenticated, admin, logout } = useAuth();
  const [toasts, setToasts] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const isQuizActive = location.pathname === '/quiz/attempt';

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Prevent body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const addToast = (message, type = 'success') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  const navLinks = (
    <>
      {isAuthenticated && (
        <>
          <NavLink to="/" end className={({ isActive }) => isActive ? 'active' : ''}>
            Dashboard
          </NavLink>
          <NavLink to="/admin/upload" className={({ isActive }) => isActive ? 'active' : ''}>
            Upload PDF
          </NavLink>
          <NavLink to="/admin/questions" className={({ isActive }) => isActive ? 'active' : ''}>
            Questions
          </NavLink>
          <NavLink to="/admin/quizzes" className={({ isActive }) => isActive ? 'active' : ''}>
            Create Quiz
          </NavLink>
          <NavLink to="/admin/reports" className={({ isActive }) => isActive ? 'active' : ''}>
            Reports
          </NavLink>
        </>
      )}
      <NavLink to="/quiz" className={({ isActive }) => isActive ? 'active' : ''}>
        Take Quiz
      </NavLink>
      <NavLink to="/leaderboard" className={({ isActive }) => isActive ? 'active' : ''}>
        Leaderboard
      </NavLink>
      {isAuthenticated ? (
        <button onClick={logout} style={{ color: 'var(--text-muted)' }}>
          Logout ({admin?.name})
        </button>
      ) : (
        <NavLink to="/login" className={({ isActive }) => isActive ? 'active' : ''}>
          Admin Login
        </NavLink>
      )}
    </>
  );

  return (
    <div className="app-layout">
      {!isQuizActive && location.pathname !== '/login' && (
        <nav className="navbar">
          <NavLink to="/" className="navbar-brand">
            <div className="logo-icon">⚡</div>
            <span>QuizForge</span>
          </NavLink>

          {/* Desktop nav */}
          <div className="navbar-nav">
            {navLinks}
          </div>

          {/* Mobile hamburger */}
          <button
            className={`hamburger ${menuOpen ? 'open' : ''}`}
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <span /><span /><span />
          </button>

          {/* Mobile nav overlay */}
          <div className={`mobile-nav-overlay ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(false)} />
          <div className={`mobile-nav ${menuOpen ? 'open' : ''}`}>
            {navLinks}
          </div>
        </nav>
      )}

      <main className={location.pathname === '/login' ? '' : 'main-content'}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/upload" element={<ProtectedRoute><UploadPDF addToast={addToast} /></ProtectedRoute>} />
          <Route path="/admin/questions" element={<ProtectedRoute><ManageQuestions addToast={addToast} /></ProtectedRoute>} />
          <Route path="/admin/quizzes" element={<ProtectedRoute><CreateQuiz addToast={addToast} /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute><QuizReports addToast={addToast} /></ProtectedRoute>} />
          <Route path="/quiz" element={<StartQuiz />} />
          <Route path="/quiz/attempt" element={<QuizAttempt addToast={addToast} />} />
          <Route path="/quiz/result/:id" element={<QuizResult />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </main>

      <Toast toasts={toasts} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
