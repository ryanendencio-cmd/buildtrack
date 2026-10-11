import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from '../components/AdminLayout';
import { api } from '../api';

export default function WorkersSalary() {
  const [activeTab, setActiveTab] = useState('worksheet'); // 'worksheet' | 'history'
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Projects
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('ALL');

  // Cutoff Dates
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const curYear = today.getFullYear();
  const curMonth = today.getMonth();
  const curDate = today.getDate();

  // Default to semi-monthly cutoff
  const defaultStart = curDate <= 15
    ? `${curYear}-${String(curMonth + 1).padStart(2, '0')}-01`
    : `${curYear}-${String(curMonth + 1).padStart(2, '0')}-16`;

  const defaultEnd = curDate <= 15
    ? `${curYear}-${String(curMonth + 1).padStart(2, '0')}-15`
    : `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(new Date(curYear, curMonth + 1, 0).getDate()).padStart(2, '0')}`;

  const [cutoffPreset, setCutoffPreset] = useState('CurrentSemiMonthly');
  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);

  // Payroll Data
  const [payrollData, setPayrollData] = useState({
    summary: { totalGrossPay: 0, totalCashAdvances: 0, totalLateDeductions: 0, totalNetPayout: 0, totalWorkers: 0, totalHours: 0 },
    workers: []
  });
  const [searchWorker, setSearchWorker] = useState('');
  const [selectedWorkerModal, setSelectedWorkerModal] = useState(null);

  // Past Payrolls
  const [pastPayrolls, setPastPayrolls] = useState([]);
  const [selectedPastPayroll, setSelectedPastPayroll] = useState(null);

  // Load Projects and initial Payroll
  useEffect(() => {
    api.get('/projects').then(data => {
      if (Array.isArray(data)) setProjects(data);
    }).catch(console.error);

    fetchPastPayrolls();
  }, []);

  const fetchPastPayrolls = () => {
    api.get('/payroll').then(data => {
      if (Array.isArray(data)) setPastPayrolls(data);
    }).catch(console.error);
  };

  // Preset Handler
  const handlePresetChange = (preset) => {
    setCutoffPreset(preset);
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    if (preset === '1stHalf') {
      setStartDate(`${y}-${String(m + 1).padStart(2, '0')}-01`);
      setEndDate(`${y}-${String(m + 1).padStart(2, '0')}-15`);
    } else if (preset === '2ndHalf') {
      const lastDay = new Date(y, m + 1, 0).getDate();
      setStartDate(`${y}-${String(m + 1).padStart(2, '0')}-16`);
      setEndDate(`${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`);
    } else if (preset === 'ThisWeek') {
      const d = new Date(now);
      const day = d.getDay();
      const diffToMon = d.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(d.setDate(diffToMon));
      const sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      setStartDate(mon.toISOString().slice(0, 10));
      setEndDate(sun.toISOString().slice(0, 10));
    } else if (preset === 'LastWeek') {
      const d = new Date(now);
      const day = d.getDay();
      const diffToMon = d.getDate() - day - 6 + (day === 0 ? -6 : 1);
      const mon = new Date(d.setDate(diffToMon));
      const sun = new Date(mon);
      sun.setDate(sun.getDate() + 6);
      setStartDate(mon.toISOString().slice(0, 10));
      setEndDate(sun.toISOString().slice(0, 10));
    } else if (preset === 'CurrentSemiMonthly') {
      setStartDate(defaultStart);
      setEndDate(defaultEnd);
    }
  };

  // Generate Payroll from Attendance
  const generatePayroll = async (start = startDate, end = endDate, pid = selectedProject) => {
    setIsGenerating(true);
    setLoading(true);
    try {
      const res = await api.get(`/payroll/generate?startDate=${start}&endDate=${end}&project_id=${pid}`);
      if (res && res.workers) {
        setPayrollData(res);
      }
    } catch (err) {
      console.error('Failed to generate payroll:', err);
      alert('An error occurred while calculating the payroll.');
    } finally {
      setIsGenerating(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    generatePayroll(startDate, endDate, selectedProject);
  }, [startDate, endDate, selectedProject]);

  // Filter workers in table
  const filteredWorkers = useMemo(() => {
    if (!payrollData.workers) return [];
    if (!searchWorker.trim()) return payrollData.workers;
    const q = searchWorker.toLowerCase().trim();
    return payrollData.workers.filter(w =>
      (w.worker_name || '').toLowerCase().includes(q) ||
      (w.role || '').toLowerCase().includes(q)
    );
  }, [payrollData.workers, searchWorker]);

  // Save Payroll (Draft or Released)
  const handleSavePayroll = async (status = 'Draft') => {
    if (!payrollData.workers || payrollData.workers.length === 0) {
      alert('No worker data available for this payroll.');
      return;
    }

    const confirmMsg = status === 'Paid'
      ? `Are you sure you want to RELEASE Payroll for ${startDate} to ${endDate}?\nTotal Net Payout: ₱${Number(payrollData.summary.totalNetPayout).toLocaleString()}`
      : `Save this payroll as ${status}?`;

    if (!confirm(confirmMsg)) return;

    try {
      const adminName = localStorage.getItem('adminName') || 'Admin';
      const projName = selectedProject === 'ALL'
        ? 'All Projects'
        : (projects.find(p => String(p.id) === String(selectedProject))?.name || 'Project Site');

      await api.post('/payroll', {
        startDate,
        endDate,
        project_id: selectedProject,
        project_name: projName,
        summary: payrollData.summary,
        workers: payrollData.workers,
        status,
        created_by: adminName
      });

      alert(`Payroll successfully ${status === 'Paid' ? 'released' : 'saved'}!`);
      fetchPastPayrolls();
      if (status === 'Paid') {
        // Refresh calculation so already deducted cash advances reflect
        generatePayroll();
      }
    } catch (err) {
      console.error(err);
      alert('An error occurred while saving the payroll.');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!payrollData.workers?.length) return;

    const headers = [
      'Worker Name',
      'Role',
      'Daily Rate (PHP)',
      'Worked Days',
      'Present Days',
      'Late Days',
      'Halfday Days',
      'Absent Days',
      'Total Hours',
      'Gross Pay (PHP)',
      'Late Penalties (PHP)',
      'Cash Advance Deductions (PHP)',
      'Net Pay (PHP)'
    ];

    const rows = payrollData.workers.map(w => [
      `"${w.worker_name}"`,
      `"${w.role}"`,
      w.daily_rate,
      w.worked_days,
      w.present_days,
      w.late_days,
      w.halfday_days,
      w.absent_days,
      w.total_hours,
      w.gross_pay,
      w.late_deductions,
      w.cash_advance_deductions,
      w.net_pay
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Payroll_${startDate}_to_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <AdminLayout>
      {/* ── HEADER ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 mb-3 border-b border-gray-200/60 gap-3">
        <div>
          <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">SALARY & PAYROLL SYSTEM</span>
          <h1 className="text-xl font-extrabold text-gray-900 mt-0.5 tracking-tight flex items-center gap-2">
            Workers Salary & Payroll
            <span className="text-[10px] font-bold bg-[#A63228]/10 text-[#A63228] px-2 py-0.5 rounded-full">
              Auto-Calculated
            </span>
          </h1>
          <p className="text-[10px] text-gray-500 mt-0.5">
            Salaries are automatically calculated based on attendance hours, daily rates, and deductions for late, half-day, absences, and cash advances.
          </p>
        </div>

        {/* Top Action Tabs */}
        <div className="flex items-center gap-2 print:hidden">
          <div className="bg-gray-100 p-0.5 rounded-lg flex text-[10px] font-bold">
            <button
              onClick={() => setActiveTab('worksheet')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'worksheet'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              ⚡ Live Payroll Worksheet
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-3 py-1.5 rounded-md transition-all ${
                activeTab === 'history'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              📋 Payroll History ({pastPayrolls.length})
            </button>
          </div>
        </div>
      </div>

      {activeTab === 'worksheet' ? (
        <>
          {/* ── CUTOFF FILTER CONTROLS ── */}
          <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-xs mb-3 print:hidden">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              {/* Presets & Dates */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">CUTOFF PRESET:</span>
                <div className="flex flex-wrap gap-1">
                  {[
                    { id: 'CurrentSemiMonthly', label: 'Current Cutoff' },
                    { id: '1stHalf', label: '1st - 15th' },
                    { id: '2ndHalf', label: '16th - End' },
                    { id: 'ThisWeek', label: 'This Week' },
                    { id: 'LastWeek', label: 'Last Week' },
                    { id: 'Custom', label: 'Custom' }
                  ].map(p => (
                    <button
                      key={p.id}
                      onClick={() => handlePresetChange(p.id)}
                      className={`text-[9.5px] px-2.5 py-1 rounded-md font-bold transition-all ${
                        cutoffPreset === p.id
                          ? 'bg-[#A63228] text-white shadow-xs'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 ml-0 lg:ml-2">
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => { setStartDate(e.target.value); setCutoffPreset('Custom'); }}
                    className="text-[10px] font-bold border border-gray-200 rounded-lg px-2 py-1 text-gray-700 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-[#A63228]"
                  />
                  <span className="text-gray-400 text-[10px] font-bold">to</span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => { setEndDate(e.target.value); setCutoffPreset('Custom'); }}
                    className="text-[10px] font-bold border border-gray-200 rounded-lg px-2 py-1 text-gray-700 bg-gray-50/50 focus:bg-white focus:outline-none focus:border-[#A63228]"
                  />
                </div>
              </div>

              {/* Project Filter & Recalculate */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedProject}
                  onChange={(e) => setSelectedProject(e.target.value)}
                  className="text-[10px] font-bold border border-gray-200 rounded-lg px-2.5 py-1 text-gray-700 bg-gray-50/50 focus:outline-none focus:border-[#A63228]"
                >
                  <option value="ALL">All Project Sites</option>
                  {projects.map(p => (
                    <option key={p.id} value={String(p.id)}>{p.name}</option>
                  ))}
                </select>

                <button
                  onClick={() => generatePayroll()}
                  disabled={isGenerating}
                  className="flex items-center gap-1.5 px-3 py-1 bg-gray-900 hover:bg-black text-white text-[10px] font-bold rounded-lg shadow-xs transition-all disabled:opacity-50"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isGenerating ? 'animate-spin' : ''}>
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <polyline points="1 20 1 14 7 14"></polyline>
                    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
                  </svg>
                  {isGenerating ? 'Computing...' : 'Recalculate'}
                </button>
              </div>
            </div>
          </div>

          {/* ── KPI METRIC CARDS ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 mb-3">
            {/* Total Gross Pay */}
            <div className="bg-white rounded-xl border border-gray-100 p-2.5 shadow-xs">
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">GROSS EARNED WAGES</span>
              <div className="text-base font-extrabold text-gray-900 tracking-tight">
                ₱{Number(payrollData.summary.totalGrossPay || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[8px] text-gray-500 font-medium">Gross pay before deductions</span>
            </div>

            {/* Total Late Penalties */}
            <div className="bg-white rounded-xl border border-gray-100 p-2.5 shadow-xs">
              <span className="text-[8px] font-bold text-amber-600 uppercase tracking-wider block mb-0.5">LATE DEDUCTIONS</span>
              <div className="text-base font-extrabold text-amber-700 tracking-tight">
                -₱{Number(payrollData.summary.totalLateDeductions || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[8px] text-gray-500 font-medium">Late & Double Late deductions</span>
            </div>

            {/* Total Cash Advances */}
            <div className="bg-white rounded-xl border border-gray-100 p-2.5 shadow-xs">
              <span className="text-[8px] font-bold text-rose-600 uppercase tracking-wider block mb-0.5">CASH ADVANCES</span>
              <div className="text-base font-extrabold text-rose-700 tracking-tight">
                -₱{Number(payrollData.summary.totalCashAdvances || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[8px] text-gray-500 font-medium">Deducted cash advances</span>
            </div>

            {/* Total Net Payout */}
            <div className="bg-white rounded-xl border-2 border-[#A63228]/20 p-2.5 shadow-xs bg-[#A63228]/2">
              <span className="text-[8px] font-bold text-[#A63228] uppercase tracking-wider block mb-0.5">TOTAL NET PAYOUT</span>
              <div className="text-lg font-black text-[#A63228] tracking-tight">
                ₱{Number(payrollData.summary.totalNetPayout || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <span className="text-[8px] text-[#A63228]/80 font-bold">Total net payout to workers</span>
            </div>

            {/* Total Workforce & Hours */}
            <div className="bg-white rounded-xl border border-gray-100 p-2.5 shadow-xs">
              <span className="text-[8px] font-bold text-gray-400 uppercase tracking-wider block mb-0.5">MANPOWER & HOURS</span>
              <div className="text-base font-extrabold text-gray-800 tracking-tight flex items-center gap-1.5">
                <span>{payrollData.summary.totalWorkers || 0} Workers</span>
                <span className="text-[9px] text-gray-400 font-bold">•</span>
                <span className="text-blue-600">{payrollData.summary.totalHours || 0} hrs</span>
              </div>
              <span className="text-[8px] text-gray-500 font-medium">Total recorded hours</span>
            </div>
          </div>

          {/* ── SEARCH & TABLE TOOLBAR ── */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden mb-3">
            <div className="p-3 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-2.5">
              <div className="relative flex-1 max-w-sm">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                </svg>
                <input
                  type="text"
                  placeholder="Search worker or role..."
                  value={searchWorker}
                  onChange={(e) => setSearchWorker(e.target.value)}
                  className="w-full text-[10px] pl-7 pr-3 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:border-[#A63228] bg-gray-50/50 focus:bg-white"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportCSV}
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-[9.5px] font-bold transition-all"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                    <polyline points="7 10 12 15 17 10"></polyline>
                    <line x1="12" y1="15" x2="12" y2="3"></line>
                  </svg>
                  Export CSV
                </button>

                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1 px-2.5 py-1.5 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg text-[9.5px] font-bold transition-all"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 6 2 18 2 18 9"></polyline>
                    <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                    <rect x="6" y="14" width="12" height="8"></rect>
                  </svg>
                  Print Summary
                </button>

                <button
                  onClick={() => handleSavePayroll('Draft')}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-[9.5px] font-bold transition-all"
                >
                  💾 Save Draft
                </button>

                <button
                  onClick={() => handleSavePayroll('Paid')}
                  className="flex items-center gap-1 px-3 py-1.5 bg-[#A63228] hover:bg-[#8e2920] text-white rounded-lg text-[9.5px] font-bold shadow-xs transition-all"
                >
                  ✅ Approve & Release Payroll
                </button>
              </div>
            </div>

            {/* ── WORKERS PAYROLL TABLE ── */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/80 border-b border-gray-100 text-[8px] font-extrabold text-gray-500 uppercase tracking-wider">
                    <th className="py-2.5 px-3">WORKER NAME & ROLE</th>
                    <th className="py-2.5 px-2 text-right">DAILY RATE</th>
                    <th className="py-2.5 px-2 text-center">WORKED DAYS</th>
                    <th className="py-2.5 px-2 text-center">ATTENDANCE SUMMARY</th>
                    <th className="py-2.5 px-2 text-center">TOTAL HOURS</th>
                    <th className="py-2.5 px-2 text-right">GROSS EARNED</th>
                    <th className="py-2.5 px-2 text-right">DEDUCTIONS (LATE / CA)</th>
                    <th className="py-2.5 px-3 text-right">NET TAKE-HOME</th>
                    <th className="py-2.5 px-3 text-center print:hidden">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 text-[10px]">
                  {loading ? (
                    <tr>
                      <td colSpan="9" className="py-10 text-center text-gray-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-[#A63228]">
                            <line x1="12" y1="2" x2="12" y2="6"></line>
                            <line x1="12" y1="18" x2="12" y2="22"></line>
                            <line x1="4.93" y1="4.93" x2="7.76" y2="7.76"></line>
                            <line x1="16.24" y1="16.24" x2="19.07" y2="19.07"></line>
                            <line x1="2" y1="12" x2="6" y2="12"></line>
                            <line x1="18" y1="12" x2="22" y2="12"></line>
                            <line x1="4.93" y1="19.07" x2="7.76" y2="16.24"></line>
                            <line x1="16.24" y1="7.76" x2="19.07" y2="4.93"></line>
                          </svg>
                          <span className="text-[10px] font-bold text-gray-500">Calculating payroll from attendance records...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredWorkers.length > 0 ? (
                    filteredWorkers.map(w => (
                      <tr key={w.worker_id} className="hover:bg-gray-50/50 transition-colors">
                        {/* Worker Name & Role */}
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#A63228]/10 text-[#A63228] font-black text-[9px] flex items-center justify-center shrink-0">
                              {w.worker_name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-extrabold text-gray-900 leading-tight">{w.worker_name}</div>
                              <div className="text-[8px] font-bold text-gray-400 uppercase tracking-wide">{w.role}</div>
                            </div>
                          </div>
                        </td>

                        {/* Daily Rate */}
                        <td className="py-2.5 px-2 text-right font-extrabold text-gray-700">
                          ₱{Number(w.daily_rate).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          <span className="block text-[7.5px] font-medium text-gray-400">₱{w.hourly_rate}/hr</span>
                        </td>

                        {/* Worked Days */}
                        <td className="py-2.5 px-2 text-center font-black text-gray-900">
                          {w.worked_days} days
                        </td>

                        {/* Attendance Breakdown Pills */}
                        <td className="py-2.5 px-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-[#e6f4ea] text-[#2e7d32]" title="Full Day Present (8 hrs)">
                              {w.present_days}P
                            </span>
                            {w.late_days > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-[#fff8e1] text-[#f57f17]" title={`Late days (-₱100 / -₱200)`}>
                                {w.late_days}L
                              </span>
                            )}
                            {w.halfday_days > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-[#ede7f6] text-[#5e35b1]" title="Halfday (4 hrs, 50% rate)">
                                {w.halfday_days}HD
                              </span>
                            )}
                            {w.absent_days > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-[#fdecea] text-[#A63228]" title="Absent days (0 wage)">
                                {w.absent_days}A
                              </span>
                            )}
                            {w.rest_days > 0 && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-extrabold bg-blue-50 text-blue-700" title="Rest Days / Non-working days">
                                {w.rest_days}OFF
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Total Hours */}
                        <td className="py-2.5 px-2 text-center font-bold text-blue-700">
                          {w.total_hours} hrs
                        </td>

                        {/* Gross Earned */}
                        <td className="py-2.5 px-2 text-right font-extrabold text-gray-900">
                          ₱{Number(w.gross_pay).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Deductions (Late + Cash Advance) */}
                        <td className="py-2.5 px-2 text-right">
                          {w.late_deductions > 0 || w.cash_advance_deductions > 0 ? (
                            <div>
                              <span className="font-extrabold text-rose-700">
                                -₱{Number(w.late_deductions + w.cash_advance_deductions).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                              <div className="text-[7.5px] text-gray-400">
                                {w.late_deductions > 0 && `Late: ₱${w.late_deductions} `}
                                {w.cash_advance_deductions > 0 && `CA: ₱${w.cash_advance_deductions}`}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 font-bold">₱0.00</span>
                          )}
                        </td>

                        {/* Net Take-Home */}
                        <td className="py-2.5 px-3 text-right">
                          <span className="text-xs font-black text-[#A63228]">
                            ₱{Number(w.net_pay).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-2.5 px-3 text-center print:hidden">
                          <button
                            onClick={() => setSelectedWorkerModal(w)}
                            className="px-2 py-1 bg-gray-100 hover:bg-[#A63228] hover:text-white text-gray-700 text-[8.5px] font-bold rounded transition-all"
                          >
                            🔍 Inspect Slip
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" className="py-8 text-center text-xs text-gray-400 italic">
                        No worker records found for cutoff {startDate} to {endDate}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* ── PAYROLL HISTORY TAB ── */
        <div className="bg-white rounded-xl border border-gray-100 shadow-xs overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">
              Past Payroll Runs ({pastPayrolls.length})
            </h2>
            <button
              onClick={fetchPastPayrolls}
              className="text-[9.5px] font-bold text-gray-500 hover:text-gray-900"
            >
              🔄 Refresh List
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100 text-[8px] font-extrabold text-gray-500 uppercase tracking-wider">
                  <th className="py-2.5 px-3">CUTOFF PERIOD</th>
                  <th className="py-2.5 px-2">PROJECT SITE</th>
                  <th className="py-2.5 px-2 text-center">WORKERS</th>
                  <th className="py-2.5 px-2 text-right">GROSS PAY</th>
                  <th className="py-2.5 px-2 text-right">CASH ADVANCES</th>
                  <th className="py-2.5 px-2 text-right">NET PAYOUT</th>
                  <th className="py-2.5 px-2 text-center">STATUS</th>
                  <th className="py-2.5 px-3 text-center">ACTION</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 text-[10px]">
                {pastPayrolls.length > 0 ? (
                  pastPayrolls.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-2.5 px-3 font-extrabold text-gray-900">
                        {p.cutoff_start} → {p.cutoff_end}
                      </td>
                      <td className="py-2.5 px-2 font-bold text-gray-700">
                        {p.project_name || 'All Projects'}
                      </td>
                      <td className="py-2.5 px-2 text-center font-bold text-gray-800">
                        {p.workers?.length || p.summary?.totalWorkers || 0}
                      </td>
                      <td className="py-2.5 px-2 text-right font-extrabold text-gray-900">
                        ₱{Number(p.summary?.totalGrossPay || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right font-extrabold text-rose-700">
                        -₱{Number(p.summary?.totalCashAdvances || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right font-black text-[#A63228]">
                        ₱{Number(p.summary?.totalNetPayout || 0).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wider ${
                          p.status === 'Paid' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                          p.status === 'Approved' ? 'bg-blue-50 text-blue-800 border border-blue-200' :
                          'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}>
                          {p.status || 'Draft'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={() => {
                            setPayrollData({
                              summary: p.summary || {},
                              workers: p.workers || []
                            });
                            setStartDate(p.cutoff_start);
                            setEndDate(p.cutoff_end);
                            setSelectedProject(p.project_id || 'ALL');
                            setActiveTab('worksheet');
                          }}
                          className="px-2.5 py-1 bg-gray-900 text-white hover:bg-black rounded text-[8.5px] font-bold transition-all"
                        >
                          View / Open
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="py-8 text-center text-xs text-gray-400 italic">
                      No recorded payroll history runs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── DETAILED WORKER PAYSLIP MODAL ── */}
      {selectedWorkerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden">
            {/* Modal Header */}
            <div className="p-3.5 bg-gray-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#A63228] text-white font-black text-xs flex items-center justify-center">
                  {selectedWorkerModal.worker_name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xs font-extrabold text-white leading-tight">
                    {selectedWorkerModal.worker_name}
                  </h3>
                  <p className="text-[9px] text-gray-300 font-bold uppercase tracking-wider">
                    {selectedWorkerModal.role} • Daily Rate: ₱{Number(selectedWorkerModal.daily_rate).toLocaleString()} (₱{selectedWorkerModal.hourly_rate}/hr)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedWorkerModal(null)}
                className="text-gray-400 hover:text-white p-1 rounded-md"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-3.5 text-[10px]">
              {/* Cutoff & Summary Banner */}
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 grid grid-cols-4 gap-2 text-center">
                <div>
                  <span className="text-[8px] font-bold text-gray-400 uppercase block">CUTOFF PERIOD</span>
                  <strong className="text-gray-800 text-[9.5px]">{startDate} → {endDate}</strong>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-gray-400 uppercase block">WORKED DAYS</span>
                  <strong className="text-gray-800 text-[9.5px]">{selectedWorkerModal.worked_days} Days ({selectedWorkerModal.total_hours} hrs)</strong>
                </div>
                <div>
                  <span className="text-[8px] font-bold text-gray-400 uppercase block">GROSS WAGES</span>
                  <strong className="text-gray-900 text-[9.5px]">₱{Number(selectedWorkerModal.gross_pay).toLocaleString()}</strong>
                </div>
                <div className="bg-[#A63228]/5 rounded-lg py-1 border border-[#A63228]/20">
                  <span className="text-[8px] font-bold text-[#A63228] uppercase block">NET TAKE-HOME</span>
                  <strong className="text-[#A63228] text-[11px] font-black">₱{Number(selectedWorkerModal.net_pay).toLocaleString()}</strong>
                </div>
              </div>

              {/* Attendance Daily Logs Table */}
              <div>
                <h4 className="text-[9.5px] font-extrabold text-gray-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>Attendance & Daily Wage Logs</span>
                  <span className="text-[8.5px] font-medium text-gray-400">Total: {selectedWorkerModal.daily_logs?.length || 0} days in cutoff</span>
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-gray-100 text-[8px] font-extrabold text-gray-600 uppercase">
                      <tr>
                        <th className="py-1.5 px-2">DATE</th>
                        <th className="py-1.5 px-2 text-center">MORNING SHIFT</th>
                        <th className="py-1.5 px-2 text-center">AFTERNOON SHIFT</th>
                        <th className="py-1.5 px-2 text-center">STATUS</th>
                        <th className="py-1.5 px-2 text-center">HOURS</th>
                        <th className="py-1.5 px-2 text-right">EARNED WAGE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 text-[9px]">
                      {selectedWorkerModal.daily_logs?.map(log => (
                        <tr key={log.date} className="hover:bg-gray-50/50">
                          <td className="py-1.5 px-2 font-bold text-gray-900">{log.date}</td>
                          <td className="py-1.5 px-2 text-center text-gray-600 font-mono">
                            {log.morning_in !== '—' ? `${log.morning_in} → ${log.morning_out}` : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-center text-gray-600 font-mono">
                            {log.afternoon_in !== '—' ? `${log.afternoon_in} → ${log.afternoon_out}` : '—'}
                          </td>
                          <td className="py-1.5 px-2 text-center">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[7.5px] font-extrabold uppercase ${
                              log.status === 'Present' ? 'bg-[#e6f4ea] text-[#2e7d32]' :
                              log.status === 'Late' || log.status === 'Double Late' ? 'bg-[#fff8e1] text-[#f57f17]' :
                              log.status.includes('Halfday') ? 'bg-[#ede7f6] text-[#5e35b1]' :
                              log.status.includes('Rest Day') ? 'bg-blue-50 text-blue-700 font-bold' :
                              'bg-[#fdecea] text-[#A63228]'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="py-1.5 px-2 text-center font-bold text-gray-700">{log.hours}h</td>
                          <td className="py-1.5 px-2 text-right font-extrabold text-gray-900">
                            ₱{Number(log.earned).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            {log.deduction > 0 && (
                              <span className="block text-[7.5px] text-amber-600 font-bold">(-₱{log.deduction} late)</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Deductions: Cash Advances */}
              {selectedWorkerModal.cash_advances?.length > 0 && (
                <div>
                  <h4 className="text-[9.5px] font-extrabold text-rose-800 uppercase tracking-wider mb-1.5">
                    Deductions: Approved Cash Advances
                  </h4>
                  <div className="border border-rose-100 bg-rose-50/30 rounded-lg p-2 space-y-1">
                    {selectedWorkerModal.cash_advances.map(ca => (
                      <div key={ca.id} className="flex justify-between items-center text-[9px]">
                        <span className="font-bold text-gray-800">
                          {ca.date} — {ca.reason}
                        </span>
                        <span className="font-extrabold text-rose-700">
                          -₱{Number(ca.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Final Take-Home Box */}
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl space-y-1.5">
                <div className="flex justify-between text-gray-600">
                  <span>Regular Earned Wages:</span>
                  <span className="font-bold">₱{Number(selectedWorkerModal.gross_pay + selectedWorkerModal.late_deductions).toLocaleString()}</span>
                </div>
                {selectedWorkerModal.late_deductions > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <span>Late & Attendance Penalties:</span>
                    <span className="font-bold">-₱{Number(selectedWorkerModal.late_deductions).toLocaleString()}</span>
                  </div>
                )}
                {selectedWorkerModal.cash_advance_deductions > 0 && (
                  <div className="flex justify-between text-rose-700">
                    <span>Approved Cash Advance Deductions:</span>
                    <span className="font-bold">-₱{Number(selectedWorkerModal.cash_advance_deductions).toLocaleString()}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-1.5 flex justify-between items-center text-xs">
                  <span className="font-black text-gray-900 uppercase">NET TAKE-HOME PAY:</span>
                  <span className="font-black text-[#A63228] text-sm">
                    ₱{Number(selectedWorkerModal.net_pay).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-[8.5px] text-gray-400 font-medium">BuildTrack Construction ERP • Verified Attendance Payroll</span>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 bg-gray-900 hover:bg-black text-white text-[9.5px] font-bold rounded-lg transition-all"
              >
                🖨️ Print Individual Payslip
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

