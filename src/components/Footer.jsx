import React from 'react'

export default function Footer() {
  return (
    <footer>
      <div className="footer-top">
        <div className="footer-brand">
          <div className="footer-brand-name">BUILDTRACK</div>
          <p>Construction management system for organized project expenses, manpower, receipts, equipment, and materials.</p>
        </div>
        <div className="footer-links">
          <div className="footer-col">
            <h4>Product</h4>
            <a href="#features">Features</a>
            <a href="#how">How it Works</a>
            <a href="#">Login</a>
          </div>
          <div className="footer-col">
            <h4>Company</h4>
            <a href="#about">About</a>
            <a href="#">Services</a>
            <a href="#">Back to Top</a>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <p>© 2026 BuildTrack. All rights reserved.</p>
        <p>Sotalbo Construction</p>
      </div>
    </footer>
  )
}
