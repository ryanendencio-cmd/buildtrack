import React, { useState } from 'react'
import AdminLayout from '../components/AdminLayout'
import { useNotifications } from '../context/useNotifications'

export default function Notifications() {
    const [filter, setFilter] = useState('All')
    const [sortOrder, setSortOrder] = useState('Newest First')
    const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotifications()

    const filteredNotifs = notifications.filter(n => {
        if (filter === 'Unread') return !n.read
        if (filter !== 'All') return n.type === filter
        return true
    }).sort((a, b) => {
        const timeA = a.timestamp || new Date(a.date || 0).getTime() || 0
        const timeB = b.timestamp || new Date(b.date || 0).getTime() || 0
        return sortOrder === 'Newest First' ? timeB - timeA : timeA - timeB
    })

    const selectStyles = {
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 0.5rem center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '0.8rem 0.8rem'
    }

    const categories = ['All', 'Unread', 'Schedule', 'Staff & Workers', 'Budget', 'Tools', 'Expenses']

    return (
        <AdminLayout>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-2">
                <div>
                    <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">UPDATES & LOGS</span>
                    <div className="flex items-center gap-2 mt-0.5">
                        <h1 className="text-xl font-extrabold text-[#1a1a1a] tracking-tight">System Alerts & Notifications</h1>
                        {unreadCount > 0 && (
                            <span className="bg-[#A63228] text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-sm">{unreadCount} New</span>
                        )}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">Monitor upcoming schedule warnings (3 days remaining), staff and worker actions, budgets, and tools.</p>
                </div>
                <button
                    onClick={markAllAsRead}
                    disabled={unreadCount === 0}
                    className={`px-4 py-2 rounded-lg font-bold text-[10px] shadow-sm transition-colors flex items-center justify-center gap-1.5 w-full md:w-auto ${unreadCount > 0 ? 'bg-[#E8C547] text-gray-900 hover:bg-[#d4b33d]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                >
                    Mark All as Read
                </button>
            </div>

            <div className="bg-white rounded-t-xl shadow-sm border border-gray-100 border-b-0 p-3 flex flex-col sm:flex-row justify-between gap-2">
                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setFilter(cat)}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold whitespace-nowrap transition-colors ${filter === cat ? 'bg-[#A63228] text-white' : 'bg-[#f4f1ee] text-gray-600 hover:bg-gray-200'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="bg-[#f4f1ee] border border-transparent text-gray-700 pl-3 pr-8 py-1.5 rounded-md text-[9px] font-bold outline-none appearance-none w-full sm:w-auto"
                    style={selectStyles}
                >
                    <option value="Newest First">Newest First</option>
                    <option value="Oldest First">Oldest First</option>
                </select>
            </div>

            <div className="bg-white rounded-b-xl shadow-sm border border-gray-100 p-2 mb-6 min-h-[400px]">
                {filteredNotifs.length > 0 ? (
                    <div className="flex flex-col gap-1.5">
                        {filteredNotifs.map(notif => (
                            <div
                                key={notif.id}
                                className={`flex items-start justify-between p-4 rounded-md border-l-[3px] transition-all ${notif.read
                                    ? 'bg-white border-l-gray-300 border-y border-r border-transparent hover:bg-gray-50'
                                    : notif.severity === 'High'
                                        ? 'bg-[#fce8e6]/50 border-l-[#A63228] border-y border-r border-red-50'
                                        : notif.type === 'Schedule'
                                            ? 'bg-amber-50/60 border-l-amber-500 border-y border-r border-amber-100'
                                            : notif.type === 'Staff & Workers'
                                                ? 'bg-blue-50/50 border-l-blue-600 border-y border-r border-blue-100'
                                                : 'bg-yellow-50/50 border-l-[#ca8a04] border-y border-r border-yellow-50'
                                    }`}
                            >
                                <div className="flex flex-col flex-1 pr-2">
                                    <div className="flex flex-wrap items-center gap-2 mb-1">
                                        <h4 className={`text-[11px] font-extrabold ${notif.read ? 'text-gray-700' : 'text-gray-900'}`}>{notif.title}</h4>
                                        <span className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm ${
                                            notif.type === 'Schedule' ? 'bg-amber-100 text-amber-900 border border-amber-300 font-extrabold' :
                                            notif.type === 'Staff & Workers' ? 'bg-blue-100 text-blue-900 border border-blue-300 font-extrabold' :
                                            notif.type === 'Budget' ? 'bg-red-50 text-[#A63228] border border-red-200' :
                                            notif.type === 'Tools' ? 'bg-orange-50 text-[#ca8a04] border border-orange-200' :
                                            notif.type === 'Expenses' ? 'bg-green-50 text-[#2e7d32] border border-green-200' :
                                            'bg-gray-100 text-gray-500'
                                        }`}>
                                            {notif.type}
                                        </span>
                                        {notif.severity === 'High' && (
                                            <span className="text-[7px] font-extrabold uppercase px-1 py-0.2 rounded bg-red-600 text-white">HIGH ALERT</span>
                                        )}
                                    </div>
                                    <p className={`text-[10px] leading-relaxed mb-2 ${notif.read ? 'text-gray-500' : 'text-gray-800 font-medium'}`}>
                                        {notif.message}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-2 text-[8px] font-bold text-gray-400">
                                        <span className="uppercase tracking-widest">{notif.date}</span>
                                        {notif.time && <span>• {notif.time}</span>}
                                        {notif.actor_name && (
                                            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-bold">
                                                👤 {notif.actor_name} {notif.actor_role ? `(${notif.actor_role})` : ''}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {!notif.read && (
                                    <button
                                        onClick={() => markAsRead(notif.id)}
                                        className="text-[9px] font-bold text-gray-600 bg-white border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50 transition-colors shrink-0 ml-2"
                                    >
                                        Acknowledge
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
                        </div>
                        <h4 className="text-xs font-extrabold text-gray-900 mb-1">No Alerts Found</h4>
                        <p className="text-[10px] text-gray-500">No active alerts for {filter !== 'All' ? `the "${filter}" category` : 'this category'}.</p>
                    </div>
                )}
            </div>
        </AdminLayout>
    )
}
