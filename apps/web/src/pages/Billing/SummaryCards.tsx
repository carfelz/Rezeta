import type { InvoiceWithDetails } from '@rezeta/shared'

export function SummaryCards({ invoices }: { invoices: InvoiceWithDetails[] }): JSX.Element {
  const totals = invoices.reduce(
    (acc, inv) => {
      if (inv.status !== 'cancelled') {
        acc.gross += inv.total
        acc.net += inv.netToDoctor
      }
      return acc
    },
    { gross: 0, net: 0 },
  )

  const activeCount = invoices.filter((i) => i.status === 'draft' || i.status === 'issued').length

  return (
    <div className="grid grid-cols-3 gap-3 mb-5">
      <div className="border border-n-200 rounded-md bg-n-0 p-4">
        <div className="text-2xs font-mono uppercase tracking-label-wide text-n-400">
          Total facturado
        </div>
        <div className="text-h3 font-serif font-medium text-n-900 mt-1">
          RD$ {totals.gross.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
        </div>
      </div>
      <div className="border border-n-200 rounded-md bg-n-0 p-4">
        <div className="text-2xs font-mono uppercase tracking-label-wide text-n-400">
          Neto al médico
        </div>
        <div className="text-h3 font-serif font-medium text-n-900 mt-1">
          RD$ {totals.net.toLocaleString('es-DO', { minimumFractionDigits: 2 })}
        </div>
      </div>
      <div className="border border-n-200 rounded-md bg-n-0 p-4">
        <div className="text-2xs font-mono uppercase tracking-label-wide text-n-400">
          Facturas activas
        </div>
        <div className="text-h3 font-serif font-medium text-n-900 mt-1">{activeCount}</div>
      </div>
    </div>
  )
}
