/**
 * Central Spanish UI strings.
 *
 * All user-facing text in the application must be sourced from here.
 * Do NOT hardcode Spanish strings in components — import from this module.
 *
 * Naming convention: SCREEN_ELEMENT or DOMAIN_CONTEXT
 */

export const strings = {
  // ── Branding ───────────────────────────────────────────────────────────────
  APP_NAME: 'Rezeta',
  APP_TAGLINE: 'Un solo sistema, todos tus centros.',

  // ── Auth — General ─────────────────────────────────────────────────────────
  AUTH_SIGN_OUT: 'Cerrar sesión',
  AUTH_SIGNING_OUT: 'Cerrando sesión...',

  // ── Auth — Signup ──────────────────────────────────────────────────────────
  SIGNUP_TITLE: 'Crea tu cuenta',
  SIGNUP_SUBTITLE: 'Empieza a gestionar tu práctica médica',
  SIGNUP_FIELD_EMAIL: 'Correo electrónico',
  SIGNUP_FIELD_EMAIL_PLACEHOLDER: 'doctor@ejemplo.com',
  SIGNUP_FIELD_PASSWORD: 'Contraseña',
  SIGNUP_FIELD_PASSWORD_PLACEHOLDER: '••••••••',
  SIGNUP_FIELD_CONFIRM_PASSWORD: 'Confirmar contraseña',
  SIGNUP_FIELD_CONFIRM_PASSWORD_PLACEHOLDER: '••••••••',
  SIGNUP_SUBMIT: 'Crear cuenta',
  SIGNUP_SUBMITTING: 'Creando cuenta...',
  SIGNUP_HAVE_ACCOUNT: '¿Ya tienes cuenta?',
  SIGNUP_LOGIN_LINK: 'Inicia sesión',

  // ── Auth — Login ───────────────────────────────────────────────────────────
  LOGIN_TITLE: 'Bienvenido a Rezeta',
  LOGIN_SUBTITLE: 'Inicia sesión para continuar',
  LOGIN_FIELD_EMAIL: 'Correo electrónico',
  LOGIN_FIELD_EMAIL_PLACEHOLDER: 'doctor@ejemplo.com',
  LOGIN_FIELD_PASSWORD: 'Contraseña',
  LOGIN_FIELD_PASSWORD_PLACEHOLDER: '••••••••',
  LOGIN_SUBMIT: 'Iniciar sesión',
  LOGIN_SUBMITTING: 'Iniciando sesión...',
  LOGIN_NO_ACCOUNT: '¿No tienes cuenta?',
  LOGIN_SIGNUP_LINK: 'Regístrate',

  // ── Auth — Firebase error codes → Spanish messages ─────────────────────────
  FIREBASE_ERROR_EMAIL_ALREADY_IN_USE: 'Ya existe una cuenta con este correo electrónico.',
  FIREBASE_ERROR_INVALID_EMAIL: 'El correo electrónico no es válido.',
  FIREBASE_ERROR_WEAK_PASSWORD: 'La contraseña es demasiado débil. Usa al menos 8 caracteres.',
  FIREBASE_ERROR_USER_NOT_FOUND: 'No existe una cuenta con este correo electrónico.',
  FIREBASE_ERROR_WRONG_PASSWORD: 'Correo o contraseña incorrectos.',
  FIREBASE_ERROR_INVALID_CREDENTIAL: 'Correo o contraseña incorrectos.',
  FIREBASE_ERROR_NETWORK_REQUEST_FAILED: 'Error de conexión. Verifica tu red e intenta de nuevo.',
  FIREBASE_ERROR_TOO_MANY_REQUESTS:
    'Demasiados intentos. Tu cuenta ha sido temporalmente bloqueada. Intenta más tarde.',
  FIREBASE_ERROR_UNKNOWN: 'Ocurrió un error inesperado. Por favor intenta de nuevo.',

  // ── Dashboard ──────────────────────────────────────────────────────────────
  DASHBOARD_GREETING: (fullName: string | null) => {
    const hour = new Date().getHours()
    const salutation = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
    if (!fullName) return `${salutation}, Dr.`
    // Extract last name (last word), dropping leading "Dr." if present
    const parts = fullName
      .replace(/^Dr\.\s*/i, '')
      .trim()
      .split(' ')
    const lastName = parts[parts.length - 1] ?? parts[0] ?? fullName
    return `${salutation}, Dr. ${lastName}.`
  },
  DASHBOARD_UNDER_CONSTRUCTION: 'Panel en construcción',
  DASHBOARD_UNDER_CONSTRUCTION_DESCRIPTION: 'El resumen de actividad del día aparecerá aquí.',

  // ── Auth Gate ──────────────────────────────────────────────────────────────
  AUTH_GATE_LOADING: 'Cargando...',

  // ── Protocols — List ───────────────────────────────────────────────────────
  PROTOCOLS_PAGE_TITLE: 'Protocolos',
  PROTOCOLS_NEW_BUTTON: 'Nuevo protocolo',
  PROTOCOLS_EMPTY_TITLE: 'Sin protocolos todavía',
  PROTOCOLS_EMPTY_DESCRIPTION: 'Crea tu primer protocolo a partir de una plantilla o desde cero.',
  PROTOCOLS_EMPTY_CTA: 'Nuevo protocolo',
  PROTOCOLS_LIST_UPDATED: 'Actualizado',
  PROTOCOLS_LIST_VERSION: (n: number) => `v${n}`,
  PROTOCOLS_LOADING: 'Cargando protocolos...',
  PROTOCOLS_ERROR: 'No se pudo cargar los protocolos.',

  // ── Protocols — Type Picker ───────────────────────────────────────────────
  TYPE_PICKER_TITLE: 'Nuevo protocolo',
  TYPE_PICKER_SUBTITLE: '¿Qué tipo de protocolo vas a crear?',
  TYPE_PICKER_NAME_LABEL: 'Nombre del protocolo',
  TYPE_PICKER_NAME_PLACEHOLDER: 'Ej. Manejo de anafilaxia',
  TYPE_PICKER_SUBMIT: 'Crear protocolo',
  TYPE_PICKER_CANCEL: 'Cancelar',
  TYPE_PICKER_CREATING: 'Creando...',
  TYPE_PICKER_NO_TYPES: 'No tienes tipos de protocolo activos.',
  TYPE_PICKER_NO_TYPES_CTA: 'Ir a Ajustes → Tipos',

  // ── Protocols — Editor ─────────────────────────────────────────────────────
  EDITOR_SAVE_BUTTON: 'Guardar versión',
  EDITOR_UNSAVED: 'Cambios sin guardar',
  EDITOR_SAVING: 'Guardando...',
  EDITOR_PALETTE_TITLE: 'Bloques',
  EDITOR_PALETTE_COMING_SOON: 'Disponible próximamente',
  EDITOR_PREVIEW_TITLE: 'Vista previa',
  EDITOR_SAVE_MODAL_TITLE: 'Guardar versión',
  EDITOR_SAVE_MODAL_SUBTITLE: 'Añade un resumen del cambio (opcional).',
  EDITOR_SAVE_MODAL_LABEL: 'Resumen del cambio',
  EDITOR_SAVE_MODAL_PLACEHOLDER: 'Ej. Actualicé las dosis de primera línea',
  EDITOR_SAVE_MODAL_CONFIRM: 'Guardar versión',
  EDITOR_SAVE_MODAL_CANCEL: 'Cancelar',
  EDITOR_BACK: 'Protocolos',
  EDITOR_VERSION: (n: number) => `v${n}`,
  EDITOR_STATUS_DRAFT: 'Borrador',

  // ── Protocols — Editor block controls ─────────────────────────────────────
  EDITOR_BLOCK_EDIT: 'Editar bloque',
  EDITOR_BLOCK_DELETE: 'Eliminar bloque',
  EDITOR_BLOCK_DELETE_REQUIRED_TOOLTIP: 'Este bloque es requerido y no puede eliminarse.',
  EDITOR_BLOCK_DELETE_CONFIRM: '¿Eliminar este bloque? Esta acción no se puede deshacer.',
  EDITOR_BLOCK_REQUIRED_LABEL: 'REQUERIDO',
  EDITOR_BLOCK_APPLY: 'Aplicar',
  EDITOR_BLOCK_CANCEL: 'Cancelar',
  EDITOR_BLOCK_EMPTY_TEXT: '(texto vacío)',
  EDITOR_SECTION_EMPTY: 'Sección sin bloques.',

  // ── Protocols — Text block editor ─────────────────────────────────────────
  EDITOR_TEXT_PLACEHOLDER: 'Escribe el contenido de este bloque de texto…',

  // ── Protocols — Alert block editor ────────────────────────────────────────
  EDITOR_ALERT_SEVERITY_LABEL: 'Severidad',
  EDITOR_ALERT_SEVERITY_INFO: 'Información',
  EDITOR_ALERT_SEVERITY_WARNING: 'Advertencia',
  EDITOR_ALERT_SEVERITY_DANGER: 'Peligro',
  EDITOR_ALERT_SEVERITY_SUCCESS: 'Éxito',
  EDITOR_ALERT_TITLE_LABEL: 'Título (opcional)',
  EDITOR_ALERT_TITLE_PLACEHOLDER: 'Ej. Contraindicaciones absolutas',
  EDITOR_ALERT_CONTENT_LABEL: 'Contenido',
  EDITOR_ALERT_CONTENT_PLACEHOLDER: 'Describe la advertencia o información importante…',

  // ── Protocols — Editor palette ─────────────────────────────────────────────
  EDITOR_PALETTE_ADD_TEXT: 'Añadir bloque de texto',
  EDITOR_PALETTE_ADD_ALERT: 'Añadir bloque de alerta',
  EDITOR_PALETTE_DISABLED_TOOLTIP: 'Disponible próximamente',

  // ── Protocols — Autosave ──────────────────────────────────────────────────
  EDITOR_DRAFT_RECOVERED: 'Se recuperó un borrador no guardado.',
  EDITOR_DRAFT_USE: 'Usar borrador',
  EDITOR_DRAFT_DISCARD: 'Descartar',
  EDITOR_NAVIGATE_AWAY: 'Tienes cambios sin guardar. ¿Descartar y salir?',

  // ── Protocols — Block type labels (shown in type chip) ─────────────────────
  BLOCK_TYPE_SECTION: 'Sección',
  BLOCK_TYPE_TEXT: 'Texto',
  BLOCK_TYPE_CHECKLIST: 'Lista',
  BLOCK_TYPE_STEPS: 'Pasos',
  BLOCK_TYPE_DECISION: 'Decisión',
  BLOCK_TYPE_DOSAGE_TABLE: 'Dosificación',
  BLOCK_TYPE_ALERT: 'Alerta',
  BLOCK_TYPE_UNKNOWN: 'Bloque',

  // ── Settings — Templates ──────────────────────────────────────────────────
  TEMPLATES_PAGE_TITLE: 'Plantillas',
  TEMPLATES_NEW_BUTTON: 'Nueva plantilla',
  TEMPLATES_EMPTY_TITLE: 'Sin plantillas',
  TEMPLATES_EMPTY_DESCRIPTION: 'Crea tu primera plantilla para empezar a diseñar protocolos.',
  TEMPLATES_LIST_SEEDED: 'Predeterminada',
  TEMPLATES_LIST_LOCKED: 'Bloqueada',
  TEMPLATES_LIST_BLOCKED_BY: (count: number) =>
    `Bloqueada por ${count} tipo${count === 1 ? '' : 's'}`,
  TEMPLATES_LIST_EDIT: 'Editar',
  TEMPLATES_LIST_DELETE: 'Eliminar',
  TEMPLATES_LIST_DELETE_CONFIRM: (name: string) =>
    `¿Eliminar la plantilla "${name}"? Esta acción no se puede deshacer.`,
  TEMPLATES_LOADING: 'Cargando plantillas...',
  TEMPLATES_ERROR: 'No se pudo cargar las plantillas.',
  TEMPLATES_DELETE_SUCCESS: 'Plantilla eliminada.',
  TEMPLATES_DELETE_LOCKED: 'No se puede eliminar: tiene tipos asociados.',

  // ── Settings — Template Editor ─────────────────────────────────────────────
  TEMPLATE_EDITOR_NEW_TITLE: 'Nueva plantilla',
  TEMPLATE_EDITOR_SAVE: 'Guardar plantilla',
  TEMPLATE_EDITOR_SAVING: 'Guardando...',
  TEMPLATE_EDITOR_CANCEL: 'Cancelar',
  TEMPLATE_EDITOR_SAVED: 'Plantilla guardada.',
  TEMPLATE_EDITOR_UNSAVED: 'Cambios sin guardar',
  TEMPLATE_EDITOR_FIELD_NAME: 'Nombre de la plantilla',
  TEMPLATE_EDITOR_FIELD_NAME_PLACEHOLDER: 'Ej. Intervención de emergencia',
  TEMPLATE_EDITOR_FIELD_SPECIALTY: 'Especialidad sugerida',
  TEMPLATE_EDITOR_FIELD_SPECIALTY_PLACEHOLDER: 'Ej. cardiología, pediatría',
  TEMPLATE_EDITOR_STATUS_NEW: 'Nueva',
  TEMPLATE_EDITOR_STATUS_EDITED: 'Editada',
  TEMPLATE_EDITOR_STATUS_LOCKED: 'Bloqueada',
  TEMPLATE_EDITOR_LOCKED_BANNER:
    'Esta plantilla está bloqueada por uno o más tipos. Elimínalos primero para editarla.',
  TEMPLATE_EDITOR_LOCKED_TYPES_PREFIX: 'Bloqueada por:',
  TEMPLATE_EDITOR_ADD_SECTION: '+ Sección',
  TEMPLATE_EDITOR_ADD_TEXT: '+ Texto',
  TEMPLATE_EDITOR_ADD_CHECKLIST: '+ Checklist',
  TEMPLATE_EDITOR_ADD_STEPS: '+ Pasos',
  TEMPLATE_EDITOR_ADD_DECISION: '+ Decisión',
  TEMPLATE_EDITOR_ADD_DOSAGE: '+ Tabla dosis',
  TEMPLATE_EDITOR_ADD_ALERT: '+ Alerta',
  TEMPLATE_EDITOR_NEEDS_SECTION: 'Añade primero una sección para contener este bloque.',
  TEMPLATE_EDITOR_REQUIRED_LABEL: 'Requerido',
  TEMPLATE_EDITOR_REQUIRED_SECTION_LABEL: 'Requerida',
  TEMPLATE_EDITOR_DELETE_SECTION_CONFIRM: (title: string, count: number) =>
    `¿Eliminar la sección "${title}" y sus ${count} bloque${count === 1 ? '' : 's'} hijo${count === 1 ? '' : 's'}?`,
  TEMPLATE_EDITOR_PLACEHOLDER_HINT: 'Pista para el médico (opcional)',
  TEMPLATE_EDITOR_SECTION_TITLE_LABEL: 'Título de la sección',
  TEMPLATE_EDITOR_SECTION_DESC_LABEL: 'Descripción (opcional)',
  TEMPLATE_EDITOR_NAVIGATE_AWAY: 'Tienes cambios sin guardar. ¿Descartar y salir?',
  TEMPLATE_EDITOR_MOVE_UP: 'Mover arriba',
  TEMPLATE_EDITOR_MOVE_DOWN: 'Mover abajo',
  TEMPLATE_EDITOR_DUPLICATE: 'Duplicar',
  TEMPLATE_EDITOR_DELETE: 'Eliminar',
  TEMPLATE_EDITOR_REQUIRED_TOOLTIP: 'Desactiva "Requerido" antes de eliminar.',
  TEMPLATE_EDITOR_NO_TITLE: '(sin título)',

  // ── Settings — Types ──────────────────────────────────────────────────────
  TYPES_PAGE_TITLE: 'Tipos de protocolo',
  TYPES_NEW_BUTTON: 'Nuevo tipo',
  TYPES_EMPTY_TITLE: 'Sin tipos de protocolo',
  TYPES_EMPTY_DESCRIPTION: 'Crea al menos un tipo para poder crear protocolos.',
  TYPES_LOADING: 'Cargando tipos...',
  TYPES_ERROR: 'No se pudo cargar los tipos.',
  TYPES_LIST_EDIT: 'Renombrar',
  TYPES_LIST_DELETE: 'Eliminar',
  TYPES_LIST_DELETE_CONFIRM: (name: string) =>
    `¿Eliminar el tipo "${name}"? Esta acción no se puede deshacer.`,
  TYPES_DELETE_LOCKED: 'No se puede eliminar: tiene protocolos asociados.',
  TYPES_CREATE_TITLE: 'Nuevo tipo de protocolo',
  TYPES_CREATE_FIELD_NAME: 'Nombre',
  TYPES_CREATE_FIELD_NAME_PLACEHOLDER: 'Ej. Emergencia, Procedimiento',
  TYPES_CREATE_FIELD_TEMPLATE: 'Plantilla base',
  TYPES_CREATE_FIELD_TEMPLATE_PLACEHOLDER: 'Selecciona una plantilla',
  TYPES_CREATE_SUBMIT: 'Crear tipo',
  TYPES_CREATE_SUBMITTING: 'Creando...',
  TYPES_CREATE_CANCEL: 'Cancelar',
  TYPES_RENAME_TITLE: 'Renombrar tipo',
  TYPES_RENAME_FIELD: 'Nombre',
  TYPES_RENAME_SUBMIT: 'Guardar',
  TYPES_RENAME_SUBMITTING: 'Guardando...',
  TYPES_RENAME_CANCEL: 'Cancelar',
  TYPES_LOCKED_BADGE: (count: number) => `Bloqueado · ${count} protocolo${count === 1 ? '' : 's'}`,
  TYPES_ACTIVE_BADGE: 'Activo',

  // ── Onboarding — /bienvenido ──────────────────────────────────────────────
  ONBOARDING_WELCOME_HEADING: (name: string | null) =>
    name ? `Bienvenida, ${name}` : 'Bienvenida',
  ONBOARDING_WELCOME_LEAD:
    'Antes de crear tu primer protocolo, configura las plantillas y tipos que usarás en tu práctica.',
  ONBOARDING_DEFAULT_CTA: 'Empezar con la configuración por defecto',
  ONBOARDING_DEFAULT_HELPER:
    '5 plantillas listas para emergencias, procedimientos, medicación, diagnóstico y fisioterapia.',
  ONBOARDING_CUSTOMIZE_LINK: 'Prefiero personalizar',
  ONBOARDING_LOADING: 'Configurando tu cuenta...',
  ONBOARDING_ERROR: 'Algo salió mal. Inténtalo de nuevo.',
  ONBOARDING_SUCCESS_TOAST: 'Configuración lista. Ya puedes crear tu primer protocolo.',

  ONBOARDING_STEP1_TITLE: 'Revisa tus plantillas',
  ONBOARDING_STEP1_DESC:
    'Estas son las plantillas que usarás como punto de partida para tus protocolos. Puedes editarlas, eliminarlas o añadir las tuyas.',
  ONBOARDING_STEP1_ADD: '+ Crear otra plantilla',
  ONBOARDING_STEP1_CONTINUE: 'Continuar a tipos',
  ONBOARDING_STEP1_BACK: 'Volver al inicio',
  ONBOARDING_STEP1_EMPTY: 'Necesitas al menos una plantilla para continuar.',

  ONBOARDING_STEP2_TITLE: 'Revisa tus tipos',
  ONBOARDING_STEP2_DESC:
    'Cada tipo apunta a una plantilla. Los doctores verán los tipos al crear protocolos; las plantillas quedan detrás.',
  ONBOARDING_STEP2_ADD: '+ Crear otro tipo',
  ONBOARDING_STEP2_FINISH: 'Finalizar configuración',
  ONBOARDING_STEP2_BACK: 'Volver a plantillas',
  ONBOARDING_STEP2_EMPTY: 'Necesitas al menos un tipo para continuar.',

  // ── Protocols — Viewer ─────────────────────────────────────────────────────
  VIEWER_BACK: 'Protocolos',
  VIEWER_EDIT_BUTTON: 'Editar',
  VIEWER_VERSION: (n: number) => `v${n}`,
  VIEWER_UPDATED: 'Actualizado',
  VIEWER_NO_CONTENT: 'Este protocolo no tiene contenido todavía.',
  VIEWER_LOADING: 'Cargando protocolo...',
  VIEWER_NOT_FOUND: 'Protocolo no encontrado.',
} as const

/**
 * Map a Firebase error code to a human-readable Spanish message.
 */
export function firebaseErrorToSpanish(code: string): string {
  const map: Record<string, string> = {
    'auth/email-already-in-use': strings.FIREBASE_ERROR_EMAIL_ALREADY_IN_USE,
    'auth/invalid-email': strings.FIREBASE_ERROR_INVALID_EMAIL,
    'auth/weak-password': strings.FIREBASE_ERROR_WEAK_PASSWORD,
    'auth/user-not-found': strings.FIREBASE_ERROR_USER_NOT_FOUND,
    'auth/wrong-password': strings.FIREBASE_ERROR_WRONG_PASSWORD,
    'auth/invalid-credential': strings.FIREBASE_ERROR_INVALID_CREDENTIAL,
    'auth/network-request-failed': strings.FIREBASE_ERROR_NETWORK_REQUEST_FAILED,
    'auth/too-many-requests': strings.FIREBASE_ERROR_TOO_MANY_REQUESTS,
  }
  return map[code] ?? strings.FIREBASE_ERROR_UNKNOWN
}
