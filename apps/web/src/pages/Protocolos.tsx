import { useState } from 'react'
import { CardItem, EmptyState, Button } from '@/components/ui'
import { useProtocolTemplates } from '@/hooks/protocol-templates/use-protocol-templates'
import { CreateProtocolDialog } from '@/components/protocols/CreateProtocolDialog'
import type { ProtocolTemplateDto } from '@rezeta/shared'

export function Protocolos(): JSX.Element {
  const { data: templates, isLoading, error } = useProtocolTemplates()
  const [selectedTemplate, setSelectedTemplate] = useState<ProtocolTemplateDto | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

  const handleSelectTemplate = (template: ProtocolTemplateDto) => {
    setSelectedTemplate(template)
    setIsCreateOpen(true)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-[28px] font-serif font-medium text-n-900 leading-tight">Protocolos</h1>
        <Button variant="primary">
          <i className="ph ph-plus" /> Nuevo protocolo
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-12">
          <i className="ph ph-spinner animate-spin text-[32px] text-n-400" />
        </div>
      ) : error ? (
        <EmptyState
          icon={<i className="ph ph-warning-circle text-danger-solid" />}
          title="Error al cargar protocolos"
          description="Ocurrió un problema al conectar con el servidor."
          action={<Button variant="secondary">Reintentar</Button>}
        />
      ) : templates?.length ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map(t => (
            <CardItem
              key={t.id}
              onClick={() => handleSelectTemplate(t as any)}
              leading={
                <div className="w-10 h-10 rounded bg-n-50 flex items-center justify-center text-n-600 text-lg">
                  <i className={`ph ph-${t.icon || 'stack'}`} />
                </div>
              }
              name={t.name}
              meta={t.description || t.category}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<i className="ph ph-stack" />}
          title="Tu biblioteca de protocolos"
          description="Crea protocolos clínicos a partir de plantillas predefinidas o empieza desde cero."
          action={<Button variant="primary">Nuevo protocolo</Button>}
        />
      )}
      <CreateProtocolDialog
        isOpen={isCreateOpen}
        template={selectedTemplate}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={(id) => {
          console.log('Protocol created:', id)
          // Future: Redirect to /[template]/edit/:id
        }}
      />
    </div>
  )
}
