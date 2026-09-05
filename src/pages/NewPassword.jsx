import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import './NewPassword.css'

export default function NewPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

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
        <div className="forgot-form-card">
          <h2 className="forgot-title">Reset password</h2>
          <p className="forgot-subtitle">
            Create a new password for your account.
          </p>

          <form className="login-form forgot-form" onSubmit={e => e.preventDefault()}>
            
            {/* New Password */}
            <div className="form-group">
              <label className="form-label">New Password</label>
              <div className="input-wrap">
                <span className="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Enter new password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <div className="input-wrap">
                <span className="input-icon">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Password Requirements - only show when user starts typing */}
            {password.length > 0 && (
              <div className="password-requirements">
                <p className="req-title">Password must contain:</p>
                <div className="req-list">
                  <div className={`req-item ${password.length >= 8 ? 'valid' : ''}`}>
                    <span className="req-circle"></span> 8+ characters
                  </div>
                  <div className={`req-item ${/[A-Z]/.test(password) ? 'valid' : ''}`}>
                    <span className="req-circle"></span> 1 uppercase letter
                  </div>
                  <div className={`req-item ${/[0-9]/.test(password) ? 'valid' : ''}`}>
                    <span className="req-circle"></span> 1 number
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="forgot-btn-wrap" style={{ marginTop: '20px' }}>
              <Link to="/success" className="btn-forgot-submit text-center" style={{ textDecoration: 'none' }}>
                RESET PASWORD
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

