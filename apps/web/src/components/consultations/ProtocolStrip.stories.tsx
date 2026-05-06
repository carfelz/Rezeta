import type { Meta, StoryObj } from '@storybook/react-vite'
import { ProtocolStrip } from './ProtocolStrip'
import type { ConsultationProtocolUsage } from '@rezeta/shared'

const baseUsage: ConsultationProtocolUsage = {
  id: 'usage-1',
  tenantId: 'tenant-1',
  consultationId: 'consult-1',
  protocolId: 'protocol-1',
  protocolVersionId: 'version-1',
  protocolTitle: 'Seguimiento HTA — Control mensual',
  protocolTypeName: 'Diagnóstico',
  versionNumber: 2,
  status: 'in_progress',
  depth: 0,
  parentUsageId: null,
  triggerBlockId: null,
  completedAt: null,
  notes: null,
  appliedAt: new Date().toISOString(),
  modificationSummary: null,
  checkedState: {},
  modifications: {},
  content: {
    version: '1.0',
    blocks: [
      {
        id: 'sec_anamnesis',
        type: 'section',
        title: 'Anamnesis dirigida',
        blocks: [
          {
            id: 'chk_symptoms',
            type: 'checklist',
            title: 'Síntomas',
            items: [
              { id: 'itm_1', text: 'Cefalea' },
              { id: 'itm_2', text: 'Mareo' },
              { id: 'itm_3', text: 'Disnea de esfuerzo' },
            ],
          },
        ],
      },
      {
        id: 'sec_vitals',
        type: 'section',
        title: 'Signos vitales',
        blocks: [
          {
            id: 'stp_vitals',
            type: 'steps',
            title: 'Toma de PA',
            steps: [
              { id: 'stp_1', order: 1, title: 'Paciente sentado 5 min' },
              { id: 'stp_2', order: 2, title: 'Toma PA en brazo derecho' },
            ],
          },
        ],
      },
      {
        id: 'sec_exam',
        type: 'section',
        title: 'Examen físico',
        blocks: [
          {
            id: 'chk_exam',
            type: 'checklist',
            items: [
              { id: 'itm_4', text: 'Auscultación cardíaca' },
              { id: 'itm_5', text: 'Fondo de ojo' },
            ],
          },
        ],
      },
    ],
  },
}

const meta: Meta<typeof ProtocolStrip> = {
  title: 'Consultations/ProtocolStrip',
  component: ProtocolStrip,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof ProtocolStrip>

export const Single: Story = {
  args: {
    usage: baseUsage,
    isSigned: false,
    onChangePicker: () => {},
  },
}

export const WithProgress: Story = {
  args: {
    usage: {
      ...baseUsage,
      checkedState: {
        itm_1: true,
        itm_2: true,
        stp_1: true,
        stp_2: true,
      },
    },
    isSigned: false,
    onChangePicker: () => {},
  },
}

export const WithCompletedSteps: Story = {
  args: {
    usage: {
      ...baseUsage,
      checkedState: {
        itm_1: true,
        itm_2: true,
        itm_3: true,
        stp_1: true,
        stp_2: true,
        itm_4: true,
        itm_5: true,
      },
    },
    isSigned: false,
    onChangePicker: () => {},
  },
}

export const Signed: Story = {
  args: {
    usage: {
      ...baseUsage,
      checkedState: {
        itm_1: true,
        itm_2: true,
        stp_1: true,
      },
    },
    isSigned: true,
    onChangePicker: () => {},
  },
}
