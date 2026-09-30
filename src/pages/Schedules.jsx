import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import { api } from '../api'

const blank = (dateStr) => ({
  link_type: 'General',
  project_id: '',
  expense_id: '',
  title: '',
  schedule_date: dateStr || new Date().toISOString().slice(0, 10),
  assigned_to: '',
  status: 'Scheduled',
  notes: ''
})

const linkTypeOf = (it) => {
  if (it?.link_type === 'Project' || it?.link_type === 'Transaction') return it.link_type
  if (it?.expense_id) return 'Transaction'
  if (it?.project_id) return 'Project'
  return 'General'
}

const pad = n => String(n).padStart(2, '0')
const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export default function Schedules() {
  const [items, setItems] = useState([])
  const [projects, setProjects] = useState([])
  const [expenses, setExpenses] = useState([])
  const [form, setForm] = useState(blank())
  const [editId, setEditId] = useState(null)
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [dayModal, setDayModal] = useState(null)
  const [linkFilter, setLinkFilter] = useState('All')

  const load = () => api.get('/schedules').then(setItems).catch(console.error)
  useEffect(() => {
    load()
    api.get('/projects').then(setProjects).catch(console.error)
    api.get('/expenses').then(setExpenses).catch(console.error)
  }, [])

  const change = e => setForm(p => ({ ...p, [e.target.name]: e.target.value }))

  const show = (item, dateStr) => {
    setEditId(item?.id || null)
    setForm(item
      ? { ...blank(), ...item, link_type: linkTypeOf(item), project_id: item.project_id ? String(item.project_id) : '', expense_id: item.expense_id ? String(item.expense_id) : '' }
      : blank(dateStr))
    setOpen(true)
  }

  const save = e => {
    e.preventDefault()
    const payload = { ...form }
    delete payload.start_time
    delete payload.end_time
    const req = editId ? api.put(`/schedules/${editId}`, payload) : api.post('/schedules', payload)
    req.then(() => { setOpen(false); load() }).catch(err => alert(err.message))
  }

  const remove = id => {
    if (window.confirm('Delete this schedule?')) {
      api.delete(`/schedules/${id}`).then(load).catch(console.error)
    }
  }

  const color = s => s === 'Completed' ? 'bg-green-100 text-green-700'
    : s === 'Cancelled' ? 'bg-red-100 text-red-700'
      : s === 'In Progress' ? 'bg-blue-100 text-blue-700'
        : 'bg-yellow-100 text-yellow-700'

  const dotColor = s => s === 'Completed' ? 'bg-green-500'
    : s === 'Cancelled' ? 'bg-red-500'
      : s === 'In Progress' ? 'bg-blue-500'
        : 'bg-yellow-500'

  const itemsByDate = useMemo(() => {
    const map = {}
    const visible = linkFilter === 'All' ? items : items.filter(it => linkTypeOf(it) === linkFilter)
    visible.forEach(it => {
      const key = (it.schedule_date || '').slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(it)
    })
    Object.values(map).forEach(arr => arr.sort((a, b) => (a.title || '').localeCompare(b.title || '')))
    return map
  }, [items, linkFilter])

  const linkLabel = it => {
    const type = linkTypeOf(it)
    if (type === 'Project') return it.project_name || 'Project'
    if (type === 'Transaction') {
      const receipt = it.expense_receipt ? `#${it.expense_receipt}` : (it.expense_id ? `#${it.expense_id}` : '')
      return ['Txn', receipt, it.expense_category].filter(Boolean).join(' ')
    }
    return 'General'
  }

  const expenseLabel = exp => {
    const receipt = exp.receipt_no ? `#${exp.receipt_no}` : `#${exp.id}`
    const amount = Number(exp.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    return `${receipt} · ${exp.category || 'Expense'} · ₱${amount}${exp.project ? ` · ${exp.project}` : ''}`
  }

  // Build weeks: each row is an array of 7 Date|null cells (Sun..Sat)
  const weeks = useMemo(() => {
    const year = cursor.getFullYear(), month = cursor.getMonth()
    const firstDay = new Date(year, month, 1)
    const totalDays = new Date(year, month + 1, 0).getDate()
    const leading = firstDay.getDay()
    const cells = []
    for (let i = 0; i < leading; i++) cells.push(null)
    for (let d = 1; d <= totalDays; d++) cells.push(new Date(year, month, d))
    while (cells.length % 7 !== 0) cells.push(null)
    const rows = []
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7))
    return rows
  }, [cursor])

  const todayKey = toKey(new Date())
  const monthLabel = `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`
  const shiftMonth = delta => setCursor(c => new Date(c.getFullYear(), c.getMonth() + delta, 1))
  const goToday = () => { const d = new Date(); d.setDate(1); setCursor(d) }

  const MAX_VISIBLE = 3

  return (
    <AdminLayout>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-2">
        <div>
          <span className="text-[9px] font-bold text-[#A63228] tracking-widest">PLANNING</span>
          <h1 className="text-lg font-extrabold text-gray-900">Schedule Management</h1>
          <p className="text-[10px] text-gray-500">Plan activities for projects, transactions, or general reminders.</p>
        </div>
        <button onClick={() => show()} className="bg-[#E8C547] px-3 py-2 rounded-lg text-[10px] font-bold hover:bg-[#d4b33d] transition-colors">
          + Add Schedule
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 p-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <button onClick={() => shiftMonth(-1)} className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-bold">‹</button>
            <h2 className="text-sm font-extrabold text-gray-900 w-36 text-center">{monthLabel}</h2>
            <button onClick={() => shiftMonth(1)} className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-bold">›</button>
            <button onClick={goToday} className="ml-1 px-2 py-1 rounded-md border border-gray-200 text-[9px] font-bold text-gray-600 hover:bg-gray-50">Today</button>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            {['All', 'Project', 'Transaction', 'General'].map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setLinkFilter(t)}
                className={`px-2 py-1 rounded-md text-[8px] font-bold border ${linkFilter === t ? 'bg-[#A63228] text-white border-[#A63228]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
              >{t}</button>
            ))}
            {['Scheduled', 'In Progress', 'Completed', 'Cancelled'].map(s => (
              <span key={s} className="flex items-center gap-1 text-[8px] font-bold text-gray-500">
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor(s)}`}></span>{s}
              </span>
            ))}
          </div>
        </div>

        {/* Calendar TABLE: columns = Sunday..Saturday, rows = week dates */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed min-w-[720px]">
            <thead>
              <tr className="bg-gray-50/60">
                {WEEKDAYS.map(w => (
                  <th key={w} className="w-[14.28%] p-2 text-center text-[8px] font-extrabold text-gray-400 tracking-wider border border-gray-100">
                    {w}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((week, ri) => (
                <tr key={ri}>
                  {week.map((date, ci) => {
                    const key = date ? toKey(date) : `blank-${ri}-${ci}`
                    const dayItems = date ? (itemsByDate[key] || []) : []
                    const isToday = date && key === todayKey
                    return (
                      <td
                        key={key}
                        onClick={() => date && show(null, key)}
                        className={`align-top border border-gray-100 p-1.5 h-24 ${date ? 'cursor-pointer hover:bg-gray-50/50 transition-colors' : 'bg-gray-50/30'}`}
                      >
                        {date && (
                          <>
                            <div className="flex justify-end">
                              <span className={`text-[9px] font-bold w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-[#A63228] text-white' : 'text-gray-500'}`}>
                                {date.getDate()}
                              </span>
                            </div>
                            <div className="flex flex-col gap-0.5 mt-0.5">
                              {dayItems.slice(0, MAX_VISIBLE).map(it => (
                                <button
                                  key={it.id}
                                  onClick={(e) => { e.stopPropagation(); show(it) }}
                                  className={`text-left px-1 py-0.5 rounded text-[7px] font-bold truncate ${color(it.status)}`}
                                  title={`${it.title} · ${linkLabel(it)}`}
                                >
                                  {it.title}
                                  <span className="block font-medium opacity-80 truncate">{linkLabel(it)}</span>
                                </button>
                              ))}
                              {dayItems.length > MAX_VISIBLE && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); setDayModal(key) }}
                                  className="text-left px-1 text-[7px] font-bold text-gray-400 hover:text-[#A63228]"
                                >
                                  +{dayItems.length - MAX_VISIBLE} more
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Day detail modal (when a day has more items than fit) */}
      {dayModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDayModal(null)}>
          <div className="bg-white rounded-xl w-full max-w-sm p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-extrabold text-gray-900">{dayModal}</h3>
              <button onClick={() => setDayModal(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
              {(itemsByDate[dayModal] || []).map(it => (
                <button
                  key={it.id}
                  onClick={() => { setDayModal(null); show(it) }}
                  className="text-left p-2 rounded-lg border border-gray-100 hover:bg-gray-50"
                >
                  <p className="text-[10px] font-bold text-gray-900">{it.title}</p>
                  <p className="text-[9px] text-gray-500">{it.assigned_to || 'Unassigned'}</p>
                  <p className="text-[8px] font-bold text-[#A63228] mt-0.5">{linkLabel(it)}</p>
                  <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[7px] font-bold ${color(it.status)}`}>{it.status}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit schedule modal */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={save} className="bg-white rounded-xl w-full max-w-md p-4 shadow-2xl">
            <div className="flex justify-between mb-3">
              <h2 className="text-sm font-extrabold">{editId ? 'Edit Schedule' : 'Add Schedule'}</h2>
              <button type="button" onClick={() => setOpen(false)}>✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="col-span-2 text-[9px] font-bold">ACTIVITY
                <input required name="title" value={form.title} onChange={change} className="mt-1 w-full bg-[#f4f1ee] rounded p-2 text-xs" />
              </label>
              <label className="col-span-2 text-[9px] font-bold">LINK TO
                <select name="link_type" value={form.link_type || 'General'} onChange={change} className="mt-1 w-full bg-[#f4f1ee] rounded p-2 text-xs">
                  <option value="General">General (no project / transaction)</option>
                  <option value="Project">Project</option>
                  <option value="Transaction">Transaction (expense)</option>
                </select>
              </label>
              {form.link_type === 'Project' && (
                <label className="col-span-2 text-[9px] font-bold">PROJECT
                  <select required name="project_id" value={form.project_id} onChange={change} className="mt-1 w-full bg-[#f4f1ee] rounded p-2 text-xs">
                    <option value="">Select project</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
              )}
              {form.link_type === 'Transaction' && (
                <label className="col-span-2 text-[9px] font-bold">TRANSACTION
                  <select required name="expense_id" value={form.expense_id} onChange={change} className="mt-1 w-full bg-[#f4f1ee] rounded p-2 text-xs">
                    <option value="">Select transaction</option>
                    {expenses.map(exp => <option key={exp.id} value={exp.id}>{expenseLabel(exp)}</option>)}
                  </select>
                </label>
              )}
              <label className="text-[9px] font-bold">DATE
                <input required type="date" name="schedule_date" value={form.schedule_date?.slice(0, 10)} onChange={change} className="mt-1 w-full bg-[#f4f1ee] rounded p-2 text-xs" />
              </label>
              <label className="text-[9px] font-bold">STATUS
                <select name="status" value={form.status} onChange={change} className="mt-1 w-full bg-[#f4f1ee] rounded p-2 text-xs">
                  {['Scheduled', 'In Progress', 'Completed', 'Cancelled'].map(x => <option key={x}>{x}</option>)}
                </select>
              </label>
              <label className="col-span-2 text-[9px] font-bold">ASSIGNED TO
                <input name="assigned_to" value={form.assigned_to || ''} onChange={change} className="mt-1 w-full bg-[#f4f1ee] rounded p-2 text-xs" />
              </label>
              <label className="col-span-2 text-[9px] font-bold">NOTES
                <textarea name="notes" value={form.notes || ''} onChange={change} className="mt-1 w-full bg-[#f4f1ee] rounded p-2 text-xs" rows="2" />
              </label>
            </div>
            <div className="flex gap-2 mt-4">
              {editId && (
                <button type="button" onClick={() => { setOpen(false); remove(editId) }} className="px-3 py-2 rounded-lg text-xs font-bold text-red-600 border border-red-200 hover:bg-red-50">
                  Delete
                </button>
              )}
              <button className="flex-1 bg-[#E8C547] py-2 rounded-lg text-xs font-bold hover:bg-[#d4b33d] transition-colors">
                Save Schedule
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  )
}
