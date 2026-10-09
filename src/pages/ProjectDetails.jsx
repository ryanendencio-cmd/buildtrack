import React, { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { api } from '../api'
import AddBudgetModal from '../components/AddBudgetModal'

export default function ProjectDetails() {
    const { id } = useParams()

    const [project, setProject] = useState(null)
    const [expenses, setExpenses] = useState([])
    const [attendance, setAttendance] = useState([])
    const [materials, setMaterials] = useState([])
    const [assets, setAssets] = useState([])
    const [additions, setAdditions] = useState([])
    const [loading, setLoading] = useState(true)

    const [completeModal, setCompleteModal] = useState(false)
    const [successModal, setSuccessModal] = useState(false)
    const [showAddBudget, setShowAddBudget] = useState(false)

    useEffect(() => {
        if (!id) return
        queueMicrotask(() => setLoading(true))
        Promise.all([
            api.get(`/projects`).catch(() => []),
            api.get(`/expenses/${id}`).catch(() => []),
            api.get(`/attendance/${id}`).catch(() => []),
            api.get(`/materials/${id}`).catch(() => []),
            api.get(`/assets/${id}`).catch(() => []),
            api.get(`/projects/${id}/budget-additions`).catch(() => [])
        ]).then(([projs, exp, att, mat, ast, added]) => {
            const projectList = Array.isArray(projs) ? projs : []
            const found = projectList.find(p => String(p.id) === String(id))
            setProject(found || null)
            setExpenses(Array.isArray(exp) ? exp : [])
            setAttendance(Array.isArray(att) ? att : [])
            setMaterials(Array.isArray(mat) ? mat : [])
            setAssets(Array.isArray(ast) ? ast : [])
            setAdditions(Array.isArray(added) ? added : [])
        }).catch(console.error)
        .finally(() => setLoading(false))
    }, [id])

    const handleMarkCompleted = () => {
        api.put(`/projects/${id}`, { ...project, status: 'COMPLETED', end_date: new Date().toISOString().split('T')[0] })
            .then(() => {
                setProject(prev => ({ ...prev, status: 'COMPLETED', end_date: new Date().toISOString().split('T')[0] }))
                setCompleteModal(false)
                setSuccessModal(true)
            }).catch(console.error)
    }

    if (loading) return (
        <AdminLayout>
            <div className="flex items-center justify-center h-40">
                <p className="text-xs text-gray-400 animate-pulse">Loading project details...</p>
            </div>
        </AdminLayout>
    )

    if (!project) return (
        <AdminLayout>
            <div className="flex flex-col items-center justify-center h-40 gap-2">
                <p className="text-xs text-gray-400">Project not found.</p>
                <Link to="/projects" className="text-[#A63228] text-xs font-bold hover:underline">← Back to Projects</Link>
            </div>
        </AdminLayout>
    )

    const totalSpent = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
    const budget = Number(project.budget || 0)
    const addedTotal = additions.reduce((s, a) => s + Number(a.amount || 0), 0)
    const remaining = budget - totalSpent
    const percent = budget > 0 ? Math.min(Math.round((totalSpent / budget) * 100), 100) : 0

    const today = new Date().toISOString().split('T')[0]
    const todayAtt = attendance.filter(a => a.date === today)
    const presentToday = todayAtt.filter(a => a.status === 'Present').length
    const absentToday = todayAtt.filter(a => a.status === 'Absent').length
    const todayWage = todayAtt.filter(a => a.status === 'Present').reduce((s, a) => s + Number(a.rate || 0), 0)

    const inUseAssets = assets.filter(a => a.status === 'In Use')
    const recentExpenses = [...expenses].slice(0, 3)

    const expensesMaterials = expenses
        .filter(e => (e.category || '').toUpperCase() === 'MATERIALS')
        .flatMap(e => (e.items || []).map(item => ({
            name: item.description,
            quantity: item.qty,
            unit: item.unit || 'pcs',
            unit_cost: item.price
        })));

    const combinedMaterials = [
        ...materials.map(m => ({
            name: m.name,
            quantity: m.qty || m.quantity || 0,
            unit: m.unit || '',
            unit_cost: m.cost || m.unit_cost || 0
        })),
        ...expensesMaterials
    ];

    const totalMaterialCost = combinedMaterials.reduce((s, m) => s + (Number(m.quantity || 0) * Number(m.unit_cost || 0)), 0);

    const formatDate = (d) => {
        if (!d) return '—'
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const isOngoing = (project.status || '').toUpperCase() !== 'COMPLETED'

    return (
        <AdminLayout>
            {/* ── BREADCRUMB ── */}
            <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
                <Link to="/projects" className="text-gray-500 hover:text-[#A63228] text-[10px] font-bold flex items-center gap-1 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    Back to Projects
                </Link>
                <div className="flex items-center gap-2">
                    {isOngoing && (
                        <button onClick={() => setShowAddBudget(true)} className="bg-[#E8C547] text-gray-900 px-3 py-1.5 rounded-lg font-bold text-[10px] shadow-sm hover:bg-[#d4b33d] transition-colors flex items-center gap-1.5">
                            <span>+</span> Add Budget
                        </button>
                    )}
                    {isOngoing && (
                        <button onClick={() => setCompleteModal(true)} className="bg-[#E8C547] text-gray-900 px-3 py-1.5 rounded-lg font-bold text-[10px] shadow-sm hover:bg-[#d4b33d] transition-colors flex items-center gap-1.5">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                            Mark as Finished
                        </button>
                    )}
                </div>
            </div>

            {/* ── PROJECT INFORMATION ── */}
            <div className="mb-4">
                <h3 className="text-[9px] font-extrabold text-[#A63228] tracking-widest uppercase mb-1.5">PROJECT INFORMATION</h3>
                <div className="bg-white rounded-xl py-3 px-4 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border border-gray-100">
                    <div className="flex-1">
                        <p className="text-[8px] font-bold text-gray-400 tracking-widest uppercase mb-0.5">PROJECT NAME</p>
                        <h2 className="text-[11px] font-extrabold text-gray-900 uppercase leading-snug">{project.name}</h2>
                    </div>
                    <div className="lg:w-48">
                        <p className="text-[8px] font-bold text-gray-400 tracking-widest uppercase mb-0.5">LOCATION</p>
                        <p className="text-[9px] font-medium text-gray-600 leading-relaxed">{project.location || '—'}</p>
                    </div>
                    <div className="flex gap-4 lg:gap-6 items-center">
                        <div>
                            <p className="text-[8px] font-bold text-gray-400 tracking-widest uppercase mb-0.5">STARTED</p>
                            <p className="text-[10px] font-bold text-gray-800">{formatDate(project.start_date)}</p>
                        </div>
                        {!isOngoing && project.end_date && (
                            <div>
                                <p className="text-[8px] font-bold text-gray-400 tracking-widest uppercase mb-0.5">FINISHED</p>
                                <p className="text-[10px] font-bold text-gray-800">{formatDate(project.end_date)}</p>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <div>
                            <p className="text-[8px] font-bold text-gray-400 tracking-widest uppercase mb-0.5">CONTRACT</p>
                            <p className="text-xs font-extrabold text-[#A63228]">₱{budget.toLocaleString()}</p>
                            {addedTotal > 0 && (
                                <p className="text-[7px] text-gray-400 font-semibold mt-0.5">includes ₱{addedTotal.toLocaleString()} added</p>
                            )}
                        </div>
                        <span className={`text-[8px] font-extrabold px-2 py-1 rounded-sm uppercase tracking-widest ${isOngoing ? 'bg-[#fce8e6] text-[#A63228]' : 'bg-[#e6f4ea] text-[#2e7d32]'}`}>
                            {project.status}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── PROJECT MONITORING ── */}
            <div>
                <h3 className="text-[9px] font-extrabold text-[#A63228] tracking-widest uppercase mb-1.5">PROJECT MONITORING</h3>

                {/* BUDGET CARD */}
                <div className="bg-gradient-to-r from-[#5a0f0a] via-[#7B1F16] to-[#4a0c08] rounded-xl shadow-sm p-3 text-white mb-3">
                    <div className="flex justify-between items-center mb-1">
                        <p className="text-[8px] font-bold text-white/70 tracking-widest uppercase">BUDGET PROGRESS</p>
                        <span className="text-[9px] font-medium text-white/90">Actual vs Target</span>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                        <h2 className="text-lg md:text-xl font-extrabold">₱{totalSpent.toLocaleString()}</h2>
                        <span className="text-[9px] font-bold text-white/40 italic px-2">VS</span>
                        <h2 className="text-base md:text-lg font-extrabold">₱{budget.toLocaleString()}</h2>
                    </div>
                    <div className="mt-1">
                        <div className="w-full bg-white/20 rounded-full h-1 mb-1 overflow-hidden">
                            <div className="bg-[#E8C547] h-full rounded-full transition-all" style={{ width: `${percent}%` }}></div>
                        </div>
                        <div className="flex justify-between text-[8px] font-medium">
                            <span className="text-[#E8C547] font-bold">{percent}% USED</span>
                            <span className="text-white/80">Remaining: <strong className="text-[#E8C547]">₱{remaining.toLocaleString()}</strong></span>
                        </div>
                    </div>
                </div>

                {additions.length > 0 && (
                    <div className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100 mb-3">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-extrabold text-[11px] text-gray-900">Budget Additions</h4>
                            <span className="text-[9px] font-extrabold text-[#A63228]">₱{addedTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col gap-2 max-h-40 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                            {additions.map((entry) => (
                                <div key={entry.id} className="flex justify-between items-center border-b border-gray-50 pb-1.5">
                                    <div className="flex flex-col">
                                        <strong className="text-[9px] text-gray-900">{entry.note || 'Additional budget'}</strong>
                                        <span className="text-[8px] text-gray-400">{formatDate(entry.date)}</span>
                                    </div>
                                    <strong className="text-[10px] text-[#A63228]">+₱{Number(entry.amount).toLocaleString()}</strong>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* 2x2 GRID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-8">
                    {/* MANPOWER */}
                    <div className="bg-white rounded-xl p-3.5 shadow-sm flex flex-col border border-gray-100">
                        <h4 className="font-extrabold text-[11px] text-gray-900 mb-2">Manpower</h4>
                        <div className="flex flex-col gap-2 flex-1">
                            <div className="flex justify-between text-[9px] border-b border-gray-50 pb-1"><span className="text-gray-500 font-medium">Present Today</span><strong className="text-gray-900">{presentToday} workers</strong></div>
                            <div className="flex justify-between text-[9px] border-b border-gray-50 pb-1"><span className="text-gray-500 font-medium">Absent Today</span><strong className="text-gray-900">{absentToday} workers</strong></div>
                            <div className="flex justify-between text-[9px] pb-1"><span className="text-gray-500 font-medium">Today's Daily Wages</span><strong className="text-[#A63228] font-bold">₱{todayWage.toLocaleString()}</strong></div>
                        </div>
                        <Link to={`/attendance/${id}`} className="text-[#A63228] text-[9px] font-bold text-right mt-2 hover:underline">View Attendance →</Link>
                    </div>

                    {/* MATERIALS */}
                    <div className="bg-white rounded-xl p-3.5 shadow-sm flex flex-col border border-gray-100">
                        <h4 className="font-extrabold text-[11px] text-gray-900 mb-2">Materials</h4>
                        <div className="flex flex-col gap-2 flex-1">
                            {combinedMaterials.length === 0 ? (
                                <p className="text-[9px] text-gray-400 italic">No materials logged.</p>
                            ) : combinedMaterials.slice(0, 3).map((mat, i) => (
                                <div key={i} className="flex justify-between text-[9px] border-b border-gray-50 pb-1">
                                    <span className="text-gray-500 font-medium">{mat.name}</span>
                                    <strong className="text-gray-900">{mat.quantity} {mat.unit}</strong>
                                </div>
                            ))}
                            <div className="flex justify-between text-[9px] pb-1">
                                <span className="text-gray-500 font-medium">Total Material Cost</span>
                                <strong className="text-[#A63228] font-extrabold">₱{totalMaterialCost.toLocaleString()}</strong>
                            </div>
                        </div>
                        <Link to={`/materials/${id}`} className="text-[#A63228] text-[9px] font-bold text-right mt-2 hover:underline">View Material Log →</Link>
                    </div>

                    {/* EQUIPMENT */}
                    <div className="bg-white rounded-xl p-3.5 shadow-sm flex flex-col border border-gray-100">
                        <h4 className="font-extrabold text-[11px] text-gray-900 mb-2">Equipment & Tools</h4>
                        <div className="flex flex-col gap-2 flex-1">
                            {assets.length === 0 ? (
                                <p className="text-[9px] text-gray-400 italic">No equipment logged.</p>
                            ) : assets.slice(0, 3).map((a, i) => (
                                <div key={i} className="flex justify-between items-center text-[9px] border-b border-gray-50 pb-1">
                                    <span className="text-gray-500 font-medium">{a.name}</span>
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide ${a.status === 'In Use' ? 'bg-[#fce8e6] text-[#A63228]' : a.status === 'Maintenance' ? 'bg-yellow-50 text-yellow-700' : 'bg-[#e6f4ea] text-[#2e7d32]'}`}>{a.status}</span>
                                </div>
                            ))}
                            <div className="flex justify-between items-center text-[9px] pb-1"><span className="text-gray-500 font-medium">Checked out currently</span><strong className="text-gray-900">{inUseAssets.length} tools</strong></div>
                        </div>
                        <Link to={`/assets/${id}`} className="text-[#A63228] text-[9px] font-bold text-right mt-2 hover:underline">View Assets →</Link>
                    </div>

                    {/* RECEIPTS */}
                    <div className="bg-white rounded-xl p-3.5 shadow-sm flex flex-col border border-gray-100">
                        <h4 className="font-extrabold text-[11px] text-gray-900 mb-2">Recent Receipts</h4>
                        <div className="flex flex-col gap-2 flex-1">
                            {recentExpenses.length === 0 ? (
                                <p className="text-[9px] text-gray-400 italic">No expenses logged.</p>
                            ) : recentExpenses.map((r, i) => (
                                <div key={i} className="flex justify-between items-center border-b border-gray-50 pb-1">
                                    <div className="flex flex-col">
                                        <strong className="text-[9px] text-gray-900">{r.receipt_no || `#${r.id}`}</strong>
                                        <span className="text-[8px] text-gray-400">{r.category} · {formatDate(r.date)}</span>
                                    </div>
                                    <strong className="text-[10px] text-[#A63228]">₱{Number(r.amount).toLocaleString()}</strong>
                                </div>
                            ))}
                        </div>
                        <Link to={`/expenses/${id}`} className="text-[#A63228] text-[9px] font-bold text-right mt-2 hover:underline">View All Receipts →</Link>
                    </div>
                </div>
            </div>

            {showAddBudget && (
                <AddBudgetModal
                    project={project}
                    onClose={() => setShowAddBudget(false)}
                    onSaved={(data) => {
                        const newBudget = data.budget !== undefined ? data.budget : (Number(project?.budget || 0) + Number(data.amount || 0));
                        setProject(prev => ({ ...prev, budget: newBudget }))
                        setAdditions(prev => [{
                            id: data.id,
                            project_id: data.project_id,
                            amount: data.amount,
                            note: data.note,
                            date: data.date
                        }, ...prev])
                    }}
                />
            )}

            {/* CONFIRM MARK AS FINISHED */}
            {completeModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-[320px] shadow-2xl text-center">
                        <h3 className="text-sm font-extrabold text-[#1a1a1a] mb-2">Finish Project?</h3>
                        <p className="text-[10px] text-gray-500 mb-6 px-2 leading-relaxed">Are you sure you want to mark this project as COMPLETED?</p>
                        <div className="flex gap-2">
                            <button onClick={() => setCompleteModal(false)} className="flex-1 py-2 bg-white border border-[#A63228] text-[#A63228] rounded-xl text-[10px] font-bold hover:bg-red-50 transition-colors">Cancel</button>
                            <button onClick={handleMarkCompleted} className="flex-1 py-2 bg-[#8B1A10] text-white rounded-xl text-[10px] font-bold hover:bg-[#72150d] transition-colors">Yes, Finish it</button>
                        </div>
                    </div>
                </div>
            )}

            {/* SUCCESS MODAL */}
            {successModal && (
                <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl p-6 w-full max-w-[280px] shadow-2xl text-center">
                        <div className="w-12 h-12 bg-[#e6f4ea] rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-6 h-6 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h3 className="text-sm font-extrabold text-[#1a1a1a] mb-1">Project Completed!</h3>
                        <p className="text-[10px] text-gray-500 font-medium mb-6">Status has been updated successfully.</p>
                        <button onClick={() => setSuccessModal(false)} className="w-full py-2.5 bg-[#2e7d32] text-white rounded-xl text-[10px] font-bold hover:bg-[#1b5e20] transition-colors">Done</button>
                    </div>
                </div>
            )}
        </AdminLayout>
    )
}
