export interface TemplateFixture {
  /** Internal key for cross-referencing in the seeder */
  key: string
  name: string
  suggestedSpecialty: string
  intendedUse: string
  schema: object
  /** Default type name that points at this template */
  typeName: string
}

// Fixtures defined inline as typed constants — avoids JSON import headaches
// and keeps the starter schemas in version-controlled TypeScript.

const esFixtures: TemplateFixture[] = [
  {
    key: 'emergency',
    name: 'Intervención de emergencia',
    suggestedSpecialty: 'emergency_medicine',
    intendedUse: 'Intervenciones agudas con tiempo crítico',
    typeName: 'Emergencia',
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
    key: 'procedure',
    name: 'Procedimiento clínico',
    suggestedSpecialty: 'general',
    intendedUse: 'Procedimientos clínicos de rutina con flujo de trabajo definido',
    typeName: 'Procedimiento',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'general',
        intended_use: 'Procedimientos clínicos de rutina con flujo de trabajo definido',
      },
      blocks: [
        {
          id: 'sec_indications',
          type: 'section',
          title: 'Indicaciones',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Cuándo se realiza este procedimiento.',
            },
          ],
        },
        {
          id: 'sec_preparation',
          type: 'section',
          title: 'Preparación',
          required: false,
          description: 'Preparación previa al procedimiento',
          placeholder_blocks: [
            {
              type: 'checklist',
              placeholder: 'Materiales, equipo y preparación del paciente.',
            },
            {
              type: 'alert',
              severity: 'info',
              placeholder: 'Consentimiento, alergias y estado de anticoagulación.',
            },
          ],
        },
        {
          id: 'sec_steps',
          type: 'section',
          title: 'Pasos del procedimiento',
          required: true,
          description: 'Técnica paso a paso',
          placeholder_blocks: [
            {
              type: 'steps',
              placeholder: 'Pasos numerados del procedimiento.',
            },
          ],
        },
        {
          id: 'sec_complications',
          type: 'section',
          title: 'Posibles complicaciones',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Eventos adversos esperados y raros.',
            },
            {
              type: 'alert',
              severity: 'warning',
              placeholder: 'Signos que requieren atención inmediata.',
            },
          ],
        },
        {
          id: 'sec_post',
          type: 'section',
          title: 'Instrucciones post-procedimiento',
          required: true,
          description: 'Cuidados después del procedimiento',
          placeholder_blocks: [
            {
              type: 'checklist',
              placeholder: 'Instrucciones al paciente y cuidados de seguimiento.',
            },
          ],
        },
      ],
    },
  },
  {
    key: 'pharmacology',
    name: 'Referencia farmacológica',
    suggestedSpecialty: 'pharmacology',
    intendedUse: 'Referencias de dosificación de medicamentos',
    typeName: 'Medicación',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'pharmacology',
        intended_use: 'Referencias de dosificación de medicamentos',
      },
      blocks: [
        {
          id: 'sec_indications',
          type: 'section',
          title: 'Indicaciones',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Situaciones clínicas que aborda este régimen.',
            },
          ],
        },
        {
          id: 'sec_warnings',
          type: 'section',
          title: 'Advertencias y contraindicaciones',
          required: false,
          placeholder_blocks: [
            {
              type: 'alert',
              severity: 'danger',
              placeholder: 'Contraindicaciones absolutas.',
            },
            {
              type: 'alert',
              severity: 'warning',
              placeholder: 'Contraindicaciones relativas y precauciones.',
            },
          ],
        },
        {
          id: 'sec_dosing',
          type: 'section',
          title: 'Dosificación',
          required: true,
          description: 'Régimen de medicación',
          placeholder_blocks: [
            {
              id: 'blk_dose_table',
              type: 'dosage_table',
              required: true,
              placeholder: 'Medicamentos, dosis, vías, frecuencias y notas.',
            },
            {
              type: 'text',
              placeholder: 'Ajustes de dosis por insuficiencia renal/hepática.',
            },
          ],
        },
        {
          id: 'sec_monitoring',
          type: 'section',
          title: 'Monitoreo',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Laboratorios, signos vitales o síntomas a monitorear; frecuencia.',
            },
          ],
        },
        {
          id: 'sec_decision',
          type: 'section',
          title: 'Reglas de ajuste de dosis',
          required: false,
          placeholder_blocks: [
            {
              type: 'decision',
              placeholder: 'Cuándo ajustar, suspender o escalar la dosis.',
            },
          ],
        },
        {
          id: 'sec_adverse',
          type: 'section',
          title: 'Efectos adversos',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Efectos adversos comunes y graves a comunicar al paciente.',
            },
          ],
        },
      ],
    },
  },
  {
    key: 'diagnostic',
    name: 'Algoritmo diagnóstico',
    suggestedSpecialty: 'general',
    intendedUse: 'Vías de decisión diagnóstica',
    typeName: 'Diagnóstico',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'general',
        intended_use: 'Vías de decisión diagnóstica',
      },
      blocks: [
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
      ],
    },
  },
  {
    key: 'physiotherapy',
    name: 'Sesión de fisioterapia',
    suggestedSpecialty: 'physiotherapy',
    intendedUse: 'Estructura de sesión de rehabilitación con reglas de progresión',
    typeName: 'Fisioterapia',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'physiotherapy',
        intended_use: 'Estructura de sesión de rehabilitación con reglas de progresión',
      },
      blocks: [
        {
          id: 'sec_goals',
          type: 'section',
          title: 'Objetivos del tratamiento',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder:
                'Objetivos a corto y largo plazo para esta fase de rehabilitación.',
            },
          ],
        },
        {
          id: 'sec_assessment',
          type: 'section',
          title: 'Evaluación',
          required: true,
          description: 'Evaluación al inicio de cada sesión',
          placeholder_blocks: [
            {
              type: 'checklist',
              placeholder:
                'Dolor, rango de movimiento, fuerza, pruebas funcionales a realizar.',
            },
            {
              type: 'text',
              placeholder: 'Medidas de resultados a seguir en el tiempo.',
            },
          ],
        },
        {
          id: 'sec_progression',
          type: 'section',
          title: 'Criterios de progresión',
          required: false,
          description: 'Cuándo avanzar al paciente',
          placeholder_blocks: [
            {
              type: 'decision',
              placeholder: 'Criterios para progresar a la siguiente fase.',
            },
          ],
        },
        {
          id: 'sec_plan',
          type: 'section',
          title: 'Plan de tratamiento',
          required: true,
          description: 'Intervenciones para esta fase',
          placeholder_blocks: [
            {
              type: 'steps',
              placeholder:
                'Ejercicios, técnicas o modalidades (con repeticiones/series/duración).',
            },
          ],
        },
        {
          id: 'sec_home',
          type: 'section',
          title: 'Programa de ejercicios en casa',
          required: false,
          placeholder_blocks: [
            {
              type: 'steps',
              placeholder:
                'Ejercicios que el paciente realiza en casa entre sesiones.',
            },
          ],
        },
        {
          id: 'sec_precautions',
          type: 'section',
          title: 'Precauciones',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder:
                'Movimientos, cargas o actividades a evitar en esta fase.',
            },
          ],
        },
      ],
    },
  },
]

const enFixtures: TemplateFixture[] = [
  {
    key: 'emergency',
    name: 'Emergency Intervention',
    suggestedSpecialty: 'emergency_medicine',
    intendedUse: 'Time-sensitive acute interventions',
    typeName: 'Emergency',
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
    key: 'procedure',
    name: 'Clinical Procedure',
    suggestedSpecialty: 'general',
    intendedUse: 'Routine clinical procedures with defined workflow',
    typeName: 'Procedure',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'general',
        intended_use: 'Routine clinical procedures with defined workflow',
      },
      blocks: [
        {
          id: 'sec_indications',
          type: 'section',
          title: 'Indications',
          required: false,
          placeholder_blocks: [
            { type: 'text', placeholder: 'When this procedure is performed.' },
          ],
        },
        {
          id: 'sec_preparation',
          type: 'section',
          title: 'Preparation',
          required: false,
          description: 'Pre-procedure setup',
          placeholder_blocks: [
            {
              type: 'checklist',
              placeholder: 'Materials, equipment, and patient prep.',
            },
            {
              type: 'alert',
              severity: 'info',
              placeholder: 'Consent, allergies, and anticoagulation status.',
            },
          ],
        },
        {
          id: 'sec_steps',
          type: 'section',
          title: 'Procedure Steps',
          required: true,
          description: 'Step-by-step technique',
          placeholder_blocks: [
            { type: 'steps', placeholder: 'Numbered steps of the procedure.' },
          ],
        },
        {
          id: 'sec_complications',
          type: 'section',
          title: 'Possible Complications',
          required: false,
          placeholder_blocks: [
            { type: 'text', placeholder: 'Expected and rare adverse events.' },
            {
              type: 'alert',
              severity: 'warning',
              placeholder: 'Signs that require immediate attention.',
            },
          ],
        },
        {
          id: 'sec_post',
          type: 'section',
          title: 'Post-procedure Instructions',
          required: true,
          description: 'Care after the procedure',
          placeholder_blocks: [
            {
              type: 'checklist',
              placeholder: 'Patient instructions and follow-up care.',
            },
          ],
        },
      ],
    },
  },
  {
    key: 'pharmacology',
    name: 'Pharmacological Reference',
    suggestedSpecialty: 'pharmacology',
    intendedUse: 'Medication dosing references',
    typeName: 'Medication',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'pharmacology',
        intended_use: 'Medication dosing references',
      },
      blocks: [
        {
          id: 'sec_indications',
          type: 'section',
          title: 'Indications',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Clinical situations this regimen addresses.',
            },
          ],
        },
        {
          id: 'sec_warnings',
          type: 'section',
          title: 'Warnings & Contraindications',
          required: false,
          placeholder_blocks: [
            {
              type: 'alert',
              severity: 'danger',
              placeholder: 'Absolute contraindications.',
            },
            {
              type: 'alert',
              severity: 'warning',
              placeholder: 'Relative contraindications and cautions.',
            },
          ],
        },
        {
          id: 'sec_dosing',
          type: 'section',
          title: 'Dosing',
          required: true,
          description: 'Medication regimen',
          placeholder_blocks: [
            {
              id: 'blk_dose_table',
              type: 'dosage_table',
              required: true,
              placeholder: 'Drugs, doses, routes, frequencies, and notes.',
            },
            {
              type: 'text',
              placeholder: 'Dose adjustments for renal/hepatic impairment.',
            },
          ],
        },
        {
          id: 'sec_monitoring',
          type: 'section',
          title: 'Monitoring',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Labs, vitals, or symptoms to monitor; frequency.',
            },
          ],
        },
        {
          id: 'sec_decision',
          type: 'section',
          title: 'Dose Adjustment Rules',
          required: false,
          placeholder_blocks: [
            {
              type: 'decision',
              placeholder: 'When to adjust, hold, or escalate the dose.',
            },
          ],
        },
        {
          id: 'sec_adverse',
          type: 'section',
          title: 'Adverse Effects',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Common and serious adverse effects to counsel about.',
            },
          ],
        },
      ],
    },
  },
  {
    key: 'diagnostic',
    name: 'Diagnostic Algorithm',
    suggestedSpecialty: 'general',
    intendedUse: 'Diagnostic decision pathways',
    typeName: 'Diagnosis',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'general',
        intended_use: 'Diagnostic decision pathways',
      },
      blocks: [
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
              placeholder:
                'Most common and most dangerous alternative diagnoses.',
            },
          ],
        },
      ],
    },
  },
  {
    key: 'physiotherapy',
    name: 'Physiotherapy Session',
    suggestedSpecialty: 'physiotherapy',
    intendedUse: 'Rehabilitation session structure with progression rules',
    typeName: 'Physiotherapy',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'physiotherapy',
        intended_use: 'Rehabilitation session structure with progression rules',
      },
      blocks: [
        {
          id: 'sec_goals',
          type: 'section',
          title: 'Treatment Goals',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Short- and long-term goals for this phase of rehab.',
            },
          ],
        },
        {
          id: 'sec_assessment',
          type: 'section',
          title: 'Assessment',
          required: true,
          description: 'Evaluation at the start of each session',
          placeholder_blocks: [
            {
              type: 'checklist',
              placeholder:
                'Pain, ROM, strength, function tests to perform.',
            },
            {
              type: 'text',
              placeholder: 'Outcome measures to track over time.',
            },
          ],
        },
        {
          id: 'sec_progression',
          type: 'section',
          title: 'Progression Criteria',
          required: false,
          description: 'When to advance the patient',
          placeholder_blocks: [
            {
              type: 'decision',
              placeholder: 'Criteria to progress to the next phase.',
            },
          ],
        },
        {
          id: 'sec_plan',
          type: 'section',
          title: 'Treatment Plan',
          required: true,
          description: 'Interventions for this phase',
          placeholder_blocks: [
            {
              type: 'steps',
              placeholder:
                'Exercises, techniques, or modalities (with reps/sets/duration).',
            },
          ],
        },
        {
          id: 'sec_home',
          type: 'section',
          title: 'Home Exercise Program',
          required: false,
          placeholder_blocks: [
            {
              type: 'steps',
              placeholder: 'Exercises patient does at home between sessions.',
            },
          ],
        },
        {
          id: 'sec_precautions',
          type: 'section',
          title: 'Precautions',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder:
                'Movements, loads, or activities to avoid in this phase.',
            },
          ],
        },
      ],
    },
  },
]

export function getStarterFixtures(locale: 'es' | 'en'): TemplateFixture[] {
  return locale === 'en' ? enFixtures : esFixtures
}
