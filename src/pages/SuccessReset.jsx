import React from 'react'
import { Link } from 'react-router-dom'
import './SuccessReset.css'

export default function SuccessReset() {
  return (
    <div className="login-page forgot-page">

      {/* ── LEFT PANEL ── */}
      <div className="login-left">
        <div className="login-logo-wrap">
          <img src="/logo.png" alt="Sotalbo Construction" className="login-logo" />
        </div>

        <div className="login-hero-text">
          <p className="login-tagline">— "Let's Build Your Blessings"</p>
          <h1>
            <span className="lh-white">Manage projects.<br />Track expenses.<br /></span>
            <span className="lh-yellow">Build with<br />confidence.</span>
          </h1>
        </div>

        <p className="login-copy">© 2026 Sotalbo Construction · BuildTrack. All rights reserved.</p>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="login-right">
        <div className="forgot-form-card success-card">
          
          <div className="success-icon-wrap">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="32" fill="#A63228"/>
              <path d="M19 32.5L27.5 41L45 23.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>

          <h2 className="forgot-title success-title">Password updated!</h2>
          <p className="forgot-subtitle success-subtitle">
            Your password has been successfully changed. You can now log in using your new password.
          </p>

          {/* Submit Button */}
          <div className="forgot-btn-wrap" style={{ marginTop: '30px' }}>
            <Link to="/login" className="btn-forgot-submit text-center" style={{ textDecoration: 'none' }}>
              Go to Login
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}

