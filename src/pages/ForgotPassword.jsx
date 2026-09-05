import React from 'react'
import { Link } from 'react-router-dom'
import './ForgotPassword.css'

export default function ForgotPassword() {
  return (
    <div className="login-page forgot-page">

      {/* ── LEFT PANEL ── */}
      <div className="login-left">
        {/* Logo */}
        <div className="login-logo-wrap">
          <img src="/logo.png" alt="Sotalbo Construction" className="login-logo" />
        </div>

        {/* Hero text block */}
        <div className="login-hero-text">
          <p className="login-tagline">— "Let's Build Your Blessings"</p>
          <h1>
            <span className="lh-white">Manage projects.<br />Track expenses.<br /></span>
            <span className="lh-yellow">Build with<br />confidence.</span>
          </h1>
        </div>

        {/* Copyright */}
        <p className="login-copy">© 2026 Sotalbo Construction · BuildTrack. All rights reserved.</p>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="login-right">
        <div className="forgot-form-card">
          <h2 className="forgot-title">Forgot password?</h2>
          <p className="forgot-subtitle">
            No worries. Enter your email or username and we'll help you reset your password.
          </p>

          <form className="login-form forgot-form" onSubmit={e => e.preventDefault()}>
            {/* Email */}
            <div className="form-group">
              <label className="form-label">Email / Username</label>
              <div className="input-wrap">
                <span className="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
                </span>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Enter your email or username"
                />
              </div>
              <div className="resend-wrap">
                <button type="button" className="resend-btn">Resend Link</button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="forgot-btn-wrap" style={{ marginTop: '20px' }}>
              <Link to="/new-password" className="btn-forgot-submit text-center" style={{ textDecoration: 'none' }}>
                SEND RESET LINK
              </Link>
            </div>

            {/* Back to Login */}
            <div className="back-link-wrap">
              <Link to="/login" className="back-link">
                ← Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

