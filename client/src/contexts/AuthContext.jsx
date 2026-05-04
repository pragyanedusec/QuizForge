import { createContext, useContext, useState, useEffect } from 'react';
import { authMe } from '../services/api';

const AuthContext = createContext(null);

// Safe JSON.parse — returns null if value is missing, "undefined", or malformed
function safeParse(key) {
  try {
    const val = localStorage.getItem(key);
    if (!val || val === 'undefined' || val === 'null') return null;
    return JSON.parse(val);
  } catch {
    localStorage.removeItem(key); // wipe corrupted data
    return null;
  }
}

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(() => safeParse('qf_admin'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('qf_token');
    if (token) {
      authMe()
        .then(res => {
          setAdmin(res.data.admin);
          localStorage.setItem('qf_admin', JSON.stringify(res.data.admin));
        })
        .catch(() => {
          logout();
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }

    // Listen for forced logout from API interceptor
    const handleLogout = () => logout();
    window.addEventListener('auth-logout', handleLogout);
    return () => window.removeEventListener('auth-logout', handleLogout);
  }, []);

  const login = (token, adminData) => {
    localStorage.setItem('qf_token', token);
    localStorage.setItem('qf_admin', JSON.stringify(adminData));
    setAdmin(adminData);
  };

  const logout = () => {
    localStorage.removeItem('qf_token');
    localStorage.removeItem('qf_admin');
    setAdmin(null);
  };

  return (
    <AuthContext.Provider value={{ admin, login, logout, loading, isAuthenticated: !!admin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
