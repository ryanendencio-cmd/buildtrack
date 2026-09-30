import React from 'react'

const steps = [
  {
    num: '01',
    title: 'Staff input',
    desc: 'Attendance, expenses, receipts, materials, and equipment updates are recorded on mobile.',
  },
  {
    num: '02',
    title: 'Data captured',
    desc: 'Receipt photos and operational records are stored digitally instead of relying on paper.',
  },
  {
    num: '03',
    title: 'System sync',
    desc: 'Site information becomes available to authorized personnel through the central system.',
  },
  {
    num: '04',
    title: 'Admin monitors',
    desc: 'The admin reviews expenses, budgets, workforce activity, and assets from the web portal.',
  },
]

export default function HowItWorks() {
  return (
    <section className="process-section" id="project">
      <span id="projects" style={{ position: 'absolute', top: '-80px', visibility: 'hidden' }} />
      <span id="how" style={{ position: 'absolute', top: '-80px', visibility: 'hidden' }} />
      <div className="process-left">
        <p className="process-label">Our Process</p>
        <h2 className="process-heading">
          EXPLORE THE STRATEGIC WAY OUR PROCESS IS DONE.
        </h2>
        <div className="process-img-wrap">
          <img src="/hero-bg.jpg" alt="Team planning a construction project" className="process-img" />
        </div>
      </div>

      <div className="process-right">
        <p className="process-intro">
          Staff can record information on-site while the admin gets a clearer view
          of project operations — ensuring transparency and accountability at every stage.
        </p>
        <div className="process-steps">
          {steps.map((step) => (
            <div key={step.num} className="process-step">
              <div className="process-step-left">
                <span className="process-step-num">Step {step.num}</span>
                <h3 className="process-step-title">{step.title}</h3>
              </div>
              <p className="process-step-desc">{step.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
