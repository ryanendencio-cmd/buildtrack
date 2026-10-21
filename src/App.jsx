import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

// Clean up legacy localStorage tokens so closing the browser/tab always auto-logs out
try {
  if (localStorage.getItem('adminToken') || localStorage.getItem('adminSession')) {
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminSession')
    localStorage.removeItem('adminId')
  }
} catch {}

function PrivateRoute({ children }) {
  const token = sessionStorage.getItem('adminToken')
  const session = sessionStorage.getItem('adminSession')
  if (!token || !session) return <Navigate to="/login" replace />
  return children
}
import Navbar from './components/Navbar'
import Hero from './components/Hero'
import Problem from './components/Problem'
import HowItWorks from './components/HowItWorks'
import OurStory from './components/OurStory'
import Expertise from './components/Expertise'
import Footer from './components/Footer'

import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import NewPassword from './pages/NewPassword'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Expenses from './pages/Expenses'
import ProjectDetails from './pages/ProjectDetails'
import Attendance from './pages/Attendance'
import Assets from './pages/Assets'
import Reports from './pages/Reports'
import Profile from './pages/Profile'
import Workers from './pages/Workers'
import Notifications from './pages/Notifications'
import CashAdvance from './pages/CashAdvance'
import Schedules from './pages/Schedules'
import AuditLogs from './pages/AuditLogs'
import WorkersSalary from './pages/WorkersSalary'

function LandingPage() {
  return (
    <>
      <Navbar /><Hero /><OurStory /><Expertise /><HowItWorks /><Problem />
      <Footer />
    </>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<NewPassword />} />

        {/* Admin Routes — protected */}
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />

        <Route path="/projects" element={<PrivateRoute><Projects /></PrivateRoute>} />
        <Route path="/project-details/:id" element={<PrivateRoute><ProjectDetails /></PrivateRoute>} />

        <Route path="/expenses" element={<PrivateRoute><Expenses /></PrivateRoute>} />
        <Route path="/expenses/:id" element={<PrivateRoute><Expenses /></PrivateRoute>} />

        <Route path="/attendance" element={<PrivateRoute><Attendance /></PrivateRoute>} />
        <Route path="/attendance/:id" element={<PrivateRoute><Attendance /></PrivateRoute>} />

        <Route path="/assets" element={<PrivateRoute><Assets /></PrivateRoute>} />
        <Route path="/assets/:id" element={<PrivateRoute><Assets /></PrivateRoute>} />

        {/* Materials redirects to Expenses & Receipts */}
        <Route path="/materials" element={<Navigate to="/expenses" replace />} />
        <Route path="/materials/:id" element={<Navigate to="/expenses" replace />} />

        <Route path="/workers" element={<PrivateRoute><Workers /></PrivateRoute>} />
        <Route path="/cash-advance" element={<PrivateRoute><CashAdvance /></PrivateRoute>} />
        <Route path="/cash-advance/:id" element={<PrivateRoute><CashAdvance /></PrivateRoute>} />
        <Route path="/schedules" element={<PrivateRoute><Schedules /></PrivateRoute>} />
        <Route path="/reports" element={<PrivateRoute><Reports /></PrivateRoute>} />
        <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
        <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
        <Route path="/audit-logs" element={<PrivateRoute><AuditLogs /></PrivateRoute>} />
        <Route path="/salary" element={<PrivateRoute><WorkersSalary /></PrivateRoute>} />
        <Route path="/payroll" element={<PrivateRoute><WorkersSalary /></PrivateRoute>} />
        <Route path="/workers-salary" element={<PrivateRoute><WorkersSalary /></PrivateRoute>} />
        <Route path="/workers%20salary" element={<Navigate to="/salary" replace />} />
        <Route path="/workers salary" element={<Navigate to="/salary" replace />} />
        <Route path="/projects/:id" element={<PrivateRoute><ProjectDetails /></PrivateRoute>} />

        {/* Global Fallback Route (prevents blank screen on unknown paths) */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
