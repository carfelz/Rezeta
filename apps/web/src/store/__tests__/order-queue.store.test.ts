import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useOrderQueueStore } from '@/store/order-queue.store'

const medBase = {
  drug: 'Amoxicilina',
  dose: '500mg',
  route: 'oral',
  frequency: 'cada 8h',
  duration: '7 días',
}

const imagingBase = {
  study_type: 'RX Tórax',
  indication: 'Dolor torácico',
  urgency: 'routine' as const,
  contrast: false,
  fasting_required: false,
}

const labBase = {
  test_name: 'Hemograma',
  indication: 'Anemia',
  urgency: 'routine' as const,
  fasting_required: false,
  sample_type: 'blood' as const,
}

describe('useOrderQueueStore', () => {
  beforeEach(() => {
    const { result } = renderHook(() => useOrderQueueStore())
    act(() => result.current.reset())
  })

  // ── Tab ───────────────────────────────────────────────────────────────────────

  describe('setActiveTab', () => {
    it('switches active tab', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      act(() => result.current.setActiveTab('imaging'))
      expect(result.current.activeTab).toBe('imaging')
    })
  })

  // ── Medications ───────────────────────────────────────────────────────────────

  describe('medications', () => {
    it('starts with one default medication group', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      expect(result.current.medicationGroups).toHaveLength(1)
    })

    it('addMedicationGroup adds a new group and returns its id', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      let id: string = ''
      act(() => { id = result.current.addMedicationGroup('Antibióticos') })
      expect(result.current.medicationGroups).toHaveLength(2)
      expect(result.current.medicationGroups[1]?.title).toBe('Antibióticos')
      expect(id).toBeTruthy()
    })

    it('addMedicationGroup uses auto title when none provided', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      act(() => result.current.addMedicationGroup())
      expect(result.current.medicationGroups[1]?.title).toBe('Receta 2')
    })

    it('queueMedication adds to first group by default', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      act(() => result.current.queueMedication(medBase))
      expect(result.current.medications).toHaveLength(1)
      expect(result.current.medications[0]?.drug).toBe('Amoxicilina')
    })

    it('queueMedication switches activeTab to medications', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      act(() => result.current.setActiveTab('imaging'))
      act(() => result.current.queueMedication(medBase))
      expect(result.current.activeTab).toBe('medications')
    })

    it('removeMedication removes by id', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      act(() => result.current.queueMedication(medBase))
      const id = result.current.medications[0]!.id
      act(() => result.current.removeMedication(id))
      expect(result.current.medications).toHaveLength(0)
    })

    it('updateMedication updates a field', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      act(() => result.current.queueMedication(medBase))
      const id = result.current.medications[0]!.id
      act(() => result.current.updateMedication(id, { dose: '1000mg' }))
      expect(result.current.medications[0]?.dose).toBe('1000mg')
    })

    it('removeMedicationGroup removes group and its medications', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      let groupId: string = ''
      act(() => { groupId = result.current.addMedicationGroup('Test Group') })
      act(() => result.current.queueMedication(medBase, groupId))
      act(() => result.current.removeMedicationGroup(groupId))
      expect(result.current.medicationGroups).toHaveLength(1)
      expect(result.current.medications).toHaveLength(0)
    })
  })

  // ── Imaging ───────────────────────────────────────────────────────────────────

  describe('imaging', () => {
    it('starts with one default imaging group', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      expect(result.current.imagingGroups).toHaveLength(1)
    })

    it('queueImagingOrder adds to default group', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      act(() => result.current.queueImagingOrder(imagingBase))
      expect(result.current.imagingOrders).toHaveLength(1)
    })

    it('queueImagingOrder switches activeTab to imaging', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      act(() => result.current.queueImagingOrder(imagingBase))
      expect(result.current.activeTab).toBe('imaging')
    })

    it('removeImagingOrder removes by id', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      act(() => result.current.queueImagingOrder(imagingBase))
      const id = result.current.imagingOrders[0]!.id
      act(() => result.current.removeImagingOrder(id))
      expect(result.current.imagingOrders).toHaveLength(0)
    })

    it('addImagingGroup auto-titles when no title given', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      act(() => result.current.addImagingGroup())
      expect(result.current.imagingGroups[1]?.title).toBe('Orden 2')
    })

    it('removeImagingGroup removes group and its orders', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      let groupId: string = ''
      act(() => { groupId = result.current.addImagingGroup('Urgentes') })
      act(() => result.current.queueImagingOrder(imagingBase, groupId))
      act(() => result.current.removeImagingGroup(groupId))
      expect(result.current.imagingGroups).toHaveLength(1)
      expect(result.current.imagingOrders).toHaveLength(0)
    })
  })

  // ── Labs ──────────────────────────────────────────────────────────────────────

  describe('labs', () => {
    it('starts with one default lab group', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      expect(result.current.labGroups).toHaveLength(1)
    })

    it('queueLabOrder adds order and switches to labs tab', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      act(() => result.current.queueLabOrder(labBase))
      expect(result.current.labOrders).toHaveLength(1)
      expect(result.current.activeTab).toBe('labs')
    })

    it('removeLabOrder removes by id', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      act(() => result.current.queueLabOrder(labBase))
      const id = result.current.labOrders[0]!.id
      act(() => result.current.removeLabOrder(id))
      expect(result.current.labOrders).toHaveLength(0)
    })

    it('addLabGroup auto-titles when no title given', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      act(() => result.current.addLabGroup())
      expect(result.current.labGroups[1]?.title).toBe('Laboratorio 2')
    })

    it('removeLabGroup removes group and its orders', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      let groupId: string = ''
      act(() => { groupId = result.current.addLabGroup('Urgentes') })
      act(() => result.current.queueLabOrder(labBase, groupId))
      act(() => result.current.removeLabGroup(groupId))
      expect(result.current.labGroups).toHaveLength(1)
      expect(result.current.labOrders).toHaveLength(0)
    })
  })

  // ── reset ─────────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('resets all state to initial values', () => {
      const { result } = renderHook(() => useOrderQueueStore())
      act(() => result.current.queueMedication(medBase))
      act(() => result.current.queueImagingOrder(imagingBase))
      act(() => result.current.queueLabOrder(labBase))
      act(() => result.current.reset())
      expect(result.current.medications).toHaveLength(0)
      expect(result.current.imagingOrders).toHaveLength(0)
      expect(result.current.labOrders).toHaveLength(0)
      expect(result.current.activeTab).toBe('medications')
    })
  })
})
