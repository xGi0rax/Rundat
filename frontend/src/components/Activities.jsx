import { formatDate, formatDistance, formatDuration, formatHeartRate } from '../utils/formatters.js'

function Activities({ activities }) {
  return (
    <div className="page-stack">
      <section className="page-heading compact-heading">
        <div>
          <p className="eyebrow">Archivio</p>
          <h1>Tutte le attività</h1>
          <p>{activities.length.toLocaleString('it-IT')} corse, dalla più recente alla meno recente.</p>
        </div>
      </section>

      <section className="panel activities-panel" aria-labelledby="activities-title">
        <div className="panel-heading table-heading">
          <div>
            <h2 id="activities-title">Elenco corse</h2>
            <p>Distanza, durata, passo e frequenza cardiaca.</p>
          </div>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Attività</th>
                <th>Data</th>
                <th>Distanza</th>
                <th>Durata</th>
                <th>Passo</th>
                <th>FC media</th>
              </tr>
            </thead>
            <tbody>
              {activities.map((activity) => (
                <tr key={activity.activityId}>
                  <td data-label="Attività"><strong>{activity.activityName || 'Corsa'}</strong></td>
                  <td data-label="Data">{formatDate(activity.startTimeLocal, 'long')}</td>
                  <td data-label="Distanza">{formatDistance(activity.km)}</td>
                  <td data-label="Durata">{formatDuration(activity.duration)}</td>
                  <td data-label="Passo">{activity.pace ? `${activity.pace} /km` : '—'}</td>
                  <td data-label="FC media">{formatHeartRate(activity.averageHR)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

export default Activities
