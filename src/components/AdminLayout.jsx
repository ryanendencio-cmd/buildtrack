import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useNotifications } from '../context/useNotifications'

export default function AdminLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const [adminProfile, setAdminProfile] = React.useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('adminProfile') || '{}');
      const session = JSON.parse(localStorage.getItem('adminSession') || '{}');
      return {
        name: saved.fullName || saved.name || session.fullName || 'Administrator',
        role: saved.role || session.role || 'Administrator',
        ...saved
      };
    } catch {
      return { name: 'Administrator', role: 'Administrator' };
    }
  });
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();

  React.useEffect(() => {
    const handleOpenModal = () => setShowLogoutModal(true);
    window.addEventListener('open-logout-modal', handleOpenModal);
    return () => window.removeEventListener('open-logout-modal', handleOpenModal);
  }, []);

  React.useEffect(() => {
    const refreshProfile = () => {
      try {
        setAdminProfile(current => ({ ...current, ...JSON.parse(localStorage.getItem('adminProfile') || '{}') }));
      } catch {
        // Keep the last valid profile if browser storage is unavailable or malformed.
      }
    };
    window.addEventListener('admin-profile-updated', refreshProfile);
    return () => window.removeEventListener('admin-profile-updated', refreshProfile);
  }, []);

  const handleLogoutClick = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    localStorage.removeItem('user');
    localStorage.removeItem('adminId');
    localStorage.removeItem('adminSession');
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminProfile');
    sessionStorage.clear();
    navigate('/login');
  };

  const navItems = [
    {
      name: 'Dashboard', path: '/dashboard',
      icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>)
    },
    {
      name: 'Projects Management', path: '/projects',
      icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20"></path><path d="M5 20V8l7-5 7 5v12"></path><path d="M9 20v-5h6v5"></path></svg>)
    },
    {
      name: 'Expenses Management', path: '/expenses',
      icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>)
    },
    {
      name: 'Workers Management', path: '/workers',
      icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>)
    },
    {
      name: 'Attendance Management', path: '/attendance',
      icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>)
    },
    {
      name: 'Schedule Management', path: '/schedules',
      icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>)
    },
    {
      name: 'Cash Advance Management', path: '/cash-advance',
      icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>)
    },
    {
      name: 'Tools Management', path: '/assets',
      icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>)
    },
    {
      name: 'Materials Management', path: '/materials',
      icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>)
    },
    {
      name: 'Notifications', path: '/notifications', badge: unreadCount,
      icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>)
    },
    {
      name: 'Reports', path: '/reports',
      icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>)
    },
  ];

  return (
    <div className="flex h-screen bg-[#f3efea] overflow-hidden text-gray-800">

      {/* ── LEFT SIDEBAR ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 bg-white shadow-xl border-r border-gray-100/80 transform transition-transform duration-300 ease-in-out flex flex-col ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Sidebar Header */}
        <div className="h-14 flex items-center justify-between px-4 border-b border-gray-100 shrink-0">
          <img src="/logo.png" alt="S-CON Logo" className="h-7 object-contain" />
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-[#A63228] hover:bg-red-50 transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12"></line>
              <line x1="3" y1="6" x2="21" y2="6"></line>
              <line x1="3" y1="18" x2="21" y2="18"></line>
            </svg>
          </button>
        </div>

        {/* Section Label */}
        <div className="px-5 pt-4 pb-1.5 shrink-0">
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-gray-400 select-none">Main Menu</p>
        </div>

        {/* Nav Items */}
        <nav className="px-3 py-1 space-y-0.5 flex-1 overflow-y-auto">
          {navItems.map(item => {
            const isActive = location.pathname.toLowerCase().startsWith(item.path.toLowerCase());
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => window.innerWidth < 768 && setIsSidebarOpen(false)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-all duration-150 ${isActive
                  ? 'bg-gradient-to-r from-[#fce8e6] to-[#fdf4f3] text-[#A63228]'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-[#A63228]'
                  }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {/* Icon */}
                  <span className={`flex-shrink-0 transition-colors duration-150 ${isActive ? 'text-[#A63228]' : 'text-gray-400 group-hover:text-[#A63228]'}`}>
                    {item.icon}
                  </span>
                  <span className="leading-tight truncate">{item.name}</span>
                </div>
                {/* Right side: badge or active dot */}
                <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                  {/* ── NOTIFICATION BADGE ── */}
                  {item.badge > 0 && (
                    <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-[#A63228] text-white' : 'bg-[#fce8e6] text-[#A63228]'}`}>
                      {item.badge}
                    </span>
                  )}
                  {/* Active dot */}
                  {isActive && !item.badge && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#A63228]"></span>
                  )}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100 shrink-0 flex items-center justify-between gap-1">
          <Link
            to="/profile"
            className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex-1 min-w-0"
            onClick={() => window.innerWidth < 768 && setIsSidebarOpen(false)}
          >
            <div className="w-8 h-8 rounded-full bg-[#EAD9D8] text-[#A63228] flex items-center justify-center font-bold text-xs shrink-0">
              {(adminProfile.name || 'Administrator').split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase() || 'AD'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-extrabold text-[#1a1a1a] truncate">{adminProfile.name}</p>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider truncate">{adminProfile.role}</p>
            </div>
          </Link>
          <button
            onClick={handleLogoutClick}
            title="Log Out"
            className="p-2 rounded-lg text-gray-400 hover:text-[#A63228] hover:bg-red-50 transition-all shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
              <polyline points="16 17 21 12 16 7"></polyline>
              <line x1="21" y1="12" x2="9" y2="12"></line>
            </svg>
          </button>
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main
        className={`flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-all duration-300 ease-in-out ${isSidebarOpen ? 'md:ml-60' : 'ml-0'}`}
      >
        <header className="flex items-center justify-between px-4 md:px-6 shrink-0 h-12 border-b border-gray-100/50 bg-white/40 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 rounded-lg bg-white shadow-sm border border-gray-100 text-gray-600 hover:text-[#A63228] hover:bg-gray-50 transition-all"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-8 pt-3">
          {children}
        </div>
      </main>

      {/* ── LOGOUT CONFIRMATION MODAL ── */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-all">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl relative text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 text-[#A63228] mx-auto flex items-center justify-center mb-3">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
            </div>
            <h3 className="text-base font-extrabold text-gray-900 mb-1">Confirm Log Out</h3>
            <p className="text-xs text-gray-500 mb-6 font-medium">Are you sure you want to log out of S-CON System?</p>

            <div className="flex items-center justify-center gap-2.5">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="w-1/2 py-2 bg-gray-100 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmLogout}
                className="w-1/2 py-2 bg-[#A63228] text-white rounded-lg text-xs font-bold hover:bg-[#8B1A10] transition-colors shadow-sm"
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
