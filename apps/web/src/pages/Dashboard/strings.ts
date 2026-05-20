export const dashboardStrings = {
  greeting: (fullName: string | null) => {
    const hour = new Date().getHours()
    const salutation = hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches'
    if (!fullName) return `${salutation}, Dr.`
    // Extract last name (last word), dropping leading "Dr." if present
    const parts = fullName
      .replace(/^Dr\.\s*/i, '')
      .trim()
      .split(' ')
    /* v8 ignore next -- defensive nullish chain, .split always returns ≥1 element */
    const lastName = parts[parts.length - 1] ?? parts[0] ?? fullName
    return `${salutation}, Dr. ${lastName}.`
  },
  underConstruction: 'Panel en construcción',
  underConstructionDescription: 'El resumen de actividad del día aparecerá aquí.',
} as const
