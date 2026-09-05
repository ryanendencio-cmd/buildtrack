import React from 'react'

const features = [
  ['Daily expense dashboard', 'Attendance & payroll tracking'],
  ['Equipment inventory', 'Material consumption logs'],
  ['Digital receipt scanner', 'Monthly expense reports'],
]

const dashBars = [
  { cls: 'c1', h: '40%' }, { cls: 'c2', h: '55%' }, { cls: 'c3', h: '60%' },
  { cls: 'c4', h: '70%' }, { cls: 'c5', h: '85%' }, { cls: 'c6', h: '100%' },
]

export default function DailyOps() {
  return (
    <section className="daily-section">
      <div className="daily-wrap">
        <div style={{ flex: 1 }}>
          <p className="daily-label">— Daily Operations</p>
          <h2 className="daily-title">Everything you need to<br />manage your project.</h2>
          <p className="daily-desc">
            BuildTrack brings the most important daily construction records into one organized workspace.
          </p>
          <div className="features-grid">
            {features.map(([left, right], i) => (
              <React.Fragment key={i}>
                <div className="feature-item"><span className="check">✓</span> {left}</div>
                <div className="feature-item"><span className="check">✓</span> {right}</div>
              </React.Fragment>
            ))}
          </div>
        </div>
        <div className="dashboard-card">
          <div className="dash-title">Dashboard Preview</div>
          <div className="dash-sub">Expense Overview</div>
          <div className="dash-bars">
            {dashBars.map((b, i) => (
              <div key={i} className={`dash-bar ${b.cls}`} style={{ height: b.h }} />
            ))}
          </div>
          <div className="dash-labels">
            {['W1','W2','W3','W4','W5','W6'].map(w => <span key={w}>{w}</span>)}
          </div>
        </div>
      </div>
    </section>
  )
}
