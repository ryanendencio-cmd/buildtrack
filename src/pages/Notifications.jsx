import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '../components/AdminLayout'
import { useNotifications } from '../context/useNotifications'

// Helper to resolve the specific module & destination URL for any notification
export const resolveNotificationDestination = (notif) => {
    if (!notif) return { path: '/dashboard', label: 'Open Dashboard', module: 'Dashboard' };

    // If explicit link is provided
    if (notif.link) {
        let mod = 'Target Page';
        if (notif.link.includes('cash-advance')) mod = 'Cash Advance';
        else if (notif.link.includes('schedules')) mod = 'Schedules';
        else if (notif.link.includes('expenses')) mod = 'Expenses';
        else if (notif.link.includes('projects')) mod = 'Projects';
        else if (notif.link.includes('assets')) mod = 'Tools & Equipment';
        else if (notif.link.includes('materials')) mod = 'Materials';
        else if (notif.link.includes('attendance')) mod = 'Attendance';
        else if (notif.link.includes('workers')) mod = 'Workers Directory';
        return { path: notif.link, label: `Go to ${mod}`, module: mod };
    }

    const type = (notif.type || '').toLowerCase();
    const title = (notif.title || '').toLowerCase();
    const msg = (notif.message || '').toLowerCase();
    const action = (notif.action || '').toLowerCase();
    const pid = notif.project_id || '';

    // 1. Staff & Workers (Prioritize worker notifications so roles like "Tools Monitoring" or "Attendance Monitoring" aren't hijacked)
    const isWorkerSpecific = 
        title.includes('worker') ||
        title.includes('workforce') ||
        action.startsWith('worker_') ||
        (type.includes('staff') && !title.includes('attendance') && !title.includes('rfid') && !title.includes('material') && !title.includes('cash advance') && !title.includes('payroll') && !title.includes('salary'));

    if (isWorkerSpecific) {
        let wid = notif.worker_id || notif.target_id || '';
        let wname = notif.actor_name || notif.target_name || '';

        // Extract worker name from title if format is "Worker Profile Updated: Name" or similar
        if (!wname && notif.title && notif.title.includes(':')) {
            wname = notif.title.split(':')[1]?.trim() || '';
        }

        let targetPath = '/workers';
        const isApproval = title.includes('registration') || title.includes('approval') || action.includes('registration');
        const tabParam = isApproval ? '&tab=approval' : '';

        if (wid) {
            targetPath = `/workers?id=${encodeURIComponent(wid)}${tabParam}`;
        } else if (wname) {
            targetPath = `/workers?name=${encodeURIComponent(wname)}${tabParam}`;
        } else if (isApproval) {
            targetPath = '/workers?tab=approval';
        }

        return {
            path: targetPath,
            label: 'Go to Workers Directory',
            module: 'Workers Directory'
        };
    }

    // 2. Cash Advance
    if (title.includes('cash advance') || msg.includes('cash advance') || action.includes('cash_advance')) {
        return {
            path: pid ? `/cash-advance/${pid}` : '/cash-advance',
            label: 'Go to Cash Advance',
            module: 'Cash Advance Management'
        };
    }

    // 3. Schedule & Check Due Dates / Deliveries
    if (type.includes('schedule') || title.includes('schedule') || title.includes('due date') || title.includes('check') || title.includes('delivery') || msg.includes('schedule') || msg.includes('delivery')) {
        return {
            path: '/schedules',
            label: 'Go to Schedules',
            module: 'Schedule Management'
        };
    }

    // 4. Expenses / Receipts
    if (type.includes('expense') || title.includes('expense') || msg.includes('expense') || action.includes('expense')) {
        return {
            path: pid ? `/expenses/${pid}` : '/expenses',
            label: 'Go to Expenses',
            module: 'Expenses & Receipts'
        };
    }

    // 5. Budget / Projects
    if (type.includes('budget') || title.includes('budget') || msg.includes('budget') || title.includes('project')) {
        return {
            path: pid ? `/project-details/${pid}` : '/projects',
            label: 'Go to Projects',
            module: 'Projects & Budget'
        };
    }

    // 6. Tools & Assets Management (Avoid matching msg because worker descriptions might contain "Tools")
    if (type.includes('tool') || type.includes('asset') || title.includes('tool') || title.includes('asset') || title.includes('equipment') || title.includes('borrow') || action.includes('asset') || action.includes('tool') || action.includes('borrow')) {
        return {
            path: pid ? `/assets/${pid}` : '/assets',
            label: 'Go to Tools Management',
            module: 'Tools Management'
        };
    }

    // 7. Materials
    if (type.includes('material') || title.includes('material') || msg.includes('material') || action.includes('material')) {
        return {
            path: pid ? `/materials/${pid}` : '/materials',
            label: 'Go to Materials',
            module: 'Materials Management'
        };
    }

    // 8. Attendance & RFID taps
    if (title.includes('attendance') || title.includes('rfid tap') || action.includes('attendance')) {
        return {
            path: pid ? `/attendance/${pid}` : '/attendance',
            label: 'Go to Attendance',
            module: 'Attendance'
        };
    }

    // 9. Payroll & Wages
    if (title.includes('payroll') || title.includes('salary') || msg.includes('payroll')) {
        const isHistory = title.includes('release') || msg.includes('release') || title.includes('generated') || msg.includes('generated');
        return {
            path: isHistory ? '/salary?tab=history' : '/salary',
            label: isHistory ? 'View Released Payroll' : 'Go to Payroll',
            module: 'Workers Salary'
        };
    }

    return {
        path: '/dashboard',
        label: 'Go to Dashboard',
        module: 'Dashboard'
    };
};

export default function Notifications() {
    const navigate = useNavigate();
    const [filter, setFilter] = useState('All');
    const [sortOrder, setSortOrder] = useState('Newest First');
    const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotifications();

    const filteredNotifs = notifications.filter(n => {
        if (filter === 'Unread') return !n.read;
        if (filter === 'Cash Advance') {
            const dest = resolveNotificationDestination(n);
            return dest.module === 'Cash Advance Management' || (n.title || '').includes('Cash Advance');
        }
        if (filter === 'Tools') {
            const dest = resolveNotificationDestination(n);
            return dest.module === 'Tools Management' || (n.type || '').toLowerCase().includes('tool') || (n.title || '').toLowerCase().includes('tool') || (n.message || '').toLowerCase().includes('borrow');
        }
        if (filter !== 'All') return n.type === filter;
        return true;
    }).sort((a, b) => {
        const timeA = a.timestamp || new Date(a.date || 0).getTime() || 0;
        const timeB = b.timestamp || new Date(b.date || 0).getTime() || 0;
        return sortOrder === 'Newest First' ? timeB - timeA : timeA - timeB;
    });

    const selectStyles = {
        backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%236b7280'%3e%3cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'/%3e%3c/svg%3e")`,
        backgroundPosition: 'right 0.5rem center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: '0.8rem 0.8rem'
    };

    const categories = ['All', 'Unread', 'Schedule', 'Cash Advance', 'Staff & Workers', 'Budget', 'Tools', 'Expenses'];

    // Handle clicking Acknowledge or View: Marks as read if unread AND navigates directly to target
    const handleAcknowledgeAndNavigate = (notif) => {
        if (!notif.read) {
            markAsRead(notif.id);
        }
        const dest = resolveNotificationDestination(notif);
        navigate(dest.path);
    };

    // Acknowledge without leaving page
    const handleAcknowledgeOnly = (e, notifId) => {
        e.stopPropagation();
        markAsRead(notifId);
    };

    return (
        <AdminLayout>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 gap-2">
                <div>
                    <span className="text-[9px] font-bold text-[#A63228] tracking-widest uppercase">UPDATES & LOGS</span>
                    <div className="flex items-center gap-2 mt-0.5">
                        <h1 className="text-xl font-extrabold text-[#1a1a1a] tracking-tight">System Alerts & Notifications</h1>
                        {unreadCount > 0 && (
                            <span className="bg-[#A63228] text-white text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow-xs">
                                {unreadCount} New
                            </span>
                        )}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5">
                        Clicking any notification will mark it as read and direct you straight to its specific record or module.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={markAllAsRead}
                    disabled={unreadCount === 0}
                    className={`px-4 py-2 rounded-lg font-bold text-[10px] shadow-xs transition-colors flex items-center justify-center gap-1.5 w-full md:w-auto cursor-pointer ${unreadCount > 0 ? 'bg-[#E8C547] text-gray-900 hover:bg-[#d4b33d]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                >
                    Mark All as Read
                </button>
            </div>

            {/* CATEGORY FILTER TABS */}
            <div className="bg-white rounded-t-xl shadow-xs border border-gray-100 border-b-0 p-3 flex flex-col sm:flex-row justify-between gap-2">
                <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                    {categories.map(cat => (
                        <button
                            key={cat}
                            type="button"
                            onClick={() => setFilter(cat)}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-bold whitespace-nowrap transition-colors cursor-pointer ${filter === cat ? 'bg-[#A63228] text-white shadow-xs' : 'bg-[#f4f1ee] text-gray-600 hover:bg-gray-200'}`}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
                <select
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="bg-[#f4f1ee] border border-transparent text-gray-700 pl-3 pr-8 py-1.5 rounded-md text-[9px] font-bold outline-none appearance-none w-full sm:w-auto cursor-pointer"
                    style={selectStyles}
                >
                    <option value="Newest First">Newest First</option>
                    <option value="Oldest First">Oldest First</option>
                </select>
            </div>

            {/* NOTIFICATIONS LIST */}
            <div className="bg-white rounded-b-xl shadow-xs border border-gray-100 p-2.5 mb-6 min-h-[400px]">
                {filteredNotifs.length > 0 ? (
                    <div className="flex flex-col gap-2">
                        {filteredNotifs.map(notif => {
                            const dest = resolveNotificationDestination(notif);
                            const isCashAdvance = (notif.title || '').includes('Cash Advance') || dest.module === 'Cash Advance Management';

                            return (
                                <div
                                    key={notif.id}
                                    onClick={() => handleAcknowledgeAndNavigate(notif)}
                                    className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-lg border-l-[4px] transition-all cursor-pointer group hover:shadow-xs ${notif.read
                                        ? 'bg-white border-l-gray-300 border-y border-r border-gray-100 hover:bg-gray-50/70'
                                        : notif.severity === 'High'
                                            ? 'bg-red-50/40 border-l-[#A63228] border-y border-r border-red-100 hover:bg-red-50/70'
                                            : notif.type === 'Schedule'
                                                ? 'bg-amber-50/50 border-l-amber-500 border-y border-r border-amber-100 hover:bg-amber-50/80'
                                                : isCashAdvance
                                                    ? 'bg-emerald-50/40 border-l-emerald-600 border-y border-r border-emerald-100 hover:bg-emerald-50/70'
                                                    : notif.type === 'Staff & Workers'
                                                        ? 'bg-blue-50/40 border-l-blue-600 border-y border-r border-blue-100 hover:bg-blue-50/70'
                                                        : 'bg-yellow-50/40 border-l-[#ca8a04] border-y border-r border-yellow-100 hover:bg-yellow-50/70'
                                        }`}
                                >
                                    <div className="flex flex-col flex-1 pr-3 w-full">
                                        <div className="flex flex-wrap items-center gap-1.5 mb-1">
                                            <h4 className={`text-xs font-extrabold ${notif.read ? 'text-gray-700' : 'text-gray-900 group-hover:text-[#A63228] transition-colors'}`}>
                                                {notif.title}
                                            </h4>

                                            <span className={`text-[7.5px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-sm ${
                                                notif.type === 'Schedule' ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                                                isCashAdvance ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                                                notif.type === 'Staff & Workers' ? 'bg-blue-100 text-blue-900 border border-blue-300' :
                                                notif.type === 'Budget' ? 'bg-red-50 text-[#A63228] border border-red-200' :
                                                notif.type === 'Tools' ? 'bg-orange-50 text-[#ca8a04] border border-orange-200' :
                                                notif.type === 'Expenses' ? 'bg-green-50 text-[#2e7d32] border border-green-200' :
                                                'bg-gray-100 text-gray-500'
                                            }`}>
                                                {isCashAdvance ? 'Cash Advance' : notif.type}
                                            </span>

                                            {/* Location Tag */}
                                            <span className="text-[7.5px] font-bold text-gray-600 bg-white/80 border border-gray-200 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <span>→</span> {dest.module}
                                            </span>

                                            {notif.severity === 'High' && (
                                                <span className="text-[7px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-red-600 text-white">HIGH ALERT</span>
                                            )}

                                            {!notif.read && (
                                                <span className="w-2 h-2 rounded-full bg-[#A63228] inline-block animate-pulse"></span>
                                            )}
                                        </div>

                                        <p className={`text-[10px] leading-relaxed mb-2 ${notif.read ? 'text-gray-500' : 'text-gray-800 font-medium'}`}>
                                            {notif.message}
                                        </p>

                                        <div className="flex flex-wrap items-center gap-2 text-[8px] font-bold text-gray-400">
                                            <span className="uppercase tracking-widest">{notif.date}</span>
                                            {notif.time && <span>• {notif.time}</span>}
                                            {notif.actor_name && (
                                                <span className="bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded font-bold">
                                                    {notif.actor_name} {notif.actor_role ? `(${notif.actor_role})` : ''}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Row navigation indicator */}
                                    <div className="shrink-0 ml-3 text-gray-300 group-hover:text-[#A63228] group-hover:translate-x-0.5 transition-all self-center hidden sm:block">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M9 18l6-6-6-6"/>
                                        </svg>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center h-64 text-center">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-300">
                                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                            </svg>
                        </div>
                        <h4 className="text-xs font-extrabold text-gray-900 mb-1">No Alerts Found</h4>
                        <p className="text-[10px] text-gray-500">No active alerts for {filter !== 'All' ? `the "${filter}" category` : 'this category'}.</p>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
}
