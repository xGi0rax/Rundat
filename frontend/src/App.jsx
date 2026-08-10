import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import AccessGate from './components/AccessGate.jsx'
import StatusPanel from './components/StatusPanel.jsx'
import {
  clearAccessToken,
  fetchJson,
  hasAccessToken,
  saveAccessToken,
} from './services/api.js'
import { activitiesOfType } from './domain/activityAnalysis.js'

const Analytics = lazy(() => import('./components/Analytics.jsx'))
const GeneralDashboard = lazy(() => import('./components/GeneralDashboard.jsx'))
const Profile = lazy(() => import('./components/Profile.jsx'))
const Sports = lazy(() => import('./components/Sports.jsx'))
const Trends = lazy(() => import('./components/Trends.jsx'))

const navigationItems = [
  { href: '#dashboard', view: 'dashboard', label: 'Dashboard generale', icon: 'dashboard' },
  { href: '#sport', view: 'sports', label: 'Corsa e bici', icon: 'running' },
  { href: '#analytics', view: 'analytics', label: 'Analisi corsa', icon: 'analytics' },
  { href: '#trends', view: 'trends', label: 'Trend corsa', icon: 'trends' },
  { href: '#profilo', view: 'profile', label: 'Profilo', icon: 'profile' },
]

function MenuIcon({ type }) {
  const paths = {
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
    running: (
      <>
        <circle cx="14" cy="4.5" r="2" />
        <path d="m6 21 3.4-6.2 3.2 2.1 2.2 4.1" />
        <path d="m8.2 14.8 2.2-5 3.2-1.8 2.3 3 4.1 1" />
        <path d="m10.4 9.8-3.2 2.4" />
      </>
    ),
    cycling: (
      <>
        <circle cx="5.5" cy="17.5" r="3.5" />
        <circle cx="18.5" cy="17.5" r="3.5" />
        <path d="m5.5 17.5 3.2-8h3.8l3 8h-10Z" />
        <path d="m12.5 9.5 2.2-3h2.8" />
        <path d="M7.5 6.5h3" />
      </>
    ),
    analytics: (
      <>
        <path d="M4 20V11" />
        <path d="M10 20V5" />
        <path d="M16 20v-7" />
        <path d="M22 20V8" />
        <path d="M2 20h20" />
      </>
    ),
    trends: (
      <>
        <path d="m3 17 6-6 4 4 8-8" />
        <path d="M15 7h6v6" />
      </>
    ),
    profile: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
      </>
    ),
  }

  return (
    <span className="nav-icon" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        {paths[type]}
      </svg>
    </span>
  )
}

function currentView() {
  if (
    window.location.hash.startsWith('#sport')
    || window.location.hash === '#running'
    || window.location.hash === '#cycling'
    || window.location.hash === '#bici'
  ) return 'sports'
  if (window.location.hash === '#analytics') return 'analytics'
  if (window.location.hash === '#trends') return 'trends'
  if (window.location.hash === '#profilo' || window.location.hash === '#profile') return 'profile'
  return 'dashboard'
}

function currentSport() {
  return (
    window.location.hash === '#cycling'
    || window.location.hash === '#bici'
    || window.location.hash === '#sport/bici'
  ) ? 'cycling' : 'running'
}

function App() {
  const [view, setView] = useState(currentView)
  const [sport, setSport] = useState(currentSport)
  const [data, setData] = useState({ dashboard: null, activities: [], recordHistory: null })
  const [status, setStatus] = useState('checking')
  const [error, setError] = useState('')
  const [requestId, setRequestId] = useState(0)
  const [syncState, setSyncState] = useState({ status: 'idle', message: '' })
  const runningActivities = useMemo(
    () => activitiesOfType(data.activities, 'running'),
    [data.activities],
  )
  const cyclingActivities = useMemo(
    () => activitiesOfType(data.activities, 'cycling'),
    [data.activities],
  )

  const loadData = useCallback(() => {
    setStatus('loading')
    setError('')
    setRequestId((value) => value + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetchJson('/api/health', { signal: controller.signal })
      .then((health) => {
        if (health.authenticationRequired && !hasAccessToken()) {
          setStatus('auth')
        } else {
          loadData()
        }
      })
      .catch((reason) => {
        if (reason.name !== 'AbortError') {
          setError(reason.message || 'Il servizio non è raggiungibile.')
          setStatus('error')
        }
      })
    return () => controller.abort()
  }, [loadData])

  useEffect(() => {
    const handleHashChange = () => {
      setView(currentView())
      setSport(currentSport())
    }
    window.addEventListener('hashchange', handleHashChange)
    if (!window.location.hash) window.history.replaceState(null, '', '#dashboard')
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    if (status !== 'loading') return undefined
    const controller = new AbortController()

    fetchJson('/api/activities', { signal: controller.signal })
      .then((activities) => {
        setData((current) => ({ ...current, activities }))
        setStatus('success')
      })
      .catch((reason) => {
        if (reason.name !== 'AbortError') {
          if (reason.status === 401) {
            clearAccessToken()
            setError('Codice di accesso non valido.')
            setStatus('auth')
          } else {
            setError(reason.message || 'Non è stato possibile caricare i dati.')
            setStatus('error')
          }
        }
      })

    return () => controller.abort()
  }, [requestId, status])

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
      if (reason.status === 401) {
        clearAccessToken()
        setError('Il codice di accesso è cambiato. Inserisci quello nuovo.')
        setStatus('auth')
        return
      }
      setSyncState({
        status: 'error',
        message: reason.message || 'Non è stato possibile sincronizzare Garmin.',
      })
    }
  }

  const authenticate = (token) => {
    saveAccessToken(token)
    setError('')
    loadData()
  }

  const selectSport = (nextSport) => {
    setSport(nextSport)
    window.history.replaceState(
      null,
      '',
      nextSport === 'cycling' ? '#sport/bici' : '#sport/corsa',
    )
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <a className="brand" href="#dashboard" aria-label="Rundat, vai alla dashboard">
          <img src="/logo.svg" alt="" />
          <span>Rundat</span>
        </a>
        <nav className="main-nav" aria-label="Navigazione principale">
          {navigationItems.map((item) => (
            <a
              key={item.view}
              href={item.href}
              aria-current={view === item.view ? 'page' : undefined}
            >
              <MenuIcon type={item.icon} />
              <span>{item.label}</span>
            </a>
          ))}
        </nav>
      </header>

      <main id="main-content">
        {(status === 'checking' || status === 'loading') && <StatusPanel type="loading" />}
        {status === 'auth' && <AccessGate message={error} onSubmit={authenticate} />}
        {status === 'error' && <StatusPanel type="error" message={error} onRetry={loadData} />}
        {status === 'success' && data.activities.length === 0 && <StatusPanel type="empty" />}
        {status === 'success' && data.activities.length > 0 && (
          <Suspense fallback={<StatusPanel type="loading" />}>
            {view === 'dashboard' && (
              <GeneralDashboard
                activities={data.activities}
                syncState={syncState}
                onSync={syncGarmin}
              />
            )}
            {view === 'sports' && (
              <Sports
                sport={sport}
                onSportChange={selectSport}
                runningActivities={runningActivities}
                cyclingActivities={cyclingActivities}
                syncState={syncState}
                onSync={syncGarmin}
              />
            )}
            {view === 'profile' && (
              <Profile
                summary={data.dashboard}
                activities={runningActivities}
                cyclingActivities={cyclingActivities}
              />
            )}
            {view === 'analytics' && <Analytics activities={runningActivities} />}
            {view === 'trends' && (
              <Trends activities={runningActivities} recordHistory={data.recordHistory ?? []} />
            )}
          </Suspense>
        )}
      </main>
    </div>
  )
}

export default App
