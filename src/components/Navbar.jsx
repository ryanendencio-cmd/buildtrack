import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

export default function Navbar() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className={`nav ${scrolled ? 'nav-scrolled' : ''}`}>
      <div className="nav-logo">
        <img
          src="/logo.png"
          alt="Sotalbo Construction"
          className="nav-logo-img"
        />
      </div>

      <div className="nav-pill">
        <a href="#" className="nav-pill-link active">Home</a>
        <a href="#about" className="nav-pill-link">About us</a>
        <a href="#services" className="nav-pill-link">Services</a>
        <a href="#project" className="nav-pill-link">Projects</a>
      </div>

      <div className="nav-right">
        <button className="btn-login" onClick={() => navigate('/login')}>
          Log In
        </button>
      </div>
    </nav>
  )
}
