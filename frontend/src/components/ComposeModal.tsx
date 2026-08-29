import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
  ArrowLeft, Paperclip, Clock, Upload, 
  AlertTriangle, Bold, Italic, Underline, AlignLeft, 
  RotateCcw, RotateCw, Type, List, ListOrdered, 
  Outdent, Indent, Quote, Image, Strikethrough, Calendar, ChevronDown
} from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  senders: any[];
  backendUrl: string;
  token: string;
  onRefreshSenders?: () => Promise<any>;
  onOpenSender?: () => void;
}

interface Recipient {
  email: string;
  name?: string;
}

export default function ComposeModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  senders, 
  backendUrl, 
  token,
  onRefreshSenders,
  onOpenSender
}: ComposeModalProps) {
  const [senderId, setSenderId] = useState(senders[0]?.id || '');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [generatingSender, setGeneratingSender] = useState(false);

  // Automatically sync senderId when senders are loaded
  useEffect(() => {
    if (senders.length > 0) {
      if (!senderId || !senders.some((s) => s.id === senderId)) {
        setSenderId(senders[0].id);
      }
    }
  }, [senders, senderId]);

  const handleQuickGenerateSender = async () => {
    setGeneratingSender(true);
    setError('');
    try {
      const res = await axios.post(`${backendUrl}/api/senders`, {
        name: 'Default Outreach Mailbox',
        generateEthereal: true,
        hourlyLimit: 200,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (onRefreshSenders) {
        await onRefreshSenders();
      }
      setSenderId(res.data.id);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to auto-create test sender.');
    } finally {
      setGeneratingSender(false);
    }
  };
  
  // Send Later Popover state
  const [showSendLater, setShowSendLater] = useState(false);
  const [startTime, setStartTime] = useState(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  
  const [delaySeconds, setDelaySeconds] = useState('2');
  const [hourlyLimit, setHourlyLimit] = useState('200');
  
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/);
        const parsed: Recipient[] = [];
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        let hasHeader = false;
        if (lines.length > 0) {
          const firstLine = lines[0].toLowerCase();
          if (firstLine.includes('email') || firstLine.includes('mail')) {
            hasHeader = true;
          }
        }

        const startIdx = hasHeader ? 1 : 0;
        for (let i = startIdx; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const cols = line.split(/[;,]/);
          const emailCandidate = cols[0]?.trim();
          const nameCandidate = cols[1]?.trim() || '';

          if (emailRegex.test(emailCandidate)) {
            parsed.push({ email: emailCandidate, name: nameCandidate });
          } else if (cols.length > 1 && emailRegex.test(cols[1]?.trim())) {
            parsed.push({ email: cols[1].trim(), name: cols[0].trim() });
          }
        }

        if (parsed.length === 0) {
          throw new Error('No valid email addresses detected in file.');
        }

        setRecipients(parsed);
      } catch (err: any) {
        console.error(err);
        setError(err.message || 'Failed to parse CSV file. Ensure it contains email addresses.');
        setRecipients([]);
      }
    };
    reader.readAsText(file);
  };



  const handleSubmit = async () => {
    setError('');

    const activeSenderId = senderId || senders[0]?.id;

    if (!activeSenderId) {
      setError('Please configure and select a sender profile first.');
      return;
    }

    if (!subject.trim()) {
      setError('Please enter a subject line for your email.');
      return;
    }

    if (recipients.length === 0) {
      setError('Please upload or add at least one recipient email.');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${backendUrl}/api/emails/schedule`, {
        senderId: activeSenderId,
        subject,
        body: body || ' ',
        recipients,
        startTime: new Date(startTime).toISOString(),
        delaySeconds: parseInt(delaySeconds, 10) || 2,
      }, {
        headers: { Authorization: `Bearer ${token}` },
      });

      onSuccess(response.data.message || `Outreach campaign scheduled successfully for ${recipients.length} recipients.`);
      setSubject('');
      setBody('');
      setRecipients([]);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to schedule outreach campaign.');
    } finally {
      setLoading(false);
    }
  };



  const applyPredefinedTime = (hoursOffset: number) => {
    const d = new Date();
    d.setHours(d.getHours() + hoursOffset);
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    setStartTime(d.toISOString().slice(0, 16));
  };

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col animate-fade-in overflow-y-auto">
      
      {/* Top Header Navigation */}
      <header className="flex items-center justify-between px-8 py-4 border-b border-slate-100/90 select-none shrink-0">
        <div className="flex items-center gap-3">
          <button 
            onClick={onClose}
            className="p-1 hover:bg-slate-50 border border-transparent hover:border-slate-200 rounded-lg text-slate-700 transition-all cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-slate-800">Compose New Email</h1>
        </div>

        {/* Action Widgets */}
        <div className="flex items-center gap-4 relative">
          <button className="p-2 hover:bg-slate-50 rounded-full text-slate-500 hover:text-slate-800 transition-all cursor-pointer">
            <Paperclip className="w-5 h-5" />
          </button>

          {/* Clock Icon / Send Later trigger */}
          <button 
            onClick={() => setShowSendLater(!showSendLater)}
            className={`p-2 hover:bg-slate-50 rounded-full transition-all cursor-pointer ${showSendLater ? 'text-brand-600 bg-brand-50' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Clock className="w-5 h-5" />
          </button>

          <button
            onClick={() => handleSubmit()}
            disabled={loading || !subject || !body || recipients.length === 0}
            className="px-5 py-2 border border-brand-500 hover:bg-brand-500/5 text-brand-600 disabled:border-slate-250 disabled:text-slate-400 font-bold text-sm rounded-full transition-all cursor-pointer"
          >
            {loading ? 'Sending...' : 'Send Later'}
          </button>

          {/* Send Later Popover popup (Image 2) */}
          {showSendLater && (
            <div className="absolute right-0 top-12 w-80 bg-white border border-slate-200 shadow-xl rounded-2xl p-5 z-50 animate-fade-in">
              <h4 className="text-sm font-bold text-slate-800 mb-4">Send Later</h4>
              
              <div className="space-y-4">
                <div className="relative">
                  <input
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-white border border-slate-250 text-slate-800 text-xs px-3 py-2.5 rounded-xl outline-none focus:border-brand-500 pr-9"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>

                {/* Predefined values */}
                <div className="space-y-1">
                  <button 
                    onClick={() => applyPredefinedTime(24)}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-650 hover:bg-slate-50 rounded-lg transition-all"
                  >
                    Tomorrow
                  </button>
                  <button 
                    onClick={() => applyPredefinedTime(16)}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-650 hover:bg-slate-50 rounded-lg transition-all"
                  >
                    Tomorrow, 10:00 AM
                  </button>
                  <button 
                    onClick={() => applyPredefinedTime(17)}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-650 hover:bg-slate-50 rounded-lg transition-all"
                  >
                    Tomorrow, 11:00 AM
                  </button>
                  <button 
                    onClick={() => applyPredefinedTime(21)}
                    className="w-full text-left px-3 py-2 text-xs font-semibold text-slate-650 hover:bg-slate-50 rounded-lg transition-all"
                  >
                    Tomorrow, 3:00 PM
                  </button>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button 
                    onClick={() => setShowSendLater(false)}
                    className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={() => {
                      setShowSendLater(false);
                      handleSubmit();
                    }}
                    className="px-4 py-1.5 border border-brand-500 text-brand-600 hover:bg-brand-50 font-bold text-xs rounded-full cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="mx-8 mt-4 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 text-rose-800 text-xs">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Campaign Form */}
      <div className="flex-1 max-w-4xl w-full mx-auto px-8 py-8 space-y-6">
        
        {/* ROW 1: From Sender Dropdown */}
        <div className="flex items-center gap-6 border-b border-slate-100/80 pb-3">
          <span className="w-16 text-sm font-semibold text-slate-400">From</span>
          {senders.length > 0 ? (
            <div className="relative">
              <select
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
                className="bg-slate-100 hover:bg-slate-150 border-none outline-none text-xs text-slate-700 font-bold px-4 py-2 pr-8 rounded-full appearance-none cursor-pointer transition-all"
              >
                {senders.map(s => (
                  <option key={s.id} value={s.id}>{s.email}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-500 absolute right-3 top-3 pointer-events-none" />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={generatingSender}
                onClick={handleQuickGenerateSender}
                className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300/80 text-emerald-800 text-xs font-bold rounded-full flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50"
              >
                <span>{generatingSender ? 'Provisioning Mailbox...' : '⚡ Auto-Create Sandbox Mailbox'}</span>
              </button>
              {onOpenSender && (
                <button
                  type="button"
                  onClick={onOpenSender}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-full transition-all cursor-pointer"
                >
                  + Custom SMTP
                </button>
              )}
            </div>
          )}
        </div>

        {/* ROW 2: To Recipients / Upload List */}
        <div className="flex items-center justify-between gap-6 border-b border-slate-100/80 pb-3">
          <div className="flex items-center gap-6 flex-1">
            <span className="w-16 text-sm font-semibold text-slate-400 shrink-0">To</span>
            {recipients.length > 0 ? (
              <div className="flex items-center gap-1.5 flex-wrap">
                {recipients.slice(0, 3).map((r, idx) => (
                  <span key={idx} className="px-3 py-1 bg-brand-50 border border-brand-300 text-brand-700 font-semibold text-xs rounded-full">
                    {r.email}
                  </span>
                ))}
                {recipients.length > 3 && (
                  <span className="px-2.5 py-1 bg-slate-100 border border-slate-200 text-slate-600 font-bold text-xs rounded-full">
                    +{recipients.length - 3}
                  </span>
                )}
              </div>
            ) : (
              <input 
                type="text" 
                readOnly
                placeholder="recipient@example.com"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-slate-400 outline-none w-full cursor-pointer"
              />
            )}
          </div>

          <div className="shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".csv,.txt"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs font-bold text-brand-600 hover:text-brand-700 transition-all cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload List
            </button>
          </div>
        </div>

        {/* ROW 3: Subject line */}
        <div className="flex items-center gap-6 border-b border-slate-100/80 pb-3">
          <span className="w-16 text-sm font-semibold text-slate-400">Subject</span>
          <input
            type="text"
            required
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="w-full bg-transparent text-sm text-slate-800 placeholder-slate-350 outline-none py-1"
          />
        </div>

        {/* ROW 4: Spacing Delay and Hourly Limit inputs */}
        <div className="flex items-center gap-8 text-xs font-semibold text-slate-600">
          <div className="flex items-center gap-3">
            <span>Delay between 2 emails</span>
            <input
              type="number"
              required
              min="1"
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(e.target.value)}
              className="w-14 bg-white border border-slate-200 focus:border-brand-500 outline-none text-center py-1.5 rounded-lg text-slate-800 font-bold"
            />
            <span className="text-slate-450 text-[10px]">sec</span>
          </div>

          <div className="flex items-center gap-3">
            <span>Hourly Limit</span>
            <input
              type="number"
              required
              min="1"
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(e.target.value)}
              className="w-16 bg-white border border-slate-200 focus:border-brand-500 outline-none text-center py-1.5 rounded-lg text-slate-800 font-bold"
            />
          </div>
        </div>

        {/* ROW 5: Rich Text Editor Canvas Box */}
        <div className="border border-slate-200/90 rounded-2xl overflow-hidden flex flex-col h-96 bg-slate-50/20 shadow-sm">
          
          {/* Format Toolbar (Image 1 style) */}
          <div className="flex items-center gap-1.5 px-4 py-2.5 bg-white border-b border-slate-150 overflow-x-auto shrink-0 select-none">
            <button type="button" className="p-1.5 hover:bg-slate-100 text-slate-500 rounded"><RotateCcw className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1.5 hover:bg-slate-100 text-slate-500 rounded"><RotateCw className="w-3.5 h-3.5" /></button>
            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0" />
            
            <button type="button" className="p-1.5 hover:bg-slate-100 text-slate-500 rounded flex items-center gap-0.5"><Type className="w-3.5 h-3.5" /><ChevronDown className="w-2.5 h-2.5" /></button>
            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0" />

            <button type="button" className="p-1.5 hover:bg-slate-100 text-slate-700 font-bold rounded"><Bold className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1.5 hover:bg-slate-100 text-slate-700 italic rounded"><Italic className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1.5 hover:bg-slate-100 text-slate-700 underline rounded"><Underline className="w-3.5 h-3.5" /></button>
            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0" />

            <button type="button" className="p-1.5 hover:bg-slate-100 text-slate-500 rounded"><AlignLeft className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1.5 hover:bg-slate-100 text-slate-500 rounded"><Outdent className="w-3.5 h-3.5" /></button>
            <div className="w-px h-4 bg-slate-200 mx-1 shrink-0" />

            <button type="button" className="p-1.5 hover:bg-slate-100 text-slate-500 rounded"><ListOrdered className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1.5 hover:bg-slate-100 text-slate-500 rounded"><List className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1.5 hover:bg-slate-100 text-slate-500 rounded"><Indent className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1.5 hover:bg-slate-100 text-slate-500 rounded"><Quote className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1.5 hover:bg-slate-100 text-slate-500 rounded"><Image className="w-3.5 h-3.5" /></button>
            <button type="button" className="p-1.5 hover:bg-slate-100 text-slate-500 rounded"><Strikethrough className="w-3.5 h-3.5" /></button>
          </div>

          {/* Text Editor Input area */}
          <textarea
            required
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Type Your Reply..."
            className="flex-1 bg-white p-6 outline-none text-sm text-slate-800 placeholder-slate-350 resize-none font-sans leading-relaxed overflow-y-auto"
          />
        </div>
      </div>
    </div>
  );
}
