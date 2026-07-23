import { useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatDate, formatDistance, formatDuration, formatPaceDecimal } from '../utils/formatters.js'

const periods = [
  { value: 7, label: '7 giorni' },
  { value: 14, label: '14 giorni' },
  { value: 30, label: '30 giorni' },
  { value: 60, label: '60 giorni' },
  { value: 90, label: '90 giorni' },
]

function beginningOfWeek(date) {
  const result = new Date(date)
  const day = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - day)
  result.setHours(0, 0, 0, 0)
  return result
}

function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function weeklyVolume(activities, period) {
  const weeks = new Map()
  activities.forEach((activity) => {
    const week = beginningOfWeek(new Date(activity.startTimeLocal))
    const key = localDateKey(week)
    const current = weeks.get(key) ?? { date: key, km: 0, runs: 0, duration: 0, elevation: 0 }
    current.km += Number(activity.km) || 0
    current.runs += 1
    current.duration += Number(activity.duration) || 0
    current.elevation += Number(activity.elevationGain) || 0
    weeks.set(key, current)
  })

  if (activities.length === 0) return []
  const today = new Date()
  const firstActivity = new Date(Math.min(...activities.map((activity) => new Date(activity.startTimeLocal))))
  const start = period === 'all'
    ? beginningOfWeek(firstActivity)
    : beginningOfWeek(new Date(today.getFullYear(), today.getMonth(), today.getDate() - period))
  const end = beginningOfWeek(today)
  const result = []

  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 7)) {
    const key = localDateKey(cursor)
    const week = weeks.get(key) ?? { date: key, km: 0, runs: 0, duration: 0, elevation: 0 }
    result.push({
      ...week,
      km: Number(week.km.toFixed(2)),
      elevation: Math.round(week.elevation),
    })
  }
  return result
}

function weekRangeLabel(value) {
  const monday = new Date(`${value}T00:00:00`)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  return `${formatDate(monday)} – ${formatDate(sunday)}`
}

function WeeklyDot({ cx, cy, payload, selectedDate, onSelect }) {
  const selected = payload.date === selectedDate
  const select = (event) => {
    event.stopPropagation()
    onSelect(payload.date)
  }
  return (
    <g
      className="weekly-point"
      role="button"
      tabIndex={0}
      aria-label={`Seleziona la settimana ${weekRangeLabel(payload.date)}, ${formatDistance(payload.km)}`}
      onClick={select}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') select(event)
      }}
    >
      <circle cx={cx} cy={cy} r={15} fill="transparent" pointerEvents="all" />
      <circle
        className="weekly-point-visible"
        cx={cx}
        cy={cy}
        r={selected ? 6 : 4}
        fill={selected ? '#ef5b24' : '#ffffff'}
        stroke="#ef5b24"
        strokeWidth={selected ? 4 : 3}
        pointerEvents="none"
      />
    </g>
  )
}

function addTrend(weeks) {
  const count = weeks.length
  if (count === 0) return { data: [], average: 0 }
  const average = weeks.reduce((sum, week) => sum + week.km, 0) / count
  if (count === 1) return { data: weeks.map((week) => ({ ...week, trendKm: week.km })), average }

  const xAverage = (count - 1) / 2
  const numerator = weeks.reduce((sum, week, index) => sum + (index - xAverage) * (week.km - average), 0)
  const denominator = weeks.reduce((sum, _, index) => sum + ((index - xAverage) ** 2), 0)
  const slope = denominator ? numerator / denominator : 0
  const intercept = average - slope * xAverage
  return {
    average,
    data: weeks.map((week, index) => ({ ...week, trendKm: Math.max(0, intercept + slope * index) })),
  }
}

function ChartPanel({ eyebrow, title, description, children, empty, className = '' }) {
  return (
    <article className={`panel analytics-panel ${className}`}>
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>
      {empty ? <p className="chart-empty">Dati insufficienti per questo grafico.</p> : <div className="analytics-chart">{children}</div>}
    </article>
  )
}

function Analytics({ activities }) {
  const [period, setPeriod] = useState(90)
  const [selectedWeekKey, setSelectedWeekKey] = useState(null)
  const [showWeeklyAverage, setShowWeeklyAverage] = useState(false)
  const [showWeeklyTrend, setShowWeeklyTrend] = useState(false)

  const filtered = useMemo(() => {
    if (period === 'all') return activities
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - period)
    return activities.filter((activity) => new Date(activity.startTimeLocal) >= cutoff)
  }, [activities, period])

  const chronological = useMemo(
    () => [...filtered].sort((a, b) => new Date(a.startTimeLocal) - new Date(b.startTimeLocal)),
    [filtered],
  )
  const weeks = useMemo(() => weeklyVolume(filtered, period), [filtered, period])
  const weeklyAnalysis = useMemo(() => addTrend(weeks), [weeks])
  const selectedWeek = weeklyAnalysis.data.find((week) => week.date === selectedWeekKey) ?? weeklyAnalysis.data.at(-1)
  const paceData = chronological.filter((activity) => activity.paceDecimal != null)
  const heartRateData = chronological.filter((activity) => activity.averageHR != null)

  const totals = useMemo(() => {
    const distance = filtered.reduce((sum, activity) => sum + Number(activity.distance || 0), 0)
    const duration = filtered.reduce((sum, activity) => sum + Number(activity.duration || 0), 0)
    const heartRates = filtered.map((activity) => Number(activity.averageHR)).filter(Number.isFinite)
    const elevation = filtered.reduce((sum, activity) => sum + Number(activity.elevationGain || 0), 0)
    return {
      distanceKm: distance / 1000,
      averagePace: distance > 0 ? (duration / 60) / (distance / 1000) : null,
      averageHeartRate: heartRates.length ? heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length : null,
      elevation,
    }
  }, [filtered])

  return (
    <div className="page-stack">
      <section className="page-heading analytics-heading">
        <div>
          <p className="eyebrow">Approfondimenti</p>
          <h1>Le metriche nel tempo.</h1>

        </div>
      </section>

      {filtered.length === 0 ? (
        <section className="panel analytics-empty">
          <h2>Nessuna corsa nel periodo selezionato</h2>
          <p>Scegli un intervallo più ampio per visualizzare i grafici.</p>
          <div className="period-control empty-period-control" role="group" aria-label="Periodo di analisi">
            {periods.map((option) => (
              <button
                type="button"
                key={option.value}
                className={period === option.value ? 'active' : ''}
                aria-pressed={period === option.value}
                onClick={() => {
                  setPeriod(option.value)
                  setSelectedWeekKey(null)
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="analytics-summary" aria-label="Riepilogo del periodo">
            <div><span>Attività</span><strong>{filtered.length}</strong></div>
            <div><span>Distanza</span><strong>{formatDistance(totals.distanceKm)}</strong></div>
            <div><span>Passo medio</span><strong>{formatPaceDecimal(totals.averagePace)} /km</strong></div>
            <div><span>FC media</span><strong>{totals.averageHeartRate ? `${Math.round(totals.averageHeartRate)} bpm` : '—'}</strong></div>
            <div><span>Dislivello</span><strong>{Math.round(totals.elevation).toLocaleString('it-IT')} m</strong></div>
          </section>

          <section className="analytics-grid">
            <ChartPanel eyebrow="Volume" title="Distanza settimanale" description="Tocca una settimana per vederne i totali." empty={weeks.length === 0} className="weekly-progress-panel">
              {selectedWeek && (
                <div className="weekly-progress-summary" aria-live="polite">
                  <div className="weekly-progress-title">
                    <span>{selectedWeek.date === weeks.at(-1)?.date ? 'Questa settimana' : 'Settimana selezionata'}</span>
                    <small>{weekRangeLabel(selectedWeek.date)}</small>
                  </div>
                  <strong>{formatDistance(selectedWeek.km)}</strong>
                  <div className="weekly-progress-details">
                    <span><b>{formatDuration(selectedWeek.duration)}</b> tempo</span>
                    <span><b>{selectedWeek.elevation.toLocaleString('it-IT')} m</b> dislivello</span>
                    <span><b>{selectedWeek.runs}</b> {selectedWeek.runs === 1 ? 'corsa' : 'corse'}</span>
                  </div>
                </div>
              )}
              <div className="period-control weekly-period-control" role="group" aria-label="Periodo di analisi">
                {periods.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={period === option.value ? 'active' : ''}
                    aria-pressed={period === option.value}
                    onClick={() => {
                      setPeriod(option.value)
                      setSelectedWeekKey(null)
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="weekly-overlays" aria-label="Elementi aggiuntivi del grafico">
                <label>
                  <input
                    type="checkbox"
                    checked={showWeeklyAverage}
                    onChange={(event) => setShowWeeklyAverage(event.target.checked)}
                  />
                  <span className="overlay-swatch average" aria-hidden="true" />
                  Media settimanale ({formatDistance(weeklyAnalysis.average)})
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={showWeeklyTrend}
                    onChange={(event) => setShowWeeklyTrend(event.target.checked)}
                  />
                  <span className="overlay-swatch trend" aria-hidden="true" />
                  Linea di tendenza
                </label>
              </div>
              <div className="weekly-chart-scroll">
                <div className="analytics-chart weekly-chart" style={{ minWidth: `${Math.max(340, weeklyAnalysis.data.length * 28)}px` }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={weeklyAnalysis.data} margin={{ top: 14, right: 18, left: 4, bottom: 0 }} onClick={(state) => {
                      const week = state?.activePayload?.[0]?.payload
                      if (week) setSelectedWeekKey(week.date)
                    }}>
                      <CartesianGrid vertical={false} stroke="#d8d9d6" />
                      <XAxis dataKey="date" tickFormatter={(value) => formatDate(value, 'short')} tickLine={false} axisLine={false} minTickGap={24} />
                      <YAxis orientation="right" tickFormatter={(value) => `${Math.round(value)} km`} tickLine={false} axisLine={false} width={58} tickCount={3} domain={[0, 'auto']} />
                      <Tooltip formatter={(value, name) => [`${Number(value).toFixed(2)} km`, name === 'trendKm' ? 'Tendenza' : 'Distanza']} labelFormatter={(value) => weekRangeLabel(value)} cursor={{ stroke: '#ef5b24', strokeWidth: 2 }} />
                      {selectedWeek && <ReferenceLine x={selectedWeek.date} stroke="#ef5b24" strokeWidth={2} />}
                      {showWeeklyAverage && <ReferenceLine y={weeklyAnalysis.average} stroke="#315e3b" strokeWidth={2} strokeDasharray="6 5" />}
                      <Area
                        type="linear"
                        dataKey="km"
                        stroke="#ef5b24"
                        strokeWidth={4}
                        fill="#fbd8c7"
                        fillOpacity={0.9}
                        cursor="pointer"
                        dot={(props) => <WeeklyDot {...props} selectedDate={selectedWeek?.date} onSelect={setSelectedWeekKey} />}
                        activeDot={false}
                        onClick={(entry) => {
                          if (entry?.date) setSelectedWeekKey(entry.date)
                        }}
                      />
                      {showWeeklyTrend && (
                        <Line
                          type="linear"
                          dataKey="trendKm"
                          stroke="#345f9d"
                          strokeWidth={3}
                          strokeDasharray="9 5"
                          dot={false}
                          activeDot={false}
                          isAnimationActive={false}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </ChartPanel>

            <ChartPanel eyebrow="Ritmo" title="Andamento del passo" description="Passo medio di ogni attività: più in basso significa più veloce." empty={paceData.length === 0}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={paceData} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e7e9e5" />
                  <XAxis dataKey="startTimeLocal" tickFormatter={(value) => formatDate(value, 'short')} tickLine={false} axisLine={false} minTickGap={28} />
                  <YAxis tickFormatter={formatPaceDecimal} tickLine={false} axisLine={false} domain={['auto', 'auto']} reversed />
                  <Tooltip formatter={(value) => [`${formatPaceDecimal(value)} /km`, 'Passo']} labelFormatter={(value) => formatDate(value)} />
                  <Line type="monotone" dataKey="paceDecimal" stroke="#315e3b" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>

            <ChartPanel eyebrow="Intensità" title="Frequenza cardiaca" description="Frequenza cardiaca media registrata per ciascuna corsa." empty={heartRateData.length === 0}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={heartRateData} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="#e7e9e5" />
                  <XAxis dataKey="startTimeLocal" tickFormatter={(value) => formatDate(value, 'short')} tickLine={false} axisLine={false} minTickGap={28} />
                  <YAxis tickLine={false} axisLine={false} domain={['dataMin - 10', 'dataMax + 10']} />
                  <Tooltip formatter={(value) => [`${Math.round(value)} bpm`, 'FC media']} labelFormatter={(value) => formatDate(value)} />
                  <Line type="monotone" dataKey="averageHR" stroke="#b5533c" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartPanel>
          </section>
        </>
      )}
    </div>
  )
}

export default Analytics
