import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Send,
  Plus,
  Search,
  LogOut,
  CheckCircle,
  AlertTriangle,
  Server,
  ShieldCheck,
  AlertOctagon,
  Clock,
  RotateCw,
  SlidersHorizontal
} from 'lucide-react';

const SlackIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523 2.528 2.528 0 0 1-2.522-2.523 2.528 2.528 0 0 1 2.522-2.52h2.52v2.52zm1.261 0a2.528 2.528 0 0 1 2.52-2.52h5.043a2.528 2.528 0 0 1 2.522 2.52v5.043a2.528 2.528 0 0 1-2.522 2.52H8.823a2.528 2.528 0 0 1-2.52-2.52v-5.043zm0-6.342a2.528 2.528 0 0 1 2.52-2.52 2.528 2.528 0 0 1 2.522 2.52v2.52h-2.522a2.528 2.528 0 0 1-2.52-2.52zm0 1.261a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.522 2.522H3.782a2.528 2.528 0 0 1-2.52-2.522v-5.043a2.528 2.528 0 0 1 2.52-2.52h2.522zm6.342-5.042a2.528 2.528 0 0 1 2.52-2.52 2.528 2.528 0 0 1 2.522 2.52v2.52h-2.522a2.528 2.528 0 0 1-2.52-2.52zm-1.261 0a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.522 2.52h-5.043a2.528 2.528 0 0 1-2.52-2.52V5.043a2.528 2.528 0 0 1 2.52-2.52h5.043zm0 6.342a2.528 2.528 0 0 1 2.52 2.52a2.528 2.528 0 0 1 2.522 2.52v-2.52h2.522a2.528 2.528 0 0 1 2.52-2.52zm0-1.261a2.528 2.528 0 0 1 2.52-2.52v-5.043a2.528 2.528 0 0 1 2.522-2.52h2.52a2.528 2.528 0 0 1 2.52 2.52v5.043a2.528 2.528 0 0 1-2.52 2.52h-2.522z"/>
  </svg>
);

import EmailsTable from './EmailsTable';
import ComposeModal from './ComposeModal';
import SenderModal from './SenderModal';
import EmailDetailModal from './EmailDetailModal';
import EditEmailModal from './EditEmailModal';

interface DashboardProps {
  token: string;
  user: any;
  onLogout: () => void;
  backendUrl: string;
}

export default function Dashboard({ token, user: initialUser, onLogout, backendUrl }: DashboardProps) {
  const [user, setUser] = useState(initialUser);
  const [senders, setSenders] = useState<any[]>([]);
  const [emails, setEmails] = useState<any[]>([]);
  const [counts, setCounts] = useState({ scheduled: 0, sent: 0, failed: 0 });
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent' | 'failed'>('scheduled');
  
  // Search & Pagination State
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSenderOpen, setIsSenderOpen] = useState(false);
  const [selectedEmailForDetail, setSelectedEmailForDetail] = useState<any | null>(null);
  const [selectedEmailForEdit, setSelectedEmailForEdit] = useState<any | null>(null);
  
  // UI logs
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Fetch count stats
  const fetchCounts = useCallback(async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/emails/counts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCounts(response.data);
    } catch (err) {
      console.error('Failed to fetch counts:', err);
    }
  }, [backendUrl, token]);

  // Fetch email items (either ES search or standard postgres paginated query)
  const fetchEmails = useCallback(async () => {
    setLoading(true);
    try {
      if (searchQuery.trim() !== '') {
        const response = await axios.get(
          `${backendUrl}/api/emails/search?q=${encodeURIComponent(searchQuery)}&status=${activeTab}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setEmails(response.data);
        setTotalPages(1);
        setCurrentPage(1);
        setTotalCount(response.data.length);
      } else {
        const response = await axios.get(
          `${backendUrl}/api/emails?status=${activeTab}&page=${currentPage}&limit=8`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setEmails(response.data.emails);
        setTotalPages(response.data.pages);
        setTotalCount(response.data.total);
      }
    } catch (err) {
      console.error('Failed to fetch emails:', err);
    } finally {
      setLoading(false);
    }
  }, [backendUrl, token, activeTab, searchQuery, currentPage]);

  // Fetch Senders list
  const fetchSenders = useCallback(async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/senders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSenders(response.data);
    } catch (err) {
      console.error('Failed to fetch senders:', err);
    }
  }, [backendUrl, token]);

  // Fetch User Profile (checks Slack Integration updates)
  const fetchProfile = useCallback(async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(response.data);
    } catch (err) {
      console.error('Failed to fetch user profile:', err);
    }
  }, [backendUrl, token]);

  // Bootstrapping loads
  useEffect(() => {
    fetchSenders();
    fetchCounts();
    fetchProfile();
    
    const params = new URLSearchParams(window.location.search);
    if (params.get('slack') === 'success') {
      showNotification('success', 'Slack successfully connected! Alerts will now post to your configured channel.');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (params.get('slack') === 'error') {
      showNotification('error', params.get('message') || 'Failed to authorize Slack connection.');
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [fetchSenders, fetchCounts, fetchProfile]);

  useEffect(() => {
    fetchEmails();
  }, [fetchEmails]);

  // Poll counters and current email lists every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      fetchCounts();
      if (searchQuery.trim() === '') {
        fetchEmails();
      }
    }, 6000);
    return () => clearInterval(timer);
  }, [fetchCounts, fetchEmails, searchQuery]);

  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 6000);
  };

  // Slack Integration Flows
  const handleConnectSlack = async () => {
    try {
      const response = await axios.get(`${backendUrl}/api/slack/connect`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      window.location.href = response.data.url;
    } catch (err: any) {
      console.error(err);
      showNotification('error', err.response?.data?.error || 'Failed to generate Slack OAuth link. Ensure credentials are set in backend/.env.');
    }
  };

  const handleDisconnectSlack = async () => {
    if (!window.confirm('Are you sure you want to disconnect Slack notifications?')) return;
    try {
      await axios.post(`${backendUrl}/api/slack/disconnect`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchProfile();
      showNotification('success', 'Slack notifications disabled.');
    } catch (err) {
      console.error(err);
      showNotification('error', 'Failed to disconnect Slack.');
    }
  };

  const handleTestSlack = async () => {
    try {
      const response = await axios.post(`${backendUrl}/api/slack/test`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showNotification('success', response.data.message || 'Test alert sent to Slack!');
    } catch (err: any) {
      console.error(err);
      showNotification('error', err.response?.data?.error || 'Failed to send test Slack alert.');
    }
  };

  const handleAddSenderSuccess = (newSender: any) => {
    setSenders((prev) => [newSender, ...prev]);
    showNotification('success', `SMTP sender ${newSender.email} successfully added.`);
  };

  const handleComposeSuccess = (message: string) => {
    fetchCounts();
    fetchEmails();
    showNotification('success', message);
  };

  const handleDeleteEmail = async (emailId: string) => {
    try {
      await axios.delete(`${backendUrl}/api/emails/${emailId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      showNotification('success', 'Scheduled email successfully cancelled and removed from queue.');
      fetchCounts();
      fetchEmails();
    } catch (err: any) {
      console.error('Failed to delete email:', err);
      showNotification('error', err.response?.data?.error || 'Failed to delete scheduled email.');
    }
  };

  const handleEditEmailSuccess = (message: string) => {
    fetchCounts();
    fetchEmails();
    showNotification('success', message);
  };

  const handleTabChange = (tab: 'scheduled' | 'sent' | 'failed') => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen flex bg-white text-slate-800 font-sans relative overflow-hidden">
      
      {/* Toast Notification */}
      {notification && (
        <div className={`fixed top-6 right-6 z-50 p-4 rounded-2xl shadow-xl flex items-center gap-3 border transition-all animate-fade-in ${
          notification.type === 'success'
            ? 'bg-emerald-50 border-emerald-100 text-emerald-800'
            : 'bg-rose-50 border-rose-100 text-rose-800'
        }`}>
          {notification.type === 'success' ? <CheckCircle className="w-5 h-5 shrink-0 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 shrink-0 text-rose-500" />}
          <span className="text-xs font-bold">{notification.message}</span>
        </div>
      )}

      {/* LEFT SIDEBAR PANEL (Matching Image 5) */}
      <aside className="w-72 border-r border-slate-100 bg-slate-50/50 p-6 flex flex-col justify-between shrink-0 select-none z-10">
        <div className="space-y-6">
          {/* Logo ONB style */}
          <div className="flex items-center justify-between px-2">
            <span className="text-2xl font-black tracking-tighter text-black font-sans">
              ONB
            </span>
          </div>

          {/* User Profile Card */}
          <div className="p-3 bg-slate-100/50 border border-slate-100 rounded-2xl flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={user.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(user.email)}`}
                alt="Avatar"
                className="w-9 h-9 rounded-full border border-slate-200 bg-white"
              />
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{user.name || 'Oliver Brown'}</p>
                <p className="text-[10px] text-slate-400 font-semibold truncate mt-0.5">{user.email}</p>
              </div>
            </div>
            <button 
              onClick={onLogout}
              className="p-1 text-slate-400 hover:text-rose-500 rounded-md transition-all cursor-pointer"
              title="Logout Session"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Compose Campaign Trigger button */}
          <button
            onClick={() => setIsComposeOpen(true)}
            className="w-full py-2.5 bg-white border border-brand-500 hover:bg-brand-50 text-brand-600 text-xs font-bold rounded-full transition-all text-center flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
          >
            <span>Compose</span>
          </button>

          {/* Navigation/Counts Tabs */}
          <div className="space-y-1">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest px-2 mb-2">
              Core
            </span>
            
            <button
              onClick={() => handleTabChange('scheduled')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'scheduled'
                  ? 'bg-slate-100 border border-slate-200/50 text-slate-800'
                  : 'text-slate-500 hover:bg-slate-100/30 border border-transparent hover:text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>Scheduled</span>
              </div>
              <span className="text-[10px] text-slate-450 font-bold font-mono">
                {counts.scheduled}
              </span>
            </button>

            <button
              onClick={() => handleTabChange('sent')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'sent'
                  ? 'bg-brand-50 border border-brand-100 text-brand-700'
                  : 'text-slate-500 hover:bg-slate-100/30 border border-transparent hover:text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <Send className={`w-4 h-4 ${activeTab === 'sent' ? 'text-brand-500' : 'text-slate-400'}`} />
                <span>Sent</span>
              </div>
              <span className={`text-[10px] font-bold font-mono ${activeTab === 'sent' ? 'text-brand-700' : 'text-slate-450'}`}>
                {counts.sent}
              </span>
            </button>

            <button
              onClick={() => handleTabChange('failed')}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'failed'
                  ? 'bg-rose-50 border border-rose-100 text-rose-700'
                  : 'text-slate-500 hover:bg-slate-100/30 border border-transparent hover:text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertOctagon className={`w-4 h-4 ${activeTab === 'failed' ? 'text-rose-500' : 'text-slate-400'}`} />
                <span>Failed Logs</span>
              </div>
              <span className={`text-[10px] font-bold font-mono ${activeTab === 'failed' ? 'text-rose-700' : 'text-slate-450'}`}>
                {counts.failed}
              </span>
            </button>
          </div>

          {/* Senders Config */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2 pt-2 border-t border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Outreach Senders
              </span>
              <button
                onClick={() => setIsSenderOpen(true)}
                className="p-1 bg-white hover:bg-slate-50 border border-slate-200 rounded-md cursor-pointer transition-all shadow-sm"
                title="Add Sender Profile"
              >
                <Plus className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
            
            {senders.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-center">
                <p className="text-[10px] text-slate-400">No SMTP profiles configured.</p>
              </div>
            ) : (
              <div className="space-y-1.5 max-h-[160px] overflow-y-auto pr-1">
                {senders.map((s) => (
                  <div key={s.id} className="p-3 bg-white border border-slate-150 rounded-2xl flex items-center gap-2 shadow-sm">
                    <div className="w-6 h-6 bg-slate-50 text-slate-400 border border-slate-100 rounded-md flex items-center justify-center shrink-0">
                      <Server className="w-3 h-3" />
                    </div>
                    <div className="truncate flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-slate-700 truncate">{s.name}</p>
                      <p className="text-[9px] text-slate-400 font-semibold truncate">{s.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* BOTTOM SLACK WIDGET */}
        <div className="pt-4 border-t border-slate-100 space-y-3">
          <div className="flex items-center justify-between px-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
              <SlackIcon className="w-3 h-3 text-emerald-500" /> Notifications
            </span>
          </div>

          {user.slackIntegration ? (
            <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-2xl space-y-2 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-emerald-700 font-bold">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
                <span>Slack Connected</span>
              </div>
              <button
                type="button"
                onClick={handleTestSlack}
                className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded-lg transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1"
              >
                <span>🔔 Send Test Notification</span>
              </button>
              <button
                type="button"
                onClick={handleDisconnectSlack}
                className="w-full py-1.5 bg-white border border-slate-200 hover:bg-slate-50 hover:text-rose-600 text-slate-500 text-[10px] font-bold rounded-lg transition-all cursor-pointer"
              >
                Disconnect Slack
              </button>
            </div>
          ) : (
            <div className="p-3 bg-slate-50/50 border border-slate-100 rounded-2xl space-y-2 shadow-sm">
              <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">Connect Slack to alert you on hourly limit hits.</p>
              <button
                onClick={handleConnectSlack}
                className="w-full py-2 bg-white border border-slate-250 hover:bg-slate-50 hover:border-slate-350 text-slate-700 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-sm"
              >
                <SlackIcon className="w-3.5 h-3.5 text-emerald-500" />
                <span>Connect Slack</span>
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN PANEL CONTENT (Matching Image 5 layout) */}
      <main className="flex-1 p-8 flex flex-col gap-6 overflow-y-auto z-10 bg-white">
        
        {/* Top Header Filter Bar */}
        <header className="flex justify-between items-center gap-4">
          
          {/* Search Input bar */}
          <div className="relative flex-1 max-w-xl">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={`Search...`}
              className="w-full bg-slate-50 border border-slate-200/80 focus:border-brand-500 focus:ring-0 outline-none text-sm text-slate-700 pl-10 pr-4 py-2.5 rounded-full transition-all shadow-inner"
            />
          </div>

          {/* Quick controls */}
          <div className="flex items-center gap-2">
            {/* Filter button */}
            <button className="p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-full text-slate-500 hover:text-slate-700 transition-all cursor-pointer shadow-sm">
              <SlidersHorizontal className="w-4 h-4" />
            </button>

            {/* Sync/Refresh button */}
            <button 
              onClick={fetchEmails}
              className={`p-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-full text-slate-500 hover:text-slate-700 transition-all cursor-pointer shadow-sm ${loading ? 'animate-spin' : ''}`}
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Email Logs Area */}
        <div>
          <div className="flex justify-between items-center mb-4 px-1">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              {activeTab} Audits
            </h3>
            {searchQuery.trim() !== '' && (
              <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-2 py-0.5 rounded-md font-bold">
                Elasticsearch Matching Results
              </span>
            )}
          </div>

          <EmailsTable
            emails={emails}
            loading={loading}
            onPageChange={setCurrentPage}
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            onView={(email) => setSelectedEmailForDetail(email)}
            onEdit={(email) => setSelectedEmailForEdit(email)}
            onDelete={handleDeleteEmail}
          />
        </div>
      </main>

      {/* Dynamic Modals */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSuccess={handleComposeSuccess}
        senders={senders}
        backendUrl={backendUrl}
        token={token}
        onRefreshSenders={fetchSenders}
        onOpenSender={() => {
          setIsComposeOpen(false);
          setIsSenderOpen(true);
        }}
      />

      <SenderModal
        isOpen={isSenderOpen}
        onClose={() => setIsSenderOpen(false)}
        onSuccess={handleAddSenderSuccess}
        backendUrl={backendUrl}
        token={token}
      />

      {/* Email Detail / View Modal */}
      <EmailDetailModal
        isOpen={Boolean(selectedEmailForDetail)}
        onClose={() => setSelectedEmailForDetail(null)}
        email={selectedEmailForDetail}
        onEdit={(email) => {
          setSelectedEmailForDetail(null);
          setSelectedEmailForEdit(email);
        }}
        onDelete={handleDeleteEmail}
      />

      {/* Edit Scheduled Email Modal */}
      <EditEmailModal
        isOpen={Boolean(selectedEmailForEdit)}
        onClose={() => setSelectedEmailForEdit(null)}
        email={selectedEmailForEdit}
        senders={senders}
        backendUrl={backendUrl}
        token={token}
        onSuccess={handleEditEmailSuccess}
      />
    </div>
  );
}
