import { useCallback, useRef, useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { ConsultationWithDetails } from '@rezeta/shared'

// Local stub — SOAP update removed from shared in schema reset v2
type UpdateConsultationDto = Record<string, never>
import {
  EMPTY_LOCAL_VITALS,
  type LocalVitals,
} from '@/lib/consultation/vitals'
import type { SaveStatus } from '@/components/consultations/SaveBadge'

interface SoapState {
  chiefComplaint: string
  setChiefComplaint: (v: string) => void
  subjective: string
  setSubjective: (v: string) => void
  objective: string
  setObjective: (v: string) => void
  assessment: string
  setAssessment: (v: string) => void
  plan: string
  setPlan: (v: string) => void
  vitals: LocalVitals
  setVitals: (v: LocalVitals) => void
  diagnoses: string[]
  setDiagnoses: (d: string[]) => void
  saveStatus: SaveStatus
  savedAt: Date | undefined
  saveNow: () => void
}

/**
 * SOAP form state. In schema-reset v2 SOAP fields were removed from the
 * Consultation DB model — the update mutation is a no-op. This hook keeps
 * local UI state for the SOAP view while the protocol canvas is the primary
 * editing surface.
 */
export function useSoapState(
  _consultation: ConsultationWithDetails | undefined,
  _updateMutation: UseMutationResult<ConsultationWithDetails, Error, UpdateConsultationDto>,
): SoapState {
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [subjective, setSubjective] = useState('')
  const [objective, setObjective] = useState('')
  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')
  const [vitals, setVitals] = useState<LocalVitals>(EMPTY_LOCAL_VITALS)
  const [diagnoses, setDiagnoses] = useState<string[]>([])
  const [saveStatus] = useState<SaveStatus>('idle')
  const [savedAt] = useState<Date | undefined>(undefined)
  const noop = useRef(() => {})

  const saveNow = useCallback(() => {
    noop.current()
  }, [])

  return {
    chiefComplaint,
    setChiefComplaint,
    subjective,
    setSubjective,
    objective,
    setObjective,
    assessment,
    setAssessment,
    plan,
    setPlan,
    vitals,
    setVitals,
    diagnoses,
    setDiagnoses,
    saveStatus,
    savedAt,
    saveNow,
  }
}
