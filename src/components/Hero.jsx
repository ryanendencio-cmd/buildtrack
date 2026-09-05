import React from 'react'

export default function Hero() {
  const barHeights = [30, 50, 70, 90, 60, 80]
  const activeIndexes = [2, 3, 4, 5]

  return (
    <section className="hero-wrapper">
      {/* Main hero content */}
      <div className="hero">
        <div className="hero-left">
          <p className="hero-label">— Construction Management System</p>
          <h1>
            <span className="hero-white">Manage your projects.<br />Track every expense.<br /></span>
            <span className="hero-yellow">Build with<br />confidence.</span>
          </h1>
          <p className="hero-desc">
            BuildTrack is a construction management system that helps businesses organize
            expenses, workers, receipts, equipment, and materials — all in one place.
          </p>
          <div className="hero-btns">
            <button className="btn-primary">Get Started</button>
            <button className="btn-secondary">Learn More</button>
          </div>
        </div>

        <div className="hero-card">
          <div className="card-badge">✓ On budget</div>
          <div className="card-title">BUILDTRACK · SITE B1</div>
          <div className="card-budget">
            Total Project Budget
            <strong>₱500,000</strong>
          </div>
          <div className="card-stats">
            <div className="card-stat exp">
              <div className="stat-label">EXPENSES</div>
              <div className="stat-val">₱285,400</div>
            </div>
            <div className="card-stat rem">
              <div className="stat-label">REMAINING</div>
              <div className="stat-val">₱214,600</div>
            </div>
          </div>
          <div className="card-bars">
            {barHeights.map((h, i) => (
              <div
                key={i}
                className={`bar${activeIndexes.includes(i) ? ' active' : ''}`}
                style={{ height: `${h}%` }}
              />
            ))}
          </div>
          <div className="card-sync">Synced 2 min ago</div>
        </div>
      </div>

      {/* Stats row — inside the red wrapper so gradient blends */}
      <div className="stats-row">
        <div className="stat-item">
          <div className="num">₱285,400</div>
          <div className="label">Tracked this month</div>
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
