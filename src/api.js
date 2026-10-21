const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

function getHeaders(customHeaders = {}) {
  const headers = { 'Content-Type': 'application/json', ...customHeaders }
  try {
    const session = JSON.parse(sessionStorage.getItem('adminSession') || localStorage.getItem('adminSession') || '{}')
    const profile = JSON.parse(sessionStorage.getItem('adminProfile') || localStorage.getItem('adminProfile') || '{}')
    const token = sessionStorage.getItem('adminToken') || localStorage.getItem('adminToken')
    const name = profile.fullName || session.fullName || profile.name || session.name || session.username || 'Administrator'
    const role = session.role || 'Administrator'
    const id = session.id || sessionStorage.getItem('adminId') || localStorage.getItem('adminId') || ''

    if (name) headers['x-actor-name'] = name
    if (role) headers['x-actor-role'] = role
    if (id) headers['x-actor-id'] = String(id)
    if (token) headers['Authorization'] = `Bearer ${token}`
  } catch (e) {}
  return headers
}

async function request(path, options = {}) {
  const headers = getHeaders(options.headers || {})
  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`)
  }

  return body
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, {
    method: 'POST', body: JSON.stringify(body)
  }),
  put: (path, body) => request(path, {
    method: 'PUT', body: JSON.stringify(body)
  }),
  delete: (path) => request(path, { method: 'DELETE' }),
}
