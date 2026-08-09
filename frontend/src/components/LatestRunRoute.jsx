import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { fetchJson } from '../services/api.js'

function routeMessage(status, activityLabel) {
  if (status === 'unavailable') {
    return {
      title: 'Percorso non disponibile',
      detail: 'Questa attività potrebbe essere indoor, senza GPS o protetta da Garmin.',
    }
  }
  if (status === 'failed') {
    return {
      title: 'Percorso non recuperato',
      detail: 'Riproveremo automaticamente alla prossima sincronizzazione Garmin.',
    }
  }
  return {
    title: 'Percorso non ancora sincronizzato',
    detail: `Premi “Sincronizza Garmin” per importare il GPS dell’ultima ${activityLabel}.`,
  }
}

function RouteMap({ points, routeColor, endColor, activityLabel }) {
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current || points.length < 2) return undefined
    const map = L.map(containerRef.current, {
      attributionControl: true,
      scrollWheelZoom: false,
      zoomControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)

    const coordinates = points.map((point) => [point.latitude, point.longitude])
    const route = L.polyline(coordinates, {
      color: routeColor,
      opacity: 0.94,
      weight: 4,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map)
    L.circleMarker(coordinates[0], {
      color: '#ffffff',
      fillColor: '#315e3b',
      fillOpacity: 1,
      radius: 6,
      weight: 2,
    }).bindTooltip('Partenza').addTo(map)
    L.circleMarker(coordinates.at(-1), {
      color: '#ffffff',
      fillColor: endColor,
      fillOpacity: 1,
      radius: 6,
      weight: 2,
    }).bindTooltip('Arrivo').addTo(map)
    map.fitBounds(route.getBounds(), { padding: [22, 22], maxZoom: 16 })

    const resizeFrame = window.requestAnimationFrame(() => map.invalidateSize())
    return () => {
      window.cancelAnimationFrame(resizeFrame)
      map.remove()
    }
  }, [endColor, points, routeColor])

  return (
    <div
      ref={containerRef}
      className="latest-route-map"
      aria-label={`Mappa del percorso dell’ultima ${activityLabel}`}
    />
  )
}

function LatestActivityRoute({ activityId, refreshKey, sport = 'running' }) {
  const [routeState, setRouteState] = useState({
    activityId: null,
    refreshKey: null,
    status: 'loading',
    points: [],
    pointCount: 0,
  })

  useEffect(() => {
    const controller = new AbortController()
    fetchJson(`/api/activities/${activityId}/route`, { signal: controller.signal })
      .then((route) => setRouteState({ ...route, activityId, refreshKey }))
      .catch((error) => {
        if (error.name !== 'AbortError') {
          setRouteState({
            activityId,
            refreshKey,
            status: 'failed',
            points: [],
            pointCount: 0,
          })
        }
      })
    return () => controller.abort()
  }, [activityId, refreshKey])

  const state = routeState.activityId === activityId && routeState.refreshKey === refreshKey
    ? routeState
    : { status: 'loading', points: [], pointCount: 0 }
  const isCycling = sport === 'cycling'
  const activityLabel = isCycling ? 'uscita in bici' : 'corsa'
  const hasRoute = state.status === 'success' && state.points.length >= 2
  const message = routeMessage(state.status, activityLabel)

  return (
    <article className={`panel latest-route-card ${sport}-route-card`}>
      <div className="latest-route-heading">
        <div>
          <p className="eyebrow">Percorso</p>
          <h2>Mappa dell’ultima {activityLabel}</h2>
        </div>
        {hasRoute && <span>{state.pointCount.toLocaleString('it-IT')} punti GPS</span>}
      </div>
      {state.status === 'loading' ? (
        <div className="latest-route-state" role="status">
          <span className="route-loading-indicator" aria-hidden="true" />
          <strong>Caricamento percorso…</strong>
        </div>
      ) : hasRoute ? (
        <RouteMap
          points={state.points}
          routeColor={isCycling ? '#345f9d' : '#ef5b24'}
          endColor={isCycling ? '#ef5b24' : '#345f9d'}
          activityLabel={activityLabel}
        />
      ) : (
        <div className="latest-route-state">
          <strong>{message.title}</strong>
          <p>{message.detail}</p>
        </div>
      )}
    </article>
  )
}

export default LatestActivityRoute
