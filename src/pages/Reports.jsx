import React, { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { api } from '../api'

export default function Reports() {
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const location = useLocation();
    const searchParams = new URLSearchParams(location.search);
    const initialTab = searchParams.get('tab') || 'summary';
    const initialProjectId = searchParams.get('project_id') || 'ALL';
    const [activeTab, setActiveTab] = useState(initialTab);
    const [reportType, setReportType] = useState('Expenses');
    const [selectedProject, setSelectedProject] = useState(initialProjectId);
    const [modalState, setModalState] = useState('NONE');
    const [projects, setProjects] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [monthlyData, setMonthlyData] = useState(Array(12).fill(0));
    const [budgetCategories, setBudgetCategories] = useState([]);
    const [budgetSummary, setBudgetSummary] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/projects').then(setProjects).catch(() => { });
    }, []);

    useEffect(() => {
        queueMicrotask(() => setLoading(true));
        const params = `?project_id=${selectedProject}&month=${selectedMonth}`;
        const pOnly = selectedProject ? `?project_id=${selectedProject}` : '';
        const endpoint = reportType === 'Expenses' ? `/reports/expenses${params}`
            : reportType === 'Manpower' ? `/reports/manpower${params}`
                : `/reports/assets?project_id=${selectedProject}`;
        api.get(endpoint).then(data => { setReportData(data); setLoading(false); }).catch(() => setLoading(false));
        api.get(`/expenses/monthly${pOnly}`).then(setMonthlyData).catch(() => { });
        api.get(`/expenses/budget-summary${pOnly}`).then(d => {
            setBudgetCategories(d?.categories || []);
            setBudgetSummary(d);
        }).catch(() => { });
    }, [selectedProject, selectedMonth, reportType]);

    const [year, monthNum] = selectedMonth ? selectedMonth.split('-') : [new Date().getFullYear(), '01'];
    const dateObj = new Date(year, parseInt(monthNum) - 1, 1);
    const displayMonth = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const currentMonth = new Date().getMonth();
    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const maxVal = Math.max(...monthlyData, 1);
    const fmt = v => v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? (v % 1000 === 0 ? `${v / 1000}k` : `${(v / 1000).toFixed(1)}k`) : v;
    const pointsWithData = monthlyData.map((v, i) => ({ v, i })).filter(p => p.v > 0);
    const polylinePoints = pointsWithData.map(p => `${p.i * 100},${110 - Math.round((p.v / maxVal) * 100)}`).join(' ');

    const getKpis = () => {
        if (!reportData) return [];
        if (reportType === 'Expenses') return [
            { label: 'TOTAL EXPENSES', value: `₱${Number(reportData.totalSpent || 0).toLocaleString()}`, color: 'text-[#A63228]' },
            { label: 'TOTAL BUDGET', value: `₱${Number(reportData.budget || 0).toLocaleString()}`, color: 'text-gray-900' },
            { label: 'REMAINING', value: `₱${Number(reportData.remaining || 0).toLocaleString()}`, color: 'text-[#2e7d32]' },
        ];
        if (reportType === 'Manpower') return [
            { label: 'TOTAL WAGE COST', value: `₱${Number(reportData.totalWage || 0).toLocaleString()}`, color: 'text-[#A63228]' },
            { label: 'PRESENT', value: `${reportData.present || 0} Workers`, color: 'text-[#2e7d32]' },
            { label: 'ABSENT', value: `${reportData.absent || 0} Workers`, color: 'text-gray-900' },
        ];
        if (reportType === 'Assets') return [
            { label: 'IN USE', value: `${reportData.inUse || 0} Tools`, color: 'text-[#A63228]' },
            { label: 'AVAILABLE', value: `${reportData.available || 0} Tools`, color: 'text-[#2e7d32]' },
            { label: 'MAINTENANCE', value: `${reportData.maintenance || 0} Tools`, color: 'text-gray-900' },
        ];
        return [];
    };

    const getHeaders = () => {
        if (reportType === 'Expenses') return selectedProject === 'ALL'
            ? ['DATE', 'PROJECT', 'RECEIPT NO.', 'CATEGORY', 'AMOUNT']
            : ['DATE', 'RECEIPT NO.', 'CATEGORY', 'AMOUNT'];
        if (reportType === 'Manpower') return ['DATE', 'WORKER', 'ROLE', 'STATUS', 'DAILY RATE'];
        if (reportType === 'Assets') return ['PROJECT', 'EQUIPMENT', 'TYPE', 'ASSIGNED TO', 'STATUS'];
        return [];
    };

    const getRows = () => {
        if (!reportData?.rows?.length) return [];
        if (reportType === 'Expenses') return reportData.rows.map(r => ({
            id: r.id,
            cols: selectedProject === 'ALL'
                ? [r.date, r.project, r.receipt_no || '—', r.category, `₱${Number(r.amount).toLocaleString()}`]
                : [r.date, r.receipt_no || '—', r.category, `₱${Number(r.amount).toLocaleString()}`]
        }));
        if (reportType === 'Manpower') return reportData.rows.map(r => ({
            id: r.id,
            cols: [r.date, r.worker_name, r.role || '—', r.status, `₱${Number(r.daily_rate || 0).toLocaleString()}`]
        }));
        if (reportType === 'Assets') return reportData.rows.map(r => ({
            id: r.id,
            cols: [r.project_name || '—', r.name, r.type || '—', r.assigned_to || '—', r.status]
        }));
        return [];
    };

    const getStatusColor = (text) => {
        if (typeof text !== 'string') return '';
        if (text === 'Available' || text === 'Present') return 'text-[#2e7d32]';
        if (text === 'In Use' || text === 'Absent') return 'text-[#A63228]';
        if (text === 'Maintenance') return 'text-[#ca8a04]';
        return '';
    };

    const handleExport = () => {
        const rowsData = getRows();
        if (!rowsData || rowsData.length === 0) {
            alert('No records available to export for the selected filters.');
            return;
        }

        setModalState('LOADING_EXPORT');

        const csvHeaders = getHeaders();
        const csvRows = rowsData.map(r => r.cols.map(c => `"${String(c || '').replace(/"/g, '""')}"`));
        const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [csvHeaders.join(','), ...csvRows.map(e => e.join(','))].join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `BuildTrack_${reportType}_Report_${selectedMonth}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        setTimeout(() => setModalState('SUCCESS_EXPORT'), 800);
    };

    const selectStyles = {
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 0.5rem center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '0.8rem 0.8rem'
    };

    const kpis = getKpis();
    const headers = getHeaders();
    const rows = getRows();

    return (
        <AdminLayout>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-2 print:hidden">
                <div>
                    <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">REPORTS</span>
                    <h1 className="text-xl font-extrabold text-[#1a1a1a] mt-0.5 tracking-tight">Reports & Analytics</h1>
                    <p className="text-[10px] text-gray-500 mt-0.5">Generate monthly summaries and visual analytics.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => window.print()} className="bg-white border border-[#A63228] text-[#A63228] w-[105px] h-8 rounded-lg font-bold text-[10px] shadow-sm hover:bg-red-50 transition-colors flex items-center justify-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                        Print Data
                    </button>
                    <button onClick={handleExport} className="bg-[#E8C547] text-gray-900 w-[105px] h-8 rounded-lg font-bold text-[10px] shadow-sm hover:bg-[#d4b33d] transition-colors flex items-center justify-center gap-1">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                        Export to Excel
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-4 flex flex-col md:flex-row gap-3 print:hidden">
                <div className="w-full md:w-40">
                    <label className="block text-[8px] font-bold text-gray-400 tracking-wider uppercase mb-1">MONTH / YEAR</label>
                    <input type="month" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg px-2.5 py-1.5 text-[10px] font-extrabold text-gray-800 outline-none focus:border-[#A63228] cursor-pointer" />
                </div>
                <div className="flex-1">
                    <label className="block text-[8px] font-bold text-gray-400 tracking-wider uppercase mb-1">PROJECT</label>
                    <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg pl-3 pr-8 py-1.5 text-[10px] font-extrabold text-gray-800 outline-none appearance-none" style={selectStyles}>
                        <option value="ALL">All Projects (Overview)</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name || p.title}</option>)}
                    </select>
                </div>
                <div className="w-full md:w-48">
                    <label className="block text-[8px] font-bold text-gray-400 tracking-wider uppercase mb-1">REPORT CATEGORY</label>
                    <select value={reportType} onChange={e => setReportType(e.target.value)} className="w-full bg-[#f4f1ee] border border-transparent rounded-lg pl-3 pr-8 py-1.5 text-[10px] font-bold text-gray-800 outline-none appearance-none" style={selectStyles}>
                        <option value="Expenses">Expenses & Budget</option>
                        <option value="Manpower">Attendance & Manpower</option>
                        <option value="Assets">Assets & Equipment</option>
                    </select>
                </div>
            </div>

            <div className="flex gap-4 border-b border-gray-100 mb-4 print:hidden">
                <button onClick={() => setActiveTab('summary')} className={`pb-2 text-[10px] font-bold transition-colors border-b-2 ${activeTab === 'summary' ? 'border-[#A63228] text-[#A63228]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>Data Report Table</button>
                <button onClick={() => setActiveTab('analytics')} className={`pb-2 text-[10px] font-bold transition-colors border-b-2 ${activeTab === 'analytics' ? 'border-[#A63228] text-[#A63228]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>Visual Analytics</button>
                <button onClick={() => setActiveTab('ai')} className={`pb-2 text-[10px] font-bold transition-colors border-b-2 flex items-center gap-1.5 ${activeTab === 'ai' ? 'border-[#A63228] text-[#A63228]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                    Advanced Analytics & Forecasting
                </button>
            </div>

            {/* ── PRINT-ONLY OFFICIAL DOCUMENT HEADER ── */}
            <div className="hidden print:block mb-5 border-b-2 border-gray-900 pb-3">
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <img src="/logo.png" alt="S-CON Logo" className="h-9 object-contain" />
                        <div>
                            <h1 className="text-base font-extrabold text-gray-900 tracking-wider">S-CON BUILDTRACK</h1>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest">Construction Management & Project Analytics</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="inline-block px-2.5 py-0.5 rounded bg-gray-100 text-[9px] font-extrabold text-gray-800 uppercase tracking-wider">
                            Official Report
                        </span>
                        <p className="text-[8px] text-gray-500 mt-1">Printed: {new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                    </div>
                </div>
                <div className="mt-3 pt-2.5 border-t border-gray-200 grid grid-cols-3 gap-2 text-[10px]">
                    <div>
                        <span className="text-gray-400 font-bold uppercase text-[8px] block">CATEGORY:</span>
                        <strong className="text-gray-900 font-bold">{reportType} Report</strong>
                    </div>
                    <div>
                        <span className="text-gray-400 font-bold uppercase text-[8px] block">PERIOD:</span>
                        <strong className="text-gray-900 font-bold">{displayMonth.toUpperCase()}</strong>
                    </div>
                    <div>
                        <span className="text-gray-400 font-bold uppercase text-[8px] block">PROJECT:</span>
                        <strong className="text-gray-900 font-bold">{selectedProject === 'ALL' ? 'All Projects (Overview)' : (projects.find(p => String(p.id) === String(selectedProject))?.name || 'Selected Project')}</strong>
                    </div>
                </div>
            </div>

            {activeTab === 'summary' && (
                <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-1">
                        {kpis.map((kpi, i) => (
                            <div key={i} className="bg-white p-3.5 rounded-xl shadow-sm border border-gray-100">
                                <p className="text-[8px] font-bold text-gray-400 tracking-wider uppercase mb-1">{kpi.label}</p>
                                <h2 className={`text-xl font-extrabold ${kpi.color}`}>{kpi.value}</h2>
                            </div>
                        ))}
                    </div>

                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 overflow-x-auto">
                        <h3 className="text-[9px] font-extrabold text-gray-900 tracking-wider uppercase mb-3">{reportType} DATA ({displayMonth.toUpperCase()})</h3>
                        {loading ? (
                            <div className="flex justify-center py-10"><div className="w-8 h-8 border-4 border-gray-100 border-t-[#A63228] rounded-full animate-spin"></div></div>
                        ) : (
                            <table className="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr>
                                        {headers.map((h, i) => (
                                            <th key={i} className={`text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 uppercase tracking-wider ${i === headers.length - 1 ? 'text-right pr-2' : ''}`}>{h}</th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length > 0 ? rows.map(row => (
                                        <tr key={row.id}>
                                            {row.cols.map((col, ci) => (
                                                <td key={ci} className={`py-2.5 text-[10px] border-b border-gray-50 ${ci === row.cols.length - 1 ? 'text-right pr-2 font-extrabold' : 'font-medium text-gray-700'} ${getStatusColor(col)}`}>
                                                    {col}
                                                </td>
                                            ))}
                                        </tr>
                                    )) : (
                                        <tr><td colSpan={headers.length} className="py-8 text-center text-[10px] text-gray-400 italic">No records found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'analytics' && (
                <div className="flex flex-col gap-4">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* LINE GRAPH */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                            <h3 className="text-xs font-extrabold text-gray-900 mb-1">Expense Trajectory</h3>
                            <p className="text-[9px] text-gray-500 font-medium mb-4">Full year moving trend (Jan - Dec).</p>
                            <div className="relative h-28 w-full mb-1">
                                <div className="px-3 h-full w-full">
                                    <svg viewBox="0 -30 1100 160" className="w-full h-full overflow-visible">
                                        <line x1="0" y1="20" x2="1100" y2="20" stroke="#f3f4f6" strokeWidth="3" />
                                        <line x1="0" y1="65" x2="1100" y2="65" stroke="#f3f4f6" strokeWidth="3" />
                                        <line x1="0" y1="110" x2="1100" y2="110" stroke="#f3f4f6" strokeWidth="3" />
                                        {pointsWithData.length > 1 && <polyline points={polylinePoints} fill="none" stroke="#A63228" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />}
                                        {pointsWithData.map((p, idx) => {
                                            const cx = p.i * 100;
                                            const cy = 110 - Math.round((p.v / maxVal) * 100);
                                            const isLast = idx === pointsWithData.length - 1;
                                            return (
                                                <g key={p.i}>
                                                    <circle cx={cx} cy={cy} r={isLast ? 14 : 10} fill="#A63228" />
                                                    <text x={cx} y={cy - 20} fontSize={isLast ? 26 : 22} fontWeight={isLast ? 'bold' : 'normal'} fill={isLast ? '#1a1a1a' : '#9ca3af'} textAnchor="middle">₱{fmt(p.v)}</text>
                                                </g>
                                            );
                                        })}
                                        {pointsWithData.length === 0 && <text x="550" y="65" fontSize="28" fill="#d1d5db" textAnchor="middle">No expense data yet</text>}
                                    </svg>
                                </div>
                                <div className="flex justify-between px-3 text-[7px] font-bold text-gray-400 uppercase mt-2">
                                    {MONTHS.map((m, i) => <span key={m} className={i === currentMonth ? 'text-gray-900' : ''}>{m}</span>)}
                                </div>
                            </div>
                        </div>

                        {/* BAR GRAPH */}
                        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                            <h3 className="text-xs font-extrabold text-gray-900 mb-1">Monthly Volume</h3>
                            <p className="text-[9px] text-gray-500 font-medium mb-4">Total expenses tracked annually.</p>
                            <div className="relative h-28 w-full flex flex-col justify-end">
                                <div className="flex items-end justify-between h-24 px-3 border-b border-gray-100 pb-1">
                                    {monthlyData.map((val, i) => {
                                        const heightPct = maxVal > 0 ? Math.round((val / maxVal) * 98) : 0;
                                        const isCurrent = i === currentMonth;
                                        return (
                                            <div key={i} className="w-[5%] flex flex-col items-center h-full justify-end relative group">
                                                {val > 0 && <span className={`absolute -top-4 font-bold z-10 ${isCurrent ? 'text-[7px] text-[#1a1a1a] font-extrabold' : 'text-[6px] text-gray-400 hidden group-hover:block'}`}>₱{fmt(val)}</span>}
                                                <div className={`w-full rounded-t-sm transition-all cursor-pointer ${isCurrent ? 'bg-[#A63228] shadow-sm' : val > 0 ? 'bg-[#fce8e6] hover:bg-[#A63228]' : 'bg-transparent'}`} style={{ height: `${heightPct}%` }} />
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="flex justify-between px-3 text-[7px] font-bold text-gray-400 uppercase mt-2">
                                    {MONTHS.map((m, i) => <span key={m} className={i === currentMonth ? 'text-gray-900' : ''}>{m}</span>)}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* BUDGET BREAKDOWN */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                        <h3 className="text-[10px] font-extrabold text-gray-900 uppercase tracking-wider mb-4">Budget Breakdown by Category</h3>
                        {budgetCategories.length === 0 ? (
                            <p className="text-[10px] text-gray-400 text-center py-4">No expense data yet.</p>
                        ) : (() => {
                            const totalCat = budgetCategories.reduce((s, c) => s + Number(c.total), 0);
                            const colors = ['bg-[#A63228]', 'bg-[#D96B60]', 'bg-[#7A1E18]', 'bg-[#E58B80]', 'bg-[#4A120E]'];
                            const textColors = ['text-[#A63228]', 'text-[#D96B60]', 'text-[#7A1E18]', 'text-[#E58B80]', 'text-[#4A120E]'];
                            return (
                                <div className="flex flex-col gap-4">
                                    {budgetCategories.map((cat, i) => {
                                        const pct = totalCat > 0 ? Math.round((Number(cat.total) / totalCat) * 100) : 0;
                                        return (
                                            <div key={i}>
                                                <div className="flex justify-between text-[9px] font-bold mb-1">
                                                    <span className="text-gray-600">{cat.category} ({pct}%)</span>
                                                    <span className={textColors[i % textColors.length]}>₱{Number(cat.total).toLocaleString()}</span>
                                                </div>
                                                <div className="w-full bg-gray-100 rounded-full h-2.5">
                                                    <div className={`${colors[i % colors.length]} h-full rounded-full`} style={{ width: `${pct}%` }}></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {activeTab === 'ai' && (() => {
                const totalSpent = Number(budgetSummary?.totalSpent ?? reportData?.totalSpent ?? 0);
                const totalBudget = Number(budgetSummary?.totalBudget ?? reportData?.budget ?? 0);
                const remaining = Number(budgetSummary?.remaining ?? (totalBudget - totalSpent));
                const utilizationPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

                // Categories dataset (Sorted by spend, using S-CON Maroon corporate palette)
                const rawCatList = budgetCategories && budgetCategories.length > 0
                    ? budgetCategories.slice(0, 5)
                    : [];
                const catList = [...rawCatList].sort((a, b) => Number(b.total) - Number(a.total));
                const totalCatVal = catList.reduce((s, c) => s + Number(c.total), 0);
                const PIE_COLORS = ['#A63228', '#D96B60', '#7A1E18', '#E58B80', '#4A120E', '#F4B0A7'];

                // ── 1. DESCRIPTIVE ANALYTICS CALCULATIONS (Pie Chart & Monthly Volume Columns) ──
                let curAngle = 0;
                const pieSlices = catList.map((c, i) => {
                    const val = Number(c.total);
                    const pct = totalCatVal > 0 ? Math.round((val / totalCatVal) * 100) : 0;
                    const deg = totalCatVal > 0 ? (val / totalCatVal) * 360 : 0;
                    const start = curAngle;
                    const end = curAngle + deg;
                    curAngle = end;

                    const toRad = (a) => ((a - 90) * Math.PI) / 180;
                    const x1 = 80 + 64 * Math.cos(toRad(start));
                    const y1 = 80 + 64 * Math.sin(toRad(start));
                    const x2 = 80 + 64 * Math.cos(toRad(end));
                    const y2 = 80 + 64 * Math.sin(toRad(end));
                    const largeArc = deg > 180 ? 1 : 0;
                    const path = `M 80 80 L ${x1.toFixed(2)} ${y1.toFixed(2)} A 64 64 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;

                    const mid = start + deg / 2;
                    const lx = 80 + 42 * Math.cos(toRad(mid));
                    const ly = 80 + 42 * Math.sin(toRad(mid));

                    return { ...c, val, pct, path, lx, ly, color: PIE_COLORS[i % PIE_COLORS.length] };
                });

                const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                const maxMonthlySpend = Math.max(...monthlyData, 1);

                // ── 2. PREDICTIVE ANALYTICS CALCULATIONS (Linear Regression 15-Month Forecast) ──
                const pointsWithSpend = monthlyData.map((v, i) => ({ x: i + 1, y: Number(v) || 0 })).filter(p => p.y > 0);
                let slope = 0;
                let intercept = 0;

                if (pointsWithSpend.length >= 2) {
                    const n = pointsWithSpend.length;
                    const sX = pointsWithSpend.reduce((s, p) => s + p.x, 0);
                    const sY = pointsWithSpend.reduce((s, p) => s + p.y, 0);
                    const sXY = pointsWithSpend.reduce((s, p) => s + p.x * p.y, 0);
                    const sX2 = pointsWithSpend.reduce((s, p) => s + p.x * p.x, 0);
                    const denom = (n * sX2 - sX * sX);
                    if (denom !== 0) {
                        slope = (n * sXY - sX * sY) / denom;
                        intercept = (sY - slope * sX) / n;
                    }
                } else if (pointsWithSpend.length === 1) {
                    const px = pointsWithSpend[0].x;
                    const py = pointsWithSpend[0].y;
                    slope = Math.round(py * 0.04);
                    intercept = py - slope * px;
                } else {
                    const base = totalSpent > 0 ? totalSpent / Math.max(new Date().getMonth() + 1, 1) : 0;
                    slope = 0;
                    intercept = base;
                }

                const curM = new Date().getMonth() + 1;

                // 15-Month Table (Strictly reflects real project database, projecting future months)
                const forecastRows = Array.from({ length: 15 }, (_, i) => {
                    const m = i + 1;
                    const isFuture = m > curM;
                    const rawSpend = i < 12 ? Number(monthlyData[i] || 0) : null;
                    const predicted = Math.max(0, slope * m + intercept);

                    const isForecastRow = isFuture || totalSpent === 0;
                    const actual = isFuture ? null : rawSpend;
                    const displayVal = isForecastRow
                        ? (predicted > 0 ? predicted.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00')
                        : (rawSpend > 0 ? Number(rawSpend).toLocaleString('en-US') : '0');

                    return {
                        month: m,
                        actual,
                        predicted,
                        displayVal,
                        isForecastRow
                    };
                });

                const eqSlope = Math.abs(slope) >= 1 ? slope.toFixed(1) : slope.toFixed(2);
                const eqIntercept = Math.round(Math.abs(intercept)).toLocaleString();
                const eqSign = intercept >= 0 ? '+' : '-';
                const equationStr = `y = ${eqSlope}x ${eqSign} ${eqIntercept}`;
                const forecastMonth15 = forecastRows[14].predicted;

                const maxY = Math.ceil(Math.max(...forecastRows.map(r => Math.max(r.actual || 0, r.predicted)), 30000) / 10000) * 10000;
                const actualPoints = forecastRows.filter(r => r.actual !== null && r.actual > 0);
                const actualPolyline = actualPoints.map(r => `${55 + ((r.month - 1) / 14) * 455},${195 - (r.actual / maxY) * 165}`).join(' ');

                // ── 3. PRESCRIPTIVE ANALYTICS CALCULATIONS (Actual vs. Prescribed Target Bars) ──
                const targetWeights = [0.38, 0.28, 0.16, 0.11, 0.07];
                const targetBenchmarkLabels = ['38% Budget Benchmark', '28% Budget Benchmark', '16% Budget Benchmark', '11% Budget Benchmark', '7% Budget Benchmark'];
                const prescriptiveBars = catList.map((cat, idx) => {
                    const actual = Number(cat.total);
                    const targetCap = totalBudget > 0 ? Math.round(totalBudget * targetWeights[idx]) : Math.round(actual * 0.9);
                    const diff = actual - targetCap;
                    const pctDiff = targetCap > 0 ? Math.round((diff / targetCap) * 100) : 0;
                    const isOver = diff > 0;
                    return {
                        ...cat,
                        actual,
                        targetCap,
                        benchmarkLabel: targetBenchmarkLabels[idx] || 'Industry Allocation',
                        diff,
                        pctDiff,
                        isOver
                    };
                });
                const maxPrescriptiveVal = Math.max(...prescriptiveBars.flatMap(b => [b.actual, b.targetCap]), 1);

                // DYNAMIC RISK DISTRIBUTION (Calculated directly from cost center health)
                const totalCategoriesCount = prescriptiveBars.length;
                const highRiskCount = prescriptiveBars.filter(b => b.isOver).length;
                const watchlistCount = prescriptiveBars.filter(b => !b.isOver && b.actual > b.targetCap * 0.75).length;
                const onTargetCount = totalCategoriesCount - highRiskCount - watchlistCount;

                const safePct = totalCategoriesCount > 0 ? Math.round((onTargetCount / totalCategoriesCount) * 100) : 100;
                const riskPct = totalCategoriesCount > 0 ? Math.round((highRiskCount / totalCategoriesCount) * 100) : 0;
                const cautionPct = Math.max(0, 100 - (safePct + riskPct));

                return (
                    <div className="flex flex-col gap-6">
                        {/* CORPORATE EXECUTIVE HEADER */}
                        <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div>
                                <h2 className="text-sm font-extrabold text-gray-900 tracking-wide uppercase">
                                    Project Financial Analytics &amp; Forecasting Dashboard
                                </h2>
                                <p className="text-[10px] text-gray-500 mt-0.5">
                                    Structured by statistical function: Descriptive (historical breakdown), Predictive (linear regression forecast), and Prescriptive (target budget comparison).
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="text-right border-r border-gray-200 pr-3">
                                    <p className="text-[8px] font-bold text-gray-400 uppercase">Total Budget</p>
                                    <p className="text-xs font-extrabold text-gray-900">₱{totalBudget.toLocaleString()}</p>
                                </div>
                                <div className="text-right border-r border-gray-200 pr-3">
                                    <p className="text-[8px] font-bold text-gray-400 uppercase">Actual Spend</p>
                                    <p className="text-xs font-extrabold text-[#A63228]">₱{totalSpent.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[8px] font-bold text-gray-400 uppercase">Remaining</p>
                                    <p className="text-xs font-extrabold text-emerald-600">₱{remaining.toLocaleString()}</p>
                                </div>
                            </div>
                        </div>

                        {/* ══════════════════════════════════════════════════════════
                            1. DESCRIPTIVE ANALYTICS ("Ano ang nangyari?")
                            Charts: Expense Share (Pie Chart) & Monthly Historical Volume (Column Chart)
                           ══════════════════════════════════════════════════════════ */}
                        <div>
                            <div className="flex items-center justify-between mb-2.5">
                                <div>
                                    <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wide">
                                        1. Descriptive Analytics — Historical Composition &amp; Monthly Volume
                                    </h3>
                                    <p className="text-[9px] text-gray-500">Examines past and current transactions to summarize where project capital was deployed</p>
                                </div>
                                <span className="text-[8px] font-extrabold uppercase tracking-wider text-[#A63228] bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                                    Descriptive
                                </span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                {/* PIE CHART: Sales / Expense Share per Category (Image 2 top-right) */}
                                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col justify-between">
                                    <div>
                                        <h4 className="text-[11px] font-extrabold text-gray-900 mb-0.5">Expense Share per Category</h4>
                                        <p className="text-[8.5px] text-gray-400 mb-2">Proportional distribution across materials, labor, and operations</p>
                                    </div>

                                    {pieSlices.length === 0 ? (
                                        <div className="flex items-center justify-center h-40 text-gray-400 text-[10px] italic">
                                            No expense transactions recorded for this project yet.
                                        </div>
                                    ) : (
                                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 py-2">
                                            <div className="relative w-40 h-40 flex-shrink-0 flex items-center justify-center">
                                                <svg width="160" height="160" viewBox="0 0 160 160" className="overflow-visible">
                                                    {pieSlices.map((s, idx) => (
                                                        <g key={idx}>
                                                            <path d={s.path} fill={s.color} stroke="#ffffff" strokeWidth="1.5" className="hover:opacity-90 transition-opacity cursor-pointer" />
                                                            {s.pct >= 7 && (
                                                                <text x={s.lx} y={s.ly} fill="#ffffff" fontSize="9" fontWeight="800" textAnchor="middle" dominantBaseline="central">
                                                                    {s.pct}%
                                                                </text>
                                                            )}
                                                        </g>
                                                    ))}
                                                </svg>
                                            </div>

                                            {/* Legend */}
                                            <div className="flex flex-col gap-1.5 w-full sm:w-auto text-[9px]">
                                                {pieSlices.map((s, idx) => (
                                                    <div key={idx} className="flex items-center justify-between sm:justify-start gap-3">
                                                        <div className="flex items-center gap-2">
                                                            <span className="w-2.5 h-2.5 rounded-xs" style={{ backgroundColor: s.color }}></span>
                                                            <span className="text-gray-600 font-medium truncate max-w-[140px]">{s.category}</span>
                                                        </div>
                                                        <span className="font-bold text-gray-900">₱{Number(s.total).toLocaleString()} ({s.pct}%)</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* COLUMN CHART: Monthly Expense Volume by Period (Image 2 top-left) */}
                                <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col justify-between">
                                    <div>
                                        <h4 className="text-[11px] font-extrabold text-gray-900 mb-0.5">Monthly Spending Volume by Period</h4>
                                        <p className="text-[8.5px] text-gray-400 mb-2">Historical monthly actual expenditures across the project timeline (Jan - Dec)</p>
                                    </div>

                                    <div className="relative h-44 w-full">
                                        <svg viewBox="0 0 460 150" className="w-full h-full overflow-visible">
                                            {/* Horizontal Grid lines */}
                                            {[0, 0.33, 0.66, 1].map((r, idx) => {
                                                const y = 125 - r * 105;
                                                const v = Math.round(maxMonthlySpend * r);
                                                return (
                                                    <g key={idx}>
                                                        <line x1="30" y1={y} x2="450" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                                                        <text x="25" y={y + 3} fill="#9ca3af" fontSize="7" textAnchor="end">₱{fmt(v)}</text>
                                                    </g>
                                                );
                                            })}

                                            {/* 12 Monthly Columns */}
                                            {MONTH_LABELS.map((m, i) => {
                                                const val = monthlyData[i] || 0;
                                                const h = maxMonthlySpend > 0 ? Math.round((val / maxMonthlySpend) * 105) : 0;
                                                const x = 38 + i * 34;
                                                const isCur = i === new Date().getMonth();
                                                return (
                                                    <g key={m}>
                                                        <rect
                                                            x={x}
                                                            y={125 - h}
                                                            width={22}
                                                            height={h}
                                                            rx="2"
                                                            fill={isCur ? '#A63228' : val > 0 ? '#3b82f6' : '#f1f5f9'}
                                                        />
                                                        {val > 0 && (
                                                            <text x={x + 11} y={125 - h - 3} fill="#4b5563" fontSize="6.5" fontWeight="bold" textAnchor="middle">
                                                                ₱{fmt(val)}
                                                            </text>
                                                        )}
                                                        <text x={x + 11} y="138" fill={isCur ? '#A63228' : '#9ca3af'} fontSize="7" fontWeight={isCur ? 'bold' : 'normal'} textAnchor="middle">
                                                            {m}
                                                        </text>
                                                    </g>
                                                );
                                            })}
                                        </svg>
                                    </div>
                                    <div className="flex items-center justify-between text-[7.5px] font-bold text-gray-500 border-t border-gray-100 pt-1 mt-1">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-xs bg-[#3b82f6]"></span>
                                            <span>Past Monthly Spend</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="w-2.5 h-2.5 rounded-xs bg-[#A63228]"></span>
                                            <span>Current Active Month</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ══════════════════════════════════════════════════════════
                            2. PREDICTIVE ANALYTICS ("Ano ang mangyayari?")
                            Chart: Time-Based Linear Regression Line Graph & Excel Spreadsheet (Image 1 replica)
                           ══════════════════════════════════════════════════════════ */}
                        <div>
                            <div className="flex items-center justify-between mb-2.5">
                                <div>
                                    <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wide">
                                        2. Predictive Analytics — Time-Based Expense Forecast &amp; Trendline
                                    </h3>
                                    <p className="text-[9px] text-gray-500">Projects future capital requirements based on continuous linear regression mathematical modeling</p>
                                </div>
                                <span className="text-[8px] font-extrabold uppercase tracking-wider text-[#A63228] bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                                    Predictive
                                </span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                {/* STATISTICAL DATA SPREADSHEET */}
                                <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200 p-3 shadow-xs">
                                    <div className="flex items-center justify-between border-b border-gray-200 pb-2 mb-2">
                                        <span className="text-[10px] font-extrabold text-gray-800">Monthly Expense Ledger</span>
                                        <span className="text-[7.5px] font-bold text-[#A63228] bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded uppercase">Regression Model</span>
                                    </div>
                                    <div className="max-h-[290px] overflow-y-auto">
                                        <table className="w-full text-[9px] border-collapse">
                                            <thead>
                                                <tr className="bg-gray-100 text-gray-700 font-extrabold border-b border-gray-300">
                                                    <th className="py-1 px-2 text-center border-r border-gray-200 w-16">Month</th>
                                                    <th className="py-1 px-2 text-right">Total Expenses</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {forecastRows.map((row) => (
                                                    <tr
                                                        key={row.month}
                                                        className={`border-b border-gray-100 hover:bg-gray-50 ${row.isForecastRow ? 'bg-rose-50/40 font-bold text-[#8B221A]' : 'text-gray-800'
                                                            }`}
                                                    >
                                                        <td className="py-1 px-2 text-center border-r border-gray-200 font-semibold">{row.month}</td>
                                                        <td className="py-1 px-2 text-right">
                                                            {row.displayVal}
                                                            {row.isForecastRow && <span className="text-[7px] text-amber-600 font-extrabold ml-1">*</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="text-[7.5px] text-gray-400 mt-2 italic">* Future periods (Months 11-15) projected via linear regression equation y = mx + b</p>
                                </div>

                                {/* WHITE CHART: Time-Based Expense Forecast & Run-Rate Projection */}
                                <div className="lg:col-span-8 bg-white rounded-xl border border-gray-200 p-4 shadow-xs text-gray-900 flex flex-col justify-between">
                                    <h4 className="text-center text-xs font-extrabold text-gray-900 tracking-wide mb-1">
                                        Time-Based Expense Forecast &amp; Run-Rate Projection
                                    </h4>

                                    <div className="relative w-full" style={{ height: 230 }}>
                                        <svg viewBox="0 0 540 230" className="w-full h-full overflow-visible">
                                            {/* Y-Axis Grid Lines & Labels */}
                                            {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((ratio, idx) => {
                                                const yPos = 195 - ratio * 165;
                                                const val = Math.round(maxY * ratio);
                                                return (
                                                    <g key={idx}>
                                                        <line x1="55" y1={yPos} x2="510" y2={yPos} stroke="#e5e7eb" strokeWidth="0.75" />
                                                        <text x="50" y={yPos + 3} fill="#6b7280" fontSize="7.5" textAnchor="end">
                                                            {val >= 1000 ? `${Math.round(val / 1000)}k` : val}
                                                        </text>
                                                    </g>
                                                );
                                            })}

                                            {/* Y-Axis Title */}
                                            <text transform="rotate(-90)" x="-112" y="16" fill="#4b5563" fontSize="7.5" fontWeight="bold" textAnchor="middle">
                                                TOTAL EXPENSES
                                            </text>

                                            {/* X-Axis Ticks (1 to 15) */}
                                            {forecastRows.map((r) => {
                                                const xPos = 55 + ((r.month - 1) / 14) * 455;
                                                return (
                                                    <text key={r.month} x={xPos} y="208" fill="#6b7280" fontSize="7.5" textAnchor="middle">
                                                        {r.month}
                                                    </text>
                                                );
                                            })}

                                            {/* X-Axis Title */}
                                            <text x="282.5" y="222" fill="#4b5563" fontSize="8" fontWeight="bold" textAnchor="middle">
                                                MONTH
                                            </text>

                                            {/* Linear Trendline (Maroon) */}
                                            <line
                                                x1="55"
                                                y1={195 - (forecastRows[0].predicted / maxY) * 165}
                                                x2="510"
                                                y2={195 - (forecastRows[14].predicted / maxY) * 165}
                                                stroke="#A63228"
                                                strokeWidth="2.5"
                                            />

                                            {/* Linear Trendline Equation Formula (Maroon text on trendline) */}
                                            <text
                                                x={55 + (10 / 14) * 455}
                                                y={195 - (forecastRows[10].predicted / maxY) * 165 - 10}
                                                fill="#A63228"
                                                fontSize="9.5"
                                                fontWeight="bold"
                                            >
                                                {equationStr}
                                            </text>

                                            {/* Actual Expenses Polyline */}
                                            {actualPoints.length > 1 && (
                                                <polyline points={actualPolyline} fill="none" stroke="#7A1E18" strokeWidth="2.5" />
                                            )}

                                            {/* Actual Dots (Maroon with white stroke) */}
                                            {actualPoints.map((r) => {
                                                const cx = 55 + ((r.month - 1) / 14) * 455;
                                                const cy = 195 - (r.actual / maxY) * 165;
                                                return <circle key={r.month} cx={cx} cy={cy} r="4" fill="#A63228" stroke="#ffffff" strokeWidth="1.5" />;
                                            })}
                                        </svg>
                                    </div>

                                    {/* Legend at Bottom */}
                                    <div className="flex items-center justify-center gap-8 text-[8.5px] font-bold text-gray-600 pt-2 border-t border-gray-100">
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-0.5 bg-[#7A1E18]"></div>
                                            <span>Total Expenses</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-0.5 bg-[#A63228]"></div>
                                            <span>Linear (Total Expenses)</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* ANALYTICAL NARRATIVE SUMMARY (Matching Image 1 bottom box) */}
                            <div className="bg-white rounded-xl border border-gray-200 p-3.5 shadow-xs mt-3">
                                <p className="text-[9.5px] text-gray-700 leading-relaxed">
                                    The upward trendline shows that project expenditures are consistently tracking along a predictable trajectory.
                                    Based on the forecast equation (<span className="font-bold text-gray-900">{equationStr}</span>), project expenses are
                                    expected to continue rising and reach <span className="font-bold text-[#A63228]">₱{Math.round(forecastMonth15).toLocaleString()}</span> by
                                    the 15th month. Management should utilize this model to benchmark monthly variance against projected run-rates.
                                </p>
                            </div>
                        </div>

                        {/* ══════════════════════════════════════════════════════════
                            3. PRESCRIPTIVE ANALYTICS ("Ano ang dapat gawin?")
                            Charts: Comparative Actual vs Prescribed Target Bar Chart & Risk Status Bar Chart
                           ══════════════════════════════════════════════════════════ */}
                        <div>
                            <div className="flex items-center justify-between mb-2.5">
                                <div>
                                    <h3 className="text-xs font-extrabold text-gray-900 uppercase tracking-wide">
                                        3. Prescriptive Analytics — Target Budget Bar Comparison &amp; Action Plan
                                    </h3>
                                    <p className="text-[9px] text-gray-500">Prescribes specific spending caps per cost center and provides actionable decision directives</p>
                                </div>
                                <span className="text-[8px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                                    Prescriptive
                                </span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                                {/* PRESCRIPTIVE COMPARATIVE BAR CHART: Actual Spend vs Prescribed Target Ceiling */}
                                <div className="lg:col-span-8 bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col justify-between">
                                    <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                                        <div>
                                            <h4 className="text-[11px] font-extrabold text-gray-900">Prescriptive Bar Chart: Actual Spend vs. Prescribed Budget Target</h4>
                                            <p className="text-[8.5px] text-gray-500">Evaluates current spending against prescribed ceiling to dictate corrective measures</p>
                                        </div>
                                        <div className="flex items-center gap-3 text-[8px] font-bold">
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-3 h-2 bg-[#A63228] rounded-xs"></span>
                                                <span className="text-gray-700">Actual Spend</span>
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="w-3 h-2 bg-[#16a34a] rounded-xs"></span>
                                                <span className="text-gray-700">Prescribed Target Cap</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Comparative Bar Items */}
                                    <div className="flex flex-col gap-3.5 py-1">
                                        {prescriptiveBars.length === 0 ? (
                                            <div className="flex items-center justify-center py-8 text-gray-400 text-[10px] italic">
                                                No expense records found for this project yet. Full budget remains unallocated.
                                            </div>
                                        ) : (
                                            prescriptiveBars.map((item, idx) => {
                                                const actualWidth = maxPrescriptiveVal > 0 ? Math.round((item.actual / maxPrescriptiveVal) * 100) : 0;
                                                const targetWidth = maxPrescriptiveVal > 0 ? Math.round((item.targetCap / maxPrescriptiveVal) * 100) : 0;
                                                return (
                                                    <div key={idx} className="border-b border-gray-50 pb-2">
                                                        <div className="flex justify-between items-center text-[8.5px] font-bold mb-1">
                                                            <span className="text-gray-800">{item.category}</span>
                                                            <span className={`px-2 py-0.5 rounded text-[7.5px] font-extrabold ${item.isOver
                                                                    ? 'bg-red-100 text-red-800 border border-red-200'
                                                                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                                }`}>
                                                                {item.isOver ? `Exceeds Target by +${item.pctDiff}% (Prescribed: Reduce)` : 'Within Prescribed Target (Optimal)'}
                                                            </span>
                                                        </div>

                                                        {/* Actual Spend Bar */}
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="text-[7.5px] font-bold text-gray-400 w-12">Actual:</span>
                                                            <div className="flex-1 bg-gray-100 rounded-xs h-2.5 overflow-hidden">
                                                                <div className="bg-[#A63228] h-full rounded-xs transition-all duration-500" style={{ width: `${actualWidth}%` }}></div>
                                                            </div>
                                                            <span className="text-[8px] font-extrabold text-[#A63228] w-20 text-right">₱{item.actual.toLocaleString()}</span>
                                                        </div>

                                                        {/* Prescribed Target Bar */}
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[7.5px] font-bold text-gray-400 w-12">Target:</span>
                                                            <div className="flex-1 bg-gray-100 rounded-xs h-2.5 overflow-hidden">
                                                                <div className="bg-[#16a34a] h-full rounded-xs transition-all duration-500" style={{ width: `${targetWidth}%` }}></div>
                                                            </div>
                                                            <div className="w-24 text-right flex flex-col justify-center">
                                                                <span className="text-[8px] font-extrabold text-[#16a34a]">₱{item.targetCap.toLocaleString()}</span>
                                                                <span className="text-[6.5px] text-gray-400 font-semibold">{item.benchmarkLabel}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>

                                {/* STATUS / RISK BAR CHART (Image 2 bottom-left replica) */}
                                <div className="lg:col-span-4 bg-white rounded-xl border border-gray-200 p-4 shadow-xs flex flex-col justify-between">
                                    <div>
                                        <h4 className="text-[11px] font-extrabold text-gray-900 mb-1">Budget Health &amp; Risk Distribution</h4>
                                        <p className="text-[8.5px] text-gray-500 mb-2">Cost center exposure classification</p>
                                    </div>

                                    {/* 3-Bar Chart */}
                                    <div className="relative h-44 w-full">
                                        <svg viewBox="0 0 240 160" className="w-full h-full overflow-visible">
                                            {/* Y-Axis lines */}
                                            {[0, 20, 40, 60, 80, 100].map((val) => {
                                                const y = 135 - (val / 100) * 115;
                                                return (
                                                    <g key={val}>
                                                        <line x1="28" y1={y} x2="230" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                                                        <text x="22" y={y + 3} fill="#9ca3af" fontSize="7" textAnchor="end">{val}%</text>
                                                    </g>
                                                );
                                            })}

                                            {/* Bar 1: Green (Safe / On-Target) */}
                                            <rect x="45" y={135 - (safePct / 100) * 115} width="40" height={(safePct / 100) * 115} fill="#16a34a" rx="1" />
                                            <text x="65" y={135 - (safePct / 100) * 115 - 5} fill="#16a34a" fontSize="8" fontWeight="bold" textAnchor="middle">{safePct}%</text>
                                            <text x="65" y="148" fill="#6b7280" fontSize="7" fontWeight="bold" textAnchor="middle">On-Target</text>

                                            {/* Bar 2: Red (Critical / High-Risk) */}
                                            <rect x="110" y={135 - (riskPct / 100) * 115} width="40" height={(riskPct / 100) * 115} fill="#dc2626" rx="1" />
                                            <text x="130" y={135 - (riskPct / 100) * 115 - 5} fill="#dc2626" fontSize="8" fontWeight="bold" textAnchor="middle">{riskPct}%</text>
                                            <text x="130" y="148" fill="#6b7280" fontSize="7" fontWeight="bold" textAnchor="middle">High Risk</text>

                                            {/* Bar 3: Yellow (Caution / Watchlist) */}
                                            <rect x="175" y={135 - (cautionPct / 100) * 115} width="40" height={(cautionPct / 100) * 115} fill="#ca8a04" rx="1" />
                                            <text x="195" y={135 - (cautionPct / 100) * 115 - 5} fill="#ca8a04" fontSize="8" fontWeight="bold" textAnchor="middle">{cautionPct}%</text>
                                            <text x="195" y="148" fill="#6b7280" fontSize="7" fontWeight="bold" textAnchor="middle">Watchlist</text>
                                        </svg>
                                    </div>
                                    <p className="text-[7.5px] text-gray-500 text-center mt-2 border-t border-gray-100 pt-1">
                                        {riskPct > 0
                                            ? 'Prescribes immediate cost containment for high-risk categories'
                                            : cautionPct > 0
                                            ? 'Cost centers under watchlist; maintain spending pacing'
                                            : 'All active cost centers optimal; no immediate risk exposure detected'}
                                    </p>
                                </div>
                            </div>

                            {/* EXECUTIVE ACTION MATRIX (Corporate Decision Table) */}
                            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs mt-4">
                                <h4 className="text-[11px] font-extrabold text-gray-900 mb-1">Executive Prescriptive Action Matrix</h4>
                                <p className="text-[8.5px] text-gray-500 mb-3">Targeted operational directives based on statistical variance</p>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-[9px] border-collapse">
                                        <thead>
                                            <tr className="bg-gray-50 text-gray-700 font-extrabold border-b border-gray-200 text-left">
                                                <th className="py-2 px-2.5">Cost Center</th>
                                                <th className="py-2 px-2.5">Variance Metric</th>
                                                <th className="py-2 px-2.5">Prescriptive Management Action</th>
                                                <th className="py-2 px-2.5 text-center">Priority</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 text-gray-800">
                                            {prescriptiveBars.map((item, idx) => {
                                                const isOver = item.isOver;
                                                const catName = String(item.category || '').toLowerCase();
                                                let actionText = '';
                                                let priority = 'OPTIMAL';
                                                let priorityClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                                                let varianceText = '';
                                                let varianceClass = 'text-emerald-600 font-bold';

                                                if (isOver) {
                                                    priority = 'HIGH';
                                                    priorityClass = 'bg-red-100 text-red-800 border-red-200';
                                                    varianceText = `+${item.pctDiff}% above prescribed cap`;
                                                    varianceClass = 'text-red-600 font-bold';
                                                    if (catName.includes('material')) {
                                                        actionText = 'Activate bulk supplier pricing agreement for subsequent structural milestones to lock unit purchase costs.';
                                                    } else if (catName.includes('manpower') || catName.includes('labor')) {
                                                        actionText = 'Require project engineer pre-authorization for holiday and extended shifts; align staffing strictly to critical path activities.';
                                                    } else if (catName.includes('equipment')) {
                                                        actionText = 'Audit equipment log-sheets to eliminate non-productive standby rates and negotiate dry-run leasing terms.';
                                                    } else {
                                                        actionText = 'Enforce mandatory purchase requisition sign-off by Project Manager prior to procurement disbursement.';
                                                    }
                                                } else if (item.actual > item.targetCap * 0.75) {
                                                    priority = 'MEDIUM';
                                                    priorityClass = 'bg-amber-100 text-amber-800 border-amber-200';
                                                    varianceText = `${Math.round((item.actual / (item.targetCap || 1)) * 100)}% cap utilization`;
                                                    varianceClass = 'text-amber-600 font-bold';
                                                    actionText = `Closely monitor ${item.category} burn rate over the next billing cycle to prevent target ceiling breach.`;
                                                } else {
                                                    priority = 'OPTIMAL';
                                                    priorityClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
                                                    varianceText = `Within baseline (₱${Number(item.actual || 0).toLocaleString()})`;
                                                    varianceClass = 'text-emerald-600 font-bold';
                                                    if (catName.includes('material')) {
                                                        actionText = 'Maintain current supplier delivery schedules and preserve bulk price locking for future phases.';
                                                    } else if (catName.includes('manpower') || catName.includes('labor')) {
                                                        actionText = 'Current crew pacing is on schedule; sustain productivity log auditing across active shifts.';
                                                    } else {
                                                        actionText = 'Operating smoothly within target parameters; continue standard weekly auditing.';
                                                    }
                                                }

                                                return (
                                                    <tr key={idx}>
                                                        <td className="py-2.5 px-2.5 font-bold">{item.category}</td>
                                                        <td className={`py-2.5 px-2.5 ${varianceClass}`}>{varianceText}</td>
                                                        <td className="py-2.5 px-2.5 text-gray-600">{actionText}</td>
                                                        <td className="py-2.5 px-2.5 text-center">
                                                            <span className={`px-2 py-0.5 rounded text-[7.5px] font-extrabold border ${priorityClass}`}>
                                                                {priority}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            <tr>
                                                <td className="py-2.5 px-2.5 font-bold">Contingency &amp; Capital Reserve</td>
                                                <td className="py-2.5 px-2.5 text-emerald-600 font-bold">
                                                    {Math.max(0, 100 - utilizationPct)}% unallocated (₱{Number(remaining || 0).toLocaleString()})
                                                </td>
                                                <td className="py-2.5 px-2.5 text-gray-600">
                                                    Reserve remaining capital buffer exclusively for unforeseen structural phases, geotechnical conditions, and material price fluctuations.
                                                </td>
                                                <td className="py-2.5 px-2.5 text-center">
                                                    <span className="px-2 py-0.5 rounded text-[7.5px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                        OPTIMAL
                                                    </span>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            <div className="hidden print:block mt-10 pt-6 border-t border-gray-200">
                <div className="flex justify-end text-[10px]">
                    <div className="text-right flex flex-col items-end">
                        <p className="text-gray-600 mb-9 text-[10px] font-semibold">Approved by:</p>
                        <div className="w-56 border-b border-gray-800"></div>
                        <p className="text-gray-500 text-[8.5px] uppercase tracking-wider font-semibold">Project Engineer / Management</p>
                        <p className="text-gray-400 text-[8px]">Sotalbo Construction</p>
                    </div>
                </div>
                <div className="text-[8px] text-gray-400 mt-8 text-center border-t border-gray-100 pt-3">
                    <p>Generated by S-CON BuildTrack Management System • {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                </div>
            </div>

            {modalState === 'LOADING_EXPORT' && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-6 w-full max-w-[220px] shadow-2xl text-center flex flex-col items-center">
                        <svg className="animate-spin h-8 w-8 text-[#A63228] mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <h3 className="text-[10px] font-extrabold text-gray-900 mb-1">Generating File...</h3>
                        <p className="text-[8px] text-gray-500 font-medium">Please wait a moment.</p>
                    </div>
                </div>
            )}

            {modalState === 'SUCCESS_EXPORT' && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl p-5 w-full max-w-[220px] shadow-2xl text-center relative">
                        <button onClick={() => setModalState('NONE')} className="absolute top-2 right-2 text-gray-400 hover:text-gray-700">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>
                        <div className="w-10 h-10 bg-[#e6f4ea] rounded-full flex items-center justify-center mx-auto mb-2">
                            <svg className="w-5 h-5 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </div>
                        <h3 className="text-[11px] font-extrabold text-gray-900 mb-1">Export Successful!</h3>
                        <p className="text-[9px] text-gray-500 font-medium mb-4 px-2">Your report has been downloaded.</p>
                        <button onClick={() => setModalState('NONE')} className="w-full py-2 bg-[#8B1A10] text-white rounded-lg text-[10px] font-bold hover:bg-[#72150d] transition-colors">Done</button>
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}
