export function Protocolos(): JSX.Element {
  return (
    <div>
      <div className="row" style={{ marginBottom: 'var(--space-6)', gap: 'var(--space-4)' }}>
        <h1 className="text-h1" style={{ flex: 1 }}>Protocolos</h1>
        <button className="btn btn--primary">
          <i className="ph ph-plus" />
          Nuevo protocolo
        </button>
      </div>
      <div className="empty-state">
        <div className="empty-state__icon">
          <i className="ph ph-stack" />
        </div>
        <h3 className="empty-state__title">Tu biblioteca de protocolos</h3>
        <p className="empty-state__description">
          Crea protocolos clínicos a partir de plantillas predefinidas o empieza desde cero.
        </p>
        <button className="btn btn--primary">Nuevo protocolo</button>
      </div>
    </div>
  )
}
