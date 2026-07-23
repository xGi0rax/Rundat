import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDate, formatDistance, formatHeartRate } from '../utils/formatters.js'

const recordLabels = {
  '1k': '1 km',
  '5k': '5 km',
  '10k': '10 km',
  'Half Marathon': 'Mezza maratona',
  'Full Marathon': 'Maratona',
}

function MetricCard({ label, value, detail }) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong>{value}</strong>
      {detail && <span>{detail}</span>}
    </article>
  )
}

function Dashboard({ summary, activities, syncState, onSync }) {
  const chartData = activities.slice(0, 10).reverse()
  const records = Object.entries(summary.personalBests)

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Panoramica</p>
          <h1>La tua corsa, in sintesi.</h1>
          <p>Distanze, ritmo e progressi aggiornati con le ultime attività.</p>
        </div>
        <div className="dashboard-actions">
          <button
            type="button"
            className="sync-button"
            onClick={onSync}
            disabled={syncState.status === 'loading'}
          >
            <span className={syncState.status === 'loading' ? 'sync-icon is-spinning' : 'sync-icon'} aria-hidden="true">↻</span>
            {syncState.status === 'loading' ? 'Sincronizzazione…' : 'Sincronizza Garmin'}
          </button>
          {syncState.message && (
            <p className={`sync-message ${syncState.status}`} role={syncState.status === 'error' ? 'alert' : 'status'}>
              {syncState.message}
            </p>
          )}
        </div>
      </section>

      <section className="metrics-grid" aria-label="Metriche principali">
        <MetricCard label="Corse registrate" value={summary.totalActivities.toLocaleString('it-IT')} />
        <MetricCard label="Distanza totale" value={formatDistance(summary.totalDistanceKm)} />
        <MetricCard label="Ultimi 7 giorni" value={formatDistance(summary.last7DaysDistanceKm)} />
      </section>

      <section className="dashboard-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Volume recente</p>
              <h2>Ultime 10 corse</h2>
            </div>
            <span>km per attività</span>
          </div>
          <div className="chart" aria-label="Grafico delle distanze delle ultime dieci corse">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 12, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#e7e9e5" />
                <XAxis dataKey="startTimeLocal" tickFormatter={(value) => formatDate(value, 'short')} tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={44} />
                <Tooltip
                  cursor={{ fill: '#f1f5ed' }}
                  formatter={(value) => [`${Number(value).toFixed(2)} km`, 'Distanza']}
                  labelFormatter={(value) => formatDate(value, 'long')}
                />
                <Bar dataKey="km" fill="#315e3b" radius={[6, 6, 2, 2]} maxBarSize={42} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="panel records-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Prestazioni</p>
              <h2>Record personali</h2>
            </div>
          </div>
          {records.length > 0 ? (
            <ul className="records-list">
              {records.map(([name, record]) => (
                <li key={name}>
                  <div>
                    <strong>{recordLabels[name] ?? name}</strong>
                    <span>{formatDate(record.date, 'long')} · {formatHeartRate(record.hr)}</span>
                  </div>
                  <div className="record-result">
                    <strong>{record.time}</strong>
                    <span>{record.pace ? `${record.pace} /km` : '—'}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="inline-empty">Nessun record disponibile per le distanze standard.</p>
          )}
        </article>
      </section>
    </div>
  )
}

export default Dashboard
