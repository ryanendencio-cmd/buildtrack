import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

function PrivateRoute({ children }) {
  const token = localStorage.getItem('adminToken')
  const session = localStorage.getItem('adminSession')
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
      </Routes>
    </BrowserRouter>
  )
}
