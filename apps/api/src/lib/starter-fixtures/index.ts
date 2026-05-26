export interface TemplateFixture {
  /** Internal key for cross-referencing in the seeder */
  key: string
  name: string
  suggestedSpecialty: string
  intendedUse: string
  schema: object
}

// Fixtures defined inline as typed constants — avoids JSON import headaches
// and keeps the starter schemas in version-controlled TypeScript.

const esFixtures: TemplateFixture[] = [
  {
    key: 'consulta_general',
    name: 'Consulta General',
    suggestedSpecialty: 'general',
    intendedUse: 'Consulta médica general con evaluación de signos vitales',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'general',
        intended_use: 'Consulta médica general con evaluación de signos vitales',
      },
      blocks: [
        {
          id: 'blk_vitals',
          type: 'vitals',
          fields: [
            { id: 'bp', label: 'Presión arterial', unit: 'mmHg', input_type: 'text' },
            { id: 'hr', label: 'Frecuencia cardíaca', unit: 'lpm', input_type: 'number' },
            { id: 'temp', label: 'Temperatura', unit: '°C', input_type: 'number' },
            { id: 'weight', label: 'Peso', unit: 'kg', input_type: 'number' },
            { id: 'height', label: 'Talla', unit: 'cm', input_type: 'number' },
          ],
        },
        {
          id: 'blk_motivo',
          type: 'clinical_notes',
          label: 'Motivo de consulta',
          required: true,
          content: '',
        },
        {
          id: 'blk_hea',
          type: 'clinical_notes',
          label: 'Historia de la enfermedad actual',
          required: false,
          content: '',
        },
        {
          id: 'blk_plan',
          type: 'clinical_notes',
          label: 'Plan',
          required: false,
          content: '',
        },
      ],
    },
  },
  {
    key: 'consulta_emergencia',
    name: 'Consulta de Emergencia',
    suggestedSpecialty: 'emergency_medicine',
    intendedUse: 'Intervenciones agudas con tiempo crítico',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'emergency_medicine',
        intended_use: 'Intervenciones agudas con tiempo crítico',
      },
      blocks: [
        {
          id: 'blk_vitals',
          type: 'vitals',
          fields: [
            { id: 'bp', label: 'Presión arterial', unit: 'mmHg', input_type: 'text' },
            { id: 'hr', label: 'Frecuencia cardíaca', unit: 'lpm', input_type: 'number' },
            { id: 'spo2', label: 'SpO2', unit: '%', input_type: 'number' },
            { id: 'temp', label: 'Temperatura', unit: '°C', input_type: 'number' },
          ],
        },
        {
          id: 'blk_motivo',
          type: 'clinical_notes',
          label: 'Motivo de consulta',
          required: true,
          content: '',
        },
        {
          id: 'blk_eval',
          type: 'clinical_notes',
          label: 'Evaluación',
          required: false,
          content: '',
        },
        {
          id: 'blk_triage',
          type: 'steps',
          title: 'Triage',
          steps: [
            { id: 'stp_abc', order: 1, title: 'Evaluar ABC (vía aérea, respiración, circulación)' },
            { id: 'stp_neuro', order: 2, title: 'Estado neurológico (AVDI)' },
            { id: 'stp_plan', order: 3, title: 'Plan de tratamiento' },
          ],
        },
        {
          id: 'blk_plan',
          type: 'clinical_notes',
          label: 'Plan',
          required: false,
          content: '',
        },
      ],
    },
  },
  {
    key: 'seguimiento_cronico',
    name: 'Seguimiento Crónico',
    suggestedSpecialty: 'general',
    intendedUse: 'Seguimiento de pacientes con enfermedades crónicas',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'general',
        intended_use: 'Seguimiento de pacientes con enfermedades crónicas',
      },
      blocks: [
        {
          id: 'blk_vitals',
          type: 'vitals',
          fields: [
            { id: 'bp', label: 'Presión arterial', unit: 'mmHg', input_type: 'text' },
            { id: 'hr', label: 'Frecuencia cardíaca', unit: 'lpm', input_type: 'number' },
            { id: 'weight', label: 'Peso', unit: 'kg', input_type: 'number' },
          ],
        },
        {
          id: 'blk_evolucion',
          type: 'clinical_notes',
          label: 'Evolución',
          required: false,
          content: '',
        },
        {
          id: 'blk_adherencia',
          type: 'checklist',
          title: 'Adherencia',
          items: [
            { id: 'chk_meds', text: 'Toma medicamentos según indicación' },
            { id: 'chk_dieta', text: 'Sigue dieta recomendada' },
            { id: 'chk_ejercicio', text: 'Actividad física regular' },
          ],
        },
      ],
    },
  },
  {
    key: 'procedimiento',
    name: 'Procedimiento',
    suggestedSpecialty: 'general',
    intendedUse: 'Procedimientos clínicos de rutina con flujo de trabajo definido',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'general',
        intended_use: 'Procedimientos clínicos de rutina con flujo de trabajo definido',
      },
      blocks: [
        {
          id: 'blk_pasos',
          type: 'steps',
          title: 'Pasos del procedimiento',
          steps: [
            { id: 'stp_prep', order: 1, title: 'Preparación del paciente y materiales' },
            { id: 'stp_proc', order: 2, title: 'Realización del procedimiento' },
            { id: 'stp_post', order: 3, title: 'Cuidados post-procedimiento' },
          ],
        },
        {
          id: 'blk_notas',
          type: 'clinical_notes',
          label: 'Notas del procedimiento',
          required: false,
          content: '',
        },
      ],
    },
  },
  {
    key: 'orden_estudios',
    name: 'Orden de Estudios',
    suggestedSpecialty: 'general',
    intendedUse: 'Solicitud de estudios de laboratorio e imágenes',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'general',
        intended_use: 'Solicitud de estudios de laboratorio e imágenes',
      },
      blocks: [
        {
          id: 'blk_lab',
          type: 'lab_order',
          title: 'Estudios de laboratorio',
          orders: [
            {
              id: 'lab_hemograma',
              test_name: 'Hemograma completo',
              indication: 'Evaluación hematológica general',
              urgency: 'routine',
              fasting_required: false,
              sample_type: 'blood',
            },
          ],
        },
        {
          id: 'blk_imaging',
          type: 'imaging_order',
          title: 'Estudios de imágenes',
          orders: [
            {
              id: 'img_rx',
              study_type: 'Radiografía de tórax',
              indication: 'Evaluación pulmonar',
              urgency: 'routine',
              contrast: false,
              fasting_required: false,
            },
          ],
        },
      ],
    },
  },
]

const enFixtures: TemplateFixture[] = [
  {
    key: 'consulta_general',
    name: 'General Consultation',
    suggestedSpecialty: 'general',
    intendedUse: 'General medical consultation with vital signs evaluation',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'general',
        intended_use: 'General medical consultation with vital signs evaluation',
      },
      blocks: [
        {
          id: 'blk_vitals',
          type: 'vitals',
          fields: [
            { id: 'bp', label: 'Blood pressure', unit: 'mmHg', input_type: 'text' },
            { id: 'hr', label: 'Heart rate', unit: 'bpm', input_type: 'number' },
            { id: 'temp', label: 'Temperature', unit: '°C', input_type: 'number' },
            { id: 'weight', label: 'Weight', unit: 'kg', input_type: 'number' },
            { id: 'height', label: 'Height', unit: 'cm', input_type: 'number' },
          ],
        },
        {
          id: 'blk_motivo',
          type: 'clinical_notes',
          label: 'Chief complaint',
          required: true,
          content: '',
        },
        {
          id: 'blk_hea',
          type: 'clinical_notes',
          label: 'History of present illness',
          required: false,
          content: '',
        },
        {
          id: 'blk_plan',
          type: 'clinical_notes',
          label: 'Plan',
          required: false,
          content: '',
        },
      ],
    },
  },
  {
    key: 'consulta_emergencia',
    name: 'Emergency Consultation',
    suggestedSpecialty: 'emergency_medicine',
    intendedUse: 'Time-sensitive acute interventions',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'emergency_medicine',
        intended_use: 'Time-sensitive acute interventions',
      },
      blocks: [
        {
          id: 'blk_vitals',
          type: 'vitals',
          fields: [
            { id: 'bp', label: 'Blood pressure', unit: 'mmHg', input_type: 'text' },
            { id: 'hr', label: 'Heart rate', unit: 'bpm', input_type: 'number' },
            { id: 'spo2', label: 'SpO2', unit: '%', input_type: 'number' },
            { id: 'temp', label: 'Temperature', unit: '°C', input_type: 'number' },
          ],
        },
        {
          id: 'blk_motivo',
          type: 'clinical_notes',
          label: 'Chief complaint',
          required: true,
          content: '',
        },
        {
          id: 'blk_eval',
          type: 'clinical_notes',
          label: 'Assessment',
          required: false,
          content: '',
        },
        {
          id: 'blk_triage',
          type: 'steps',
          title: 'Triage',
          steps: [
            { id: 'stp_abc', order: 1, title: 'Assess ABC (airway, breathing, circulation)' },
            { id: 'stp_neuro', order: 2, title: 'Neurological status (AVPU)' },
            { id: 'stp_plan', order: 3, title: 'Treatment plan' },
          ],
        },
        {
          id: 'blk_plan',
          type: 'clinical_notes',
          label: 'Plan',
          required: false,
          content: '',
        },
      ],
    },
  },
  {
    key: 'seguimiento_cronico',
    name: 'Chronic Follow-up',
    suggestedSpecialty: 'general',
    intendedUse: 'Follow-up for patients with chronic conditions',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'general',
        intended_use: 'Follow-up for patients with chronic conditions',
      },
      blocks: [
        {
          id: 'blk_vitals',
          type: 'vitals',
          fields: [
            { id: 'bp', label: 'Blood pressure', unit: 'mmHg', input_type: 'text' },
            { id: 'hr', label: 'Heart rate', unit: 'bpm', input_type: 'number' },
            { id: 'weight', label: 'Weight', unit: 'kg', input_type: 'number' },
          ],
        },
        {
          id: 'blk_evolucion',
          type: 'clinical_notes',
          label: 'Progress notes',
          required: false,
          content: '',
        },
        {
          id: 'blk_adherencia',
          type: 'checklist',
          title: 'Adherence',
          items: [
            { id: 'chk_meds', text: 'Taking medications as prescribed' },
            { id: 'chk_dieta', text: 'Following recommended diet' },
            { id: 'chk_ejercicio', text: 'Regular physical activity' },
          ],
        },
      ],
    },
  },
  {
    key: 'procedimiento',
    name: 'Clinical Procedure',
    suggestedSpecialty: 'general',
    intendedUse: 'Routine clinical procedures with defined workflow',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'general',
        intended_use: 'Routine clinical procedures with defined workflow',
      },
      blocks: [
        {
          id: 'blk_pasos',
          type: 'steps',
          title: 'Procedure steps',
          steps: [
            { id: 'stp_prep', order: 1, title: 'Patient and materials preparation' },
            { id: 'stp_proc', order: 2, title: 'Procedure execution' },
            { id: 'stp_post', order: 3, title: 'Post-procedure care' },
          ],
        },
        {
          id: 'blk_notas',
          type: 'clinical_notes',
          label: 'Procedure notes',
          required: false,
          content: '',
        },
      ],
    },
  },
  {
    key: 'orden_estudios',
    name: 'Study Order',
    suggestedSpecialty: 'general',
    intendedUse: 'Laboratory and imaging study requests',
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'general',
        intended_use: 'Laboratory and imaging study requests',
      },
      blocks: [
        {
          id: 'blk_lab',
          type: 'lab_order',
          title: 'Laboratory studies',
          orders: [
            {
              id: 'lab_hemograma',
              test_name: 'Complete blood count',
              indication: 'General hematological evaluation',
              urgency: 'routine',
              fasting_required: false,
              sample_type: 'blood',
            },
          ],
        },
        {
          id: 'blk_imaging',
          type: 'imaging_order',
          title: 'Imaging studies',
          orders: [
            {
              id: 'img_rx',
              study_type: 'Chest X-ray',
              indication: 'Pulmonary evaluation',
              urgency: 'routine',
              contrast: false,
              fasting_required: false,
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
