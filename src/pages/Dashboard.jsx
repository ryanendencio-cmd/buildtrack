import React from 'react'
import AdminLayout from '../components/AdminLayout'
import './Dashboard.css'

export default function Dashboard() {
  return (
    <AdminLayout>
      
      {/* ── HEADER ── */}
      <div className="dash-header-wrap">
        <div>
          <span className="dash-tag">DASHBOARD</span>
          <h1 className="dash-title">Good morning, Engr. Aldrich.</h1>
          <p className="dash-subtitle">Here's an overview of your projects and expenses.</p>
        </div>
        <div className="dash-header-actions">
          <button className="btn-add-expense">+ Add Expense</button>
          <button className="btn-scan-receipt">Scan Receipt</button>
        </div>
      </div>

      {/* ── 4 TOP KPI CARDS ── */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <p className="kpi-label">ACTIVE PROJECTS</p>
          <h2 className="kpi-value">4</h2>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">TOTAL EXPENSES</p>
          <h2 className="kpi-value">₱595,300</h2>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">TOTAL MANPOWER</p>
          <h2 className="kpi-value">₱68,400</h2>
        </div>
        <div className="kpi-card equipment-card">
          <p className="kpi-label">EQUIPMENT</p>
          <div className="eq-cols">
            <div className="eq-col">
              <h3>12</h3>
              <span>Available</span>
            </div>
            <div className="eq-col">
              <h3>5</h3>
              <span>In Use</span>
            </div>
            <div className="eq-col">
              <h3>2</h3>
              <span>Maintenance</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── HERO BUDGET CARD ── */}
      <div className="budget-hero-card">
        <div className="budget-left">
          <div className="budget-header">
            <h3>Expense vs Budget</h3>
            <span className="budget-date">This Month · August 2026</span>
          </div>

          <div className="budget-stats">
            <div className="b-stat">
              <span>Budget</span>
              <strong>₱730,000</strong>
            </div>
            <div className="b-stat">
              <span>Actual Spending</span>
              <strong>₱595,300</strong>
            </div>
            <div className="b-stat">
              <span>Remaining</span>
              <strong>₱134,700</strong>
            </div>
          </div>

          <div className="progress-container">
            <div className="progress-track">
              <div className="progress-fill" style={{ width: '82%' }}></div>
            </div>
            <div className="progress-labels">
              <span><strong>82%</strong> of budget used</span>
              <a href="#" className="view-details">View Details</a>
            </div>
          </div>
        </div>

        <div className="budget-right">
          <h3>ACTUAL EXPENSES</h3>
          <div className="exp-breakdown">
            <div className="exp-item">
              <span className="exp-name">Materials</span>
              <div className="exp-bar"><div className="exp-fill" style={{ width: '80%' }}></div></div>
              <span className="exp-val">₱312,000</span>
            </div>
            <div className="exp-item">
              <span className="exp-name">Manpower</span>
              <div className="exp-bar"><div className="exp-fill" style={{ width: '60%' }}></div></div>
              <span className="exp-val">₱228,900</span>
            </div>
            <div className="exp-item">
              <span className="exp-name">Equipment</span>
              <div className="exp-bar"><div className="exp-fill" style={{ width: '30%' }}></div></div>
              <span className="exp-val">₱54,400</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── MIDDLE ROW: Projects & Expenses ── */}
      <div className="dash-row">
        {/* Active Projects Table */}
        <div className="dash-box flex-1">
          <div className="box-header">
            <h3>Active Projects</h3>
            <a href="#" className="box-link">View All →</a>
          </div>
          <table className="projects-table">
            <thead>
              <tr>
                <th>PROJECT</th>
                <th className="right-align">BUDGET</th>
                <th>PROGRESS</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>80 SQM Two Storey House</td>
                <td className="right-align">₱350,000</td>
                <td>
                  <div className="td-prog">
                    <div className="td-track"><div className="td-fill" style={{ width: '70%' }}></div></div>
                    <span>70%</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td>Barba Piggery</td>
                <td className="right-align">₱210,000</td>
                <td>
                  <div className="td-prog">
                    <div className="td-track"><div className="td-fill" style={{ width: '50%' }}></div></div>
                    <span>50%</span>
                  </div>
                </td>
              </tr>
              <tr>
                <td>Engr. Aquino Residence</td>
                <td className="right-align">₱170,000</td>
                <td>
                  <div className="td-prog">
                    <div className="td-track"><div className="td-fill" style={{ width: '30%' }}></div></div>
                    <span>30%</span>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Recent Expenses List */}
        <div className="dash-box flex-1">
          <div className="box-header">
            <h3>Recent Expenses</h3>
            <a href="#" className="box-link">See All</a>
          </div>
          <div className="recent-exp-list">
            <div className="recent-exp-item">
              <div className="exp-info">
                <h4>Materials</h4>
                <p>Today</p>
              </div>
              <strong className="exp-amount">₱12,500</strong>
            </div>
            <div className="recent-exp-item">
              <div className="exp-info">
                <h4>Manpower</h4>
                <p>Today</p>
              </div>
              <strong className="exp-amount">₱8,000</strong>
            </div>
            <div className="recent-exp-item">
              <div className="exp-info">
                <h4>Equipment Fuel</h4>
                <p>Yesterday</p>
              </div>
              <strong className="exp-amount">₱3,500</strong>
            </div>
            <p className="receipt-ref">Receipt #0042</p>
          </div>
        </div>
      </div>

      {/* ── BOTTOM ROW: Equipment & Workforce ── */}
      <div className="dash-row">
        {/* Equipment Status */}
        <div className="dash-box flex-1">
          <div className="box-header">
            <h3>Equipment Status</h3>
            <a href="#" className="box-link">View Assets →</a>
          </div>
          <div className="status-blocks">
            <div className="s-block">
              <h2>12</h2>
              <p>AVAILABLE</p>
            </div>
            <div className="s-block">
              <h2>5</h2>
              <p>IN USE</p>
            </div>
            <div className="s-block">
              <h2>2</h2>
              <p>MAINTENANCE</p>
            </div>
          </div>
          <div className="status-alert">
            2 tools haven't been returned today
          </div>
        </div>

        {/* Today's Workforce */}
        <div className="dash-box flex-1">
          <div className="box-header">
            <h3>Today's Workforce</h3>
            <a href="#" className="box-link">View Attendance →</a>
          </div>
          <div className="workforce-blocks">
            <div className="w-block present">
              <h2>19</h2>
              <p>PRESENT</p>
            </div>
            <div className="w-block absent">
              <h2>2</h2>
              <p>ABSENT</p>
            </div>
          </div>
          <div className="workforce-stats">
            <div className="w-stat">
              <span>Skilled Workers</span>
              <strong>10</strong>
            </div>
            <div className="w-stat">
              <span>General Laborers</span>
              <strong>9</strong>
            </div>
            <div className="w-stat total-payroll">
              <span>Today's Payroll</span>
              <strong>₱14,200</strong>
            </div>
          </div>
        </div>
      </div>

    </AdminLayout>
  )
}

