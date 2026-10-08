import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

/* ─── Keyframe animations & class-based styles injected once ─── */
const STYLES = `
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(22px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes errorSlideIn {
    from { opacity: 0; transform: translateY(-8px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
  @keyframes heroPulse {
    0%, 100% { opacity: 0.18; }
    50%       { opacity: 0.28; }
  }
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }

  .login-btn {
    width: 100%;
    padding: 14px;
    margin-top: 4px;
    background: #8B1A10;
    color: #fff;
    border: none;
    border-radius: 50px;
    font-size: 15px;
    font-weight: 700;
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.3px;
    cursor: pointer;
    transition: background 0.22s, transform 0.12s, box-shadow 0.22s;
    position: relative;
    overflow: hidden;
  }
  .login-btn:hover:not(:disabled) {
    background: #A63228;
    box-shadow: 0 6px 24px rgba(139,26,16,0.45), 0 2px 8px rgba(139,26,16,0.3);
    transform: translateY(-1px);
  }
  .login-btn:active:not(:disabled) {
    transform: translateY(0) scale(0.97);
    box-shadow: 0 2px 8px rgba(139,26,16,0.3);
  }
  .login-btn:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }
  .login-btn.loading::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%);
    background-size: 400px 100%;
    animation: shimmer 1.2s infinite;
  }

  .login-input {
    width: 100%;
    padding: 13px 16px 13px 44px;
    border: 1.5px solid #e0dbd5;
    border-radius: 50px;
    font-size: 14px;
    font-family: 'Inter', sans-serif;
    background: #fff;
    color: #222;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
  }
  .login-input:focus {
    border-color: #A63228;
    box-shadow: 0 0 0 3.5px rgba(166,50,40,0.12);
    background: #fffaf9;
  }
  .login-input.pr-44 { padding-right: 44px; }

  .forgot-link {
    font-size: 13px;
    color: #A63228;
    font-weight: 500;
    text-decoration: none;
    transition: color 0.15s;
  }
  .forgot-link:hover { color: #8B1A10; text-decoration: underline; }

  .eye-btn { transition: color 0.15s; }
  .eye-btn:hover { color: #8B1A10 !important; }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .login-left-panel  { display: none !important; }
    .login-right-panel { width: 100% !important; }
    .login-form-card   { padding: 40px 24px !important; }
  }
  @media (max-width: 480px) {
    .login-form-card { padding: 32px 16px !important; }
  }
`

/* ─── Spinner icon ─── */
function Spinner() {
  return (
    <svg
      width="17" height="17" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="2.5"
      style={{ animation: 'spin 0.7s linear infinite', display: 'inline-block', verticalAlign: 'middle' }}
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}

/* ─── Decorative dot-grid for right panel ─── */
function DotGrid() {
  return (
    <svg
      width="260" height="260" viewBox="0 0 260 260"
      style={{ position: 'absolute', bottom: '-30px', right: '-30px', opacity: 0.07, pointerEvents: 'none', zIndex: 0 }}
      aria-hidden="true"
    >
      {Array.from({ length: 10 }).map((_, row) =>
        Array.from({ length: 10 }).map((_, col) => (
          <circle key={`${row}-${col}`} cx={col * 26 + 13} cy={row * 26 + 13} r="2.5" fill="#8B1A10" />
        ))
      )}
    </svg>
  )
}

/* ─── Decorative arc accent for right panel ─── */
function ArcAccent() {
  return (
    <svg
      width="300" height="300" viewBox="0 0 300 300"
      style={{ position: 'absolute', top: '-80px', left: '-80px', opacity: 0.045, pointerEvents: 'none', zIndex: 0 }}
      aria-hidden="true"
    >
      <circle cx="150" cy="150" r="130" stroke="#8B1A10" strokeWidth="40" fill="none" />
      <circle cx="150" cy="150" r="85"  stroke="#8B1A10" strokeWidth="20" fill="none" />
    </svg>
  )
}

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe,   setRememberMe]   = useState(false)
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [error,        setError]        = useState('')
  const [loading,      setLoading]      = useState(false)
  const [mounted,      setMounted]      = useState(false)
  const navigate = useNavigate()

  /* Trigger entrance animations after mount, setup remember me */
  useEffect(() => { 
    setMounted(true) 
    
    const savedEmail = localStorage.getItem('rememberedEmail')
    if (savedEmail) {
      setEmail(savedEmail)
      setRememberMe(true)
    }
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
      const res = await fetch(`${BASE_URL}/admin/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Invalid username or password.')
      } else {
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', email)
        } else {
          localStorage.removeItem('rememberedEmail')
        }
        localStorage.setItem('adminId', data.admin.id)
        localStorage.setItem('adminSession', JSON.stringify(data.admin))
        localStorage.setItem('adminToken', data.token)
        navigate('/dashboard')
      }
    } catch {
      setError('Cannot connect to server. Make sure it is running.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{STYLES}</style>

      <div style={{ display: 'flex', flexDirection: 'row', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>

        {/* ── LEFT PANEL — Hero ── */}
        <div
          className="login-left-panel"
          style={{
            width: '50%',
            minHeight: '100vh',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          {/* Local Cinematic Video Background */}
          <video
            autoPlay
            loop
            muted
            playsInline
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center', zIndex: 0,
              opacity: 0.85
            }}
          >
            <source src="/bg.mp4" type="video/mp4" />
          </video>

          {/* Dark overlay */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: 'linear-gradient(to bottom, rgba(80,10,5,0.72) 0%, rgba(30,5,2,0.55) 40%, rgba(20,4,2,0.75) 70%, rgba(10,2,1,0.88) 100%)',
          }} />

          {/* Red tint vignette */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 2,
            background: 'linear-gradient(135deg, rgba(139,26,16,0.35) 0%, transparent 60%)',
          }} />

          {/* Animated radial glow */}
          <div style={{
            position: 'absolute', top: '30%', left: '10%',
            width: '320px', height: '320px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,26,16,0.22) 0%, transparent 70%)',
            zIndex: 2,
            animation: 'heroPulse 4s ease-in-out infinite',
          }} />

          {/* Content */}
          <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', height: '100%', padding: '40px 52px' }}>

            {/* Logo badge */}
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              borderRadius: '10px', padding: '8px 14px',
              alignSelf: 'flex-start',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              animation: mounted ? 'fadeSlideUp 0.5s ease both' : 'none',
            }}>
              <img src="/logo.png" alt="Sotalbo Construction" style={{ height: '44px', width: 'auto', objectFit: 'contain' }} />
            </div>

            {/* Hero text */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginTop: '-32px' }}>

              {/* Tagline pill */}
              <div style={{
                display: 'inline-block',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '20px', padding: '4px 14px',
                marginBottom: '20px', alignSelf: 'flex-start',
                animation: mounted ? 'fadeSlideUp 0.55s 0.1s ease both' : 'none',
              }}>
                <span style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: '11px', fontWeight: 400,
                  color: 'rgba(255,255,255,0.6)',
                  letterSpacing: '1.8px', textTransform: 'uppercase',
                }}>
                  Sotalbo Construction · BuildTrack
                </span>
              </div>

              {/* Big headline */}
              <h1 style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 'clamp(36px, 4vw, 58px)',
                fontWeight: 900, lineHeight: 1.05,
                letterSpacing: '-1.5px', margin: 0, marginBottom: '8px',
                textShadow: '0 4px 20px rgba(0,0,0,0.2)',
                animation: mounted ? 'fadeSlideUp 0.6s 0.18s ease both' : 'none',
              }}>
                <span style={{ color: '#ffffff', display: 'block' }}>Manage projects.</span>
                <span style={{ color: '#ffffff', display: 'block' }}>Track expenses.</span>
                <span style={{ color: '#E8C547', display: 'block' }}>Build with</span>
                <span style={{ color: '#E8C547', display: 'block' }}>confidence.</span>
              </h1>

              {/* Italic tagline */}
              <p style={{
                marginTop: '28px', fontStyle: 'italic',
                fontSize: '13px', color: 'rgba(255,221,207,0.55)',
                letterSpacing: '0.3px',
                animation: mounted ? 'fadeSlideUp 0.6s 0.28s ease both' : 'none',
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
        <div
          className="login-right-panel"
          style={{
            flex: 1, minHeight: '100vh',
            background: '#F5F2EE',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '40px 32px',
            position: 'relative', overflow: 'hidden',
          }}
        >
          {/* Decorative accents */}
          <ArcAccent />
          <DotGrid />

          {/* Form card */}
          <div
            className="login-form-card"
            style={{
              width: '100%', maxWidth: '420px',
              position: 'relative', zIndex: 1,
              animation: mounted ? 'fadeSlideUp 0.65s 0.08s ease both' : 'none',
            }}
          >
            <h2 style={{ fontSize: '30px', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px', letterSpacing: '-0.5px' }}>
              Welcome back.
            </h2>
            <p style={{ fontSize: '14px', color: '#888', marginBottom: '36px' }}>Sign in to your account.</p>

            <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} onSubmit={handleLogin}>

              {/* Email */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#333', letterSpacing: '0.1px' }}>
                  Email / Username
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '16px', color: '#aaa', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    id="login-email"
                    type="text"
                    className="login-input"
                    value={email}
                    onChange={e => { setEmail(e.target.value); setError('') }}
                    placeholder="Enter your email or username"
                    autoComplete="username"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: '#333', letterSpacing: '0.1px' }}>
                  Password
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '16px', color: '#aaa', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    className="login-input pr-44"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    placeholder="Enter your password"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    className="eye-btn"
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
                    id="remember-me"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    style={{ width: '15px', height: '15px', accentColor: '#A63228', cursor: 'pointer' }}
                  />
                  <span>Remember me</span>
                </label>
                <Link to="/forgot-password" className="forgot-link">
                  Forgot Password?
                </Link>
              </div>

              {/* Error message — animated */}
              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  background: '#fff1f1', border: '1px solid #fca5a5',
                  borderRadius: '10px', padding: '10px 14px',
                  marginTop: '-4px',
                  animation: 'errorSlideIn 0.25s ease both',
                }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p style={{ fontSize: '13px', color: '#dc2626', margin: 0, lineHeight: 1.4 }}>{error}</p>
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                id="login-submit"
                className={`login-btn${loading ? ' loading' : ''}`}
                disabled={loading}
              >
                {loading
                  ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Spinner /> Signing in…</span>
                  : 'Log in'
                }
              </button>
            </form>

            {/* Notice */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: '10px',
              background: '#fce8e6',
              border: '1px solid rgba(166,50,40,0.2)',
              borderRadius: '12px', padding: '14px 16px',
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
    </>
  )
}