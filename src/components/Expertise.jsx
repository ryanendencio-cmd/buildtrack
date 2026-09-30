import React from 'react'

const services = [
  {
    name: 'Pre-Construction',
    desc: 'Cost estimates, plans, and technical documents to kick off every project right.',
  },
  {
    name: 'General Construction',
    desc: 'Full-scale construction and project execution from ground up to completion.',
  },
  {
    name: 'Renovation & Extension',
    desc: 'House renovations, building extensions, and fencing — old or new.',
  },
  {
    name: 'Fabrication & Fitouts',
    desc: 'Welding, fabrication, and commercial fitout services for any space.',
  },
]

export default function Expertise() {
  return (
    <section id="services" className="expertise-section">
      <span id="service" style={{ position: 'absolute', top: '-80px', visibility: 'hidden' }} />
      {/* Background */}
      <img src="/hero-bg.jpg" alt="" className="expertise-bg" />
      <div className="expertise-overlay" />

      {/* Content */}
      <div className="expertise-content">
        <p className="expertise-label">Our Expertise</p>
        <h2 className="expertise-heading">
          FROM CONCEPT TO COMPLETION,<br />WE BUILD YOUR BLESSINGS.
        </h2>

        <div className="expertise-grid">
          {services.map((s) => (
            <div key={s.name} className="expertise-card">
              <span className="expertise-icon">{s.icon}</span>
              <h3 className="expertise-card-title">{s.name}</h3>
              <p className="expertise-card-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
