import { useState } from 'react';
import axios from 'axios';
import { X, Sparkles, Server, AlertTriangle } from 'lucide-react';

interface SenderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (sender: any) => void;
  backendUrl: string;
  token: string;
}

export default function SenderModal({ isOpen, onClose, onSuccess, backendUrl, token }: SenderModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [hourlyLimit, setHourlyLimit] = useState('200');
  
  const [generateEthereal, setGenerateEthereal] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = generateEthereal
        ? { name, hourlyLimit, generateEthereal: true }
        : { name, email, smtpHost, smtpPort, smtpUser, smtpPass, hourlyLimit };

      const response = await axios.post(`${backendUrl}/api/senders`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      onSuccess(response.data);
      // Reset form
      setName('');
      setEmail('');
      setSmtpHost('');
      setSmtpPort('587');
      setSmtpUser('');
      setSmtpPass('');
      setHourlyLimit('200');
      setGenerateEthereal(true);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save SMTP Sender config.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-xl bg-white border border-slate-200/80 shadow-2xl rounded-3xl relative animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-brand-50 text-brand-600 rounded-xl flex items-center justify-center border border-brand-100 shadow-sm">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Add SMTP Sender</h3>
              <p className="text-slate-500 text-xs mt-0.5">Configure your outreach sender profile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-all cursor-pointer shadow-sm"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-800 text-xs">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Sender Name */}
          <div>
            <label className="block text-slate-500 text-[10px] font-bold mb-1.5 uppercase tracking-wider">
              Sender Name / Display Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mitrajit from ReachInbox"
              className="w-full bg-white border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm text-slate-800 px-4 py-3 rounded-2xl transition-all shadow-inner"
            />
          </div>

          {/* Toggle Ethereal account generation */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-sm">
            <label className="flex items-start gap-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={generateEthereal}
                onChange={(e) => setGenerateEthereal(e.target.checked)}
                className="mt-1 accent-brand-500 w-4 h-4 rounded border-slate-350 cursor-pointer"
              />
              <div>
                <span className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
                  Generate Ethereal Test Account (Recommended)
                  <Sparkles className="w-3.5 h-3.5 text-brand-500" />
                </span>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  Dynamically creates a real temporary SMTP test account on Ethereal.email. High-intent outreach is simulated securely without entering real credentials.
                </p>
              </div>
            </label>
          </div>

          {/* Custom SMTP Config (Hidden if auto-generate checked) */}
          {!generateEthereal && (
            <div className="space-y-4 pt-4 border-t border-slate-100 animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-500 text-[10px] font-bold mb-1.5 uppercase tracking-wider">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required={!generateEthereal}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full bg-white border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm text-slate-800 px-4 py-3 rounded-2xl transition-all shadow-inner"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 text-[10px] font-bold mb-1.5 uppercase tracking-wider">
                    SMTP Host
                  </label>
                  <input
                    type="text"
                    required={!generateEthereal}
                    value={smtpHost}
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.mailgun.org"
                    className="w-full bg-white border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm text-slate-800 px-4 py-3 rounded-2xl transition-all shadow-inner"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-500 text-[10px] font-bold mb-1.5 uppercase tracking-wider">
                    SMTP Port
                  </label>
                  <input
                    type="text"
                    required={!generateEthereal}
                    value={smtpPort}
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="587"
                    className="w-full bg-white border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm text-slate-800 px-4 py-3 rounded-2xl transition-all shadow-inner"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-slate-500 text-[10px] font-bold mb-1.5 uppercase tracking-wider">
                    SMTP Username / Login
                  </label>
                  <input
                    type="text"
                    required={!generateEthereal}
                    value={smtpUser}
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="postmaster@yourdomain.com"
                    className="w-full bg-white border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm text-slate-800 px-4 py-3 rounded-2xl transition-all shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 text-[10px] font-bold mb-1.5 uppercase tracking-wider">
                  SMTP Password
                </label>
                <input
                  type="password"
                  required={!generateEthereal}
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full bg-white border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm text-slate-800 px-4 py-3 rounded-2xl transition-all shadow-inner"
                />
              </div>
            </div>
          )}

          {/* Configurable Hourly Limit */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                Hourly Limit (Rate Cap)
              </label>
              <span className="text-slate-450 text-[10px] font-semibold">Emails per hour</span>
            </div>
            <input
              type="number"
              required
              min="1"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(e.target.value)}
              placeholder="200"
              className="w-full bg-white border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-sm text-slate-800 px-4 py-3 rounded-2xl transition-all shadow-inner"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-semibold rounded-2xl transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name}
              className="w-1/2 py-3 bg-brand-500 hover:bg-brand-600 disabled:bg-brand-200 text-white text-sm font-semibold rounded-2xl shadow-md shadow-brand-500/10 flex items-center justify-center transition-all cursor-pointer"
            >
              {loading ? 'Configuring...' : 'Save Sender Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
