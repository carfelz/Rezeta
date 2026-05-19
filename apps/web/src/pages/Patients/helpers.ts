export function formatAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return '—'
  const years = Math.floor(
    (Date.now() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25),
  )
  return `${years} años`
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-DO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export const SEX_LABELS: Record<string, string> = {
  male: 'Masculino',
  female: 'Femenino',
  other: 'Otro',
}

export const DOC_LABELS: Record<string, string> = {
  cedula: 'Cédula',
  passport: 'Pasaporte',
  rnc: 'RNC',
}

/**
 * Returns the canonical document type for a patient. If the patient row has
 * a stored documentType we trust it; otherwise infer from the document number
 * shape (DR conventions: cédula 11 digits with hyphenated layout, RNC starts
 * with the digit 4, passport starts with a letter).
 */
export function resolveDocumentType(
  documentType: string | null | undefined,
  documentNumber: string | null | undefined,
): 'cedula' | 'passport' | 'rnc' | null {
  if (documentType === 'cedula' || documentType === 'passport' || documentType === 'rnc') {
    return documentType
  }
  if (!documentNumber) return null
  const trimmed = documentNumber.trim()
  if (/^[A-Za-z]/.test(trimmed)) return 'passport'
  if (trimmed.startsWith('4')) return 'rnc'
  return 'cedula'
}

export const DOC_LABELS_UPPER: Record<'cedula' | 'passport' | 'rnc', string> = {
  cedula: 'CÉDULA',
  passport: 'PASAPORTE',
  rnc: 'RNC',
}
