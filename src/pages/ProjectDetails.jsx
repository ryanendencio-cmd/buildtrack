import React, { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { api } from '../api'
import AddBudgetModal from '../components/AddBudgetModal'
import Pagination from '../components/Pagination'
import { usePagination } from '../components/usePagination'

const getTodayISO = () => {
    const date = new Date()
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

export default function ProjectDetails() {
    const { id } = useParams()

    const [project, setProject] = useState(null)
    const [expenses, setExpenses] = useState([])
    const [attendance, setAttendance] = useState([])
    const [assets, setAssets] = useState([])
    const [additions, setAdditions] = useState([])
    const [clientPayments, setClientPayments] = useState([])
    const [loading, setLoading] = useState(true)
    const additionsPagination = usePagination(additions, id)

    const [completeModal, setCompleteModal] = useState(false)
    const [successModal, setSuccessModal] = useState(false)
    const [showAddBudget, setShowAddBudget] = useState(false)
    const [showAddPayment, setShowAddPayment] = useState(false)
    const [paymentSaving, setPaymentSaving] = useState(false)
    const [paymentError, setPaymentError] = useState('')
    const [paymentForm, setPaymentForm] = useState({
        amount: '',
        date: getTodayISO(),
        paymentType: 'Downpayment',
        paymentMethod: 'Cash',
        reference: '',
        note: ''
    })
    const [receiptImage, setReceiptImage] = useState(null)
    const [receiptFileName, setReceiptFileName] = useState('')
    const [showUnreceiptedList, setShowUnreceiptedList] = useState(false)

    useEffect(() => {
        if (!id) return
        queueMicrotask(() => setLoading(true))
        Promise.all([
            api.get(`/projects`).catch(() => []),
            api.get(`/expenses/${id}`).catch(() => []),
            api.get(`/attendance/${id}`).catch(() => []),
            api.get(`/assets/${id}`).catch(() => []),
            api.get(`/projects/${id}/budget-additions`).catch(() => []),
            api.get(`/projects/${id}/client-payments`).catch(() => [])
        ]).then(([projs, exp, att, ast, added, payments]) => {
            const projectList = Array.isArray(projs) ? projs : []
            const found = projectList.find(p => String(p.id) === String(id))
            setProject(found || null)
            setExpenses(Array.isArray(exp) ? exp : [])
            setAttendance(Array.isArray(att) ? att : [])
            setAssets(Array.isArray(ast) ? ast : [])
            setAdditions(Array.isArray(added) ? added : [])
            setClientPayments(Array.isArray(payments) ? payments : [])
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
    const budget = Number(project.budget ?? project.contract_amount ?? 0)
    const contractAmount = Number(project.contract_amount ?? project.budget ?? 0)
    const expenseLimit = Math.min(budget, contractAmount)
    const addedTotal = additions.reduce((s, a) => s + Number(a.amount || 0), 0)
    const totalPaymentsReceived = clientPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const downPaymentReceived = clientPayments
        .filter(payment => String(payment.payment_type || '').toLowerCase() === 'downpayment')
        .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)
    const balanceDue = contractAmount - totalPaymentsReceived
    const downPaymentTarget = Math.round(contractAmount * 0.2 * 100) / 100
    const suggestedDownPayment = Math.max(0, downPaymentTarget - downPaymentReceived)
    const remaining = expenseLimit - totalSpent
    const percent = expenseLimit > 0 ? Math.min(Math.round((totalSpent / expenseLimit) * 100), 100) : 0

    const today = new Date().toISOString().split('T')[0]
    const todayAtt = attendance.filter(a => a.date === today)
    const presentToday = todayAtt.filter(a => {
        const status = String(a.status || '').trim().toLowerCase()
        return status === 'present' || status === 'full day' || status === 'late' ||
            status === 'double late' || status.includes('halfday') || status.includes('half day')
    }).length
    const absentToday = todayAtt.filter(a => a.status === 'Absent').length
    const todayWage = todayAtt.filter(a => a.status === 'Present').reduce((s, a) => s + Number(a.rate || 0), 0)

    const inUseAssets = assets.filter(a => a.status === 'In Use')
    const recentExpenses = [...expenses].slice(0, 3)

    const formatDate = (d) => {
        if (!d) return '—'
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }

    const isOngoing = (project.status || '').toUpperCase() !== 'COMPLETED'

    // ── BUDGET BREAKDOWN ──
    // Expenses breakdown by category
    const expensesByCategory = {
        Materials: 0,
        Manpower: 0,
        Equipment: 0,
        Other: 0
    }
    expenses.forEach(e => {
        const cat = (e.category || 'Other')
        if (cat === 'Materials') expensesByCategory.Materials += Number(e.amount || 0)
        else if (cat === 'Manpower') expensesByCategory.Manpower += Number(e.amount || 0)
        else if (cat === 'Equipment') expensesByCategory.Equipment += Number(e.amount || 0)
        else expensesByCategory.Other += Number(e.amount || 0)
    })

    // Total cost = all verified expense receipts
    const totalCombinedCost = totalSpent
    const remainingBudget = expenseLimit - totalCombinedCost
    const usedPercent = expenseLimit > 0 ? Math.min(Math.round((totalCombinedCost / expenseLimit) * 100), 100) : 0
    const isOverBudget = remainingBudget < 0

    const openAddPayment = () => {
        setPaymentError('')
        setPaymentForm({
            amount: '',
            date: getTodayISO(),
            paymentType: downPaymentReceived < downPaymentTarget ? 'Downpayment' : 'Progress Payment',
            paymentMethod: 'Cash',
            reference: '',
            note: ''
        })
        setReceiptImage(null)
        setReceiptFileName('')
        setShowAddPayment(true)
    }

    const handleReceiptUpload = (event) => {
        const file = event.target.files?.[0]
        if (!file) {
            setReceiptImage(null)
            setReceiptFileName('')
            return
        }

        if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
            setReceiptImage(null)
            setReceiptFileName('')
            setPaymentError('Upload a JPG, PNG, or WebP receipt image.')
            event.target.value = ''
            return
        }
        if (file.size > 512 * 1024) {
            setReceiptImage(null)
            setReceiptFileName('')
            setPaymentError('Receipt image must be 512 KB or smaller.')
            event.target.value = ''
            return
        }

        const reader = new FileReader()
        reader.onload = () => {
            if (typeof reader.result !== 'string') {
                setPaymentError('Could not read the selected receipt image.')
                return
            }
            setReceiptImage(reader.result)
            setReceiptFileName(file.name)
            setPaymentError('')
        }
        reader.onerror = () => setPaymentError('Could not read the selected receipt image.')
        reader.readAsDataURL(file)
    }

    const handleAddClientPayment = async (e) => {
        e.preventDefault()
        const amount = Number(paymentForm.amount)
        if (!Number.isFinite(amount) || amount <= 0 || amount > 999999999999) {
            setPaymentError('Enter a payment amount greater than 0 and no more than ₱999,999,999,999.')
            return
        }
        if (paymentForm.paymentType === 'Downpayment' && downPaymentReceived + amount < downPaymentTarget) {
            setPaymentError(`Downpayment must reach at least 20% of the contract amount. Add at least ₱${suggestedDownPayment.toLocaleString()}.`)
            return
        }
        if (paymentForm.paymentType !== 'Downpayment' && downPaymentReceived < downPaymentTarget) {
            setPaymentError(`Record the minimum 20% downpayment first. Remaining downpayment: ₱${suggestedDownPayment.toLocaleString()}.`)
            return
        }
        if (paymentForm.paymentMethod !== 'Cash' && !receiptImage) {
            setPaymentError('Upload the receipt image for non-cash payments.')
            return
        }

        setPaymentSaving(true)
        setPaymentError('')
        try {
            const payment = await api.post(`/projects/${id}/client-payments`, {
                amount: Math.round(amount * 100) / 100,
                date: paymentForm.date,
                payment_type: paymentForm.paymentType,
                payment_method: paymentForm.paymentMethod,
                reference: paymentForm.reference.trim(),
                note: paymentForm.note.trim(),
                receipt_image: receiptImage
            })
            setClientPayments(prev => [payment, ...prev])
            setReceiptImage(null)
            setReceiptFileName('')
            setShowAddPayment(false)
        } catch (err) {
            setPaymentError(err.message || 'Failed to record client payment.')
        } finally {
            setPaymentSaving(false)
        }
    }

    const handleDeleteClientPayment = async (payment) => {
        if (!window.confirm(`Delete the payment of ₱${Number(payment.amount || 0).toLocaleString()}?`)) return
        try {
            await api.delete(`/projects/${id}/client-payments/${payment.id}`)
            setClientPayments(prev => prev.filter(item => item.id !== payment.id))
        } catch (err) {
            alert(`Failed to delete payment: ${err.message}`)
        }
    }

    return (
        <AdminLayout>
            {/* ── BREADCRUMB ── */}
            <div className="flex justify-between items-center mb-3 gap-2 flex-wrap">
                <Link to="/projects" className="text-gray-500 hover:text-[#A63228] text-[10px] font-bold flex items-center gap-1 transition-colors">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>
                    Back to Projects
                </Link>
                <div className="flex items-center gap-2">
                    <button onClick={openAddPayment} className="bg-[#2e7d32] text-white px-3 py-1.5 rounded-lg font-bold text-[10px] shadow-sm hover:bg-[#1b5e20] transition-colors flex items-center gap-1.5">
                        <span>+</span> Record Client Payment
                    </button>
                    {isOngoing && (
                        <button onClick={() => setShowAddBudget(true)} className="bg-[#E8C547] text-gray-900 px-3 py-1.5 rounded-lg font-bold text-[10px] shadow-sm hover:bg-[#d4b33d] transition-colors flex items-center gap-1.5">
                            <span>+</span> Add Expense Budget
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
                <h3 className="text-[11px] font-extrabold text-[#A63228] tracking-widest uppercase mb-1.5">PROJECT INFORMATION</h3>
                <div className="bg-white rounded-xl py-3 px-4 shadow-sm flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 border border-gray-100">
                    <div className="flex-1">
                        <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-0.5">PROJECT NAME</p>
                        <h2 className="text-[11px] font-extrabold text-gray-900 uppercase leading-snug">{project.name}</h2>
                    </div>
                    <div className="lg:w-48">
                        <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-0.5">LOCATION</p>
                        <p className="text-[11px] font-medium text-gray-600 leading-relaxed">{project.location || '—'}</p>
                    </div>
                    <div className="flex gap-4 lg:gap-6 items-center">
                        <div>
                            <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-0.5">STARTED</p>
                            <p className="text-[10px] font-bold text-gray-800">{formatDate(project.start_date)}</p>
                        </div>
                        {!isOngoing && project.end_date && (
                            <div>
                                <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-0.5">FINISHED</p>
                                <p className="text-[10px] font-bold text-gray-800">{formatDate(project.end_date)}</p>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <div>
                            <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-0.5">CONTRACT AMOUNT</p>
                            <p className="text-xs font-extrabold text-[#A63228]">₱{contractAmount.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-gray-400 tracking-widest uppercase mb-0.5">EXPENSE BUDGET</p>
                            <p className="text-xs font-extrabold text-gray-700">₱{budget.toLocaleString()}</p>
                            {addedTotal > 0 && (
                                <p className="text-[10px] text-gray-400 font-semibold mt-0.5">includes ₱{addedTotal.toLocaleString()} added</p>
                            )}
                        </div>
                        <span className={`text-[11px] font-extrabold px-2 py-1 rounded-sm uppercase tracking-widest ${isOngoing ? 'bg-[#fce8e6] text-[#A63228]' : 'bg-[#e6f4ea] text-[#2e7d32]'}`}>
                            {project.status}
                        </span>
                    </div>
                </div>
            </div>

            {/* ── CLIENT PAYMENTS ── */}
            <section className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-4">
                <div className="flex justify-between items-center gap-3 mb-3">
                    <div>
                        <h3 className="text-[11px] font-extrabold text-[#A63228] tracking-widest uppercase">CLIENT PAYMENTS</h3>
                        <p className="text-[10px] text-gray-500 mt-0.5">Record received payments separately from project expenses.</p>
                    </div>
                    <button onClick={openAddPayment} className="shrink-0 bg-[#2e7d32] text-white px-3 py-1.5 rounded-lg font-bold text-[10px] hover:bg-[#1b5e20]">
                        + Record Payment
                    </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-3">
                    <div className="rounded-lg bg-gray-50 border border-gray-100 p-3">
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Contract Amount</p>
                        <p className="text-sm font-extrabold text-gray-900">₱{contractAmount.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-500 mt-1">Minimum downpayment (20%): ₱{downPaymentTarget.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-500 mt-0.5">Downpayment received: ₱{downPaymentReceived.toLocaleString()}</p>
                    </div>
                    <div className="rounded-lg bg-green-50 border border-green-100 p-3">
                        <p className="text-[10px] font-bold text-green-700 uppercase">Payments Received</p>
                        <p className="text-sm font-extrabold text-green-800">₱{totalPaymentsReceived.toLocaleString()}</p>
                    </div>
                    <div className={`rounded-lg border p-3 ${balanceDue < 0 ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'}`}>
                        <p className={`text-[10px] font-bold uppercase ${balanceDue < 0 ? 'text-blue-700' : 'text-amber-700'}`}>
                            {balanceDue < 0 ? 'Client Credit' : 'Balance Due'}
                        </p>
                        <p className={`text-sm font-extrabold ${balanceDue < 0 ? 'text-blue-800' : 'text-amber-800'}`}>
                            ₱{Math.abs(balanceDue).toLocaleString()}
                        </p>
                    </div>
                </div>

                {clientPayments.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic py-2">No client payments recorded yet.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[560px] text-left">
                            <thead>
                                <tr className="border-b border-gray-100">
                                    <th className="py-2 text-[10px] text-gray-400 uppercase">Date / Type</th>
                                    <th className="py-2 text-[10px] text-gray-400 uppercase">Method / Reference</th>
                                    <th className="py-2 text-[10px] text-gray-400 uppercase text-right">Amount</th>
                                    <th className="py-2 w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {clientPayments.map(payment => (
                                    <tr key={payment.id} className="border-b border-gray-50">
                                        <td className="py-2 pr-2">
                                            <p className="text-[11px] font-bold text-gray-800">{formatDate(payment.date)}</p>
                                            <p className="text-[10px] text-gray-500">{payment.payment_type}</p>
                                        </td>
                                        <td className="py-2 pr-2">
                                            <p className="text-[11px] text-gray-700">{payment.payment_method}</p>
                                            {payment.reference && <p className="text-[10px] text-gray-400">Ref: {payment.reference}</p>}
                                            {payment.note && <p className="text-[10px] text-gray-400">{payment.note}</p>}
                                            {payment.receipt_image && (
                                                <a href={payment.receipt_image} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-[#2e7d32] hover:underline">
                                                    View Receipt
                                                </a>
                                            )}
                                        </td>
                                        <td className="py-2 text-right text-[11px] font-extrabold text-green-700">₱{Number(payment.amount || 0).toLocaleString()}</td>
                                        <td className="py-2 text-right">
                                            <button type="button" onClick={() => handleDeleteClientPayment(payment)} className="text-[10px] font-bold text-gray-400 hover:text-red-600" title="Delete payment">Delete</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* ── PROJECT MONITORING ── */}
            <div>
                <h3 className="text-[11px] font-extrabold text-[#A63228] tracking-widest uppercase mb-1.5">PROJECT MONITORING</h3>

                {/* ── MAIN BUDGET CARD ── */}
                <div className={`rounded-xl shadow-sm p-4 text-white mb-3 ${isOverBudget ? 'bg-gradient-to-r from-[#7a0000] via-[#a00000] to-[#5a0000]' : 'bg-gradient-to-r from-[#5a0f0a] via-[#7B1F16] to-[#4a0c08]'}`}>
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-[11px] font-bold text-white/70 tracking-widest uppercase">EXPENSE LIMIT OVERVIEW</p>
                        <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-full ${isOverBudget ? 'bg-red-300/30 text-red-200' : 'bg-white/10 text-white/80'}`}>
                            {isOverBudget ? '⚠ OVER BUDGET' : `${usedPercent}% USED`}
                        </span>
                    </div>

                    {/* Top row: Total Cost vs Contract */}
                    <div className="flex items-end justify-between mb-3">
                        <div>
                            <p className="text-[11px] text-white/50 font-medium mb-0.5">Total Cost Incurred</p>
                            <h2 className={`text-xl font-extrabold ${isOverBudget ? 'text-red-300' : ''}`}>₱{totalCombinedCost.toLocaleString()}</h2>
                        </div>
                        <div className="text-right">
                            <p className="text-[11px] text-white/50 font-medium mb-0.5">Maximum Expense Limit</p>
                            <h2 className="text-base font-extrabold text-white/80">₱{expenseLimit.toLocaleString()}</h2>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-white/20 rounded-full h-1.5 mb-1.5 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all ${isOverBudget ? 'bg-red-400' : 'bg-[#E8C547]'}`}
                            style={{ width: `${usedPercent}%` }}
                        />
                    </div>

                    {/* Remaining */}
                    <div className="flex justify-between items-center text-[11px] font-medium mb-3">
                        <span className="text-white/60">{usedPercent}% of expense limit used</span>
                        <span className={`font-bold ${isOverBudget ? 'text-red-300' : 'text-[#E8C547]'}`}>
                            {isOverBudget ? `Over by ₱${Math.abs(remainingBudget).toLocaleString()}` : `Remaining: ₱${remainingBudget.toLocaleString()}`}
                        </span>
                    </div>

                    {/* ── COST BREAKDOWN ROW ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2.5 border-t border-white/10">
                        {/* Materials from Expenses */}
                        <div className="bg-white/10 rounded-lg p-2">
                            <div className="flex items-center gap-1 mb-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                                <p className="text-[10px] font-bold text-white/60 uppercase tracking-wide">Material Receipts</p>
                            </div>
                            <p className="text-[11px] font-extrabold text-white">₱{expensesByCategory.Materials.toLocaleString()}</p>
                            <p className="text-[10px] text-white/40 mt-0.5">from verified receipts</p>
                        </div>
                        {/* Manpower */}
                        <div className="bg-white/10 rounded-lg p-2">
                            <div className="flex items-center gap-1 mb-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                                <p className="text-[10px] font-bold text-white/60 uppercase tracking-wide">Manpower</p>
                            </div>
                            <p className="text-[11px] font-extrabold text-white">₱{expensesByCategory.Manpower.toLocaleString()}</p>
                            <p className="text-[10px] text-white/40 mt-0.5">labor expenses</p>
                        </div>
                        {/* Equipment + Other */}
                        <div className="bg-white/10 rounded-lg p-2">
                            <div className="flex items-center gap-1 mb-1">
                                <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                                <p className="text-[10px] font-bold text-white/60 uppercase tracking-wide">Equipment & Other</p>
                            </div>
                            <p className="text-[11px] font-extrabold text-white">₱{(expensesByCategory.Equipment + expensesByCategory.Other).toLocaleString()}</p>
                            <p className="text-[10px] text-white/40 mt-0.5">equipment + misc</p>
                        </div>
                    </div>
                </div>

                {/* ── 3-COLUMN GRID ── */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                    {/* MANPOWER */}
                    <div className="bg-white rounded-xl p-3.5 shadow-sm flex flex-col border border-gray-100">
                        <h4 className="font-extrabold text-[11px] text-gray-900 mb-2">Manpower</h4>
                        <div className="flex flex-col gap-2 flex-1">
                            <div className="flex justify-between text-[11px] border-b border-gray-50 pb-1"><span className="text-gray-500 font-medium">Present Today</span><strong className="text-gray-900">{presentToday} workers</strong></div>
                            <div className="flex justify-between text-[11px] border-b border-gray-50 pb-1"><span className="text-gray-500 font-medium">Absent Today</span><strong className="text-gray-900">{absentToday} workers</strong></div>
                            <div className="flex justify-between text-[11px] pb-1"><span className="text-gray-500 font-medium">Today's Daily Wages</span><strong className="text-[#A63228] font-bold">₱{todayWage.toLocaleString()}</strong></div>
                        </div>
                        <Link to={`/attendance/${id}`} className="text-[#A63228] text-[11px] font-bold text-right mt-2 hover:underline">View Attendance →</Link>
                    </div>

                    {/* EQUIPMENT */}
                    <div className="bg-white rounded-xl p-3.5 shadow-sm flex flex-col border border-gray-100">
                        <h4 className="font-extrabold text-[11px] text-gray-900 mb-2">Equipment & Tools</h4>
                        <div className="flex flex-col gap-2 flex-1">
                            {assets.length === 0 ? (
                                <p className="text-[11px] text-gray-400 italic">No equipment logged.</p>
                            ) : assets.slice(0, 3).map((a, i) => (
                                <div key={i} className="flex justify-between items-center text-[11px] border-b border-gray-50 pb-1">
                                    <span className="text-gray-500 font-medium">{a.name}</span>
                                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide ${a.status === 'In Use' ? 'bg-[#fce8e6] text-[#A63228]' : a.status === 'Maintenance' ? 'bg-yellow-50 text-yellow-700' : 'bg-[#e6f4ea] text-[#2e7d32]'}`}>{a.status}</span>
                                </div>
                            ))}
                            <div className="flex justify-between items-center text-[11px] pb-1"><span className="text-gray-500 font-medium">Currently borrowed</span><strong className="text-gray-900">{inUseAssets.length} tools</strong></div>
                        </div>
                        <Link to={`/assets/${id}`} className="text-[#A63228] text-[11px] font-bold text-right mt-2 hover:underline">View Assets →</Link>
                    </div>

                    {/* RECEIPTS */}
                    <div className="bg-white rounded-xl p-3.5 shadow-sm flex flex-col border border-gray-100">
                        <div className="flex justify-between items-center mb-2">
                            <h4 className="font-extrabold text-[11px] text-gray-900">Recent Receipts</h4>
                            <span className="text-[11px] font-bold text-[#A63228] bg-red-50 px-1.5 py-0.5 rounded">
                                Total: ₱{totalSpent.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex flex-col gap-2 flex-1">
                            {recentExpenses.length === 0 ? (
                                <p className="text-[11px] text-gray-400 italic">No expenses logged.</p>
                            ) : recentExpenses.map((r, i) => (
                                <div key={i} className="flex justify-between items-center border-b border-gray-50 pb-1">
                                    <div className="flex flex-col">
                                        <strong className="text-[11px] text-gray-900">{r.receipt_no || `#${r.id}`}</strong>
                                        <span className="text-[11px] text-gray-400">{r.category} · {formatDate(r.date)}</span>
                                    </div>
                                    <strong className="text-[10px] text-[#A63228]">₱{Number(r.amount).toLocaleString()}</strong>
                                </div>
                            ))}
                        </div>
                        <Link to={`/expenses/${id}`} className="text-[#A63228] text-[11px] font-bold text-right mt-2 hover:underline">View All Receipts →</Link>
                    </div>
                </div>

                {/* ── BUDGET ADDITIONS ── */}
                {additions.length > 0 && (
                    <div className="bg-white rounded-xl p-3.5 shadow-sm border border-gray-100 mb-8">
                        <div className="flex justify-between items-center mb-2.5 pb-2 border-b border-gray-100">
                            <div>
                                <h4 className="font-extrabold text-[11px] text-gray-900 uppercase tracking-wide">Budget Additions & Audit History</h4>
                                <span className="text-[11px] text-gray-400 font-medium">{additions.length} budget addition record(s)</span>
                            </div>
                            <span className="text-[10px] font-extrabold text-[#A63228] bg-red-50 border border-red-100 px-2 py-0.5 rounded-md">
                                Total Added: ₱{addedTotal.toLocaleString()}
                            </span>
                        </div>
                        <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-gray-200 [&::-webkit-scrollbar-thumb]:rounded-full">
                            {additionsPagination.pageItems.map((entry) => (
                                <div key={entry.id} className="flex justify-between items-center border-b border-gray-50 pb-2 hover:bg-gray-50/50 px-1 rounded transition-colors">
                                    <div className="flex flex-col">
                                        <strong className="text-[9.5px] text-gray-900 font-bold">{entry.note || 'Additional budget'}</strong>
                                        <span className="text-[11px] text-gray-400">{formatDate(entry.date)}</span>
                                    </div>
                                    <strong className="text-[10px] text-[#A63228] font-extrabold">+₱{Number(entry.amount).toLocaleString()}</strong>
                                </div>
                            ))}
                        </div>
                        <Pagination {...additionsPagination} />
                    </div>
                )}
            </div>

            {showAddPayment && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3">
                    <div className="bg-white rounded-2xl w-full max-w-[420px] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-4 border-b border-gray-100">
                            <div>
                                <h3 className="text-xs font-extrabold text-gray-900">Record Client Payment</h3>
                                <p className="text-[11px] text-gray-500 mt-0.5">{project.name}</p>
                            </div>
                            <button type="button" onClick={() => setShowAddPayment(false)} className="text-gray-400 hover:text-gray-700">✕</button>
                        </div>
                        <form onSubmit={handleAddClientPayment} className="p-4 overflow-y-auto flex flex-col gap-3">
                            <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 border border-gray-100 p-3">
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Contract Amount</p>
                                    <p className="text-[11px] font-extrabold text-gray-900">₱{contractAmount.toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Balance Due</p>
                                    <p className="text-[11px] font-extrabold text-amber-700">₱{Math.max(0, balanceDue).toLocaleString()}</p>
                                </div>
                            </div>

                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[11px] font-bold text-gray-700 uppercase">Payment Amount (₱) *</label>
                                    <button
                                        type="button"
                                        onClick={() => setPaymentForm(prev => ({ ...prev, amount: suggestedDownPayment.toFixed(2) }))}
                                        disabled={suggestedDownPayment <= 0}
                                        className="text-[10px] font-bold text-[#2e7d32] hover:underline disabled:text-gray-400 disabled:no-underline"
                                    >
                                        Use minimum downpayment ({`₱${suggestedDownPayment.toLocaleString()}`})
                                    </button>
                                </div>
                                <input
                                    type="number"
                                    min={paymentForm.paymentType === 'Downpayment' ? Math.max(suggestedDownPayment, 0.01) : 0.01}
                                    max="999999999999"
                                    step="0.01"
                                    value={paymentForm.amount}
                                    onChange={e => setPaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                                    required
                                    className="w-full bg-[#f4f1ee] rounded-md px-2.5 py-2 text-xs font-bold outline-none focus:border-[#2e7d32] border border-transparent"
                                    placeholder="0.00"
                                />
                                <p className="text-[10px] text-gray-400 mt-1">A total downpayment of at least 20% of the contract amount is required before other payment types.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Payment Type *</label>
                                    <select
                                        value={paymentForm.paymentType}
                                        onChange={e => setPaymentForm(prev => ({ ...prev, paymentType: e.target.value }))}
                                        required
                                        className="w-full bg-[#f4f1ee] rounded-md px-2.5 py-2 text-[11px] outline-none"
                                    >
                                        <option value="Downpayment">Downpayment</option>
                                        <option value="Progress Payment" disabled={downPaymentReceived < downPaymentTarget}>Progress Payment</option>
                                        <option value="Final Payment" disabled={downPaymentReceived < downPaymentTarget}>Final Payment</option>
                                        <option value="Other" disabled={downPaymentReceived < downPaymentTarget}>Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Payment Method *</label>
                                    <select
                                        value={paymentForm.paymentMethod}
                                        onChange={e => setPaymentForm(prev => ({ ...prev, paymentMethod: e.target.value }))}
                                        required
                                        className="w-full bg-[#f4f1ee] rounded-md px-2.5 py-2 text-[11px] outline-none"
                                    >
                                        <option value="Cash">Cash</option>
                                        <option value="Bank Transfer">Bank Transfer</option>
                                        <option value="Check">Check</option>
                                        <option value="E-wallet">E-wallet</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">
                                        Receipt Upload {paymentForm.paymentMethod !== 'Cash' ? '*' : <span className="font-normal text-gray-400">(Optional for cash)</span>}
                                    </label>
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handleReceiptUpload}
                                        required={paymentForm.paymentMethod !== 'Cash'}
                                        className="w-full bg-[#f4f1ee] rounded-md px-2.5 py-2 text-[11px] outline-none file:mr-2 file:rounded file:border-0 file:bg-white file:px-2 file:py-1 file:text-[10px] file:font-bold"
                                    />
                                    {receiptFileName && <p className="mt-1 text-[10px] text-green-700">Attached: {receiptFileName}</p>}
                                    <p className="mt-1 text-[10px] text-gray-400">Required for bank transfer, check, e-wallet, and other non-cash payments. JPG, PNG, or WebP; up to 512 KB.</p>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Date Received *</label>
                                    <input
                                        type="date"
                                        value={paymentForm.date}
                                        onChange={e => setPaymentForm(prev => ({ ...prev, date: e.target.value }))}
                                        required
                                        className="w-full bg-[#f4f1ee] rounded-md px-2.5 py-2 text-[11px] outline-none"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Reference / Receipt No. <span className="font-normal text-gray-400">(Optional)</span></label>
                                    <input
                                        type="text"
                                        maxLength={100}
                                        value={paymentForm.reference}
                                        onChange={e => setPaymentForm(prev => ({ ...prev, reference: e.target.value }))}
                                        className="w-full bg-[#f4f1ee] rounded-md px-2.5 py-2 text-[11px] outline-none"
                                        placeholder="e.g. bank transaction or receipt number"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-[11px] font-bold text-gray-700 uppercase mb-1">Note <span className="font-normal text-gray-400">(Optional)</span></label>
                                    <textarea
                                        rows="2"
                                        maxLength={250}
                                        value={paymentForm.note}
                                        onChange={e => setPaymentForm(prev => ({ ...prev, note: e.target.value }))}
                                        className="w-full resize-y bg-[#f4f1ee] rounded-md px-2.5 py-2 text-[11px] outline-none"
                                        placeholder="Additional payment details"
                                    />
                                </div>
                            </div>
                            {paymentError && <p className="text-[11px] text-red-600 font-bold">{paymentError}</p>}
                            <div className="flex gap-2 pt-1">
                                <button type="button" onClick={() => setShowAddPayment(false)} disabled={paymentSaving} className="flex-1 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg text-[11px] font-bold">Cancel</button>
                                <button type="submit" disabled={paymentSaving} className="flex-1 py-2 bg-[#2e7d32] text-white rounded-lg text-[11px] font-bold disabled:opacity-60">
                                    {paymentSaving ? 'Saving...' : 'Save Payment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

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
