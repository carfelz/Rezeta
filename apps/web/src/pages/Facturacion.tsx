export function Facturacion(): JSX.Element {
  return (
    <div>
      <div className="row" style={{ marginBottom: 'var(--space-6)', gap: 'var(--space-4)' }}>
        <h1 className="text-h1" style={{ flex: 1 }}>Facturación</h1>
        <button className="btn btn--primary">
          <i className="ph ph-plus" />
          Nueva factura
        </button>
      </div>
      <div className="empty-state">
        <div className="empty-state__icon">
          <i className="ph ph-receipt" />
        </div>
        <h3 className="empty-state__title">No hay facturas emitidas</h3>
        <p className="empty-state__description">
          Las facturas se generan automáticamente al firmar una consulta.
        </p>
      </div>
    </div>
  )
}
