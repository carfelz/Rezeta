import { Button, EmptyState } from '@/components/ui'

export function Facturacion(): JSX.Element {
  return (
    <div>
      <div className="flex items-center mb-6 gap-4">
        <h1 className="text-h1 flex-1">Facturación</h1>
        <Button variant="primary">
          <i className="ph ph-plus mr-1.5" />
          Nueva factura
        </Button>
      </div>
      <EmptyState
        icon={<i className="ph ph-receipt" />}
        title="No hay facturas emitidas"
        description="Las facturas se generan automáticamente al firmar una consulta."
      />
    </div>
  )
}
