import { useState, useEffect } from 'react';
import axios from 'axios';
import Login from './components/Login';
import Dashboard from './components/Dashboard';

const BACKEND_URL = 'http://localhost:4000';
const GOOGLE_CLIENT_ID = '852608121103-5d3itjnk956b0f9pt47lctk103b0scgd.apps.googleusercontent.com';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Check URL query parameters for OAuth redirection tokens on initial load
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const urlToken = queryParams.get('token');
    const urlError = queryParams.get('error');

    if (urlToken) {
      localStorage.setItem('token', urlToken);
      setToken(urlToken);
      // Clean query parameters from URL bar for clean UX
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlError) {
      setAuthError(decodeURIComponent(urlError));
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`${BACKEND_URL}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(response.data);
      } catch (err) {
        console.error('Failed to validate session token:', err);
        // Clear expired token
        localStorage.removeItem('token');
        setToken(null);
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [token]);

  const handleLoginSuccess = (authToken: string, authUser: any) => {
    localStorage.setItem('token', authToken);
    setToken(authToken);
    setUser(authUser);
    setAuthError(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 gap-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-slate-400 text-sm">Validating ReachInbox session...</span>
      </div>
    );
  }

  if (!token || !user) {
    return (
      <Login
        onLoginSuccess={handleLoginSuccess}
        backendUrl={BACKEND_URL}
        googleClientId={GOOGLE_CLIENT_ID}
        initialError={authError}
      />
    );
  }

  return (
    <Dashboard
      token={token}
      user={user}
      onLogout={handleLogout}
      backendUrl={BACKEND_URL}
    />
  );
}
