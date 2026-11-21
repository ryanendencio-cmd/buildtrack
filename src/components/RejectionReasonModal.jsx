import React, { useState } from 'react'

const MAX_REJECTION_REASON_LENGTH = 250

export default function RejectionReasonModal({ title, subject, onCancel, onSubmit }) {
    const [reason, setReason] = useState('')
    const [error, setError] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const handleSubmit = async (event) => {
        event.preventDefault()
        const cleanReason = reason.trim()
        if (!cleanReason) {
            setError('Enter a reason before rejecting this request.')
            return
        }

        setSubmitting(true)
        setError('')
        try {
            await onSubmit(cleanReason)
        } catch (submitError) {
            setError(submitError.message || 'Could not reject this request.')
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
            <form
                onSubmit={handleSubmit}
                className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl"
                role="dialog"
                aria-modal="true"
                aria-labelledby="rejection-reason-title"
            >
                <h2 id="rejection-reason-title" className="text-base font-extrabold text-gray-900">
                    {title}
                </h2>
                {subject && <p className="mt-1 text-sm text-gray-600">{subject}</p>}
                <label htmlFor="rejection-reason" className="mt-4 block text-sm font-semibold text-gray-800">
                    Reason <span className="text-red-600">*</span>
                </label>
                <textarea
                    id="rejection-reason"
                    value={reason}
                    onChange={event => {
                        setReason(event.target.value)
                        setError('')
                    }}
                    maxLength={MAX_REJECTION_REASON_LENGTH}
                    rows={4}
                    required
                    autoFocus
                    className="mt-1 w-full resize-y rounded-lg border border-gray-300 p-3 text-sm outline-none focus:border-[#A63228] focus:ring-1 focus:ring-[#A63228]"
                    placeholder="Explain why this request is being rejected"
                />
                <div className="mt-1 flex items-start justify-between gap-3 text-xs">
                    <p className="text-gray-500">Required. Maximum {MAX_REJECTION_REASON_LENGTH} characters.</p>
                    <span className={reason.length === MAX_REJECTION_REASON_LENGTH ? 'font-semibold text-red-600' : 'text-gray-500'}>
                        {reason.length}/{MAX_REJECTION_REASON_LENGTH}
                    </span>
                </div>
                {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={submitting}
                        className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={submitting}
                        className="rounded-lg bg-[#A63228] px-4 py-2 text-sm font-bold text-white hover:bg-[#8B1A10] disabled:opacity-50"
                    >
                        {submitting ? 'Rejecting...' : 'Reject request'}
                    </button>
                </div>
            </form>
        </div>
    )
}
