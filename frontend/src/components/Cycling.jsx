import { useMemo, useState } from 'react'
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatHeartRate,
} from '../utils/formatters.js'

const pageSize = 15

function speedKmh(activity) {
  const speed = Number(activity.averageSpeed)
  if (Number.isFinite(speed) && speed > 0) return speed * 3.6
  const distance = Number(activity.distance)
  const duration = Number(activity.duration)
  return Number.isFinite(distance) && Number.isFinite(duration) && duration > 0
    ? (distance / duration) * 3.6
    : null
}

function Cycling({ activities }) {
  const [page, setPage] = useState(1)
  const ordered = useMemo(() => [...activities].sort(
    (first, second) => new Date(second.startTimeLocal) - new Date(first.startTimeLocal),
  ), [activities])
  const totalPages = Math.max(1, Math.ceil(ordered.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const visible = ordered.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const totals = useMemo(() => activities.reduce((result, activity) => ({
    distance: result.distance + (Number(activity.km) || 0),
    duration: result.duration + (Number(activity.duration) || 0),
    elevation: result.elevation + (Number(activity.elevationGain) || 0),
  }), { distance: 0, duration: 0, elevation: 0 }), [activities])
  const recentCutoff = new Date()
  recentCutoff.setDate(recentCutoff.getDate() - 30)
  const recent = activities.filter((activity) => new Date(activity.startTimeLocal) >= recentCutoff)

  return (
    <div className="page-stack">
      <section className="page-heading compact-heading cycling-heading">
        <div>
          <p className="eyebrow">Ciclismo</p>
          <h1>Le tue attività in bici.</h1>
          <p>Distanza, tempo, velocità e frequenza cardiaca delle uscite Garmin.</p>
        </div>
      </section>

      <section className="general-summary-grid" aria-label="Riepilogo ciclismo">
        <article>
          <span>Uscite totali</span>
          <strong>{activities.length.toLocaleString('it-IT')}</strong>
          <small>{recent.length} negli ultimi 30 giorni</small>
        </article>
        <article>
          <span>Distanza totale</span>
          <strong>{formatDistance(totals.distance)}</strong>
          <small>Tutto lo storico sincronizzato</small>
        </article>
        <article>
          <span>Tempo totale</span>
          <strong>{formatDuration(totals.duration)}</strong>
          <small>Durata delle uscite</small>
        </article>
        <article>
          <span>Dislivello</span>
          <strong>{Math.round(totals.elevation).toLocaleString('it-IT')} m</strong>
          <small>Ascesa cumulata</small>
        </article>
      </section>

      <section className="panel activities-panel" aria-labelledby="cycling-activities-title">
        <div className="panel-heading table-heading">
          <div>
            <h2 id="cycling-activities-title">Uscite in bici</h2>
            <p>Le informazioni principali di ogni attività.</p>
          </div>
        </div>
        {activities.length > 0 ? (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Nome</th>
                  <th>Distanza</th>
                  <th>Durata</th>
                  <th>Velocità media</th>
                  <th>FC media</th>
                  <th>Dislivello</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((activity) => {
                  const speed = speedKmh(activity)
                  return (
                    <tr key={activity.activityId}>
                      <td data-label="Data">{formatDate(activity.startTimeLocal, 'long')}</td>
                      <td data-label="Nome" className="activity-name-cell">
                        <strong>{activity.activityName || 'Bici'}</strong>
                      </td>
                      <td data-label="Distanza">{formatDistance(activity.km)}</td>
                      <td data-label="Durata">{formatDuration(activity.duration)}</td>
                      <td data-label="Velocità media">
                        {speed == null ? '—' : `${speed.toLocaleString('it-IT', { maximumFractionDigits: 1 })} km/h`}
                      </td>
                      <td data-label="FC media">{formatHeartRate(activity.averageHR)}</td>
                      <td data-label="Dislivello">
                        {Number.isFinite(Number(activity.elevationGain))
                          ? `${Math.round(Number(activity.elevationGain)).toLocaleString('it-IT')} m`
                          : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="comparison-empty cycling-empty">
            <strong>Nessuna attività in bici sincronizzata</strong>
            <p>Premi “Sincronizza Garmin” nella dashboard generale per importarle.</p>
          </div>
        )}

        {totalPages > 1 && (
          <nav className="activities-pagination" aria-label="Paginazione attività in bici">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setPage(Math.max(1, currentPage - 1))}
            >
              ← Precedente
            </button>
            <span>Pagina <strong>{currentPage}</strong> di {totalPages}</span>
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

export default Cycling
