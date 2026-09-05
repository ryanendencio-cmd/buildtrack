import React from 'react'

const beforeItems = [
  'Lost paper receipts',
  'Manual expense tracking',
  'Untracked cash advances',
  'Missing or broken tools discovered late',
  'Budget overruns are harder to notice',
]

const afterItems = [
  'Digital receipt records',
  'Centralized project expenses',
  'Attendance and wage tracking',
  'Equipment status monitoring',
  'Daily budget visibility',
]

export default function Problem() {
  return (
    <section className="section" id="features">
      <p className="section-label">— The Problem</p>
      <h2 className="section-title red">
        Before and after BuildTrack
      </h2>
      <p className="section-desc">
        Replace scattered paper records and memory-based tracking with one organized digital system.
      </p>
      <div className="compare-grid">
        <div className="compare-card before">
          <h3>Before BuildTrack</h3>
          {beforeItems.map((item, i) => (
            <div className="compare-item" key={i}>
              <span className="icon">✕</span> {item}
            </div>
          ))}
        </div>
        <div className="compare-card after">
          <h3>With BuildTrack</h3>
          {afterItems.map((item, i) => (
            <div className="compare-item" key={i}>
              <span className="icon">✓</span> {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
