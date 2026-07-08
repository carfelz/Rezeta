export const patientDetailStrings = {
  // ── PageHeader ──────────────────────────────────────────────────────────────
  breadcrumbPatients: 'Pacientes',
  editButton: 'Editar',
  noDocument: 'Sin documento',
  newConsultation: 'Nueva consulta',

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
  documentTypeRnc: 'RNC',
  fieldDocumentNumber: 'Número de documento',
  fieldDocumentNumberPlaceholder: 'Ej. 001-1234567-8',
  fieldPhoneLabel: 'Teléfono',
  fieldPhonePlaceholder: 'Ej. 809-555-0000',
  fieldEmailLabel: 'Correo electrónico',
  fieldEmailPlaceholder: 'Ej. ana@email.com',
  fieldNotesLabel: 'Notas',
  fieldNotesPlaceholder: 'Observaciones iniciales...',
  allergiesLabel: 'Alergias',
  chronicConditionsLabel: 'Condiciones crónicas',
  tagInputPlaceholder: 'Escribir y presionar Enter…',
  tagRemoveAria: (tag: string): string => `Quitar ${tag}`,
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

  // ── HistoriaTab / RecordDocument ────────────────────────────────────────────
  historiaListTitle: 'Expediente',
  historiaChipDraft: 'Borrador',
  historiaChipSigned: 'Firmada',
  historiaChipNone: 'Sin historia',
  historiaGenerate: 'Generar historia',
  historiaDraftBar: 'Borrador — editable hasta la firma',
  historiaEdit: 'Editar',
  historiaSave: 'Guardar cambios',
  historiaCancelEdit: 'Cancelar',
  historiaRegenerate: 'Regenerar',
  historiaRegenerateConfirm:
    'Regenerar descarta las ediciones y vuelve a derivar la historia del protocolo. ¿Continuar?',
  historiaRegenerateAmended:
    'Esta consulta tiene una enmienda registrada. Regenerar creará una nueva versión firmada de la historia. ¿Continuar?',
  historiaSign: 'Firmar historia',
  historiaSignedBar: 'Historia firmada — solo lectura',
  historiaDownload: 'Descargar PDF',
  historiaEditedFlag: 'Editado',
  historiaKindFirstVisit: 'Primera consulta',
  historiaKindEvolution: 'Evolución',
  historiaEmpty: 'Selecciona una consulta para ver su historia médica.',
  historiaOnlySigned: 'La historia se genera al firmar la consulta.',
  historiaExport: 'Exportar expediente',

  // ── Shared ──────────────────────────────────────────────────────────────────
  loadError: 'No se pudo cargar la información. Intenta de nuevo.',
} as const
