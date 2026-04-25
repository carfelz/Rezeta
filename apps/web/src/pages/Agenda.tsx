import { Button, EmptyState } from '@/components/ui'

export function Agenda(): JSX.Element {
  return (
    <div>
      <div className="flex items-center mb-6 gap-4">
        <h1 className="text-h1 flex-1">Agenda</h1>
        <Button variant="primary">
          <i className="ph ph-plus mr-1.5" />
          Nueva cita
        </Button>
      </div>
      <EmptyState
        icon={<i className="ph ph-calendar-blank" />}
        title="No hay citas programadas"
        description="Agenda la primera cita del día para comenzar."
        action={<Button variant="primary">Nueva cita</Button>}
      />
    </div>
  )
}
