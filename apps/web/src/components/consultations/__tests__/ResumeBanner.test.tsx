import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { ResumeBanner } from '../ResumeBanner'
import type { ConsultationProtocolUsage } from '@rezeta/shared'

const usage: ConsultationProtocolUsage = {
  id: 'usage-1',
  tenantId: 'tenant-1',
  consultationId: 'consult-1',
  protocolId: 'proto-1',
  protocolVersionId: 'ver-1',
  protocolTitle: 'HTA — Seguimiento',
  protocolTypeName: 'Cardiovascular',
  versionNumber: 1,
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
  content: { version: '1.0', blocks: [] },
}

function renderBanner(props: Partial<Parameters<typeof ResumeBanner>[0]> = {}): void {
  render(
    <ResumeBanner
      usage={usage}
      patientName="Isabel Cristina Cruz"
      patientAge={52}
      currentStep={{ number: 4, title: 'Examen físico' }}
      totalSteps={8}
      completedSteps={3}
      lastEditField="Examen físico"
      lastEditTime="09:55 a.m."
      elapsedMinutes={47}
      onResume={vi.fn()}
      onStartNew={vi.fn()}
      {...props}
    />,
  )
}

describe('ResumeBanner', () => {
  it('renders the overline label', () => {
    renderBanner()
    expect(screen.getByText('Consulta en progreso')).toBeInTheDocument()
  })

  it('renders the welcome heading', () => {
    renderBanner()
    expect(screen.getByText('Bienvenido de vuelta')).toBeInTheDocument()
  })

  it('renders patient name with age and elapsed time in body', () => {
    renderBanner()
    expect(screen.getByText(/Isabel Cristina Cruz a medias hace 47 minutos/)).toBeInTheDocument()
  })

  it('renders patient header inside inner card', () => {
    renderBanner()
    expect(screen.getByText('Isabel Cristina Cruz · 52 años')).toBeInTheDocument()
  })

  it('renders protocol step context', () => {
    renderBanner()
    expect(screen.getByText(/Protocolo HTA — Seguimiento · paso 4 de 8/)).toBeInTheDocument()
  })

  it('renders last-edit info', () => {
    renderBanner()
    expect(screen.getByText(/Última edición:/)).toBeInTheDocument()
    expect(screen.getByText('Examen físico')).toBeInTheDocument()
    expect(screen.getByText(/09:55 a\.m\. · auto-guardado/)).toBeInTheDocument()
  })

  it('renders continue button with step context', () => {
    renderBanner()
    expect(screen.getByText(/Continuar en paso 4 · Examen físico/)).toBeInTheDocument()
  })

  it('renders "Empezar nueva" button', () => {
    renderBanner()
    expect(screen.getByText('Empezar nueva')).toBeInTheDocument()
  })

  it('calls onResume when continue clicked', () => {
    const onResume = vi.fn()
    renderBanner({ onResume })
    fireEvent.click(screen.getByText(/Continuar en paso 4/))
    expect(onResume).toHaveBeenCalledTimes(1)
  })

  it('calls onStartNew when "Empezar nueva" clicked', () => {
    const onStartNew = vi.fn()
    renderBanner({ onStartNew })
    fireEvent.click(screen.getByText('Empezar nueva'))
    expect(onStartNew).toHaveBeenCalledTimes(1)
  })

  it('renders draft retention footer', () => {
    renderBanner()
    expect(screen.getByText('El borrador se conserva 7 días.')).toBeInTheDocument()
  })
})
