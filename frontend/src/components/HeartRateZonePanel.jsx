import { formatDuration } from '../utils/formatters.js'
import {
  HEART_RATE_ZONE_COLORS,
  heartRateZoneSummary,
  median,
} from '../domain/dashboardAnalysis.js'

function HeartRateZonePanel({
  latest,
  historical,
  activityLabel,
  titleId,
  sport = 'running',
}) {
  const latestSummary = heartRateZoneSummary(latest)
  const historicalSummaries = historical.map(heartRateZoneSummary).filter(Boolean)
  const easyReference = median(historicalSummaries.map((summary) => summary.easyShare))
  const easyDifference = latestSummary && easyReference != null
    ? latestSummary.easyShare - easyReference
    : null
  const mediumShare = latestSummary?.zones[2]?.percentage ?? 0

  return (
    <section
      className={`panel hr-zone-panel ${sport}-zone-panel`}
      aria-labelledby={titleId}
    >
      <div className="panel-heading hr-zone-heading">
        <div>
          <p className="eyebrow">Distribuzione dello sforzo</p>
          <h2 id={titleId}>Zone cardiache</h2>
          <p>
            Tempo trascorso in ciascuna zona nell’ultima {activityLabel} e confronto
            con le attività precedenti dotate di dati Garmin.
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
          <div className="zone-insights combined-zone-insights">
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
              <span>Media intensità · Z3</span>
              <strong>{mediumShare.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%</strong>
              <small>Quota svolta a intensità moderata</small>
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
            aria-label={`Distribuzione percentuale delle zone cardiache nell’ultima ${activityLabel}`}
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
          <strong>Zone non ancora disponibili per questa {activityLabel}</strong>
          <p>
            Premi “Sincronizza Garmin”: le attività più recenti prive di zone vengono
            completate progressivamente.
          </p>
        </div>
      )}
    </section>
  )
}

export default HeartRateZonePanel
