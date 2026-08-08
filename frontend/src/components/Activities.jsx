import { useMemo, useState } from 'react'
import { ACTIVITY_TYPES, activityType } from '../domain/activityAnalysis.js'
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatHeartRate,
  formatPaceDecimal,
} from '../utils/formatters.js'

const pageSize = 20
const filterOptions = [
  { value: ACTIVITY_TYPES.running, label: 'Corsa' },
  { value: ACTIVITY_TYPES.cycling, label: 'Bici' },
  { value: 'all', label: 'Tutte' },
]

const filterContent = {
  all: {
    title: 'Tutte le attività',
    description: 'Corse e uscite in bici riunite in un unico archivio.',
  },
  [ACTIVITY_TYPES.running]: {
    title: 'Corse',
    description: 'Distanza, durata, passo e frequenza cardiaca.',
  },
  [ACTIVITY_TYPES.cycling]: {
    title: 'Uscite in bici',
    description: 'Distanza, durata, velocità e frequenza cardiaca.',
  },
}

function sortOptions(filter) {
  const options = [
    { value: 'date', label: 'Data' },
    { value: 'distance', label: 'Distanza' },
    { value: 'duration', label: 'Durata' },
    { value: 'heartRate', label: 'FC media' },
    { value: 'elevation', label: 'Dislivello' },
  ]
  if (filter === ACTIVITY_TYPES.running) options.splice(3, 0, { value: 'pace', label: 'Passo' })
  if (filter === ACTIVITY_TYPES.cycling) options.splice(3, 0, { value: 'speed', label: 'Velocità media' })
  return options
}

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

function speedKmh(activity) {
  const speed = Number(activity.averageSpeed)
  if (Number.isFinite(speed) && speed > 0) return speed * 3.6
  const distance = Number(activity.distance)
  const duration = Number(activity.duration)
  return Number.isFinite(distance) && Number.isFinite(duration) && duration > 0
    ? (distance / duration) * 3.6
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
  if (key === 'speed') return speedKmh(activity)
  if (key === 'heartRate') {
    const heartRate = Number(activity.averageHR)
    return Number.isFinite(heartRate) ? heartRate : null
  }
  if (key === 'elevation') {
    const elevation = Number(activity.elevationGain)
    return Number.isFinite(elevation) ? elevation : null
  }
  return null
}

function sportLabel(activity) {
  return activityType(activity) === ACTIVITY_TYPES.cycling ? 'Bici' : 'Corsa'
}

function rhythmLabel(activity) {
  if (activityType(activity) === ACTIVITY_TYPES.cycling) {
    const speed = speedKmh(activity)
    return speed == null
      ? '—'
      : `${speed.toLocaleString('it-IT', { maximumFractionDigits: 1 })} km/h`
  }
  const pace = activity.pace || formatPaceDecimal(paceMinutes(activity))
  return pace === '—' ? pace : `${pace} /km`
}

function elevationLabel(activity) {
  const elevation = Number(activity.elevationGain)
  return Number.isFinite(elevation)
    ? `${Math.round(elevation).toLocaleString('it-IT')} m`
    : '—'
}

function Activities({ activities }) {
  const [activityFilter, setActivityFilter] = useState('all')
  const [sortKey, setSortKey] = useState('date')
  const [sortDirection, setSortDirection] = useState('desc')
  const [page, setPage] = useState(1)

  const availableSortOptions = sortOptions(activityFilter)
  const filteredActivities = useMemo(() => (
    activityFilter === 'all'
      ? activities
      : activities.filter((activity) => activityType(activity) === activityFilter)
  ), [activities, activityFilter])
  const sortedActivities = useMemo(() => [...filteredActivities].sort((first, second) => {
    const firstValue = sortValue(first, sortKey)
    const secondValue = sortValue(second, sortKey)
    if (firstValue == null && secondValue == null) return 0
    if (firstValue == null) return 1
    if (secondValue == null) return -1
    return (firstValue - secondValue) * (sortDirection === 'asc' ? 1 : -1)
  }), [filteredActivities, sortDirection, sortKey])

  const totalPages = Math.max(1, Math.ceil(sortedActivities.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visibleActivities = sortedActivities.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  )
  const content = filterContent[activityFilter]
  const rhythmHeading = activityFilter === ACTIVITY_TYPES.running
    ? 'Passo'
    : activityFilter === ACTIVITY_TYPES.cycling ? 'Velocità media' : 'Passo / velocità'

  const changeFilter = (nextFilter) => {
    setActivityFilter(nextFilter)
    if (!sortOptions(nextFilter).some((option) => option.value === sortKey)) {
      setSortKey('date')
      setSortDirection('desc')
    }
    setPage(1)
  }

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
          <h1>Archivio attività</h1>
          <p>
            {filteredActivities.length.toLocaleString('it-IT')} su{' '}
            {activities.length.toLocaleString('it-IT')} attività sincronizzate.
          </p>
        </div>
      </section>

      <section className="panel activities-panel" aria-labelledby="activities-title">
        <div className="panel-heading table-heading">
          <div>
            <h2 id="activities-title">{content.title}</h2>
            <p>{content.description}</p>
          </div>
          <div className="activities-sort-controls">
            <label>
              Mostra
              <select
                value={activityFilter}
                onChange={(event) => changeFilter(event.target.value)}
                aria-label="Tipo di attività"
              >
                {filterOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              Ordina per
              <select
                value={sortKey}
                onChange={(event) => {
                  setSortKey(event.target.value)
                  setPage(1)
                }}
              >
                {availableSortOptions.map((option) => (
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

        {visibleActivities.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th aria-sort={sortKey === 'date' ? `${sortDirection}ending` : 'none'}>
                    {sortButton('date', 'Data')}
                  </th>
                  <th>Sport</th>
                  <th>Nome</th>
                  <th aria-sort={sortKey === 'distance' ? `${sortDirection}ending` : 'none'}>
                    {sortButton('distance', 'Distanza')}
                  </th>
                  <th aria-sort={sortKey === 'duration' ? `${sortDirection}ending` : 'none'}>
                    {sortButton('duration', 'Durata')}
                  </th>
                  <th>{rhythmHeading}</th>
                  <th aria-sort={sortKey === 'heartRate' ? `${sortDirection}ending` : 'none'}>
                    {sortButton('heartRate', 'FC media')}
                  </th>
                  <th aria-sort={sortKey === 'elevation' ? `${sortDirection}ending` : 'none'}>
                    {sortButton('elevation', 'Dislivello')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibleActivities.map((activity) => {
                  const type = activityType(activity)
                  return (
                    <tr key={activity.activityId}>
                      <td data-label="Data">{formatDate(activity.startTimeLocal, 'long')}</td>
                      <td data-label="Sport">
                        <span className={`activity-type-badge ${type}`}>{sportLabel(activity)}</span>
                      </td>
                      <td data-label="Nome" className="activity-name-cell">
                        <strong>{activity.activityName || sportLabel(activity)}</strong>
                      </td>
                      <td data-label="Distanza">{formatDistance(activityDistanceKm(activity))}</td>
                      <td data-label="Durata">{formatDuration(activity.duration)}</td>
                      <td data-label={rhythmHeading}>{rhythmLabel(activity)}</td>
                      <td data-label="FC media">{formatHeartRate(activity.averageHR)}</td>
                      <td data-label="Dislivello">{elevationLabel(activity)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="comparison-empty archive-empty">
            <strong>Nessuna attività per il filtro selezionato</strong>
            <p>Prova un altro tipo di attività oppure sincronizza nuovamente Garmin.</p>
          </div>
        )}

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
