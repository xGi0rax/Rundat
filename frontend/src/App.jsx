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
  {
    href: '#dashboard', view: 'dashboard', label: 'Dashboard generale', mobileLabel: 'Home', icon: 'dashboard',
  },
  { href: '#sport', view: 'sports', label: 'Attività', mobileLabel: 'Attività', icon: 'ironman' },
  { href: '#analytics', view: 'analytics', label: 'Analisi corsa', mobileLabel: 'Analisi', icon: 'analytics' },
  { href: '#trends', view: 'trends', label: 'Trend corsa', mobileLabel: 'Trend', icon: 'trends' },
  { href: '#profilo', view: 'profile', label: 'Profilo', mobileLabel: 'Profilo', icon: 'profile' },
]

// Gestisce menu icon.
function MenuIcon({ type }) {
  const icons = {
    dashboard: {
      outline: (
        <>
          <path d="m3 10 9-7 9 7" />
          <path d="M5 9v11h14V9" />
          <path d="M9 20v-6h6v6" />
        </>
      ),
      filled: (
        <path
          d="M2.6 9.6 12 2.3l9.4 7.3-1.2 1.6-1.2-.9V20a1 1 0 0 1-1 1h-4.2v-6.3h-3.6V21H6a1 1 0 0 1-1-1v-9.7l-1.2.9-1.2-1.6Z"
          fill="currentColor"
          stroke="none"
        />
      ),
    },
    ironman: {
      outline: (
        <>
          <circle cx="12" cy="4" r="2.2" />
          <path d="M3.5 20V8.5h4.2l4.3 6.2 4.3-6.2h4.2V20" />
          <path d="M7.7 20v-5.3l4.3 6 4.3-6V20" />
        </>
      ),
      filled: (
        <>
          <circle cx="12" cy="3.8" r="2.7" fill="currentColor" stroke="none" />
          <path
            d="M3 8h4.7l4.3 6.2L16.3 8H21v13h-4.2v-6.7L12 21l-4.8-6.7V21H3V8Z"
            fill="currentColor"
            stroke="none"
          />
        </>
      ),
    },
    analytics: {
      outline: (
        <>
          <path d="M4 20V11" />
          <path d="M10 20V5" />
          <path d="M16 20v-7" />
          <path d="M22 20V8" />
          <path d="M2 20h20" />
        </>
      ),
      filled: (
        <>
          <rect x="2" y="11" width="4" height="10" rx="1.2" fill="currentColor" stroke="none" />
          <rect x="8" y="4" width="4" height="17" rx="1.2" fill="currentColor" stroke="none" />
          <rect x="14" y="13" width="4" height="8" rx="1.2" fill="currentColor" stroke="none" />
          <rect x="20" y="7" width="4" height="14" rx="1.2" fill="currentColor" stroke="none" />
        </>
      ),
    },
    trends: {
      outline: (
        <>
          <path d="m3 17 6-6 4 4 8-8" />
          <path d="M15 7h6v6" />
        </>
      ),
      filled: (
        <path
          d="M3 18.2 9 12l4 3.7 8-8.4V21H3v-2.8Zm11.8-12h6.8V13l-2.2-2.2-6.3 6.6L9 13.6l-4.9 5.1-1.5-1.5L9 10.5l4 3.7 4.9-5.1-3.1-2.9Z"
          fill="currentColor"
          stroke="none"
        />
      ),
    },
    profile: {
      outline: (
        <>
          <circle cx="12" cy="8" r="4" />
          <path d="M4.5 21a7.5 7.5 0 0 1 15 0" />
        </>
      ),
      filled: (
        <>
          <circle cx="12" cy="7.5" r="4.5" fill="currentColor" stroke="none" />
          <path d="M3.5 21a8.5 8.5 0 0 1 17 0H3.5Z" fill="currentColor" stroke="none" />
        </>
      ),
    },
  }

  const icon = icons[type]

  return (
    <span className={`nav-icon nav-icon-${type}`} aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        focusable="false"
      >
        <g className="nav-icon-outline">{icon.outline}</g>
        <g className="nav-icon-filled">{icon.filled}</g>
      </svg>
    </span>
  )
}

// Gestisce current view.
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

// Gestisce current sport.
function currentSport() {
  return (
    window.location.hash === '#cycling'
    || window.location.hash === '#bici'
    || window.location.hash === '#sport/bici'
  ) ? 'cycling' : 'running'
}

// Gestisce preferred theme.
function preferredTheme() {
  const storedTheme = window.localStorage.getItem('rundat-theme')
  if (storedTheme === 'light' || storedTheme === 'dark') return storedTheme
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Gestisce app.
function App() {
  const [view, setView] = useState(currentView)
  const [sport, setSport] = useState(currentSport)
  const [theme, setTheme] = useState(preferredTheme)
  // Stato aggregato caricato dall'API e condiviso tra le viste.
  const [data, setData] = useState({
    dashboard: null,
    activities: [],
    racePredictions: [],
  })
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

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem('rundat-theme', theme)
  }, [theme])

  const loadData = useCallback(() => {
    setStatus('loading')
    setError('')
    setRequestId((value) => value + 1)
  }, [])

  useEffect(() => {
    // Controller della richiesta health, annullato quando il componente viene smontato.
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
    // Gestisce handle hash change.
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
    // Controller del caricamento attività, utile per evitare aggiornamenti tardivi.
    const controller = new AbortController()

    Promise.all([
      fetchJson('/api/activities', { signal: controller.signal }),
      fetchJson('/api/race-predictions', { signal: controller.signal }),
    ]).then(([activities, racePredictions]) => {
      setData((current) => ({ ...current, activities, racePredictions }))
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
    // Controller delle richieste dati specifiche della vista corrente.
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
    return () => controller.abort()
  }, [data.dashboard, status, view])

  // Gestisce sync garmin.
  const syncGarmin = async () => {
    setSyncState({ status: 'loading', message: 'Sincronizzazione con Garmin in corso…' })
    try {
      // Riepilogo restituito dal backend con conteggi e zone cardio importate.
      const result = await fetchJson('/api/sync/garmin', { method: 'POST' })
      const [activities, racePredictions] = await Promise.all([
        fetchJson('/api/activities'),
        fetchJson('/api/race-predictions'),
      ])
      const changed = result.insertedCount + result.updatedCount
      const zonesMessage = result.hrZoneCount > 0
        ? ` Zone cardio aggiunte a ${result.hrZoneCount} attività.`
        : ''
      const message = changed > 0
        ? `${result.insertedCount} nuove, ${result.updatedCount} aggiornate.${zonesMessage}`
        : zonesMessage || 'Tutto aggiornato: nessuna nuova attività o zona cardio.'
      setData({ dashboard: null, activities, racePredictions })
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

  // Gestisce authenticate.
  const authenticate = (token) => {
    saveAccessToken(token)
    setError('')
    loadData()
  }

  // Gestisce select sport.
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
              <span className="nav-label nav-label-desktop">{item.label}</span>
              <span className="nav-label nav-label-mobile">{item.mobileLabel}</span>
            </a>
          ))}
        </nav>
      </header>

      <button
        type="button"
        className="theme-toggle"
        role="switch"
        aria-checked={theme === 'dark'}
        aria-label={theme === 'dark' ? 'Attiva modalità chiara' : 'Attiva modalità scura'}
        title={theme === 'dark' ? 'Modalità chiara' : 'Modalità scura'}
        onClick={() => setTheme((current) => (current === 'dark' ? 'light' : 'dark'))}
      >
        <span className="theme-toggle-track" aria-hidden="true">
          <span className="theme-toggle-symbol theme-toggle-sun">☀</span>
          <span className="theme-toggle-symbol theme-toggle-moon">☾</span>
          <span className="theme-toggle-thumb" />
        </span>
        <span className="theme-toggle-label">
          {theme === 'dark' ? 'Tema chiaro' : 'Tema scuro'}
        </span>
      </button>

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
              <Trends
                activities={runningActivities}
                racePredictions={data.racePredictions}
              />
            )}
          </Suspense>
        )}
      </main>
    </div>
  )
}

export default App
