export interface TemplateFixture {
  /** Internal key for cross-referencing in the seeder */
  key: string
  name: string
  intendedUse: string
  schema: object
  /** Name of the seeded category this template belongs to */
  categoryName: string
}

// Fixtures defined inline as typed constants — avoids JSON import headaches
// and keeps the starter schemas in version-controlled TypeScript.

const esFixtures: TemplateFixture[] = [
  {
    key: 'emergency',
    name: 'Intervención de emergencia',
    intendedUse: 'Intervenciones agudas con tiempo crítico',
    categoryName: 'Emergencias',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'emergency_medicine',
        intended_use: 'Intervenciones agudas con tiempo crítico',
      },
      blocks: [
        {
          id: 'sec_indications',
          type: 'section',
          title: 'Indicaciones',
          required: true,
          description: 'Cuándo activar este protocolo',
          placeholder_blocks: [
            {
              type: 'text',
              placeholder:
                'Criterios clínicos que activan este protocolo (signos, síntomas, umbrales).',
            },
          ],
        },
        {
          id: 'sec_contraindications',
          type: 'section',
          title: 'Contraindicaciones',
          required: false,
          description: 'Cuándo NO usar este protocolo',
          placeholder_blocks: [
            {
              type: 'alert',
              severity: 'danger',
              placeholder: 'Contraindicaciones absolutas o relativas.',
            },
          ],
        },
        {
          id: 'blk_vitals',
          type: 'vitals',
          fields: [
            { id: 'vf_bp', label: 'Presión arterial', unit: 'mmHg', input_type: 'text' },
            { id: 'vf_hr', label: 'Frecuencia cardíaca', unit: 'lpm', input_type: 'number' },
            { id: 'vf_temp', label: 'Temperatura', unit: '°C', input_type: 'number' },
            { id: 'vf_weight', label: 'Peso', unit: 'kg', input_type: 'number' },
            { id: 'vf_height', label: 'Talla', unit: 'cm', input_type: 'number' },
          ],
        },
        {
          id: 'sec_assessment',
          type: 'section',
          title: 'Evaluación inicial',
          required: true,
          description: 'Primeras acciones al encontrar al paciente',
          placeholder_blocks: [
            {
              type: 'checklist',
              placeholder: 'Evaluación primaria (ABC, signos vitales, conciencia).',
            },
          ],
        },
        {
          id: 'sec_intervention',
          type: 'section',
          title: 'Intervención',
          required: true,
          description: 'Pasos de tratamiento',
          placeholder_blocks: [
            {
              type: 'alert',
              severity: 'warning',
              placeholder: 'Advertencias con tiempo crítico.',
            },
            {
              id: 'blk_int_meds',
              type: 'dosage_table',
              required: true,
              placeholder: 'Medicamentos de primera línea.',
            },
            {
              type: 'steps',
              placeholder: 'Acciones de soporte.',
            },
          ],
        },
        {
          id: 'sec_monitoring',
          type: 'section',
          title: 'Monitoreo post-intervención',
          required: false,
          description: 'Qué observar y por cuánto tiempo',
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Parámetros de monitoreo, frecuencia, duración.',
            },
          ],
        },
        {
          id: 'blk_dx_notes',
          type: 'clinical_notes',
          label: 'Diagnóstico',
        },
        {
          id: 'blk_evolucion_notes',
          type: 'clinical_notes',
          label: 'Evolución',
        },
        {
          id: 'sec_escalation',
          type: 'section',
          title: 'Criterios de escalación',
          required: false,
          description: 'Cuándo trasladar, consultar o escalar',
          placeholder_blocks: [
            {
              type: 'decision',
              placeholder: 'Punto de decisión para escalar.',
            },
          ],
        },
        {
          id: 'sec_references',
          type: 'section',
          title: 'Referencias',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Base de evidencia, guías, bibliografía.',
            },
          ],
        },
      ],
    },
  },
  {
    key: 'diagnostic',
    name: 'Algoritmo diagnóstico',
    intendedUse: 'Vías de decisión diagnóstica',
    categoryName: 'Diagnóstico',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'general',
        intended_use: 'Vías de decisión diagnóstica',
      },
      blocks: [
        {
          id: 'blk_motivo_notes',
          type: 'clinical_notes',
          label: 'Motivo de consulta',
          required: true,
        },
        {
          id: 'blk_vitals',
          type: 'vitals',
          fields: [
            { id: 'vf_bp', label: 'Presión arterial', unit: 'mmHg', input_type: 'text' },
            { id: 'vf_hr', label: 'Frecuencia cardíaca', unit: 'lpm', input_type: 'number' },
            { id: 'vf_temp', label: 'Temperatura', unit: '°C', input_type: 'number' },
            { id: 'vf_weight', label: 'Peso', unit: 'kg', input_type: 'number' },
            { id: 'vf_height', label: 'Talla', unit: 'cm', input_type: 'number' },
          ],
        },
        {
          id: 'sec_presentation',
          type: 'section',
          title: 'Problema de presentación',
          required: true,
          description: 'Qué activa este algoritmo',
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Motivo de consulta o escenario de presentación.',
            },
          ],
        },
        {
          id: 'sec_redflags',
          type: 'section',
          title: 'Signos de alarma',
          required: false,
          placeholder_blocks: [
            {
              type: 'checklist',
              placeholder: 'Características de alto riesgo que requieren acción inmediata.',
            },
          ],
        },
        {
          id: 'sec_history',
          type: 'section',
          title: 'Historial y examen clave',
          required: false,
          placeholder_blocks: [
            {
              type: 'checklist',
              placeholder: 'Preguntas de historial dirigido y hallazgos de examen.',
            },
          ],
        },
        {
          id: 'sec_pathway',
          type: 'section',
          title: 'Algoritmo de decisión',
          required: true,
          description: 'Lógica de decisión paso a paso',
          placeholder_blocks: [
            {
              type: 'decision',
              placeholder: 'Primer punto de ramificación.',
            },
            {
              type: 'decision',
              placeholder: 'Segundo punto de ramificación.',
            },
          ],
        },
        {
          id: 'sec_workup',
          type: 'section',
          title: 'Estudios recomendados',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Exámenes, imágenes, referencias para cada vía diagnóstica.',
            },
          ],
        },
        {
          id: 'sec_differential',
          type: 'section',
          title: 'Diagnóstico diferencial',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Diagnósticos alternativos más comunes y más peligrosos.',
            },
          ],
        },
        {
          id: 'blk_dx_notes',
          type: 'clinical_notes',
          label: 'Diagnóstico',
        },
        {
          id: 'blk_plan_notes',
          type: 'clinical_notes',
          label: 'Plan de tratamiento',
        },
      ],
    },
  },
]

// The `en` fixtures below intentionally reuse the SAME SPANISH labels for their
// `clinical_notes` blocks (e.g. 'Motivo de consulta', 'Diagnóstico') even though
// the rest of the fixture is translated. The historia médica generator's section
// router (`matchNotesSection` in packages/shared/src/record/generate-record-sections.ts)
// matches Spanish keywords only, and the product's UI language is Spanish — so
// translating these labels to English would silently break historia routing for
// doctors using the English locale.
const enFixtures: TemplateFixture[] = [
  {
    key: 'emergency',
    name: 'Emergency Intervention',
    intendedUse: 'Time-sensitive acute interventions',
    categoryName: 'Emergencies',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'emergency_medicine',
        intended_use: 'Time-sensitive acute interventions',
      },
      blocks: [
        {
          id: 'sec_indications',
          type: 'section',
          title: 'Indications',
          required: true,
          description: 'When to activate this protocol',
          placeholder_blocks: [
            {
              type: 'text',
              placeholder:
                'Clinical criteria that trigger this protocol (signs, symptoms, thresholds).',
            },
          ],
        },
        {
          id: 'sec_contraindications',
          type: 'section',
          title: 'Contraindications',
          required: false,
          description: 'When NOT to use this protocol',
          placeholder_blocks: [
            {
              type: 'alert',
              severity: 'danger',
              placeholder: 'Absolute or relative contraindications.',
            },
          ],
        },
        {
          id: 'blk_vitals',
          type: 'vitals',
          fields: [
            { id: 'vf_bp', label: 'Presión arterial', unit: 'mmHg', input_type: 'text' },
            { id: 'vf_hr', label: 'Frecuencia cardíaca', unit: 'lpm', input_type: 'number' },
            { id: 'vf_temp', label: 'Temperatura', unit: '°C', input_type: 'number' },
            { id: 'vf_weight', label: 'Peso', unit: 'kg', input_type: 'number' },
            { id: 'vf_height', label: 'Talla', unit: 'cm', input_type: 'number' },
          ],
        },
        {
          id: 'sec_assessment',
          type: 'section',
          title: 'Initial Assessment',
          required: true,
          description: 'First actions on patient encounter',
          placeholder_blocks: [
            {
              type: 'checklist',
              placeholder: 'Primary survey (ABC, vitals, consciousness).',
            },
          ],
        },
        {
          id: 'sec_intervention',
          type: 'section',
          title: 'Intervention',
          required: true,
          description: 'Treatment steps',
          placeholder_blocks: [
            {
              type: 'alert',
              severity: 'warning',
              placeholder: 'Time-critical warnings.',
            },
            {
              id: 'blk_int_meds',
              type: 'dosage_table',
              required: true,
              placeholder: 'First-line medications.',
            },
            {
              type: 'steps',
              placeholder: 'Supportive care actions.',
            },
          ],
        },
        {
          id: 'sec_monitoring',
          type: 'section',
          title: 'Post-intervention Monitoring',
          required: false,
          description: 'What to watch and for how long',
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Monitoring parameters, frequency, duration.',
            },
          ],
        },
        {
          id: 'blk_dx_notes',
          type: 'clinical_notes',
          label: 'Diagnóstico',
        },
        {
          id: 'blk_evolucion_notes',
          type: 'clinical_notes',
          label: 'Evolución',
        },
        {
          id: 'sec_escalation',
          type: 'section',
          title: 'Escalation Criteria',
          required: false,
          description: 'When to transfer, consult, or escalate',
          placeholder_blocks: [
            {
              type: 'decision',
              placeholder: 'Decision point for escalation.',
            },
          ],
        },
        {
          id: 'sec_references',
          type: 'section',
          title: 'References',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Evidence base, guidelines, literature.',
            },
          ],
        },
      ],
    },
  },
  {
    key: 'diagnostic',
    name: 'Diagnostic Algorithm',
    intendedUse: 'Diagnostic decision pathways',
    categoryName: 'Diagnosis',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'general',
        intended_use: 'Diagnostic decision pathways',
      },
      blocks: [
        {
          id: 'blk_motivo_notes',
          type: 'clinical_notes',
          label: 'Motivo de consulta',
          required: true,
        },
        {
          id: 'blk_vitals',
          type: 'vitals',
          fields: [
            { id: 'vf_bp', label: 'Presión arterial', unit: 'mmHg', input_type: 'text' },
            { id: 'vf_hr', label: 'Frecuencia cardíaca', unit: 'lpm', input_type: 'number' },
            { id: 'vf_temp', label: 'Temperatura', unit: '°C', input_type: 'number' },
            { id: 'vf_weight', label: 'Peso', unit: 'kg', input_type: 'number' },
            { id: 'vf_height', label: 'Talla', unit: 'cm', input_type: 'number' },
          ],
        },
        {
          id: 'sec_presentation',
          type: 'section',
          title: 'Presenting Problem',
          required: true,
          description: 'What triggers this algorithm',
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Chief complaint or presenting scenario.',
            },
          ],
        },
        {
          id: 'sec_redflags',
          type: 'section',
          title: 'Red Flags',
          required: false,
          placeholder_blocks: [
            {
              type: 'checklist',
              placeholder: 'High-risk features requiring immediate action.',
            },
          ],
        },
        {
          id: 'sec_history',
          type: 'section',
          title: 'Key History & Exam',
          required: false,
          placeholder_blocks: [
            {
              type: 'checklist',
              placeholder: 'Targeted history questions and exam findings.',
            },
          ],
        },
        {
          id: 'sec_pathway',
          type: 'section',
          title: 'Decision Pathway',
          required: true,
          description: 'Step-wise decision logic',
          placeholder_blocks: [
            { type: 'decision', placeholder: 'First branch point.' },
            { type: 'decision', placeholder: 'Second branch point.' },
          ],
        },
        {
          id: 'sec_workup',
          type: 'section',
          title: 'Recommended Workup',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Tests, imaging, referrals for each diagnostic path.',
            },
          ],
        },
        {
          id: 'sec_differential',
          type: 'section',
          title: 'Differential Diagnosis',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Most common and most dangerous alternative diagnoses.',
            },
          ],
        },
        {
          id: 'blk_dx_notes',
          type: 'clinical_notes',
          label: 'Diagnóstico',
        },
        {
          id: 'blk_plan_notes',
          type: 'clinical_notes',
          label: 'Plan de tratamiento',
        },
      ],
    },
  },
]

export function getStarterFixtures(locale: 'es' | 'en'): TemplateFixture[] {
  return locale === 'en' ? enFixtures : esFixtures
}
