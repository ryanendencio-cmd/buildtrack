import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'

export default function ResetPassword() {
  const { token } = useParams()
  const navigate = useNavigate()
  
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    
    setLoading(true)
    setError('')
    
    try {
      const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
      const res = await fetch(`${BASE_URL}/admin/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        setError(data.error || 'Failed to reset password.')
      } else {
        setSuccess(true)
        setTimeout(() => navigate('/login'), 3000)
      }
    } catch (err) {
      setError('Cannot connect to server.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F5F2EE', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '420px', padding: '40px', background: '#fff', borderRadius: '16px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <img src="/logo.png" alt="Logo" style={{ height: '50px', marginBottom: '20px' }} />
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: '#1a1a1a', margin: 0 }}>Set New Password</h2>
        </div>

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'green', fontSize: '18px', marginBottom: '10px' }}>✅ Password reset successful!</div>
            <p style={{ color: '#666' }}>Redirecting to login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#333' }}>New Password</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={e => { setNewPassword(e.target.value); setError('') }}
                style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}
                placeholder="Enter new password"
                required
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#333' }}>Confirm Password</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={e => { setConfirmPassword(e.target.value); setError('') }}
                style={{ padding: '12px 16px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '14px' }}
                placeholder="Confirm new password"
                required
              />
            </div>

            {error && (
              <div style={{ color: '#dc2626', fontSize: '13px', padding: '10px', background: '#fff1f1', borderRadius: '8px' }}>
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              style={{
                padding: '14px', background: '#8B1A10', color: '#fff', borderRadius: '8px',
                border: 'none', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1
              }}
            >
              {loading ? 'Saving...' : 'Save Password'}
            </button>
            
            <div style={{ textAlign: 'center', marginTop: '10px' }}>
              <Link to="/login" style={{ color: '#8B1A10', fontSize: '13px', textDecoration: 'none' }}>
                ← Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
