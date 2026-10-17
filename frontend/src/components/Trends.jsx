import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartContainer from './ChartContainer.jsx'
import PeriodPicker from './PeriodPicker.jsx'
import { formatDate, formatDistance, formatDuration, formatPaceDecimal } from '../utils/formatters.js'
import { periodStart } from '../domain/periods.js'
import { racePredictionDistances } from '../domain/racePredictions.js'

const trendGranularities = [
  { value: 'week', label: 'Settimana' },
  { value: 'month', label: 'Mese' },
  { value: 'year', label: 'Anno' },
]
const shortMonth = new Intl.DateTimeFormat('it-IT', { month: 'short' })
const longMonth = new Intl.DateTimeFormat('it-IT', {
  month: 'long',
  year: 'numeric',
})

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

// Gestisce beginning of week.
function beginningOfWeek(date) {
  const result = new Date(date)
  const day = (result.getDay() + 6) % 7
  result.setDate(result.getDate() - day)
  result.setHours(0, 0, 0, 0)
  return result
}

// Gestisce beginning of month.
function beginningOfMonth(date) {
  const result = new Date(date)
  result.setDate(1)
  result.setHours(0, 0, 0, 0)
  return result
}

// Gestisce beginning of year.
function beginningOfYear(date) {
  const result = new Date(date)
  result.setMonth(0, 1)
  result.setHours(0, 0, 0, 0)
  return result
}

// Gestisce beginning of trend period.
function beginningOfTrendPeriod(date, granularity) {
  if (granularity === 'month') return beginningOfMonth(date)
  if (granularity === 'year') return beginningOfYear(date)
  return beginningOfWeek(date)
}

// Gestisce local date key.
function localDateKey(date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// Gestisce activity distance km.
function activityDistanceKm(activity) {
  const km = Number(activity.km)
  if (Number.isFinite(km)) return km
  const metres = Number(activity.distance)
  return Number.isFinite(metres) ? metres / 1000 : 0
}

// Gestisce aggregate trends.
function aggregateTrends(activities, start, end, granularity) {
  const periods = []
  const byDate = new Map()
  const bucketStart = beginningOfTrendPeriod(start, granularity)
  for (const cursor = new Date(bucketStart); cursor <= end;) {
    const trendPeriod = {
      date: localDateKey(cursor),
      km: 0,
      duration: 0,
      runs: 0,
      heartRateTotal: 0,
      heartRateCount: 0,
      longest: null,
    }
    periods.push(trendPeriod)
    byDate.set(trendPeriod.date, trendPeriod)

    if (granularity === 'month') cursor.setMonth(cursor.getMonth() + 1)
    else if (granularity === 'year') cursor.setFullYear(cursor.getFullYear() + 1)
    else cursor.setDate(cursor.getDate() + 7)
  }

  activities.forEach((activity) => {
    const activityDate = new Date(activity.startTimeLocal)
    if (Number.isNaN(activityDate.getTime()) || activityDate < start || activityDate > end) return
    const trendPeriod = byDate.get(
      localDateKey(beginningOfTrendPeriod(activityDate, granularity)),
    )
    if (!trendPeriod) return
    const distance = activityDistanceKm(activity)
    const heartRate = Number(activity.averageHR)
    trendPeriod.km += distance
    trendPeriod.duration += Number(activity.duration) || 0
    trendPeriod.runs += 1
    trendPeriod.longest = trendPeriod.longest == null
      ? distance
      : Math.max(trendPeriod.longest, distance)
    if (Number.isFinite(heartRate)) {
      trendPeriod.heartRateTotal += heartRate
      trendPeriod.heartRateCount += 1
    }
  })

  return periods.map((trendPeriod) => ({
    ...trendPeriod,
    km: Number(trendPeriod.km.toFixed(2)),
    hours: trendPeriod.duration / 3600,
    averageRunKm: trendPeriod.runs ? trendPeriod.km / trendPeriod.runs : 0,
    pace: trendPeriod.km > 0 ? (trendPeriod.duration / 60) / trendPeriod.km : null,
    heartRate: trendPeriod.heartRateCount
      ? trendPeriod.heartRateTotal / trendPeriod.heartRateCount
      : null,
    longest: trendPeriod.longest ?? 0,
  }))
}

// Gestisce metric copy.
function metricCopy(metric, granularity) {
  const words = {
    week: {
      noun: 'settimana',
      adjective: 'settimanale',
      pluralAdjective: 'settimanali',
    },
    month: {
      noun: 'mese',
      adjective: 'mensile',
      pluralAdjective: 'mensili',
    },
    year: {
      noun: 'anno',
      adjective: 'annuale',
      pluralAdjective: 'annuali',
    },
  }[granularity]
  // Gestisce replace period words.
  const replacePeriodWords = (value) => value
    .replaceAll('settimanali', words.pluralAdjective)
    .replaceAll('settimanale', words.adjective)
    .replaceAll('settimana', words.noun)

  return {
    ...metric,
    title: replacePeriodWords(metric.title),
    description: replacePeriodWords(metric.description),
  }
}

// Gestisce trend tick label.
function trendTickLabel(value, granularity, showMonthYear) {
  const date = new Date(`${value}T00:00:00`)
  if (granularity === 'year') return String(date.getFullYear())
  if (granularity === 'month') {
    const month = shortMonth.format(date).replace('.', '')
    return showMonthYear ? `${month} ${String(date.getFullYear()).slice(-2)}` : month
  }
  return formatDate(date, 'short')
}

// Gestisce trend period label.
function trendPeriodLabel(value, granularity) {
  const date = new Date(`${value}T00:00:00`)
  if (granularity === 'year') return `Anno ${date.getFullYear()}`
  if (granularity === 'month') return longMonth.format(date)
  return `Settimana del ${formatDate(date)}`
}

// Gestisce analyze linear trend.
function analyzeLinearTrend(data, key, ignoreZero = false) {
  const points = data
    .map((point, index) => ({
      index,
      rawValue: point[key],
      value: Number(point[key]),
    }))
    .filter((point) => (
      point.rawValue != null
      && Number.isFinite(point.value)
      && (!ignoreZero || point.value > 0)
    ))
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

  const firstIndex = points[0].index
  const lastIndex = points.at(-1).index
  const firstValue = intercept + (slope * firstIndex)
  const lastValue = intercept + (slope * lastIndex)
  const percent = yAverage
    ? ((lastValue - firstValue) / Math.abs(yAverage)) * 100
    : 0

  return {
    percent,
    data: data.map((point, index) => ({
      ...point,
      trendValue: index >= firstIndex && index <= lastIndex
        ? Math.max(0, intercept + (slope * index))
        : null,
    })),
  }
}

// Gestisce run axis scale.
function runAxisScale(data) {
  const maximum = Math.max(0, ...data.map((point) => Number(point.runs) || 0))

  if (maximum <= 5) {
    return {
      domain: [0, maximum === 0 ? 1 : maximum + 0.2],
      ticks: Array.from({ length: maximum + 1 }, (_value, index) => index),
    }
  }

  const step = Math.ceil(maximum / 4)
  const axisMaximum = Math.ceil(maximum / step) * step
  const ticks = []
  for (let value = 0; value <= axisMaximum; value += step) ticks.push(value)

  return {
    domain: [0, axisMaximum + 0.2],
    ticks,
  }
}

// Gestisce trend badge.
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

// Gestisce trend chart.
function TrendChart({ metric: baseMetric, data, granularity }) {
  const metric = metricCopy(baseMetric, granularity)
  const hasData = data.some((point) => (
    point[metric.key] != null && Number.isFinite(Number(point[metric.key]))
  ))
  const isRunCount = metric.key === 'runs'
  const showMonthYear = granularity === 'month' && data.length > 12
  const ignoreZeroTrend = ['pace', 'heartRate'].includes(metric.key)
  const analysis = useMemo(
    () => analyzeLinearTrend(data, metric.key, ignoreZeroTrend),
    [data, metric.key, ignoreZeroTrend],
  )
  const runScale = useMemo(
    () => (isRunCount ? runAxisScale(data) : null),
    [data, isRunCount],
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
          <ChartContainer>
            <LineChart data={analysis.data} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => trendTickLabel(value, granularity, showMonthYear)}
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
                ticks={runScale?.ticks}
                allowDecimals={!isRunCount}
                domain={runScale?.domain
                  ?? (metric.reversed || metric.key === 'heartRate'
                    ? ['auto', 'auto']
                    : [0, 'auto'])}
                reversed={metric.reversed}
              />
              <Tooltip
                itemSorter={(item) => (item?.dataKey === 'trendValue' ? 1 : 0)}
                formatter={(value, name) => [
                  metric.format(value),
                  name,
                ]}
                labelFormatter={(value) => trendPeriodLabel(value, granularity)}
              />
              <Line
                type="linear"
                dataKey={metric.key}
                name={metric.title}
                stroke={metric.color}
                strokeWidth={3}
                dot={{ fill: '#ffffff', stroke: metric.color, strokeWidth: 2, r: 3 }}
                activeDot={{ fill: metric.color, stroke: '#ffffff', strokeWidth: 2, r: 5 }}
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
          </ChartContainer>
        </div>
      ) : (
        <p className="trend-empty">Nessun dato disponibile nel periodo.</p>
      )}
    </article>
  )
}

// Gestisce race prediction trend.
function RacePredictionTrend({ activities, racePredictions, period, granularity }) {
  const start = periodStart(period)
  const end = new Date()
  const buckets = aggregateTrends(activities, start, end, granularity)
  const sourceGranularity = granularity === 'week' ? 'daily' : 'monthly'
  const sourcePredictions = racePredictions
    .filter((prediction) => prediction.granularity === sourceGranularity)
    .sort((first, second) => first.date.localeCompare(second.date))
  const data = buckets.map((bucket) => {
    const bucketStart = new Date(`${bucket.date}T00:00:00`)
    const bucketEnd = granularity === 'week'
      ? new Date(bucketStart.getFullYear(), bucketStart.getMonth(), bucketStart.getDate() + 7)
      : granularity === 'month'
        ? new Date(bucketStart.getFullYear(), bucketStart.getMonth() + 1, 1)
        : new Date(bucketStart.getFullYear() + 1, 0, 1)
    const matchingPredictions = sourcePredictions.filter((prediction) => {
      const date = new Date(`${prediction.date}T00:00:00`)
      return date >= bucketStart && date < bucketEnd
    })
    const prediction = matchingPredictions.at(-1)
    return {
      date: bucket.date,
      '5k': prediction?.['5k'] ?? null,
      '10k': prediction?.['10k'] ?? null,
      halfMarathon: prediction?.halfMarathon ?? null,
      marathon: prediction?.marathon ?? null,
    }
  })
  const distances = racePredictionDistances()
  const hasData = data.some((point) => distances.some((distance) => point[distance.key] != null))

  return (
    <article className="panel prediction-trend-panel">
      <div className="panel-heading prediction-trend-heading">
        <div>
          <p className="eyebrow">Previsioni di gara</p>
          <div className="trend-title-row">
            <h2>Andamento delle previsioni</h2>
          </div>
          <p>Previsioni Garmin ufficiali, sincronizzate per ogni periodo selezionato.</p>
        </div>
        <div className="prediction-legend" aria-label="Legenda delle distanze previste">
          {distances.map((distance) => (
            <span key={distance.key}>
              <i style={{ backgroundColor: distance.color }} aria-hidden="true" />
              {distance.label}
            </span>
          ))}
        </div>
      </div>
      {hasData ? (
        <div className="prediction-trend-chart">
          <ChartContainer>
            <LineChart data={data} margin={{ top: 16, right: 22, left: 4, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis
                dataKey="date"
                tickFormatter={(value) => trendTickLabel(value, granularity, data.length > 12)}
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
                itemSorter={(first, second) => (
                  (distances.findIndex((distance) => distance.key === first?.dataKey) < 0
                    ? distances.length
                    : distances.findIndex((distance) => distance.key === first?.dataKey))
                  - (distances.findIndex((distance) => distance.key === second?.dataKey) < 0
                    ? distances.length
                    : distances.findIndex((distance) => distance.key === second?.dataKey))
                )}
                formatter={(value, name) => [
                  formatDuration(value),
                  distances.find((distance) => distance.key === name)?.label ?? name,
                ]}
                labelFormatter={(value) => trendPeriodLabel(value, granularity)}
              />
              {distances.map((distance) => (
                <Line
                  key={distance.key}
                  type="monotone"
                  dataKey={distance.key}
                  name={distance.key}
                  stroke={distance.color}
                  strokeWidth={3}
                  dot={{ fill: '#ffffff', stroke: distance.color, strokeWidth: 2, r: 3 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ChartContainer>
        </div>
      ) : (
        <div className="prediction-trend-empty">
          <strong>Dati insufficienti</strong>
          <p>Sincronizza Garmin per importare lo storico delle previsioni gara.</p>
        </div>
      )}
    </article>
  )
}

// Gestisce trends.
function Trends({ activities, racePredictions }) {
  const [period, setPeriod] = useState({ amount: 12, unit: 'month' })
  const [granularity, setGranularity] = useState('week')
  const analysis = useMemo(() => {
    const end = new Date()
    const start = periodStart(period)
    return {
      start,
      data: aggregateTrends(activities, start, end, granularity),
    }
  }, [activities, granularity, period])
  const granularityName = {
    week: 'settimana',
    month: 'mese',
    year: 'anno',
  }[granularity]

  return (
    <div className="page-stack">
      <section className="page-heading trends-heading">
        <div>
          <p className="eyebrow">Trend</p>
          <h1>Come sta cambiando la tua corsa.</h1>
          <p>Volume, ritmo, intensità e previsioni di gara aggregati per {granularityName}.</p>
        </div>
        <div className="trend-controls">
          <PeriodPicker
            value={period}
            onChange={setPeriod}
            activities={activities}
            idPrefix="trend-period"
            className="trend-period-picker"
          />
          <div
            className="period-control trend-period-control"
            role="group"
            aria-label="Raggruppamento dei trend"
          >
            <span className="period-control-label">Visualizza per</span>
            {trendGranularities.map((option) => (
              <button
                type="button"
                key={option.value}
                className={granularity === option.value ? 'active' : ''}
                aria-pressed={granularity === option.value}
                onClick={() => setGranularity(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="trends-grid" aria-label="Grafici delle metriche">
        {metricDefinitions.map((metric) => (
          <TrendChart
            key={metric.key}
            metric={metric}
            data={analysis.data}
            granularity={granularity}
          />
        ))}
      </section>

      <RacePredictionTrend
        activities={activities}
        racePredictions={racePredictions}
        period={period}
        granularity={granularity}
      />
    </div>
  )
}

export default Trends
