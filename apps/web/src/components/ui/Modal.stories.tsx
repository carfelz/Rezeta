import type { Meta, StoryObj } from '@storybook/react-vite'
import { Archive, Trash, Warning, CheckCircle } from '@phosphor-icons/react'
import { Modal, ModalTrigger, ModalContent, ModalHeader, ModalBody, ModalFooter, ModalClose } from './Modal'
import { Button } from './Button'
import { Field } from './Input'
import { Input } from './Input'

const meta: Meta = {
  title: 'UI/Modal',
  parameters: { layout: 'centered' },
}

export default meta

export const DestructiveAction: StoryObj = {
  render: () => (
    <Modal>
      <ModalTrigger asChild>
        <Button variant="danger">Archivar paciente</Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader
          icon={<Archive size={18} />}
          iconVariant="danger"
          title="Archivar paciente"
          subtitle="El expediente quedará en solo lectura."
        />
        <ModalBody>
          <p className="text-[13px] font-sans text-n-700 leading-relaxed">
            ¿Estás seguro de que deseas archivar a <strong>Ana María Reyes</strong>? El expediente quedará disponible pero no podrá ser modificado. Esta acción puede revertirse.
          </p>
        </ModalBody>
        <ModalFooter>
          <ModalClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </ModalClose>
          <Button variant="danger">Archivar paciente</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  ),
}

export const DeleteAction: StoryObj = {
  render: () => (
    <Modal>
      <ModalTrigger asChild>
        <Button variant="danger"><Trash /> Eliminar protocolo</Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader
          icon={<Trash size={18} />}
          iconVariant="danger"
          title="Eliminar protocolo"
          subtitle="Esta acción no puede deshacerse."
        />
        <ModalBody>
          <p className="text-[13px] font-sans text-n-700 leading-relaxed">
            Se eliminará permanentemente el protocolo <strong>"Manejo de anafilaxia"</strong>. No podrá recuperarse.
          </p>
        </ModalBody>
        <ModalFooter>
          <ModalClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </ModalClose>
          <Button variant="danger">Eliminar</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  ),
}

export const FormModal: StoryObj = {
  render: () => (
    <Modal>
      <ModalTrigger asChild>
        <Button variant="primary">Nueva ubicación</Button>
      </ModalTrigger>
      <ModalContent size="lg">
        <ModalHeader
          title="Nueva ubicación"
          subtitle="Agrega un centro médico donde consultas."
        />
        <ModalBody>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Nombre del centro" required>
              <Input placeholder="Ej. Hospital General Plaza de la Salud" />
            </Field>
            <Field label="Dirección">
              <Input placeholder="Ej. Av. Ortega y Gasset, Santo Domingo" />
            </Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Teléfono">
                <Input placeholder="(809) 000-0000" type="tel" />
              </Field>
              <Field label="Días de consulta">
                <Input placeholder="Ej. Lun, Mié, Vie" />
              </Field>
            </div>
          </div>
        </ModalBody>
        <ModalFooter>
          <ModalClose asChild>
            <Button variant="secondary">Cancelar</Button>
          </ModalClose>
          <Button variant="primary">Guardar ubicación</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  ),
}

export const SuccessModal: StoryObj = {
  render: () => (
    <Modal>
      <ModalTrigger asChild>
        <Button variant="secondary">Ver confirmación</Button>
      </ModalTrigger>
      <ModalContent>
        <ModalHeader
          icon={<CheckCircle size={18} />}
          iconVariant="success"
          title="Pago recibido"
          subtitle="La transacción fue procesada correctamente."
          showClose={false}
        />
        <ModalBody>
          <p className="text-[13px] font-sans text-n-700 leading-relaxed">
            RD$ 3,450.00 acreditados a la cuenta de Ana María Reyes. Factura F-2026-01142 marcada como pagada.
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="primary">Entendido</Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  ),
}
