import React from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useNotifications } from '../context/useNotifications'
import { api } from '../api'

export default function AdminLayout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [showLogoutModal, setShowLogoutModal] = React.useState(false);
  const [isDarkMode, setIsDarkMode] = React.useState(() => {
    try {
      return localStorage.getItem('buildtrack_theme') === 'dark' ||
        (!localStorage.getItem('buildtrack_theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    } catch {
      return false;
    }
  });

  React.useEffect(() => {
    try {
      if (isDarkMode) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('buildtrack_theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('buildtrack_theme', 'light');
      }
    } catch {}
  }, [isDarkMode]);

  const [adminProfile, setAdminProfile] = React.useState(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('adminProfile') || localStorage.getItem('adminProfile') || '{}');
      const session = JSON.parse(sessionStorage.getItem('adminSession') || localStorage.getItem('adminSession') || '{}');
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
        setAdminProfile(current => ({ ...current, ...JSON.parse(sessionStorage.getItem('adminProfile') || localStorage.getItem('adminProfile') || '{}') }));
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

  const confirmLogout = async () => {
    try {
      const adminId = sessionStorage.getItem('adminId') || localStorage.getItem('adminId');
      const session = JSON.parse(sessionStorage.getItem('adminSession') || localStorage.getItem('adminSession') || '{}');
      const savedProfile = JSON.parse(sessionStorage.getItem('adminProfile') || localStorage.getItem('adminProfile') || '{}');
      const name = session.fullName || session.name || session.username || savedProfile.name || adminProfile.name || 'Administrator';
      const role = session.role || savedProfile.role || adminProfile.role || 'Administrator';

      await api.post('/logout', {
        userId: adminId,
        name,
        role,
        client: 'Web Admin App'
      }).catch(() => {});
    } catch {
      // Continue logout even if request fails
    } finally {
      localStorage.removeItem('user');
      localStorage.removeItem('adminId');
      localStorage.removeItem('adminSession');
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminProfile');
      sessionStorage.clear();
      navigate('/login');
    }
  };

  const navSections = [
    {
      label: 'Overview',
      items: [
        {
          name: 'Dashboard', path: '/dashboard',
          icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>)
        },
      ]
    },
    {
      label: 'Project & Finance',
      items: [
        {
          name: 'Projects Management', path: '/projects',
          icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20h20"></path><path d="M5 20V8l7-5 7 5v12"></path><path d="M9 20v-5h6v5"></path></svg>)
        },
        {
          name: 'Expenses Management', path: '/expenses',
          icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><text x="12" y="17.5" fontSize="17" fontWeight="bold" textAnchor="middle" stroke="none" fill="currentColor">₱</text></svg>)
        },
        {
          name: 'Cash Advance', path: '/cash-advance',
          icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>)
        },
      ]
    },
    {
      label: 'Workforce',
      items: [
        {
          name: 'Workers Management', path: '/workers',
          icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>)
        },
        {
          name: 'Workers Salary', path: '/salary',
          icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"></rect><line x1="2" y1="10" x2="22" y2="10"></line><circle cx="12" cy="15" r="2"></circle></svg>)
        },
        {
          name: 'Attendance', path: '/attendance',
          icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>)
        },
        {
          name: 'Schedules', path: '/schedules',
          icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>)
        },
      ]
    },
    {
      label: 'Assets & Tools',
      items: [
        {
          name: 'Tools Management', path: '/assets',
          icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path></svg>)
        },
      ]
    },
    {
      label: 'System',
      items: [
        {
          name: 'Notifications', path: '/notifications', badge: unreadCount,
          icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>)
        },
        {
          name: 'Reports', path: '/reports',
          icon: (<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>)
        },
      ]
    },
  ];

  return (
    <div className="flex h-screen bg-[#f3efea] overflow-hidden text-gray-800 print:h-auto print:bg-white print:overflow-visible transition-colors duration-200">

      {/* ── MOBILE BACKDROP OVERLAY ── */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-35 md:hidden transition-opacity"
        />
      )}

      {/* ── LEFT SIDEBAR (Full width on open, mini icon-only on desktop when collapsed) ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 bg-white shadow-xl border-r border-gray-100/80 transition-all duration-300 ease-in-out flex flex-col print:hidden ${
          isSidebarOpen
            ? 'w-60 translate-x-0'
            : '-translate-x-full md:translate-x-0 md:w-[70px]'
        }`}
      >
        {/* Sidebar Header */}
        <div className={`h-14 flex items-center border-b border-gray-100 shrink-0 ${
          isSidebarOpen ? 'justify-between px-4' : 'justify-center px-2'
        }`}>
          {isSidebarOpen ? (
            <>
              <img src="/logo.png" alt="S-CON Logo" className="h-7 object-contain sidebar-logo transition-all" />
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#A63228] hover:bg-red-50 transition-all cursor-pointer"
                title="Collapse Sidebar"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="w-10 h-10 rounded-xl bg-white hover:bg-red-50 text-gray-700 hover:text-[#A63228] border border-gray-200/80 hover:border-[#A63228]/30 flex items-center justify-center transition-all cursor-pointer shadow-2xs hover:scale-105"
              title="Expand Sidebar"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"></line>
                <line x1="3" y1="6" x2="21" y2="6"></line>
                <line x1="3" y1="18" x2="21" y2="18"></line>
              </svg>
            </button>
          )}
        </div>

        {/* Nav Sections */}
        <nav className={`pt-3 pb-1 flex-1 overflow-y-auto ${isSidebarOpen ? 'px-2.5 space-y-3' : 'px-2 space-y-2'}`}>
          {navSections.map((section, idx) => (
            <div key={section.label} className={isSidebarOpen ? '' : 'flex flex-col items-center'}>
              {/* Section Label (Text when open, clean subtle gap when collapsed) */}
              {isSidebarOpen ? (
                <p className="px-2 pb-1 text-[10px] font-extrabold uppercase tracking-widest text-gray-400 select-none">
                  {section.label}
                </p>
              ) : (
                idx > 0 && <div className="w-4 h-px bg-gray-200/50 my-1"></div>
              )}
              <div className={`space-y-0.5 ${isSidebarOpen ? 'w-full' : 'w-full flex flex-col items-center'}`}>
                {section.items.map(item => {
                  const isActive = location.pathname.toLowerCase().startsWith(item.path.toLowerCase());
                  return (
                    <Link
                      key={item.name}
                      to={item.path}
                      title={!isSidebarOpen ? item.name : undefined}
                      onClick={() => window.innerWidth < 768 && setIsSidebarOpen(false)}
                      className={`group flex items-center rounded-xl transition-all duration-150 ${
                        isSidebarOpen
                          ? 'justify-between px-3 py-2.5 text-[12px] font-semibold'
                          : 'w-10 h-10 justify-center relative'
                      } ${
                        isActive
                          ? 'bg-gradient-to-r from-[#fce8e6] to-[#fdf4f3] text-[#A63228] shadow-2xs font-bold'
                          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                      }`}
                    >
                      <div className={`flex items-center ${isSidebarOpen ? 'gap-2.5 min-w-0' : 'justify-center'}`}>
                        <span className={`flex-shrink-0 transition-colors duration-150 ${isActive ? 'text-[#A63228]' : 'text-gray-400 group-hover:text-gray-800'}`}>
                          {item.icon}
                        </span>
                        {isSidebarOpen && <span className="leading-tight truncate">{item.name}</span>}
                      </div>

                      {/* Badges / Active indicators */}
                      {isSidebarOpen ? (
                        <div className="flex items-center gap-1 flex-shrink-0 ml-1">
                          {item.badge > 0 && (
                            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-[#A63228] text-white' : 'bg-[#fce8e6] text-[#A63228]'}`}>
                              {item.badge}
                            </span>
                          )}
                          {isActive && !item.badge && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#A63228]"></span>
                          )}
                        </div>
                      ) : (
                        item.badge > 0 && (
                          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#A63228] ring-2 ring-white"></span>
                        )
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Profile / Logout Footer */}
        <div className={`p-2.5 border-t border-gray-100 shrink-0 flex ${
          isSidebarOpen ? 'items-center justify-between gap-1' : 'flex-col items-center gap-2'
        }`}>
          <Link
            to="/profile"
            className={`flex items-center rounded-xl hover:bg-gray-100 transition-all cursor-pointer ${
              isSidebarOpen ? 'gap-2.5 px-2 py-1.5 flex-1 min-w-0' : 'w-10 h-10 justify-center'
            }`}
            title={adminProfile.name || 'Administrator'}
            onClick={() => window.innerWidth < 768 && setIsSidebarOpen(false)}
          >
            <div className="w-8 h-8 rounded-full bg-[#EAD9D8] text-[#A63228] flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
              {(adminProfile.name || 'Administrator').split(/\s+/).filter(Boolean).slice(-2).map(part => part[0]).join('').toUpperCase() || 'AD'}
            </div>
            {isSidebarOpen && (
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold text-[#1a1a1a] truncate">{adminProfile.name}</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider truncate">{adminProfile.role}</p>
              </div>
            )}
          </Link>
          <button
            onClick={handleLogoutClick}
            title="Log Out"
            className={`rounded-xl text-gray-400 hover:text-[#A63228] hover:bg-red-50 transition-all shrink-0 cursor-pointer flex items-center justify-center ${
              isSidebarOpen ? 'p-2' : 'w-10 h-10'
            }`}
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
        className={`flex-1 flex flex-col min-w-0 h-full overflow-hidden transition-all duration-300 ease-in-out ${
          isSidebarOpen ? 'md:ml-60' : 'ml-0 md:ml-[70px]'
        } print:ml-0 print:h-auto print:overflow-visible print:w-full`}
      >
        {/* ── TOP HEADER (Clean with Night Mode Toggle) ── */}
        <header className="flex items-center justify-between px-3 md:px-6 shrink-0 h-11 border-b border-gray-100/70 bg-white/70 backdrop-blur-md print:hidden transition-colors">
          {/* Mobile drawer toggle (only appears on mobile when sidebar is hidden) */}
          <div className="flex items-center">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 rounded-lg bg-white shadow-2xs border border-gray-200/70 text-gray-600 hover:text-[#A63228] hover:bg-red-50 transition-all cursor-pointer md:hidden"
                title="Open Sidebar"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="3" y1="12" x2="21" y2="12"></line>
                  <line x1="3" y1="6" x2="21" y2="6"></line>
                  <line x1="3" y1="18" x2="21" y2="18"></line>
                </svg>
              </button>
            )}
          </div>

          {/* Right: Only Night/Dark Mode Toggle */}
          <div className="flex items-center ml-auto">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 rounded-lg text-gray-500 hover:text-[#A63228] hover:bg-gray-100 transition-all cursor-pointer flex items-center justify-center"
              title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {isDarkMode ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-600">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
              )}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-8 pt-3 print:overflow-visible print:p-0 print:h-auto">
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
