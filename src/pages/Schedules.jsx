import React, { useEffect, useMemo, useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import { api } from '../api'

const blank = (dateStr) => ({
  project_id: '',
  title: '',
  category: 'Supplier Check / Payment Due',
  schedule_date: dateStr || new Date().toISOString().slice(0, 10),
  schedule_time: '09:00',
  supplier_name: '',
  check_no: '',
  amount: '',
  status: 'Scheduled',
  notes: '',
  syncGoogleCalendar: true
})

const pad = n => String(n).padStart(2, '0')
const toKey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

const makeGoogleCalendarUrl = (it) => {
  const title = it.title || (it.category === 'Supplier Check / Payment Due' ? 'Supplier Check Payment Due' : 'Material Delivery')
  const rawDate = (it.schedule_date || '').slice(0, 10)
  if (!rawDate) return '#'
  const cleanDate = rawDate.replace(/-/g, '')
  const time = it.schedule_time || '09:00'
  const [hh, mm] = (time || '09:00').split(':').map(n => String(n || '00').padStart(2, '0'))
  const startIso = `${cleanDate}T${hh}${mm}00`
  const endHh = String((parseInt(hh, 10) + 1) % 24).padStart(2, '0')
  const endIso = `${cleanDate}T${endHh}${mm}00`

  let details = ''
  if (it.category) details += `Category: ${it.category}\n`
  if (it.supplier_name) details += `Supplier: ${it.supplier_name}\n`
  if (it.check_no) details += `Check / Ref #: ${it.check_no}\n`
  if (it.amount) details += `Amount: PHP ${Number(it.amount).toLocaleString()}\n`
  if (it.notes) details += `\nNotes: ${it.notes}\n`
  details += `\n[BuildTrack S-CON Automated Monitoring & Alarm Reminder]`

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: title,
    dates: `${startIso}/${endIso}`,
    details: details
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

export default function Schedules() {
  const [items, setItems] = useState([])
  const [projects, setProjects] = useState([])
  const [form, setForm] = useState(blank())
  const [editId, setEditId] = useState(null)
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const [dayModal, setDayModal] = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('All')

  const load = () => api.get('/schedules').then(setItems).catch(console.error)
  useEffect(() => {
    load()
    api.get('/projects').then(setProjects).catch(console.error)
  }, [])

  const change = e => {
    const { name, value } = e.target
    setForm(p => ({ ...p, [name]: value }))
  }

  const show = (item, dateStr) => {
    setEditId(item?.id || null)
    setForm(item
      ? {
          ...blank(),
          ...item,
          project_id: item.project_id ? String(item.project_id) : '',
          category: item.category || 'Supplier Check / Payment Due',
          schedule_time: item.schedule_time || '09:00',
          supplier_name: item.supplier_name || '',
          check_no: item.check_no || '',
          amount: item.amount || '',
          syncGoogleCalendar: true
        }
      : blank(dateStr))
    setOpen(true)
  }

  const save = e => {
    e.preventDefault()
    const payload = { ...form }
    const shouldSync = form.syncGoogleCalendar

    const req = editId ? api.put(`/schedules/${editId}`, payload) : api.post('/schedules', payload)
    req.then(() => {
      setOpen(false)
      load()
      if (shouldSync) {
        const calUrl = makeGoogleCalendarUrl(payload)
        window.open(calUrl, '_blank')
      }
    }).catch(err => alert(err.message))
  }

  const remove = id => {
    if (window.confirm('Are you sure you want to delete this schedule?')) {
      api.delete(`/schedules/${id}`).then(load).catch(console.error)
    }
  }

  const color = s => s === 'Completed' ? 'bg-green-50 text-green-700 border-green-200'
    : s === 'Cancelled' ? 'bg-red-50 text-red-700 border-red-200'
      : s === 'In Progress' ? 'bg-blue-50 text-blue-700 border-blue-200'
        : 'bg-amber-50 text-amber-800 border-amber-200'

  const itemsByDate = useMemo(() => {
    const map = {}
    const visible = items.filter(it => {
      if (categoryFilter === 'All') return true
      return it.category === categoryFilter
    })
    visible.forEach(it => {
      const key = (it.schedule_date || '').slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(it)
    })
    Object.values(map).forEach(arr => arr.sort((a, b) => (a.title || '').localeCompare(b.title || '')))
    return map
  }, [items, categoryFilter])

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
      {/* Top Header */}
      <div className="mb-3">
        <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">MONITORING & PLANNING</span>
        <h1 className="text-lg font-extrabold text-gray-900">Schedule Management</h1>
        <p className="text-[10px] text-gray-500">Click any date on the calendar to log material deliveries, supplier check due dates, or project milestones.</p>
      </div>

      {/* Google Calendar Push Notification Feature Banner */}
      <div className="bg-gradient-to-r from-red-50/80 via-amber-50/70 to-white border border-amber-200/80 rounded-xl px-3.5 py-2.5 mb-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 rounded-md bg-[#A63228]/10 text-[#A63228] flex items-center justify-center shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          </div>
          <p className="text-[9.5px] text-gray-700">
            <strong className="text-gray-900 font-extrabold mr-1">Google Calendar Sync Active:</strong>
            Schedules can automatically trigger Google Calendar events and mobile push alarms prior to due dates.
          </p>
        </div>
        <span className="text-[8px] font-bold text-[#2e7d32] bg-green-50 border border-green-200 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
          Mobile Push Ready
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2.5 p-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <button onClick={() => shiftMonth(-1)} className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-bold" title="Previous Month">‹</button>
            <h2 className="text-sm font-extrabold text-gray-900 w-36 text-center">{monthLabel}</h2>
            <button onClick={() => shiftMonth(1)} className="w-7 h-7 flex items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50 text-xs font-bold" title="Next Month">›</button>
            <button onClick={goToday} className="ml-1 px-2.5 py-1 rounded-md border border-gray-200 text-[9px] font-bold text-gray-600 hover:bg-gray-50">Today</button>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
              {[
                { label: 'All Schedules', val: 'All' },
                { label: 'Check Due Dates', val: 'Supplier Check / Payment Due' },
                { label: 'Material Deliveries', val: 'Material Delivery from Supplier' }
              ].map(tab => (
                <button
                  key={tab.val}
                  type="button"
                  onClick={() => setCategoryFilter(tab.val)}
                  className={`px-2.5 py-1 rounded-md text-[8.5px] font-bold transition-colors ${categoryFilter === tab.val ? 'bg-white text-[#A63228] shadow-xs' : 'text-gray-500 hover:text-gray-800'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Calendar TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse table-fixed min-w-[720px]">
            <thead>
              <tr className="bg-gray-50/70">
                {WEEKDAYS.map(w => (
                  <th key={w} className="w-[14.28%] p-2 text-center text-[8px] font-extrabold text-gray-400 tracking-wider border border-gray-100 uppercase">
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
                        className={`align-top border border-gray-100 p-1.5 h-24 transition-colors ${date ? 'cursor-pointer hover:bg-amber-50/30 group' : 'bg-gray-50/30'}`}
                        title={date ? `Click to add schedule for ${key}` : ''}
                      >
                        {date && (
                          <>
                            <div className="flex justify-between items-center mb-1">
                              {dayItems.some(it => it.category === 'Supplier Check / Payment Due') ? (
                                <span className="text-[6.5px] font-extrabold text-amber-800 bg-amber-100 border border-amber-200 px-1 py-0.2 rounded uppercase tracking-wider">
                                  Check Due
                                </span>
                              ) : <span className="text-[8px] font-bold text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity">+ Add</span>}
                              <span className={`text-[9px] font-bold w-5 h-5 flex items-center justify-center rounded-full ${isToday ? 'bg-[#A63228] text-white shadow-xs' : 'text-gray-500'}`}>
                                {date.getDate()}
                              </span>
                            </div>
                            <div className="flex flex-col gap-0.5">
                              {dayItems.slice(0, MAX_VISIBLE).map(it => (
                                <button
                                  key={it.id}
                                  onClick={(e) => { e.stopPropagation(); show(it) }}
                                  className={`text-left px-1.5 py-1 rounded text-[7px] font-bold truncate border flex flex-col ${color(it.status)} hover:shadow-xs transition-all`}
                                  title={`${it.title} · ${it.supplier_name || ''}`}
                                >
                                  <div className="truncate font-semibold">{it.title}</div>
                                  {it.supplier_name && (
                                    <span className="font-medium opacity-80 truncate text-[6.5px]">
                                      {it.supplier_name} {it.amount ? `· ₱${Number(it.amount).toLocaleString()}` : ''}
                                    </span>
                                  )}
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

      {/* Day detail modal */}
      {dayModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setDayModal(null)}>
          <div className="bg-white rounded-xl w-full max-w-md p-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3 pb-2 border-b border-gray-100">
              <div>
                <h3 className="text-sm font-extrabold text-gray-900">{dayModal}</h3>
                <p className="text-[9px] text-gray-500">Scheduled events for this date</p>
              </div>
              <button onClick={() => setDayModal(null)} className="text-gray-400 hover:text-gray-700 text-sm font-bold">✕</button>
            </div>
            <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
              {(itemsByDate[dayModal] || []).map(it => (
                <div
                  key={it.id}
                  className="p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 flex justify-between items-start gap-2 bg-[#f9fafb]"
                >
                  <div className="flex-1 cursor-pointer" onClick={() => { setDayModal(null); show(it) }}>
                    <p className="text-[10px] font-extrabold text-gray-900">{it.title}</p>
                    {it.supplier_name && <p className="text-[8.5px] font-bold text-[#A63228] mt-0.5">Supplier: {it.supplier_name} {it.amount ? `(₱${Number(it.amount).toLocaleString()})` : ''}</p>}
                    {it.check_no && <p className="text-[8px] text-gray-500">Check #: {it.check_no}</p>}
                    <span className={`inline-block mt-1 px-1.5 py-0.5 rounded-full text-[7px] font-bold border ${color(it.status)}`}>{it.status}</span>
                  </div>
                  <a
                    href={makeGoogleCalendarUrl(it)}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 text-[8px] font-extrabold px-2 py-1 rounded flex items-center gap-1 transition-colors"
                    title="Add to Google Calendar"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                    Google Cal
                  </a>
                </div>
              ))}
            </div>
            <button
              onClick={() => { setDayModal(null); show(null, dayModal) }}
              className="mt-3 w-full bg-[#E8C547] text-gray-900 py-1.5 rounded-lg text-[10px] font-bold hover:bg-[#d4b33d]"
            >
              + Add Schedule for this Date
            </button>
          </div>
        </div>
      )}

      {/* Add / Edit schedule modal */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={save} className="bg-white rounded-xl w-full max-w-md p-5 shadow-2xl my-6">
            <div className="flex justify-between items-start mb-3 pb-2 border-b border-gray-100">
              <div>
                <h2 className="text-sm font-extrabold text-gray-900">{editId ? 'Edit Schedule' : 'Schedule Details'}</h2>
                <p className="text-[9px] text-gray-500">Configure delivery or check payment monitoring.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 font-bold">✕</button>
            </div>

            <div className="flex flex-col gap-2.5">
              {/* Category */}
              <div>
                <label className="text-[9px] font-bold text-gray-700 block mb-1">
                  SCHEDULE TYPE
                </label>
                <select
                  name="category"
                  value={form.category || 'Supplier Check / Payment Due'}
                  onChange={(e) => {
                    const val = e.target.value
                    setForm(p => ({
                      ...p,
                      category: val,
                      title: (!p.title || p.title === 'Check Payment Due to Supplier' || p.title === 'Material Delivery from Supplier')
                        ? (val === 'Supplier Check / Payment Due' ? 'Check Payment Due to Supplier' : val === 'Material Delivery from Supplier' ? 'Material Delivery from Supplier' : '')
                        : p.title
                    }))
                  }}
                  className="w-full bg-[#f4f1ee] border border-gray-200 rounded-lg p-2 text-xs font-semibold outline-none focus:border-[#A63228]"
                >
                  <option value="Supplier Check / Payment Due">Supplier Check / Payment Due</option>
                  <option value="Material Delivery from Supplier">Material Delivery from Supplier</option>
                  <option value="General Activity">General Milestone / Task</option>
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="text-[9px] font-bold text-gray-700 block mb-1">
                  TITLE / DESCRIPTION
                </label>
                <input
                  required
                  name="title"
                  placeholder="e.g. Cement Delivery / Payment to Supplier"
                  value={form.title}
                  onChange={change}
                  className="w-full bg-[#f4f1ee] border border-gray-200 rounded-lg p-2 text-xs outline-none focus:border-[#A63228]"
                />
              </div>

              {/* Project */}
              <div>
                <label className="text-[9px] font-bold text-gray-700 block mb-1">
                  PROJECT (OPTIONAL)
                </label>
                <select
                  name="project_id"
                  value={form.project_id || ''}
                  onChange={change}
                  className="w-full bg-[#f4f1ee] border border-gray-200 rounded-lg p-2 text-xs font-medium outline-none focus:border-[#A63228]"
                >
                  <option value="">General (No specific project)</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {/* Fields for Supplier Check */}
              {form.category === 'Supplier Check / Payment Due' && (
                <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 grid grid-cols-2 gap-2">
                  <div className="col-span-2">
                    <label className="text-[8px] font-bold text-amber-900 block mb-0.5">SUPPLIER NAME</label>
                    <input
                      name="supplier_name"
                      placeholder="e.g. ABC Hardware Supply"
                      value={form.supplier_name || ''}
                      onChange={change}
                      className="w-full bg-white border border-amber-200 rounded p-1.5 text-[10px]"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-amber-900 block mb-0.5">CHECK / REF NO.</label>
                    <input
                      name="check_no"
                      placeholder="CHK-12345"
                      value={form.check_no || ''}
                      onChange={change}
                      className="w-full bg-white border border-amber-200 rounded p-1.5 text-[10px]"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-amber-900 block mb-0.5">AMOUNT (PHP)</label>
                    <input
                      type="number"
                      name="amount"
                      placeholder="25000"
                      value={form.amount || ''}
                      onChange={change}
                      className="w-full bg-white border border-amber-200 rounded p-1.5 text-[10px]"
                    />
                  </div>
                </div>
              )}

              {/* Fields for Material Delivery */}
              {form.category === 'Material Delivery from Supplier' && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5 grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[8px] font-bold text-blue-900 block mb-0.5">SUPPLIER</label>
                    <input
                      name="supplier_name"
                      placeholder="e.g. Solid Cement Supply"
                      value={form.supplier_name || ''}
                      onChange={change}
                      className="w-full bg-white border border-blue-200 rounded p-1.5 text-[10px]"
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-blue-900 block mb-0.5">DRIVER / CONTACT</label>
                    <input
                      name="check_no"
                      placeholder="0917-123-4567"
                      value={form.check_no || ''}
                      onChange={change}
                      className="w-full bg-white border border-blue-200 rounded p-1.5 text-[10px]"
                    />
                  </div>
                </div>
              )}

              {/* Date & Time */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9px] font-bold text-gray-700 block mb-1">DUE DATE</label>
                  <input
                    required
                    type="date"
                    name="schedule_date"
                    value={form.schedule_date?.slice(0, 10)}
                    onChange={change}
                    className="w-full bg-[#f4f1ee] border border-gray-200 rounded-lg p-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-gray-700 block mb-1">TIME</label>
                  <input
                    type="time"
                    name="schedule_time"
                    value={form.schedule_time || '09:00'}
                    onChange={change}
                    className="w-full bg-[#f4f1ee] border border-gray-200 rounded-lg p-2 text-xs"
                  />
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-[9px] font-bold text-gray-700 block mb-1">STATUS</label>
                <select
                  name="status"
                  value={form.status}
                  onChange={change}
                  className="w-full bg-[#f4f1ee] border border-gray-200 rounded-lg p-2 text-xs"
                >
                  {['Scheduled', 'In Progress', 'Completed', 'Cancelled'].map(x => <option key={x}>{x}</option>)}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[9px] font-bold text-gray-700 block mb-1">NOTES (OPTIONAL)</label>
                <textarea
                  name="notes"
                  placeholder="Additional instructions or notes..."
                  value={form.notes || ''}
                  onChange={change}
                  className="w-full bg-[#f4f1ee] border border-gray-200 rounded-lg p-2 text-xs"
                  rows="2"
                />
              </div>

              {/* Google Calendar push notification checkbox */}
              <div className="bg-gradient-to-r from-amber-50 to-orange-50/50 border border-amber-300 rounded-xl p-2.5 flex items-start gap-2.5 mt-0.5">
                <input
                  type="checkbox"
                  id="syncGoogleCalendar"
                  name="syncGoogleCalendar"
                  checked={form.syncGoogleCalendar ?? true}
                  onChange={e => setForm(p => ({ ...p, syncGoogleCalendar: e.target.checked }))}
                  className="mt-0.5 accent-[#A63228] w-4 h-4 cursor-pointer rounded"
                />
                <label htmlFor="syncGoogleCalendar" className="text-[9px] text-gray-800 cursor-pointer flex-1">
                  <div className="flex items-center gap-1.5">
                    <strong className="text-gray-900 font-extrabold text-[9.5px]">
                      Sync with Google Calendar on Save
                    </strong>
                    <span className="bg-[#2e7d32] text-white text-[7px] font-extrabold px-1.5 py-0.2 rounded-full uppercase tracking-wider">
                      Push Alarm
                    </span>
                  </div>
                  <p className="text-gray-600 text-[8.5px] leading-tight mt-0.5">
                    Automatically opens in Google Calendar to enable mobile notifications and alarms prior to the scheduled date.
                  </p>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100">
              {editId && (
                <button type="button" onClick={() => { setOpen(false); remove(editId) }} className="px-3 py-2 rounded-lg text-xs font-bold text-red-600 border border-red-200 hover:bg-red-50 transition-colors">
                  Delete
                </button>
              )}
              {editId && (
                <a
                  href={makeGoogleCalendarUrl(form)}
                  target="_blank"
                  rel="noreferrer"
                  className="py-2 px-3 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors flex items-center gap-1.5"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
                  Open in Google Cal ↗
                </a>
              )}
              <button type="submit" className="flex-1 bg-[#E8C547] py-2 rounded-lg text-xs font-extrabold hover:bg-[#d4b33d] transition-colors shadow-xs">
                {editId ? 'Update Schedule' : 'Save & Sync Schedule'}
              </button>
            </div>
          </form>
        </div>
      )}
    </AdminLayout>
  )
}
