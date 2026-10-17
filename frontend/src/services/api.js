const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
const API_URL = configuredApiUrl ? configuredApiUrl.replace(/\/+$/, '') : ''
const ACCESS_TOKEN_KEY = 'rundat-access-token'

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Gestisce has access token.
export function hasAccessToken() {
  return Boolean(window.localStorage.getItem(ACCESS_TOKEN_KEY))
}

// Gestisce save access token.
export function saveAccessToken(token) {
  window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
}

// Gestisce clear access token.
export function clearAccessToken() {
  window.localStorage.removeItem(ACCESS_TOKEN_KEY)
}

// Gestisce fetch json.
export async function fetchJson(path, options = {}) {
  const accessToken = window.localStorage.getItem(ACCESS_TOKEN_KEY)
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...options.headers,
    },
    ...options,
  })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(
      body?.detail ?? `Il server ha risposto con errore ${response.status}.`,
      response.status,
    )
  }
  return response.json()
}
