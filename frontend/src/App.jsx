import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import './App.css'
import StatusPanel from './components/StatusPanel.jsx'
import { fetchJson } from './services/api.js'

const Activities = lazy(() => import('./components/Activities.jsx'))
const Analytics = lazy(() => import('./components/Analytics.jsx'))
const Dashboard = lazy(() => import('./components/Dashboard.jsx'))
const Profile = lazy(() => import('./components/Profile.jsx'))
const Trends = lazy(() => import('./components/Trends.jsx'))

function currentView() {
  if (window.location.hash === '#activities') return 'activities'
  if (window.location.hash === '#analytics') return 'analytics'
  if (window.location.hash === '#trends') return 'trends'
  if (window.location.hash === '#profilo' || window.location.hash === '#profile') return 'profile'
  return 'dashboard'
}

function App() {
  const [view, setView] = useState(currentView)
  const [data, setData] = useState({ dashboard: null, activities: [], recordHistory: null })
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

    fetchJson('/api/activities', { signal: controller.signal })
      .then((activities) => {
        setData((current) => ({ ...current, activities }))
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

  useEffect(() => {
    if (status !== 'success') return undefined
    const controller = new AbortController()

    if (view === 'profile' && data.dashboard == null) {
      fetchJson('/api/dashboard', { signal: controller.signal })
        .then((dashboard) => setData((current) => ({ ...current, dashboard })))
        .catch((reason) => {
          if (reason.name !== 'AbortError') {
            setError(reason.message)
            setStatus('error')
          }
        })
    }
    if (view === 'trends' && data.recordHistory == null) {
      fetchJson('/api/pbs/history', { signal: controller.signal })
        .then((recordHistory) => setData((current) => ({ ...current, recordHistory })))
        .catch((reason) => {
          if (reason.name !== 'AbortError') {
            setError(reason.message)
            setStatus('error')
          }
        })
    }
    return () => controller.abort()
  }, [data.dashboard, data.recordHistory, status, view])

  const syncGarmin = async () => {
    setSyncState({ status: 'loading', message: 'Sincronizzazione con Garmin in corso…' })
    try {
      const result = await fetchJson('/api/sync/garmin', { method: 'POST' })
      const activities = await fetchJson('/api/activities')
      const changed = result.insertedCount + result.updatedCount
      const zonesMessage = result.hrZoneCount > 0
        ? ` Zone cardio aggiunte a ${result.hrZoneCount} attività.`
        : ''
      const message = changed > 0
        ? `${result.insertedCount} nuove, ${result.updatedCount} aggiornate.${zonesMessage}`
        : zonesMessage || 'Tutto aggiornato: nessuna nuova attività o zona cardio.'
      setData({ dashboard: null, activities, recordHistory: null })
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
          <a href="#trends" aria-current={view === 'trends' ? 'page' : undefined}>
            Trend
          </a>
          <a href="#profilo" aria-current={view === 'profile' ? 'page' : undefined}>
            Profilo
          </a>
        </nav>
      </header>

      <main id="main-content">
        {status === 'loading' && <StatusPanel type="loading" />}
        {status === 'error' && <StatusPanel type="error" message={error} onRetry={loadData} />}
        {status === 'success' && data.activities.length === 0 && <StatusPanel type="empty" />}
        {status === 'success' && data.activities.length > 0 && (
          <Suspense fallback={<StatusPanel type="loading" />}>
            {view === 'dashboard' && (
              <Dashboard
                activities={data.activities}
                syncState={syncState}
                onSync={syncGarmin}
              />
            )}
            {view === 'profile' && (
              <Profile summary={data.dashboard} activities={data.activities} />
            )}
            {view === 'activities' && <Activities activities={data.activities} />}
            {view === 'analytics' && <Analytics activities={data.activities} />}
            {view === 'trends' && (
              <Trends activities={data.activities} recordHistory={data.recordHistory ?? []} />
            )}
          </Suspense>
        )}
      </main>
    </div>
  )
}

export default App
