import React from 'react'

const services = [
  { name: 'Pre-Construction', desc: 'Cost estimates, plans, technical documents.' },
  { name: 'General Construction', desc: 'Construction and project execution.' },
  { name: 'Renovation & Extension', desc: 'House renovation, extensions, fencing.' },
  { name: 'Fabrication & Fitouts', desc: 'Welding, fabrication, commercial fitouts.' },
  { name: 'Permit Assistance', desc: 'Building and occupancy permit support.' },
  { name: 'Post-Construction', desc: 'Warranty, activity and occupancy applications.' },
]

const values = ['Quality & Innovation', 'Client Satisfaction', 'Integrity', 'Safety']

export default function About() {
  return (
    <section className="section" id="about">
      <p className="section-label">— About The Company</p>
      <h2 className="section-title red">
        Built around the needs of<br />Sotalbo Construction.
      </h2>
      <p className="section-desc">
        BuildTrack is designed around the company's real construction operations, with a focus
        on better organization, visibility, and day-to-day control.
      </p>
      <div className="about-grid">
        <div className="about-company">
          <h3>Sotalbo Construction</h3>
          <p>
            Sotalbo Construction provides construction-related services including restoration,
            site preparation, new facilities, and facility renovation. The company works closely
            with clients to turn their vision into practical construction solutions.
          </p>
          <p className="about-meta"><strong>Tagline:</strong> "Let's Build Your Blessings"</p>
          <p className="about-meta"><strong>Founded:</strong> September 2020 by Engr. Aldrich J. Sotalbo.</p>
          <div className="values-grid">
            {values.map(v => <div key={v} className="value-tag">{v}</div>)}
          </div>
        </div>
        <div>
          <div className="services-title">Services</div>
          <div className="services-grid">
            {services.map(s => (
              <div key={s.name} className="service-tag">
                <div className="service-name">{s.name}</div>
                <div className="service-desc">{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
