import { PrismaClient } from '../packages/db/generated/index.js'

const prisma = new PrismaClient()

const templates = [
  {
    templateKey: 'emergency-intervention',
    locale: 'es',
    name: 'Intervención de Emergencia',
    description: 'Protocolos de intervenciones agudas y dependientes del tiempo',
    suggestedSpecialty: 'emergency_medicine',
    category: 'Emergency',
    icon: 'ambulance',
    schema: {
      version: '1.0',
      metadata: { suggested_specialty: 'emergency_medicine', intended_use: 'Time-sensitive acute interventions' },
      blocks: [
        {
          id: 'sec_indications', type: 'section', title: 'Indications', required: true,
          placeholder_blocks: [{ type: 'text', placeholder: 'Clinical criteria that trigger this protocol...' }]
        },
        {
          id: 'sec_contraindications', type: 'section', title: 'Contraindications', required: false,
          placeholder_blocks: [{ type: 'alert', severity: 'danger', placeholder: 'Absolute/Relative stats' }]
        },
        {
          id: 'sec_assessment', type: 'section', title: 'Initial Assessment', required: true,
          placeholder_blocks: [{ type: 'checklist', placeholder: 'Primary survey (ABC, vitals).' }]
        },
        {
          id: 'sec_intervention', type: 'section', title: 'Intervention', required: true,
          placeholder_blocks: [
            { id: 'blk_int_meds', type: 'dosage_table', required: true, placeholder: 'First-line medications.' },
            { type: 'steps', placeholder: 'Supportive care actions.' }
          ]
        }
      ]
    }
  },
  {
    templateKey: 'clinical-procedure',
    locale: 'es',
    name: 'Procedimiento Clínico',
    description: 'Procedimientos de rutina con flujo de trabajo definido',
    suggestedSpecialty: 'general',
    category: 'Procedure',
    icon: 'syringe',
    schema: {
      version: '1.0',
      metadata: { suggested_specialty: 'general', intended_use: 'Routine clinical procedures' },
      blocks: [
        {
          id: 'sec_preparation', type: 'section', title: 'Preparation', required: false,
          placeholder_blocks: [{ type: 'checklist', placeholder: 'Materials and patient prep.' }]
        },
        {
          id: 'sec_steps', type: 'section', title: 'Procedure Steps', required: true,
          placeholder_blocks: [{ type: 'steps', placeholder: 'Numbered steps of the procedure.' }]
        },
        {
          id: 'sec_post', type: 'section', title: 'Post-procedure Instructions', required: true,
          placeholder_blocks: [{ type: 'checklist', placeholder: 'Patient instructions.' }]
        }
      ]
    }
  },
  {
    templateKey: 'pharmacological-reference',
    locale: 'es',
    name: 'Referencia Farmacológica',
    description: 'Tablas de dosificación y referencia de medicamentos',
    suggestedSpecialty: 'pharmacology',
    category: 'Reference',
    icon: 'pill',
    schema: {
      version: '1.0',
      metadata: { suggested_specialty: 'pharmacology', intended_use: 'Medication dosing references' },
      blocks: [
        {
          id: 'sec_dosing', type: 'section', title: 'Dosing', required: true,
          placeholder_blocks: [
            { id: 'blk_dose_table', type: 'dosage_table', required: true, placeholder: 'Drugs, doses, routes...' }
          ]
        }
      ]
    }
  },
  {
    templateKey: 'diagnostic-algorithm',
    locale: 'es',
    name: 'Algoritmo Diagnóstico',
    description: 'Vías de decisión diagnóstica paso a paso',
    suggestedSpecialty: 'general',
    category: 'Algorithm',
    icon: 'tree-structure',
    schema: {
      version: '1.0',
      metadata: { suggested_specialty: 'general', intended_use: 'Diagnostic decision pathways' },
      blocks: [
        {
          id: 'sec_pathway', type: 'section', title: 'Decision Pathway', required: true,
          placeholder_blocks: [{ type: 'decision', placeholder: 'First branch point.' }]
        }
      ]
    }
  },
  {
    templateKey: 'physiotherapy-session',
    locale: 'es',
    name: 'Sesión de Fisioterapia',
    description: 'Estructura de rehabilitación y metas',
    suggestedSpecialty: 'physiotherapy',
    category: 'Therapy',
    icon: 'activity',
    schema: {
      version: '1.0',
      metadata: { suggested_specialty: 'physiotherapy', intended_use: 'Rehabilitation session structure' },
      blocks: [
        {
          id: 'sec_assessment', type: 'section', title: 'Assessment', required: true,
          placeholder_blocks: [{ type: 'checklist', placeholder: 'Pain, ROM, strength tests.' }]
        },
        {
          id: 'sec_plan', type: 'section', title: 'Treatment Plan', required: true,
          placeholder_blocks: [{ type: 'steps', placeholder: 'Exercises, techniques, or modalities.' }]
        }
      ]
    }
  }
]

async function main() {
  console.log('Seeding System Protocol Templates...')
  
  for (const template of templates) {
    const { templateKey, locale, ...rest } = template
    
    await prisma.protocolTemplate.upsert({
      where: {
        templateKey_locale: {
          templateKey,
          locale
        }
      },
      update: {
        ...rest,
        // Using Prisma JsonValue requires JSON stringification or passing as object if TS allows it. 
        // We'll pass it strictly casted to bypass deep type mismatch on unknown JS objects.
        schema: rest.schema as any, 
      },
      create: {
        templateKey,
        locale,
        isSystem: true,
        tenantId: null,
        ...rest,
        schema: rest.schema as any,
      }
    })
    console.log(`✅ Upserted ${templateKey} (${locale})`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
