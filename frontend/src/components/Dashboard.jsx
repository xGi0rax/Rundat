import { useEffect, useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
import {
  analyzeDashboard,
  comparisonStatus,
  confidenceFor,
  distanceKm,
  heartRate,
  HEART_RATE_ZONE_COLORS,
  heartRateZoneSummary,
  median,
  paceMinutes,
} from '../domain/dashboardAnalysis.js'
import {
  normalizePeriod,
  periodAmountLimit,
  periodRange,
} from '../domain/periods.js'

function ComparisonInfoDialog({
  title,
  description,
  meaning,
  calculation,
  interpretation,
  caveat,
  status,
  latestValue,
  referenceValue,
  latestLabel,
  referenceLabel,
  formatter,
  lowerIsBetter,
  onClose,
}) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const direction = lowerIsBetter
    ? 'La classificazione considera favorevole un valore reale più basso del riferimento.'
    : 'La classificazione considera favorevole un valore reale più alto del riferimento.'

  return (
    <div className="info-modal-backdrop" onMouseDown={onClose}>
      <section
        className="info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comparison-info-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="info-modal-header">
          <div>
            <p className="eyebrow">Come leggere il confronto</p>
            <h2 id="comparison-info-title">{title}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </header>
        <div className="info-modal-content">
          <div>
            <h3>Cosa misura</h3>
            <p>{meaning || description}</p>
          </div>
          <div>
            <h3>Quali dati vengono confrontati</h3>
            <p>{calculation}</p>
          </div>
          <div>
            <h3>Come viene ottenuta la percentuale</h3>
            <p>
              La differenza viene divisa per il valore di riferimento e trasformata in
              percentuale. {direction}
            </p>
            <code>
              {lowerIsBetter
                ? `(${referenceLabel} − ${latestLabel}) ÷ |${referenceLabel}| × 100`
                : `(${latestLabel} − ${referenceLabel}) ÷ |${referenceLabel}| × 100`}
            </code>
          </div>
          <div className={`info-result ${status.tone}`}>
            <h3>Il tuo risultato</h3>
            <strong>
              {status.label} {Math.abs(status.improvement).toLocaleString('it-IT', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}%
            </strong>
            <p>
              {latestLabel}: {formatter(latestValue)} · {referenceLabel}:{' '}
              {formatter(referenceValue)}. {interpretation}
            </p>
          </div>
          {caveat && (
            <div className="info-caveat">
              <h3>Da tenere presente</h3>
              <p>{caveat}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function InsightInfoDialog({ title, value, description, information, onClose }) {
  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  return (
    <div className="info-modal-backdrop" onMouseDown={onClose}>
      <section
        className="info-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="insight-info-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="info-modal-header">
          <div>
            <p className="eyebrow">Guida all’indicatore</p>
            <h2 id="insight-info-title">{title}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Chiudi">
            ×
          </button>
        </header>
        <div className="info-modal-content">
          <div>
            <h3>Cosa significa</h3>
            <p>{information.meaning}</p>
          </div>
          <div>
            <h3>Come viene calcolato</h3>
            <p>{information.calculation}</p>
          </div>
          <div className="info-result stable">
            <h3>Il tuo risultato</h3>
            <strong>{value}</strong>
            <p>{description} {information.interpretation}</p>
          </div>
          {information.caveat && (
            <div className="info-caveat">
              <h3>Da tenere presente</h3>
              <p>{information.caveat}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function ComparisonChart({
  eyebrow,
  title,
  description,
  latestValue,
  referenceValue,
  sampleCount,
  formatter,
  axisFormatter,
  lowerIsBetter = true,
  detail,
  rangeLabel,
  deltaFormatter,
  latestLabel = 'Ultima corsa',
  referenceLabel = 'Mediana storico',
  calculation = 'Si confronta il valore dell’ultima corsa con il valore di riferimento.',
  meaning,
  interpretation = 'Il risultato mostra lo scostamento relativo dell’ultima corsa dal riferimento.',
  caveat,
}) {
  const [showInfo, setShowInfo] = useState(false)
  const status = comparisonStatus(latestValue, referenceValue, lowerIsBetter)
  const confidence = confidenceFor(sampleCount)
  const hasComparison = Number.isFinite(latestValue)
    && Number.isFinite(referenceValue)
    && sampleCount > 0
  const chartData = hasComparison
    ? [
        { label: referenceLabel, value: referenceValue, fill: '#b8c2b8' },
        {
          label: latestLabel,
          value: latestValue,
          fill: status?.tone === 'positive'
            ? '#315e3b'
            : status?.tone === 'negative'
              ? '#b5533c'
              : '#345f9d',
        },
      ]
    : []

  return (
    <article className="panel comparison-panel">
      <div className="comparison-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p>{description}</p>
          {rangeLabel && (
            <p className="comparison-range">
              <strong>Range analizzato:</strong> {rangeLabel}
            </p>
          )}
        </div>
        {hasComparison && (
          <span className={`comparison-status ${status.tone}`}>
            <span>
              {status.label} {Math.abs(status.improvement).toLocaleString('it-IT', {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}%
            </span>
            <button
              type="button"
              className="comparison-info-button"
              onClick={() => setShowInfo(true)}
              aria-label={`Informazioni sul confronto ${title}`}
              title="Come viene calcolato"
            >
              i
            </button>
          </span>
        )}
      </div>

      {hasComparison ? (
        <>
          <div className="comparison-values">
            <div>
              <span>{latestLabel}</span>
              <strong>{formatter(latestValue)}</strong>
            </div>
            <div>
              <span>{referenceLabel}</span>
              <strong>{formatter(referenceValue)}</strong>
            </div>
          </div>
          <div className="comparison-chart" aria-label={`${title}: confronto tra ultima corsa e storico`}>
            <ChartContainer>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 22, left: 8, bottom: 0 }}
              >
                <CartesianGrid horizontal={false} stroke="#e3e6e1" />
                <XAxis
                  type="number"
                  domain={[0, 'auto']}
                  tickFormatter={axisFormatter}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={100}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip formatter={(value) => [formatter(value), title]} />
                <Bar dataKey="value" radius={[0, 7, 7, 0]} maxBarSize={30}>
                  {chartData.map((entry) => <Cell key={entry.label} fill={entry.fill} />)}
                </Bar>
              </BarChart>
            </ChartContainer>
          </div>
          <div className="comparison-footer">
            <span className={`confidence-badge ${confidence.className}`}>{confidence.label}</span>
            <span>{sampleCount} {sampleCount === 1 ? 'corsa confrontata' : 'corse confrontate'}</span>
            {deltaFormatter && <span>{deltaFormatter(status.difference)}</span>}
            {detail && <span>{detail}</span>}
          </div>
        </>
      ) : (
        <div className="comparison-empty">
          <strong>Dati insufficienti</strong>
          <p>Servono altre corse con valori comparabili per costruire questo confronto.</p>
        </div>
      )}
      {showInfo && (
        <ComparisonInfoDialog
          title={title}
          description={description}
          meaning={meaning}
          calculation={calculation}
          interpretation={interpretation}
          caveat={caveat}
          status={status}
          latestValue={latestValue}
          referenceValue={referenceValue}
          latestLabel={latestLabel}
          referenceLabel={referenceLabel}
          formatter={formatter}
          lowerIsBetter={lowerIsBetter}
          onClose={() => setShowInfo(false)}
        />
      )}
    </article>
  )
}

function InsightCard({
  eyebrow,
  title,
  value,
  description,
  progress,
  progressLabel,
  meta,
  centered = false,
  information,
}) {
  const [showInfo, setShowInfo] = useState(false)
  const safeProgress = Math.max(0, Math.min(100, Number(progress) || 0))
  return (
    <article className="panel insight-card">
      <div className="insight-card-heading">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
        </div>
        {information && (
          <button
            type="button"
            className="comparison-info-button insight-info-button"
            onClick={() => setShowInfo(true)}
            aria-label={`Informazioni sull’indicatore ${title}`}
            title="Come viene calcolato"
          >
            i
          </button>
        )}
      </div>
      <strong className="insight-value">{value}</strong>
      <p className="insight-description">{description}</p>
      <div
        className={`insight-scale${centered ? ' centered' : ''}`}
        role="img"
        aria-label={`${title}: ${value}`}
      >
        {centered && <span className="insight-scale-center" aria-hidden="true" />}
        <span className="insight-scale-fill" style={{ width: `${safeProgress}%` }} />
        <span className="insight-scale-marker" style={{ left: `${safeProgress}%` }} />
      </div>
      <div className="insight-meta">
        <span>{progressLabel}</span>
        {meta && <span>{meta}</span>}
      </div>
      {showInfo && information && (
        <InsightInfoDialog
          title={title}
          value={value}
          description={description}
          information={information}
          onClose={() => setShowInfo(false)}
        />
      )}
    </article>
  )
}

function LatestRunSummary({ activity }) {
  const pace = paceMinutes(activity)
  return (
    <section className="latest-run-summary" aria-label="Dati dell’ultima corsa">
      <div className="latest-run-identity">
        <span>Ultima attività analizzata</span>
        <strong>{formatDate(activity.startTimeLocal, 'long')}</strong>
      </div>
      <div>
        <span>Distanza</span>
        <strong>{formatDistance(distanceKm(activity))}</strong>
      </div>
      <div>
        <span>Tempo</span>
        <strong>{formatDuration(activity.duration)}</strong>
      </div>
      <div>
        <span>Passo medio</span>
        <strong>{pace ? `${formatPaceDecimal(pace)} /km` : '—'}</strong>
      </div>
      <div>
        <span>FC media</span>
        <strong>{formatHeartRate(activity.averageHR)}</strong>
      </div>
    </section>
  )
}

function ActivityDetailDialog({ activity, onClose }) {
  const pace = paceMinutes(activity)

  useEffect(() => {
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [onClose])

  const details = [
    ['Distanza', formatDistance(distanceKm(activity))],
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
        aria-labelledby="activity-detail-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="info-modal-header">
          <div>
            <p className="eyebrow">Dettagli attività</p>
            <h2 id="activity-detail-title">{activity.activityName || 'Corsa'}</h2>
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

function ActivityScatterPoint({ cx, cy, payload, onSelect, latest = false }) {
  const openDetails = () => onSelect(payload.activity)
  return (
    <g
      className={`activity-scatter-point${latest ? ' latest' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`Apri i dettagli di ${payload.name} del ${formatDate(payload.date)}`}
      onClick={openDetails}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          openDetails()
        }
      }}
    >
      <circle cx={cx} cy={cy} r={12} fill="transparent" />
      {latest ? (
        <rect
          x={cx - 5}
          y={cy - 5}
          width={10}
          height={10}
          rx={1}
          fill="#ef5b24"
          transform={`rotate(45 ${cx} ${cy})`}
        />
      ) : (
        <circle cx={cx} cy={cy} r={5} fill="#8fa194" fillOpacity={0.82} />
      )}
    </g>
  )
}

function EffortScatter({ historical, latest }) {
  const referenceDate = new Date(latest.startTimeLocal)
  const pickerActivities = [...historical, latest]
  const [period, setPeriod] = useState(() => ({
    amount: periodAmountLimit('year', pickerActivities, referenceDate),
    unit: 'year',
  }))
  const [selectedActivity, setSelectedActivity] = useState(null)
  const normalizedPeriod = normalizePeriod(period, pickerActivities, referenceDate)
  const selectedRange = periodRange(normalizedPeriod, 0, referenceDate)
  const selectedHistory = historical.filter((activity) => {
    const date = new Date(activity.startTimeLocal)
    return date >= selectedRange.start && date <= selectedRange.end
  })
  const historicalData = selectedHistory
    .map((activity) => ({
      heartRate: heartRate(activity),
      pace: paceMinutes(activity),
      date: activity.startTimeLocal,
      name: activity.activityName || 'Corsa',
      activity,
    }))
    .filter((point) => Number.isFinite(point.heartRate) && Number.isFinite(point.pace))
  const latestPoint = {
    heartRate: heartRate(latest),
    pace: paceMinutes(latest),
    date: latest.startTimeLocal,
    name: latest.activityName || 'Ultima corsa',
    activity: latest,
  }
  const hasLatestPoint = Number.isFinite(latestPoint.heartRate) && Number.isFinite(latestPoint.pace)
  const medianHeartRate = median(historicalData.map((point) => point.heartRate))
  const medianPace = median(historicalData.map((point) => point.pace))

  return (
    <article className="panel effort-map-panel">
      <div className="panel-heading effort-map-heading">
        <div>
          <p className="eyebrow">Quadro generale</p>
          <h2>Passo e frequenza cardiaca</h2>
          <p>Più un punto è in alto e a sinistra, più il passo è veloce con meno battiti.</p>
        </div>
        <PeriodPicker
          value={period}
          onChange={setPeriod}
          activities={pickerActivities}
          idPrefix="effort-map-period"
          className="effort-map-period-picker"
          dateRange={selectedRange}
          referenceDate={referenceDate}
        />
      </div>
      {hasLatestPoint && historicalData.length ? (
        <>
          <div className="effort-map-legend">
            <span><i className="historical" /> Corse precedenti</span>
            <span><i className="latest" /> Ultima corsa</span>
          </div>
          <div className="effort-map-chart">
            <ChartContainer>
              <ScatterChart margin={{ top: 14, right: 28, left: 4, bottom: 10 }}>
                <CartesianGrid stroke="#e1e4df" />
                <XAxis
                  type="number"
                  dataKey="heartRate"
                  name="FC media"
                  unit=" bpm"
                  domain={['auto', 'auto']}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="pace"
                  name="Passo"
                  domain={['auto', 'auto']}
                  tickFormatter={(value) => formatPaceDecimal(value)}
                  tickLine={false}
                  axisLine={false}
                  reversed
                  width={54}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '4 4' }}
                  formatter={(value, name) => [
                    name === 'Passo' ? `${formatPaceDecimal(value)} /km` : `${Math.round(value)} bpm`,
                    name,
                  ]}
                  labelFormatter={(_value, payload) => {
                    const point = payload?.[0]?.payload
                    return point ? `${point.name} · ${formatDate(point.date)}` : ''
                  }}
                />
                {medianHeartRate != null && (
                  <ReferenceLine x={medianHeartRate} stroke="#aeb6ae" strokeDasharray="5 5" />
                )}
                {medianPace != null && (
                  <ReferenceLine y={medianPace} stroke="#aeb6ae" strokeDasharray="5 5" />
                )}
                <Scatter
                  data={historicalData}
                  shape={(props) => (
                    <ActivityScatterPoint {...props} onSelect={setSelectedActivity} />
                  )}
                />
                <Scatter
                  data={[latestPoint]}
                  shape={(props) => (
                    <ActivityScatterPoint
                      {...props}
                      latest
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
          <strong>Grafico non disponibile</strong>
          <p>Servono passo e frequenza cardiaca sia nell’ultima corsa sia nello storico.</p>
        </div>
      )}
      {selectedActivity && (
        <ActivityDetailDialog
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </article>
  )
}

function HeartRateZoneAnalysis({ latest, historical }) {
  const latestSummary = heartRateZoneSummary(latest)
  const historicalSummaries = historical.map(heartRateZoneSummary).filter(Boolean)
  const easyReference = median(historicalSummaries.map((summary) => summary.easyShare))
  const easyDifference = latestSummary && easyReference != null
    ? latestSummary.easyShare - easyReference
    : null

  return (
    <section className="panel hr-zone-panel" aria-labelledby="hr-zone-title">
      <div className="panel-heading hr-zone-heading">
        <div>
          <p className="eyebrow">Distribuzione dello sforzo</p>
          <h2 id="hr-zone-title">Zone cardiache</h2>
          <p>
            Tempo trascorso in ciascuna zona nell’ultima corsa e confronto con le attività
            recenti dotate di dati Garmin.
          </p>
        </div>
        {latestSummary && (
          <span>
            Prevalenza Z{latestSummary.dominant.zone} ·{' '}
            {latestSummary.dominant.percentage.toLocaleString('it-IT', {
              maximumFractionDigits: 0,
            })}%
          </span>
        )}
      </div>

      {latestSummary ? (
        <>
          <div className="zone-insights">
            <div>
              <span>Tempo rilevato</span>
              <strong>{formatDuration(latestSummary.totalSeconds)}</strong>
            </div>
            <div>
              <span>Intensità facile · Z1–Z2</span>
              <strong>
                {latestSummary.easyShare.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%
              </strong>
              <small>
                {easyDifference == null
                  ? 'Storico non ancora disponibile'
                  : `${Math.abs(easyDifference).toLocaleString('it-IT', {
                    maximumFractionDigits: 1,
                  })} punti ${easyDifference >= 0 ? 'sopra' : 'sotto'} la mediana`}
              </small>
            </div>
            <div>
              <span>Alta intensità · Z4–Z5</span>
              <strong>
                {latestSummary.hardShare.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%
              </strong>
              <small>Quota svolta alle intensità più elevate</small>
            </div>
          </div>

          <div
            className="zone-distribution"
            role="img"
            aria-label="Distribuzione percentuale delle zone cardiache nell’ultima corsa"
          >
            {latestSummary.zones.map((zone, index) => (
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
            {latestSummary.zones.map((zone, index) => (
              <div key={zone.zone}>
                <i style={{ backgroundColor: HEART_RATE_ZONE_COLORS[index] }} />
                <span>Z{zone.zone}</span>
                <strong>{formatDuration(zone.seconds)}</strong>
                <small>{zone.percentage.toFixed(0)}%</small>
              </div>
            ))}
          </div>

        </>
      ) : (
        <div className="comparison-empty zone-empty">
          <strong>Zone non ancora disponibili per questa corsa</strong>
          <p>
            Premi “Sincronizza Garmin”: le attività più recenti prive di zone vengono
            completate progressivamente.
          </p>
        </div>
      )}
    </section>
  )
}

function Dashboard({ activities, syncState, onSync }) {
  const analysis = useMemo(() => analyzeDashboard(activities), [activities])

  if (!analysis) {
    return (
      <div className="page-stack">
        <section className="page-heading compact-heading">
          <div>
            <p className="eyebrow">Corsa</p>
            <h1>Nessuna corsa disponibile.</h1>
            <p>Sincronizza Garmin dalla dashboard generale per importare le attività.</p>
          </div>
        </section>
      </div>
    )
  }

  const paceAxisFormatter = (seconds) => formatPaceDecimal(seconds / 60)
  const paceFormatter = (seconds) => `${formatPaceDecimal(seconds / 60)} /km`
  const latestPaceSeconds = analysis.latestPace ? analysis.latestPace * 60 : null
  const referencePaceAtHr = analysis.heartRateReferencePace
    ? analysis.heartRateReferencePace * 60
    : null
  const referencePaceAtDistance = analysis.distanceReferencePace
    ? analysis.distanceReferencePace * 60
    : null
  const expectedPaceSeconds = analysis.expectedPace ? analysis.expectedPace * 60 : null
  const bestComparablePaceSeconds = analysis.bestComparablePace
    ? analysis.bestComparablePace * 60
    : null
  const percentileValue = analysis.performancePercentile != null
    ? Math.round(analysis.performancePercentile)
    : null
  const exceptionalityValue = analysis.exceptionality
  const exceptionalityProgress = exceptionalityValue == null
    ? 50
    : ((Math.max(-3, Math.min(3, exceptionalityValue)) + 3) / 6) * 100
  const exceptionalityLabel = exceptionalityValue == null
    ? 'Non calcolabile'
    : exceptionalityValue >= 1.5
      ? 'Prestazione eccezionalmente positiva'
      : exceptionalityValue >= 0.5
        ? 'Sopra le attese'
        : exceptionalityValue <= -1.5
          ? 'Prestazione insolitamente debole'
          : exceptionalityValue <= -0.5
            ? 'Sotto le attese'
            : 'Prestazione nella norma'
  const loadRatio = analysis.latestLoad != null && analysis.loadReference
    ? analysis.latestLoad / analysis.loadReference
    : null
  const fatigueLabel = analysis.fatigueRatio == null
    ? 'Contesto non disponibile'
    : analysis.fatigueRatio >= 1.5
      ? 'Carico recente elevato'
      : analysis.fatigueRatio >= 0.8
        ? 'Carico recente abituale'
        : 'Carico recente ridotto'
  const regularityValue = analysis.regularityDifferenceSeconds
  const regularityLabel = regularityValue == null
    ? 'Non calcolabile'
    : Math.abs(regularityValue) < 5
      ? 'Molto vicina al passo abituale'
      : `${Math.abs(Math.round(regularityValue))} s/km ${
          regularityValue < 0 ? 'più veloce' : 'più lenta'
        } della mediana`
  const positiveSignals = [
    comparisonStatus(analysis.latestHr, analysis.paceReferenceHr, true),
    comparisonStatus(latestPaceSeconds, referencePaceAtHr, true),
    comparisonStatus(latestPaceSeconds, referencePaceAtDistance, true),
    comparisonStatus(analysis.latestEfficiency, analysis.efficiencyReference, false),
  ].filter((status) => status?.tone === 'positive').length

  return (
    <div className="page-stack">
      <section className="page-heading latest-analysis-heading">
        <div>
          <p className="eyebrow">Corsa</p>
          <h1>Dentro l'ultima corsa.</h1>
          <p>
            Confronti con attività simili per capire se sto correndo più velocemente
            o con minore sforzo cardiaco.
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

      <LatestRunSummary activity={analysis.latest} />

      <section className="analysis-verdict">
        <div>
          <span>Lettura sintetica</span>
          <strong>
            {positiveSignals >= 3
              ? 'Segnali di miglioramento solidi'
              : positiveSignals >= 1
                ? 'Alcuni segnali positivi'
                : 'Prestazione in linea o da consolidare'}
          </strong>
        </div>
        <p>
          {positiveSignals} indicatori positivi su 4 · confronto basato
          {analysis.usedRecentWindow ? ' sugli ultimi 12 mesi' : ' su tutto lo storico disponibile'}.
        </p>
      </section>

      <section className="comparison-grid" aria-label="Confronti dell’ultima corsa">
        <ComparisonChart
          eyebrow="Efficienza cardiaca"
          title="FC a passo simile"
          description="Battiti medi rispetto alle corse effettuate entro il ±5% dello stesso passo."
          meaning="Verifica se, correndo all’incirca alla stessa velocità, il cuore ha lavorato mediamente più o meno rispetto alle tue corse precedenti."
          calculation="Partiamo dal passo dell’ultima corsa, selezioniamo le attività precedenti con un passo entro il ±5% e calcoliamo la mediana della loro FC media. La mediana riduce l’influenza di giornate anomale."
          interpretation="Una FC reale inferiore alla mediana viene indicata come “Meglio” perché hai sostenuto un passo simile con un costo cardiaco medio minore; una FC superiore viene indicata come “Peggio”."
          caveat="Il filtro rende simile il passo, ma non controlla distanza, temperatura, vento, percorso, fatica accumulata o precisione del sensore."
          latestValue={analysis.latestHr}
          referenceValue={analysis.paceReferenceHr}
          sampleCount={analysis.samePace.length}
          formatter={(value) => `${Math.round(value)} bpm`}
          axisFormatter={(value) => Math.round(value)}
          deltaFormatter={(difference) => (
            Math.round(difference) === 0
              ? 'Stessa FC della mediana'
              : `${Math.abs(Math.round(difference))} bpm ${difference < 0 ? 'in meno' : 'in più'}`
          )}
          detail=""
          rangeLabel={analysis.latestPace
            ? `${formatPaceDecimal(analysis.latestPace * 0.95)} – ${formatPaceDecimal(analysis.latestPace * 1.05)} /km`
            : 'non disponibile'}
        />
        <ComparisonChart
          eyebrow="Velocità a pari sforzo"
          title="Passo a FC simile"
          description="Passo medio rispetto alle corse effettuate entro ±5 bpm dalla stessa FC."
          meaning="Verifica se, mantenendo un impegno cardiaco medio simile, sei riuscito a correre più velocemente o più lentamente del tuo riferimento personale."
          calculation="Selezioniamo le corse precedenti con FC media entro ±5 bpm da quella dell’ultima attività e usiamo la mediana del loro passo come riferimento."
          interpretation="Un passo reale più basso, quindi più veloce, viene indicato come “Meglio”; un passo più alto viene indicato come “Peggio”."
          caveat="A parità di FC, distanza, pendenza, clima, stanchezza e tipo di allenamento possono cambiare sensibilmente il passo."
          latestValue={latestPaceSeconds}
          referenceValue={referencePaceAtHr}
          sampleCount={analysis.sameHeartRate.length}
          formatter={paceFormatter}
          axisFormatter={paceAxisFormatter}
          deltaFormatter={(difference) => (
            Math.round(difference) === 0
              ? 'Stesso passo della mediana'
              : `${Math.abs(Math.round(difference))} s/km ${difference < 0 ? 'più veloce' : 'più lento'}`
          )}
          detail=""
          rangeLabel={analysis.latestHr
            ? `${Math.max(0, Math.round(analysis.latestHr - 5))} – ${Math.round(analysis.latestHr + 5)} bpm`
            : 'non disponibile'}
        />
        <ComparisonChart
          eyebrow="Prestazione sulla distanza"
          title="Passo a distanza simile"
          description="Passo medio rispetto alle corse entro il ±10% della stessa distanza."
          meaning="Confronta la velocità dell’ultima corsa con quella normalmente ottenuta su distanze paragonabili."
          calculation="Selezioniamo le attività la cui distanza differisce al massimo del 10% da quella attuale e calcoliamo la mediana del loro passo medio."
          interpretation="Un passo inferiore alla mediana significa meno secondi per chilometro e viene indicato come “Meglio”; un passo superiore viene indicato come “Peggio”."
          caveat="Il confronto uniforma la distanza, ma non distingue allenamenti facili, gare, ripetute, percorsi diversi o condizioni ambientali."
          latestValue={latestPaceSeconds}
          referenceValue={referencePaceAtDistance}
          sampleCount={analysis.sameDistance.length}
          formatter={paceFormatter}
          axisFormatter={paceAxisFormatter}
          deltaFormatter={(difference) => (
            Math.round(difference) === 0
              ? 'Stesso passo della mediana'
              : `${Math.abs(Math.round(difference))} s/km ${difference < 0 ? 'più veloce' : 'più lento'}`
          )}
          detail={`Distanza di riferimento: ${formatDistance(analysis.latestDistance)}.`}
          rangeLabel={analysis.latestDistance
            ? `${formatDistance(analysis.latestDistance * 0.9)} – ${formatDistance(analysis.latestDistance * 1.1)}`
            : 'non disponibile'}
        />
        <ComparisonChart
          eyebrow="Efficienza aerobica"
          title="Velocità per battito"
          description="Rapporto tra velocità e FC rispetto alle corse con dati cardiaci disponibili."
          meaning="Stima quanta velocità produci per ogni battito medio: a parità di condizioni, più velocità con meno battiti suggerisce una migliore efficienza aerobica."
          calculation="Per ogni corsa dividiamo la velocità media in km/h per la FC media e moltiplichiamo per 100. Il riferimento è la mediana di tutte le corse storiche con entrambi i dati."
          interpretation="Un indice superiore alla mediana viene indicato come “Meglio” perché rappresenta più velocità per battito; un indice inferiore viene indicato come “Peggio”."
          caveat="È un indice semplificato: non corregge per dislivello, vento, caldo, deriva cardiaca o differenze nella durata."
          latestValue={analysis.latestEfficiency}
          referenceValue={analysis.efficiencyReference}
          sampleCount={analysis.efficiencyRuns.length}
          formatter={(value) => value.toLocaleString('it-IT', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          axisFormatter={(value) => Number(value).toFixed(1)}
          lowerIsBetter={false}
          deltaFormatter={(difference) => (
            Math.abs(difference) < 0.005
              ? 'Stessa efficienza della mediana'
              : `${Math.abs(difference).toLocaleString('it-IT', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} punti ${difference > 0 ? 'in più' : 'in meno'}`
          )}
          detail=""
          rangeLabel="tutte le corse con passo e frequenza cardiaca validi"
        />
      </section>

      <section className="analysis-section-heading">
        <p className="eyebrow">Prestazione attesa</p>
        <h2>Quanto ho fatto meglio o peggio del previsto</h2>
        <p>
          I valori attesi sono stimati dallo storico considerando contemporaneamente
          distanza, passo e frequenza cardiaca.
        </p>
      </section>

      <section className="comparison-grid" aria-label="Prestazione attesa e riferimenti">
        <ComparisonChart
          eyebrow="Modello cardiaco"
          title="Battiti attesi vs reali"
          description="FC prevista a partire dal passo e dalla distanza dell’ultima corsa."
          meaning="Verifica se l’ultima corsa ha richiesto più o meno battiti di quanti il tuo storico personale farebbe prevedere a quel passo e su quella distanza."
          calculation="Usiamo le corse precedenti, preferibilmente degli ultimi 12 mesi, per costruire una regressione che apprende la relazione tra passo, distanza e FC media. Inserendo passo e distanza dell’ultima corsa otteniamo la FC attesa, che viene poi confrontata con la FC realmente registrata."
          interpretation="Se la FC reale è inferiore alla FC attesa, il risultato è “Meglio”: hai sostenuto quella combinazione di passo e distanza con meno battiti del previsto. Se è superiore, il risultato è “Peggio”."
          caveat="È una previsione statistica personale, non un valore medico. Non considera dislivello, temperatura, vento, sonno, stress, recupero o possibili errori del sensore."
          latestValue={analysis.latestHr}
          referenceValue={analysis.expectedHeartRate}
          sampleCount={analysis.heartRateModel?.count ?? 0}
          formatter={(value) => `${Math.round(value)} bpm`}
          axisFormatter={(value) => Math.round(value)}
          referenceLabel="FC attesa"
          deltaFormatter={(difference) => (
            Math.round(difference) === 0
              ? 'FC esattamente in linea'
              : `${Math.abs(Math.round(difference))} bpm ${
                difference < 0 ? 'sotto le attese' : 'sopra le attese'
              }`
          )}
          detail="Meno battiti del previsto è un segnale positivo."
        />
        <ComparisonChart
          eyebrow="Modello prestativo"
          title="Passo atteso vs reale"
          description="Passo previsto a partire dalla FC e dalla distanza dell’ultima corsa."
          meaning="Verifica se, dato lo sforzo cardiaco medio e la distanza percorsa, hai corso più velocemente o più lentamente di quanto previsto dal tuo storico."
          calculation="Una regressione apprende dalle corse precedenti la relazione tra FC media, distanza e passo. Inserendo FC e distanza dell’ultima corsa otteniamo un passo atteso, poi confrontato con il passo reale."
          interpretation="Se il passo reale contiene meno secondi per chilometro del passo atteso, il risultato è “Meglio”; se ne contiene di più, è “Peggio”."
          caveat="La previsione non distingue il tipo di allenamento e non considera dislivello, superficie, clima, vento o stato di recupero."
          latestValue={latestPaceSeconds}
          referenceValue={expectedPaceSeconds}
          sampleCount={analysis.paceModel?.count ?? 0}
          formatter={paceFormatter}
          axisFormatter={paceAxisFormatter}
          referenceLabel="Passo atteso"
          deltaFormatter={(difference) => (
            Math.round(difference) === 0
              ? 'Passo esattamente in linea'
              : `${Math.abs(Math.round(difference))} s/km ${
                difference < 0 ? 'più veloce del previsto' : 'più lento del previsto'
              }`
          )}
          detail="Il modello controlla anche la distanza percorsa."
        />
        <ComparisonChart
          eyebrow="Migliore prestazione"
          title="Distanza dal tuo miglior risultato"
          description="Confronto con il passo migliore registrato su una distanza entro il ±10%."
          meaning="Mostra quanto il passo dell’ultima corsa è vicino al tuo passo più veloce mai registrato su una distanza comparabile."
          calculation="Selezioniamo le corse entro il ±10% della distanza attuale, individuiamo quella con il passo medio più basso e la utilizziamo come miglior riferimento."
          interpretation="Eguagliare o migliorare quel passo produce un risultato positivo; essere più lenti mostra la distanza percentuale dal miglior riferimento."
          caveat="Il miglior dato può provenire da una gara o da condizioni molto diverse. Il confronto non implica che ogni allenamento debba avvicinarsi al record."
          latestValue={latestPaceSeconds}
          referenceValue={bestComparablePaceSeconds}
          sampleCount={analysis.sameDistance.length}
          formatter={paceFormatter}
          axisFormatter={paceAxisFormatter}
          referenceLabel="Miglior passo"
          deltaFormatter={(difference) => (
            Math.round(difference) === 0
              ? 'Hai eguagliato il miglior passo'
              : `${Math.abs(Math.round(difference))} s/km ${
                difference < 0 ? 'meglio del precedente riferimento' : 'dal miglior passo'
              }`
          )}
          detail={analysis.bestComparable
            ? `Riferimento del ${formatDate(analysis.bestComparable.startTimeLocal)}.`
            : undefined}
        />
        <ComparisonChart
          eyebrow="Costo cardiaco"
          title="Battiti stimati per chilometro"
          description="Battiti complessivi stimati necessari per percorrere un chilometro."
          meaning="Stima il numero complessivo di battiti impiegati per coprire un chilometro, combinando intensità cardiaca e tempo necessario."
          calculation="Moltiplichiamo la FC media per i minuti di attività e dividiamo per i chilometri percorsi. Il riferimento è la mediana dello stesso indice nelle corse entro il ±10% della distanza."
          interpretation="Un costo inferiore viene indicato come “Meglio” perché hai percorso ogni chilometro con meno battiti stimati; un costo superiore viene indicato come “Peggio”."
          caveat="È una stima basata sulla FC media, non sul tracciato battito per battito, e risente di percorso, clima, fatica e accuratezza del sensore."
          latestValue={analysis.latestCardiacCost}
          referenceValue={analysis.cardiacCostReference}
          sampleCount={analysis.comparableCardiacCosts.length}
          formatter={(value) => `${Math.round(value).toLocaleString('it-IT')} battiti/km`}
          axisFormatter={(value) => Math.round(value).toLocaleString('it-IT')}
          deltaFormatter={(difference) => (
            `${Math.abs(Math.round(difference)).toLocaleString('it-IT')} battiti/km ${
              difference < 0 ? 'in meno' : 'in più'
            }`
          )}
          detail="Il confronto usa corse di distanza simile."
        />
      </section>

      <section className="analysis-section-heading">
        <p className="eyebrow">Contesto</p>
        <h2>Qualità, carico e regolarità</h2>
        <p>Indicatori sintetici per leggere la prestazione oltre il semplice passo medio.</p>
      </section>

      <section className="insight-grid" aria-label="Indicatori avanzati dell’ultima corsa">
        <InsightCard
          eyebrow="Percentile"
          title="Posizione tra le corse simili"
          value={percentileValue == null ? '—' : `${percentileValue}° percentile`}
          description={percentileValue == null
            ? 'Non ci sono abbastanza corse comparabili.'
            : `Prestazione migliore del ${percentileValue}% del campione.`}
          progress={percentileValue ?? 0}
          progressLabel={analysis.percentileBasis}
          meta={`${analysis.sameDistance.length} corse simili`}
          information={{
            meaning: 'Indica la posizione dell’ultima corsa rispetto alle attività percorse su una distanza simile. Il 90° percentile significa che il risultato supera il 90% del campione.',
            calculation: 'Selezioniamo le corse entro il ±10% della distanza. Con almeno tre valori completi ordiniamo il campione per efficienza aerobica; altrimenti lo ordiniamo per passo. Il percentile è la quota di corse che l’ultima attività ha eguagliato o superato.',
            interpretation: 'Un percentile alto indica una prestazione relativamente forte, ma la solidità aumenta con il numero di corse comparabili.',
            caveat: 'Il percentile descrive soltanto il campione personale disponibile e può cambiare molto quando le corse comparabili sono poche o svolte con obiettivi differenti.',
          }}
        />
        <InsightCard
          eyebrow="Eccezionalità"
          title="Scostamento dalle attese"
          value={exceptionalityValue == null
            ? '—'
            : `${exceptionalityValue >= 0 ? '+' : ''}${exceptionalityValue.toLocaleString('it-IT', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })} σ`}
          description={exceptionalityLabel}
          progress={exceptionalityProgress}
          progressLabel="Da −3σ a +3σ"
          meta="0σ rappresenta una corsa normale"
          centered
          information={{
            meaning: 'Misura quanto la prestazione si discosta da ciò che il tuo storico avrebbe fatto prevedere per quella distanza, quel passo e quella frequenza cardiaca.',
            calculation: 'I due modelli stimano FC attesa da passo e distanza, e passo atteso da FC e distanza. Trasformiamo entrambi gli scarti in unità dell’errore tipico del rispettivo modello e ne calcoliamo la media, espressa in deviazioni standard (σ).',
            interpretation: 'Valori positivi indicano una corsa sopra le attese, valori negativi sotto le attese; tra −0,5σ e +0,5σ la prestazione è sostanzialmente normale.',
            caveat: 'Con poco storico o condizioni insolite lo scostamento può aumentare senza rappresentare un vero cambiamento di forma. Il dislivello non entra nel modello.',
          }}
        />
        <InsightCard
          eyebrow="Carico attività"
          title="Impatto della singola corsa"
          value={analysis.latestLoad == null
            ? '—'
            : `${analysis.latestLoad.toLocaleString('it-IT', {
              maximumFractionDigits: 1,
            })} punti`}
          description={loadRatio == null
            ? 'Servono durata e frequenza cardiaca valide.'
            : `${Math.abs((loadRatio - 1) * 100).toLocaleString('it-IT', {
              maximumFractionDigits: 0,
            })}% ${loadRatio >= 1 ? 'sopra' : 'sotto'} il carico mediano.`}
          progress={loadRatio == null ? 0 : Math.min(100, loadRatio * 50)}
          progressLabel="Carico relativo alla tua mediana"
          meta={analysis.loadReference == null
            ? undefined
            : `Mediana ${analysis.loadReference.toLocaleString('it-IT', {
              maximumFractionDigits: 1,
            })}`}
          information={{
            meaning: 'Stima l’impatto cardiovascolare della singola attività combinando durata e intensità media.',
            calculation: 'Moltiplichiamo i minuti di corsa per il quadrato del rapporto tra FC media e massima FC osservata nel tuo storico. Il risultato viene poi confrontato con la mediana delle tue attività.',
            interpretation: 'Più punti indicano una seduta relativamente più impegnativa, non necessariamente migliore. È una stima interna e non coincide con il Training Effect Garmin.',
            caveat: 'La massima FC osservata può non coincidere con la tua vera FC massima. Il calcolo non include zone individuali, recupero, carico muscolare o percezione dello sforzo.',
          }}
        />
        <InsightCard
          eyebrow="Fatica"
          title="Carico nei 7 giorni precedenti"
          value={formatDistance(analysis.recent7Distance)}
          description={fatigueLabel}
          progress={analysis.fatigueRatio == null
            ? 0
            : Math.min(100, analysis.fatigueRatio * 50)}
          progressLabel="Rispetto alla media settimanale delle 4 settimane"
          meta={`Riferimento ${formatDistance(analysis.weeklyDistanceBaseline)}`}
          information={{
            meaning: 'Descrive il volume di corsa accumulato prima dell’ultima attività, utile per contestualizzare una prestazione svolta con più o meno carico recente.',
            calculation: 'Sommiamo i chilometri dei 7 giorni precedenti e li confrontiamo con la distanza dei 28 giorni precedenti divisa per quattro.',
            interpretation: 'Un valore elevato segnala più volume del solito e una possibile maggiore fatica, ma considera soltanto i chilometri, non recupero, sonno o intensità.',
            caveat: 'Non è una diagnosi di affaticamento: una settimana con pochi chilometri ma lavori molto intensi può comunque essere impegnativa.',
          }}
        />
        <InsightCard
          eyebrow="Regolarità"
          title="Vicinanza al passo abituale"
          value={regularityValue == null ? '—' : regularityLabel}
          description={analysis.paceVariability == null
            ? 'Servono più corse della stessa distanza.'
            : `La variabilità storica del passo è ${analysis.paceVariability.toLocaleString('it-IT', {
              maximumFractionDigits: 1,
            })}%.`}
          progress={analysis.paceVariability == null
            ? 0
            : Math.min(100, (analysis.paceVariability / 15) * 100)}
          progressLabel="Variabilità del passo: più bassa è più regolare"
          meta={`${analysis.regularitySampleCount} corse confrontate`}
          information={{
            meaning: 'Mostra quanto il passo dell’ultima corsa è vicino al tuo passo abituale sulle distanze comparabili.',
            calculation: 'Confrontiamo il passo con la mediana delle corse entro il ±10% della distanza e calcoliamo anche la variabilità storica come deviazione standard divisa per passo medio.',
            interpretation: 'Essere vicini alla mediana indica regolarità; essere lontani può rappresentare sia una giornata eccezionale sia una corsa volutamente più facile.',
            caveat: 'La regolarità non è sempre l’obiettivo: allenamenti lenti, progressivi o gare dovrebbero produrre passi differenti anche sulla stessa distanza.',
          }}
        />
        <InsightCard
          eyebrow="Escursione cardiaca"
          title="Rapporto FC massima / media"
          value={analysis.latestHeartRateRatio == null
            ? '—'
            : `${analysis.latestHeartRateRatio.toLocaleString('it-IT', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}×`}
          description={analysis.latestHeartRateRatio == null
            ? 'Servono sia la FC media sia la FC massima.'
            : `Il picco è stato ${((analysis.latestHeartRateRatio - 1) * 100).toLocaleString(
              'it-IT',
              { maximumFractionDigits: 1 },
            )}% sopra la FC media.`}
          progress={analysis.latestHeartRateRatio == null
            ? 0
            : Math.min(100, Math.max(0, ((analysis.latestHeartRateRatio - 1) / 0.3) * 100))}
          progressLabel="Escursione tra intensità media e picco"
          meta={analysis.heartRateRatioReference == null
            ? 'Storico non disponibile'
            : `Mediana ${analysis.heartRateRatioReference.toLocaleString('it-IT', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}× · ${analysis.heartRateRatioSampleCount} corse`}
          information={{
            meaning: 'Rappresenta quanto il picco cardiaco della corsa si è allontanato dalla frequenza cardiaca mantenuta mediamente.',
            calculation: 'Dividiamo la FC massima registrata nell’attività per la FC media. Un rapporto di 1,15× equivale a un picco del 15% superiore alla media.',
            interpretation: 'Un rapporto alto indica una maggiore escursione o presenza di picchi, ma non è automaticamente positivo o negativo: dipende dal tipo di allenamento.',
            caveat: 'Un singolo picco errato del sensore può aumentare il rapporto. Per interpretarlo correttamente va considerato insieme al tipo di seduta e al grafico cardiaco completo.',
          }}
        />
      </section>

      <HeartRateZoneAnalysis latest={analysis.latest} historical={analysis.historical} />

      <EffortScatter historical={analysis.allPrevious} latest={analysis.latest} />
    </div>
  )
}

export default Dashboard
