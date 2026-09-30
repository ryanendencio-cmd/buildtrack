const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

async function request(path, options) {
  const response = await fetch(`${BASE_URL}${path}`, options)
  const body = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(body.error || `Request failed (${response.status})`)
  }

  return body
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }),
  put: (path, body) => request(path, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }),
  delete: (path) => request(path, { method: 'DELETE' }),
}
