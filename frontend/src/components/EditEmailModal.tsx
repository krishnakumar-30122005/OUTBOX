import { useState, useEffect } from 'react';
import axios from 'axios';
import { X, Mail, Clock, Calendar, User, Save, AlertTriangle, ChevronDown } from 'lucide-react';

interface EditEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: any;
  senders: any[];
  backendUrl: string;
  token: string;
  onSuccess: (message: string) => void;
}

export default function EditEmailModal({
  isOpen,
  onClose,
  email,
  senders,
  backendUrl,
  token,
  onSuccess,
}: EditEmailModalProps) {
  const [recipientEmail, setRecipientEmail] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [senderId, setSenderId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (email) {
      setRecipientEmail(email.recipientEmail || '');
      setRecipientName(email.recipientName || '');
      setSubject(email.subject || '');
      setBody(email.body || '');
      setSenderId(email.senderId || (senders[0]?.id || ''));

      if (email.scheduledAt) {
        const d = new Date(email.scheduledAt);
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        setScheduledAt(d.toISOString().slice(0, 16));
      } else {
        const d = new Date();
        d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
        setScheduledAt(d.toISOString().slice(0, 16));
      }
      setError('');
    }
  }, [email, senders]);

  if (!isOpen || !email) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientEmail.trim()) {
      setError('Recipient email is required.');
      return;
    }
    if (!subject.trim()) {
      setError('Subject is required.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await axios.put(
        `${backendUrl}/api/emails/${email.id}`,
        {
          recipientEmail: recipientEmail.trim(),
          recipientName: recipientName.trim(),
          subject: subject.trim(),
          body: body || ' ',
          senderId: senderId || senders[0]?.id,
          scheduledAt: new Date(scheduledAt).toISOString(),
        },
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      onSuccess('Scheduled email successfully updated and rescheduled!');
      onClose();
    } catch (err: any) {
      console.error('Failed to update email:', err);
      setError(err.response?.data?.error || 'Failed to update scheduled email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Edit Scheduled Email</h3>
              <p className="text-xs text-slate-400">Modify recipients, content, or reschedule timing</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 flex-1">
            
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-800 text-xs animate-fade-in">
                <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Recipient Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
                  Recipient Email
                </label>
                <div className="relative">
                  <Mail className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="prospect@company.com"
                    className="w-full bg-white border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-xs text-slate-800 pl-8 pr-3 py-2 rounded-xl transition-all shadow-inner"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
                  Recipient Name
                </label>
                <div className="relative">
                  <User className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    placeholder="Alex Morgan"
                    className="w-full bg-white border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-xs text-slate-800 pl-8 pr-3 py-2 rounded-xl transition-all shadow-inner"
                  />
                </div>
              </div>
            </div>

            {/* Sender & Reschedule Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
                  Sender Mailbox
                </label>
                <div className="relative">
                  <select
                    value={senderId}
                    onChange={(e) => setSenderId(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-xs text-slate-800 px-3 py-2 pr-8 rounded-xl appearance-none transition-all cursor-pointer shadow-inner"
                  >
                    {senders.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.email}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
                  Reschedule Dispatch Time
                </label>
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full bg-white border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-xs text-slate-800 px-3 py-2 rounded-xl transition-all shadow-inner"
                  />
                  <Calendar className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="block text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
                Subject
              </label>
              <input
                type="text"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject Line"
                className="w-full bg-white border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-xs text-slate-800 px-3 py-2 rounded-xl transition-all shadow-inner"
              />
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-slate-500 text-[11px] font-bold uppercase tracking-wider mb-1">
                Message Content (HTML Supported)
              </label>
              <textarea
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your email body..."
                className="w-full bg-white border border-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500 outline-none text-xs text-slate-800 p-3 rounded-xl transition-all shadow-inner font-sans"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2 bg-slate-50/60">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-md shadow-emerald-500/10"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{loading ? 'Saving...' : 'Save & Reschedule'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
