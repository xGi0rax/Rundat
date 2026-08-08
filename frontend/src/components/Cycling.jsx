import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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
} from '../utils/formatters.js'
import {
  HEART_RATE_ZONE_COLORS,
  comparisonStatus,
  confidenceFor,
  distanceKm,
  heartRate,
  heartRateZoneSummary,
  median,
} from '../domain/dashboardAnalysis.js'
import {
  analyzeCyclingActivities,
  cyclingSpeedKmh,
} from '../domain/cyclingAnalysis.js'
import { normalizePeriod, periodRange } from '../domain/periods.js'

function formatSpeed(value) {
  return Number.isFinite(value)
    ? `${value.toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km/h`
    : '—'
}

function formatElevation(value) {
  return Number.isFinite(Number(value))
    ? `${Math.round(Number(value)).toLocaleString('it-IT')} m`
    : '—'
}

function ComparisonCard({
  eyebrow,
  title,
  description,
  latestValue,
  referenceValue,
  sampleCount,
  formatter,
  axisFormatter,
  lowerIsBetter = false,
  rangeLabel,
  detail,
}) {
  const status = comparisonStatus(latestValue, referenceValue, lowerIsBetter)
  const confidence = confidenceFor(sampleCount)
  const hasComparison = status && sampleCount > 0
  const chartData = hasComparison
    ? [
        { label: 'Mediana storico', value: referenceValue, fill: '#b8c2b8' },
        {
          label: 'Ultima uscita',
          value: latestValue,
          fill: status.tone === 'positive'
            ? '#315e3b'
            : status.tone === 'negative' ? '#b5533c' : '#345f9d',
        },
      ]
    : []

  return (
    <article className="panel comparison-panel cycling-comparison-panel">
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
            {status.label} {Math.abs(status.improvement).toLocaleString('it-IT', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}%
          </span>
        )}
      </div>

      {hasComparison ? (
        <>
          <div className="comparison-values">
            <div>
              <span>Ultima uscita</span>
              <strong>{formatter(latestValue)}</strong>
            </div>
            <div>
              <span>Mediana storico</span>
              <strong>{formatter(referenceValue)}</strong>
            </div>
          </div>
          <div className="comparison-chart" aria-label={`${title}: ultima uscita e storico`}>
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
            <span>{sampleCount} {sampleCount === 1 ? 'uscita confrontata' : 'uscite confrontate'}</span>
            {detail && <span>{detail}</span>}
          </div>
        </>
      ) : (
        <div className="comparison-empty">
          <strong>Dati insufficienti</strong>
          <p>Servono altre uscite con valori comparabili per costruire questo confronto.</p>
        </div>
      )}
    </article>
  )
}

function LatestRideSummary({ activity }) {
  return (
    <section className="latest-run-summary latest-cycle-summary" aria-label="Dati dell’ultima uscita in bici">
      <div className="latest-run-identity">
        <span>Ultima attività analizzata</span>
        <strong>{formatDate(activity.startTimeLocal, 'long')}</strong>
        <small>{activity.activityName || 'Uscita in bici'}</small>
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
        <span>Velocità media</span>
        <strong>{formatSpeed(cyclingSpeedKmh(activity))}</strong>
      </div>
      <div>
        <span>FC media</span>
        <strong>{formatHeartRate(activity.averageHR)}</strong>
      </div>
      <div>
        <span>Dislivello</span>
        <strong>{formatElevation(activity.elevationGain)}</strong>
      </div>
    </section>
  )
}

function CyclingCharts({ activities, latest }) {
  const [period, setPeriod] = useState({ amount: 1, unit: 'year' })
  const referenceDate = new Date(latest.startTimeLocal)
  const normalizedPeriod = normalizePeriod(period, activities, referenceDate)
  const selectedRange = periodRange(normalizedPeriod, 0, referenceDate)
  const selectedActivities = useMemo(() => activities
    .filter((activity) => {
      const date = new Date(activity.startTimeLocal)
      return !Number.isNaN(date.getTime())
        && date >= selectedRange.start
        && date <= selectedRange.end
    })
    .sort((first, second) => new Date(first.startTimeLocal) - new Date(second.startTimeLocal)), [
    activities,
    selectedRange.end,
    selectedRange.start,
  ])
  const trendData = selectedActivities.map((activity) => ({
    id: activity.activityId,
    date: formatDate(activity.startTimeLocal, 'short'),
    name: activity.activityName || 'Uscita in bici',
    speed: cyclingSpeedKmh(activity),
    heartRate: heartRate(activity),
  }))
  const scatterData = trendData.filter(
    (activity) => Number.isFinite(activity.speed) && Number.isFinite(activity.heartRate),
  )
  const latestZones = heartRateZoneSummary(latest)
  const historicalZoneSummaries = selectedActivities
    .filter((activity) => activity.activityId !== latest.activityId)
    .map(heartRateZoneSummary)
    .filter(Boolean)
  const zoneData = latestZones?.zones.map((zone, index) => ({
    zone: `Z${zone.zone}`,
    latest: zone.percentage,
    history: median(historicalZoneSummaries.map((summary) => summary.zones[index].percentage)),
  })) ?? []
  const medianSpeed = median(scatterData.map((activity) => activity.speed))
  const medianHeartRate = median(scatterData.map((activity) => activity.heartRate))

  return (
    <>
      <section className="analysis-section-heading cycling-history-heading">
        <div>
          <p className="eyebrow">Andamento</p>
          <h2>Velocità, sforzo e zone cardio</h2>
          <p>I grafici includono soltanto le uscite comprese nel periodo selezionato.</p>
        </div>
        <PeriodPicker
          value={normalizedPeriod}
          onChange={setPeriod}
          activities={activities}
          idPrefix="cycling-analysis-period"
          dateRange={selectedRange}
          referenceDate={referenceDate}
        />
      </section>

      <section className="comparison-grid cycling-charts-grid" aria-label="Grafici delle uscite in bici">
        <article className="panel cycling-chart-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Trend attività</p>
              <h2>Velocità e frequenza cardiaca</h2>
              <p>{selectedActivities.length} uscite nel periodo selezionato.</p>
            </div>
          </div>
          {trendData.some((activity) => activity.speed || activity.heartRate) ? (
            <div className="cycling-analysis-chart">
              <ChartContainer>
                <LineChart data={trendData} margin={{ top: 12, right: 18, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="#e1e4df" vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} minTickGap={22} />
                  <YAxis
                    yAxisId="speed"
                    tickFormatter={(value) => `${Number(value).toFixed(0)}`}
                    tickLine={false}
                    axisLine={false}
                    width={34}
                  />
                  <YAxis
                    yAxisId="heartRate"
                    orientation="right"
                    tickFormatter={(value) => `${Math.round(value)}`}
                    tickLine={false}
                    axisLine={false}
                    width={36}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      name === 'Velocità media' ? formatSpeed(value) : formatHeartRate(value),
                      name,
                    ]}
                  />
                  <Legend />
                  <Line
                    yAxisId="speed"
                    type="monotone"
                    dataKey="speed"
                    name="Velocità media"
                    stroke="#345f9d"
                    strokeWidth={2.5}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                  <Line
                    yAxisId="heartRate"
                    type="monotone"
                    dataKey="heartRate"
                    name="FC media"
                    stroke="#d16b49"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                    connectNulls
                  />
                </LineChart>
              </ChartContainer>
            </div>
          ) : (
            <div className="comparison-empty">
              <strong>Nessun trend disponibile</strong>
              <p>Le uscite del periodo non hanno dati validi di velocità o frequenza cardiaca.</p>
            </div>
          )}
        </article>

        <article className="panel cycling-chart-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Intensità</p>
              <h2>Zone cardio dell’ultima uscita</h2>
              <p>Confronto percentuale con la mediana delle altre uscite nel periodo.</p>
            </div>
          </div>
          {zoneData.length && historicalZoneSummaries.length ? (
            <div className="cycling-analysis-chart">
              <ChartContainer>
                <BarChart data={zoneData} margin={{ top: 12, right: 12, left: 0, bottom: 8 }}>
                  <CartesianGrid stroke="#e1e4df" vertical={false} />
                  <XAxis dataKey="zone" tickLine={false} axisLine={false} />
                  <YAxis
                    domain={[0, 100]}
                    tickFormatter={(value) => `${value}%`}
                    tickLine={false}
                    axisLine={false}
                    width={42}
                  />
                  <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`]} />
                  <Legend />
                  <Bar dataKey="history" name="Mediana storico" fill="#c7cfca" radius={[5, 5, 0, 0]} />
                  <Bar dataKey="latest" name="Ultima uscita" radius={[5, 5, 0, 0]}>
                    {zoneData.map((_zone, index) => (
                      <Cell key={`zone-${index + 1}`} fill={HEART_RATE_ZONE_COLORS[index]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          ) : (
            <div className="comparison-empty">
              <strong>Dati cardio insufficienti</strong>
              <p>Servono le zone dell’ultima uscita e di almeno un’attività precedente.</p>
            </div>
          )}
        </article>
      </section>

      <article className="panel cycling-chart-panel cycling-effort-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Quadro generale</p>
            <h2>Velocità a parità di sforzo</h2>
            <p>Più un punto è in alto e a sinistra, maggiore è la velocità con meno battiti.</p>
          </div>
        </div>
        {scatterData.length > 1 ? (
          <div className="cycling-analysis-chart cycling-scatter-chart">
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
                  dataKey="speed"
                  name="Velocità media"
                  unit=" km/h"
                  domain={['auto', 'auto']}
                  tickLine={false}
                  axisLine={false}
                  width={52}
                />
                <ReferenceLine x={medianHeartRate} stroke="#9da8a0" strokeDasharray="4 4" />
                <ReferenceLine y={medianSpeed} stroke="#9da8a0" strokeDasharray="4 4" />
                <Tooltip
                  cursor={{ strokeDasharray: '4 4' }}
                  formatter={(value, name) => [
                    name === 'Velocità media' ? formatSpeed(value) : formatHeartRate(value),
                    name,
                  ]}
                  labelFormatter={(_value, payload) => payload?.[0]?.payload?.name ?? ''}
                />
                <Scatter data={scatterData} fill="#345f9d" />
              </ScatterChart>
            </ChartContainer>
          </div>
        ) : (
          <div className="comparison-empty">
            <strong>Dati insufficienti</strong>
            <p>Servono almeno due uscite con velocità e frequenza cardiaca valide.</p>
          </div>
        )}
      </article>
    </>
  )
}

function Cycling({ activities, syncState = { status: 'idle', message: '' }, onSync }) {
  const analysis = useMemo(() => analyzeCyclingActivities(activities), [activities])

  if (!analysis) {
    return (
      <div className="page-stack">
        <section className="page-heading compact-heading cycling-heading">
          <div>
            <p className="eyebrow">Ciclismo</p>
            <h1>Analisi delle uscite in bici.</h1>
            <p>Sincronizza Garmin per importare e confrontare le tue attività.</p>
          </div>
          {onSync && (
            <button type="button" className="sync-button" onClick={onSync}>Sincronizza Garmin</button>
          )}
        </section>
        <section className="panel comparison-empty cycling-empty">
          <strong>Nessuna uscita in bici sincronizzata</strong>
          <p>Quando importerai la prima attività, qui compariranno analisi e grafici.</p>
        </section>
      </div>
    )
  }

  const positiveSignals = [
    comparisonStatus(analysis.latestHeartRate, analysis.speedReferenceHeartRate, true),
    comparisonStatus(analysis.latestSpeed, analysis.heartRateReferenceSpeed, false),
    comparisonStatus(analysis.latestSpeed, analysis.distanceReferenceSpeed, false),
    comparisonStatus(analysis.latestEfficiency, analysis.efficiencyReference, false),
  ].filter((status) => status?.tone === 'positive').length

  return (
    <div className="page-stack">
      <section className="page-heading latest-analysis-heading cycling-heading">
        <div>
          <p className="eyebrow">Ciclismo</p>
          <h1>Dentro l’ultima uscita.</h1>
          <p>
            Confronti con attività simili per capire velocità, efficienza cardiaca
            e distribuzione dello sforzo.
          </p>
        </div>
        <div className="dashboard-actions">
          <button
            type="button"
            className="sync-button"
            onClick={onSync}
            disabled={!onSync || syncState.status === 'loading'}
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

      <LatestRideSummary activity={analysis.latest} />

      <section className="analysis-verdict cycling-verdict">
        <div>
          <span>Lettura sintetica</span>
          <strong>
            {positiveSignals >= 3
              ? 'Segnali di miglioramento solidi'
              : positiveSignals >= 1 ? 'Alcuni segnali positivi' : 'Uscita in linea o da consolidare'}
          </strong>
        </div>
        <p>
          {positiveSignals} indicatori positivi su 4 · confronto basato
          {analysis.usedRecentWindow ? ' sugli ultimi 12 mesi' : ' su tutto lo storico disponibile'}.
        </p>
      </section>

      <section className="comparison-grid" aria-label="Confronti dell’ultima uscita in bici">
        <ComparisonCard
          eyebrow="Efficienza cardiaca"
          title="FC a velocità simile"
          description="Battiti medi rispetto alle uscite entro il ±5% della stessa velocità."
          latestValue={analysis.latestHeartRate}
          referenceValue={analysis.speedReferenceHeartRate}
          sampleCount={analysis.sameSpeed.length}
          formatter={(value) => `${Math.round(value)} bpm`}
          axisFormatter={(value) => Math.round(value)}
          lowerIsBetter
          rangeLabel={analysis.latestSpeed
            ? `${formatSpeed(analysis.latestSpeed * 0.95)} – ${formatSpeed(analysis.latestSpeed * 1.05)}`
            : 'non disponibile'}
        />
        <ComparisonCard
          eyebrow="Velocità a pari sforzo"
          title="Velocità a FC simile"
          description="Velocità media rispetto alle uscite effettuate entro ±5 bpm dalla stessa FC."
          latestValue={analysis.latestSpeed}
          referenceValue={analysis.heartRateReferenceSpeed}
          sampleCount={analysis.sameHeartRate.length}
          formatter={formatSpeed}
          axisFormatter={(value) => Number(value).toFixed(0)}
          rangeLabel={analysis.latestHeartRate
            ? `${Math.max(0, Math.round(analysis.latestHeartRate - 5))} – ${Math.round(analysis.latestHeartRate + 5)} bpm`
            : 'non disponibile'}
        />
        <ComparisonCard
          eyebrow="Prestazione sulla distanza"
          title="Velocità a distanza simile"
          description="Velocità media rispetto alle uscite entro il ±10% della stessa distanza."
          latestValue={analysis.latestSpeed}
          referenceValue={analysis.distanceReferenceSpeed}
          sampleCount={analysis.sameDistance.length}
          formatter={formatSpeed}
          axisFormatter={(value) => Number(value).toFixed(0)}
          rangeLabel={analysis.latestDistance
            ? `${formatDistance(analysis.latestDistance * 0.9)} – ${formatDistance(analysis.latestDistance * 1.1)}`
            : 'non disponibile'}
          detail={`Distanza di riferimento: ${formatDistance(analysis.latestDistance)}.`}
        />
        <ComparisonCard
          eyebrow="Efficienza aerobica"
          title="Velocità per battito"
          description="Rapporto tra velocità e FC rispetto alle uscite con dati cardiaci disponibili."
          latestValue={analysis.latestEfficiency}
          referenceValue={analysis.efficiencyReference}
          sampleCount={analysis.efficiencyRides.length}
          formatter={(value) => Number(value).toLocaleString('it-IT', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          axisFormatter={(value) => Number(value).toFixed(1)}
          rangeLabel="tutte le uscite con velocità e frequenza cardiaca valide"
        />
      </section>

      <CyclingCharts activities={activities} latest={analysis.latest} />
    </div>
  )
}

export default Cycling
