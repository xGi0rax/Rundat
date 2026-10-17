// Gestisce status panel.
function StatusPanel({ type, message, onRetry }) {
  if (type === 'loading') {
    return (
      <section className="status-panel" aria-live="polite" aria-busy="true">
        <span className="spinner" aria-hidden="true" />
        <h1>Sto preparando le tue corse</h1>
        <p>Calcolo distanze, passo e andamento delle prestazioni.</p>
      </section>
    )
  }

  if (type === 'error') {
    return (
      <section className="status-panel" role="alert">
        <span className="status-icon" aria-hidden="true">!</span>
        <h1>Dati non disponibili</h1>
        <p>{message}</p>
        <button type="button" className="primary-button" onClick={onRetry}>Riprova</button>
      </section>
    )
  }

  return (
    <section className="status-panel">
      <span className="status-icon" aria-hidden="true">0</span>
      <h1>Nessuna attività trovata</h1>
      <p>Quando saranno disponibili delle corse, appariranno qui.</p>
    </section>
  )
}

export default StatusPanel
