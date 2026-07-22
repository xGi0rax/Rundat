import { useCallback, useEffect, useState } from 'react'
import './App.css'
import Activities from './components/Activities.jsx'
import Dashboard from './components/Dashboard.jsx'
import StatusPanel from './components/StatusPanel.jsx'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

function currentView() {
  return window.location.hash === '#activities' ? 'activities' : 'dashboard'
}

async function fetchJson(path, signal) {
  const response = await fetch(`${API_URL}${path}`, { signal })
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(body?.detail ?? `Il server ha risposto con errore ${response.status}.`)
  }
  return response.json()
}

function App() {
  const [view, setView] = useState(currentView)
  const [data, setData] = useState({ dashboard: null, activities: [] })
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [requestId, setRequestId] = useState(0)

  const loadData = useCallback(() => {
    setStatus('loading')
    setError('')
    setRequestId((value) => value + 1)
  }, [])

  useEffect(() => {
    const handleHashChange = () => setView(currentView())
    window.addEventListener('hashchange', handleHashChange)
    if (!window.location.hash) window.history.replaceState(null, '', '#dashboard')
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      fetchJson('/api/dashboard', controller.signal),
      fetchJson('/api/activities', controller.signal),
    ])
      .then(([dashboard, activities]) => {
        setData({ dashboard, activities })
        setStatus('success')
      })
      .catch((reason) => {
        if (reason.name !== 'AbortError') {
          setError(reason.message || 'Non è stato possibile caricare i dati.')
          setStatus('error')
        }
      })

    return () => controller.abort()
  }, [requestId])

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#dashboard" aria-label="Rundat, vai alla dashboard">
          <img src="/logo.svg" alt="" />
          <span>Rundat</span>
        </a>
        <nav className="main-nav" aria-label="Navigazione principale">
          <a href="#dashboard" aria-current={view === 'dashboard' ? 'page' : undefined}>
            Dashboard
          </a>
          <a href="#activities" aria-current={view === 'activities' ? 'page' : undefined}>
            Attività
          </a>
        </nav>
      </header>

      <main id="main-content">
        {status === 'loading' && <StatusPanel type="loading" />}
        {status === 'error' && <StatusPanel type="error" message={error} onRetry={loadData} />}
        {status === 'success' && data.activities.length === 0 && <StatusPanel type="empty" />}
        {status === 'success' && data.activities.length > 0 && view === 'dashboard' && (
          <Dashboard summary={data.dashboard} activities={data.activities} />
        )}
        {status === 'success' && data.activities.length > 0 && view === 'activities' && (
          <Activities activities={data.activities} />
        )}
      </main>
    </div>
  )
}

export default App
