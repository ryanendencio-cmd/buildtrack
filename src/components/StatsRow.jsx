import React from 'react'

export default function StatsRow() {
  return (
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
  )
}
