/**
 * Doctor name formatting.
 *
 * `User.fullName` is stored with the honorific already prefixed (provisioning
 * + seed convention), so naïvely composing `Dr. ${user.fullName}` produces
 * "Dr. Dr. Carlos Feliz". This helper strips any leading honorific before
 * re-prefixing, so callers can compose without worrying about the source.
 *
 * Accepts either form ("Dr. María", "María", "Doctora María") and returns
 * a canonical "Dr. María".
 */
const HONORIFIC_RE = /^(Dr\.?|Dra\.?|Doctor|Doctora)\s+/i

export function formatDoctorName(fullName: string | null | undefined): string {
  if (!fullName?.trim()) return 'Doctor(a)'
  const stripped = fullName.replace(HONORIFIC_RE, '').trim()
  if (!stripped) return 'Doctor(a)'
  return `Dr. ${stripped}`
}
