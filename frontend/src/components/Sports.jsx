import Cycling from './Cycling.jsx'
import Dashboard from './Dashboard.jsx'

const sportOptions = [
  { value: 'running', label: 'Corsa' },
  { value: 'cycling', label: 'Bici' },
]

// Gestisce sports.
function Sports({
  sport,
  onSportChange,
  runningActivities,
  cyclingActivities,
}) {
  return (
    <div className="sports-page">
      <section className="sport-switcher" aria-label="Seleziona la disciplina">
        <div className="sport-switcher-copy">
          <span>Disciplina</span>
          <strong>Scegli quali dati visualizzare</strong>
        </div>
        <div className="sport-switcher-options" role="group" aria-label="Disciplina visualizzata">
          {sportOptions.map((option) => {
            const isActive = sport === option.value

            return (
              <button
                key={option.value}
                type="button"
                className={isActive ? 'sport-switcher-button active' : 'sport-switcher-button'}
                aria-pressed={isActive}
                onClick={() => onSportChange(option.value)}
              >
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>
      </section>

      {sport === 'cycling' ? (
        <Cycling activities={cyclingActivities} />
      ) : (
        <Dashboard activities={runningActivities} />
      )}
    </div>
  )
}

export default Sports
