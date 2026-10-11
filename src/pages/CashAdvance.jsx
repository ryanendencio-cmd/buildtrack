import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { api } from '../api'

const ADVANCE_REASONS = [
    'Emergency / Medical Expenses',
    'Family Emergency',
    'Food & Daily Living Allowance',
    'Transportation / Travel Fare',
    'Schooling / Tuition Fee',
    'Utility Bills / Rent',
    'Tools / Site Gear',
    'Other'
];

export default function CashAdvance() {
    const { id } = useParams();
    const navigate = useNavigate();

    const todayISO = new Date().toISOString().split('T')[0];
    const [filterDate, setFilterDate] = useState('');

    const [modalState, setModalState] = useState('NONE'); // NONE, ADD, CONFIRM, SUCCESS, DELETE_CONFIRM
    const [selectedAdvanceForDelete, setSelectedAdvanceForDelete] = useState(null);
    const [formError, setFormError] = useState('');

    const [formData, setFormData] = useState({
        projectId: '',
        workerId: '',
        workerName: '',
        amount: '',
        date: todayISO,
        reasonCategory: 'Emergency / Medical Expenses',
        customReason: '',
        status: 'Approved' // Approved by default so it immediately deducts from project budget
    });

    const [mockProjects, setMockProjects] = useState([]);
    const [allExpenses, setAllExpenses] = useState([]);
    const [allMaterials, setAllMaterials] = useState([]);
    const [workersList, setWorkersList] = useState([]);
    const [isCustomWorker, setIsCustomWorker] = useState(false);
    const [cashAdvances, setCashAdvances] = useState([]);
    const [loading, setLoading] = useState(false);

    // Load projects, expenses, workers, and materials
    const loadInitialData = () => {
        Promise.all([
            api.get('/projects').catch(() => []),
            api.get('/expenses').catch(() => []),
            api.get('/workers').catch(() => []),
            api.get('/materials').catch(() => [])
        ]).then(([projs, exps, wrks, mats]) => {
            if (Array.isArray(projs)) {
                setMockProjects(projs.map(p => ({
                    id: String(p.id),
                    name: p.name,
                    budget: Number(p.budget) || 0,
                    status: p.status || 'ONGOING'
                })));
            }
            if (Array.isArray(exps)) {
                setAllExpenses(exps);
            }
            if (Array.isArray(wrks)) {
                setWorkersList(wrks.filter(w => (w.approval_status || 'Approved') !== 'Pending'));
            }
            if (Array.isArray(mats)) {
                setAllMaterials(mats);
            }
        }).catch(console.error);
    };

    useEffect(() => {
        loadInitialData();
    }, []);

    const currentProjectId = id || "ALL";

    const fetchCashAdvances = () => {
        setLoading(true);
        api.get(`/cash-advances/${currentProjectId}`)
            .then(data => setCashAdvances(Array.isArray(data) ? data : []))
            .catch(err => {
                console.error(err);
                setCashAdvances([]);
            })
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchCashAdvances();
        queueMicrotask(() => {
            setFilterDate('');
            setFormData(prev => ({
                ...prev,
                projectId: currentProjectId === 'ALL' ? (mockProjects[0]?.id || '') : currentProjectId
            }));
        });
    }, [currentProjectId, mockProjects]);

    // Map of project materials cost to compute remaining project budgets
    const projectMaterialsMap = useMemo(() => {
        const map = {};
        for (const mat of allMaterials) {
            const pid = String(mat.project_id || '');
            if (pid) {
                const cost = Number(mat.qty || mat.quantity || 0) * Number(mat.cost || mat.unit_cost || 0);
                map[pid] = (map[pid] || 0) + cost;
            }
        }
        return map;
    }, [allMaterials]);

    // Map of total project spent (receipts + materials) to compute remaining project budgets
    const projectExpensesMap = useMemo(() => {
        const map = {};
        for (const exp of allExpenses) {
            const pid = String(exp.project_id || '');
            if (pid) {
                map[pid] = (map[pid] || 0) + Number(exp.amount || 0);
            }
        }
        for (const [pid, matCost] of Object.entries(projectMaterialsMap)) {
            map[pid] = (map[pid] || 0) + matCost;
        }
        return map;
    }, [allExpenses, projectMaterialsMap]);

    // Metrics for the currently viewed project (or all projects)
    const activeProjectInfo = useMemo(() => {
        const totalAdvances = cashAdvances
            .filter(ca => ca.status === 'Approved')
            .reduce((sum, ca) => sum + Number(ca.amount || 0), 0);
        const advancesCount = cashAdvances.filter(ca => ca.status === 'Approved').length;

        if (currentProjectId === 'ALL') {
            const totalBudget = mockProjects.reduce((sum, p) => sum + p.budget, 0);
            const totalExpenseReceipts = allExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
            const totalMaterialsCost = allMaterials.reduce((sum, m) => sum + (Number(m.qty || m.quantity || 0) * Number(m.cost || m.unit_cost || 0)), 0);
            const totalSpent = totalExpenseReceipts + totalMaterialsCost;
            const remaining = Math.max(0, totalBudget - totalSpent);
            return {
                name: 'All Active Projects',
                budget: totalBudget,
                spent: totalSpent,
                expensesReceipts: totalExpenseReceipts,
                materialsCost: totalMaterialsCost,
                remaining,
                advancesTotal: totalAdvances,
                advancesCount
            };
        } else {
            const proj = mockProjects.find(p => String(p.id) === String(currentProjectId));
            const budget = Number(proj?.budget || 0);
            const totalSpent = projectExpensesMap[String(currentProjectId)] || 0;
            const projMaterialsCost = projectMaterialsMap[String(currentProjectId)] || 0;
            const projExpenseReceipts = Math.max(0, totalSpent - projMaterialsCost);
            const remaining = Math.max(0, budget - totalSpent);
            return {
                name: proj?.name || 'Selected Project',
                budget,
                spent: totalSpent,
                expensesReceipts: projExpenseReceipts,
                materialsCost: projMaterialsCost,
                remaining,
                advancesTotal: totalAdvances,
                advancesCount
            };
        }
    }, [currentProjectId, mockProjects, allExpenses, allMaterials, projectExpensesMap, projectMaterialsMap, cashAdvances]);

    // Form: Active Selected Project Details in Modal
    const formSelectedProject = useMemo(() => {
        if (!formData.projectId) return null;
        const p = mockProjects.find(proj => String(proj.id) === String(formData.projectId));
        if (!p) return null;
        const budget = Number(p.budget || 0);
        const spent = projectExpensesMap[String(p.id)] || 0;
        const remaining = Math.max(0, budget - spent);
        return { ...p, budget, spent, remaining };
    }, [mockProjects, formData.projectId, projectExpensesMap]);

    // Form: Workers filtered by selected project
    const projectAssignedWorkers = useMemo(() => {
        if (!formData.projectId) return [];
        return workersList.filter(w => String(w.project_id) === String(formData.projectId));
    }, [workersList, formData.projectId]);

    const otherAvailableWorkers = useMemo(() => {
        if (!formData.projectId) return workersList;
        return workersList.filter(w => String(w.project_id) !== String(formData.projectId));
    }, [workersList, formData.projectId]);

    // Form: Selected Worker Info & Dynamic Limit Calculation
    const formSelectedWorker = useMemo(() => {
        if (isCustomWorker || !formData.workerId) return null;
        const w = workersList.find(worker => String(worker.id) === String(formData.workerId));
        if (!w) return null;

        const dailyRate = Number(w.daily_rate || 600);
        // Base Limit: 6 working days (1 week payroll) capped at ₱5,000
        const baseLimit = Math.min(dailyRate * 6, 5000);

        // Sum of undeducted active advances for this worker
        const undeductedAdvances = cashAdvances
            .filter(ca => {
                const matchId = ca.worker_id && String(ca.worker_id) === String(w.id);
                const matchName = (ca.workerName || '').trim().toLowerCase() === (w.full_name || '').trim().toLowerCase();
                return (matchId || matchName) && ca.status === 'Approved' && !ca.is_deducted;
            })
            .reduce((sum, ca) => sum + Number(ca.amount || 0), 0);

        const availableAdvance = Math.max(0, baseLimit - undeductedAdvances);

        return {
            ...w,
            dailyRate,
            baseLimit,
            undeductedAdvances,
            availableAdvance
        };
    }, [workersList, formData.workerId, isCustomWorker, cashAdvances]);

    // Maximum allowed amount considering both Worker Limit and Project Budget
    const maxAllowedAmount = useMemo(() => {
        const projectRemaining = formSelectedProject ? formSelectedProject.remaining : Infinity;
        const workerLimit = formSelectedWorker ? formSelectedWorker.availableAdvance : 5000;
        return Math.max(0, Math.min(projectRemaining, workerLimit));
    }, [formSelectedProject, formSelectedWorker]);

    // Actions
    const handleApproveStatus = (advId, newStatus) => {
        api.put(`/cash-advances/${advId}/approve`, { status: newStatus }).then(() => {
            fetchCashAdvances();
            loadInitialData(); // Reload expenses so project budget spent updates immediately
        }).catch(err => {
            console.error(err);
            alert(err.message || 'Failed to update status.');
        });
    };

    const handleDeleteAdvance = () => {
        if (!selectedAdvanceForDelete) return;
        api.delete(`/cash-advances/${selectedAdvanceForDelete.id}`).then(() => {
            setCashAdvances(prev => prev.filter(a => a.id !== selectedAdvanceForDelete.id));
            setSelectedAdvanceForDelete(null);
            setModalState('NONE');
            loadInitialData(); // Reload expenses so project budget restored
        }).catch(err => {
            console.error(err);
            alert(err.message || 'Failed to delete record.');
        });
    };

    const handleProjectFilterChange = (e) => {
        const val = e.target.value;
        navigate(val === 'ALL' ? '/cash-advance' : `/cash-advance/${val}`);
    };

    // Modal Form Change Handlers
    const handleProjectSelect = (e) => {
        const pId = e.target.value;
        setFormError('');
        setFormData(prev => ({
            ...prev,
            projectId: pId,
            workerId: '',
            workerName: '',
            amount: ''
        }));
        setIsCustomWorker(false);
    };

    const handleWorkerSelect = (e) => {
        const val = e.target.value;
        setFormError('');
        if (val === '__CUSTOM__') {
            setIsCustomWorker(true);
            setFormData(prev => ({ ...prev, workerId: '', workerName: '' }));
            return;
        }
        setIsCustomWorker(false);
        const w = workersList.find(worker => String(worker.id) === String(val));
        const wName = w ? (w.full_name || [w.first_name, w.last_name].filter(Boolean).join(' ') || w.name || 'Worker') : '';
        setFormData(prev => ({
            ...prev,
            workerId: val,
            workerName: wName
        }));
    };

    const handleAmountChange = (e) => {
        const val = e.target.value;
        setFormData(prev => ({ ...prev, amount: val }));

        const num = parseFloat(val);
        if (num <= 0) {
            setFormError('Amount must be greater than ₱0.');
        } else if (formSelectedProject && formSelectedProject.budget > 0 && num > formSelectedProject.remaining) {
            setFormError(`Amount exceeds project remaining budget (₱${formSelectedProject.remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}).`);
        } else if (formSelectedWorker && num > formSelectedWorker.availableAdvance) {
            setFormError(`Amount exceeds worker advance limit (₱${formSelectedWorker.availableAdvance.toLocaleString(undefined, { minimumFractionDigits: 2 })}).`);
        } else {
            setFormError('');
        }
    };

    const handleInitialSubmit = (e) => {
        e.preventDefault();
        const amt = parseFloat(formData.amount || 0);

        if (!formData.projectId) {
            setFormError('Step 1: Please select a project first.');
            return;
        }
        if (!formData.workerName && !formData.workerId) {
            setFormError('Step 2: Please select or enter a worker.');
            return;
        }
        if (formData.reasonCategory === 'Other' && !formData.customReason.trim()) {
            setFormError('Step 3: Please specify the custom reason.');
            return;
        }
        if (amt <= 0) {
            setFormError('Please enter a valid amount greater than ₱0.');
            return;
        }
        if (formSelectedProject && formSelectedProject.budget > 0 && amt > formSelectedProject.remaining) {
            setFormError(`Cannot save: Exceeds remaining project budget of ₱${formSelectedProject.remaining.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`);
            return;
        }
        if (formSelectedWorker && amt > formSelectedWorker.availableAdvance) {
            setFormError(`Cannot save: Exceeds worker advance limit of ₱${formSelectedWorker.availableAdvance.toLocaleString(undefined, { minimumFractionDigits: 2 })}.`);
            return;
        }

        setFormError('');
        setModalState('CONFIRM');
    };

    const handleConfirmAdd = () => {
        const finalReason = formData.reasonCategory === 'Other'
            ? formData.customReason.trim()
            : formData.reasonCategory;

        const targetProjectId = formData.projectId || currentProjectId;
        const newAdvance = {
            project_id: targetProjectId,
            workerId: formData.workerId || null,
            workerName: formData.workerName || 'Worker',
            amount: parseFloat(formData.amount || 0),
            date: formData.date,
            reason: finalReason,
            status: 'Approved' // Immediately approved & deducted from project budget
        };

        api.post('/cash-advances', newAdvance).then(res => {
            if (currentProjectId !== 'ALL' && String(targetProjectId) !== String(currentProjectId)) {
                navigate(`/cash-advance/${targetProjectId}`);
            } else {
                fetchCashAdvances();
                loadInitialData();
            }
            setModalState('SUCCESS');
        }).catch(err => {
            console.error(err);
            setFormError(err.message || 'Failed to save cash advance.');
            setModalState('ADD');
        });
    };

    const resetAndClose = () => {
        setFormError('');
        setIsCustomWorker(false);
        setModalState('NONE');
        setSelectedAdvanceForDelete(null);
        setFormData({
            projectId: currentProjectId === 'ALL' ? (mockProjects[0]?.id || '') : currentProjectId,
            workerId: '',
            workerName: '',
            date: todayISO,
            reasonCategory: 'Emergency / Medical Expenses',
            customReason: '',
            amount: '',
            status: 'Approved'
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

    const selectStyles = {
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 0.5rem center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '0.8rem 0.8rem'
    };

    return (
        <AdminLayout>
            {/* PAGE TITLE */}
            <div className="mb-2">
                <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">FINANCIAL CONTROLS & PAYROLL</span>
                <h1 className="text-lg font-extrabold text-gray-900 mt-0.5 tracking-tight">Cash Advance Management</h1>
                <p className="text-[10px] text-gray-500 mt-0.5">
                    Select project, worker, and reason with strict limit checks. Approved advances automatically deduct from project budget.
                </p>
            </div>

            {/* TOP BAR: PROJECT FILTER & ACTIONS */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-3 gap-3">
                <div className="w-full md:max-w-sm">
                    <label className="block text-[8px] font-bold text-gray-400 tracking-wider uppercase mb-1">PROJECT SCOPE</label>
                    <select
                        value={currentProjectId}
                        onChange={handleProjectFilterChange}
                        className="w-full bg-white border border-gray-200 shadow-xs rounded-lg pl-2.5 pr-6 py-1.5 text-[10px] font-extrabold text-gray-800 outline-none appearance-none"
                        style={selectStyles}
                    >
                        <option value="ALL">All Projects / Overview</option>
                        {mockProjects.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-2 w-full md:w-auto">
                    <button
                        type="button"
                        onClick={() => {
                            setFormError('');
                            setFormData(prev => ({
                                ...prev,
                                projectId: currentProjectId === 'ALL' ? (mockProjects[0]?.id || '') : currentProjectId,
                                workerId: '',
                                workerName: '',
                                amount: '',
                                customReason: ''
                            }));
                            setModalState('ADD');
                        }}
                        className="bg-[#E8C547] text-gray-900 px-3.5 py-1.5 rounded-lg font-extrabold text-[10px] shadow-xs hover:bg-[#d4b33d] transition-colors flex items-center justify-center gap-1.5 flex-1 md:flex-none cursor-pointer"
                    >
                        <span>+</span> Add Cash Advance
                    </button>
                </div>
            </div>

            {/* PROJECT BUDGET IMPACT SUMMARY BANNER */}
            <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-3 mb-3">
                <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                    <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#A63228]"></span>
                        <h3 className="text-[10px] font-extrabold text-gray-900 uppercase tracking-wide">
                            Project Budget & Advance Overview — {activeProjectInfo.name}
                        </h3>
                    </div>
                    <span className="text-[8px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        Auto-Deducts from Manpower Budget
                    </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="bg-gray-50/70 p-2 rounded-lg border border-gray-100">
                        <p className="text-[7.5px] font-bold text-gray-400 uppercase tracking-wider">Project Budget</p>
                        <p className="text-xs font-extrabold text-gray-900 mt-0.5">
                            ₱{activeProjectInfo.budget.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="bg-gray-50/70 p-2 rounded-lg border border-gray-100">
                        <div className="flex items-center justify-between">
                            <p className="text-[7.5px] font-bold text-gray-400 uppercase tracking-wider">Total Expenses Spent</p>
                            {activeProjectInfo.materialsCost > 0 && (
                                <span className="text-[6.5px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/50 px-1 rounded">
                                    + Mat. Logs
                                </span>
                            )}
                        </div>
                        <p className="text-xs font-extrabold text-gray-800 mt-0.5">
                            ₱{activeProjectInfo.spent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        {activeProjectInfo.materialsCost > 0 && (
                            <p className="text-[6.5px] text-gray-400 mt-0.5">
                                Receipts: ₱{activeProjectInfo.expensesReceipts.toLocaleString(undefined, { maximumFractionDigits: 0 })} | Mat: ₱{activeProjectInfo.materialsCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </p>
                        )}
                    </div>
                    <div className="bg-emerald-50/50 p-2 rounded-lg border border-emerald-100">
                        <p className="text-[7.5px] font-bold text-emerald-800 uppercase tracking-wider">Remaining Project Budget</p>
                        <p className="text-xs font-extrabold text-emerald-700 mt-0.5">
                            ₱{activeProjectInfo.remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="bg-red-50/50 p-2 rounded-lg border border-red-100">
                        <p className="text-[7.5px] font-bold text-[#A63228] uppercase tracking-wider">Approved Cash Advances</p>
                        <p className="text-xs font-extrabold text-[#A63228] mt-0.5">
                            ₱{activeProjectInfo.advancesTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <span className="text-[7px] text-gray-400 font-medium">({activeProjectInfo.advancesCount} approved)</span>
                    </div>
                </div>
            </div>

            {/* ADVANCE RECORDS TABLE */}
            <div className="bg-white rounded-xl shadow-xs border border-gray-100 p-3 mb-3">
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
                                title="Clear date filter"
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
                                className={`bg-[#f4f1ee] px-2.5 py-1 rounded-md text-[9px] font-bold outline-none border transition-colors cursor-pointer ${filterDate ? 'border-[#A63228] text-[#A63228] font-extrabold shadow-xs' : 'border-transparent text-gray-700'}`}
                            />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse min-w-[620px]">
                        <thead>
                            <tr>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[12%] uppercase tracking-wider">DATE</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[18%] uppercase tracking-wider">WORKER NAME</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[22%] uppercase tracking-wider">REASON</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[16%] uppercase tracking-wider">BUDGET IMPACT</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 w-[12%] uppercase tracking-wider">STATUS</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 text-right pr-2 w-[12%] uppercase tracking-wider">AMOUNT</th>
                                <th className="text-[8px] font-bold text-gray-400 border-b border-gray-100 pb-2 text-center w-[8%] uppercase tracking-wider">ACTION</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-6 text-[10px] text-gray-400 italic">
                                        Loading advance records...
                                    </td>
                                </tr>
                            ) : displayedAdvances.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="text-center py-6 text-[10px] text-gray-400 italic">
                                        No cash advances recorded for this project view.
                                    </td>
                                </tr>
                            ) : (
                                displayedAdvances.map((adv) => {
                                    const isApproved = adv.status === 'Approved';
                                    const isRejected = adv.status === 'Rejected';
                                    return (
                                        <tr key={adv.id} className="hover:bg-gray-50/60 transition-colors">
                                            <td className="py-2.5 text-[10px] font-bold text-gray-800 border-b border-gray-50">{formatDisplayDate(adv.date)}</td>
                                            <td className="py-2.5 text-[10px] font-bold text-gray-900 border-b border-gray-50">
                                                <div>{adv.workerName}</div>
                                                {adv.role && <span className="text-[8px] font-medium text-gray-400">{adv.role}</span>}
                                            </td>
                                            <td className="py-2.5 text-[10px] font-medium text-gray-600 border-b border-gray-50">{adv.reason || '-'}</td>
                                            <td className="py-2.5 border-b border-gray-50">
                                                {isApproved ? (
                                                    <span className="inline-flex items-center gap-1 text-[8px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                                                        <span>✓</span> Deducted from Budget
                                                    </span>
                                                ) : isRejected ? (
                                                    <span className="inline-flex items-center text-[8px] font-bold text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded">
                                                        Not Deducted
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center text-[8px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                                        Pending Approval
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2.5 border-b border-gray-50">
                                                <span className={`text-[8.5px] font-bold px-2 py-0.5 rounded-full ${isApproved ? 'bg-[#e6f4ea] text-[#2e7d32]' : isRejected ? 'bg-red-100 text-red-700' : 'bg-[#fff8e1] text-[#f57f17]'}`}>
                                                    {adv.status || 'Pending'}
                                                </span>
                                            </td>
                                            <td className="py-2.5 text-[10px] font-extrabold text-[#A63228] border-b border-gray-50 text-right pr-2">
                                                ₱{Number(adv.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </td>
                                            <td className="py-2.5 border-b border-gray-50 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    {adv.status === 'Pending' ? (
                                                        <>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleApproveStatus(adv.id, 'Approved')}
                                                                className="bg-[#e6f4ea] border border-[#2e7d32] text-[#2e7d32] px-1.5 py-0.5 rounded text-[8px] font-bold hover:bg-green-100 cursor-pointer"
                                                                title="Approve and deduct from project budget"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleApproveStatus(adv.id, 'Rejected')}
                                                                className="bg-white border border-[#A63228] text-[#A63228] px-1.5 py-0.5 rounded text-[8px] font-bold hover:bg-red-50 cursor-pointer"
                                                            >
                                                                Reject
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedAdvanceForDelete(adv);
                                                                setModalState('DELETE_CONFIRM');
                                                            }}
                                                            className="text-gray-400 hover:text-red-600 p-1 rounded hover:bg-gray-100 text-[10px] transition-colors cursor-pointer"
                                                            title="Delete advance record"
                                                        >
                                                            ✕
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-100 text-[10px]">
                    <span className="font-extrabold text-gray-600 uppercase tracking-wider">
                        TOTAL ADVANCES IN VIEW
                    </span>
                    <strong className="font-extrabold text-[#A63228] text-xs">
                        ₱{tableTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </strong>
                </div>
            </div>

            {/* ── STEP-BY-STEP ADD CASH ADVANCE MODAL ── */}
            {modalState === 'ADD' && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex items-center justify-center p-3 sm:p-4">
                    <div className="bg-white rounded-xl w-full max-w-md shadow-2xl relative flex flex-col max-h-[92vh]">
                        {/* Header */}
                        <div className="flex justify-between items-center p-3.5 border-b border-gray-100 bg-[#f9fafb] rounded-t-xl shrink-0">
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-[#A63228]"></span>
                                    <h2 className="text-sm font-extrabold text-gray-900">Add Cash Advance</h2>
                                </div>
                                <p className="text-[10px] text-gray-500 font-medium mt-0.5">
                                    Select project, worker, and reason with budget deduction
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={resetAndClose}
                                className="p-1 hover:bg-white rounded-lg text-gray-400 hover:text-gray-600 transition-colors shadow-2xs border border-transparent hover:border-gray-200 cursor-pointer text-xs"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Form Body */}
                        <form onSubmit={handleInitialSubmit} className="p-4 overflow-y-auto space-y-3.5 flex-1">
                            {/* STEP 1: SELECT PROJECT */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] font-extrabold text-gray-900 flex items-center gap-1">
                                        <span className="w-4 h-4 rounded-full bg-gray-900 text-white text-[9px] flex items-center justify-center font-bold">1</span>
                                        <span>Select Project</span>
                                        <span className="text-[#A63228]">*</span>
                                    </label>
                                    {formSelectedProject && (
                                        <span className="text-[8.5px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                                            Remaining: ₱{formSelectedProject.remaining.toLocaleString()}
                                        </span>
                                    )}
                                </div>
                                <select
                                    name="projectId"
                                    value={formData.projectId}
                                    onChange={handleProjectSelect}
                                    required
                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#A63228] focus:ring-1 focus:ring-[#A63228] appearance-none"
                                    style={selectStyles}
                                >
                                    <option value="">-- Choose a Project --</option>
                                    {mockProjects.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name} {p.budget ? `(Budget: ₱${p.budget.toLocaleString()})` : ''}
                                        </option>
                                    ))}
                                </select>

                                {/* Project Budget Card */}
                                {formSelectedProject && (
                                    <div className="mt-1.5 p-2 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-between text-[9px]">
                                        <div>
                                            <span className="text-gray-400 font-bold uppercase">Total Budget: </span>
                                            <span className="font-extrabold text-gray-900">₱{formSelectedProject.budget.toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 font-bold uppercase">Spent: </span>
                                            <span className="font-extrabold text-gray-700">₱{formSelectedProject.spent.toLocaleString()}</span>
                                        </div>
                                        <div>
                                            <span className="text-gray-400 font-bold uppercase">Available: </span>
                                            <span className={`font-extrabold ${formSelectedProject.remaining > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                                                ₱{formSelectedProject.remaining.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* STEP 2: SELECT WORKER */}
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[10px] font-extrabold text-gray-900 flex items-center gap-1">
                                        <span className="w-4 h-4 rounded-full bg-gray-900 text-white text-[9px] flex items-center justify-center font-bold">2</span>
                                        <span>Select Worker</span>
                                        <span className="text-[#A63228]">*</span>
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsCustomWorker(!isCustomWorker);
                                            setFormData(prev => ({ ...prev, workerId: '', workerName: '' }));
                                            setFormError('');
                                        }}
                                        className="text-[8.5px] text-[#A63228] font-bold hover:underline cursor-pointer"
                                    >
                                        {isCustomWorker ? '← Select from list' : '+ Enter custom worker'}
                                    </button>
                                </div>

                                {!isCustomWorker ? (
                                    <select
                                        name="workerId"
                                        value={formData.workerId}
                                        onChange={handleWorkerSelect}
                                        disabled={!formData.projectId}
                                        required
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#A63228] focus:ring-1 focus:ring-[#A63228] disabled:bg-gray-100 disabled:text-gray-400 appearance-none"
                                        style={selectStyles}
                                    >
                                        <option value="">
                                            {!formData.projectId ? '-- Select a project first --' : '-- Choose a Worker --'}
                                        </option>
                                        {projectAssignedWorkers.length > 0 && (
                                            <optgroup label="Assigned to this Project">
                                                {projectAssignedWorkers.map(w => {
                                                    const wName = w.full_name || [w.first_name, w.last_name].filter(Boolean).join(' ') || w.name;
                                                    return (
                                                        <option key={w.id} value={w.id}>
                                                            {wName} — {w.role || w.position || 'Worker'} (₱{w.daily_rate || 600}/day)
                                                        </option>
                                                    );
                                                })}
                                            </optgroup>
                                        )}
                                        {otherAvailableWorkers.length > 0 && (
                                            <optgroup label="Other Available Workers">
                                                {otherAvailableWorkers.map(w => {
                                                    const wName = w.full_name || [w.first_name, w.last_name].filter(Boolean).join(' ') || w.name;
                                                    return (
                                                        <option key={w.id} value={w.id}>
                                                            {wName} — {w.role || w.position || 'Worker'} (₱{w.daily_rate || 600}/day)
                                                        </option>
                                                    );
                                                })}
                                            </optgroup>
                                        )}
                                        <option value="__CUSTOM__">+ Custom Worker Name...</option>
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        name="workerName"
                                        value={formData.workerName}
                                        onChange={(e) => setFormData(prev => ({ ...prev, workerName: e.target.value }))}
                                        required
                                        placeholder="Enter worker's full name"
                                        className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#A63228] focus:ring-1 focus:ring-[#A63228]"
                                    />
                                )}

                                {/* Worker Limit & Rate Card */}
                                {formSelectedWorker && (
                                    <div className="mt-1.5 p-2 bg-blue-50/60 rounded-lg border border-blue-100 text-[9px] space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-500 font-bold">Daily Wage Rate:</span>
                                            <span className="font-extrabold text-gray-900">₱{formSelectedWorker.dailyRate.toLocaleString()}/day</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-500 font-bold">Max Advance Cap (6 days rate):</span>
                                            <span className="font-extrabold text-gray-800">₱{formSelectedWorker.baseLimit.toLocaleString()}</span>
                                        </div>
                                        {formSelectedWorker.undeductedAdvances > 0 && (
                                            <div className="flex items-center justify-between text-amber-700">
                                                <span className="font-bold">Active Undeducted Advances:</span>
                                                <span className="font-extrabold">-₱{formSelectedWorker.undeductedAdvances.toLocaleString()}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between border-t border-blue-100 pt-1">
                                            <span className="font-extrabold text-blue-900 uppercase">Available Advance Limit:</span>
                                            <span className="font-extrabold text-blue-700 text-[10px]">
                                                ₱{formSelectedWorker.availableAdvance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* STEP 3: REASON DROPDOWN (WITH "OTHER") */}
                            <div>
                                <label className="block text-[10px] font-extrabold text-gray-900 mb-1 flex items-center gap-1">
                                    <span className="w-4 h-4 rounded-full bg-gray-900 text-white text-[9px] flex items-center justify-center font-bold">3</span>
                                    <span>Reason</span>
                                    <span className="text-[#A63228]">*</span>
                                </label>
                                <select
                                    name="reasonCategory"
                                    value={formData.reasonCategory}
                                    onChange={(e) => {
                                        setFormData(prev => ({ ...prev, reasonCategory: e.target.value }));
                                        setFormError('');
                                    }}
                                    required
                                    className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#A63228] focus:ring-1 focus:ring-[#A63228] appearance-none"
                                    style={selectStyles}
                                >
                                    {ADVANCE_REASONS.map(r => (
                                        <option key={r} value={r}>{r}</option>
                                    ))}
                                </select>

                                {/* Custom reason input if 'Other' selected */}
                                {formData.reasonCategory === 'Other' && (
                                    <div className="mt-2">
                                        <label className="block text-[8.5px] font-bold text-gray-600 mb-1">
                                            Specify Custom Reason <span className="text-[#A63228]">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="customReason"
                                            value={formData.customReason}
                                            onChange={(e) => setFormData(prev => ({ ...prev, customReason: e.target.value }))}
                                            required
                                            placeholder="e.g. Relocation assistance, site transit, personal emergency..."
                                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-900 focus:outline-none focus:border-[#A63228] focus:ring-1 focus:ring-[#A63228]"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* STEP 4: AMOUNT & LIMIT VERIFICATION */}
                            <div className="bg-[#f9fafb] p-3 rounded-lg border border-gray-200">
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] font-extrabold text-gray-900 flex items-center gap-1">
                                        <span className="w-4 h-4 rounded-full bg-gray-900 text-white text-[9px] flex items-center justify-center font-bold">4</span>
                                        <span>Advance Amount (₱)</span>
                                        <span className="text-[#A63228]">*</span>
                                    </label>
                                    <span className="text-[8.5px] font-bold text-gray-500">
                                        Max Allowed: <strong>₱{Number.isFinite(maxAllowedAmount) ? maxAllowedAmount.toLocaleString() : '5,000'}</strong>
                                    </span>
                                </div>

                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-extrabold text-sm">₱</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        name="amount"
                                        value={formData.amount}
                                        onChange={handleAmountChange}
                                        required
                                        placeholder="0.00"
                                        className={`w-full bg-white border ${formError ? 'border-[#A63228] focus:ring-[#A63228]' : 'border-gray-200 focus:border-[#A63228] focus:ring-[#A63228]'} rounded-lg pl-8 pr-3 py-2 text-sm font-extrabold text-gray-900 focus:outline-none focus:ring-1`}
                                    />
                                </div>

                                {/* Quick Amount Chips */}
                                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                                    <span className="text-[8px] font-bold text-gray-400 uppercase">Quick Fill:</span>
                                    {[500, 1000, 2000].map(amt => (
                                        <button
                                            key={amt}
                                            type="button"
                                            disabled={amt > maxAllowedAmount}
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, amount: String(amt) }));
                                                setFormError('');
                                            }}
                                            className="px-2 py-0.5 text-[8.5px] font-bold rounded bg-white border border-gray-200 hover:border-gray-400 text-gray-700 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            ₱{amt.toLocaleString()}
                                        </button>
                                    ))}
                                    {Number.isFinite(maxAllowedAmount) && maxAllowedAmount > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setFormData(prev => ({ ...prev, amount: String(maxAllowedAmount) }));
                                                setFormError('');
                                            }}
                                            className="px-2 py-0.5 text-[8.5px] font-bold rounded bg-[#E8C547] text-gray-900 hover:bg-[#d4b33d] cursor-pointer"
                                        >
                                            Max (₱{maxAllowedAmount.toLocaleString()})
                                        </button>
                                    )}
                                </div>

                                {/* Live Budget Deduction Impact Preview */}
                                {formSelectedProject && formData.amount && parseFloat(formData.amount) > 0 && (
                                    <div className="mt-2 pt-2 border-t border-gray-200 flex items-center justify-between text-[8.5px]">
                                        <span className="font-bold text-gray-500">Project Budget Impact:</span>
                                        <span className="font-extrabold text-gray-900">
                                            ₱{formSelectedProject.remaining.toLocaleString()} → <span className="text-emerald-700">₱{Math.max(0, formSelectedProject.remaining - parseFloat(formData.amount)).toLocaleString()}</span>
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* STEP 5: DATE */}
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[9px] font-bold text-gray-500 mb-1">DATE RECORDED</label>
                                    <input
                                        type="date"
                                        name="date"
                                        value={formData.date}
                                        onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                                        required
                                        className="w-full bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#A63228]"
                                    />
                                </div>
                                <div className="flex flex-col justify-end">
                                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-2 py-1 text-[8px] text-emerald-800 font-bold flex items-center gap-1">
                                        <span>✓</span>
                                        <span>Auto-deducts from Manpower Budget</span>
                                    </div>
                                </div>
                            </div>

                            {/* Error Alert */}
                            {formError && (
                                <div className="p-2 bg-red-50 border border-red-200 text-[#A63228] rounded-lg text-[9px] font-bold">
                                    {formError}
                                </div>
                            )}
                        </form>

                        {/* Modal Footer */}
                        <div className="p-3 border-t border-gray-100 bg-[#f9fafb] rounded-b-xl flex justify-end gap-2 shrink-0">
                            <button
                                type="button"
                                onClick={resetAndClose}
                                className="px-3.5 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleInitialSubmit}
                                className="px-4 py-1.5 text-xs font-bold text-white bg-[#A63228] rounded-lg hover:bg-[#8B1A10] transition-colors cursor-pointer shadow-xs"
                            >
                                Review & Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── CONFIRM SAVE & BUDGET DEDUCTION MODAL ── */}
            {modalState === 'CONFIRM' && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl p-5 text-center flex flex-col items-center">
                        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mb-3">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <line x1="12" y1="8" x2="12" y2="12"></line>
                                <line x1="12" y1="16" x2="12.01" y2="16"></line>
                            </svg>
                        </div>
                        <h3 className="text-sm font-extrabold text-gray-900 mb-1">Confirm Cash Advance & Budget Deduction</h3>
                        <p className="text-xs text-gray-500 mb-3 px-2">
                            Please review the cash advance details below:
                        </p>

                        <div className="w-full bg-gray-50 rounded-lg p-3 text-left text-xs mb-4 border border-gray-100 space-y-1.5">
                            <div className="flex justify-between">
                                <span className="text-gray-400 font-bold text-[9px] uppercase">Project:</span>
                                <span className="font-extrabold text-gray-900">{formSelectedProject?.name || 'Site'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400 font-bold text-[9px] uppercase">Worker:</span>
                                <span className="font-extrabold text-gray-900">{formData.workerName}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400 font-bold text-[9px] uppercase">Reason:</span>
                                <span className="font-medium text-gray-700">
                                    {formData.reasonCategory === 'Other' ? formData.customReason : formData.reasonCategory}
                                </span>
                            </div>
                            <div className="flex justify-between border-t border-gray-200 pt-1.5">
                                <span className="text-gray-500 font-bold text-[9px] uppercase">Advance Amount:</span>
                                <span className="font-extrabold text-[#A63228] text-sm">
                                    ₱{parseFloat(formData.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            {formSelectedProject && (
                                <div className="flex justify-between border-t border-gray-200 pt-1.5 text-[9px] text-emerald-800">
                                    <span className="font-bold">Project Budget Impact:</span>
                                    <span className="font-extrabold">
                                        -₱{parseFloat(formData.amount || 0).toLocaleString()} (Deducted)
                                    </span>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2 w-full">
                            <button
                                type="button"
                                onClick={() => setModalState('ADD')}
                                className="flex-1 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 cursor-pointer"
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmAdd}
                                className="flex-1 py-2 bg-[#A63228] text-white text-xs font-bold rounded-lg hover:bg-[#8B1A10] cursor-pointer"
                            >
                                Confirm Save
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── SUCCESS MODAL ── */}
            {modalState === 'SUCCESS' && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-xs shadow-2xl p-5 text-center flex flex-col items-center">
                        <div className="w-12 h-12 bg-[#e6f4ea] text-[#2e7d32] rounded-full flex items-center justify-center mb-3">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="20 6 9 17 4 12"></polyline>
                            </svg>
                        </div>
                        <h3 className="text-sm font-extrabold text-gray-900 mb-1">Cash Advance Recorded</h3>
                        <p className="text-xs text-gray-500 mb-4">
                            The cash advance was recorded and successfully deducted from the project budget.
                        </p>
                        <button
                            type="button"
                            onClick={resetAndClose}
                            className="w-full py-2 bg-[#A63228] text-white text-xs font-bold rounded-lg hover:bg-[#8B1A10] cursor-pointer"
                        >
                            Done
                        </button>
                    </div>
                </div>
            )}

            {/* ── DELETE CONFIRMATION MODAL ── */}
            {modalState === 'DELETE_CONFIRM' && selectedAdvanceForDelete && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[60] flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-xs shadow-2xl p-5 text-center flex flex-col items-center">
                        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-3">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                        </div>
                        <h3 className="text-sm font-extrabold text-gray-900 mb-1">Delete Advance Record</h3>
                        <p className="text-xs text-gray-500 mb-4 px-2">
                            Are you sure you want to delete this cash advance of <strong>₱{Number(selectedAdvanceForDelete.amount || 0).toLocaleString()}</strong> for <strong>{selectedAdvanceForDelete.workerName}</strong>? This will restore the deducted amount to the project budget.
                        </p>
                        <div className="flex gap-2 w-full">
                            <button
                                type="button"
                                onClick={() => {
                                    setSelectedAdvanceForDelete(null);
                                    setModalState('NONE');
                                }}
                                className="flex-1 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg hover:bg-gray-200 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDeleteAdvance}
                                className="flex-1 py-2 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 cursor-pointer"
                            >
                                Delete & Restore
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminLayout>
    );
}
