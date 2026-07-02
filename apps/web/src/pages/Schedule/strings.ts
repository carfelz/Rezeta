export const appointmentCardStrings = {
  startConsultation: 'Iniciar consulta',
  continueConsultation: 'Continuar consulta',
  viewConsultation: 'Ver consulta',
  complete: 'Completar',
  noShow: 'No asistió',
  edit: 'Editar',
  delete: 'Eliminar',
} as const

export const schedulePageStrings = {
  pageTitle: 'Agenda',
  newAppointmentButton: 'Nueva cita',
  selectLocationInfo: 'Selecciona una ubicación en la barra superior para ver las citas del día.',
  loading: 'Cargando citas...',
  loadError: 'No se pudieron cargar las citas. Intenta recargar la página.',
  emptyTitle: 'No hay citas para este día',
  emptyDescription: 'Agenda la primera cita del día para comenzar.',
} as const

export const deleteAppointmentModalStrings = {
  title: 'Eliminar cita',
  body: (patientName: string, date: string, time: string) =>
    `¿Eliminar la cita de ${patientName} el ${date} a las ${time}? Esta acción no se puede deshacer.`,
  cancelButton: 'Cancelar',
  deletingButton: 'Eliminando...',
  deleteButton: 'Eliminar cita',
} as const

export const appointmentFormModalStrings = {
  titleCreate: 'Nueva cita',
  titleEdit: 'Editar cita',
  patientLabel: 'Paciente',
  locationLabel: 'Ubicación',
  locationPlaceholder: 'Seleccionar ubicación',
  dateLabel: 'Fecha',
  datePlaceholder: 'Seleccionar fecha',
  startTimeLabel: 'Hora inicio',
  startTimePlaceholder: 'Seleccionar hora',
  endTimeLabel: 'Hora fin',
  endTimePlaceholder: 'Seleccionar hora',
  reasonLabel: 'Motivo de consulta',
  reasonPlaceholder: 'Ej. Revisión de rutina',
  notesLabel: 'Notas',
  notesPlaceholder: 'Información adicional...',
  timeOrderError: 'La hora de fin debe ser posterior a la hora de inicio.',
  conflictError: 'Este horario se solapa con otra cita. Elige un horario diferente.',
  updateError: 'No se pudo actualizar la cita. Intenta de nuevo.',
  createError: 'No se pudo crear la cita. Intenta de nuevo.',
  cancelButton: 'Cancelar',
  savingButton: 'Guardando...',
  saveButton: 'Guardar cambios',
  createButton: 'Crear cita',
} as const

export const patientComboboxStrings = {
  searchPlaceholder: 'Buscar paciente...',
  noResults: 'Sin resultados',
  typeToSearch: 'Escribe para buscar',
} as const

export const dateNavigationStrings = {
  prevDayLabel: 'Día anterior',
  nextDayLabel: 'Día siguiente',
  todayChip: 'Hoy',
  goTodayLink: 'Ir a hoy',
} as const
