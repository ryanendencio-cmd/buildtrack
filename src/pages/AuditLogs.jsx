import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from '../components/AdminLayout';
import { api } from '../api';

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, todayCount: 0, authCount: 0, financialCount: 0, workforceCount: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedModule, setSelectedModule] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [dateFilter, setDateFilter] = useState('All');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch audit logs and statistics
  const fetchAuditData = async () => {
    setIsRefreshing(true);
    try {
      const [logsData, statsData] = await Promise.all([
        api.get('/audit-logs?limit=300').catch(() => []),
        api.get('/audit-logs/stats').catch(() => ({ total: 0, todayCount: 0, authCount: 0, financialCount: 0, workforceCount: 0 }))
      ]);

      if (Array.isArray(logsData)) {
        setLogs(logsData);
      }
      if (statsData && !statsData.error) {
        setStats(statsData);
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAuditData();
  }, []);

  // Filter logs based on search, module, status, and date range
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // Module filter
      if (selectedModule !== 'All' && String(log.module || '').toLowerCase() !== selectedModule.toLowerCase()) {
        return false;
      }

      // Status filter
      if (selectedStatus !== 'All' && String(log.status || '').toUpperCase() !== selectedStatus.toUpperCase()) {
        return false;
      }

      // Date Range filter
      const logTime = log.timestamp || 0;
      const now = new Date();
      if (dateFilter === 'Today') {
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        if (logTime < startOfToday) return false;
      } else if (dateFilter === 'Yesterday') {
        const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
        const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        if (logTime < startOfYesterday || logTime >= endOfYesterday) return false;
      } else if (dateFilter === 'Last7Days') {
        const sevenDaysAgo = now.getTime() - (7 * 24 * 60 * 60 * 1000);
        if (logTime < sevenDaysAgo) return false;
      } else if (dateFilter === 'Last30Days') {
        const thirtyDaysAgo = now.getTime() - (30 * 24 * 60 * 60 * 1000);
        if (logTime < thirtyDaysAgo) return false;
      } else if (dateFilter === 'Custom') {
        if (customStartDate) {
          const startMs = new Date(customStartDate).setHours(0, 0, 0, 0);
          if (logTime < startMs) return false;
        }
        if (customEndDate) {
          const endMs = new Date(customEndDate).setHours(23, 59, 59, 999);
          if (logTime > endMs) return false;
        }
      }

      // Search keyword filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matches =
          (log.description || '').toLowerCase().includes(q) ||
          (log.actor_name || '').toLowerCase().includes(q) ||
          (log.actor_role || '').toLowerCase().includes(q) ||
          (log.action || '').toLowerCase().includes(q) ||
          (log.target_name || '').toLowerCase().includes(q) ||
          (log.module || '').toLowerCase().includes(q) ||
          (log.ip_address || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [logs, selectedModule, selectedStatus, dateFilter, customStartDate, customEndDate, searchTerm]);

  // Export filtered logs to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No logs available to export based on current filter.');
      return;
    }

    const headers = ['Log ID', 'Date', 'Time', 'Actor Name', 'Actor Role', 'Module', 'Action', 'Description', 'Status', 'IP Address', 'User Agent'];
    const rows = filteredLogs.map(log => [
      `"${log.id || ''}"`,
      `"${log.date || ''}"`,
      `"${log.time || ''}"`,
      `"${(log.actor_name || '').replace(/"/g, '""')}"`,
      `"${(log.actor_role || '').replace(/"/g, '""')}"`,
      `"${log.module || ''}"`,
      `"${log.action || ''}"`,
      `"${(log.description || '').replace(/"/g, '""')}"`,
      `"${log.status || 'SUCCESS'}"`,
      `"${log.ip_address || ''}"`,
      `"${(log.user_agent || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `buildtrack_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Record export in audit log
    api.post('/audit-logs', {
      action: 'AUDIT_LOGS_EXPORTED',
      module: 'Authentication',
      description: `Admin exported ${filteredLogs.length} audit records to CSV file.`,
      status: 'SUCCESS'
    }).catch(() => {});
  };

  // Print layout trigger
  const handlePrint = () => {
    window.print();
  };

  // Category Color Badge Helper
  const getModuleBadge = (module) => {
    switch (module) {
      case 'Authentication':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'Expenses':
        return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      case 'Projects':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Workers':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'Attendance':
      case 'Settings':
        return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'Materials':
      case 'Tools':
        return 'bg-rose-50 text-rose-800 border-rose-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Relative Time Helper
  const formatRelativeTime = (timestamp) => {
    if (!timestamp) return '';
    const diffSeconds = Math.floor((Date.now() - timestamp) / 1000);
    if (diffSeconds < 60) return 'Just now';
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`;
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`;
    return `${Math.floor(diffSeconds / 86400)}d ago`;
  };

  return (
    <AdminLayout>
      {/* ── HEADER TITLE ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 mb-3 border-b border-gray-200/60 gap-3">
        <div>
          <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">SECURITY & COMPLIANCE</span>
          <h1 className="text-xl font-extrabold text-gray-900 mt-0.5 tracking-tight flex items-center gap-2">
            Audit Logs & Activity Trail
            <span className="text-[10px] font-bold bg-[#A63228]/10 text-[#A63228] px-2 py-0.5 rounded-full">
              Live Trail
            </span>
          </h1>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Comprehensive log of all system actions, changes, transactions, and user access.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 print:hidden">
          <button
            onClick={fetchAuditData}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50 shadow-sm transition-colors"
            title="Refresh logs"
          >
            <svg className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#A63228]' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-50 shadow-sm transition-colors"
            title="I-export ang filtered logs sa CSV file"
          >
            <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span>Export CSV</span>
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#A63228] text-white rounded-lg text-xs font-bold hover:bg-[#8B1A10] shadow-sm transition-colors"
            title="I-print o i-save bilang PDF"
          >
            <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* ── KPI METRICS CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-3 print:grid-cols-4">
        {/* Total Logs */}
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">TOTAL ACTIVITIES</span>
            <h3 className="text-xl font-extrabold text-gray-900 mt-0.5">{stats.total || logs.length}</h3>
            <span className="text-[8px] text-gray-500 font-medium">Recorded history</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-700 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
        </div>

        {/* Today's Activities */}
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-[#A63228] uppercase tracking-wider block">TODAY'S ACTIONS</span>
            <h3 className="text-xl font-extrabold text-[#A63228] mt-0.5">{stats.todayCount}</h3>
            <span className="text-[8px] text-gray-500 font-medium">Logged today</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-red-50 text-[#A63228] flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        {/* Security & Access */}
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-amber-700 uppercase tracking-wider block">AUTH & ACCESS</span>
            <h3 className="text-xl font-extrabold text-amber-700 mt-0.5">{stats.authCount}</h3>
            <span className="text-[8px] text-gray-500 font-medium">Login & Auth events</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        </div>

        {/* Financial Transactions */}
        <div className="bg-white p-3 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider block">FINANCIAL & PROJECTS</span>
            <h3 className="text-xl font-extrabold text-emerald-700 mt-0.5">{stats.financialCount}</h3>
            <span className="text-[8px] text-gray-500 font-medium">Expenses, Advances, Budgets</span>
          </div>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>

      {/* ── FILTER & SEARCH CONTROLS ── */}
      <div className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100 mb-3 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          {/* Search Input */}
          <div className="md:col-span-4 relative">
            <input
              type="text"
              placeholder="Maghanap ayon sa user, action, module, detalye, o IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-[#f4f1ee] border border-transparent rounded-lg pl-8 pr-7 py-2 text-xs font-medium focus:border-[#A63228] outline-none text-gray-800 placeholder-gray-400"
            />
            <svg className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2 text-gray-400 hover:text-gray-600 text-xs font-bold"
              >
                ✕
              </button>
            )}
          </div>

          {/* Module Selector */}
          <div className="md:col-span-3">
            <select
              value={selectedModule}
              onChange={(e) => setSelectedModule(e.target.value)}
              className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-2.5 py-2 text-xs font-bold text-gray-700 outline-none focus:border-[#A63228]"
            >
              <option value="All">All Modules</option>
              <option value="Authentication">Authentication & Security</option>
              <option value="Projects">Projects Management</option>
              <option value="Expenses">Expenses Management</option>
              <option value="Workers">Workers Management</option>
              <option value="Attendance">Attendance & Non-Working</option>
              <option value="Materials">Materials Management</option>
              <option value="Tools">Tools Management</option>
              <option value="Schedules">Schedule Management</option>
              <option value="Settings">System Settings</option>
            </select>
          </div>

          {/* Status Selector */}
          <div className="md:col-span-2">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-2.5 py-2 text-xs font-bold text-gray-700 outline-none focus:border-[#A63228]"
            >
              <option value="All">All Statuses</option>
              <option value="SUCCESS">Success Only</option>
              <option value="FAILED">Failed / Denied</option>
            </select>
          </div>

          {/* Date Range Preset */}
          <div className="md:col-span-3">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-2.5 py-2 text-xs font-bold text-gray-700 outline-none focus:border-[#A63228]"
            >
              <option value="All">All Time</option>
              <option value="Today">Today</option>
              <option value="Yesterday">Yesterday</option>
              <option value="Last7Days">Last 7 Days</option>
              <option value="Last30Days">Last 30 Days</option>
              <option value="Custom">Custom Date Range...</option>
            </select>
          </div>
        </div>

        {/* Custom Date Pickers (if chosen) */}
        {dateFilter === 'Custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-gray-100">
            <div>
              <label className="block text-[8px] font-bold text-gray-500 uppercase mb-0.5">Start Date</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-2.5 py-1.5 text-xs font-medium focus:border-[#A63228] outline-none text-gray-800"
              />
            </div>
            <div>
              <label className="block text-[8px] font-bold text-gray-500 uppercase mb-0.5">End Date</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-2.5 py-1.5 text-xs font-medium focus:border-[#A63228] outline-none text-gray-800"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── AUDIT LOGS TABLE ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-4 overflow-hidden">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[10px] font-extrabold text-gray-900 tracking-wider uppercase">ACTIVITY AUDIT TRAIL</h3>
            <span className="text-[9px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
              {filteredLogs.length} Records
            </span>
          </div>
          <span className="text-[8px] text-gray-400 font-bold uppercase tracking-widest hidden sm:inline">
            Immutable Audit Trail • Real-Time Capture
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-[8px] font-bold text-gray-400 pb-2 w-[16%] uppercase tracking-wider">TIMESTAMP</th>
                <th className="text-[8px] font-bold text-gray-400 pb-2 w-[18%] uppercase tracking-wider">ACTOR / USER</th>
                <th className="text-[8px] font-bold text-gray-400 pb-2 w-[14%] uppercase tracking-wider">MODULE & ACTION</th>
                <th className="text-[8px] font-bold text-gray-400 pb-2 w-[30%] uppercase tracking-wider">EVENT DESCRIPTION</th>
                <th className="text-[8px] font-bold text-gray-400 pb-2 w-[12%] uppercase tracking-wider text-center">IP & SOURCE</th>
                <th className="text-[8px] font-bold text-gray-400 pb-2 w-[10%] uppercase tracking-wider text-center pr-2">STATUS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-xs text-gray-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="w-6 h-6 border-2 border-[#A63228] border-t-transparent rounded-full animate-spin"></div>
                      <span>Ikinakarga ang audit logs...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const initial = (log.actor_name || 'AD').trim().charAt(0).toUpperCase();
                  const isSuccess = (log.status || 'SUCCESS').toUpperCase() === 'SUCCESS';

                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className="hover:bg-gray-50/70 transition-colors border-b border-gray-50 cursor-pointer group"
                      title="I-click upang makita ang buong detalye"
                    >
                      {/* Timestamp */}
                      <td className="py-2.5 text-[9px] font-medium text-gray-600">
                        <div className="font-bold text-gray-900">{log.date || '—'}</div>
                        <div className="text-[8px] text-gray-400 flex items-center gap-1 mt-0.5">
                          <span>{log.time || '—'}</span>
                          <span>•</span>
                          <span className="text-[#A63228] font-bold">{formatRelativeTime(log.timestamp)}</span>
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#fce8e6] text-[#A63228] font-extrabold text-[10px] flex items-center justify-center shrink-0">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <span className="text-[10px] font-extrabold text-gray-900 block truncate">
                              {log.actor_name || 'System'}
                            </span>
                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block truncate">
                              {log.actor_role || 'Staff / Officer'}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Module & Action */}
                      <td className="py-2.5">
                        <span className={`inline-block px-1.5 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${getModuleBadge(log.module)}`}>
                          {log.module || 'System'}
                        </span>
                        <span className="block text-[8px] font-extrabold text-gray-600 mt-0.5 truncate tracking-tight">
                          {log.action}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="py-2.5 text-[10px] font-medium text-gray-800 pr-2">
                        <p className="line-clamp-2 leading-relaxed">
                          {log.description}
                        </p>
                        {log.target_name && (
                          <span className="text-[8px] text-gray-400 font-bold mt-0.5 block truncate">
                            Target: {log.target_name}
                          </span>
                        )}
                      </td>

                      {/* IP & Source */}
                      <td className="py-2.5 text-center">
                        <span className="text-[9px] font-mono font-bold text-gray-600 block">
                          {log.ip_address || '127.0.0.1'}
                        </span>
                        <span className="text-[8px] text-gray-400 font-medium block truncate max-w-[120px] mx-auto">
                          {log.user_agent ? (log.user_agent.includes('Mobile') ? 'Mobile App' : 'Web App') : 'Web App'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 text-center pr-2">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider ${
                          isSuccess
                            ? 'bg-[#e6f4ea] text-[#2e7d32]'
                            : 'bg-[#fdecea] text-[#A63228]'
                        }`}>
                          <span>{isSuccess ? '✓' : '✕'}</span>
                          <span>{log.status || 'SUCCESS'}</span>
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-xs text-gray-400 italic">
                    No audit logs found matching your selected criteria.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── AUDIT LOG DETAILS MODAL ── */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex justify-between items-start p-5 border-b border-gray-100 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[8px] font-bold border uppercase tracking-wider ${getModuleBadge(selectedLog.module)}`}>
                    {selectedLog.module}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider ${
                    (selectedLog.status || 'SUCCESS') === 'SUCCESS' ? 'bg-[#e6f4ea] text-[#2e7d32]' : 'bg-[#fdecea] text-[#A63228]'
                  }`}>
                    {selectedLog.status || 'SUCCESS'}
                  </span>
                </div>
                <h3 className="text-sm font-extrabold text-gray-900 mt-1">Audit Record Inspection</h3>
                <p className="text-[10px] text-gray-500 font-mono">ID: {selectedLog.id}</p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-gray-400 hover:text-gray-700 bg-gray-50 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Modal Content */}
            <div className="overflow-y-auto p-5 space-y-4">
              {/* Description Callout */}
              <div className="bg-gray-50 p-3.5 rounded-xl border border-gray-100">
                <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1">EVENT SUMMARY</span>
                <p className="text-xs font-bold text-gray-900 leading-relaxed">
                  {selectedLog.description}
                </p>
              </div>

              {/* Actor & Action Grid */}
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                <div className="bg-white p-3 rounded-lg border border-gray-100">
                  <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">PERFORMED BY</span>
                  <strong className="text-gray-900 font-extrabold text-xs block">{selectedLog.actor_name || 'System'}</strong>
                  <span className="text-gray-500 font-bold uppercase text-[9px]">{selectedLog.actor_role || 'Staff / Officer'}</span>
                  {selectedLog.actor_id && <span className="block text-[8px] font-mono text-gray-400 mt-0.5">ID: {selectedLog.actor_id}</span>}
                </div>

                <div className="bg-white p-3 rounded-lg border border-gray-100">
                  <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">ACTION EVENT</span>
                  <strong className="text-[#A63228] font-extrabold text-xs block">{selectedLog.action}</strong>
                  <span className="text-gray-500 font-medium text-[9px]">{selectedLog.date} • {selectedLog.time}</span>
                </div>
              </div>

              {/* Target & Network Details */}
              <div className="grid grid-cols-2 gap-3 text-[10px]">
                <div className="bg-white p-3 rounded-lg border border-gray-100">
                  <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">TARGET RECORD</span>
                  <strong className="text-gray-900 font-bold block">{selectedLog.target_name || 'N/A'}</strong>
                  <span className="text-[8px] font-mono text-gray-400">Target ID: {selectedLog.target_id || 'N/A'}</span>
                </div>

                <div className="bg-white p-3 rounded-lg border border-gray-100">
                  <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-0.5">IP & ENVIRONMENT</span>
                  <strong className="text-gray-900 font-mono block">{selectedLog.ip_address || '127.0.0.1'}</strong>
                  <span className="text-[8px] text-gray-500 truncate block mt-0.5" title={selectedLog.user_agent}>
                    {selectedLog.user_agent || 'Web Client'}
                  </span>
                </div>
              </div>

              {/* Raw JSON Payload (if details exist) */}
              {selectedLog.details && (
                <div>
                  <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider mb-1">RAW TRANSACTION METADATA (PAYLOAD)</span>
                  <pre className="bg-gray-900 text-emerald-400 p-3 rounded-xl text-[9px] font-mono overflow-x-auto max-h-48 leading-relaxed">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-5 py-2 bg-gray-200 text-gray-800 rounded-lg text-xs font-bold hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

