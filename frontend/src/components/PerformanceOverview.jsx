import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts'
import ChartContainer from './ChartContainer.jsx'
import PeriodPicker from './PeriodPicker.jsx'
import { analyzeFitnessFreshness, analyzePerformance } from '../domain/performanceAnalysis.js'

function percent(value) {
  return value == null ? '—' : `${value > 0 ? '+' : ''}${Math.round(value)}%`
}

function strainIndicator(value, maximum, type) {
  const position = maximum > 0 ? Math.min(100, (value / maximum) * 100) : 0
  if (type === 'monotony') {
    return {
      position: Math.min(100, (value / 3) * 100),
      tone: value >= 2 ? 'caution' : 'positive',
      label: value >= 2 ? 'Poca variabilità tra i giorni' : 'Variabilità presente',
    }
  }
  return {
    position,
    tone: position >= 75 ? 'caution' : 'positive',
    label: position >= 75 ? 'Carico elevato rispetto al periodo' : 'Carico contenuto',
  }
}

function PerformanceInfoDialog({ title, information, onClose }) {
  return (
    <div className="info-modal-backdrop" onMouseDown={onClose}>
      <section
        className="info-modal activity-detail-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="performance-info-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="info-modal-header">
          <div>
            <p className="eyebrow">Dettagli indicatore</p>
            <h2 id="performance-info-title">{title}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Chiudi">×</button>
        </header>
        <div className="info-modal-content">
          <h3>Cosa indica</h3>
          <p>{information.meaning}</p>
          <h3>Come viene calcolato</h3>
          <p>{information.calculation}</p>
          <h3>Come leggerlo</h3>
          <p>{information.interpretation}</p>
          <div className="info-caveat">
            <h3>Limiti</h3>
            <p>{information.caveat}</p>
          </div>
        </div>
      </section>
    </div>
  )
}

function PerformanceIndicator({ indicator }) {
  if (!indicator) return null
  return (
    <div className={`performance-indicator performance-indicator-${indicator.tone}`}>
      <div className="performance-meter" aria-hidden="true">
        <span className="performance-meter-fill" style={{ width: `${indicator.position}%` }} />
        {indicator.centered && <span className="performance-meter-center" />}
        <span className="performance-meter-marker" style={{ left: `${indicator.position}%` }} />
      </div>
      <span className="performance-indicator-label">{indicator.label}</span>
    </div>
  )
}

function PerformanceCard({ title, value, details, information, indicator }) {
  const [showInfo, setShowInfo] = useState(false)
  return (
    <article className="performance-card">
      <div className="performance-card-heading">
        <span>{title}</span>
        <button
          type="button"
          className="comparison-info-button insight-info-button"
          onClick={() => setShowInfo(true)}
          aria-label={`Informazioni su ${title}`}
          title="Come viene calcolato"
        >
          i
        </button>
      </div>
      <strong>{value}</strong>
      {details.map((detail) => <small key={detail}>{detail}</small>)}
      <PerformanceIndicator indicator={indicator} />
      {showInfo && (
        <PerformanceInfoDialog
          title={title}
          information={information}
          onClose={() => setShowInfo(false)}
        />
      )}
    </article>
  )
}

function FreshnessInfoDialog({ onClose }) {
  return (
    <PerformanceInfoDialog
      title="Condizione fisica, affaticamento e forma"
      information={{
        meaning: 'La condizione fisica rappresenta il carico accumulato nel tempo, l’affaticamento il carico recente e la forma la differenza tra i due valori.',
        calculation: 'Il carico giornaliero usa durata e tempo trascorso nelle zone cardiache. Condizione fisica e affaticamento sono medie esponenziali del carico, rispettivamente su 42 e 7 giorni. La forma è condizione fisica meno affaticamento.',
        interpretation: 'Una forma più alta indica meno affaticamento rispetto alla condizione accumulata. Una forma più bassa indica un carico recente maggiore e quindi possibile stanchezza.',
        caveat: 'È un modello stimato da Rundat, ispirato al modello impulso-risposta di Banister. Non replica l’algoritmo proprietario di Strava e non è una valutazione medica.',
      }}
      onClose={onClose}
    />
  )
}

function FreshnessChart({ analysis, onInfo }) {
  const [visibleSeries, setVisibleSeries] = useState({
    fatigue: true,
    form: true,
  })
  const current = analysis.current
  if (!current) return null
  return (
    <article className="panel performance-freshness-panel">
      <div className="performance-freshness-heading">
        <div>
          <p className="eyebrow">Fitness &amp; Freshness</p>
          <div className="performance-section-title">
            <h3>Condizione fisica e forma</h3>
            <button
              type="button"
              className="comparison-info-button insight-info-button"
              onClick={onInfo}
              aria-label="Informazioni su condizione fisica, affaticamento e forma"
              title="Come viene calcolato"
            >
              i
            </button>
          </div>
          <p>Il rapporto tra carico accumulato, affaticamento recente e forma.</p>
        </div>
        <PeriodPicker
          value={analysis.period}
          onChange={analysis.onPeriodChange}
          activities={analysis.activities}
          idPrefix="freshness-period"
          dateRange={{ start: analysis.start, end: analysis.end }}
          className="performance-freshness-picker"
        />
      </div>
      <div className="performance-freshness-summary">
        <div><span>Condizione fisica</span><strong>{current.fitness}</strong></div>
        <div><span>Affaticamento</span><strong>{current.fatigue}</strong></div>
        <div><span>Forma fisica</span><strong>{current.form > 0 ? '+' : ''}{current.form}</strong></div>
      </div>
      <div className="performance-freshness-toggles" role="group" aria-label="Serie visibili nel grafico">
        <label>
          <input
            type="checkbox"
            checked={visibleSeries.fatigue}
            onChange={(event) => setVisibleSeries((currentVisibility) => ({
              ...currentVisibility,
              fatigue: event.target.checked,
            }))}
          />
          <span className="performance-freshness-toggle-dot fatigue" aria-hidden="true" />
          Affaticamento
        </label>
        <label>
          <input
            type="checkbox"
            checked={visibleSeries.form}
            onChange={(event) => setVisibleSeries((currentVisibility) => ({
              ...currentVisibility,
              form: event.target.checked,
            }))}
          />
          <span className="performance-freshness-toggle-dot form" aria-hidden="true" />
          Forma fisica
        </label>
      </div>
      <div className="performance-freshness-chart">
        <ChartContainer>
          <LineChart data={analysis.data} margin={{ top: 12, right: 18, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={34} />
            <YAxis tickLine={false} axisLine={false} width={38} />
            <Tooltip
              labelFormatter={(value) => value}
              formatter={(value, name) => [
                value,
                name === 'fitness'
                  ? 'Condizione fisica'
                  : name === 'fatigue' ? 'Affaticamento' : 'Forma fisica',
              ]}
            />
            <Line type="monotone" dataKey="fitness" stroke="#ef5b24" strokeWidth={2.5} dot={false} />
            {visibleSeries.fatigue && (
              <Line type="monotone" dataKey="fatigue" stroke="#9b9b9b" strokeWidth={2} dot={false} />
            )}
            {visibleSeries.form && (
              <Line type="monotone" dataKey="form" stroke="#286b70" strokeWidth={2} dot={false} />
            )}
          </LineChart>
        </ChartContainer>
      </div>
    </article>
  )
}

function PerformanceOverview({ activities, racePredictions }) {
  const [showStrainInfo, setShowStrainInfo] = useState(false)
  const [freshnessPeriod, setFreshnessPeriod] = useState({ amount: 12, unit: 'month' })
  const analysis = useMemo(
    () => analyzePerformance(activities, racePredictions),
    [activities, racePredictions],
  )
  const freshness = useMemo(
    () => analyzeFitnessFreshness(activities, freshnessPeriod),
    [activities, freshnessPeriod],
  )
  const [showFreshnessInfo, setShowFreshnessInfo] = useState(false)
  const { summary, buckets } = analysis
  const loadRatio = summary.chronicLoad > 0 ? summary.latestLoad / summary.chronicLoad : 1
  const loadPosition = Math.max(0, Math.min(100, loadRatio * 50))
  const loadTone = loadRatio < 0.75 || loadRatio > 1.25 ? 'caution' : 'positive'
  const efficiencyPosition = Math.max(0, Math.min(100, 50 + (summary.efficiencyChange || 0)))
  const efficiencyTone = summary.efficiencyChange == null
    ? 'neutral'
    : summary.efficiencyChange >= 0 ? 'positive' : 'negative'
  const strainMaximum = Math.max(...buckets.map((bucket) => bucket.strain), 1)
  const monotonyIndicator = strainIndicator(summary.latestMonotony, strainMaximum, 'monotony')
  const strainIndicatorValue = strainIndicator(summary.latestStrain, strainMaximum, 'strain')
  return (
    <section className="performance-overview" aria-label="Carico e prestazione">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Analisi interna</p>
          <h2>Carico e prestazione</h2>
        </div>
      </div>
      <FreshnessChart
        analysis={{
          ...freshness,
          period: freshnessPeriod,
          onPeriodChange: setFreshnessPeriod,
          activities,
        }}
        onInfo={() => setShowFreshnessInfo(true)}
      />
      {showFreshnessInfo && <FreshnessInfoDialog onClose={() => setShowFreshnessInfo(false)} />}
      <div className="performance-cards">
        <PerformanceCard
          title="Carico recente"
          value={summary.latestLoad}
          details={[
            `Media precedente: ${summary.chronicLoad || '—'}`,
            `${percent(summary.loadChange)} rispetto alla settimana precedente`,
          ]}
          indicator={{
            position: loadPosition,
            centered: true,
            tone: loadTone,
            label: loadRatio < 0.75
              ? 'Sotto il carico abituale'
              : loadRatio > 1.25 ? 'Sopra il carico abituale' : 'In linea con il carico abituale',
          }}
          information={{
            meaning: 'Stima quanto è stata impegnativa l’ultima settimana rispetto al tuo carico abituale.',
            calculation: 'Usa la durata e il tempo trascorso nelle zone cardio, con un peso crescente dalle zone facili alle zone intense. Se mancano le zone, usa frequenza cardiaca media e massima.',
            interpretation: 'Un valore più alto indica più stress allenante, non necessariamente una prestazione migliore.',
            caveat: 'È un indicatore interno di Rundat e non coincide con il Training Load Garmin.',
          }}
        />
        <PerformanceCard
          title="Costanza"
          value={`${summary.activeDays} giorni`}
          details={[
            `${summary.averageActivities} attività a settimana`,
            `${summary.runLoadShare ?? '—'}% del carico dalla corsa`,
          ]}
          indicator={{
            position: Math.min(100, (summary.activeDays / (12 * 7)) * 100),
            tone: 'positive',
            label: `${Math.round((summary.activeDays / (12 * 7)) * 100)}% dei giorni attivi`,
          }}
          information={{
            meaning: 'Descrive la regolarità con cui hai svolto attività nelle ultime 12 settimane.',
            calculation: 'Conta i giorni distinti con almeno una corsa o uscita in bici e calcola la media settimanale delle attività.',
            interpretation: 'Più giorni attivi e una frequenza stabile indicano maggiore continuità.',
            caveat: 'La continuità non valuta la qualità degli allenamenti né stabilisce quanti giorni dovresti allenarti.',
          }}
        />
        <PerformanceCard
          title="Efficienza cardio"
          value={percent(summary.efficiencyChange)}
          details={[
            'Variazione del rapporto velocità / FC',
            'Confronto tra le ultime due settimane',
          ]}
          indicator={{
            position: efficiencyPosition,
            centered: true,
            tone: efficiencyTone,
            label: summary.efficiencyChange == null
              ? 'Dati insufficienti'
              : summary.efficiencyChange >= 0 ? 'Miglioramento' : 'Peggioramento',
          }}
          information={{
            meaning: 'Confronta quanta velocità ottieni per ogni battito medio registrato.',
            calculation: 'Per ogni attività calcola velocità media divisa per frequenza cardiaca media, poi confronta le medie settimanali.',
            interpretation: 'Un aumento può indicare un rapporto più favorevole tra ritmo e frequenza cardiaca.',
            caveat: 'Percorso, vento, dislivello, temperatura e tipo di allenamento possono influenzare molto il risultato.',
          }}
        />
      </div>
      <article className="panel performance-consistency-panel">
        <div className="performance-consistency-heading">
          <div>
            <p className="eyebrow">Regolarità</p>
            <h3>Consistenza dell’allenamento</h3>
          </div>
          <div className="performance-consistency-summary">
            <span><strong>{summary.consecutiveActiveWeeks}</strong> settimane consecutive</span>
            <span><strong>{summary.inactiveWeeks}</strong> settimane senza attività</span>
            <span><strong>{summary.averageActiveDays}</strong> giorni attivi/settimana</span>
            <span><strong>{summary.runningActivities}</strong> corsa · <strong>{summary.cyclingActivities}</strong> bici</span>
          </div>
        </div>
        <div className="performance-sport-balance">
          <div className="performance-sport-balance-heading">
            <div>
              <p className="eyebrow">Bilanciamento sport</p>
              <h3>Come distribuisci il carico</h3>
            </div>
            <span>Ultime 12 settimane</span>
          </div>
          <div className="performance-sport-balance-grid">
            <div className="performance-sport-stat">
              <strong>{summary.runLoadShare ?? '—'}%</strong>
              <span>Carico corsa</span>
            </div>
            <div className="performance-sport-stat">
              <strong>{summary.runLoadShare == null ? '—' : 100 - summary.runLoadShare}%</strong>
              <span>Carico bici</span>
            </div>
            <div className="performance-sport-stat">
              <strong>{summary.runningTimeShare ?? '—'}%</strong>
              <span>Tempo corsa</span>
            </div>
            <div className="performance-sport-stat">
              <strong>{summary.runningDistanceShare ?? '—'}%</strong>
              <span>Distanza corsa</span>
            </div>
          </div>
          <div className="performance-sport-chart">
            <ChartContainer>
              <BarChart data={buckets}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={42} />
                <Tooltip formatter={(value, name) => [
                  value,
                  name === 'runningLoad' ? 'Carico corsa' : 'Carico bici',
                ]} />
                <Bar dataKey="runningLoad" name="runningLoad" fill="#315e3b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cyclingLoad" name="cyclingLoad" fill="#ef5b24" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        </div>
        <div className="performance-consistency-chart">
          <ChartContainer>
            <BarChart data={buckets}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} />
              <Tooltip formatter={(value, name) => [
                value,
                name === 'activeDays' ? 'Giorni attivi' : 'Attività',
              ]} />
              <Bar dataKey="activeDays" name="activeDays" fill="#315e3b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="activities" name="activities" fill="#ef5b24" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </article>
      <article className="panel performance-quality-panel">
        <div className="performance-quality-heading">
          <div>
            <p className="eyebrow">Affidabilità del dataset</p>
            <div className="performance-section-title">
              <h3>Qualità dei dati</h3>
            </div>
          </div>
          <div className="performance-quality-summary performance-quality-summary-compact">
            {[
              ['heartRate', 'Frequenza cardiaca'],
              ['zones', 'Zone cardio'],
              ['elevation', 'Dislivello'],
            ].map(([key, label]) => {
              const value = summary.dataQuality[key]
              return (
                <div key={key} className="performance-quality-metric">
                  <div><span>{label}</span><strong>{value ?? '—'}%</strong></div>
                  <span className="performance-quality-meter">
                    <span style={{ width: `${value ?? 0}%` }} />
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </article>
      <article className="panel performance-strain-panel">
        <div className="performance-strain-heading">
          <div>
            <p className="eyebrow">Variabilità del carico</p>
            <div className="performance-section-title">
              <h3>Monotonia e strain</h3>
              <button
                type="button"
                className="comparison-info-button insight-info-button"
                onClick={() => setShowStrainInfo(true)}
                aria-label="Informazioni su monotonia e strain"
                title="Come vengono calcolati"
              >
                i
              </button>
            </div>
            <p>Individuano settimane cariche e poco variabili, con pochi giorni realmente facili.</p>
          </div>
          <div className="performance-strain-summary">
            <div className={`performance-strain-metric performance-indicator-${monotonyIndicator.tone}`}>
              <div className="performance-strain-metric-label">
                <span>Monotonia</span>
                <strong>{summary.latestMonotony.toLocaleString('it-IT', { maximumFractionDigits: 2 })}</strong>
              </div>
              <div className="performance-meter" aria-hidden="true">
                <span className="performance-meter-fill" style={{ width: `${monotonyIndicator.position}%` }} />
                <span className="performance-meter-marker" style={{ left: `${monotonyIndicator.position}%` }} />
              </div>
              <small>{monotonyIndicator.label}</small>
            </div>
            <div className={`performance-strain-metric performance-indicator-${strainIndicatorValue.tone}`}>
              <div className="performance-strain-metric-label">
                <span>Strain</span>
                <strong>{summary.latestStrain.toLocaleString('it-IT')}</strong>
              </div>
              <div className="performance-meter" aria-hidden="true">
                <span className="performance-meter-fill" style={{ width: `${strainIndicatorValue.position}%` }} />
                <span className="performance-meter-marker" style={{ left: `${strainIndicatorValue.position}%` }} />
              </div>
              <small>{strainIndicatorValue.label}</small>
            </div>
            <span className="performance-strain-peak">Picco del periodo: <strong>{summary.highestStrain.strain.toLocaleString('it-IT')}</strong> ({summary.highestStrain.label})</span>
          </div>
        </div>
        {showStrainInfo && (
          <PerformanceInfoDialog
            title="Monotonia e strain"
            information={{
              meaning: 'La monotonia misura quanto il carico giornaliero è distribuito in modo uniforme durante una settimana. Lo strain combina il carico totale della settimana con questa uniformità per evidenziare periodi impegnativi e poco variabili.',
              calculation: 'Per ogni settimana sommiamo il carico interno delle attività svolte in ciascuno dei sette giorni. La monotonia è la media dei sette carichi giornalieri divisa per la loro deviazione standard. Lo strain è il carico settimanale moltiplicato per la monotonia.',
              interpretation: 'Una monotonia alta indica giorni con carichi simili e poca alternanza tra allenamento e recupero. Uno strain alto richiede contemporaneamente un carico settimanale elevato e una bassa variabilità giornaliera.',
              caveat: 'Sono indicatori interni e non una diagnosi di rischio o di affaticamento. Una settimana senza attività ha monotonia e strain pari a zero; i valori dipendono dalla stima del carico e non considerano sonno, stress, dolore o recupero.',
            }}
            onClose={() => setShowStrainInfo(false)}
          />
        )}
        <div className="performance-strain-chart">
          <ChartContainer>
            <LineChart data={buckets}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis yAxisId="strain" tickLine={false} axisLine={false} width={42} />
              <YAxis yAxisId="monotony" orientation="right" tickLine={false} axisLine={false} width={42} />
              <Tooltip formatter={(value, name) => [
                value,
                name === 'strain' ? 'Strain' : 'Monotonia',
              ]} />
              <Line yAxisId="strain" type="monotone" dataKey="strain" name="strain" stroke="#ef5b24" strokeWidth={3} dot={false} />
              <Line yAxisId="monotony" type="monotone" dataKey="monotony" name="monotony" stroke="#315e3b" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        </div>
        <div className="performance-strain-legend">
          <span><i className="performance-legend-dot positive" /> situazione più contenuta</span>
          <span><i className="performance-legend-dot caution" /> attenzione: carico o monotonia elevati</span>
        </div>
      </article>
      <div className="performance-charts">
        <article className="panel performance-chart-panel">
          <h3>Carico e volume</h3>
          <div className="performance-chart">
            <ChartContainer>
              <LineChart data={buckets}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis tickLine={false} axisLine={false} width={42} />
              <Tooltip formatter={(value, name) => [value, name === 'load' ? 'Carico' : 'Media 4 settimane']} />
              <Line type="monotone" dataKey="load" name="load" stroke="#ef5b24" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="chronicLoad" name="chronicLoad" stroke="#315e3b" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </div>
        </article>
        <article className="panel performance-chart-panel">
          <h3>Distribuzione dell’intensità</h3>
          <div className="performance-chart">
            <ChartContainer>
              <LineChart data={buckets}>
              <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} />
              <YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} width={42} />
              <Tooltip formatter={(value, name) => [`${value ?? '—'}%`, name]} />
              <Line type="monotone" dataKey="easyShare" name="Facile" stroke="#4f7d59" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="moderateShare" name="Moderata" stroke="#e57a32" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="hardShare" name="Intensa" stroke="#c73636" strokeWidth={2} dot={false} />
              </LineChart>
            </ChartContainer>
          </div>
        </article>
      </div>
    </section>
  )
}

export default PerformanceOverview
