import { useMemo, useState } from 'react'
import { formatDate, formatDistance, formatDuration, formatHeartRate } from '../utils/formatters.js'

const pageSize = 20
const sortOptions = [
  { value: 'date', label: 'Data' },
  { value: 'distance', label: 'Distanza' },
  { value: 'duration', label: 'Durata' },
  { value: 'pace', label: 'Passo' },
  { value: 'heartRate', label: 'FC media' },
]

function activityDistanceKm(activity) {
  const km = Number(activity.km)
  if (Number.isFinite(km)) return km
  const metres = Number(activity.distance)
  return Number.isFinite(metres) ? metres / 1000 : null
}

function paceMinutes(activity) {
  const distance = activityDistanceKm(activity)
  const duration = Number(activity.duration)
  if (Number.isFinite(distance) && distance > 0 && Number.isFinite(duration)) {
    return (duration / 60) / distance
  }

  if (typeof activity.pace !== 'string') return null
  const [minutes, seconds = '0'] = activity.pace.split(':').map(Number)
  return Number.isFinite(minutes) && Number.isFinite(seconds)
    ? minutes + (seconds / 60)
    : null
}

function sortValue(activity, key) {
  if (key === 'date') {
    const timestamp = new Date(activity.startTimeLocal).getTime()
    return Number.isNaN(timestamp) ? null : timestamp
  }
  if (key === 'distance') return activityDistanceKm(activity)
  if (key === 'duration') {
    const duration = Number(activity.duration)
    return Number.isFinite(duration) ? duration : null
  }
  if (key === 'pace') return paceMinutes(activity)
  if (key === 'heartRate') {
    const heartRate = Number(activity.averageHR)
    return Number.isFinite(heartRate) ? heartRate : null
  }
  return null
}

function Activities({ activities }) {
  const [sortKey, setSortKey] = useState('date')
  const [sortDirection, setSortDirection] = useState('desc')
  const [page, setPage] = useState(1)

  const sortedActivities = useMemo(() => [...activities].sort((first, second) => {
    const firstValue = sortValue(first, sortKey)
    const secondValue = sortValue(second, sortKey)
    if (firstValue == null && secondValue == null) return 0
    if (firstValue == null) return 1
    if (secondValue == null) return -1
    return (firstValue - secondValue) * (sortDirection === 'asc' ? 1 : -1)
  }), [activities, sortDirection, sortKey])

  const totalPages = Math.max(1, Math.ceil(sortedActivities.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleActivities = sortedActivities.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )

  const changeSort = (key) => {
    if (key === sortKey) {
      setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDirection('desc')
    }
    setPage(1)
  }

  const sortButton = (key, label) => (
    <button
      type="button"
      className={`table-sort-button${sortKey === key ? ' active' : ''}`}
      onClick={() => changeSort(key)}
    >
      {label}
      <span aria-hidden="true">
        {sortKey === key ? (sortDirection === 'asc' ? '↑' : '↓') : '↕'}
      </span>
    </button>
  )

  return (
    <div className="page-stack">
      <section className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Archivio</p>
          <h1>Tutte le corse</h1>
          <p>{activities.length.toLocaleString('it-IT')} corse registrate.</p>
        </div>
      </section>

      <section className="panel activities-panel" aria-labelledby="activities-title">
        <div className="panel-heading table-heading">
          <div>
            <h2 id="activities-title">Elenco corse</h2>
            <p>Distanza, durata, passo e frequenza cardiaca.</p>
          </div>
          <div className="activities-sort-controls">
            <label>
              Ordina per
              <select
                value={sortKey}
                onChange={(event) => {
                  setSortKey(event.target.value)
                  setPage(1)
                }}
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => {
                setSortDirection((direction) => (direction === 'asc' ? 'desc' : 'asc'))
                setPage(1)
              }}
              aria-label={`Ordine ${sortDirection === 'asc' ? 'crescente' : 'decrescente'}`}
            >
              {sortDirection === 'asc' ? '↑ Crescente' : '↓ Decrescente'}
            </button>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Nome</th>
                <th aria-sort={sortKey === 'distance' ? `${sortDirection}ending` : 'none'}>
                  {sortButton('distance', 'Distanza')}
                </th>
                <th aria-sort={sortKey === 'duration' ? `${sortDirection}ending` : 'none'}>
                  {sortButton('duration', 'Durata')}
                </th>
                <th aria-sort={sortKey === 'pace' ? `${sortDirection}ending` : 'none'}>
                  {sortButton('pace', 'Passo')}
                </th>
                <th aria-sort={sortKey === 'heartRate' ? `${sortDirection}ending` : 'none'}>
                  {sortButton('heartRate', 'FC media')}
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleActivities.map((activity) => (
                <tr key={activity.activityId}>
                  <td data-label="Data">{formatDate(activity.startTimeLocal, 'long')}</td>
                  <td data-label="Nome" className="activity-name-cell">
                    <strong>{activity.activityName || 'Corsa'}</strong>
                  </td>
                  <td data-label="Distanza">{formatDistance(activity.km)}</td>
                  <td data-label="Durata">{formatDuration(activity.duration)}</td>
                  <td data-label="Passo">{activity.pace ? `${activity.pace} /km` : '—'}</td>
                  <td data-label="FC media">{formatHeartRate(activity.averageHR)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <nav className="activities-pagination" aria-label="Paginazione attività">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage(Math.max(1, currentPage - 1))}
            >
              ← Precedente
            </button>
            <span aria-live="polite">
              Pagina <strong>{currentPage}</strong> di {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            >
              Successiva →
            </button>
          </nav>
        )}
      </section>
    </div>
  )
}

export default Activities
