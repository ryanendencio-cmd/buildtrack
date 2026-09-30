import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function Footer() {
  const navigate = useNavigate()

  return (
    <footer className="site-footer">
      {/* Background */}
      <img src="/hero-bg.jpg" alt="" className="footer-bg" />
      <div className="footer-bg-overlay" />

      {/* CTA Top */}
      <div className="footer-cta">
        <div className="footer-cta-left">
          <span className="footer-cta-label">Get started</span>
          <h2 className="footer-cta-heading">
            READY TO BUILD<br />SMARTER?
          </h2>
          <p className="footer-cta-sub">
            Bring your construction operations into one organized system.
            Admin access starts from the BuildTrack login.
          </p>
        </div>
      </div>

      {/* Footer columns */}
      <div className="footer-columns">
        <div className="footer-brand-col">
          <div className="footer-brand-name">BUILDTRACK</div>
          <p className="footer-brand-desc">
            Construction management system for organized project expenses,
            manpower, receipts, equipment, and materials.
          </p>
        </div>

        <div className="footer-col">
          <h4>NAVIGATE</h4>
          <a href="#">Home</a>
          <a href="#about">About us</a>
          <a href="#services">Services</a>
          <a href="#project">Projects</a>
        </div>

        <div className="footer-col">
          <h4>PRODUCT</h4>
          <a href="#features">Features</a>
          <a href="#how">How it Works</a>
          <a onClick={() => navigate('/login')} href="#">Login</a>
        </div>

        <div className="footer-col">
          <h4>CONTACT US</h4>
          <a href="#">📞 +63 912 345 6789</a>
          <a href="#">✉ info@sotalbo.com</a>
          <a href="#">📍 Sotalbo Construction</a>
        </div>
      </div>

      {/* Watermark */}
      <div className="footer-watermark">BUILDTRACK</div>

      {/* Bottom bar */}
      <div className="footer-bottom-bar">
        <p>© 2026 BuildTrack. All rights reserved.</p>
        <div className="footer-socials">
          <span>Instagram</span>
          <span>Facebook</span>
          <span>Twitter</span>
        </div>
        <p>Sotalbo Construction</p>
      </div>
    </footer>
  )
}
