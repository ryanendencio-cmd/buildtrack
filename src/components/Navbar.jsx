import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function Navbar() {
  const navigate = useNavigate()

  return (
    <nav className="nav">
      <div className="nav-logo">
        <img
          src="/logo.png"
          alt="Sotalbo Construction"
          className="nav-logo-img"
        />
      </div>

      <div className="nav-links">
        <a href="#features">Features</a>
        <a href="#how">How It Works</a>
        <a href="#about">About</a>
      </div>
      <button className="btn-login" onClick={() => navigate('/login')}>Log In</button>
    </nav>
  )
}
