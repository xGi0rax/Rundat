import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartContainer from './ChartContainer.jsx'
import { formatDate, formatDistance, formatDuration, formatPaceDecimal } from '../utils/formatters.js'

const periods = [7, 14, 30, 60, 90, 180]
const shortMonth = new Intl.DateTimeFormat('it-IT', { month: 'short' })
const volumeGranularities = [
  { value: 'day', label: 'Giorni' },
  { value: 'week', label: 'Settimane' },
  { value: 'month', label: 'Mesi' },
  { value: 'year', label: 'Anni' },
]
const volumeRanges = {
  day: [
    { value: 7, label: '7g' },
    { value: 14, label: '14g' },
    { value: 30, label: '30g' },
  ],
  month: [
    { value: 6, label: '6 mesi' },
    { value: 12, label: '1 anno' },
    { value: 24, label: '2 anni' },
    { value: 'all', label: 'Tutto' },
  ],
  year: [
    { value: 'all', label: 'Tutto' },
  ],
}
const defaultVolumeRanges = {
  day: 30,
  month: 12,
  year: 'all',
}

const metricDefinitions = {
  longest: {
    eyebrow: 'Distanza',
    title: 'Corsa più lunga',
    description: 'La corsa più lunga di ogni settimana.',
    color: '#ef5b24',
  },
  daily: {
    eyebrow: 'Volume',
    title: 'Media giornaliera',
    description: 'La distanza media giornaliera di ogni settimana.',
    color: '#315e3b',
  },
  pace: {
    eyebrow: 'Ritmo',
    title: 'Passo medio',
    description: 'Il passo medio ponderato di ogni settimana.',
    color: '#345f9d',
  },
  heartRate: {
    eyebrow: 'Intensità',
    title: 'FC media',
    description: 'La frequenza cardiaca media di ogni settimana.',
    color: '#b5533c',
  },
}

function beginningOfWeek(date) {
  const result = new Date(date)
  const day = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - day)
  result.setHours(0, 0, 0, 0)
  return result
}

function startOfDay(date) {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

function endOfDay(date) {
  const result = new Date(date)
  result.setHours(23, 59, 59, 999)
  return result
}

function shiftDays(date, days) {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function beginningOfMonth(date) {
  const result = startOfDay(date)
  result.setDate(1)
  return result
}

function beginningOfYear(date) {
  const result = startOfDay(date)
  result.setMonth(0, 1)
  return result
}

function firstMondayOnOrAfter(date) {
  const result = startOfDay(date)
  const dayFromMonday = (result.getDay() + 6) % 7
  if (dayFromMonday !== 0) result.setDate(result.getDate() + (7 - dayFromMonday))
  return result
}

function inclusiveCalendarDays(start, end) {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate())
  return Math.max(1, Math.round((endUtc - startUtc) / 86400000) + 1)
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

function weekRangeLabel(value) {
  const monday = new Date(`${value}T00:00:00`)
  const sunday = new Date(monday)
  sunday.setDate(sunday.getDate() + 6)
  return `${formatDate(monday)} – ${formatDate(sunday)}`
}

function createContinuousWeeks(start, end) {
  const weeks = []
  for (const cursor = beginningOfWeek(start); cursor <= end; cursor.setDate(cursor.getDate() + 7)) {
    weeks.push({
      date: localDateKey(cursor),
      km: 0,
      runs: 0,
      duration: 0,
      elevation: 0,
      longest: null,
      heartRateTotal: 0,
      heartRateCount: 0,
    })
  }
  return weeks
}

function aggregateWeeks(activities, start, end) {
  const weeks = createContinuousWeeks(start, end)
  const byDate = new Map(weeks.map((week) => [week.date, week]))

  activities.forEach((activity) => {
    const activityDate = new Date(activity.startTimeLocal)
    if (Number.isNaN(activityDate.getTime()) || activityDate < start || activityDate > end) return

    const week = byDate.get(localDateKey(beginningOfWeek(activityDate)))
    if (!week) return

    const distance = activityDistanceKm(activity)
    const heartRate = Number(activity.averageHR)
    week.km += distance
    week.runs += 1
    week.duration += Number(activity.duration) || 0
    week.elevation += Number(activity.elevationGain) || 0
    week.longest = week.longest == null ? distance : Math.max(week.longest, distance)
    if (Number.isFinite(heartRate)) {
      week.heartRateTotal += heartRate
      week.heartRateCount += 1
    }
  })

  return weeks.map((week) => ({
    ...week,
    km: Number(week.km.toFixed(2)),
    elevation: Math.round(week.elevation),
  }))
}

function earliestActivityDate(activities) {
  const dates = activities
    .map((activity) => new Date(activity.startTimeLocal))
    .filter((date) => !Number.isNaN(date.getTime()))
  return dates.length ? new Date(Math.min(...dates)) : new Date()
}

function volumeBucketLabel(date, granularity) {
  if (granularity === 'day') return formatDate(date)
  if (granularity === 'month') {
    return new Intl.DateTimeFormat('it-IT', {
      month: 'long',
      year: 'numeric',
    }).format(date)
  }
  return String(date.getFullYear())
}

function aggregateVolume(activities, granularity, range) {
  const now = new Date()
  const earliest = earliestActivityDate(activities)
  let start

  if (granularity === 'day') {
    start = shiftDays(startOfDay(now), -(Number(range) - 1))
  } else if (granularity === 'month') {
    start = range === 'all' ? beginningOfMonth(earliest) : beginningOfMonth(now)
    if (range !== 'all') start.setMonth(start.getMonth() - (Number(range) - 1))
  } else {
    start = beginningOfYear(earliest)
  }

  const buckets = []
  const byDate = new Map()
  const cursor = new Date(start)
  while (cursor <= now) {
    const date = localDateKey(cursor)
    const bucket = {
      date,
      periodLabel: volumeBucketLabel(cursor, granularity),
      km: 0,
      runs: 0,
      duration: 0,
      elevation: 0,
    }
    buckets.push(bucket)
    byDate.set(date, bucket)

    if (granularity === 'day') cursor.setDate(cursor.getDate() + 1)
    if (granularity === 'month') cursor.setMonth(cursor.getMonth() + 1)
    if (granularity === 'year') cursor.setFullYear(cursor.getFullYear() + 1)
  }

  activities.forEach((activity) => {
    const activityDate = new Date(activity.startTimeLocal)
    if (Number.isNaN(activityDate.getTime()) || activityDate < start || activityDate > now) return

    let bucketDate = startOfDay(activityDate)
    if (granularity === 'month') bucketDate = beginningOfMonth(activityDate)
    if (granularity === 'year') bucketDate = beginningOfYear(activityDate)
    const bucket = byDate.get(localDateKey(bucketDate))
    if (!bucket) return

    bucket.km += activityDistanceKm(activity)
    bucket.runs += 1
    bucket.duration += Number(activity.duration) || 0
    bucket.elevation += Number(activity.elevationGain) || 0
  })

  return buckets.map((bucket) => ({
    ...bucket,
    km: Number(bucket.km.toFixed(2)),
    elevation: Math.round(bucket.elevation),
  }))
}

function addTrend(weeks) {
  const count = weeks.length
  if (count === 0) return { data: [], average: 0 }

  const average = weeks.reduce((sum, week) => sum + week.km, 0) / count
  if (count === 1) {
    return { average, data: weeks.map((week) => ({ ...week, trendKm: week.km })) }
  }

  const xAverage = (count - 1) / 2
  const numerator = weeks.reduce(
    (sum, week, index) => sum + (index - xAverage) * (week.km - average),
    0,
  )
  const denominator = weeks.reduce(
    (sum, _week, index) => sum + ((index - xAverage) ** 2),
    0,
  )
  const slope = denominator ? numerator / denominator : 0
  const intercept = average - slope * xAverage

  return {
    average,
    data: weeks.map((week, index) => ({
      ...week,
      trendKm: Math.max(0, intercept + slope * index),
    })),
  }
}

function historyForMetric(activities, metric, months) {
  const end = new Date()
  const rawStart = new Date(end)
  rawStart.setMonth(rawStart.getMonth() - months)
  const start = beginningOfWeek(rawStart)

  return aggregateWeeks(activities, start, end).map((week) => {
    let value = null
    if (metric === 'longest') value = week.longest ?? 0
    if (metric === 'daily') value = week.km / 7
    if (metric === 'pace') value = week.km > 0 ? (week.duration / 60) / week.km : null
    if (metric === 'heartRate') {
      value = week.heartRateCount ? week.heartRateTotal / week.heartRateCount : null
    }
    return { ...week, value }
  })
}

function monthLabel(value) {
  return shortMonth.format(new Date(`${value}T00:00:00`)).replace('.', '')
}

function monthTicks(data) {
  let previousMonth = null
  return data.reduce((ticks, point) => {
    const date = new Date(`${point.date}T00:00:00`)
    const month = `${date.getFullYear()}-${date.getMonth()}`
    if (month !== previousMonth) {
      ticks.push(point.date)
      previousMonth = month
    }
    return ticks
  }, [])
}

function formatMetric(metric, value) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  if (metric === 'pace') return `${formatPaceDecimal(value)} /km`
  if (metric === 'heartRate') return `${Math.round(value)} bpm`
  return formatDistance(value)
}

function VolumeDot({ cx, cy, payload, selectedDate, onSelect }) {
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
      aria-label={`Seleziona ${payload.periodLabel}, ${formatDistance(payload.km)}`}
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

function MetricModal({ activities, metric, onClose }) {
  const [months, setMonths] = useState(6)
  const definition = metricDefinitions[metric]
  const data = useMemo(
    () => historyForMetric(activities, metric, months),
    [activities, metric, months],
  )
  const visibleValues = data.map((point) => point.value).filter(Number.isFinite)
  const averageValues = visibleValues
  const historyAverage = averageValues.length
    ? averageValues.reduce((sum, value) => sum + value, 0) / averageValues.length
    : null
  const hasMetricData = ['longest', 'daily'].includes(metric)
    ? data.some((point) => point.runs > 0)
    : visibleValues.length > 0
  const maximumDistance = visibleValues.length ? Math.max(...visibleValues) : 0
  const visibleMilestones = metric === 'longest'
    ? [5, 10, 21.1, 42.195].filter((distance) => distance <= maximumDistance)
    : []
  const visibleMonthTicks = monthTicks(data)

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', closeOnEscape)
      document.body.style.overflow = ''
    }
  }, [onClose])

  const yTickFormatter = (value) => {
    if (metric === 'pace') return formatPaceDecimal(value)
    if (metric === 'heartRate') return Math.round(value)
    if (metric === 'longest') {
      const milestoneLabels = { 5: '5K', 10: '10K', 21.1: '21,1K', 42.195: '42,2K' }
      return milestoneLabels[value] ?? `${Number(value).toLocaleString('it-IT')} km`
    }
    return Number(value).toLocaleString('it-IT', { maximumFractionDigits: 1 })
  }

  return (
    <div className="metric-modal-backdrop" onMouseDown={onClose}>
      <section
        className="metric-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="metric-modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="metric-modal-header">
          <div>
            <p className="eyebrow">{definition.eyebrow}</p>
            <h2 id="metric-modal-title">{definition.title}</h2>
            <p>{definition.description}</p>
          </div>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Chiudi">
            x
          </button>
        </header>

        <div className="modal-range-control" role="group" aria-label="Intervallo storico">
          <button
            type="button"
            className={months === 1 ? 'active' : ''}
            aria-pressed={months === 1}
            onClick={() => setMonths(1)}
          >
            Ultimo mese
          </button>
          <button
            type="button"
            className={months === 2 ? 'active' : ''}
            aria-pressed={months === 2}
            onClick={() => setMonths(2)}
          >
            Ultimi 2 mesi
          </button>
          <button
            type="button"
            className={months === 6 ? 'active' : ''}
            aria-pressed={months === 6}
            onClick={() => setMonths(6)}
          >
            Ultimi 6 mesi
          </button>
          <button
            type="button"
            className={months === 12 ? 'active' : ''}
            aria-pressed={months === 12}
            onClick={() => setMonths(12)}
          >
            Ultimo anno
          </button>
        </div>

        <div className="metric-modal-chart">
          {!hasMetricData ? (
            <p className="chart-empty">Nessun dato disponibile per questo intervallo.</p>
          ) : (
            <ChartContainer>
              <LineChart data={data} margin={{ top: 22, right: 22, left: 4, bottom: 4 }}>
                <CartesianGrid vertical={false} stroke="#e1e4df" />
                <XAxis
                  dataKey="date"
                  ticks={visibleMonthTicks}
                  tickFormatter={monthLabel}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  orientation="right"
                  tickFormatter={yTickFormatter}
                  tickLine={false}
                  axisLine={false}
                  width={metric === 'pace' ? 48 : 58}
                  ticks={metric === 'longest' && visibleMilestones.length
                    ? [0, ...visibleMilestones]
                    : undefined}
                  domain={metric === 'pace' || metric === 'heartRate'
                    ? ['auto', 'auto']
                    : [0, 'auto']}
                  padding={['longest', 'daily'].includes(metric) ? { bottom: 10 } : undefined}
                  reversed={metric === 'pace'}
                />
                <Tooltip
                  formatter={(value) => [formatMetric(metric, value), definition.title]}
                  labelFormatter={(value) => weekRangeLabel(value)}
                />
                {historyAverage != null && (
                  <ReferenceLine
                    y={historyAverage}
                    stroke="#667068"
                    strokeWidth={2}
                    strokeDasharray="7 5"
                    label={{
                      value: `Media ${formatMetric(metric, historyAverage)}`,
                      position: 'insideTopLeft',
                      fill: '#667068',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  />
                )}
                {visibleMilestones.map((distance) => (
                  <ReferenceLine
                    key={distance}
                    y={distance}
                    stroke="#d4a08b"
                    strokeDasharray="3 5"
                  />
                ))}
                <Line
                  type="linear"
                  dataKey="value"
                  name={definition.title}
                  stroke={definition.color}
                  strokeWidth={3}
                  connectNulls
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ChartContainer>
          )}
        </div>
      </section>
    </div>
  )
}

function Analytics({ activities }) {
  const [period, setPeriod] = useState(30)
  const [periodOffset, setPeriodOffset] = useState(0)
  const [alignToMonday, setAlignToMonday] = useState(false)
  const [volumeGranularity, setVolumeGranularity] = useState('day')
  const [volumeRange, setVolumeRange] = useState(defaultVolumeRanges.day)
  const [selectedVolumeKey, setSelectedVolumeKey] = useState(null)
  const [showWeeklyAverage, setShowWeeklyAverage] = useState(false)
  const [showWeeklyTrend, setShowWeeklyTrend] = useState(false)
  const [openMetric, setOpenMetric] = useState(null)

  const dateRange = useMemo(() => {
    const now = new Date()
    const today = startOfDay(now)

    if (!alignToMonday) {
      const endDate = shiftDays(today, -(period * periodOffset))
      const start = shiftDays(endDate, -(period - 1))
      return {
        start,
        end: periodOffset === 0 ? now : endOfDay(endDate),
      }
    }

    const exactCurrentStart = shiftDays(today, -(period - 1))
    const currentStart = firstMondayOnOrAfter(exactCurrentStart)
    const currentWeekStart = beginningOfWeek(today)
    const weeksInBlock = Math.round(
      (currentWeekStart - currentStart) / (7 * 86400000),
    ) + 1

    if (periodOffset === 0) return { start: currentStart, end: now }

    const start = shiftDays(currentStart, -(periodOffset * weeksInBlock * 7))
    const nextBlockStart = shiftDays(
      currentStart,
      -((periodOffset - 1) * weeksInBlock * 7),
    )
    return { start, end: new Date(nextBlockStart.getTime() - 1) }
  }, [alignToMonday, period, periodOffset])

  const filtered = useMemo(
    () => activities.filter((activity) => {
      const date = new Date(activity.startTimeLocal)
      return date >= dateRange.start && date <= dateRange.end
    }),
    [activities, dateRange],
  )

  const volumeAnalysis = useMemo(
    () => addTrend(aggregateVolume(activities, volumeGranularity, volumeRange)),
    [activities, volumeGranularity, volumeRange],
  )
  const selectedVolume = volumeAnalysis.data.find((point) => point.date === selectedVolumeKey)
    ?? volumeAnalysis.data.at(-1)
  const volumeShowsYears = volumeGranularity === 'month' && volumeAnalysis.data.length > 12

  const volumeTickFormatter = (value) => {
    const date = new Date(`${value}T00:00:00`)
    if (volumeGranularity === 'day') return formatDate(date, 'short')
    if (volumeGranularity === 'year') return String(date.getFullYear())
    const month = shortMonth.format(date).replace('.', '')
    return volumeShowsYears ? `${month} ${String(date.getFullYear()).slice(-2)}` : month
  }

  const volumeSelectionTitle = {
    day: 'Giorno selezionato',
    month: 'Mese selezionato',
    year: 'Anno selezionato',
  }[volumeGranularity]

  const periodMetrics = useMemo(() => {
    const totalDistance = filtered.reduce(
      (sum, activity) => sum + activityDistanceKm(activity),
      0,
    )
    const totalDuration = filtered.reduce(
      (sum, activity) => sum + (Number(activity.duration) || 0),
      0,
    )
    const heartRates = filtered
      .map((activity) => Number(activity.averageHR))
      .filter(Number.isFinite)
    const longestActivity = filtered.reduce((longest, activity) => (
      !longest || activityDistanceKm(activity) > activityDistanceKm(longest)
        ? activity
        : longest
    ), null)
    const representedDays = inclusiveCalendarDays(dateRange.start, dateRange.end)

    return {
      totalDistance,
      totalDuration,
      averageRunDistance: filtered.length ? totalDistance / filtered.length : null,
      runCount: filtered.length,
      longest: longestActivity ? activityDistanceKm(longestActivity) : null,
      longestDate: longestActivity ? longestActivity.startTimeLocal : null,
      daily: totalDistance / representedDays,
      pace: totalDistance > 0 ? (totalDuration / 60) / totalDistance : null,
      heartRate: heartRates.length
        ? heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length
        : null,
    }
  }, [filtered, dateRange])

  const selectPeriod = (value) => {
    setPeriod(value)
    setPeriodOffset(0)
  }

  const showPreviousPeriod = () => {
    setPeriodOffset((value) => value + 1)
  }

  const showNextPeriod = () => {
    setPeriodOffset((value) => Math.max(0, value - 1))
  }

  const selectVolumeGranularity = (value) => {
    setVolumeGranularity(value)
    setVolumeRange(defaultVolumeRanges[value])
    setSelectedVolumeKey(null)
  }

  const metricCards = [
    {
      key: 'runCount',
      label: 'Corse effettuate',
      value: periodMetrics.runCount.toLocaleString('it-IT'),
      detail: 'Numero di corse nell\'intervallo',
      interactive: false,
    },
    {
      key: 'totalDistance',
      label: 'Distanza totale',
      value: formatDistance(periodMetrics.totalDistance),
      detail: 'Totale dell’intervallo mostrato',
      interactive: false,
      primary: true,
    },
    {
      key: 'totalDuration',
      label: 'Tempo totale',
      value: formatDuration(periodMetrics.totalDuration),
      detail: 'Tempo di corsa nell’intervallo',
      interactive: false,
      primary: true,
    },
    {
      key: 'averageRunDistance',
      label: 'Distanza media per corsa',
      value: formatDistance(periodMetrics.averageRunDistance),
      detail: 'Media delle corse effettuate',
      interactive: false,
    },
    {
      key: 'longest',
      label: 'Corsa più lunga',
      value: formatMetric('longest', periodMetrics.longest),
      detail: periodMetrics.longestDate ? formatDate(periodMetrics.longestDate) : 'Nessuna corsa',
      interactive: true,
    },
    {
      key: 'daily',
      label: 'Media giornaliera',
      value: formatMetric('daily', periodMetrics.daily),
      detail: 'Distanza media per giorno',
      interactive: true,
    },
    {
      key: 'pace',
      label: 'Passo medio',
      value: formatMetric('pace', periodMetrics.pace),
      detail: 'Ponderato sulla distanza',
      interactive: true,
    },
    {
      key: 'heartRate',
      label: 'FC media',
      value: formatMetric('heartRate', periodMetrics.heartRate),
      detail: 'Media delle attività',
      interactive: true,
    },
  ]

  return (
    <div className="page-stack">
      <section className="page-heading analytics-heading">
        <div>
          <p className="eyebrow">Approfondimenti</p>
          <h1>Le metriche nel tempo.</h1>
          <p>Esplora il volume e l'andamento delle tue corse nel periodo scelto.</p>
        </div>
        <div className="analytics-period-settings">
          <div className="period-control analytics-top-period" role="group" aria-label="Periodo di analisi">
            {periods.map((value) => (
              <button
                type="button"
                key={value}
                className={period === value ? 'active' : ''}
                aria-pressed={period === value}
                onClick={() => selectPeriod(value)}
              >
                {value}g
              </button>
            ))}
          </div>
          <label className="monday-alignment-control">
            <input
              type="checkbox"
              checked={alignToMonday}
              onChange={(event) => {
                setAlignToMonday(event.target.checked)
                setPeriodOffset(0)
              }}
            />
            Fai partire il periodo da lunedì
          </label>
        </div>
      </section>

      <div className="analytics-date-navigation">
        <button
          type="button"
          className="date-navigation-button"
          onClick={showPreviousPeriod}
          aria-label={`Mostra i ${period} giorni precedenti`}
          title={`Vai indietro di ${period} giorni`}
        >
          ←
        </button>
        <div className="analytics-date-range" aria-live="polite">
          <strong>
            {formatDate(dateRange.start)} – {formatDate(dateRange.end)}
          </strong>
        </div>
        <button
          type="button"
          className="date-navigation-button"
          onClick={showNextPeriod}
          disabled={periodOffset === 0}
          aria-label={`Mostra i ${period} giorni successivi`}
          title={periodOffset === 0 ? 'Sei già nel periodo attuale' : `Vai avanti di ${period} giorni`}
        >
          →
        </button>
      </div>

      <section className="period-metrics-grid" aria-label={`Metriche degli ultimi ${period} giorni`}>
        {metricCards.map((card) => {
          const content = (
            <>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.detail}</small>
              {card.interactive && <em>Vedi andamento storico →</em>}
            </>
          )

          return card.interactive ? (
            <button
              type="button"
              className="period-metric-card"
              key={card.key}
              onClick={() => setOpenMetric(card.key)}
              aria-label={`${card.label}: ${card.value}. Apri andamento storico`}
            >
              {content}
            </button>
          ) : (
            <article
              className={`period-metric-card period-metric-card-static${card.primary ? ' period-metric-card-primary' : ''}`}
              key={card.key}
            >
              {content}
            </article>
          )
        })}
      </section>

      <article className="panel analytics-panel weekly-progress-panel volume-panel">
        <div className="volume-panel-header">
          <div>
            <p className="eyebrow">Volume</p>
            <h2>Volume di corsa</h2>
            <p>Visualizza i chilometri percorsi per giorno, mese o anno.</p>
          </div>
          <div className="volume-controls">
            <div className="period-control" role="group" aria-label="Raggruppamento del volume">
              {volumeGranularities.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={volumeGranularity === option.value ? 'active' : ''}
                  aria-pressed={volumeGranularity === option.value}
                  onClick={() => selectVolumeGranularity(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="period-control" role="group" aria-label="Intervallo del volume">
              {volumeRanges[volumeGranularity].map((option) => (
                <button
                  type="button"
                  key={option.value}
                  className={volumeRange === option.value ? 'active' : ''}
                  aria-pressed={volumeRange === option.value}
                  onClick={() => {
                    setVolumeRange(option.value)
                    setSelectedVolumeKey(null)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {selectedVolume && (
          <div className="weekly-progress-summary" aria-live="polite">
            <div className="weekly-progress-title">
              <span>{volumeSelectionTitle}</span>
              <small>{selectedVolume.periodLabel}</small>
            </div>
            <strong>{formatDistance(selectedVolume.km)}</strong>
            <div className="weekly-progress-details">
              <span><b>{formatDuration(selectedVolume.duration)}</b> tempo</span>
              <span><b>{selectedVolume.elevation.toLocaleString('it-IT')} m</b> dislivello</span>
              <span>
                <b>{selectedVolume.runs}</b> {selectedVolume.runs === 1 ? 'corsa' : 'corse'}
              </span>
            </div>
          </div>
        )}

        <div className="weekly-overlays" aria-label="Elementi aggiuntivi del grafico">
          <label>
            <input
              type="checkbox"
              checked={showWeeklyAverage}
              onChange={(event) => setShowWeeklyAverage(event.target.checked)}
            />
            <span className="overlay-swatch average" aria-hidden="true" />
            Media del periodo ({formatDistance(volumeAnalysis.average)})
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
          <div className="analytics-chart weekly-chart">
            <ChartContainer>
              <AreaChart
                data={volumeAnalysis.data}
                margin={{ top: 14, right: 18, left: 4, bottom: 0 }}
                onClick={(state) => {
                  const point = state?.activePayload?.[0]?.payload
                  if (point) setSelectedVolumeKey(point.date)
                }}
              >
                <CartesianGrid vertical={false} stroke="#d8d9d6" />
                <XAxis
                  dataKey="date"
                  tickFormatter={volumeTickFormatter}
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                />
                <YAxis
                  orientation="right"
                  tickFormatter={(value) => `${Math.round(value)} km`}
                  tickLine={false}
                  axisLine={false}
                  width={58}
                  tickCount={3}
                  domain={[0, 'auto']}
                />
                <Tooltip
                  itemSorter={(item) => (item.dataKey === 'trendKm' ? 1 : 0)}
                  formatter={(value, name) => [
                    formatDistance(value),
                    name,
                  ]}
                  labelFormatter={(_value, payload) => payload?.[0]?.payload?.periodLabel ?? ''}
                  cursor={{ stroke: '#ef5b24', strokeWidth: 2 }}
                />
                {selectedVolume && (
                  <ReferenceLine x={selectedVolume.date} stroke="#ef5b24" strokeWidth={2} />
                )}
                {showWeeklyAverage && (
                  <ReferenceLine
                    y={volumeAnalysis.average}
                    stroke="#315e3b"
                    strokeWidth={2}
                    strokeDasharray="6 5"
                    label={{
                      value: formatDistance(volumeAnalysis.average),
                      position: 'insideTopLeft',
                      fill: '#315e3b',
                      fontSize: 12,
                      fontWeight: 700,
                    }}
                  />
                )}
                <Area
                  type="linear"
                  dataKey="km"
                  name="Distanza"
                  stroke="#ef5b24"
                  strokeWidth={4}
                  fill="#fbd8c7"
                  fillOpacity={0.9}
                  cursor="pointer"
                  dot={(props) => (
                    <VolumeDot
                      {...props}
                      selectedDate={selectedVolume?.date}
                      onSelect={setSelectedVolumeKey}
                    />
                  )}
                  activeDot={false}
                  onClick={(entry) => {
                    if (entry?.date) setSelectedVolumeKey(entry.date)
                  }}
                />
                {showWeeklyTrend && (
                  <Line
                    type="linear"
                    dataKey="trendKm"
                    name="Tendenza"
                    stroke="#345f9d"
                    strokeWidth={3}
                    strokeDasharray="9 5"
                    dot={false}
                    activeDot={false}
                    isAnimationActive={false}
                  />
                )}
              </AreaChart>
            </ChartContainer>
          </div>
        </div>
      </article>

      {openMetric && (
        <MetricModal
          activities={activities}
          metric={openMetric}
          onClose={() => setOpenMetric(null)}
        />
      )}
    </div>
  )
}

export default Analytics
