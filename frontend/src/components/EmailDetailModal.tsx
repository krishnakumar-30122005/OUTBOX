import { X, Mail, Clock, Send, AlertTriangle, User, Calendar, Trash2, Edit3, CheckCircle2 } from 'lucide-react';

interface EmailDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: any;
  onEdit?: (email: any) => void;
  onDelete?: (emailId: string) => void;
}

export default function EmailDetailModal({
  isOpen,
  onClose,
  email,
  onEdit,
  onDelete,
}: EmailDetailModalProps) {
  if (!isOpen || !email) return null;

  const isEditable = email.status !== 'sent';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3 h-3" />
            <span>Sent Successfully</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3 h-3" />
            <span>Delivery Failed</span>
          </span>
        );
      case 'sending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Send className="w-3 h-3 animate-pulse" />
            <span>Sending Now</span>
          </span>
        );
      case 'rate_limited':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3 h-3" />
            <span>Rate Limited (Deferred)</span>
          </span>
        );
      case 'queued':
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-3 h-3" />
            <span>Scheduled in Queue</span>
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">Email Details</h3>
              <p className="text-xs text-slate-400 font-mono">ID: {email.id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {getStatusBadge(email.status)}
            <button
              onClick={onClose}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer ml-2"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Metadata Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-slate-50/70 border border-slate-200/70 p-4 rounded-2xl">
            <div className="flex items-center gap-2.5">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Recipient</span>
                <p className="text-xs font-bold text-slate-800 truncate">
                  {email.recipientName ? `${email.recipientName} <${email.recipientEmail}>` : email.recipientEmail}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Send className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Sender Mailbox</span>
                <p className="text-xs font-bold text-slate-800 truncate">
                  {email.sender?.email || email.senderEmail || 'Default Outreach Sender'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Scheduled At</span>
                <p className="text-xs font-medium text-slate-700">
                  {email.scheduledAt ? new Date(email.scheduledAt).toLocaleString() : 'Immediate'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Sent Timestamp</span>
                <p className="text-xs font-medium text-slate-700">
                  {email.sentAt ? new Date(email.sentAt).toLocaleString() : 'Pending Dispatch'}
                </p>
              </div>
            </div>
          </div>

          {/* Failure Alert if any */}
          {email.lastError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-2.5 text-rose-800 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Delivery Error:</span>
                <p className="text-rose-700 font-mono text-[11px] mt-0.5">{email.lastError}</p>
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Subject</span>
            <div className="p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-900">
              {email.subject || '(No Subject)'}
            </div>
          </div>

          {/* HTML / Text Message Body */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Message Content</span>
            <div 
              className="p-4 bg-slate-50/50 border border-slate-200 rounded-2xl text-xs text-slate-800 leading-relaxed min-h-[120px] max-h-[220px] overflow-y-auto prose prose-sm"
              dangerouslySetInnerHTML={{ __html: email.body || '<p className="text-slate-400">Empty body content</p>' }}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2">
            {isEditable && onDelete && (
              <button
                type="button"
                onClick={() => {
                  onDelete(email.id);
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Cancel & Delete</span>
              </button>
            )}

            {isEditable && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(email);
                }}
                className="px-3.5 py-2 rounded-xl bg-white border border-brand-200 hover:bg-brand-50 text-brand-600 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Scheduled Email</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
