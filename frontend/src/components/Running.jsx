import { useState } from 'react'
import Analytics from './Analytics.jsx'
import Trends from './Trends.jsx'

const runningOptions = [
  { value: 'analytics', label: 'Analisi' },
  { value: 'trends', label: 'Trend' },
]

function initialSection() {
  return window.location.hash === '#trends' || window.location.hash === '#corsa/trend'
    ? 'trends'
    : 'analytics'
}

function Running({ activities, allActivities, racePredictions }) {
  const [section, setSection] = useState(initialSection)

  const selectSection = (nextSection) => {
    setSection(nextSection)
    window.history.replaceState(null, '', `#corsa/${nextSection === 'trends' ? 'trend' : 'analisi'}`)
  }

  return (
    <div className="sports-page">
      <section className="sport-switcher" aria-label="Seleziona la vista della corsa">
        <div className="sport-switcher-copy">
          <span>Corsa</span>
          <strong>Scegli quali dati visualizzare</strong>
        </div>
        <div className="sport-switcher-options" role="group" aria-label="Vista della corsa">
          {runningOptions.map((option) => {
            const isActive = section === option.value

            return (
              <button
                key={option.value}
                type="button"
                className={isActive ? 'sport-switcher-button active' : 'sport-switcher-button'}
                aria-pressed={isActive}
                onClick={() => selectSection(option.value)}
              >
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      {section === 'trends' ? (
        <Trends
          activities={activities}
          allActivities={allActivities}
          racePredictions={racePredictions}
        />
      ) : (
        <Analytics activities={activities} />
      )}
    </div>
  )
}

export default Running
