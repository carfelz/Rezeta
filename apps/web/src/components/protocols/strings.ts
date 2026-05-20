export const blockTypeStrings = {
  section: 'Sección',
  text: 'Texto',
  checklist: 'Lista',
  steps: 'Pasos',
  decision: 'Decisión',
  dosageTable: 'Dosificación',
  alert: 'Alerta',
  imagingOrder: 'Imagen',
  labOrder: 'Laboratorio',
  unknown: 'Bloque',
} as const

export const blockEditorStrings = {
  // ── Shared block controls ──────────────────────────────────────────────────
  blockEdit: 'Editar bloque',
  blockCtxEdit: 'Editar',
  blockCtxMoreActions: 'Más acciones',
  blockCtxMoveUp: 'Mover arriba',
  blockCtxMoveDown: 'Mover abajo',
  blockCtxDuplicate: 'Duplicar',
  blockCtxDelete: 'Eliminar',
  blockDelete: 'Eliminar bloque',
  blockDeleteRequiredTooltip: 'Este bloque es requerido y no puede eliminarse.',
  blockDeleteConfirm: '¿Eliminar este bloque? Esta acción no se puede deshacer.',
  blockRequiredLabel: 'REQUERIDO',
  blockApply: 'Aplicar',
  blockCancel: 'Cancelar',
  blockEmptyText: '(texto vacío)',

  // ── Section ────────────────────────────────────────────────────────────────
  sectionEmpty: 'Sección sin bloques.',
  sectionDefaultTitle: 'Nueva sección',
  sectionTitlePlaceholder: 'Título de la sección…',
  sectionClickToRename: 'Clic para renombrar',
  sectionRename: 'Renombrar sección',
  sectionDelete: 'Eliminar sección',
  sectionDeleteConfirm: (childCount: number) =>
    childCount > 0
      ? `¿Eliminar esta sección y sus ${childCount} bloque${childCount === 1 ? '' : 's'}? Esta acción no se puede deshacer.`
      : '¿Eliminar esta sección? Esta acción no se puede deshacer.',
  sectionExpand: 'Expandir sección',
  sectionCollapse: 'Colapsar sección',
  sectionAddBlock: 'Añadir bloque',

  // ── Text block ────────────────────────────────────────────────────────────
  textPlaceholder: 'Escribe el contenido de este bloque de texto…',

  // ── Alert block ───────────────────────────────────────────────────────────
  alertSeverityLabel: 'Severidad',
  alertSeverityInfo: 'Información',
  alertSeverityWarning: 'Advertencia',
  alertSeverityDanger: 'Peligro',
  alertSeveritySuccess: 'Éxito',
  alertTitleLabel: 'Título (opcional)',
  alertTitlePlaceholder: 'Ej. Contraindicaciones absolutas',
  alertContentLabel: 'Contenido',
  alertContentPlaceholder: 'Describe la advertencia o información importante…',

  // ── Checklist block ───────────────────────────────────────────────────────
  checklistTitleLabel: 'Título (opcional)',
  checklistTitlePlaceholder: 'Ej. Verificaciones previas',
  checklistItemsLabel: 'Ítems',
  checklistItemPlaceholder: 'Descripción del ítem…',
  checklistCriticalLabel: 'Crítico',
  checklistAddItem: '+ Añadir ítem',
  checklistRemoveItem: 'Eliminar ítem',

  // ── Steps block ───────────────────────────────────────────────────────────
  stepsTitleLabel: 'Título (opcional)',
  stepsTitlePlaceholder: 'Ej. Manejo de vía aérea',
  stepsItemsLabel: 'Pasos',
  stepsStepTitlePlaceholder: 'Nombre del paso…',
  stepsStepDetailPlaceholder: 'Detalle o instrucción adicional (opcional)',
  stepsAddStep: '+ Añadir paso',
  stepsRemoveStep: 'Eliminar paso',
  stepsMoveUp: 'Mover arriba',
  stepsMoveDown: 'Mover abajo',

  // ── Decision block ────────────────────────────────────────────────────────
  decisionConditionLabel: 'Condición o pregunta',
  decisionConditionPlaceholder: 'Ej. ¿Presión sistólica < 90 mmHg?',
  decisionBranchesLabel: 'Ramas de decisión',
  decisionBranchLabel: 'Rama',
  decisionBranchLabelPlaceholder: 'Ej. Sí / No / ≥38°C',
  decisionBranchActionPlaceholder: 'Qué hacer si se cumple esta condición…',
  decisionAddBranch: '+ Añadir rama',
  decisionRemoveBranch: 'Eliminar rama (mín. 2)',

  // ── Dosage table block ────────────────────────────────────────────────────
  dosageTitleLabel: 'Título (opcional)',
  dosageTitlePlaceholder: 'Ej. Medicamentos de primera línea',
  dosageRowsLabel: 'Filas',
  dosageAddRow: '+ Añadir fila',
  dosageRemoveRow: 'Eliminar fila',

  // ── Type picker modal (TemplatePickerModal) ───────────────────────────────
  typePickerTitle: 'Nuevo protocolo',
  typePickerSubtitle: '¿Qué tipo de protocolo vas a crear?',
  typePickerNameLabel: 'Nombre del protocolo',
  typePickerNamePlaceholder: 'Ej. Manejo de anafilaxia',
  typePickerSubmit: 'Crear protocolo',
  typePickerCancel: 'Cancelar',
  typePickerCreating: 'Creando...',
  typePickerNoTypes: 'No tienes tipos de protocolo activos.',
  typePickerNoTypesCta: 'Ir a Ajustes → Tipos',
} as const

export const createProtocolDialogStrings = {
  title: 'Crear nuevo protocolo',
  subtypePrefix: 'Tipo:',
  nameLabel: 'Nombre del protocolo',
  namePlaceholder: 'Ej. Mi Protocolo de Anafilaxia',
  cancelButton: 'Cancelar',
  creatingButton: 'Creando...',
  createButton: 'Crear protocolo',
} as const

export const blockRendererRunModeStrings = {
  sectionType: 'Sección',
  textType: 'Texto',
  checklistType: 'Lista',
  checklistDefaultTitle: 'Lista de verificación',
  stepsType: 'Pasos',
  stepsDefaultTitle: 'Pasos',
  decisionType: 'Decisión',
  decisionDefaultTitle: 'Decisión',
  dosageType: 'Medicación',
  dosageDefaultTitle: 'Medicamentos',
  alertType: 'Alerta',
  alertDefaultTitle: 'Alerta',
  imagingType: 'Imagen',
  imagingDefaultTitle: 'Estudios de imagen',
  labType: 'Laboratorio',
  labDefaultTitle: 'Estudios de laboratorio',
  completedStep: '✓ Completado',
  skippedStep: '⊘ Omitido',
  criticalItem: 'crítico',
  clearSelection: 'Limpiar selección',
  openLinkedProtocol: 'Abrir protocolo vinculado',
  addToOrders: '+ Añadir a órdenes',
  addToPrescription: '+ Añadir a receta',
  alreadyQueued: '✓ Añadido',
} as const

export const protocolPickerModalStrings = {
  title: 'Seleccionar protocolo',
  description: 'Elige un protocolo para aplicarlo en esta consulta.',
  searchPlaceholder: 'Buscar protocolo…',
  loading: 'Cargando protocolos…',
  noResults: 'No se encontraron protocolos.',
  cancelButton: 'Cancelar',
  applyingButton: 'Aplicando…',
  applyButton: 'Aplicar protocolo',
} as const

export const suggestionBannerStrings = {
  calloutTitle: 'Sugerencia de optimización',
  detectedIn: (count: number, total: number, pct: number) =>
    `Detectado en ${count}/${total} usos (${pct}%)`,
  applyingButton: 'Aplicando…',
  applyButton: 'Aplicar cambio',
  creatingButton: 'Creando…',
  createVariantButton: 'Crear variante',
  dismissButton: 'Ignorar',
} as const

export const imagingOrderEditorStrings = {
  titleLabel: 'Título (opcional)',
  titlePlaceholder: 'Ej. Estudios de imagen cardíaca',
  studiesLabel: 'Estudios',
  studyTypePlaceholder: 'Tipo de estudio (ej. Radiografía de tórax PA)',
  indicationPlaceholder: 'Indicación clínica',
  deleteStudyLabel: 'Eliminar',
  contrastLabel: 'Con contraste',
  fastingLabel: 'Requiere ayuno',
  addStudyButton: '+ Añadir estudio',
  urgencyRoutine: 'Rutina',
  urgencyUrgent: 'Urgente',
  urgencyStat: 'STAT',
} as const

export const labOrderEditorStrings = {
  titleLabel: 'Título (opcional)',
  titlePlaceholder: 'Ej. Perfil metabólico completo',
  testsLabel: 'Pruebas',
  testNamePlaceholder: 'Nombre de la prueba (ej. Hemograma completo)',
  indicationPlaceholder: 'Indicación clínica',
  deleteTestLabel: 'Eliminar',
  fastingLabel: 'Requiere ayuno',
  addTestButton: '+ Añadir prueba',
  sampleBlood: 'Sangre',
  sampleUrine: 'Orina',
  sampleStool: 'Heces',
  sampleOther: 'Otro',
  urgencyRoutine: 'Rutina',
  urgencyUrgent: 'Urgente',
  urgencyStat: 'STAT',
} as const
