import React from 'react'
import { Link } from 'react-router-dom'
// Siguraduhing burado na ang line na ito: import './ForgotPassword.css'

export default function ForgotPassword() {
  return (
    <div style={{ display: 'flex', flexDirection: 'row', minHeight: '100vh', fontFamily: "'Inter', sans-serif" }}>

      {/* ── LEFT PANEL — Hero style matching login page ── */}
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

        {/* Dark overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(80,10,5,0.72) 0%, rgba(30,5,2,0.55) 40%, rgba(20,4,2,0.75) 70%, rgba(10,2,1,0.88) 100%)',
          zIndex: 1,
        }} />

        {/* Red tint vignette */}
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

          {/* Hero text */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', marginTop: '-32px' }}>

            {/* Tagline pill */}
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

            {/* Big headline */}
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
          <h2 style={{ fontSize: '30px', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px', letterSpacing: '-0.5px' }}>Forgot password?</h2>
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '36px', lineHeight: 1.6, fontWeight: 500, maxWidth: '90%' }}>
            No worries. Enter your email or username and we'll help you reset your password.
          </p>

          <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} onSubmit={e => e.preventDefault()}>

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
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="button" style={{ background: 'none', border: 'none', color: '#c94038', fontSize: '12px', fontWeight: 500, cursor: 'pointer', padding: 0 }}>
                  Resend Link
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '6px' }}>
              <Link
                to="/new-password"
                style={{
                  width: '220px',
                  padding: '15px',
                  background: '#A63228',
                  color: '#fff',
                  textAlign: 'center',
                  borderRadius: '50px',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '0.5px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 14px rgba(166,50,40,0.2)',
                  display: 'block',
                  transition: 'background 0.2s',
                }}
                onMouseEnter={e => { e.target.style.background = '#8B1A10' }}
                onMouseLeave={e => { e.target.style.background = '#A63228' }}
              >
                SEND RESET LINK
              </Link>
            </div>

            {/* Back to Login */}
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>
              <Link to="/login" style={{ color: '#c94038', fontSize: '13px', fontWeight: 500, textDecoration: 'none' }}>
                ← Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}