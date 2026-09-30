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
      {/* Background image with overlay */}
      <div className="hero-bg">
        <img src="/hero-bg.jpg" alt="" className="hero-bg-img" />
        <div className="hero-bg-overlay"></div>
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
