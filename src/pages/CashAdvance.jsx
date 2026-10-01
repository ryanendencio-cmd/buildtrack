import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { api } from '../api'

export default function CashAdvance() {
    const { id } = useParams();
    const navigate = useNavigate();

    const todayISO = new Date().toISOString().split('T')[0];
    const [filterDate, setFilterDate] = useState('');

    const [modalState, setModalState] = useState('NONE'); // NONE, ADD, CONFIRM, SUCCESS
    const [formData, setFormData] = useState({
        projectId: '',
        workerName: '',
        amount: '',
        date: todayISO,
        reason: '',
    });

    const [mockProjects, setMockProjects] = useState([]);
    const [workersList, setWorkersList] = useState([]);
    const [isCustomWorker, setIsCustomWorker] = useState(false);
    const [cashAdvances, setCashAdvances] = useState([]);
    const [amountError, setAmountError] = useState('');

    useEffect(() => {
        api.get('/projects').then(data => {
            if (Array.isArray(data)) {
                setMockProjects(data.map(p => ({ id: String(p.id), name: p.name })));
            }
        }).catch(console.error);

        api.get('/workers').then(data => {
            if (Array.isArray(data)) {
                setWorkersList(data);
            }
        }).catch(console.error);
    }, []);

    const currentProjectId = id || "ALL";

    useEffect(() => {
        api.get(`/cash-advances/${currentProjectId}`)
            .then(data => setCashAdvances(Array.isArray(data) ? data : []))
            .catch(err => {
                console.error(err);
                setCashAdvances([]);
            });

        queueMicrotask(() => {
            setFilterDate('');
            setFormData(prev => ({ ...prev, projectId: currentProjectId === 'ALL' ? (mockProjects[0]?.id || '') : currentProjectId }));
        });
    }, [currentProjectId, mockProjects]);

    const handleApproveStatus = (advId, newStatus) => {
        api.put(`/cash-advances/${advId}/approve`, { status: newStatus }).then(() => {
            setCashAdvances(prev => Array.isArray(prev) ? prev.map(a => a.id === advId ? { ...a, status: newStatus } : a) : []);
        }).catch(console.error);
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name === 'workerName' && value === '__CUSTOM__') {
            setIsCustomWorker(true);
            setFormData(prev => ({ ...prev, workerName: '' }));
            return;
        }
        if (name === 'amount') {
            const num = parseFloat(value);
            if (num < 0) {
                setAmountError('Amount cannot be negative.');
            } else {
                setAmountError('');
            }
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleProjectChange = (e) => {
        const val = e.target.value;
        navigate(val === 'ALL' ? '/cash-advance' : `/cash-advance/${val}`);
    };

    const handleInitialSubmit = (e) => {
        e.preventDefault();
        const amt = parseFloat(formData.amount || 0);
        if (!formData.projectId) {
            alert('Please select a project.');
            return;
        }
        if (amt <= 0) {
            setAmountError('Please enter a valid amount.');
            return;
        }
        if (!formData.workerName) {
            alert('Worker name is required.');
            return;
        }
        setAmountError('');
        setModalState('CONFIRM');
    };

    const handleConfirmAdd = () => {
        const targetProjectId = formData.projectId || currentProjectId;
        const newAdvance = {
            project_id: targetProjectId,
            workerName: formData.workerName,
            amount: parseFloat(formData.amount || 0),
            date: formData.date,
            reason: formData.reason,
            status: 'Pending'
        };

        api.post('/cash-advances', newAdvance).then(res => {
            if (String(targetProjectId) === String(currentProjectId)) {
                setCashAdvances(prev => [res, ...prev]);
            } else {
                navigate(`/cash-advance/${targetProjectId}`);
            }
            setModalState('SUCCESS');
        }).catch(err => {
            console.error(err);
            alert('Failed to save cash advance.');
        });
    };

    const resetAndClose = () => {
        setAmountError('');
        setIsCustomWorker(false);
        setModalState('NONE');
        setFormData({
            projectId: currentProjectId || mockProjects[0]?.id || '',
            workerName: '',
            date: todayISO,
            reason: '',
            amount: ''
        });
    };

    const normalizeDate = (rawDate) => {
        if (!rawDate) return '';
        if (typeof rawDate === 'string') {
            const match = rawDate.match(/^(\d{4}-\d{2}-\d{2})/);
            if (match) return match[1];
        }
        return String(rawDate).slice(0, 10);
    };

    const formatDisplayDate = (dateVal) => {
        if (!dateVal) return '';
        const norm = normalizeDate(dateVal);
        const parts = norm.split('-');
        if (parts.length === 3) {
            const [y, m, d] = parts;
            const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
            return dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }
        return norm;
    };

    const validAdvances = Array.isArray(cashAdvances) ? cashAdvances : [];
    const displayedAdvances = validAdvances.filter(adv => !filterDate || normalizeDate(adv?.date) === filterDate);
    const tableTotal = displayedAdvances.reduce((sum, item) => sum + Number(item?.amount || 0), 0);

    const selectStyles = { backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e")`, backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '0.8rem 0.8rem' };

    return (
        <AdminLayout>
            <div className="mb-1.5">
                <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">CASH ADVANCE MANAGEMENT</span>
                <h1 className="text-lg font-extrabold text-gray-900 mt-0.5 tracking-tight">Cash Advance Management</h1>
                <p className="text-[10px] text-gray-500 mt-0.5">Track and manage worker cash advances.</p>
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-3 gap-3">
                <div className="w-full md:max-w-sm">
                    <label className="block text-[8px] font-bold text-gray-400 tracking-wider uppercase mb-1">PROJECT</label>
                    <select value={currentProjectId} onChange={handleProjectChange} className="w-full bg-white border border-gray-100 shadow-sm rounded-lg pl-2.5 pr-6 py-1.5 text-[10px] font-extrabold text-gray-800 outline-none appearance-none" style={selectStyles}>
                        <option value="ALL">All Projects / Mobile Requests</option>
                        {mockProjects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <button onClick={() => setModalState('ADD')} className="bg-[#E8C547] text-gray-900 px-3 py-1.5 rounded-lg font-bold text-[10px] shadow-sm hover:bg-[#d4b33d] transition-colors flex items-center justify-center gap-1 flex-1 md:flex-none">
                        <span>+</span> Add Cash Advance
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-3 mb-3">
                <div className="mb-2 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                    <div className="flex items-center gap-2">
                        <h3 className="text-[10px] font-extrabold text-gray-900 tracking-wide uppercase">Advance Records</h3>
                        <span className="bg-gray-100 text-gray-600 text-[8px] font-bold px-1.5 py-0.5 rounded">
                            {filterDate ? `${displayedAdvances.length} filtered` : `${cashAdvances.length} total`}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        {filterDate && (
                            <button
                                type="button"
                                onClick={() => setFilterDate('')}
                                className="text-[9px] text-[#A63228] font-bold hover:underline cursor-pointer flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors"
                                title="Clear filter to view all saved records"
                            >
                                <span>✕</span> Clear Filter
                            </button>
                        )}
                        <div className="flex items-center gap-1">
                            <label className="text-[8px] font-bold text-gray-400 uppercase">Date:</label>
                            <input
                                type="date"
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                                className={`bg-[#f4f1ee] px-2.5 py-1 rounded-md text-[9px] font-bold outline-none border transition-colors cursor-pointer ${filterDate ? 'border-[#A63228] text-[#A63228] font-extrabold shadow-sm' : 'border-transparent text-gray-700'}`}
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[500px]">
                        <thead>
                            <tr>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[15%] uppercase tracking-wider">DATE</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[20%] uppercase tracking-wider">WORKER NAME</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[25%] uppercase tracking-wider">REASON</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[15%] uppercase tracking-wider">STATUS</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 text-right pr-2 w-[15%] uppercase tracking-wider">AMOUNT</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 text-center w-[10%] uppercase tracking-wider">ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedAdvances.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="text-center py-6 text-[10px] text-gray-400 italic">
                                        No cash advances recorded for this project.
                                    </td>
                                </tr>
                            ) : (
                                displayedAdvances.map((adv) => (
                                    <tr key={adv.id} className="hover:bg-gray-50/60 transition-colors">
                                        <td className="py-2.5 text-[10px] font-bold text-gray-800 border-b border-gray-50">{formatDisplayDate(adv.date)}</td>
                                        <td className="py-2.5 text-[10px] font-bold text-gray-900 border-b border-gray-50">{adv.workerName}</td>
                                        <td className="py-2.5 text-[10px] font-medium text-gray-600 border-b border-gray-50">{adv.reason || '-'}</td>
                                        <td className="py-2.5 border-b border-gray-50">
                                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${adv.status === 'Approved' ? 'bg-[#e6f4ea] text-[#2e7d32]' : adv.status === 'Rejected' ? 'bg-red-100 text-red-700' : 'bg-[#fff8e1] text-[#f57f17]'}`}>
                                                {adv.status || 'Pending'}
                                            </span>
                                        </td>
                                        <td className="py-2.5 text-[10px] font-extrabold text-[#A63228] border-b border-gray-50 text-right pr-2">₱{Number(adv.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        <td className="py-2.5 border-b border-gray-50 text-center">
                                            {adv.status === 'Pending' ? (
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => handleApproveStatus(adv.id, 'Approved')} className="bg-[#e6f4ea] border border-[#2e7d32] text-[#2e7d32] px-1.5 py-0.5 rounded text-[8px] font-bold hover:bg-green-100">Approve</button>
                                                    <button onClick={() => handleApproveStatus(adv.id, 'Rejected')} className="bg-white border border-[#A63228] text-[#A63228] px-1.5 py-0.5 rounded text-[8px] font-bold hover:bg-red-50">Reject</button>
                                                </div>
                                            ) : (
                                                <span className="text-[8px] text-gray-400">—</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100 text-[10px]">
                    <span className="font-extrabold text-gray-600 uppercase tracking-wider">
                        TOTAL ADVANCES
                    </span>
                    <strong className="font-extrabold text-[#A63228] text-xs">
                        ₱{tableTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                </div>
            </div>

            {/* ADD MODAL */}
            {modalState === 'ADD' && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl relative flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-[#f9fafb] rounded-t-xl">
                            <div>
                                <h2 className="text-sm font-extrabold text-gray-900">Add Cash Advance</h2>
                                <p className="text-[10px] text-gray-500 font-medium">Record a new cash advance</p>
                            </div>
                            <button onClick={resetAndClose} className="p-1.5 hover:bg-white rounded-lg text-gray-400 hover:text-gray-600 transition-colors shadow-sm border border-transparent hover:border-gray-200">
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleInitialSubmit} className="p-4 flex-1 overflow-y-auto">
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-[10px] font-extrabold text-gray-900 mb-1">Project Name <span className="text-[#A63228]">*</span></label>
                                    <select
                                        name="projectId"
                                        value={formData.projectId || ''}
                                        onChange={handleInputChange}
                                        required
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:border-[#A63228] focus:ring-1 focus:ring-[#A63228]"
                                    >
                                        {mockProjects.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="block text-[10px] font-extrabold text-gray-900">Worker Name <span className="text-[#A63228]">*</span></label>
                                            {workersList.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setIsCustomWorker(!isCustomWorker);
                                                        setFormData(prev => ({ ...prev, workerName: '' }));
                                                    }}
                                                    className="text-[8px] text-[#A63228] font-bold hover:underline"
                                                >
                                                    {isCustomWorker ? '← Select list' : '+ Custom'}
                                                </button>
                                            )}
                                        </div>
                                        {!isCustomWorker && workersList.length > 0 ? (
                                            <select
                                                name="workerName"
                                                value={formData.workerName}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:border-[#A63228] focus:ring-1 focus:ring-[#A63228]"
                                            >
                                                <option value="">-- Select Worker --</option>
                                                {workersList.map((w, idx) => {
                                                    const wName = w.full_name || [w.first_name, w.last_name].filter(Boolean).join(' ') || w.name || 'Worker';
                                                    return (
                                                        <option key={w.id || idx} value={wName}>
                                                            {wName} {w.role ? `(${w.role})` : ''}
                                                        </option>
                                                    );
                                                })}
                                                <option value="__CUSTOM__">+ Enter custom name...</option>
                                            </select>
                                        ) : (
                                            <input
                                                type="text"
                                                name="workerName"
                                                value={formData.workerName}
                                                onChange={handleInputChange}
                                                required
                                                className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:border-[#A63228] focus:ring-1 focus:ring-[#A63228]"
                                                placeholder="Enter name"
                                            />
                                        )}
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-extrabold text-gray-900 mb-1">Date <span className="text-[#A63228]">*</span></label>
                                        <input type="date" name="date" value={formData.date} onChange={handleInputChange} required className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:border-[#A63228]" />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-extrabold text-gray-900 mb-1">Reason</label>
                                    <input type="text" name="reason" value={formData.reason} onChange={handleInputChange} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-medium text-gray-900 focus:outline-none focus:border-[#A63228] focus:ring-1 focus:ring-[#A63228]" placeholder="e.g. Medical emergency, Fare" />
                                </div>

                                <div className="bg-[#f9fafb] p-3 rounded-lg border border-gray-100 mt-2">
                                    <label className="block text-[10px] font-extrabold text-gray-900 mb-1">Amount <span className="text-[#A63228]">*</span></label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-extrabold text-sm">₱</span>
                                        <input type="number" step="0.01" name="amount" value={formData.amount} onChange={handleInputChange} required className={`w-full bg-white border ${amountError ? 'border-[#A63228] focus:ring-[#A63228]' : 'border-gray-200 focus:border-[#A63228] focus:ring-[#A63228]'} rounded-lg pl-8 pr-3 py-2 text-sm font-extrabold text-gray-900 focus:outline-none focus:ring-1`} placeholder="0.00" />
                                    </div>
                                    {amountError && <p className="text-[9px] text-[#A63228] font-bold mt-1">{amountError}</p>}
                                </div>
                            </div>
                        </form>

                        <div className="p-4 border-t border-gray-100 bg-[#f9fafb] rounded-b-xl flex justify-end gap-2 shrink-0">
                            <button type="button" onClick={resetAndClose} className="px-4 py-2 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
                            <button type="button" onClick={handleInitialSubmit} className="px-4 py-2 text-xs font-bold text-white bg-[#A63228] rounded-lg hover:bg-[#8B1A10]">Proceed</button>
                        </div>
                    </div>
                </div>
            )}

            {/* CONFIRM MODAL */}
            {modalState === 'CONFIRM' && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-xs shadow-2xl p-5 text-center flex flex-col items-center">
                        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-3">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        </div>
                        <h3 className="text-sm font-extrabold text-gray-900 mb-1">Confirm Cash Advance</h3>
                        <p className="text-xs text-gray-500 mb-4 px-2">Are you sure you want to record a cash advance of <strong>₱{Number(formData.amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> for <strong>{formData.workerName}</strong> under <strong>{mockProjects.find(p => String(p.id) === String(formData.projectId))?.name || 'Selected Project'}</strong>?</p>
                        <div className="flex gap-2 w-full">
                            <button onClick={() => setModalState('ADD')} className="flex-1 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200">Back</button>
                            <button onClick={handleConfirmAdd} className="flex-1 py-2 bg-[#A63228] text-white text-xs font-bold rounded-lg hover:bg-[#8B1A10]">Confirm Save</button>
                        </div>
                    </div>
                </div>
            )}

            {/* SUCCESS MODAL */}
            {modalState === 'SUCCESS' && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-xs shadow-2xl p-5 text-center flex flex-col items-center">
                        <div className="w-12 h-12 bg-[#e6f4ea] text-[#2e7d32] rounded-full flex items-center justify-center mb-3">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </div>
                        <h3 className="text-sm font-extrabold text-gray-900 mb-1">Cash Advance Saved</h3>
                        <p className="text-xs text-gray-500 mb-4">The cash advance has been recorded successfully.</p>
                        <button onClick={resetAndClose} className="w-full py-2 bg-[#A63228] text-white text-xs font-bold rounded-lg hover:bg-[#8B1A10]">Done</button>
                    </div>
                </div>
            )}

        </AdminLayout>
    )
}
