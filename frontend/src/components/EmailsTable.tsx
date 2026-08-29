import { HelpCircle, Star } from 'lucide-react';

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
  attempts: number;
}

interface EmailsTableProps {
  emails: Email[];
  loading: boolean;
  onPageChange: (page: number) => void;
  currentPage: number;
  totalPages: number;
  totalCount: number;
}

export default function EmailsTable({
  emails,
  loading,
  onPageChange,
  currentPage,
  totalPages,
  totalCount,
}: EmailsTableProps) {
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
            Sent
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-100">
            Failed
          </span>
        );
      case 'sending':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
            Sending
          </span>
        );
      case 'rate_limited':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100">
            Rate Limited
          </span>
        );
      case 'queued':
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100">
            Scheduled
          </span>
        );
    }
  };

  const getBodySnippet = (html: string) => {
    if (!html) return '';
    // Strip HTML tags to show text preview
    const text = html.replace(/<[^>]*>/g, ' ');
    return text.length > 60 ? text.substring(0, 60) + '...' : text;
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
      {/* Table list rows (matching Image 5) */}
      <div className="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-sm divide-y divide-slate-100/90 animate-fade-in">
        {emails.map((email) => (
          <div 
            key={email.id} 
            className="px-6 py-4.5 hover:bg-slate-50/40 flex items-center justify-between gap-6 transition-all duration-150 group"
          >
            {/* Left Section: Recipient & Badge */}
            <div className="w-48 shrink-0 flex items-center gap-3">
              <div className="truncate">
                <span className="text-slate-800 font-bold text-sm block leading-tight">
                  To: {email.recipientName || email.recipientEmail}
                </span>
                {email.recipientName && (
                  <span className="text-[10px] text-slate-400 font-semibold truncate block mt-0.5">
                    {email.recipientEmail}
                  </span>
                )}
              </div>
            </div>

            {/* Status badge */}
            <div className="w-24 shrink-0">
              {getStatusBadge(email.status)}
              {email.error && (
                <span className="text-rose-600 text-[9px] block truncate max-w-[100px] mt-0.5" title={email.error}>
                  {email.error}
                </span>
              )}
            </div>

            {/* Center Section: Subject and Body snippet */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <span className="font-bold text-slate-800 text-sm truncate shrink-0 max-w-[200px]">
                {email.subject}
              </span>
              <span className="text-slate-400 text-sm truncate font-medium">
                — {getBodySnippet(email.body)}
              </span>
            </div>

            {/* Right Section: Time, Attempts and Action Star */}
            <div className="flex items-center gap-4 shrink-0">
              {email.attempts > 1 && (
                <span className="text-[10px] text-slate-450 bg-slate-50 px-2 py-0.5 border border-slate-200 rounded font-mono font-bold">
                  {email.attempts} attempts
                </span>
              )}
              
              <button className="text-slate-300 hover:text-amber-400 transition-all cursor-pointer">
                <Star className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
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
