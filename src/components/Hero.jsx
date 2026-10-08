import React, { useState, useEffect } from 'react'
import { api } from '../api'

export default function Hero() {
  const barHeights = [30, 50, 70, 90, 60, 80]
  const activeIndexes = [2, 3, 4, 5]

  const [budget, setBudget] = useState({ totalBudget: 0, totalSpent: 0, remaining: 0 });
  const [kpi, setKpi] = useState({ totalExpenses: 0 });

  useEffect(() => {
    api.get('/expenses/budget-summary')
      .then(data => setBudget(data))
      .catch(err => console.error("Error fetching budget:", err));

    api.get('/expenses/summary')
      .then(data => setKpi({ totalExpenses: data.total || 0 }))
      .catch(err => console.error("Error fetching summary:", err));
  }, []);

  return (
    <section className="hero-wrapper">
      <style>{`
        @keyframes heroPulseLanding {
          0%, 100% { opacity: 0.18; }
          50%       { opacity: 0.28; }
        }
      `}</style>

      {/* Background video with overlay */}
      <div className="hero-bg">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="hero-bg-img"
          style={{ objectFit: 'cover', zIndex: 0 }}
        >
          <source src="/landing-bg.mp4" type="video/mp4" />
        </video>

        {/* Dark overlay (made more neutral to let video shine) */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(to bottom, rgba(10,10,10,0.65) 0%, rgba(10,10,10,0.4) 40%, rgba(10,10,10,0.7) 70%, rgba(10,10,10,0.9) 100%)',
        }} />

        {/* Subtle red tint vignette (toned down) */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2,
          background: 'linear-gradient(135deg, rgba(139,26,16,0.15) 0%, transparent 50%)',
        }} />

        {/* Animated radial glow (toned down) */}
        <div style={{
          position: 'absolute', top: '30%', left: '10%',
          width: '320px', height: '320px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,26,16,0.12) 0%, transparent 70%)',
          zIndex: 2,
          animation: 'heroPulseLanding 4s ease-in-out infinite',
        }} />
      </div>

      {/* Main hero content */}
      <div className="hero">
        <div className="hero-left">
          <p className="hero-label">
            SOTALBO CONSTRUCTION PROVIDES PREMIER CONSTRUCTION<br />
            AND INFRASTRUCTURE SOLUTIONS FOR MODERN ENTERPRISES<br />
            AND BIG VISIONS.
          </p>
          <h3 className="hero-big-text">
            BUILT<br />TOGETHER
          </h3>
        </div>

      </div>

      {/* Stats row */}
      <div className="stats-row">
        <div className="stat-item">
          <div className="num">₱{Number(kpi.totalExpenses).toLocaleString()}</div>
          <div className="label">Total Expenses Tracked</div>
        </div>
        <div className="stat-item">
          <div className="num">6</div>
          <div className="label">Operations in one system</div>
        </div>
        <div className="stat-item">
          <div className="num">24/7</div>
          <div className="label">Site-to-office sync</div>
        </div>
      </div>
    </section>
  )
}
