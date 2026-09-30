import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
// Siguraduhing burado na ang line na ito: import './Login.css'

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('http://localhost:5000/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid username or password.')
      } else {
        // Save admin session info
        localStorage.setItem('adminId', data.admin.id)
        localStorage.setItem('adminSession', JSON.stringify(data.admin))
        navigate('/dashboard')
      }
    } catch {
      setError('Cannot connect to server. Make sure it is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'row', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>

      {/* ── LEFT PANEL — Hero style matching landing page ── */}
      <div style={{
        width: '50%',
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}>
        {/* Background image */}
        <img
          src="/hero-bg.jpg"
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            zIndex: 0,
          }}
        />

        {/* Dark overlay — matching landing page gradient */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(80,10,5,0.72) 0%, rgba(30,5,2,0.55) 40%, rgba(20,4,2,0.75) 70%, rgba(10,2,1,0.88) 100%)',
          zIndex: 1,
        }} />

        {/* Red tint vignette for brand consistency */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(135deg, rgba(139,26,16,0.35) 0%, transparent 60%)',
          zIndex: 2,
        }} />

        {/* Content */}
        <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', height: '100%', padding: '40px 52px' }}>

          {/* Logo — glassmorphic badge */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            borderRadius: '10px',
            padding: '8px 14px',
            alignSelf: 'flex-start',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
          }}>
            <img src="/logo.png" alt="Sotalbo Construction" style={{ height: '44px', width: 'auto', objectFit: 'contain' }} />
          </div>

          {/* Hero text — centered vertically */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginTop: '-32px' }}>

            {/* Tagline pill — matching landing page label style */}
            <div style={{
              display: 'inline-block',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: '20px',
              padding: '4px 14px',
              marginBottom: '20px',
              alignSelf: 'flex-start',
            }}>
              <span style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: '11px',
                fontWeight: 400,
                color: 'rgba(255,255,255,0.6)',
                letterSpacing: '1.8px',
                textTransform: 'uppercase',
              }}>
                Sotalbo Construction · BuildTrack
              </span>
            </div>

            {/* Big headline — matching hero-big-text scale */}
            <h1 style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: 'clamp(36px, 4vw, 58px)',
              fontWeight: 900,
              lineHeight: 1.05,
              letterSpacing: '-1.5px',
              margin: 0,
              marginBottom: '8px',
              textShadow: '0 4px 20px rgba(0,0,0,0.2)',
            }}>
              <span style={{ color: '#ffffff', display: 'block' }}>Manage projects.</span>
              <span style={{ color: '#ffffff', display: 'block' }}>Track expenses.</span>
              <span style={{ color: '#E8C547', display: 'block' }}>Build with</span>
              <span style={{ color: '#E8C547', display: 'block' }}>confidence.</span>
            </h1>

            {/* Italic tagline */}
            <p style={{
              marginTop: '28px',
              fontStyle: 'italic',
              fontSize: '13px',
              color: 'rgba(255,221,207,0.55)',
              letterSpacing: '0.3px',
            }}>
              — "Let's Build Your Blessings"
            </p>
          </div>


          {/* Copyright */}
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '16px', lineHeight: 1.6 }}>
            © 2026 Sotalbo Construction · BuildTrack. All rights reserved.
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div style={{
        flex: 1,
        minHeight: '100vh',
        background: '#F5F2EE',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 32px',
      }}>
        <div style={{ width: '100%', maxWidth: '420px' }}>
          <h2 style={{ fontSize: '30px', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px', letterSpacing: '-0.5px' }}>Welcome back.</h2>
          <p style={{ fontSize: '14px', color: '#888', marginBottom: '36px' }}>Sign in to your account.</p>

          <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} onSubmit={handleLogin}>

            {/* Email */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#333', letterSpacing: '0.1px' }}>Email / Username</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '16px', color: '#aaa', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </span>
                <input
                  type="text"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  style={{
                    width: '100%',
                    paddingLeft: '44px',
                    paddingRight: '16px',
                    paddingTop: '13px',
                    paddingBottom: '13px',
                    border: '1.5px solid #e0dbd5',
                    borderRadius: '50px',
                    fontSize: '14px',
                    background: '#fff',
                    color: '#222',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#A63228'; e.target.style.boxShadow = '0 0 0 3px rgba(166,50,40,0.1)' }}
                  onBlur={e => { e.target.style.borderColor = '#e0dbd5'; e.target.style.boxShadow = 'none' }}
                  placeholder="Enter your email or username"
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#333', letterSpacing: '0.1px' }}>Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <span style={{ position: 'absolute', left: '16px', color: '#aaa', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  style={{
                    width: '100%',
                    paddingLeft: '44px',
                    paddingRight: '44px',
                    paddingTop: '13px',
                    paddingBottom: '13px',
                    border: '1.5px solid #e0dbd5',
                    borderRadius: '50px',
                    fontSize: '14px',
                    background: '#fff',
                    color: '#222',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onFocus={e => { e.target.style.borderColor = '#A63228'; e.target.style.boxShadow = '0 0 0 3px rgba(166,50,40,0.1)' }}
                  onBlur={e => { e.target.style.borderColor = '#e0dbd5'; e.target.style.boxShadow = 'none' }}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  style={{ position: 'absolute', right: '16px', background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '-4px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#555', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  style={{ width: '15px', height: '15px', accentColor: '#A63228', cursor: 'pointer' }}
                />
                <span>Remember me</span>
              </label>
              <Link to="/forgot-password" style={{ fontSize: '13px', color: '#A63228', fontWeight: 500, textDecoration: 'none' }}>
                Forgot Password?
              </Link>
            </div>

            {error && <p style={{ fontSize: '13px', color: '#dc2626', marginTop: '-8px' }}>{error}</p>}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                marginTop: '4px',
                background: '#8B1A10',
                color: '#fff',
                border: 'none',
                borderRadius: '50px',
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '0.3px',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
                transition: 'background 0.2s, transform 0.1s',
              }}
              onMouseEnter={e => { if (!loading) e.target.style.background = '#A63228' }}
              onMouseLeave={e => { e.target.style.background = '#8B1A10' }}
              onMouseDown={e => { e.target.style.transform = 'scale(0.97)' }}
              onMouseUp={e => { e.target.style.transform = 'scale(1)' }}
            >
              {loading ? 'Signing in...' : 'Log in'}
            </button>
          </form>

          {/* Notice */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px',
            background: '#fce8e6',
            border: '1px solid rgba(166,50,40,0.2)',
            borderRadius: '12px',
            padding: '14px 16px',
            marginTop: '24px',
          }}>
            <span style={{ fontSize: '16px', flexShrink: 0, marginTop: '1px' }}>🛡️</span>
            <p style={{ fontSize: '12.5px', color: '#6b2020', lineHeight: 1.55, margin: 0 }}>
              <strong style={{ fontWeight: 700 }}>Authorized users only.</strong> Accounts are created and managed by
              your system administrator — there's no public sign-up.
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}