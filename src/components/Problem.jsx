import React from 'react'

const midCards = [
  {
    icon: '📋',
    title: 'Organized Records',
    desc: 'Replace scattered paper receipts with digital records accessible anytime — no more lost documents.',
  },
  {
    icon: '💰',
    title: 'Budget Visibility',
    desc: 'Track every expense in real-time so budget overruns are caught early, not at the end of the project.',
  },
]

export default function Problem() {
  return (
    <section className="whyus-section" id="features">
      {/* Top heading row */}
      <div className="whyus-top">
        <div className="whyus-heading-wrap">
          <p className="whyus-label">Why Choose Us</p>
          <h2 className="whyus-heading">
            STRATEGIC CLARITY IN<br />EVERY SQUARE FOOT.
          </h2>
        </div>
        <p className="whyus-desc">
          BuildTrack is a construction management system that helps businesses organize
          expenses, workers, receipts, equipment, and materials — all in one place.
          Our system brings structure to the most chaotic parts of construction operations.
        </p>
      </div>

      {/* 3-column grid */}
      <div className="whyus-grid">

        {/* Left photo */}
        <div className="whyus-photo-col">
          <img src="/hero-bg.jpg" alt="Before BuildTrack" className="whyus-photo" />
          <div className="whyus-photo-overlay" />
          <div className="whyus-photo-caption">
            <span className="whyus-caption-value">5 Problems Solved</span>
            <span className="whyus-caption-desc">
              From lost receipts to budget overruns — BuildTrack handles them all.
            </span>
          </div>
        </div>

        {/* Middle dark cards */}
        <div className="whyus-cards-col">
          {midCards.map((c) => (
            <div key={c.title} className="whyus-card">
              <span className="whyus-card-icon">{c.icon}</span>
              <h3 className="whyus-card-title">{c.title}</h3>
              <p className="whyus-card-desc">{c.desc}</p>
            </div>
          ))}
        </div>

        {/* Right photo */}
        <div className="whyus-photo-col">
          <img src="/hero-bg.jpg" alt="With BuildTrack" className="whyus-photo" />
          <div className="whyus-photo-overlay" />
          <div className="whyus-photo-caption">
            <span className="whyus-caption-value">6 Operations</span>
            <span className="whyus-caption-desc">
              Expenses, workers, receipts, equipment, materials — all in one system.
            </span>
          </div>
        </div>

      </div>
    </section>
  )
}
