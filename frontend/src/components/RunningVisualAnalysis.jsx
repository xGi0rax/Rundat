import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartContainer from './ChartContainer.jsx'
import PeriodPicker from './PeriodPicker.jsx'
import {
  formatDate,
  formatDistance,
  formatDuration,
  formatHeartRate,
  formatPaceDecimal,
} from '../utils/formatters.js'
import { HEART_RATE_ZONE_COLORS, median, paceMinutes } from '../domain/dashboardAnalysis.js'
import {
  addRollingEfficiency,
  buildRunningVisualData,
} from '../domain/runningVisualAnalysis.js'
import { normalizePeriod, periodRange } from '../domain/periods.js'

const weekdayLabels = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

// Gestisce local date key.
function localDateKey(value) {
  const date = new Date(value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Gestisce intensity color.
function intensityColor(intensity) {
  if (!Number.isFinite(intensity)) return '#a9b2aa'
  if (intensity < 65) return HEART_RATE_ZONE_COLORS[0]
  if (intensity < 75) return HEART_RATE_ZONE_COLORS[1]
  if (intensity < 82) return HEART_RATE_ZONE_COLORS[2]
  if (intensity < 90) return HEART_RATE_ZONE_COLORS[3]
  return HEART_RATE_ZONE_COLORS[4]
}

// Gestisce activity detail dialog.
function ActivityDetailDialog({ activity, onClose }) {
  const pace = paceMinutes(activity)

  useEffect(() => {
    // Gestisce close on escape.
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const details = [
    ['Distanza', formatDistance(activity.km)],
    ['Durata', formatDuration(activity.duration)],
    ['Passo medio', pace ? `${formatPaceDecimal(pace)} /km` : '—'],
    ['FC media', formatHeartRate(activity.averageHR)],
    ['FC massima', formatHeartRate(activity.maxHR)],
    ['Dislivello', Number.isFinite(Number(activity.elevationGain))
      ? `${Math.round(Number(activity.elevationGain)).toLocaleString('it-IT')} m`
      : '—'],
    ['Calorie', Number.isFinite(Number(activity.calories))
      ? `${Math.round(Number(activity.calories)).toLocaleString('it-IT')} kcal`
      : '—'],
  ]

  return (
    <div className="info-modal-backdrop" onMouseDown={onClose}>
      <section
        className="info-modal activity-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="visual-activity-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="info-modal-header">
          <div>
            <p className="eyebrow">Dettagli attività</p>
            <h2 id="visual-activity-detail-title">{activity.activityName || 'Corsa'}</h2>
            <p>{formatDate(activity.startTimeLocal, 'long')}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </header>
        <div className="activity-detail-grid">
          {details.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// Gestisce interactive point.
function InteractivePoint({ cx, cy, payload, onSelect, latestId, radius = 5 }) {
  const isLatest = payload.activityId === latestId
  // Gestisce open details.
  const openDetails = () => onSelect(payload.activity)
  return (
    <g
      className={`activity-scatter-point${isLatest ? ' latest' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`Apri i dettagli di ${payload.name} del ${formatDate(payload.dateValue)}`}
      onClick={openDetails}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openDetails()
        }
      }}
    >
      <circle cx={cx} cy={cy} r={Math.max(12, radius + 4)} fill="transparent" />
      {isLatest ? (
        <rect
          x={cx - 5.5}
          y={cy - 5.5}
          width={11}
          height={11}
          rx={1}
          fill="#345f9d"
          transform={`rotate(45 ${cx} ${cy})`}
        />
      ) : (
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill={payload.color || '#8fa194'}
          fillOpacity={0.86}
        />
      )}
    </g>
  )
}

// Gestisce calendar cells.
function calendarCells(data, range) {
  const activityDays = new Map()
  data.forEach((item) => {
    const key = localDateKey(item.date)
    const day = activityDays.get(key) ?? {
      activities: [],
      distance: 0,
      duration: 0,
      load: 0,
      hasLoad: false,
    }
    day.activities.push(item.activity)
    day.distance += Number(item.distance) || 0
    day.duration += Number(item.durationMinutes) || 0
    if (Number.isFinite(item.load)) {
      day.load += item.load
      day.hasLoad = true
    }
    activityDays.set(key, day)
  })

  const start = new Date(range.start)
  start.setHours(0, 0, 0, 0)
  const mondayOffset = (start.getDay() + 6) % 7
  start.setDate(start.getDate() - mondayOffset)
  const end = new Date(range.end)
  end.setHours(0, 0, 0, 0)
  const sundayOffset = 6 - ((end.getDay() + 6) % 7)
  end.setDate(end.getDate() + sundayOffset)

  const scores = [...activityDays.values()].map((day) => (
    day.hasLoad ? day.load : day.duration
  ))
  const maximumScore = Math.max(0, ...scores)
  const cells = []
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = new Date(cursor)
    const key = localDateKey(date)
    const day = activityDays.get(key)
    const score = day ? (day.hasLoad ? day.load : day.duration) : 0
    const ratio = maximumScore > 0 ? score / maximumScore : 0
    const level = !day ? 0 : Math.max(1, Math.min(4, Math.ceil(ratio * 4)))
    cells.push({ date, key, day, level })
  }
  return cells
}

// Gestisce running visual analysis.
function RunningVisualAnalysis({ activities, latest }) {
  const [period, setPeriod] = useState({ amount: 1, unit: 'year' })
  const [selectedActivity, setSelectedActivity] = useState(null)
  const referenceDate = new Date(latest.startTimeLocal)
  const normalizedPeriod = normalizePeriod(period, activities, referenceDate)
  const selectedRange = periodRange(normalizedPeriod, 0, referenceDate)
  const allData = useMemo(() => buildRunningVisualData(activities), [activities])
  const selectedData = allData.filter(
    (item) => item.date >= selectedRange.start && item.date <= selectedRange.end,
  )
  const latestId = latest.activityId
  const performanceData = selectedData
    .filter((item) => Number.isFinite(item.distance) && Number.isFinite(item.pace))
    .map((item) => ({ ...item, color: intensityColor(item.intensity) }))
  const loadData = selectedData
    .filter((item) => (
      Number.isFinite(item.durationMinutes)
      && Number.isFinite(item.intensity)
      && Number.isFinite(item.load)
    ))
  const maximumLoad = Math.max(0, ...loadData.map((item) => item.load))
  const loadPoints = loadData.map((item) => ({
    ...item,
    color: intensityColor(item.intensity),
    radius: maximumLoad > 0 ? 5 + (Math.sqrt(item.load / maximumLoad) * 9) : 5,
  }))
  const efficiencyData = addRollingEfficiency(
    selectedData.filter((item) => Number.isFinite(item.efficiency)),
  ).map((item) => ({ ...item, dateLabel: formatDate(item.dateValue, 'short') }))
  const calendarData = calendarCells(selectedData, selectedRange)
  const medianDistance = median(performanceData.map((item) => item.distance))
  const medianPace = median(performanceData.map((item) => item.pace))
  const medianDuration = median(loadPoints.map((item) => item.durationMinutes))
  const medianIntensity = median(loadPoints.map((item) => item.intensity))

  return (
    <>
      <section className="analysis-section-heading running-visual-heading">
        <div>
          <p className="eyebrow">Esplora lo storico</p>
          <h2>Rendimento, efficienza e carico</h2>
          <p>
            Quattro viste complementari per leggere le corse oltre il singolo risultato.
            Premi un punto o un giorno attivo per aprire i dettagli.
          </p>
        </div>
        <PeriodPicker
          value={normalizedPeriod}
          onChange={setPeriod}
          activities={activities}
          idPrefix="running-visual-period"
          dateRange={selectedRange}
          referenceDate={referenceDate}
        />
      </section>

      <section className="running-visual-grid" aria-label="Analisi visuali delle corse">
        <article className="panel running-visual-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Distanza e rendimento</p>
              <h2>Come cambia il passo sulle diverse distanze</h2>
              <p>Più un punto è in alto, più il passo è veloce. Il colore indica l’intensità cardiaca.</p>
            </div>
          </div>
          {performanceData.length ? (
            <>
              <div className="visual-chart-legend heart-rate-scale">
                <span>FC più bassa</span>
                <i aria-hidden="true" />
                <span>FC più alta</span>
              </div>
              <div className="running-visual-chart">
                <ChartContainer>
                  <ScatterChart margin={{ top: 12, right: 26, left: 4, bottom: 10 }}>
                    <CartesianGrid stroke="var(--chart-grid)" />
                    <XAxis
                      type="number"
                      dataKey="distance"
                      name="Distanza"
                      unit=" km"
                      domain={['auto', 'auto']}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="number"
                      dataKey="pace"
                      name="Passo"
                      domain={['auto', 'auto']}
                      reversed
                      tickFormatter={formatPaceDecimal}
                      tickLine={false}
                      axisLine={false}
                      width={54}
                    />
                    {medianDistance != null && (
                      <ReferenceLine x={medianDistance} stroke="var(--chart-muted)" strokeDasharray="5 5" />
                    )}
                    {medianPace != null && (
                      <ReferenceLine y={medianPace} stroke="var(--chart-muted)" strokeDasharray="5 5" />
                    )}
                    <Tooltip
                      cursor={{ strokeDasharray: '4 4' }}
                      formatter={(value, name) => [
                        name === 'Passo'
                          ? `${formatPaceDecimal(value)} /km`
                          : formatDistance(value),
                        name,
                      ]}
                      labelFormatter={(_value, payload) => {
                        const point = payload?.[0]?.payload
                        return point ? `${point.name} · ${formatDate(point.dateValue)}` : ''
                      }}
                    />
                    <Scatter
                      data={performanceData}
                      shape={(props) => (
                        <InteractivePoint
                          {...props}
                          latestId={latestId}
                          onSelect={setSelectedActivity}
                        />
                      )}
                    />
                  </ScatterChart>
                </ChartContainer>
              </div>
            </>
          ) : (
            <div className="comparison-empty">
              <strong>Dati insufficienti</strong>
              <p>Servono distanza e passo validi nel periodo selezionato.</p>
            </div>
          )}
        </article>

        <article className="panel running-visual-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Mappa del carico</p>
              <h2>Durata e intensità della seduta</h2>
              <p>La dimensione della bolla rappresenta il carico cardiaco stimato.</p>
            </div>
          </div>
          {loadPoints.length ? (
            <div className="running-visual-chart">
              <ChartContainer>
                <ScatterChart margin={{ top: 12, right: 28, left: 4, bottom: 10 }}>
                  <CartesianGrid stroke="var(--chart-grid)" />
                  <XAxis
                    type="number"
                    dataKey="durationMinutes"
                    name="Durata"
                    unit=" min"
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="number"
                    dataKey="intensity"
                    name="Intensità"
                    unit="%"
                    domain={['auto', 'auto']}
                    tickLine={false}
                    axisLine={false}
                    width={45}
                  />
                  {medianDuration != null && (
                    <ReferenceLine x={medianDuration} stroke="var(--chart-muted)" strokeDasharray="5 5" />
                  )}
                  {medianIntensity != null && (
                    <ReferenceLine y={medianIntensity} stroke="var(--chart-muted)" strokeDasharray="5 5" />
                  )}
                  <Tooltip
                    cursor={{ strokeDasharray: '4 4' }}
                    formatter={(value, name, item) => {
                      if (name === 'Durata') return [`${Math.round(value)} min`, name]
                      if (name === 'Intensità') return [`${Number(value).toFixed(1)}% FC max`, name]
                      return [item?.payload?.load?.toFixed(1) ?? '—', name]
                    }}
                    labelFormatter={(_value, payload) => {
                      const point = payload?.[0]?.payload
                      return point ? `${point.name} · ${formatDate(point.dateValue)}` : ''
                    }}
                  />
                  <Scatter
                    data={loadPoints}
                    shape={(props) => (
                      <InteractivePoint
                        {...props}
                        radius={props.payload.radius}
                        latestId={latestId}
                        onSelect={setSelectedActivity}
                      />
                    )}
                  />
                </ScatterChart>
              </ChartContainer>
            </div>
          ) : (
            <div className="comparison-empty">
              <strong>Carico non disponibile</strong>
              <p>Servono durata, FC media e FC massima osservata nello storico.</p>
            </div>
          )}
        </article>

        <article className="panel running-visual-panel running-visual-wide">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Efficienza nel tempo</p>
              <h2>Velocità prodotta per battito</h2>
              <p>La linea tratteggiata mostra la mediana mobile delle ultime cinque attività.</p>
            </div>
          </div>
          {efficiencyData.length ? (
            <div className="running-visual-chart efficiency-time-chart">
              <ChartContainer>
                <LineChart data={efficiencyData} margin={{ top: 12, right: 24, left: 4, bottom: 8 }}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="dateLabel" tickLine={false} axisLine={false} minTickGap={24} />
                  <YAxis
                    domain={['auto', 'auto']}
                    tickFormatter={(value) => Number(value).toFixed(1)}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      Number(value).toLocaleString('it-IT', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      }),
                      name,
                    ]}
                    labelFormatter={(_value, payload) => {
                      const point = payload?.[0]?.payload
                      return point ? `${point.name} · ${formatDate(point.dateValue)}` : ''
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rollingEfficiency"
                    name="Mediana mobile"
                    stroke="var(--chart-muted)"
                    strokeWidth={2}
                    strokeDasharray="6 5"
                    dot={false}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="efficiency"
                    name="Efficienza"
                    stroke="#ef5b24"
                    strokeWidth={2.4}
                    dot={(props) => (
                      <InteractivePoint
                        {...props}
                        radius={4}
                        latestId={latestId}
                        onSelect={setSelectedActivity}
                      />
                    )}
                    activeDot={false}
                    connectNulls
                  />
                </LineChart>
              </ChartContainer>
            </div>
          ) : (
            <div className="comparison-empty">
              <strong>Efficienza non disponibile</strong>
              <p>Servono passo e frequenza cardiaca validi.</p>
            </div>
          )}
        </article>

        <article className="panel running-visual-panel running-visual-wide training-calendar-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Calendario degli allenamenti</p>
              <h2>Continuità e carico giorno per giorno</h2>
              <p>Il colore diventa più intenso nei giorni con maggiore carico complessivo.</p>
            </div>
            <span>{selectedData.length} corse</span>
          </div>
          <div className="training-calendar-scroll">
            <div className="training-calendar-layout">
              <div className="training-calendar-weekdays" aria-hidden="true">
                {weekdayLabels.map((label, index) => <span key={`${label}-${index}`}>{label}</span>)}
              </div>
              <div className="training-calendar-grid" role="grid" aria-label="Calendario delle corse">
                {calendarData.map((cell) => {
                  const count = cell.day?.activities.length ?? 0
                  const label = count
                    ? `${formatDate(cell.date)}: ${count} ${count === 1 ? 'corsa' : 'corse'}, ${formatDistance(cell.day.distance)}, ${Math.round(cell.day.duration)} minuti`
                    : `${formatDate(cell.date)}: nessuna corsa`
                  return count ? (
                    <button
                      key={cell.key}
                      type="button"
                      className={`calendar-day level-${cell.level}`}
                      aria-label={`${label}. Apri i dettagli.`}
                      title={label}
                      onClick={() => setSelectedActivity(cell.day.activities[0])}
                    />
                  ) : (
                    <span
                      key={cell.key}
                      className="calendar-day level-0"
                      role="gridcell"
                      aria-label={label}
                      title={label}
                    />
                  )
                })}
              </div>
            </div>
          </div>
          <div className="calendar-legend" aria-label="Scala del carico">
            <span>Meno carico</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <i key={level} className={`calendar-day level-${level}`} aria-hidden="true" />
            ))}
            <span>Più carico</span>
          </div>
        </article>
      </section>

      {selectedActivity && (
        <ActivityDetailDialog
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </>
  )
}

export default RunningVisualAnalysis
