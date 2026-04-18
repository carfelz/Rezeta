import type { Meta, StoryObj } from '@storybook/react-vite'
import { MagnifyingGlass, X, CurrencyDollar } from '@phosphor-icons/react'
import { Input, Textarea, InputGroup, InputAdorn, InputIcon, Field } from './Input'

const meta: Meta = {
  title: 'UI/Input',
  parameters: { layout: 'padded' },
}

export default meta

export const DefaultInput: StoryObj = {
  render: () => (
    <div style={{ width: 320 }}>
      <Input placeholder="Buscar paciente..." />
    </div>
  ),
}

export const InputStates: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 320 }}>
      <Input placeholder="Default" />
      <Input placeholder="Read-only" readOnly defaultValue="Dr. Juan García" />
      <Input placeholder="Disabled" disabled defaultValue="Deshabilitado" />
      <Input placeholder="Error state" error defaultValue="valor incorrecto" />
    </div>
  ),
}

export const FieldWithLabel: StoryObj = {
  render: () => (
    <div style={{ width: 320 }}>
      <Field label="Nombre del paciente" required helper="Ingresa nombre completo según cédula.">
        <Input placeholder="Ana María Reyes" />
      </Field>
    </div>
  ),
}

export const FieldWithError: StoryObj = {
  render: () => (
    <div style={{ width: 320 }}>
      <Field label="Correo electrónico" error="Este campo es requerido.">
        <Input placeholder="doctor@ejemplo.com" error />
      </Field>
    </div>
  ),
}

export const InputGroupCurrency: StoryObj = {
  render: () => (
    <div style={{ width: 320 }}>
      <Field label="Honorarios">
        <InputGroup>
          <InputAdorn side="left">RD$</InputAdorn>
          <Input placeholder="0.00" type="number" />
        </InputGroup>
      </Field>
    </div>
  ),
}

export const InputGroupSearch: StoryObj = {
  render: () => (
    <div style={{ width: 360 }}>
      <InputGroup>
        <InputIcon side="left">
          <MagnifyingGlass size={16} />
        </InputIcon>
        <Input placeholder="Buscar paciente..." />
        <InputIcon side="right" action>
          <X size={16} />
        </InputIcon>
      </InputGroup>
    </div>
  ),
}

export const InputGroupWithIcon: StoryObj = {
  render: () => (
    <div style={{ width: 320 }}>
      <Field label="Monto">
        <InputGroup>
          <InputIcon side="left">
            <CurrencyDollar size={16} />
          </InputIcon>
          <Input placeholder="0.00" type="number" />
          <InputAdorn side="right">USD</InputAdorn>
        </InputGroup>
      </Field>
    </div>
  ),
}

export const TextareaField: StoryObj = {
  render: () => (
    <div style={{ width: 480 }}>
      <Field label="Motivo de consulta">
        <Textarea placeholder="El paciente refiere..." rows={4} />
      </Field>
    </div>
  ),
}

export const CompleteForm: StoryObj = {
  render: () => (
    <div style={{ width: 480, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Nombre" required>
          <Input placeholder="Ana María" />
        </Field>
        <Field label="Apellido" required>
          <Input placeholder="Reyes" />
        </Field>
      </div>
      <Field label="Correo electrónico" required>
        <Input type="email" placeholder="paciente@ejemplo.com" />
      </Field>
      <Field label="Cédula">
        <InputGroup>
          <InputAdorn side="left">001-</InputAdorn>
          <Input placeholder="1234567-8" />
        </InputGroup>
      </Field>
      <Field label="Honorarios">
        <InputGroup>
          <InputAdorn side="left">RD$</InputAdorn>
          <Input placeholder="3,500.00" type="number" />
        </InputGroup>
      </Field>
      <Field label="Notas" helper="Máximo 500 caracteres.">
        <Textarea placeholder="Observaciones adicionales..." rows={3} />
      </Field>
    </div>
  ),
}
