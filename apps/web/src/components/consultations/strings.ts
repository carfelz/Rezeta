// ── OrderQueuePanel ────────────────────────────────────────────────────────────

export const orderQueueStrings = {
  panelTitle: 'Órdenes médicas',
  tabMedications: 'Medicamentos',
  tabImaging: 'Imagen',
  tabLabs: 'Laboratorio',

  savedChip: 'Guardada',
  generatedLabel: 'Generadas',
  queuedLabel: 'En cola',

  // Urgency
  urgencyRoutine: 'Rutina',
  urgencyUrgent: 'Urgente',
  urgencyStat: 'Stat',

  // Prescription
  deletePrescriptionLabel: 'Eliminar receta',
  downloadingPdf: 'Descargando…',
  downloadPdf: 'Descargar PDF',
  noMedications: 'Sin medicamentos.',
  noMedicationsInGroup: 'Sin medicamentos en este grupo.',
  noImageStudiesInGroup: 'Sin estudios en este grupo.',
  noLabStudiesInGroup: 'Sin estudios en este grupo.',
  noRxSigned: 'Sin recetas en esta consulta.',
  noImagingSigned: 'Sin órdenes de imagen en esta consulta.',
  noLabsSigned: 'Sin órdenes de laboratorio en esta consulta.',

  // Medication / imaging / lab group
  deleteGroupLabel: 'Eliminar grupo',
  prescriptionGroupFallback: (order: number) => `Receta ${order}`,
  imagingGroupFallback: (order: number) => `Orden ${order}`,
  labGroupFallback: (order: number) => `Laboratorio ${order}`,
  generatingPdf: 'Generando…',
  generatePrescription: 'Generar receta',
  generateImaging: 'Generar orden',
  generateLab: 'Generar laboratorio',
  removeMedicationLabel: 'Quitar medicamento',
  removeStudyLabel: 'Quitar estudio',
  deleteOrderLabel: 'Eliminar orden',
  withContrast: 'Con contraste',
  fastingRequired: 'En ayunas',

  // Add medication form
  addMedicationButton: 'Añadir medicamento',
  newMedicationTitle: 'Nuevo medicamento',
  drugPlaceholder: 'Medicamento *',
  dosePlaceholder: 'Dosis *',
  routePlaceholder: 'Vía *',
  frequencyPlaceholder: 'Frecuencia *',
  durationPlaceholder: 'Duración',
  notesPlaceholder: 'Notas (opcional)',
  prescriptionSelectPlaceholder: 'Receta…',
  cancelButton: 'Cancelar',
  addButton: 'Añadir',

  // Add imaging/lab buttons
  newImagingOrder: 'Nueva orden de imagen',
  newLabOrder: 'Nuevo laboratorio',
} as const

// ── AmendmentModal ──────────────────────────────────────────────────────────────

export const amendmentModalStrings = {
  title: 'Agregar enmienda',
  subtitle: 'Las enmiendas quedan registradas junto a la consulta original.',
  reasonLabel: 'Motivo de la enmienda',
  reasonPlaceholder: 'Describe la corrección…',
  notesLabel: 'Notas adicionales (opcional)',
  notesPlaceholder: 'Información corregida o aclarada…',
  errorMessage: 'No se pudo guardar la enmienda. Inténtalo de nuevo.',
  cancelButton: 'Cancelar',
  savingButton: 'Guardando…',
  saveButton: 'Guardar enmienda',
} as const

// ── SwitchProtocolDialog ────────────────────────────────────────────────────────

export const switchProtocolStrings = {
  overline: 'Cambio de protocolo',
  descriptionSelectBelow: 'Selecciona el nuevo protocolo abajo.',
  descriptionProgress: (completed: number, total: number) =>
    `Has completado ${completed} de ${total} pasos. Esto es lo que pasa con el progreso actual:`,
  descriptionNoTarget: (completed: number, total: number) =>
    `Has completado ${completed} de ${total} pasos. Selecciona el nuevo protocolo abajo.`,
  searchPlaceholder: 'Buscar protocolo…',
  noResults: 'Sin resultados.',
  noOtherProtocols: 'No hay otros protocolos activos.',
  keptTitle: 'Motivo, vitales, subjetivo',
  keptDetail: 'Se conservan — son compatibles',
  movedTitle: (step: number) => `Examen físico (paso ${step})`,
  movedDetail: 'Se mueve a "fuera de protocolo"',
  discardedTitle: 'Decisión, tratamiento, etc.',
  discardedDetail: 'Se descartan — no aplican',
  dialogTitle: (currentTitle: string, targetTitle: string) =>
    `Cambiar ${currentTitle} → ${targetTitle}`,
  dialogTitleNoTarget: (currentTitle: string) => `Cambiar ${currentTitle}`,
  keepDraftLabel: (protocolTitle: string) =>
    `Conservar borrador del protocolo ${protocolTitle} por 24h (puedes volver)`,
  errorMessage: 'No se pudo cambiar el protocolo. Inténtalo de nuevo.',
  cancelButton: 'Cancelar',
  switchingButton: 'Cambiando…',
  switchButton: 'Cambiar protocolo',
} as const

// ── SkipStepDialog ──────────────────────────────────────────────────────────────

export const skipStepStrings = {
  overline: 'Saltar paso',
  reasonNoCoop: 'Paciente no cooperaba',
  reasonNotRelevant: 'No clínicamente relevante hoy',
  reasonAlreadyDone: 'Paso ya documentado en visita reciente',
  reasonOther: 'Otro…',
  otherPlaceholder: 'Describe el motivo…',
  description:
    'Quedará registrado en la consulta. El protocolo seguirá marcado como completo parcialmente.',
  cancelButton: 'Cancelar',
  savingButton: 'Guardando…',
  skipButton: 'Saltar paso',
} as const

// ── DiagnosesSection ────────────────────────────────────────────────────────────

export const diagnosesSectionStrings = {
  addPlaceholder: 'Añadir diagnóstico…',
  addButton: 'Añadir',
  removeDiagnosisLabel: (name: string) => `Quitar ${name}`,
  emptyDash: '—',
} as const

// ── ConsultationSidebar ─────────────────────────────────────────────────────────

export const consultationSidebarStrings = {
  patientAlertsTitle: 'Alertas del paciente',
  allergyPrefix: 'Alergia',
  protocolsLabel: 'Protocolos',
  addProtocolButton: 'Agregar',
  noProtocolsSigned: 'Sin protocolos aplicados.',
  noProtocolsUnsigned: 'Agrega un protocolo para guiar esta consulta.',
  prevConsultationsTitle: 'Consultas previas',
  noChiefComplaint: 'Sin motivo',
} as const

// ── ResumeBanner ────────────────────────────────────────────────────────────────

export const resumeBannerStrings = {
  overline: 'Consulta en progreso',
  title: 'Bienvenido de vuelta',
  description: (patientName: string, relativeTime: string) =>
    `Dejaste una consulta de ${patientName} a medias ${relativeTime}. ¿Quieres continuar donde la dejaste?`,
  resumeButton: (stepNumber: number, stepTitle: string) =>
    `Continuar en paso ${stepNumber} · ${stepTitle}`,
  resumeButtonSimple: 'Continuar',
  startNewButton: 'Empezar nueva',
  draftRetentionNote: 'El borrador se conserva 7 días.',
  patientAge: (age: number) => ` · ${age} años`,
  protocolStep: (title: string, step: number, total: number | string) =>
    `Protocolo ${title} · paso ${step} de ${total}`,
  lastEditLabel: 'Última edición:',
  autoSaved: '· auto-guardado',
} as const

// ── OffProtocolNote ─────────────────────────────────────────────────────────────

export const offProtocolNoteStrings = {
  chipLabel: 'Fuera de protocolo',
  titlePlaceholder: 'Título del hallazgo (ej. Dolor torácico atípico)',
  bodyPlaceholder: 'Describe el hallazgo. Anexar a SOAP → [campo].',
  convertToStepButton: 'Convertir en paso',
  moveTo: (field: string) => `Mover a ${field}`,
  moveToSoap: 'Mover a SOAP',
  cancelButton: 'Cancelar',
  soapSubjective: 'Subjetivo',
  soapObjective: 'Examen físico',
  soapAssessment: 'Evaluación',
  soapPlan: 'Plan',
} as const

// ── VitalsSection ───────────────────────────────────────────────────────────────

export const vitalsSectionStrings = {
  emptyDash: '—',
  bloodPressureLabel: 'Presión arterial',
  heartRateLabel: 'Frec. cardíaca',
  temperatureLabel: 'Temperatura',
  spo2Label: 'Saturación O₂',
  weightLabel: 'Peso',
  heightLabel: 'Talla',
  bmiLabel: 'IMC · calculado',
  respiratoryRateLabel: 'Frec. respiratoria',
} as const

// ── MissingFieldsPanel ──────────────────────────────────────────────────────────

export const missingFieldsStrings = {
  // Callout variant
  calloutTitle: 'No puedes firmar todavía',
  calloutLink: (count: number) =>
    `Faltan ${count} campos requeridos por el protocolo. Saltar al primero ↓`,
  calloutShowList: 'Ver faltantes',

  // Panel variant
  panelTitle: (count: number) => `Faltantes (${count})`,
  panelClosePanelLabel: 'Cerrar panel',
  panelDescription: 'No puedes firmar hasta completarlos. Toca uno para ir directo.',
  panelGoArrow: 'Ir →',

  // Ready callout
  readyMessage: 'Listo · todos los campos requeridos están completos.',
  signButton: 'Firmar y cerrar',

  // Required badge
  requiredBadge: 'Requerido',

  // computeMissingFields labels
  chiefComplaintLabel: 'Motivo de consulta',
  assessmentLabel: 'Evaluación',
  assessmentDescription: 'Impresión diagnóstica o diagnóstico diferencial',
  diagnosesLabel: 'Diagnósticos',
  diagnosesDescription: 'Al menos un diagnóstico registrado',
} as const

// ── SignModal ───────────────────────────────────────────────────────────────────

export const signModalStrings = {
  title: 'Firmar consulta',
  subtitle: 'Al firmar, la consulta quedará bloqueada. Solo podrá editarse mediante enmiendas.',
  warningMessage:
    'Esta acción es irreversible. Verifica que todos los datos sean correctos antes de continuar.',
  cancelButton: 'Cancelar',
  signingButton: 'Firmando…',
  signButton: 'Firmar y cerrar',
} as const

// ── SoapView ────────────────────────────────────────────────────────────────────

export const soapViewStrings = {
  chiefComplaintTitle: 'Motivo de consulta',
  chiefComplaintPlaceholder: 'Seguimiento trimestral, motivo de consulta, síntomas principales…',
  vitalsTitle: 'Signos vitales',
  subjectiveTitle: 'Subjetivo',
  subjectivePlaceholder:
    'Historia del paciente, síntomas, antecedentes relevantes, contexto clínico…',
  objectiveTitle: 'Examen físico',
  objectivePlaceholder: 'Hallazgos del examen físico, signos clínicos, datos objetivos…',
  assessmentTitle: 'Evaluación',
  assessmentPlaceholder: 'Impresión diagnóstica, diagnóstico diferencial…',
  planTitle: 'Plan',
  planPlaceholder: 'Tratamiento, indicaciones, estudios solicitados, seguimiento…',
  diagnosesTitle: 'Diagnósticos',
} as const

// ── CanvasView ──────────────────────────────────────────────────────────────────

export const canvasViewStrings = {
  emptyProtocolOverline: 'Protocolo sin pasos',
  emptyProtocolHeading: 'Este protocolo todavía no tiene pasos.',
  emptyProtocolDescription:
    'Sus secciones existen pero aún no contienen bloques. Puedes editarlo ahora o seguir con la consulta en blanco.',
  continueWithoutProtocol: 'Continuar sin protocolo',
  editProtocol: 'Editar protocolo',
} as const

// ── Protocol chain breadcrumb ───────────────────────────────────────────────────

export const chainBreadcrumbStrings = {
  backButton: 'Atrás',
} as const

// ── RightRail ───────────────────────────────────────────────────────────────────

export const saveBadgeStrings = {
  unsaved: 'Sin guardar',
  saving: 'Guardando…',
  saved: 'Guardado',
  savedElapsedSecs: (s: number) => `hace ${s}s`,
  savedElapsedMins: (m: number) => `hace ${m} min`,
  error: 'Error al guardar',
  retry: 'Reintentar',
} as const

export const rightRailStrings = {
  alertsLabel: 'Alertas',
  protocolStepsLabel: 'Pasos del protocolo',
  ordersLabel: 'Órdenes',
  stepInProgress: 'en curso',
} as const
