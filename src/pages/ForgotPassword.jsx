import React, { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'

/* ─── Shared styles & animations ─── */
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
  @keyframes countdownShrink {
    from { width: 100%; }
    to   { width: 0%; }
  }

  .fp-btn {
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
  .fp-btn:hover:not(:disabled) {
    background: #A63228;
    box-shadow: 0 6px 24px rgba(139,26,16,0.45), 0 2px 8px rgba(139,26,16,0.3);
    transform: translateY(-1px);
  }
  .fp-btn:active:not(:disabled) {
    transform: translateY(0) scale(0.97);
    box-shadow: 0 2px 8px rgba(139,26,16,0.3);
  }
  .fp-btn:disabled { opacity: 0.65; cursor: not-allowed; }
  .fp-btn.loading::after {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.12) 50%, transparent 100%);
    background-size: 400px 100%;
    animation: shimmer 1.2s infinite;
  }

  .fp-input {
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
  .fp-input:focus {
    border-color: #A63228;
    box-shadow: 0 0 0 3.5px rgba(166,50,40,0.12);
    background: #fffaf9;
  }
  .fp-input:disabled {
    background: #f5f0ec;
    color: #aaa;
    cursor: not-allowed;
  }

  .back-link {
    color: #A63228;
    font-size: 13px;
    font-weight: 500;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    transition: color 0.15s, gap 0.15s;
  }
  .back-link:hover { color: #8B1A10; gap: 8px; }

  .resend-btn {
    background: none; border: none;
    color: #A63228; font-size: 12.5px;
    font-weight: 600; cursor: pointer; padding: 0;
    font-family: 'Inter', sans-serif;
    transition: color 0.15s;
  }
  .resend-btn:hover:not(:disabled) { color: #8B1A10; text-decoration: underline; }
  .resend-btn:disabled { color: #aaa; cursor: not-allowed; }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .fp-left-panel  { display: none !important; }
    .fp-right-panel { width: 100% !important; }
    .fp-form-card   { padding: 40px 24px !important; }
  }
  @media (max-width: 480px) {
    .fp-form-card { padding: 32px 16px !important; }
  }
`

/* ─── Spinner ─── */
function Spinner({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
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

const RESEND_COOLDOWN = 60 // seconds

export default function ForgotPassword() {
  const [email,     setEmail]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [sent,      setSent]      = useState(false)
  const [cooldown,  setCooldown]  = useState(0)
  const [mounted,   setMounted]   = useState(false)
  const timerRef = useRef(null)

  useEffect(() => { setMounted(true) }, [])

  /* Countdown ticker */
  useEffect(() => {
    if (cooldown <= 0) return
    timerRef.current = setInterval(() => {
      setCooldown(c => {
        if (c <= 1) { clearInterval(timerRef.current); return 0 }
        return c - 1
      })
    }, 1000)
    return () => clearInterval(timerRef.current)
  }, [cooldown])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email.trim()) { setError('Please enter your email or username.'); return }
    setLoading(true)
    setError('')
    try {
      const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
      const res  = await fetch(`${BASE_URL}/admin/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Please try again.')
      } else {
        setSent(true)
        setCooldown(RESEND_COOLDOWN)
      }
    } catch {
      setError('Cannot connect to server. Make sure it is running.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    if (cooldown > 0) return
    setLoading(true)
    setError('')
    try {
      const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
      await fetch(`${BASE_URL}/admin/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email }),
      })
      setCooldown(RESEND_COOLDOWN)
    } catch {
      setError('Failed to resend. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{STYLES}</style>

      <div style={{ display: 'flex', flexDirection: 'row', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>

        {/* ── LEFT PANEL ── */}
        <div className="fp-left-panel" style={{
          width: '50%', minHeight: '100vh',
          position: 'relative', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', flexShrink: 0,
        }}>
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
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: '11px', fontWeight: 400, color: 'rgba(255,255,255,0.6)', letterSpacing: '1.8px', textTransform: 'uppercase' }}>
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
        <div className="fp-right-panel" style={{
          flex: 1, minHeight: '100vh',
          background: '#F5F2EE',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '40px 32px',
          position: 'relative', overflow: 'hidden',
        }}>
          <ArcAccent />
          <DotGrid />

          <div className="fp-form-card" style={{
            width: '100%', maxWidth: '420px',
            position: 'relative', zIndex: 1,
            animation: mounted ? 'fadeSlideUp 0.65s 0.08s ease both' : 'none',
          }}>

            {/* ── SUCCESS STATE ── */}
            {sent ? (
              <div style={{ textAlign: 'center', animation: 'successPop 0.5s ease both' }}>

                {/* Email icon circle */}
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
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>

                <h2 style={{ fontSize: '26px', fontWeight: 700, color: '#1a1a1a', marginBottom: '10px', letterSpacing: '-0.4px' }}>
                  Check your inbox!
                </h2>
                <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.7, marginBottom: '28px' }}>
                  We sent a password reset link to<br />
                  <strong style={{ color: '#333' }}>{email}</strong>
                </p>

                {/* Info card */}
                <div style={{
                  background: '#fff', border: '1px solid #ede8e3',
                  borderRadius: '14px', padding: '16px 18px',
                  marginBottom: '28px', textAlign: 'left',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A63228" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}>
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <p style={{ fontSize: '12.5px', color: '#666', lineHeight: 1.6, margin: 0 }}>
                      The link expires in <strong style={{ color: '#333' }}>15 minutes</strong>. Check your spam folder if you don't see it.
                    </p>
                  </div>
                </div>

                {/* Resend section */}
                <div style={{ marginBottom: '24px' }}>
                  {cooldown > 0 ? (
                    <div>
                      <p style={{ fontSize: '13px', color: '#999', marginBottom: '8px' }}>
                        Resend available in <strong style={{ color: '#555' }}>{cooldown}s</strong>
                      </p>
                      {/* Progress bar */}
                      <div style={{ height: '3px', background: '#ede8e3', borderRadius: '99px', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%',
                          background: 'linear-gradient(90deg, #A63228, #E8C547)',
                          borderRadius: '99px',
                          width: `${(cooldown / RESEND_COOLDOWN) * 100}%`,
                          transition: 'width 1s linear',
                        }} />
                      </div>
                    </div>
                  ) : (
                    <p style={{ fontSize: '13px', color: '#777' }}>
                      Didn't receive it?{' '}
                      <button className="resend-btn" onClick={handleResend} disabled={loading}>
                        {loading ? 'Resending…' : 'Resend email'}
                      </button>
                    </p>
                  )}
                </div>

                <Link to="/login" className="back-link" style={{ justifyContent: 'center' }}>
                  ← Back to Login
                </Link>
              </div>

            ) : (
              /* ── FORM STATE ── */
              <>
                {/* Lock icon header */}
                <div style={{
                  width: '56px', height: '56px', borderRadius: '14px',
                  background: 'linear-gradient(135deg, #fce8e6 0%, #fdd8d4 100%)',
                  border: '1px solid rgba(166,50,40,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '20px',
                  boxShadow: '0 4px 14px rgba(139,26,16,0.12)',
                }}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#A63228" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>

                <h2 style={{ fontSize: '28px', fontWeight: 700, color: '#1a1a1a', marginBottom: '8px', letterSpacing: '-0.5px' }}>
                  Forgot password?
                </h2>
                <p style={{ fontSize: '14px', color: '#777', marginBottom: '32px', lineHeight: 1.65 }}>
                  No worries — enter your email or username and we'll send you a reset link.
                </p>

                <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} onSubmit={handleSubmit}>

                  {/* Email input */}
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
                        id="fp-email"
                        type="text"
                        className="fp-input"
                        value={email}
                        onChange={e => { setEmail(e.target.value); setError('') }}
                        placeholder="Enter your email or username"
                        autoComplete="username"
                        required
                      />
                    </div>
                  </div>

                  {/* Error message */}
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
                    id="fp-submit"
                    className={`fp-btn${loading ? ' loading' : ''}`}
                    disabled={loading}
                  >
                    {loading
                      ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}><Spinner /> Sending link…</span>
                      : 'Send Reset Link'
                    }
                  </button>

                  {/* Back to Login */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: '2px' }}>
                    <Link to="/login" className="back-link">
                      ← Back to Login
                    </Link>
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