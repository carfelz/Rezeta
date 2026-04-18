export function Dashboard() {
  return (
    <div>
      <h1 className="text-h1" style={{ marginBottom: 'var(--space-6)' }}>
        Dashboard
      </h1>
      <div className="empty-state">
        <div className="empty-state__icon">
          <i className="ph ph-squares-four" />
        </div>
        <h3 className="empty-state__title">Panel en construcción</h3>
        <p className="empty-state__description">
          El resumen de actividad del día aparecerá aquí.
        </p>
      </div>
    </div>
  )
}
