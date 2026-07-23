import { useCallback, useEffect, useState } from 'react'
import './App.css'
import Activities from './components/Activities.jsx'
import Analytics from './components/Analytics.jsx'
import Dashboard from './components/Dashboard.jsx'
import StatusPanel from './components/StatusPanel.jsx'

const API_URL = import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000'

function currentView() {
  if (window.location.hash === '#activities') return 'activities'
  if (window.location.hash === '#analytics') return 'analytics'
  return 'dashboard'
}

async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, options)
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
  const [syncState, setSyncState] = useState({ status: 'idle', message: '' })

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
      fetchJson('/api/dashboard', { signal: controller.signal }),
      fetchJson('/api/activities', { signal: controller.signal }),
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

  const syncGarmin = async () => {
    setSyncState({ status: 'loading', message: 'Sincronizzazione con Garmin in corso…' })
    try {
      const result = await fetchJson('/api/sync/garmin', { method: 'POST' })
      const [dashboard, activities] = await Promise.all([
        fetchJson('/api/dashboard'),
        fetchJson('/api/activities'),
      ])
      const changed = result.insertedCount + result.updatedCount
      const message = changed > 0
        ? `${result.insertedCount} nuove, ${result.updatedCount} aggiornate.`
        : 'Tutto aggiornato: nessuna nuova attività.'
      setData({ dashboard, activities })
      setSyncState({ status: 'success', message })
    } catch (reason) {
      setSyncState({
        status: 'error',
        message: reason.message || 'Non è stato possibile sincronizzare Garmin.',
      })
    }
  }

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
          <a href="#analytics" aria-current={view === 'analytics' ? 'page' : undefined}>
            Analisi
          </a>
        </nav>
      </header>

      <main id="main-content">
        {status === 'loading' && <StatusPanel type="loading" />}
        {status === 'error' && <StatusPanel type="error" message={error} onRetry={loadData} />}
        {status === 'success' && data.activities.length === 0 && <StatusPanel type="empty" />}
        {status === 'success' && data.activities.length > 0 && view === 'dashboard' && (
          <Dashboard
            summary={data.dashboard}
            activities={data.activities}
            syncState={syncState}
            onSync={syncGarmin}
          />
        )}
        {status === 'success' && data.activities.length > 0 && view === 'activities' && (
          <Activities activities={data.activities} />
        )}
        {status === 'success' && data.activities.length > 0 && view === 'analytics' && (
          <Analytics activities={data.activities} />
        )}
      </main>
    </div>
  )
}

export default App
