export function Agenda() {
  return (
    <div>
      <div className="row" style={{ marginBottom: 'var(--space-6)', gap: 'var(--space-4)' }}>
        <h1 className="text-h1" style={{ flex: 1 }}>Agenda</h1>
        <button className="btn btn--primary">
          <i className="ph ph-plus" />
          Nueva cita
        </button>
      </div>
      <div className="empty-state">
        <div className="empty-state__icon">
          <i className="ph ph-calendar-blank" />
        </div>
        <h3 className="empty-state__title">No hay citas programadas</h3>
        <p className="empty-state__description">
          Agenda la primera cita del día para comenzar.
        </p>
        <button className="btn btn--primary">Nueva cita</button>
      </div>
    </div>
  )
}
