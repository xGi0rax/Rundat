import { useState } from 'react'

function AccessGate({ message, onSubmit }) {
  const [token, setToken] = useState('')

  const submit = (event) => {
    event.preventDefault()
    const value = token.trim()
    if (value) onSubmit(value)
  }

  return (
    <section className="status-panel access-panel">
      <span className="status-icon" aria-hidden="true">⌁</span>
      <h1>Accedi a Rundat</h1>
      <p>Inserisci il codice personale configurato su Vercel.</p>
      <form className="access-form" onSubmit={submit}>
        <label htmlFor="access-token">Codice di accesso</label>
        <input
          id="access-token"
          type="password"
          autoComplete="current-password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          required
          autoFocus
        />
        {message && <span className="access-error" role="alert">{message}</span>}
        <button type="submit" className="primary-button">Entra</button>
      </form>
    </section>
  )
}

export default AccessGate
