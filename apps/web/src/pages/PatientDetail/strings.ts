export const patientDetailStrings = {
  // ── DemographicsBlock ───────────────────────────────────────────────────────
  sectionTitle: 'Datos personales',
  fieldDateOfBirth: 'Fecha de nacimiento',
  fieldSex: 'Sexo',
  fieldPhone: 'Teléfono',
  fieldEmail: 'Correo electrónico',
  fieldNotes: 'Notas',

  // ── EditModal ───────────────────────────────────────────────────────────────
  editModalTitle: 'Editar paciente',
  fieldFullName: 'Nombre completo',
  fieldFullNamePlaceholder: 'Ej. Ana María Reyes',
  fieldDateOfBirthLabel: 'Fecha de nacimiento',
  fieldSexLabel: 'Sexo',
  sexSelectPlaceholder: 'Seleccionar',
  sexFemale: 'Femenino',
  sexMale: 'Masculino',
  fieldDocumentType: 'Tipo de documento',
  documentTypeSelectPlaceholder: 'Seleccionar',
  documentTypeCedula: 'Cédula',
  documentTypePassport: 'Pasaporte',
  fieldDocumentNumber: 'Número de documento',
  fieldDocumentNumberPlaceholder: 'Ej. 001-1234567-8',
  fieldPhoneLabel: 'Teléfono',
  fieldPhonePlaceholder: 'Ej. 809-555-0000',
  fieldEmailLabel: 'Correo electrónico',
  fieldEmailPlaceholder: 'Ej. ana@email.com',
  fieldNotesLabel: 'Notas',
  fieldNotesPlaceholder: 'Observaciones iniciales...',
  cancelButton: 'Cancelar',
  savingButton: 'Guardando...',
  saveButton: 'Guardar cambios',
  errorMessage: 'No se pudo actualizar el paciente. Intenta de nuevo.',

  // ── Tabs ────────────────────────────────────────────────────────────────────
  tabHistory: 'Historia clínica',
  tabAppointments: 'Citas',
  tabPrescriptions: 'Recetas',
  tabInvoices: 'Facturas',

  // ── AppointmentsTab ─────────────────────────────────────────────────────────
  appointmentsEmpty: 'Sin citas registradas',
  startConsultation: 'Iniciar consulta',
  viewConsultation: 'Ver consulta',

  // ── PrescriptionsTab ────────────────────────────────────────────────────────
  prescriptionsEmpty: 'Sin recetas registradas',
  prescriptionStatusDraft: 'Borrador',
  prescriptionStatusSigned: 'Firmada',
  prescriptionItemsCount: (n: number): string =>
    n === 1 ? '1 medicamento' : `${n} medicamentos`,

  // ── InvoicesTab ─────────────────────────────────────────────────────────────
  invoicesEmpty: 'Sin facturas registradas',
  viewInvoice: 'Ver en facturación',

  // ── Shared ──────────────────────────────────────────────────────────────────
  loadError: 'No se pudo cargar la información. Intenta de nuevo.',
} as const
