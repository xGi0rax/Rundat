import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import ChartContainer from './ChartContainer.jsx'
import PeriodPicker from './PeriodPicker.jsx'
import { activityType, analyzeCombinedActivities } from '../domain/activityAnalysis.js'
import { HEART_RATE_ZONE_COLORS } from '../domain/dashboardAnalysis.js'
import { periodRange, shiftPeriod } from '../domain/periods.js'
import { formatDate, formatDistance, formatDuration } from '../utils/formatters.js'

// Gestisce history label.
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

// Gestisce history tooltip label.
function historyTooltipLabel(value, payload, granularity) {
  const point = payload?.[0]?.payload
  if (!point) return historyLabel(value, granularity)
  if (point.startDate === point.endDate) return formatDate(point.startDate)
  return `${formatDate(point.startDate)} – ${formatDate(point.endDate)}`
}

function ZoneBarShape({ x, y, width, height, fill, payload, index }) {
  const isTopZone = payload?.topZone === index
  const totalMinutes = Number(payload?.totalMinutes) || 0
  const totalSeconds = Math.round(totalMinutes * 60)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const formattedTotal = [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':')
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={fill} />
      {isTopZone && totalMinutes > 0 && (
        <text
          x={x + (width / 2)}
          y={y - 6}
          textAnchor="middle"
          fill="var(--ink)"
          fontSize={11}
        >
          {formattedTotal}
        </text>
      )}
    </g>
  )
}

function periodAlignmentLabel(unit) {
  if (unit === 'month') return 'Fai partire a inizio mese'
  if (unit === 'year') return "Fai partire a inizio anno"
  return 'Fai partire la settimana da lunedì'
}

function alignedPeriodRange(period, referenceDate, offset = 0) {
  const anchor = new Date(referenceDate)
  if (period.unit === 'week') {
    const dayFromMonday = (anchor.getDay() + 6) % 7
    anchor.setDate(anchor.getDate() - dayFromMonday)
  } else if (period.unit === 'month') {
    anchor.setDate(1)
  } else {
    anchor.setMonth(0, 1)
  }
  anchor.setHours(0, 0, 0, 0)

  const unitPeriod = { amount: 1, unit: period.unit }
  const blockStart = shiftPeriod(
    anchor,
    unitPeriod,
    -((period.amount - 1) + (period.amount * offset)),
  )
  const nextBlockStart = shiftPeriod(blockStart, unitPeriod, period.amount)
  return {
    start: blockStart,
    end: offset === 0 ? new Date(referenceDate) : new Date(nextBlockStart.getTime() - 1),
  }
}

function comparisonRanges(
  period,
  alignToMonday,
  referenceDate = new Date(),
  offset = 0,
) {
  const current = periodRange(period, offset, referenceDate)
  if (!alignToMonday) {
    return {
      current,
      previous: periodRange(period, offset + 1, referenceDate),
    }
  }
  const alignedCurrent = alignedPeriodRange(period, referenceDate, offset)
  const previous = alignedPeriodRange(period, referenceDate, offset + 1)
  return {
    current: alignedCurrent,
    previous,
  }
}

function comparisonActivityData(
  activities,
  type,
  period,
  alignToMonday,
  referenceDate = new Date(),
  offset = 0,
) {
  const { current: currentRange, previous: previousRange } = comparisonRanges(
    period,
    alignToMonday,
    referenceDate,
    offset,
  )
  const matchesType = (activity) => type === 'total' || activityType(activity) === type
  const getDate = (activity) => new Date(activity.startTimeLocal)
  const getDistance = (activity) => Number.isFinite(Number(activity.km))
    ? Number(activity.km)
    : (Number(activity.distance) || 0) / 1000
  const inRange = (range) => activities.filter((activity) => {
    const date = getDate(activity)
    return matchesType(activity) && !Number.isNaN(date.getTime())
      && date >= range.start && date <= range.end
  })
  const current = inRange(currentRange)
  const previous = inRange(previousRange)
  const summarize = (items) => ({
    activities: items.length,
    duration: items.reduce((sum, activity) => sum + (Number(activity.duration) || 0), 0),
    distance: items.reduce((sum, activity) => sum + getDistance(activity), 0),
  })
  const rangeDays = (range) => Math.ceil((range.end - range.start) / 86400000) + 1
  const currentDays = rangeDays(currentRange)
  const bucketCount = period.unit === 'week'
    ? currentDays
    : period.unit === 'month' && period.amount === 1
      ? currentDays
      : (period.unit === 'year' && period.amount === 1)
        ? Math.ceil(currentDays / 7)
        : period.unit === 'year'
          ? period.amount * 12
          : Math.ceil(currentDays / 7)
  const dailyBuckets = period.unit === 'week'
    || (period.unit === 'month' && period.amount === 1)
  const rangeDuration = (range) => range.end.getTime() - range.start.getTime() + 1
  const cumulative = (items, range) => {
    const values = Array.from({ length: bucketCount }, (_value, index) => ({
      day: index + 1,
      duration: 0,
      distance: 0,
      elevation: 0,
      activities: 0,
    }))
    items.forEach((activity) => {
      const date = getDate(activity)
      const index = dailyBuckets
        ? Math.floor((date - range.start) / 86400000)
        : Math.min(
          bucketCount - 1,
          Math.max(0, Math.floor(((date - range.start) / rangeDuration(range)) * bucketCount)),
        )
      const point = values[index]
      if (!point) return
      point.duration += Number(activity.duration) || 0
      point.distance += getDistance(activity)
      point.activities += 1
    })
    let totals = { duration: 0, distance: 0, elevation: 0, activities: 0 }
    return values.map((point) => {
      totals = {
        duration: totals.duration + point.duration,
        distance: totals.distance + point.distance,
        activities: totals.activities + point.activities,
      }
      return { day: point.day, ...totals }
    })
  }
  const previousSeries = cumulative(previous, previousRange)
  const currentSeries = cumulative(current, currentRange)
  const elapsedBuckets = dailyBuckets
    ? Math.min(
      bucketCount,
      Math.max(1, Math.floor((referenceDate - currentRange.start) / 86400000) + 1),
    )
    : Math.min(
      bucketCount,
      Math.max(1, Math.ceil(((referenceDate - currentRange.start) / rangeDuration(currentRange)) * bucketCount)),
    )
  const chartData = Array.from(
    { length: bucketCount },
    (_value, index) => ({
      day: index + 1,
      currentDuration: index < elapsedBuckets ? currentSeries[index].duration : null,
      previousDuration: previousSeries[index].duration,
    }),
  )
  return {
    current: summarize(current),
    previous: summarize(previous),
    chartData,
    currentStartLabel: formatDate(currentRange.start),
    currentEndLabel: formatDate(currentRange.end),
    currentLabel: `${formatDate(currentRange.start)} – ${formatDate(currentRange.end)}`,
    previousLabel: `${formatDate(previousRange.start)} – ${formatDate(previousRange.end)}`,
  }
}

function formatMonthlyDuration(seconds) {
  const totalMinutes = Math.round(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`
}

function MonthlyActivityPanel({ title, data, showDistance = true }) {
  const currentFinalIndex = data.chartData.reduce(
    (lastIndex, point, index) => (point.currentDuration != null ? index : lastIndex),
    -1,
  )
  const metricFormatter = (value, metric) => {
    if (metric === 'duration') return formatMonthlyDuration(value)
    if (metric === 'distance') return `${Number(value).toLocaleString('it-IT', { maximumFractionDigits: 1 })} km`
    if (metric === 'elevation') return `${Math.round(value)} m`
    return Math.round(value)
  }
  return (
    <article className="panel monthly-activity-panel">
      <div className="monthly-activity-heading">
        <div>
          <p className="eyebrow">{title}</p>
          <h2>{data.currentStartLabel} - {data.currentEndLabel}</h2>
        </div>
      </div>
      <div className="monthly-activity-summary">
        <div><span>Attività</span><strong>{data.current.activities}</strong></div>
        {showDistance && (
          <div><span>Distanza</span><strong>{metricFormatter(data.current.distance, 'distance')}</strong></div>
        )}
        <div><span>Tempo</span><strong>{formatMonthlyDuration(data.current.duration)}</strong></div>
      </div>
      <div className="monthly-activity-chart">
        <ChartContainer>
          <LineChart data={data.chartData} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="day" tick={false} tickLine={false} axisLine={false} />
            <YAxis hide />
            <ReferenceLine
              y={data.previous.duration}
              stroke="#b8b8b8"
              strokeDasharray="5 4"
              label={{
                value: `${data.previousLabel} · ${formatMonthlyDuration(data.previous.duration)}`,
                position: 'insideTopLeft',
                fill: 'var(--muted)',
                fontSize: 12,
              }}
            />
            <Line
              type="stepAfter"
              dataKey="previousDuration"
              stroke="#b8b8b8"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              name="previousDuration"
              activeDot={false}
            />
            <Line
              type="stepAfter"
              dataKey="currentDuration"
              stroke="#ef5b24"
              strokeWidth={2.5}
              connectNulls={false}
              name="currentDuration"
              dot={(point) => point.index === currentFinalIndex ? (
                <circle
                  cx={point.cx}
                  cy={point.cy}
                  r={5}
                  fill="#ef5b24"
                  stroke="var(--surface)"
                  strokeWidth={2}
                />
              ) : null}
              activeDot={false}
            />
          </LineChart>
        </ChartContainer>
      </div>
    </article>
  )
}

// Gestisce general dashboard.
function GeneralDashboard({ activities, syncState, onSync }) {
  const [period, setPeriod] = useState({ amount: 1, unit: 'week' })
  const [periodOffset, setPeriodOffset] = useState(0)
  const [alignToMonday, setAlignToMonday] = useState(false)
  const referenceDate = useMemo(() => new Date(), [])
  const ranges = useMemo(
    () => comparisonRanges(period, alignToMonday, referenceDate, periodOffset),
    [alignToMonday, period, periodOffset, referenceDate],
  )
  const currentRange = ranges.current
  const analysis = useMemo(
    () => analyzeCombinedActivities(activities, period, referenceDate, currentRange),
    [activities, currentRange, period, referenceDate],
  )
  const dominant = analysis.zones.reduce(
    (largest, zone) => (zone.seconds > largest.seconds ? zone : largest),
    analysis.zones[0],
  )
  const easySeconds = analysis.zones[0].seconds + analysis.zones[1].seconds
  const mediumSeconds = analysis.zones[2].seconds
  const hardSeconds = analysis.zones[3].seconds + analysis.zones[4].seconds
  const monthlyData = useMemo(() => ({
    total: comparisonActivityData(
      activities, 'total', period, alignToMonday, referenceDate, periodOffset,
    ),
    running: comparisonActivityData(
      activities, 'running', period, alignToMonday, referenceDate, periodOffset,
    ),
    cycling: comparisonActivityData(
      activities, 'cycling', period, alignToMonday, referenceDate, periodOffset,
    ),
    generic: comparisonActivityData(
      activities, 'generic', period, alignToMonday, referenceDate, periodOffset,
    ),
    other: comparisonActivityData(
      activities, 'other', period, alignToMonday, referenceDate, periodOffset,
    ),
  }), [activities, alignToMonday, period, periodOffset, referenceDate])

  const handlePeriodChange = (nextPeriod) => {
    setPeriod(nextPeriod)
    setPeriodOffset(0)
  }

  return (
    <div className="page-stack">
      <section className="page-heading latest-analysis-heading">
        <div>
          <p className="eyebrow">Dashboard generale</p>
          <h1>Le ultime attività.</h1>
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


      <PeriodPicker
        value={period}
        onChange={handlePeriodChange}
        activities={activities}
        idPrefix="general-dashboard-period"
        dateRange={currentRange}
        onPrevious={() => setPeriodOffset((offset) => offset + 1)}
        onNext={() => setPeriodOffset((offset) => Math.max(0, offset - 1))}
        canGoNext={periodOffset > 0}
      />
      <label className="monday-alignment-control">
        <input
          type="checkbox"
          checked={alignToMonday}
          onChange={(event) => setAlignToMonday(event.target.checked)}
        />
        {periodAlignmentLabel(period.unit)}
      </label>

      <section className="general-summary-grid" aria-label="Riepilogo del periodo">
        <article>
          <span>Attività</span>
          <strong>{analysis.activityCount.toLocaleString('it-IT')}</strong>
          <small>{analysis.sport.running.count} corse · {analysis.sport.cycling.count} bici · {analysis.sport.generic.count} palestra · {analysis.sport.other.count} altri sport</small>
        </article>
        <article>
          <span>Tempo totale</span>
          <strong>{formatDuration(analysis.totalDuration)}</strong>
          <small>hh:mm:ss</small>
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

      <section className="sport-recap-grid" aria-label="Riepilogo per sport">
        <article className="panel running-recap-card">
          <p className="eyebrow">Corsa</p>
          <h2>{analysis.sport.running.count} attività</h2>
          <strong>Distanza: {formatDistance(analysis.sport.running.distanceKm)}</strong>
          <span>Durata: {formatDuration(analysis.sport.running.duration)}</span>
        </article>
        <article className="panel cycling-recap-card">
          <p className="eyebrow">Bici</p>
          <h2>{analysis.sport.cycling.count} attività</h2>
          <strong>Distanza: {formatDistance(analysis.sport.cycling.distanceKm)}</strong>
          <span>Durata: {formatDuration(analysis.sport.cycling.duration)}</span>
        </article>
        <article className="panel generic-recap-card">
          <p className="eyebrow">Palestra</p>
          <h2>{analysis.sport.generic.count} attività</h2>
          <strong>Distanza: ---</strong>
          <span>Durata: {formatDuration(analysis.sport.generic.duration)}</span>
        </article>
        <article className="panel other-recap-card">
          <p className="eyebrow">Altri sport</p>
          <h2>{analysis.sport.other.count} attività</h2>
          <strong>Distanza: {formatDistance(analysis.sport.other.distanceKm)}</strong>
          <span>Durata: {formatDuration(analysis.sport.other.duration)}</span>
        </article>
      </section>

      <section className="monthly-activities-section" aria-labelledby="monthly-activities-title">
        <div className="monthly-activities-grid">
          <MonthlyActivityPanel title="Tutti gli sport" data={monthlyData.total} />
          <MonthlyActivityPanel title="Corsa" data={monthlyData.running} />
          <MonthlyActivityPanel title="Ciclismo" data={monthlyData.cycling} />
          <MonthlyActivityPanel title="Palestra" data={monthlyData.generic} showDistance={false} />
          <MonthlyActivityPanel title="Altri sport" data={monthlyData.other} />
        </div>
      </section>

      <section className="panel hr-zone-panel" aria-labelledby="combined-zone-title">
        <div className="panel-heading hr-zone-heading">
          <div>
            <p className="eyebrow">Distribuzione dello sforzo</p>
            <h2 id="combined-zone-title">Zone cardiache complessive</h2>
          </div>
          <span>{analysis.trackedActivities} attività rilevate</span>
        </div>

        {analysis.trackedSeconds > 0 ? (
          <>
            <div className="zone-insights combined-zone-insights">
              <div>
                <span>Tempo cardio totale</span>
                <strong>{formatDuration(analysis.trackedSeconds)}</strong>
              </div>
              <div>
                <span>Facile · Z1-Z2</span>
                <strong>{formatDuration(easySeconds)}</strong>
                <small>{((easySeconds / analysis.trackedSeconds) * 100).toFixed(0)}% del tempo rilevato</small>
              </div>
              <div>
                <span>Media · Z3</span>
                <strong>{formatDuration(mediumSeconds)}</strong>
                <small>{((mediumSeconds / analysis.trackedSeconds) * 100).toFixed(0)}% del tempo rilevato</small>
              </div>
              <div>
                <span>Alta · Z4-Z5</span>
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
              <div className="zone-charts-grid">
                <div className="zone-history">
                <h3>Zone nel tempo</h3>
                <p>Minuti complessivi per periodo, sommando corsa e bici.</p>
                <div className="zone-history-chart combined-zone-history-chart">
                  <ChartContainer>
                    <BarChart data={analysis.history} margin={{ top: 12, right: 18, left: 0, bottom: 4 }}>
                      <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
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
                        labelFormatter={(value, payload) => (
                          historyTooltipLabel(value, payload, analysis.granularity)
                        )}
                        formatter={(value, name) => [
                          `${Number(value).toLocaleString('it-IT', { maximumFractionDigits: 1 })} min`,
                          name === 'totalMinutes' ? 'Totale' : name,
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
                          shape={(shapeProps) => (
                            <ZoneBarShape {...shapeProps} index={index} />
                          )}
                        />
                      ))}
                    </BarChart>
                  </ChartContainer>
                </div>
                </div>
                <div className="zone-thresholds">
                  <h3>Soglie BPM</h3>
                  <p>Intervalli dell’attività più recente con dati disponibili.</p>
                  {analysis.heartRateThresholds.length > 0 ? (
                    <div className="zone-threshold-list">
                      {analysis.heartRateThresholds.map((zone, index) => {
                        const hasRange = zone.lowBpm !== null && zone.highBpm !== null
                        return (
                          <div className="zone-threshold-row" key={zone.zone}>
                            <span
                              className="zone-threshold-label"
                              style={{ color: HEART_RATE_ZONE_COLORS[index] }}
                            >
                              Z{zone.zone}
                            </span>
                            <div className="zone-threshold-track">
                              {hasRange && (
                                <span
                                  className="zone-threshold-range"
                                  style={{
                                    backgroundColor: HEART_RATE_ZONE_COLORS[index],
                                    left: `${Math.max(0, ((zone.lowBpm - 80) / 120) * 100)}%`,
                                    width: `${Math.max(0, ((zone.highBpm - zone.lowBpm) / 120) * 100)}%`,
                                  }}
                                />
                              )}
                            </div>
                            <strong>
                              {hasRange ? `${zone.lowBpm}–${zone.highBpm}` : '—'}
                            </strong>
                            <small>BPM</small>
                          </div>
                        )
                      })}
                      <div className="zone-threshold-axis">
                        <span>80</span><span>110</span><span>140</span><span>170</span><span>200 BPM</span>
                      </div>
                    </div>
                  ) : (
                    <div className="thresholds-empty">Soglie BPM non disponibili.</div>
                  )}
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

    </div>
  )
}

export default GeneralDashboard
