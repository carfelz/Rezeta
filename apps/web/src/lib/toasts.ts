/**
 * Toast notification strings and Firebase error messages.
 *
 * Used by hooks that trigger toast.success / toast.error calls.
 * Import from here instead of the central strings module.
 */

export const toastStrings = {
  // ── Patients ────────────────────────────────────────────────────────────────
  patientCreated: 'Paciente registrado',
  patientUpdated: 'Datos del paciente actualizados',
  patientDeleted: 'Paciente eliminado',
  errorPatientCreate: 'No se pudo registrar el paciente.',
  errorPatientUpdate: 'No se pudo actualizar el paciente.',
  errorPatientDelete: 'No se pudo eliminar el paciente.',

  // ── Consultations ───────────────────────────────────────────────────────────
  consultationCreated: 'Consulta creada',
  consultationUpdated: 'Consulta actualizada',
  consultationSigned: 'Consulta firmada exitosamente',
  consultationDraftSaved: 'Borrador guardado',
  consultationDeleted: 'Consulta eliminada',
  amendmentCreated: 'Enmienda registrada',
  stepSkipped: 'Paso omitido',
  offProtocolNoteAdded: 'Nota agregada',
  errorConsultationCreate: 'No se pudo crear la consulta.',
  errorConsultationUpdate: 'No se pudo actualizar la consulta.',
  errorConsultationSign: 'No se pudo firmar la consulta.',
  errorConsultationDelete: 'No se pudo eliminar la consulta.',
  errorAmendmentCreate: 'No se pudo registrar la enmienda.',

  // ── Historia médica (record) ────────────────────────────────────────────────
  errorHistoriaSave: 'No se pudo guardar la historia médica.',
  errorHistoriaSign: 'No se pudo firmar la historia médica.',

  // ── Prescriptions & Orders ──────────────────────────────────────────────────
  prescriptionCreated: 'Receta generada',
  prescriptionUpdated: 'Receta actualizada',
  prescriptionDeleted: 'Receta eliminada',
  imagingOrderCreated: 'Orden de imagen creada',
  imagingOrderDeleted: 'Orden de imagen eliminada',
  labOrderCreated: 'Orden de laboratorio creada',
  labOrderDeleted: 'Orden de laboratorio eliminada',
  errorPrescriptionSave: 'No se pudo guardar la receta.',
  errorOrderSave: 'No se pudo guardar la orden.',

  // ── Invoices ────────────────────────────────────────────────────────────────
  invoiceCreated: 'Factura creada',
  invoiceUpdated: 'Factura actualizada',
  invoiceDeleted: 'Factura eliminada',
  invoiceStatusUpdated: 'Estado de factura actualizado',
  errorInvoiceCreate: 'No se pudo crear la factura.',
  errorInvoiceUpdate: 'No se pudo actualizar la factura.',
  errorInvoiceDelete: 'No se pudo eliminar la factura.',

  // ── Appointments ────────────────────────────────────────────────────────────
  appointmentCreated: 'Cita agendada',
  appointmentUpdated: 'Cita actualizada',
  appointmentDeleted: 'Cita cancelada',
  errorAppointmentCreate: 'No se pudo agendar la cita.',
  errorAppointmentUpdate: 'No se pudo actualizar la cita.',
  errorAppointmentDelete: 'No se pudo cancelar la cita.',

  // ── Locations ───────────────────────────────────────────────────────────────
  locationCreated: 'Ubicación agregada',
  locationUpdated: 'Ubicación actualizada',
  locationDeleted: 'Ubicación eliminada',
  errorLocationCreate: 'No se pudo agregar la ubicación.',
  errorLocationUpdate: 'No se pudo actualizar la ubicación.',
  errorLocationDelete: 'No se pudo eliminar la ubicación.',
  locationArchived: 'Ubicación archivada',
  errorLocationArchive: 'No se pudo archivar la ubicación.',

  // ── Protocols ───────────────────────────────────────────────────────────────
  protocolCreated: 'Protocolo creado',
  protocolUpdated: 'Protocolo actualizado',
  protocolDeleted: 'Protocolo eliminado',
  protocolArchived: 'Protocolo archivado',
  errorProtocolArchive: 'No se pudo archivar el protocolo.',
  protocolVersionPublished: 'Nueva versión publicada',
  protocolUsageAdded: 'Protocolo aplicado a la consulta',
  protocolUsageRemoved: 'Protocolo removido de la consulta',
  errorProtocolSave: 'No se pudo guardar el protocolo.',
  errorProtocolUsage: 'No se pudo actualizar el protocolo de la consulta.',

  // ── Protocol Types ──────────────────────────────────────────────────────────
  protocolTypeCreated: 'Tipo de protocolo creado',
  protocolTypeUpdated: 'Tipo actualizado',
  protocolTypeDeleted: 'Tipo eliminado',
  errorProtocolTypeSave: 'No se pudo guardar el tipo de protocolo.',

  // ── Protocol Categories ─────────────────────────────────────────────────────
  protocolCategoryCreated: 'Categoría creada',
  protocolCategoryUpdated: 'Categoría actualizada',
  protocolCategoryDeleted: 'Categoría eliminada',
  errorProtocolCategorySave: 'No se pudo guardar la categoría.',

  // ── Templates ───────────────────────────────────────────────────────────────
  templateCreated: 'Plantilla creada',
  templateUpdated: 'Plantilla actualizada',
  templateDeleted: 'Plantilla eliminada',
  errorTemplateSave: 'No se pudo guardar la plantilla.',

  // ── Schedules ───────────────────────────────────────────────────────────────
  scheduleUpdated: 'Horario actualizado',
  scheduleExceptionCreated: 'Excepción de horario creada',
  scheduleExceptionDeleted: 'Excepción eliminada',
  errorScheduleUpdate: 'No se pudo actualizar el horario.',

  // ── Onboarding ──────────────────────────────────────────────────────────────
  onboardingComplete: 'Configuración completada',
  errorOnboarding: 'No se pudo completar la configuración.',

  // ── AI Suggestions ──────────────────────────────────────────────────────────
  suggestionApplied: 'Sugerencia aplicada',
  suggestionVariantCreated: 'Variante creada',
  suggestionDismissed: 'Sugerencia descartada',

  // ── Session ─────────────────────────────────────────────────────────────────
  orderQueueRestored: 'Órdenes en cola restauradas de tu sesión anterior.',

  // ── Generic ─────────────────────────────────────────────────────────────────
  errorGeneric: 'Ocurrió un error. Intenta de nuevo.',
  errorNetwork: 'Error de conexión. Verifica tu red.',
} as const

/**
 * Map a Firebase error code to a human-readable Spanish message.
 */
export const firebaseErrorStrings = {
  emailAlreadyInUse: 'Ya existe una cuenta con este correo electrónico.',
  invalidEmail: 'El correo electrónico no es válido.',
  weakPassword: 'La contraseña es demasiado débil. Usa al menos 8 caracteres.',
  userNotFound: 'No existe una cuenta con este correo electrónico.',
  wrongPassword: 'Correo o contraseña incorrectos.',
  invalidCredential: 'Correo o contraseña incorrectos.',
  networkRequestFailed: 'Error de conexión. Verifica tu red e intenta de nuevo.',
  tooManyRequests:
    'Demasiados intentos. Tu cuenta ha sido temporalmente bloqueada. Intenta más tarde.',
  unknown: 'Ocurrió un error inesperado. Por favor intenta de nuevo.',
} as const

/**
 * Map a Firebase error code to a human-readable Spanish message.
 */
export function firebaseErrorToSpanish(code: string): string {
  const map: Record<string, string> = {
    'auth/email-already-in-use': firebaseErrorStrings.emailAlreadyInUse,
    'auth/invalid-email': firebaseErrorStrings.invalidEmail,
    'auth/weak-password': firebaseErrorStrings.weakPassword,
    'auth/user-not-found': firebaseErrorStrings.userNotFound,
    'auth/wrong-password': firebaseErrorStrings.wrongPassword,
    'auth/invalid-credential': firebaseErrorStrings.invalidCredential,
    'auth/network-request-failed': firebaseErrorStrings.networkRequestFailed,
    'auth/too-many-requests': firebaseErrorStrings.tooManyRequests,
  }
  return map[code] ?? firebaseErrorStrings.unknown
}
