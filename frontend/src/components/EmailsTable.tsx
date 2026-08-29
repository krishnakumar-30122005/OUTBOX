import { HelpCircle, Eye, Edit3, Trash2, Clock, CheckCircle2, AlertTriangle, Send } from 'lucide-react';

interface Email {
  id: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string;
  status: string;
  error?: string;
  lastError?: string;
  attempts: number;
  sender?: any;
  senderEmail?: string;
}

interface EmailsTableProps {
  emails: Email[];
  loading: boolean;
  onPageChange: (page: number) => void;
  currentPage: number;
  totalPages: number;
  totalCount: number;
  onView?: (email: Email) => void;
  onEdit?: (email: Email) => void;
  onDelete?: (emailId: string) => void;
}

export default function EmailsTable({
  emails,
  loading,
  onPageChange,
  currentPage,
  totalPages,
  totalCount,
  onView,
  onEdit,
  onDelete,
}: EmailsTableProps) {
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-2.5 h-2.5" />
            <span>Sent</span>
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-2.5 h-2.5" />
            <span>Failed</span>
          </span>
        );
      case 'sending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Send className="w-2.5 h-2.5 animate-pulse" />
            <span>Sending</span>
          </span>
        );
      case 'rate_limited':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-2.5 h-2.5" />
            <span>Rate Limited</span>
          </span>
        );
      case 'queued':
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
            <Clock className="w-2.5 h-2.5" />
            <span>Scheduled</span>
          </span>
        );
    }
  };

  const getBodySnippet = (html: string) => {
    if (!html) return '';
    const text = html.replace(/<[^>]*>/g, ' ');
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-slate-500 text-sm">Loading logs...</span>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="w-12 h-12 bg-slate-50 border border-slate-100 text-slate-400 rounded-xl flex items-center justify-center mb-3">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-slate-800">No Emails Found</h4>
        <p className="text-slate-400 text-xs mt-1 max-w-sm px-6">
          No records match this view. Complete campaigns by scheduling them in the compose module.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Table list rows */}
      <div className="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-sm divide-y divide-slate-100/90 animate-fade-in">
        {emails.map((email) => {
          const isModifiable = email.status !== 'sent';

          return (
            <div 
              key={email.id} 
              className="px-6 py-4 hover:bg-slate-50/70 flex items-center justify-between gap-4 transition-all duration-150 group"
            >
              {/* Left Section: Recipient & Badge */}
              <div 
                className="w-52 shrink-0 flex items-center gap-3 cursor-pointer"
                onClick={() => onView && onView(email)}
              >
                <div className="truncate">
                  <span className="text-slate-800 font-bold text-sm block leading-tight hover:text-brand-600 transition-colors">
                    {email.recipientName || email.recipientEmail}
                  </span>
                  {email.recipientName && (
                    <span className="text-[11px] text-slate-400 font-medium truncate block mt-0.5">
                      {email.recipientEmail}
                    </span>
                  )}
                </div>
              </div>

              {/* Status badge */}
              <div className="w-28 shrink-0">
                {getStatusBadge(email.status)}
                {(email.lastError || email.error) && (
                  <span 
                    className="text-rose-600 text-[10px] block truncate max-w-[110px] mt-0.5" 
                    title={email.lastError || email.error}
                  >
                    {email.lastError || email.error}
                  </span>
                )}
              </div>

              {/* Center Section: Subject and Body snippet */}
              <div 
                className="flex-1 min-w-0 flex items-center gap-2 cursor-pointer"
                onClick={() => onView && onView(email)}
              >
                <span className="font-bold text-slate-800 text-sm truncate shrink-0 max-w-[220px]">
                  {email.subject || '(No Subject)'}
                </span>
                <span className="text-slate-400 text-xs truncate font-normal">
                  — {getBodySnippet(email.body)}
                </span>
              </div>

              {/* Right Section: Scheduled Time and Action Controls */}
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-[11px] text-slate-400 font-medium hidden md:inline-block">
                  {email.scheduledAt ? new Date(email.scheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </span>

                {/* CRUD Action Buttons */}
                <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                  {/* View Details */}
                  {onView && (
                    <button
                      type="button"
                      onClick={() => onView(email)}
                      className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors cursor-pointer"
                      title="View Email Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  )}

                  {/* Edit Scheduled Email */}
                  {isModifiable && onEdit && (
                    <button
                      type="button"
                      onClick={() => onEdit(email)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                      title="Edit & Reschedule Email"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                  )}

                  {/* Delete / Cancel Scheduled Email */}
                  {isModifiable && onDelete && (
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to cancel and delete this scheduled email to ${email.recipientEmail}?`)) {
                          onDelete(email.id);
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Cancel and Delete Scheduled Email"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Footer */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 pt-2">
          <span className="text-xs text-slate-500 font-semibold">
            Showing Page <span className="text-slate-800 font-bold">{currentPage}</span> of{' '}
            <span className="text-slate-800 font-bold">{totalPages}</span> ({totalCount} total emails)
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="py-1.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-600 disabled:hover:bg-white text-xs font-bold rounded-full transition-all cursor-pointer shadow-sm"
            >
              Previous
            </button>
            <button
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="py-1.5 px-4 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-50 text-slate-600 disabled:hover:bg-white text-xs font-bold rounded-full transition-all cursor-pointer shadow-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
