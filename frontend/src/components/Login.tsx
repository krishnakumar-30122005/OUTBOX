import { useState, useEffect } from 'react';
import axios from 'axios';
import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google';
import { Mail, Shield, AlertTriangle, ArrowRight, LogIn } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
  backendUrl: string;
  googleClientId: string;
  initialError?: string | null;
}

export default function Login({
  onLoginSuccess,
  backendUrl,
  googleClientId,
  initialError,
}: LoginProps) {
  const [testEmail, setTestEmail] = useState('');
  const [testName, setTestName] = useState('');
  const [isBypassOpen, setIsBypassOpen] = useState(false);
  const [error, setError] = useState(initialError || '');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialError) {
      setError(initialError);
    }
  }, [initialError]);

  /**
   * Handle Google One Tap / GIS popup authentication response
   */
  const handleGoogleSuccess = async (credentialResponse: any) => {
    setError('');
    setLoading(true);
    try {
      const response = await axios.post(`${backendUrl}/api/auth/google/verify`, {
        idToken: credentialResponse.credential,
      });
      const { token, user } = response.data;
      onLoginSuccess(token, user);
    } catch (err: any) {
      console.error('Google verification error:', err);
      const isNetworkErr = !err.response && (err.message?.includes('Network Error') || err.code === 'ERR_NETWORK');
      const errorMsg = isNetworkErr
        ? `Cannot connect to backend (${backendUrl}). Make sure your Render backend service is running and VITE_BACKEND_URL is set in Vercel.`
        : (err.response?.data?.error || 'Google authentication failed. Please try again.');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google sign-in popup was cancelled or failed to initialize.');
  };

  /**
   * Developer bypass test sign in
   */
  const handleTestLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail) return;
    setError('');
    setLoading(true);
    try {
      const response = await axios.post(`${backendUrl}/api/auth/test-login`, {
        email: testEmail.trim(),
        name: testName.trim() || 'Developer Tester',
      });
      const { token, user } = response.data;
      onLoginSuccess(token, user);
    } catch (err: any) {
      console.error('Test login error:', err);
      const isNetworkErr = !err.response && (err.message?.includes('Network Error') || err.code === 'ERR_NETWORK');
      const errorMsg = isNetworkErr
        ? `Cannot connect to backend (${backendUrl}). Make sure your Render backend is running.`
        : (err.response?.data?.error || 'Bypass login failed.');
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const isConfiguredClientId =
    Boolean(googleClientId) && googleClientId !== 'your_google_client_id';

  const renderLoginForm = () => (
    <div className="w-full max-w-md p-8 bg-white border border-slate-200/80 rounded-3xl shadow-xl relative overflow-hidden animate-fade-in">
      {/* Background Decorative Glow */}
      <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand-100 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-emerald-50 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col items-center mb-8 text-center relative z-10">
        <div className="w-12 h-12 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center border border-brand-100 mb-3 shadow-sm">
          <Mail className="w-6 h-6" />
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 font-sans">
          ReachInbox
        </h2>
        <p className="text-slate-500 text-xs mt-1 font-semibold">Email Job Scheduler & Monitor</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-800 text-xs relative z-10 animate-fade-in">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
          <span className="leading-relaxed">{error}</span>
        </div>
      )}

      {/* Google Login Section */}
      <div className="space-y-3 relative z-10">
        {/* Client-side Google popup (if Google Client ID is configured) */}
        {isConfiguredClientId && (
          <div className="flex justify-center pt-1">
            <GoogleLogin
              onSuccess={handleGoogleSuccess}
              onError={handleGoogleError}
              theme="outline"
              shape="pill"
              size="large"
              text="signin_with"
            />
          </div>
        )}

        {/* Info when credentials are demo placeholder */}
        {!isConfiguredClientId && (
          <div className="p-3 bg-amber-50/80 border border-amber-100 rounded-xl text-amber-800 text-[11px] flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 shrink-0 text-amber-600" />
            <span>Set valid Google credentials in backend <code className="font-mono bg-amber-100 px-1 rounded">.env</code> for live OAuth</span>
          </div>
        )}

        {/* Divider */}
        <div className="relative flex py-3 items-center">
          <div className="flex-grow border-t border-slate-100"></div>
          <span className="flex-shrink mx-4 text-slate-400 text-[11px] uppercase tracking-wider font-bold">Or</span>
          <div className="flex-grow border-t border-slate-100"></div>
        </div>

        {/* Development Bypass Trigger */}
        {!isBypassOpen ? (
          <button
            type="button"
            onClick={() => setIsBypassOpen(true)}
            className="w-full py-3 px-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-700 text-sm font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <LogIn className="w-4 h-4 text-slate-500" />
            <span>Use Development Bypass</span>
            <ArrowRight className="w-4 h-4 text-slate-400 ml-auto" />
          </button>
        ) : (
          <form onSubmit={handleTestLogin} className="space-y-3.5 animate-fade-in">
            <div>
              <label className="block text-slate-500 text-[10px] font-bold mb-1.5 uppercase tracking-wider">
                Email Address
              </label>
              <input
                type="email"
                required
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                placeholder="developer@reachinbox.ai"
                className="w-full bg-white border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm text-slate-800 px-4 py-2.5 rounded-xl transition-all shadow-inner"
              />
            </div>

            <div>
              <label className="block text-slate-500 text-[10px] font-bold mb-1.5 uppercase tracking-wider">
                Full Name (Optional)
              </label>
              <input
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                placeholder="Krishna Yadav"
                className="w-full bg-white border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm text-slate-800 px-4 py-2.5 rounded-xl transition-all shadow-inner"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsBypassOpen(false)}
                className="w-1/3 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-600 text-xs font-semibold rounded-xl transition-all cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !testEmail}
                className="w-2/3 py-2.5 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-200 text-white text-xs font-semibold rounded-xl shadow-md shadow-brand-500/10 flex items-center justify-center transition-all cursor-pointer"
              >
                {loading ? 'Signing In...' : 'Sign In Now'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 relative overflow-hidden">
      {/* Background grids and shapes */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40" />

      {isConfiguredClientId ? (
        <GoogleOAuthProvider clientId={googleClientId}>
          {renderLoginForm()}
        </GoogleOAuthProvider>
      ) : (
        renderLoginForm()
      )}
    </div>
  );
}
