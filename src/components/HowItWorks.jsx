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
    <section className="section cream2" id="how">
      <p className="section-label">— How It Works</p>
      <h2 className="section-title red underlined">
        From site activity to clear<br />admin decisions.
      </h2>
      <p className="section-desc">
        Staff can record information on-site while the admin gets a clearer view of project operations.
      </p>
      <div className="steps-grid">
        {steps.map((step) => (
          <div key={step.num}>
            <div className="step-num">{step.num}</div>
            <div className="step-title">{step.title}</div>
            <div className="step-desc">{step.desc}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
