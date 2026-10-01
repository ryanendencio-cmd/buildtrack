import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
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
import SuccessReset from './pages/SuccessReset'
import Dashboard from './pages/Dashboard'
import Projects from './pages/Projects'
import Expenses from './pages/Expenses'
import ProjectDetails from './pages/ProjectDetails'
import MaterialLog from './pages/MaterialLog'
import Attendance from './pages/Attendance'
import Assets from './pages/Assets'
import Materials from './pages/Materials'
import Reports from './pages/Reports'
import Profile from './pages/Profile'
import Workers from './pages/Workers'
import Notifications from './pages/Notifications'
import CashAdvance from './pages/CashAdvance'
import Schedules from './pages/Schedules'

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
        <Route path="/success" element={<SuccessReset />} />

        {/* Admin Routes */}
        <Route path="/dashboard" element={<Dashboard />} />

        <Route path="/projects" element={<Projects />} />
        <Route path="/project-details/:id" element={<ProjectDetails />} />

        <Route path="/expenses" element={<Expenses />} />
        <Route path="/expenses/:id" element={<Expenses />} />

        <Route path="/attendance" element={<Attendance />} />
        <Route path="/attendance/:id" element={<Attendance />} />

        <Route path="/assets" element={<Assets />} />
        <Route path="/assets/:id" element={<Assets />} />

        <Route path="/materials" element={<Materials />} />
        <Route path="/materials/:id" element={<Materials />} />
        <Route path="/material-log/:id" element={<MaterialLog />} />

        <Route path="/workers" element={<Workers />} />
        <Route path="/cash-advance" element={<CashAdvance />} />
        <Route path="/cash-advance/:id" element={<CashAdvance />} />
        <Route path="/schedules" element={<Schedules />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/notifications" element={<Notifications />} />
      </Routes>
    </BrowserRouter>
  )
}
