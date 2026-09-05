import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import './AdminLayout.css'

export default function AdminLayout({ children }) {
  const location = useLocation()

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Projects', path: '/projects' },
    { name: 'Expenses', path: '/expenses' },
    { name: 'Attendance', path: '/attendance' },
    { name: 'Assets', path: '/assets' },
    { name: 'Reports', path: '/reports' }
  ]

  return (
    <div className="admin-layout">

      {/* Top Navigation Bar */}
      <nav className="admin-topbar">
        <div className="topbar-container">
          
          {/* Left: Logo */}
          <div className="topbar-logo">
            <img src="/logo.png" alt="S-CON Sotalbo Construction" />
          </div>

          {/* Center: Links */}
          <div className="topbar-links">
            {navLinks.map(link => (
              <Link 
                key={link.name} 
                to={link.path}
                className={`topbar-link ${location.pathname === link.path ? 'active' : ''}`}
              >
                {link.name}
              </Link>
            ))}
          </div>

          {/* Right: Profile */}
          <div className="topbar-profile">
            <div className="avatar">
              <span>EA</span>
            </div>
          </div>

        </div>
      </nav>

      {/* Main Content Area */}
      <main className="admin-main-content">
        <div className="content-container">
          {children}
        </div>
      </main>
    </div>
  )
}

