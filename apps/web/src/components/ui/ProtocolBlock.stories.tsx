import type { Meta, StoryObj } from '@storybook/react-vite'
import {
  ProtocolContainer, ProtocolBlock, ProtocolChecklist, ProtocolSteps,
  ProtocolDecision, ProtocolDosageTable, ProtocolAlert, AddBlockButton,
} from './ProtocolBlock'
import { Badge } from './Badge'

const meta: Meta = {
  title: 'UI/ProtocolBlock',
  parameters: { layout: 'padded' },
}

export default meta

export const SectionBlock: StoryObj = {
  render: () => (
    <div style={{ width: 640 }}>
      <ProtocolBlock type="Sección" title="Indicaciones" onEdit={() => {}} onDelete={() => {}}>
        <p style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-n-700)', lineHeight: 1.55 }}>
          Reacción alérgica aguda con compromiso respiratorio o cardiovascular. Signos incluyen urticaria, angioedema, estridor, sibilancias o hipotensión.
        </p>
      </ProtocolBlock>
    </div>
  ),
}

export const RequiredBlock: StoryObj = {
  render: () => (
    <div style={{ width: 640 }}>
      <ProtocolBlock type="Sección" title="Evaluación inicial" required onEdit={() => {}}>
        <p style={{ fontSize: 12, fontFamily: 'var(--font-sans)', color: 'var(--color-n-500)' }}>
          Este bloque es requerido y no puede eliminarse.
        </p>
      </ProtocolBlock>
    </div>
  ),
}

export const ChecklistBlock: StoryObj = {
  render: () => (
    <div style={{ width: 640 }}>
      <ProtocolBlock type="Lista" title="Encuesta primaria" onEdit={() => {}} onDelete={() => {}}>
        <ProtocolChecklist
          items={[
            { id: '1', text: 'Permeabilidad de vía aérea', critical: true },
            { id: '2', text: 'Esfuerzo y frecuencia respiratoria', critical: true },
            { id: '3', text: 'Circulación: pulso, PA', critical: true },
            { id: '4', text: 'Nivel de consciencia', critical: false },
            { id: '5', text: 'Temperatura y perfusión cutánea', critical: false, done: true },
          ]}
        />
      </ProtocolBlock>
    </div>
  ),
}

export const StepsBlock: StoryObj = {
  render: () => (
    <div style={{ width: 640 }}>
      <ProtocolBlock type="Pasos" title="Cuidados de soporte" onEdit={() => {}} onDelete={() => {}}>
        <ProtocolSteps
          steps={[
            { id: '1', order: 1, title: 'Establecer acceso IV', detail: 'Calibre grande preferido' },
            { id: '2', order: 2, title: 'Oxígeno de alto flujo', detail: '15L mascarilla de no reinhalación' },
            { id: '3', order: 3, title: 'Monitoreo continuo', detail: 'Monitor cardíaco, pulsioxímetro, PA cada 5 min' },
          ]}
        />
      </ProtocolBlock>
    </div>
  ),
}

export const DecisionBlock: StoryObj = {
  render: () => (
    <div style={{ width: 640 }}>
      <ProtocolBlock type="Decisión" title="Criterios de escalada" onEdit={() => {}} onDelete={() => {}}>
        <ProtocolDecision
          condition="¿Responde a epinefrina inicial y fluidos IV?"
          branches={[
            { id: 'yes', label: 'Sí', action: 'Continuar con monitoreo. Repetir epinefrina si recurrencia.' },
            { id: 'no', label: 'No', action: 'Activar código de emergencia. Considerar unidad de cuidados críticos. Segunda dosis de epinefrina IM.' },
          ]}
        />
      </ProtocolBlock>
    </div>
  ),
}

export const DosageTableBlock: StoryObj = {
  render: () => (
    <div style={{ width: 720 }}>
      <ProtocolBlock type="Tabla" title="Medicamentos de primera línea" required onEdit={() => {}}>
        <ProtocolDosageTable
          rows={[
            { id: '1', drug: 'Epinefrina', dose: '0.3 mg IM (0.3 mL 1:1000)', route: 'IM muslo lateral', frequency: 'Cada 5-15 min PRN', notes: 'Máx 3 dosis' },
            { id: '2', drug: 'Difenhidramina', dose: '25-50 mg', route: 'IV o IM', frequency: 'Una vez', notes: 'Solo adyuvante' },
            { id: '3', drug: 'Metilprednisolona', dose: '1-2 mg/kg', route: 'IV', frequency: 'Una vez', notes: 'Para prevenir bifásica' },
          ]}
        />
      </ProtocolBlock>
    </div>
  ),
}

export const AlertBlock: StoryObj = {
  render: () => (
    <div style={{ width: 640, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <ProtocolAlert severity="warning" title="Actuar rápido" content="La epinefrina debe administrarse dentro de los 5 minutos del inicio de síntomas para mejores resultados." />
      <ProtocolAlert severity="danger" title="Contraindicación absoluta" content="No administrar si el paciente tiene hipersensibilidad conocida a betaagonistas o enfermedad cardiovascular severa." />
      <ProtocolAlert severity="info" content="Documentar cada dosis administrada con hora y respuesta del paciente." />
      <ProtocolAlert severity="success" content="Protocolo validado por Sociedad Dominicana de Medicina de Emergencias, 2026." />
    </div>
  ),
}

export const FullProtocol: StoryObj = {
  render: () => (
    <div style={{ width: 720 }}>
      <ProtocolContainer
        kicker="Protocolo · Emergencia"
        title="Manejo de anafilaxia"
        meta="Actualizado 18 abr 2026 · v2.3"
        badge={<Badge variant="active">Activo</Badge>}
      >
        <ProtocolBlock type="Sección" title="Indicaciones" required onEdit={() => {}}>
          <p style={{ fontSize: 13, fontFamily: 'var(--font-sans)', color: 'var(--color-n-700)', lineHeight: 1.55 }}>
            Reacción alérgica aguda con compromiso respiratorio o cardiovascular. Signos incluyen urticaria, angioedema, estridor, sibilancias o hipotensión.
          </p>
        </ProtocolBlock>

        <ProtocolBlock type="Sección" title="Evaluación inicial" required onEdit={() => {}}>
          <ProtocolChecklist
            items={[
              { id: '1', text: 'Permeabilidad de vía aérea', critical: true },
              { id: '2', text: 'Esfuerzo y frecuencia respiratoria', critical: true },
              { id: '3', text: 'Circulación: pulso, PA', critical: true },
              { id: '4', text: 'Nivel de consciencia' },
            ]}
          />
        </ProtocolBlock>

        <ProtocolBlock type="Sección" title="Intervención" required onEdit={() => {}}>
          <ProtocolAlert severity="warning" title="Actuar rápido" content="Epinefrina dentro de los 5 minutos del inicio de síntomas." />
          <div style={{ marginTop: 16 }}>
            <ProtocolDosageTable
              rows={[
                { id: '1', drug: 'Epinefrina', dose: '0.3 mg IM', route: 'IM muslo lateral', frequency: 'Cada 5-15 min', notes: 'Máx 3 dosis' },
                { id: '2', drug: 'Difenhidramina', dose: '25-50 mg', route: 'IV o IM', frequency: 'Una vez', notes: 'Adyuvante' },
              ]}
            />
          </div>
          <div style={{ marginTop: 16 }}>
            <ProtocolSteps
              steps={[
                { id: '1', order: 1, title: 'Establecer acceso IV', detail: 'Calibre grande preferido' },
                { id: '2', order: 2, title: 'Oxígeno de alto flujo', detail: '15L mascarilla de no reinhalación' },
                { id: '3', order: 3, title: 'Monitoreo continuo', detail: 'Monitor cardíaco, pulsioxímetro, PA cada 5 min' },
              ]}
            />
          </div>
        </ProtocolBlock>

        <AddBlockButton />
      </ProtocolContainer>
    </div>
  ),
}

export const AddBlockButtonStory: StoryObj = {
  name: 'Add Block Button',
  render: () => (
    <div style={{ width: 480 }}>
      <AddBlockButton />
    </div>
  ),
}
