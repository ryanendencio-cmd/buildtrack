import React from 'react'
import { Link } from 'react-router-dom'


export default function SuccessReset() {
  return (
    <div className="flex flex-col md:flex-row min-h-screen font-sans">

      {/* â”€â”€ LEFT PANEL â”€â”€ */}
      <div className="w-full md:w-1/2 min-h-[auto] md:min-h-screen bg-gradient-to-br from-[#5a0f0a] via-[#8B1A10] to-[#A63228] flex flex-col px-8 py-9 md:px-12 md:py-10 relative overflow-hidden">
        <div className="inline-flex items-center bg-white rounded-lg px-3.5 py-2 mb-6 self-start">
          <img src="/logo.png" alt="Sotalbo Construction" className="h-11 md:h-12 w-auto object-contain" />
        </div>

        <div className="flex-1 flex flex-col items-start justify-center my-auto md:-translate-y-10">
          <p className="italic text-[11px] text-[#ffddcf]/60 tracking-[0.3px] mb-7">
            â€” "Let's Build Your Blessings"
          </p>
          <h1 className="text-[28px] md:text-[34px] lg:text-[45px] font-extrabold leading-[1.15] tracking-tight">
            <span className="text-white">Manage projects.<br />Track expenses.<br /></span>
            <span className="text-[#E8C547]">Build with<br />confidence.</span>
          </h1>
        </div>

        <p className="text-[11px] text-white/40 mt-auto leading-relaxed">
          Â© 2026 Sotalbo Construction Â· BuildTrack. All rights reserved.
        </p>
      </div>

      {/* â”€â”€ RIGHT PANEL â”€â”€ */}
      <div className="flex-1 min-h-screen bg-[#F5F2EE] flex items-center justify-center px-4 py-8 md:px-8 md:py-10">
        <div className="w-full max-w-[420px] flex flex-col items-center text-center -mt-5">

          <div className="mb-6">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="32" fill="#A63228" />
              <path d="M19 32.5L27.5 41L45 23.5" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h2 className="text-[24px] md:text-[32px] font-extrabold text-[#1a1a1a] mb-3 tracking-tight">Password updated!</h2>
          <p className="text-sm text-[#666] leading-relaxed font-medium max-w-[320px]">
            Your password has been successfully changed. You can now log in using your new password.
          </p>

          {/* Submit Button */}
          <div className="flex justify-center mt-[30px] w-full">
            <Link to="/login" className="w-[220px] py-[15px] bg-[#A63228] text-white text-center rounded-full text-sm font-bold tracking-[0.5px] shadow-[0_4px_14px_rgba(166,50,40,0.2)] hover:bg-[#8B1A10] active:scale-95 transition-all">
              Go to Login
            </Link>
          </div>

        </div>
      </div>
    </div>
  )
}
