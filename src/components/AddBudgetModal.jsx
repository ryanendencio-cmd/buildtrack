import React, { useState } from 'react'
import { api } from '../api'

const MAX_AMOUNT = 999999999999

const money = (value) => `₱${Number(value || 0).toLocaleString()}`

export default function AddBudgetModal({ project, onClose, onSaved }) {
    const [step, setStep] = useState('FORM')
    const [amount, setAmount] = useState('')
    const [note, setNote] = useState('')
    const [date, setDate] = useState(() => {
        const d = new Date()
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${y}-${m}-${day}`
    })
    const [error, setError] = useState('')
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(null)

    const current = Number(project?.budget || 0)
    const addNum = parseFloat(amount)
    const nextTotal = Math.round((current + (Number.isFinite(addNum) ? addNum : 0)) * 100) / 100

    const validate = () => {
        if (!Number.isFinite(addNum) || addNum <= 0) {
            setError('Please enter a valid budget amount.')
            return false
        }
        if (nextTotal > MAX_AMOUNT) {
            setError('Budget allocated cannot exceed ₱999,999,999,999.')
            return false
        }
        setError('')
        return true
    }

    const handleReview = (e) => {
        e.preventDefault()
        if (validate()) setStep('CONFIRM')
    }

    const handleConfirm = () => {
        setSaving(true)
        api.post(`/projects/${project.id}/budget-additions`, {
            amount: addNum,
            note: note.trim(),
            date
        }).then((data) => {
            const result = { ...data, budget: data?.budget ?? nextTotal }
            setSaved(result)
            onSaved(result)
            setStep('SUCCESS')
        }).catch((err) => {
            setError(err.message || 'Failed to add budget.')
            setStep('FORM')
        }).finally(() => setSaving(false))
    }

    if (step === 'CONFIRM') {
        return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl p-5 w-full max-w-[320px] shadow-2xl text-center">
                    <h3 className="text-sm font-extrabold text-[#1a1a1a] mb-1">Confirm Added Budget</h3>
                    <p className="text-[9px] text-gray-500 mb-4 font-medium">This amount will be added to the current project budget.</p>
                    <div className="bg-[#f4f1ee] rounded-lg p-3 text-left mb-5 border border-[#e5dfd8]">
                        <p className="text-[10px] font-extrabold text-gray-900 mb-2 leading-snug">{project.name}</p>
                        <p className="text-[8px] text-gray-600 mb-1">Current budget: <span className="font-bold text-gray-900">{money(current)}</span></p>
                        <p className="text-[8px] text-gray-600 mb-1">Amount to add: <span className="font-bold text-[#A63228]">{money(addNum)}</span></p>
                        <p className="text-[8px] text-gray-600 mb-1">Date: <span className="font-bold text-gray-900">{date}</span></p>
                        {note.trim() && <p className="text-[8px] text-gray-600 mb-2">Note: <span className="font-bold text-gray-900">{note.trim()}</span></p>}
                        <p className="text-[11px] font-extrabold text-[#A63228] mt-1">New total: {money(nextTotal)}</p>
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={() => setStep('FORM')} disabled={saving} className="flex-1 py-1.5 bg-white border border-[#A63228] text-[#A63228] rounded-lg text-[9px] font-bold hover:bg-red-50 transition-colors">Back</button>
                        <button type="button" onClick={handleConfirm} disabled={saving} className="flex-1 py-1.5 bg-[#8B1A10] text-white rounded-lg text-[9px] font-bold hover:bg-[#72150d] transition-colors disabled:opacity-60">
                            {saving ? 'Saving...' : 'Confirm'}
                        </button>
                    </div>
                </div>
            </div>
        )
    }

    if (step === 'SUCCESS') {
        return (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-5 w-full max-w-[260px] shadow-2xl text-center">
                    <div className="w-10 h-10 bg-[#e6f4ea] rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg className="w-5 h-5 text-[#2e7d32]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                    </div>
                    <h3 className="text-[11px] font-extrabold text-gray-900 mb-1">Budget Added!</h3>
                    <p className="text-[9px] text-gray-500">{money(saved?.amount)} added. New budget is {money(saved?.budget)}.</p>
                    <button type="button" onClick={onClose} className="mt-4 w-full py-2 bg-[#8B1A10] text-white rounded-lg text-[10px] font-bold hover:bg-[#72150d] transition-colors">Done</button>
                </div>
            </div>
        )
    }

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-3">
            <div className="bg-white rounded-2xl w-full max-w-[400px] shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
                <div className="flex justify-between items-center p-4 border-b border-gray-100 shrink-0">
                    <div>
                        <h3 className="text-xs font-extrabold text-[#1a1a1a]">Add Budget</h3>
                        <p className="text-[8px] text-gray-500 font-medium mt-0.5">Add funds on top of the current project budget.</p>
                    </div>
                    <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700 bg-gray-50 p-1 rounded-full hover:bg-gray-100 transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
                <div className="p-4 overflow-y-auto">
                    <form onSubmit={handleReview} className="flex flex-col gap-3">
                        <div className="bg-[#f9fafb] border border-gray-200 rounded-lg px-3 py-2">
                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider">Project</p>
                            <p className="text-[10px] font-extrabold text-gray-900 leading-snug">{project.name}</p>
                            <p className="text-[8px] text-gray-500 mt-1">Current budget: <span className="font-extrabold text-[#A63228]">{money(current)}</span></p>
                        </div>
                        <div>
                            <label className="block text-[8px] font-bold text-gray-700 mb-1 uppercase">Amount to Add (₱) <span className="text-[#A63228]">*</span></label>
                            <input
                                type="number"
                                step="0.01"
                                min="0.01"
                                max="999999999999"
                                value={amount}
                                onChange={(e) => {
                                    setAmount(e.target.value)
                                    setError('')
                                }}
                                required
                                className={`w-full bg-[#f4f1ee] rounded-md px-2.5 py-1.5 text-[10px] font-extrabold outline-none border transition-colors ${error ? 'border-red-500 text-red-600' : 'border-transparent focus:border-[#A63228]'}`}
                                placeholder="0.00"
                            />
                            {Number.isFinite(addNum) && addNum > 0 && !error && (
                                <p className="text-[8px] text-gray-500 font-semibold mt-1">New total: <span className="text-[#A63228] font-extrabold">{money(nextTotal)}</span></p>
                            )}
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[8px] font-bold text-gray-700 uppercase">Date</label>
                            </div>
                            <input
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                required
                                className="w-full bg-[#f4f1ee] rounded-md px-2.5 py-1.5 text-[10px] font-medium outline-none text-gray-700 border border-transparent focus:border-[#A63228]"
                            />
                        </div>
                        <div>
                            <div className="flex justify-between items-center mb-1">
                                <label className="block text-[8px] font-bold text-gray-700 uppercase">Note</label>
                                <span className="text-[7px] text-gray-400 font-semibold">Optional</span>
                            </div>
                            <input
                                type="text"
                                value={note}
                                maxLength={255}
                                onChange={(e) => setNote(e.target.value)}
                                className="w-full bg-[#f4f1ee] rounded-md px-2.5 py-1.5 text-[10px] font-medium outline-none border border-transparent focus:border-[#A63228]"
                                placeholder="e.g. Change order, extra materials"
                            />
                        </div>
                        {error && (
                            <p className="text-[8px] text-red-600 font-bold flex items-center gap-1">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                                {error}
                            </p>
                        )}
                        <button
                            type="submit"
                            disabled={Boolean(error)}
                            className="w-full mt-1 py-2 bg-[#E8C547] text-gray-900 rounded-lg text-[10px] font-bold hover:bg-[#d4b33d] transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Review & Save
                        </button>
                    </form>
                </div>
            </div>
        </div>
    )
}
