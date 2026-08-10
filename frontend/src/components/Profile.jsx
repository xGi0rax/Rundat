import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartContainer from './ChartContainer.jsx'
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatHeartRate,
  formatPaceDecimal,
} from '../utils/formatters.js'
import { cyclingSpeedKmh } from '../domain/cyclingAnalysis.js'
import { paceMinutes } from '../domain/dashboardAnalysis.js'

const recordLabels = {
  '1k': '1 km',
  '5k': '5 km',
  '10k': '10 km',
  'Half Marathon': 'Mezza maratona',
  'Full Marathon': 'Maratona',
}

function MetricCard({ label, value, detail, sport }) {
  return (
    <article className={`metric-card${sport ? ` profile-${sport}-metric` : ''}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      {detail && <span>{detail}</span>}
    </article>
  )
}

function formatSpeed(value) {
  return Number.isFinite(value)
    ? `${value.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km/h`
    : '—'
}

function formatElevation(value) {
  return `${Math.round(value).toLocaleString('it-IT')} m`
}

function formatPace(value) {
  return Number.isFinite(value) ? `${formatPaceDecimal(value)} /km` : '—'
}

function Profile({ summary, activities, cyclingActivities = [] }) {
  const chartData = activities.slice(0, 10).reverse()
  const records = Object.entries(summary?.personalBests ?? {})
  const totalActivities = summary?.totalActivities ?? activities.length
  const totalDistance = summary?.totalDistanceKm
    ?? activities.reduce((sum, activity) => sum + (Number(activity.km) || 0), 0)
  const last7DaysDistance = summary?.last7DaysDistanceKm ?? 0
  const orderedRunningActivities = [...activities].sort(
    (first, second) => new Date(second.startTimeLocal) - new Date(first.startTimeLocal),
  )
  const latestActivity = summary?.latestActivity ?? orderedRunningActivities[0] ?? null
  const runningTotals = activities.reduce((totals, activity) => ({
    distance: totals.distance + (Number(activity.km) || 0),
    duration: totals.duration + (Number(activity.duration) || 0),
    elevation: totals.elevation + (Number(activity.elevationGain) || 0),
  }), { distance: 0, duration: 0, elevation: 0 })
  const orderedCyclingActivities = [...cyclingActivities].sort(
    (first, second) => new Date(second.startTimeLocal) - new Date(first.startTimeLocal),
  )
  const latestCyclingActivity = orderedCyclingActivities[0] ?? null
  const cyclingTotals = cyclingActivities.reduce((totals, activity) => ({
    distance: totals.distance + (Number(activity.km) || 0),
    duration: totals.duration + (Number(activity.duration) || 0),
    elevation: totals.elevation + (Number(activity.elevationGain) || 0),
  }), { distance: 0, duration: 0, elevation: 0 })
  const recentCutoff = new Date()
  recentCutoff.setDate(recentCutoff.getDate() - 7)
  const recentRunningActivities = activities.filter(
    (activity) => new Date(activity.startTimeLocal) >= recentCutoff,
  )
  const recentRunningTotals = recentRunningActivities.reduce((totals, activity) => ({
    distance: totals.distance + (Number(activity.km) || 0),
    duration: totals.duration + (Number(activity.duration) || 0),
  }), { distance: 0, duration: 0 })
  const recentRunningPace = recentRunningTotals.distance > 0
    ? (recentRunningTotals.duration / 60) / recentRunningTotals.distance
    : null
  const recentCyclingActivities = cyclingActivities.filter(
    (activity) => new Date(activity.startTimeLocal) >= recentCutoff,
  )
  const recentCyclingDistance = recentCyclingActivities.reduce(
    (sum, activity) => sum + (Number(activity.km) || 0),
    0,
  )
  const recentCyclingSpeeds = recentCyclingActivities
    .map(cyclingSpeedKmh)
    .filter(Number.isFinite)
  const recentAverageCyclingSpeed = recentCyclingSpeeds.length > 0
    ? recentCyclingSpeeds.reduce((sum, speed) => sum + speed, 0) / recentCyclingSpeeds.length
    : null

  return (
    <div className="page-stack">
      <section className="page-heading">
        <div>
          <p className="eyebrow">Profilo</p>
          <h1>Corsa e bici, in sintesi.</h1>
          <p>Volume complessivo, attività registrate e migliori prestazioni.</p>
        </div>
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
            <ChartContainer>
              <BarChart data={chartData} margin={{ top: 12, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis
                  dataKey="startTimeLocal"
                  tickFormatter={(value) => formatDate(value, 'short')}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis tickLine={false} axisLine={false} width={44} />
                <Tooltip
                  cursor={{ fill: '#f1f5ed' }}
                  formatter={(value) => [`${Number(value).toFixed(2)} km`, 'Distanza']}
                  labelFormatter={(value) => formatDate(value, 'long')}
                />
                <Bar dataKey="km" fill="#315e3b" radius={[6, 6, 2, 2]} maxBarSize={42} />
              </BarChart>
            </ChartContainer>
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

      <section className="profile-metrics-section" aria-labelledby="profile-running-title">
        <div className="profile-metrics-heading running">
          <p className="eyebrow">Corsa</p>
          <h2 id="profile-running-title">Riepilogo corsa</h2>
        </div>
        <div className="metrics-grid" aria-label="Metriche principali della corsa">
          <MetricCard
            sport="running"
            label="Corse registrate"
            value={totalActivities.toLocaleString('it-IT')}
            detail={`Tempo totale ${formatDuration(runningTotals.duration)}`}
          />
          <MetricCard
            sport="running"
            label="Distanza totale"
            value={formatDistance(totalDistance)}
            detail={`Dislivello totale ${formatElevation(runningTotals.elevation)}`}
          />
          <MetricCard
            sport="running"
            label="Ultimi 7 giorni"
            value={formatDistance(last7DaysDistance)}
            detail={`${recentRunningActivities.length} ${recentRunningActivities.length === 1 ? 'corsa' : 'corse'} · media ${formatPace(recentRunningPace)}`}
          />
          <MetricCard
            sport="running"
            label="Ultima corsa"
            value={latestActivity ? formatDistance(latestActivity.km) : '—'}
            detail={latestActivity
              ? `${formatDate(latestActivity.startTimeLocal, 'long')} · ${formatPace(paceMinutes(latestActivity))}`
              : 'Nessuna corsa registrata'}
          />
        </div>
      </section>

      <section className="profile-metrics-section" aria-labelledby="profile-cycling-title">
        <div className="profile-metrics-heading cycling">
          <p className="eyebrow">Bici</p>
          <h2 id="profile-cycling-title">Riepilogo bici</h2>
        </div>
        <div className="metrics-grid" aria-label="Metriche principali della bici">
          <MetricCard
            sport="cycling"
            label="Uscite registrate"
            value={cyclingActivities.length.toLocaleString('it-IT')}
            detail={`Tempo totale ${formatDuration(cyclingTotals.duration)}`}
          />
          <MetricCard
            sport="cycling"
            label="Distanza totale"
            value={formatDistance(cyclingTotals.distance)}
            detail={`Dislivello totale ${formatElevation(cyclingTotals.elevation)}`}
          />
          <MetricCard
            sport="cycling"
            label="Ultimi 7 giorni"
            value={formatDistance(recentCyclingDistance)}
            detail={`${recentCyclingActivities.length} ${recentCyclingActivities.length === 1 ? 'uscita' : 'uscite'} · media ${formatSpeed(recentAverageCyclingSpeed)}`}
          />
          <MetricCard
            sport="cycling"
            label="Ultima uscita"
            value={latestCyclingActivity
              ? formatDistance(latestCyclingActivity.km)
              : '—'}
            detail={latestCyclingActivity
              ? `${formatDate(latestCyclingActivity.startTimeLocal, 'long')} · ${formatSpeed(cyclingSpeedKmh(latestCyclingActivity))}`
              : 'Nessuna uscita in bici registrata'}
          />
        </div>
      </section>
    </div>
  )
}

export default Profile
