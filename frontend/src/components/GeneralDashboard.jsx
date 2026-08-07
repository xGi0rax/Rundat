import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartContainer from './ChartContainer.jsx'
import { analyzeCombinedActivities } from '../domain/activityAnalysis.js'
import { HEART_RATE_ZONE_COLORS } from '../domain/dashboardAnalysis.js'
import { formatDate, formatDistance, formatDuration } from '../utils/formatters.js'

const periods = [
  { value: 7, label: '1 settimana' },
  { value: 30, label: '1 mese' },
  { value: 90, label: '3 mesi' },
  { value: 365, label: '1 anno' },
  { value: 730, label: '2 anni' },
  { value: 'all', label: 'Tutto' },
]

function historyLabel(value, granularity) {
  const date = new Date(`${value}T00:00:00`)
  if (granularity === 'year') return String(date.getFullYear())
  if (granularity === 'month') {
    return new Intl.DateTimeFormat('it-IT', { month: 'short', year: '2-digit' })
      .format(date)
      .replace('.', '')
  }
  return formatDate(date, 'short')
}

function GeneralDashboard({ activities, syncState, onSync }) {
  const [period, setPeriod] = useState(7)
  const analysis = useMemo(
    () => analyzeCombinedActivities(activities, period),
    [activities, period],
  )
  const dominant = analysis.zones.reduce(
    (largest, zone) => (zone.seconds > largest.seconds ? zone : largest),
    analysis.zones[0],
  )
  const easySeconds = analysis.zones[0].seconds + analysis.zones[1].seconds
  const hardSeconds = analysis.zones[3].seconds + analysis.zones[4].seconds

  return (
    <div className="page-stack">
      <section className="page-heading latest-analysis-heading">
        <div>
          <p className="eyebrow">Dashboard generale</p>
          <h1>Il carico cardio di corsa e bici.</h1>
          <p>
            Un unico riepilogo del tempo trascorso nelle zone cardiache in tutti gli sport
            sincronizzati.
          </p>
        </div>
        <div className="dashboard-actions">
          <button
            type="button"
            className="sync-button"
            onClick={onSync}
            disabled={syncState.status === 'loading'}
          >
            <span
              className={syncState.status === 'loading' ? 'sync-icon is-spinning' : 'sync-icon'}
              aria-hidden="true"
            >
              ↻
            </span>
            {syncState.status === 'loading' ? 'Sincronizzazione…' : 'Sincronizza Garmin'}
          </button>
          {syncState.message && (
            <p
              className={`sync-message ${syncState.status}`}
              role={syncState.status === 'error' ? 'alert' : 'status'}
            >
              {syncState.message}
            </p>
          )}
        </div>
      </section>

      <div className="period-control general-period-control" role="group" aria-label="Periodo riepilogo generale">
        {periods.map((option) => (
          <button
            type="button"
            key={option.value}
            className={period === option.value ? 'active' : ''}
            aria-pressed={period === option.value}
            onClick={() => setPeriod(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <section className="general-summary-grid" aria-label="Riepilogo del periodo">
        <article>
          <span>Attività</span>
          <strong>{analysis.activityCount.toLocaleString('it-IT')}</strong>
          <small>{analysis.sport.running.count} corse · {analysis.sport.cycling.count} bici</small>
        </article>
        <article>
          <span>Tempo totale</span>
          <strong>{formatDuration(analysis.totalDuration)}</strong>
          <small>Durata completa delle attività</small>
        </article>
        <article>
          <span>Tempo con zone</span>
          <strong>{formatDuration(analysis.trackedSeconds)}</strong>
          <small>{analysis.trackedActivities} attività con dati cardio</small>
        </article>
        <article>
          <span>Zona prevalente</span>
          <strong>{analysis.trackedSeconds ? `Z${dominant.zone}` : '—'}</strong>
          <small>{analysis.trackedSeconds ? formatDuration(dominant.seconds) : 'Dati non disponibili'}</small>
        </article>
      </section>

      <section className="panel hr-zone-panel" aria-labelledby="combined-zone-title">
        <div className="panel-heading hr-zone-heading">
          <div>
            <p className="eyebrow">Distribuzione dello sforzo</p>
            <h2 id="combined-zone-title">Zone cardiache complessive</h2>
            <p>
              Somma del tempo rilevato nelle attività di corsa e bici dal{' '}
              {formatDate(analysis.start)} al {formatDate(analysis.end)}.
            </p>
          </div>
          <span>{analysis.trackedActivities} attività rilevate</span>
        </div>

        {analysis.trackedSeconds > 0 ? (
          <>
            <div className="zone-insights">
              <div>
                <span>Tempo cardio totale</span>
                <strong>{formatDuration(analysis.trackedSeconds)}</strong>
              </div>
              <div>
                <span>Intensità facile · Z1–Z2</span>
                <strong>{formatDuration(easySeconds)}</strong>
                <small>{((easySeconds / analysis.trackedSeconds) * 100).toFixed(0)}% del tempo rilevato</small>
              </div>
              <div>
                <span>Alta intensità · Z4–Z5</span>
                <strong>{formatDuration(hardSeconds)}</strong>
                <small>{((hardSeconds / analysis.trackedSeconds) * 100).toFixed(0)}% del tempo rilevato</small>
              </div>
            </div>

            <div
              className="zone-distribution"
              role="img"
              aria-label="Distribuzione complessiva delle zone cardiache per corsa e bici"
            >
              {analysis.zones.map((zone, index) => (
                <span
                  key={zone.zone}
                  style={{
                    width: `${zone.percentage}%`,
                    backgroundColor: HEART_RATE_ZONE_COLORS[index],
                  }}
                  title={`Z${zone.zone}: ${formatDuration(zone.seconds)} (${zone.percentage.toFixed(1)}%)`}
                />
              ))}
            </div>
            <div className="zone-legend">
              {analysis.zones.map((zone, index) => (
                <div key={zone.zone}>
                  <i style={{ backgroundColor: HEART_RATE_ZONE_COLORS[index] }} />
                  <span>Z{zone.zone}</span>
                  <strong>{formatDuration(zone.seconds)}</strong>
                  <small>{zone.percentage.toFixed(0)}%</small>
                </div>
              ))}
            </div>

            {analysis.history.length > 0 && (
              <div className="zone-history">
                <h3>Zone nel tempo</h3>
                <p>Minuti complessivi per periodo, sommando corsa e bici.</p>
                <div className="zone-history-chart combined-zone-history-chart">
                  <ChartContainer>
                    <BarChart data={analysis.history} margin={{ top: 12, right: 18, left: 0, bottom: 4 }}>
                      <CartesianGrid vertical={false} stroke="#e1e4df" />
                      <XAxis
                        dataKey="date"
                        tickFormatter={(value) => historyLabel(value, analysis.granularity)}
                        tickLine={false}
                        axisLine={false}
                        minTickGap={24}
                      />
                      <YAxis
                        tickFormatter={(value) => `${Math.round(value)}m`}
                        tickLine={false}
                        axisLine={false}
                        width={44}
                      />
                      <Tooltip
                        labelFormatter={(value) => historyLabel(value, analysis.granularity)}
                        formatter={(value, name) => [
                          `${Number(value).toLocaleString('it-IT', { maximumFractionDigits: 1 })} min`,
                          name,
                        ]}
                      />
                      {HEART_RATE_ZONE_COLORS.map((color, index) => (
                        <Bar
                          key={`z${index + 1}`}
                          dataKey={`z${index + 1}`}
                          stackId="zones"
                          fill={color}
                          name={`Z${index + 1}`}
                          radius={index === 4 ? [5, 5, 0, 0] : 0}
                        />
                      ))}
                    </BarChart>
                  </ChartContainer>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="comparison-empty zone-empty">
            <strong>Zone cardiache non ancora disponibili nel periodo</strong>
            <p>Sincronizza Garmin per importare progressivamente le zone di corse e bici.</p>
          </div>
        )}
      </section>

      <section className="sport-recap-grid" aria-label="Riepilogo per sport">
        <article className="panel">
          <p className="eyebrow">Corsa</p>
          <h2>{analysis.sport.running.count} attività</h2>
          <strong>{formatDuration(analysis.sport.running.duration)}</strong>
          <span>{formatDistance(analysis.sport.running.distanceKm)}</span>
        </article>
        <article className="panel cycling-recap-card">
          <p className="eyebrow">Bici</p>
          <h2>{analysis.sport.cycling.count} attività</h2>
          <strong>{formatDuration(analysis.sport.cycling.duration)}</strong>
          <span>{formatDistance(analysis.sport.cycling.distanceKm)}</span>
        </article>
      </section>
    </div>
  )
}

export default GeneralDashboard
