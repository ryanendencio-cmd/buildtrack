import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'

/* ─── Styles & animations ─── */
const STYLES = `
  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(22px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes errorSlideIn {
    from { opacity: 0; transform: translateY(-8px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes successPop {
    0%   { opacity: 0; transform: scale(0.88) translateY(16px); }
    70%  { transform: scale(1.03) translateY(-2px); }
    100% { opacity: 1; transform: scale(1) translateY(0); }
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
  @keyframes iconBounce {
    0%   { transform: scale(0); opacity: 0; }
    60%  { transform: scale(1.2); }
    100% { transform: scale(1); opacity: 1; }
  }
  @keyframes requirementsSlide {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .np-btn {
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
  .np-btn:hover:not(:disabled) {
    background: #A63228;
    box-shadow: 0 6px 24px rgba(139,26,16,0.45), 0 2px 8px rgba(139,26,16,0.3);
    transform: translateY(-1px);
  }
  .np-btn:active:not(:disabled) {
    transform: translateY(0) scale(0.97);
    box-shadow: 0 2px 8px rgba(139,26,16,0.3);
  }
  .np-btn:disabled { opacity: 0.65; cursor: not-allowed; }
  .np-btn.loading::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%);
    background-size: 400px 100%;
    animation: shimmer 1.2s infinite;
  }

  .np-input {
    width: 100%;
    padding: 13px 44px 13px 44px;
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
  .np-input:focus {
    border-color: #A63228;
    box-shadow: 0 0 0 3.5px rgba(166,50,40,0.12);
    background: #fffaf9;
  }
  .np-input.match  { border-color: #16a34a; box-shadow: 0 0 0 3px rgba(22,163,74,0.1); }
  .np-input.nomatch { border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.1); }

  .eye-btn { transition: color 0.15s; }
  .eye-btn:hover { color: #8B1A10 !important; }

  .back-link {
    color: #A63228; font-size: 13px; font-weight: 500;
    text-decoration: none; display: inline-flex;
    align-items: center; gap: 5px;
    transition: color 0.15s, gap 0.15s;
  }
  .back-link:hover { color: #8B1A10; gap: 8px; }

  .req-row { display: flex; align-items: center; gap: 10px; font-size: 12px; transition: color 0.2s; }
  .req-dot {
    width: 14px; height: 14px; border-radius: 50%;
    border: 1.5px solid #A63228;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.2s, transform 0.15s;
    flex-shrink: 0;
  }
  .req-dot.done { background: #A63228; transform: scale(1.1); }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .np-left-panel  { display: none !important; }
    .np-right-panel { width: 100% !important; }
    .np-form-card   { padding: 40px 24px !important; }
  }
  @media (max-width: 480px) {
    .np-form-card { padding: 32px 16px !important; }
  }
`

/* ─── Spinner ─── */
function Spinner() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.5"
      style={{ animation: 'spin 0.7s linear infinite', display: 'inline-block', verticalAlign: 'middle' }}>
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  )
}

/* ─── Dot-grid accent ─── */
function DotGrid() {
  return (
    <svg width="260" height="260" viewBox="0 0 260 260"
      style={{ position: 'absolute', bottom: '-30px', right: '-30px', opacity: 0.07, pointerEvents: 'none', zIndex: 0 }}
      aria-hidden="true">
      {Array.from({ length: 10 }).map((_, row) =>
        Array.from({ length: 10 }).map((_, col) => (
          <circle key={`${row}-${col}`} cx={col * 26 + 13} cy={row * 26 + 13} r="2.5" fill="#8B1A10" />
        ))
      )}
    </svg>
  )
}

/* ─── Arc accent ─── */
function ArcAccent() {
  return (
    <svg width="300" height="300" viewBox="0 0 300 300"
      style={{ position: 'absolute', top: '-80px', left: '-80px', opacity: 0.045, pointerEvents: 'none', zIndex: 0 }}
      aria-hidden="true">
      <circle cx="150" cy="150" r="130" stroke="#8B1A10" strokeWidth="40" fill="none" />
      <circle cx="150" cy="150" r="85"  stroke="#8B1A10" strokeWidth="20" fill="none" />
    </svg>
  )
}

/* ─── Password strength helpers ─── */
function getStrength(pw) {
  let score = 0
  if (pw.length >= 8)        score++
  if (/[A-Z]/.test(pw))     score++
  if (/[0-9]/.test(pw))     score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score // 0-4
}
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong']
const STRENGTH_COLORS = ['', '#dc2626', '#f59e0b', '#3b82f6', '#16a34a']

/* ─── Req row component ─── */
function ReqRow({ met, label }) {
  return (
    <div className="req-row" style={{ color: met ? '#1a1a1a' : '#888' }}>
      <div className={`req-dot${met ? ' done' : ''}`}>
        {met && (
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      {label}
    </div>
  )
}

export default function NewPassword() {
  const [password,        setPassword]        = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword,    setShowPassword]    = useState(false)
  const [showConfirm,     setShowConfirm]     = useState(false)
  const [loading,         setLoading]         = useState(false)
  const [error,           setError]           = useState('')
  const [success,         setSuccess]         = useState(false)
  const [mounted,         setMounted]         = useState(false)
  const navigate = useNavigate()

  useEffect(() => { setMounted(true) }, [])

  const strength      = getStrength(password)
  const hasLength     = password.length >= 8
  const hasUpper      = /[A-Z]/.test(password)
  const hasNumber     = /[0-9]/.test(password)
  const hasSpecial    = /[^A-Za-z0-9]/.test(password)
  const passwordsMatch = password === confirmPassword && confirmPassword.length > 0
  const passwordsMismatch = confirmPassword.length > 0 && password !== confirmPassword
  const canSubmit     = hasLength && hasUpper && hasNumber && passwordsMatch && !loading

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) {
      if (!hasLength || !hasUpper || !hasNumber) {
        setError('Password does not meet the requirements.')
      } else if (!passwordsMatch) {
        setError('Passwords do not match.')
      }
      return
    }
    setLoading(true)
    setError('')
    try {
      const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
      const res  = await fetch(`${BASE_URL}/admin/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
      } else {
        setSuccess(true)
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

        {/* ── LEFT PANEL ── */}
        <div className="np-left-panel" style={{
          width: '50%', minHeight: '100vh',
          position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
        }}>
          <img src="/hero-bg.jpg" alt="" style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'cover', objectPosition: 'center', zIndex: 0,
          }} />
          <div style={{
            position: 'absolute', inset: 0, zIndex: 1,
            background: 'linear-gradient(to bottom, rgba(80,10,5,0.72) 0%, rgba(30,5,2,0.55) 40%, rgba(20,4,2,0.75) 70%, rgba(10,2,1,0.88) 100%)',
          }} />
          <div style={{
            position: 'absolute', inset: 0, zIndex: 2,
            background: 'linear-gradient(135deg, rgba(139,26,16,0.35) 0%, transparent 60%)',
          }} />
          {/* Animated glow */}
          <div style={{
            position: 'absolute', top: '30%', left: '10%',
            width: '320px', height: '320px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(139,26,16,0.22) 0%, transparent 70%)',
            zIndex: 2, animation: 'heroPulse 4s ease-in-out infinite',
          }} />

          <div style={{ position: 'relative', zIndex: 3, display: 'flex', flexDirection: 'column', height: '100%', padding: '40px 52px' }}>
            {/* Logo */}
            <div style={{
              display: 'inline-flex', alignItems: 'center',
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              borderRadius: '10px', padding: '8px 14px', alignSelf: 'flex-start',
              boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
              animation: mounted ? 'fadeSlideUp 0.5s ease both' : 'none',
            }}>
              <img src="/logo.png" alt="Sotalbo Construction" style={{ height: '44px', width: 'auto', objectFit: 'contain' }} />
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginTop: '-32px' }}>
              <div style={{
                display: 'inline-block', border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '20px', padding: '4px 14px',
                marginBottom: '20px', alignSelf: 'flex-start',
                animation: mounted ? 'fadeSlideUp 0.55s 0.1s ease both' : 'none',
              }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '11px', color: 'rgba(255,255,255,0.6)', letterSpacing: '1.8px', textTransform: 'uppercase' }}>
                  Sotalbo Construction · BuildTrack
                </span>
              </div>

              <h1 style={{
                fontFamily: "'Inter', sans-serif",
                fontSize: 'clamp(36px, 4vw, 58px)', fontWeight: 900,
                lineHeight: 1.05, letterSpacing: '-1.5px',
                margin: 0, marginBottom: '8px',
                textShadow: '0 4px 20px rgba(0,0,0,0.2)',
                animation: mounted ? 'fadeSlideUp 0.6s 0.18s ease both' : 'none',
              }}>
                <span style={{ color: '#ffffff', display: 'block' }}>Manage projects.</span>
                <span style={{ color: '#ffffff', display: 'block' }}>Track expenses.</span>
                <span style={{ color: '#E8C547', display: 'block' }}>Build with</span>
                <span style={{ color: '#E8C547', display: 'block' }}>confidence.</span>
              </h1>

              <p style={{ marginTop: '28px', fontStyle: 'italic', fontSize: '13px', color: 'rgba(255,221,207,0.55)', letterSpacing: '0.3px', animation: mounted ? 'fadeSlideUp 0.6s 0.28s ease both' : 'none' }}>
                — "Let's Build Your Blessings"
              </p>
            </div>

            <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: '16px', lineHeight: 1.6 }}>
              © 2026 Sotalbo Construction · BuildTrack. All rights reserved.
            </p>
          </div>
        </div>

        {/* ── RIGHT PANEL ── */}
        <div className="np-right-panel" style={{
          flex: 1, minHeight: '100vh',
          background: '#F5F2EE',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '40px 32px',
          position: 'relative', overflow: 'hidden',
        }}>
          <ArcAccent />
          <DotGrid />

          <div className="np-form-card" style={{
            width: '100%', maxWidth: '420px',
            position: 'relative', zIndex: 1,
            animation: mounted ? 'fadeSlideUp 0.65s 0.08s ease both' : 'none',
          }}>

            {/* ── SUCCESS STATE ── */}
            {success ? (
              <div style={{ textAlign: 'center', animation: 'successPop 0.5s ease both' }}>
                {/* Shield icon */}
                <div style={{
                  width: '80px', height: '80px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #fce8e6 0%, #fdd8d4 100%)',
                  border: '2px solid rgba(166,50,40,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto 24px',
                  animation: 'iconBounce 0.5s 0.15s ease both',
                  boxShadow: '0 8px 24px rgba(139,26,16,0.15)',
                }}>
                  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#A63228" strokeWidth="1.8">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9,12 11,14 15,10" />
                  </svg>
                </div>

                <h2 style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a1a', marginBottom: '10px', letterSpacing: '-0.4px' }}>
                  Password reset!
                </h2>
                <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.7, marginBottom: '32px' }}>
                  Your password has been updated successfully.<br />
                  You can now log in with your new password.
                </p>

                <button
                  className="np-btn"
                  onClick={() => navigate('/login')}
                  style={{ marginBottom: '0' }}
                >
                  Back to Login
                </button>
              </div>

            ) : (
              /* ── FORM STATE ── */
              <>
                {/* Shield icon header */}
                <div style={{
                  width: '56px', height: '56px', borderRadius: '14px',
                  background: 'linear-gradient(135deg, #fce8e6 0%, #fdd8d4 100%)',
                  border: '1px solid rgba(166,50,40,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '20px',
                  boxShadow: '0 4px 14px rgba(139,26,16,0.12)',
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#A63228" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>

                <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a1a', marginBottom: '8px', letterSpacing: '-0.5px' }}>
                  Reset password
                </h2>
                <p style={{ fontSize: '14px', color: '#777', marginBottom: '32px', lineHeight: 1.65 }}>
                  Create a strong new password for your account.
                </p>

                <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} onSubmit={handleSubmit}>

                  {/* New Password */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#333' }}>New Password</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: '16px', color: '#aaa', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </span>
                      <input
                        id="np-password"
                        type={showPassword ? 'text' : 'password'}
                        className="np-input"
                        value={password}
                        onChange={e => { setPassword(e.target.value); setError('') }}
                        placeholder="Enter new password"
                        required
                      />
                      <button type="button" className="eye-btn"
                        style={{ position: 'absolute', right: '16px', background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                        onClick={() => setShowPassword(!showPassword)}
                        aria-label="Toggle password visibility">
                        {showPassword
                          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        }
                      </button>
                    </div>

                    {/* Strength bar */}
                    {password.length > 0 && (
                      <div style={{ animation: 'requirementsSlide 0.2s ease both' }}>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
                          {[1, 2, 3, 4].map(i => (
                            <div key={i} style={{
                              flex: 1, height: '3px', borderRadius: '99px',
                              background: i <= strength ? STRENGTH_COLORS[strength] : '#e0dbd5',
                              transition: 'background 0.3s',
                            }} />
                          ))}
                        </div>
                        <p style={{ fontSize: '11.5px', color: STRENGTH_COLORS[strength] || '#aaa', fontWeight: 600, margin: 0 }}>
                          {STRENGTH_LABELS[strength] || 'Too weak'}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 600, color: '#333' }}>Confirm Password</label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <span style={{ position: 'absolute', left: '16px', color: '#aaa', display: 'flex', alignItems: 'center', pointerEvents: 'none' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </span>
                      <input
                        id="np-confirm"
                        type={showConfirm ? 'text' : 'password'}
                        className={`np-input${passwordsMatch ? ' match' : passwordsMismatch ? ' nomatch' : ''}`}
                        value={confirmPassword}
                        onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                        placeholder="Re-enter new password"
                        required
                      />
                      <button type="button" className="eye-btn"
                        style={{ position: 'absolute', right: '16px', background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                        onClick={() => setShowConfirm(!showConfirm)}
                        aria-label="Toggle confirm password visibility">
                        {showConfirm
                          ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                          : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                        }
                      </button>
                    </div>
                    {/* Match indicator */}
                    {confirmPassword.length > 0 && (
                      <p style={{ fontSize: '12px', margin: 0, color: passwordsMatch ? '#16a34a' : '#dc2626', fontWeight: 500, animation: 'requirementsSlide 0.2s ease both', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        {passwordsMatch
                          ? <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg> Passwords match</>
                          : <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg> Passwords don't match</>
                        }
                      </p>
                    )}
                  </div>

                  {/* Requirements card */}
                  {password.length > 0 && (
                    <div style={{
                      background: '#fff', border: '1px solid #ede8e3',
                      borderRadius: '14px', padding: '16px 18px',
                      display: 'flex', flexDirection: 'column', gap: '10px',
                      marginTop: '-4px',
                      boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                      animation: 'requirementsSlide 0.25s ease both',
                    }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: '#333', margin: 0 }}>Password requirements:</p>
                      <ReqRow met={hasLength}  label="At least 8 characters" />
                      <ReqRow met={hasUpper}   label="One uppercase letter (A-Z)" />
                      <ReqRow met={hasNumber}  label="One number (0-9)" />
                      <ReqRow met={hasSpecial} label="One special character (!@#…)" />
                    </div>
                  )}

                  {/* Error */}
                  {error && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      background: '#fff1f1', border: '1px solid #fca5a5',
                      borderRadius: '10px', padding: '10px 14px',
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
                    id="np-submit"
                    className={`np-btn${loading ? ' loading' : ''}`}
                    disabled={!canSubmit}
                  >
                    {loading
                      ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Spinner /> Resetting password…</span>
                      : 'Reset Password'
                    }
                  </button>

                  {/* Back to Login */}
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <Link to="/login" className="back-link">← Back to Login</Link>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>

      </div>
    </>
  )
}