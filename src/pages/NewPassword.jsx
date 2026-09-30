import React, { useState } from 'react'
import { Link } from 'react-router-dom'
// Siguraduhing burado na ang line na ito: import './NewPassword.css'

export default function NewPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  return (
    <div className="flex flex-col md:flex-row min-h-screen font-sans">

      {/* ── LEFT PANEL ── */}
      <div className="w-full md:w-1/2 min-h-[auto] md:min-h-screen bg-gradient-to-br from-[#5a0f0a] via-[#8B1A10] to-[#A63228] flex flex-col px-8 py-9 md:px-12 md:py-10 relative overflow-hidden">
        <div className="inline-flex items-center bg-white rounded-lg px-3.5 py-2 mb-6 self-start">
          <img src="/logo.png" alt="Sotalbo Construction" className="h-11 md:h-12 w-auto object-contain" />
        </div>

        <div className="flex-1 flex flex-col items-start justify-center my-auto md:-translate-y-10">
          <p className="italic text-[11px] text-[#ffddcf]/60 tracking-[0.3px] mb-7">
            — "Let's Build Your Blessings"
          </p>
          <h1 className="text-[28px] md:text-[34px] lg:text-[45px] font-extrabold leading-[1.15] tracking-tight">
            <span className="text-white">Manage projects.<br />Track expenses.<br /></span>
            <span className="text-[#E8C547]">Build with<br />confidence.</span>
          </h1>
        </div>

        <p className="text-[11px] text-white/40 mt-auto leading-relaxed">
          © 2026 Sotalbo Construction · BuildTrack. All rights reserved.
        </p>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="flex-1 min-h-screen bg-[#F5F2EE] flex items-center justify-center px-4 py-8 md:px-8 md:py-10">
        <div className="w-full max-w-[420px]">
          <h2 className="text-[24px] md:text-[32px] font-extrabold text-[#1a1a1a] mb-3 tracking-tight">Reset password</h2>
          <p className="text-sm text-[#666] mb-10 leading-relaxed font-medium max-w-[90%]">
            Create a new password for your account.
          </p>

          <form className="flex flex-col gap-6" onSubmit={e => e.preventDefault()}>

            {/* New Password */}
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-[#333] tracking-[0.1px]">New Password</label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-[#aaa] flex items-center pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="w-full pl-11 pr-11 py-[13px] border-[1.5px] border-[#e0dbd5] rounded-full text-sm bg-white text-[#222] outline-none transition-all focus:border-[#A63228] focus:ring-[3px] focus:ring-[#A63228]/12 placeholder-[#bbb]"
                  placeholder="Enter new password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-4 text-[#aaa] hover:text-[#A63228] transition-colors focus:outline-none flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Confirm Password */}
            <div className="flex flex-col gap-2">
              <label className="text-[13px] font-semibold text-[#333] tracking-[0.1px]">Confirm Password</label>
              <div className="relative flex items-center">
                <span className="absolute left-4 text-[#aaa] flex items-center pointer-events-none">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </span>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="w-full pl-11 pr-11 py-[13px] border-[1.5px] border-[#e0dbd5] rounded-full text-sm bg-white text-[#222] outline-none transition-all focus:border-[#A63228] focus:ring-[3px] focus:ring-[#A63228]/12 placeholder-[#bbb]"
                  placeholder="Re-enter new password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute right-4 text-[#aaa] hover:text-[#A63228] transition-colors focus:outline-none flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  )}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            {password.length > 0 && (
              <div className="bg-[#ecd5d3] rounded-lg px-5 py-4 -mt-1">
                <p className="text-[11px] font-bold text-[#333] mb-3">Password must contain:</p>
                <div className="flex flex-col gap-2.5">
                  <div className={`flex items-center gap-2.5 text-[11px] transition-colors duration-300 ${password.length >= 8 ? 'text-[#1a1a1a]' : 'text-[#555]'}`}>
                    <span className={`w-3.5 h-3.5 rounded-full border border-[#A63228] flex items-center justify-center transition-all duration-300 ${password.length >= 8 ? 'bg-[#A63228]' : 'bg-transparent'}`}>
                      {password.length >= 8 && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </span>
                    8+ characters
                  </div>
                  <div className={`flex items-center gap-2.5 text-[11px] transition-colors duration-300 ${/[A-Z]/.test(password) ? 'text-[#1a1a1a]' : 'text-[#555]'}`}>
                    <span className={`w-3.5 h-3.5 rounded-full border border-[#A63228] flex items-center justify-center transition-all duration-300 ${/[A-Z]/.test(password) ? 'bg-[#A63228]' : 'bg-transparent'}`}>
                      {/[A-Z]/.test(password) && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </span>
                    1 uppercase letter
                  </div>
                  <div className={`flex items-center gap-2.5 text-[11px] transition-colors duration-300 ${/[0-9]/.test(password) ? 'text-[#1a1a1a]' : 'text-[#555]'}`}>
                    <span className={`w-3.5 h-3.5 rounded-full border border-[#A63228] flex items-center justify-center transition-all duration-300 ${/[0-9]/.test(password) ? 'bg-[#A63228]' : 'bg-transparent'}`}>
                      {/[0-9]/.test(password) && <svg className="w-2 h-2 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </span>
                    1 number
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-center mt-3">
              <Link to="/success" className="w-[220px] py-[15px] bg-[#A63228] text-white text-center rounded-full text-sm font-bold tracking-[0.5px] shadow-[0_4px_14px_rgba(166,50,40,0.2)] hover:bg-[#8B1A10] active:scale-95 transition-all">
                RESET PASSWORD
              </Link>
            </div>

            {/* Back to Login */}
            <div className="flex justify-center mt-2">
              <Link to="/login" className="flex items-center gap-1 text-[#c94038] text-[13px] font-medium hover:opacity-70 transition-opacity">
                ← Back to Login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}