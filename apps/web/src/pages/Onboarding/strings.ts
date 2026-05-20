export const onboardingStrings = {
  welcomeHeading: (name: string | null) => (name ? `Bienvenida, ${name}` : 'Bienvenida'),
  welcomeLead:
    'Antes de crear tu primer protocolo, configura las plantillas y tipos que usarás en tu práctica.',
  defaultCta: 'Empezar con la configuración por defecto',
  defaultHelper:
    '5 plantillas listas para emergencias, procedimientos, medicación, diagnóstico y fisioterapia.',
  customizeLink: 'Prefiero personalizar',
  loading: 'Configurando tu cuenta...',
  error: 'Algo salió mal. Inténtalo de nuevo.',
  successToast: 'Configuración lista. Ya puedes crear tu primer protocolo.',
} as const
