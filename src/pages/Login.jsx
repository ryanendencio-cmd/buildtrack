import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import './Login.css'

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)

  return (
    <div className="login-page">

      {/* ── LEFT PANEL ── */}
      <div className="login-left">
        {/* Logo */}
        <div className="login-logo-wrap">
          <img src="/logo.png" alt="Sotalbo Construction" className="login-logo" />
        </div>

        {/* Hero text */}
        <div className="login-hero-text">
          {/* Tagline */}
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
        <div className="login-form-card">
          <h2 className="login-welcome">Welcome back.</h2>
          <p className="login-subtitle">Sign in to your account.</p>

          <form className="login-form" onSubmit={e => e.preventDefault()}>

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
            </div>

            {/* Password */}
            <div className="form-group">
              <label className="form-label">Password</label>
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
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="eye-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                      <line x1="1" y1="1" x2="23" y2="23"/>
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div className="form-row">
              <label className="remember-label">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="remember-check"
                />
                <span>Remember me</span>
              </label>
              <Link to="/forgot-password" className="forgot-link">Forgot Password?</Link>
            </div>

            {/* Submit */}
            <button type="submit" className="btn-login-submit">
              Log in
            </button>
          </form>

          {/* Notice */}
          <div className="login-notice">
            <span className="notice-icon">🛡️</span>
            <p>
              <strong>Authorized users only.</strong> Accounts are created and managed by
              your system administrator — there's no public sign-up.
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}

