import { useCallback, useEffect, useRef, useState } from 'react'
import type { UseMutationResult } from '@tanstack/react-query'
import type { ConsultationWithDetails, UpdateConsultationDto } from '@rezeta/shared'
import {
  EMPTY_LOCAL_VITALS,
  localToVitals,
  vitalsToLocal,
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
 * SOAP form state, hydration from server data, and debounced autosave.
 * Watches every SOAP-related state value for changes and triggers an
 * autosave 1.5s after the last keystroke.
 */
export function useSoapState(
  consultation: ConsultationWithDetails | undefined,
  updateMutation: UseMutationResult<ConsultationWithDetails, Error, UpdateConsultationDto>,
): SoapState {
  const [chiefComplaint, setChiefComplaint] = useState('')
  const [subjective, setSubjective] = useState('')
  const [objective, setObjective] = useState('')
  const [assessment, setAssessment] = useState('')
  const [plan, setPlan] = useState('')
  const [vitals, setVitals] = useState<LocalVitals>(EMPTY_LOCAL_VITALS)
  const [diagnoses, setDiagnoses] = useState<string[]>([])
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [savedAt, setSavedAt] = useState<Date | undefined>(undefined)

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (consultation && !initialized.current) {
      initialized.current = true
      setChiefComplaint(consultation.chiefComplaint ?? '')
      setSubjective(consultation.subjective ?? '')
      setObjective(consultation.objective ?? '')
      setAssessment(consultation.assessment ?? '')
      setPlan(consultation.plan ?? '')
      setVitals(vitalsToLocal(consultation.vitals))
      setDiagnoses(consultation.diagnoses ?? [])
    }
  }, [consultation])

  const buildPayload = useCallback(
    () => ({
      chiefComplaint: chiefComplaint || null,
      subjective: subjective || null,
      objective: objective || null,
      assessment: assessment || null,
      plan: plan || null,
      vitals: localToVitals(vitals),
      diagnoses,
    }),
    [chiefComplaint, subjective, objective, assessment, plan, vitals, diagnoses],
  )

  const triggerAutoSave = useCallback(() => {
    if (!consultation || consultation.status === 'signed') return
    setSaveStatus('dirty')
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      setSaveStatus('saving')
      updateMutation.mutate(buildPayload(), {
        onSuccess: () => {
          const now = new Date()
          setSavedAt(now)
          setSaveStatus('saved')
          setTimeout(() => setSaveStatus('idle'), 2500)
        },
        onError: () => setSaveStatus('error'),
      })
    }, 1500)
  }, [consultation, buildPayload, updateMutation])

  function saveNow(): void {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveStatus('saving')
    updateMutation.mutate(buildPayload(), {
      onSuccess: () => {
        const now = new Date()
        setSavedAt(now)
        setSaveStatus('saved')
        setTimeout(() => setSaveStatus('idle'), 2500)
      },
      onError: () => setSaveStatus('error'),
    })
  }

  const skipFirst = useRef(true)
  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false
      return
    }
    if (initialized.current) triggerAutoSave()
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [chiefComplaint, subjective, objective, assessment, plan, vitals, diagnoses, triggerAutoSave])

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
