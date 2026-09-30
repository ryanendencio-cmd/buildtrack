import React, { useState, useEffect } from 'react'
import AdminLayout from '../components/AdminLayout'
import { api } from '../api'

export default function Reports() {
    const [selectedMonth, setSelectedMonth] = useState(() => {
        const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
    const [activeTab, setActiveTab] = useState('summary');
    const [reportType, setReportType] = useState('Expenses');
    const [selectedProject, setSelectedProject] = useState('ALL');
    const [modalState, setModalState] = useState('NONE');
    const [projects, setProjects] = useState([]);
    const [reportData, setReportData] = useState(null);
    const [monthlyData, setMonthlyData] = useState(Array(12).fill(0));
    const [budgetCategories, setBudgetCategories] = useState([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api.get('/projects').then(setProjects).catch(() => {});
        api.get('/expenses/monthly').then(setMonthlyData).catch(() => {});
        api.get('/expenses/budget-summary').then(d => setBudgetCategories(d.categories || [])).catch(() => {});
    }, []);

    useEffect(() => {
        queueMicrotask(() => setLoading(true));
        const params = `?project_id=${selectedProject}&month=${selectedMonth}`;
        const endpoint = reportType === 'Expenses' ? `/reports/expenses${params}`
            : reportType === 'Manpower' ? `/reports/manpower${params}`
            : reportType === 'Materials' ? `/reports/materials?project_id=${selectedProject}`
            : `/reports/assets?project_id=${selectedProject}`;
        api.get(endpoint).then(data => { setReportData(data); setLoading(false); }).catch(() => setLoading(false));
    }, [selectedProject, selectedMonth, reportType]);

    const [year, monthNum] = selectedMonth ? selectedMonth.split('-') : [new Date().getFullYear(), '01'];
    const dateObj = new Date(year, parseInt(monthNum) - 1, 1);
    const displayMonth = dateObj.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const currentMonth = new Date().getMonth();
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const maxVal = Math.max(...monthlyData, 1);
    const fmt = v => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${Math.round(v/1000)}k` : v;
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
        if (reportType === 'Materials') return [
            { label: 'TOTAL MATERIAL COST', value: `₱${Number(reportData.totalCost || 0).toLocaleString()}`, color: 'text-[#A63228]' },
            { label: 'ITEMS LOGGED', value: `${reportData.itemCount || 0} Items`, color: 'text-gray-900' },
            { label: 'ACTIVE SITES', value: `${projects.length} Sites`, color: 'text-[#2e7d32]' },
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
        if (reportType === 'Materials') return ['PROJECT', 'MATERIAL NAME', 'QTY', 'UNIT', 'UNIT COST', 'TOTAL'];
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
        if (reportType === 'Materials') return reportData.rows.map(r => ({
            id: r.id,
            cols: [r.project_name || '—', r.name, r.quantity, r.unit, `₱${Number(r.unit_cost).toLocaleString()}`, `₱${(Number(r.quantity) * Number(r.unit_cost)).toLocaleString()}`]
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
        setModalState('LOADING_EXPORT');
        setTimeout(() => setModalState('SUCCESS_EXPORT'), 1500);
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
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-2">
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

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-4 flex flex-col md:flex-row gap-3">
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
                        <option value="Materials">Material Usage</option>
                        <option value="Assets">Assets & Equipment</option>
                    </select>
                </div>
            </div>

            <div className="flex gap-4 border-b border-gray-100 mb-4">
                <button onClick={() => setActiveTab('summary')} className={`pb-2 text-[10px] font-bold transition-colors border-b-2 ${activeTab === 'summary' ? 'border-[#A63228] text-[#A63228]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>Data Report Table</button>
                <button onClick={() => setActiveTab('analytics')} className={`pb-2 text-[10px] font-bold transition-colors border-b-2 ${activeTab === 'analytics' ? 'border-[#A63228] text-[#A63228]' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>Visual Analytics</button>
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
                            const colors = ['bg-[#A63228]', 'bg-[#2e7d32]', 'bg-[#E8C547]', 'bg-[#1d4ed8]', 'bg-[#7c3aed]'];
                            const textColors = ['text-[#A63228]', 'text-[#2e7d32]', 'text-[#ca8a04]', 'text-[#1d4ed8]', 'text-[#7c3aed]'];
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

            <div className="hidden print:block text-[10px] text-gray-500 mt-6 text-center w-full">
                <p>Generated by S-Cons Management System</p>
                <p>Date Generated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
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
