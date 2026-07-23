import { useMemo, useState } from 'react'
import {
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

const trendPeriods = [
  { value: 6, label: '6 mesi' },
  { value: 12, label: '1 anno' },
  { value: 24, label: '2 anni' },
  { value: 'all', label: 'Tutto' },
]

const recordLabels = {
  '1k': '1 km',
  '5k': '5 km',
  '10k': '10 km',
  'Half Marathon': 'Mezza maratona',
  'Full Marathon': 'Maratona',
}

const metricDefinitions = [
  {
    key: 'km',
    eyebrow: 'Volume',
    title: 'Distanza settimanale',
    description: 'Chilometri percorsi ogni settimana.',
    color: '#ef5b24',
    format: (value) => formatDistance(value),
  },
  {
    key: 'hours',
    eyebrow: 'Volume',
    title: 'Tempo settimanale',
    description: 'Ore complessive di corsa ogni settimana.',
    color: '#315e3b',
    format: (value) => `${Number(value).toLocaleString('it-IT', { maximumFractionDigits: 1 })} h`,
  },
  {
    key: 'runs',
    eyebrow: 'Costanza',
    title: 'Corse settimanali',
    description: 'Numero di attività registrate ogni settimana.',
    color: '#87672d',
    format: (value) => `${Math.round(value)} ${Math.round(value) === 1 ? 'corsa' : 'corse'}`,
  },
  {
    key: 'averageRunKm',
    eyebrow: 'Distanza',
    title: 'Distanza media per corsa',
    description: 'Lunghezza media delle corse di ogni settimana.',
    color: '#4f7d59',
    format: (value) => formatDistance(value),
  },
  {
    key: 'pace',
    eyebrow: 'Ritmo',
    title: 'Passo medio',
    description: 'Passo medio ponderato sulla distanza settimanale.',
    color: '#345f9d',
    format: (value) => `${formatPaceDecimal(value)} /km`,
    reversed: true,
    lowerIsBetter: true,
  },
  {
    key: 'heartRate',
    eyebrow: 'Intensità',
    title: 'Frequenza cardiaca media',
    description: 'Media delle frequenze cardiache registrate.',
    color: '#b5533c',
    format: (value) => `${Math.round(value)} bpm`,
    directionOnly: true,
  },
  {
    key: 'longest',
    eyebrow: 'Resistenza',
    title: 'Corsa più lunga',
    description: 'Distanza massima raggiunta in ciascuna settimana.',
    color: '#70549b',
    format: (value) => formatDistance(value),
  },
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

function activityDistanceKm(activity) {
  const km = Number(activity.km)
  if (Number.isFinite(km)) return km
  const metres = Number(activity.distance)
  return Number.isFinite(metres) ? metres / 1000 : 0
}

function rangeStart(activities, period) {
  if (period === 'all') {
    const dates = activities
      .map((activity) => new Date(activity.startTimeLocal))
      .filter((date) => !Number.isNaN(date.getTime()))
    return dates.length ? beginningOfWeek(new Date(Math.min(...dates))) : beginningOfWeek(new Date())
  }
  const start = new Date()
  start.setMonth(start.getMonth() - period)
  return beginningOfWeek(start)
}

function aggregateWeeklyTrends(activities, start, end) {
  const weeks = []
  const byDate = new Map()
  for (const cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 7)) {
    const week = {
      date: localDateKey(cursor),
      km: 0,
      duration: 0,
      runs: 0,
      heartRateTotal: 0,
      heartRateCount: 0,
      longest: null,
    }
    weeks.push(week)
    byDate.set(week.date, week)
  }

  activities.forEach((activity) => {
    const activityDate = new Date(activity.startTimeLocal)
    if (activityDate < start || activityDate > end) return
    const week = byDate.get(localDateKey(beginningOfWeek(activityDate)))
    if (!week) return
    const distance = activityDistanceKm(activity)
    const heartRate = Number(activity.averageHR)
    week.km += distance
    week.duration += Number(activity.duration) || 0
    week.runs += 1
    week.longest = week.longest == null ? distance : Math.max(week.longest, distance)
    if (Number.isFinite(heartRate)) {
      week.heartRateTotal += heartRate
      week.heartRateCount += 1
    }
  })

  return weeks.map((week) => ({
    ...week,
    km: Number(week.km.toFixed(2)),
    hours: week.duration / 3600,
    averageRunKm: week.runs ? week.km / week.runs : null,
    pace: week.km > 0 ? (week.duration / 60) / week.km : null,
    heartRate: week.heartRateCount ? week.heartRateTotal / week.heartRateCount : null,
  }))
}

function analyzeLinearTrend(data, key) {
  const points = data
    .map((point, index) => ({ index, value: Number(point[key]) }))
    .filter((point) => Number.isFinite(point.value))
  if (points.length === 0) return { data, percent: null }

  const xAverage = points.reduce((sum, point) => sum + point.index, 0) / points.length
  const yAverage = points.reduce((sum, point) => sum + point.value, 0) / points.length
  const denominator = points.reduce(
    (sum, point) => sum + ((point.index - xAverage) ** 2),
    0,
  )
  const numerator = points.reduce(
    (sum, point) => sum + ((point.index - xAverage) * (point.value - yAverage)),
    0,
  )
  const slope = denominator ? numerator / denominator : 0
  const intercept = yAverage - (slope * xAverage)

  const firstValue = intercept
  const lastValue = intercept + (slope * Math.max(0, data.length - 1))
  const percent = yAverage
    ? ((lastValue - firstValue) / Math.abs(yAverage)) * 100
    : 0

  return {
    percent,
    data: data.map((point, index) => ({
      ...point,
      trendValue: Math.max(0, intercept + (slope * index)),
    })),
  }
}

function TrendBadge({ percent, lowerIsBetter = false, directionOnly = false }) {
  if (percent == null || !Number.isFinite(percent)) return null

  const absolutePercent = Math.abs(percent)
  if (absolutePercent < 1) {
    return <span className="trend-badge stable">→ Stabile</span>
  }

  const rising = percent > 0
  const arrow = rising ? '↗' : '↘'
  const formatted = absolutePercent.toLocaleString('it-IT', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })

  if (directionOnly) {
    return (
      <span className="trend-badge neutral">
        {arrow} {rising ? 'In aumento' : 'In calo'} {formatted}%
      </span>
    )
  }

  if (lowerIsBetter) {
    return (
      <span className={`trend-badge ${rising ? 'negative' : 'positive'}`}>
        {arrow} {rising ? 'Peggiora' : 'Migliora'} {formatted}%
      </span>
    )
  }

  return (
    <span className={`trend-badge ${rising ? 'positive' : 'negative'}`}>
      {arrow} {rising ? 'In aumento' : 'In calo'} {formatted}%
    </span>
  )
}

function TrendChart({ metric, data }) {
  const hasData = data.some((point) => Number.isFinite(point[metric.key]))
  const analysis = useMemo(
    () => analyzeLinearTrend(data, metric.key),
    [data, metric.key],
  )
  return (
    <article className="panel trend-card">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">{metric.eyebrow}</p>
          <div className="trend-title-row">
            <h2>{metric.title}</h2>
            <TrendBadge
              percent={analysis.percent}
              lowerIsBetter={metric.lowerIsBetter}
              directionOnly={metric.directionOnly}
            />
          </div>
          <p>{metric.description}</p>
        </div>
      </div>
      {hasData ? (
        <div className="trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analysis.data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e1e4df" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => formatDate(value, 'short')}
                tickLine={false}
                axisLine={false}
                minTickGap={38}
              />
              <YAxis
                orientation="right"
                tickFormatter={(value) => metric.format(value).replace(' km', '')}
                tickLine={false}
                axisLine={false}
                width={58}
                domain={metric.reversed || metric.key === 'heartRate' ? ['auto', 'auto'] : [0, 'auto']}
                reversed={metric.reversed}
              />
              <Tooltip
                formatter={(value, name) => [
                  metric.format(value),
                  name === 'trendValue' ? 'Andamento' : metric.title,
                ]}
                labelFormatter={(value) => `Settimana del ${formatDate(value)}`}
              />
              <Line
                type="linear"
                dataKey={metric.key}
                stroke={metric.color}
                strokeWidth={3}
                dot={false}
                activeDot={{ r: 5 }}
                connectNulls={false}
              />
              <Line
                type="linear"
                dataKey="trendValue"
                name="Andamento"
                stroke="#667068"
                strokeWidth={2}
                strokeDasharray="8 6"
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="trend-empty">Nessun dato disponibile nel periodo.</p>
      )}
    </article>
  )
}

function recordDataForRange(recordHistory, recordKey, start, period) {
  const records = recordHistory
    .filter((record) => record.recordKey === recordKey)
    .sort((a, b) => new Date(a.date) - new Date(b.date))
  if (period === 'all') return records

  const inside = records.filter((record) => new Date(`${record.date}T00:00:00`) >= start)
  const preceding = records.filter((record) => new Date(`${record.date}T00:00:00`) < start).at(-1)
  return preceding
    ? [{ ...preceding, date: localDateKey(start), baseline: true }, ...inside]
    : inside
}

function RecordTrend({ history, start, period }) {
  const availableRecords = Object.keys(recordLabels).filter((recordKey) => (
    history.some((record) => record.recordKey === recordKey)
  ))
  const [selectedRecord, setSelectedRecord] = useState(null)
  const activeRecord = availableRecords.includes(selectedRecord)
    ? selectedRecord
    : availableRecords[0]
  const data = useMemo(
    () => (
      activeRecord
        ? recordDataForRange(history, activeRecord, start, period)
        : []
    ),
    [activeRecord, history, period, start],
  )
  const analysis = useMemo(() => analyzeLinearTrend(data, 'duration'), [data])

  return (
    <article className="panel record-trend-panel">
      <div className="panel-heading record-trend-heading">
        <div>
          <p className="eyebrow">Record Garmin</p>
          <div className="trend-title-row">
            <h2>Progressione dei record personali</h2>
            <TrendBadge percent={analysis.percent} lowerIsBetter />
          </div>
          <p>Ogni punto rappresenta un record restituito da Garmin Connect.</p>
        </div>
        {availableRecords.length > 0 && (
          <div className="record-trend-selector" role="group" aria-label="Distanza del record">
            {availableRecords.map((recordKey) => (
              <button
                type="button"
                key={recordKey}
                className={activeRecord === recordKey ? 'active' : ''}
                aria-pressed={activeRecord === recordKey}
                onClick={() => setSelectedRecord(recordKey)}
              >
                {recordLabels[recordKey]}
              </button>
            ))}
          </div>
        )}
      </div>

      {data.length > 0 ? (
        <div className="record-trend-chart">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={analysis.data} margin={{ top: 16, right: 22, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="#e1e4df" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => formatDate(value, 'short')}
                tickLine={false}
                axisLine={false}
                minTickGap={36}
              />
              <YAxis
                orientation="right"
                tickFormatter={formatDuration}
                tickLine={false}
                axisLine={false}
                width={64}
                domain={['auto', 'auto']}
                reversed
              />
              <Tooltip
                formatter={(value, name) => [
                  formatDuration(value),
                  name === 'trendValue' ? 'Andamento' : recordLabels[activeRecord],
                ]}
                labelFormatter={(value) => formatDate(value)}
              />
              <Line
                type="stepAfter"
                dataKey="duration"
                stroke="#ef5b24"
                strokeWidth={3}
                dot={{ r: 4, fill: '#ffffff', strokeWidth: 3 }}
                activeDot={{ r: 6 }}
              />
              {data.length > 1 ? (
                <Line
                  type="linear"
                  dataKey="trendValue"
                  name="Andamento"
                  stroke="#667068"
                  strokeWidth={2}
                  strokeDasharray="8 6"
                  dot={false}
                  activeDot={false}
                  isAnimationActive={false}
                />
              ) : (
                <ReferenceLine
                  y={data[0].duration}
                  stroke="#667068"
                  strokeWidth={2}
                  strokeDasharray="8 6"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="record-trend-empty">
          <strong>Nessuno storico disponibile</strong>
          <p>Sincronizza Garmin per salvare il primo punto dei tuoi record.</p>
        </div>
      )}
    </article>
  )
}

function Trends({ activities, recordHistory }) {
  const [period, setPeriod] = useState(12)
  const analysis = useMemo(() => {
    const end = new Date()
    const start = rangeStart(activities, period)
    return {
      start,
      data: aggregateWeeklyTrends(activities, start, end),
    }
  }, [activities, period])

  return (
    <div className="page-stack">
      <section className="page-heading trends-heading">
        <div>
          <p className="eyebrow">Trend</p>
          <h1>Come sta cambiando la tua corsa.</h1>
          <p>Volume, ritmo, intensità e record personali letti settimana dopo settimana.</p>
        </div>
        <div className="period-control trend-period-control" role="group" aria-label="Periodo dei trend">
          {trendPeriods.map((option) => (
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
      </section>

      <section className="trends-grid" aria-label="Grafici delle metriche">
        {metricDefinitions.map((metric) => (
          <TrendChart key={metric.key} metric={metric} data={analysis.data} />
        ))}
      </section>

      <RecordTrend
        history={recordHistory}
        start={analysis.start}
        period={period}
      />
    </div>
  )
}

export default Trends
