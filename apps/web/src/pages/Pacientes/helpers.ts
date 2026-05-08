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
