import { PrismaClient } from '../generated/index.js'

const prisma = new PrismaClient()

// ─────────────────────────────────────────────────────────────────────────────
// Starter template schemas (Spanish / es)
// Source: specs/starter-templates.md
// ─────────────────────────────────────────────────────────────────────────────

const STARTER_TEMPLATES = [
  {
    key: 'emergency-intervention',
    name: 'Intervención de Emergencia',
    description: 'Para intervenciones agudas y urgentes (anafilaxia, ACV, paro cardíaco, etc.).',
    suggestedSpecialty: 'emergency_medicine',
    typeName: 'Emergencia',
    schema: {
      version: '1.0',
      metadata: { suggested_specialty: 'emergency_medicine', intended_use: 'Intervenciones agudas urgentes' },
      blocks: [
        {
          id: 'sec_indications', type: 'section', title: 'Indicaciones', required: true,
          description: 'Cuándo activar este protocolo',
          placeholder_blocks: [{ type: 'text', placeholder: 'Criterios clínicos que activan este protocolo (signos, síntomas, umbrales).' }],
        },
        {
          id: 'sec_contraindications', type: 'section', title: 'Contraindicaciones', required: false,
          description: 'Cuándo NO usar este protocolo',
          placeholder_blocks: [{ type: 'alert', severity: 'danger', placeholder: 'Contraindicaciones absolutas o relativas.' }],
        },
        {
          id: 'sec_assessment', type: 'section', title: 'Evaluación Inicial', required: true,
          description: 'Primeras acciones al encontrar al paciente',
          placeholder_blocks: [{ type: 'checklist', placeholder: 'Encuesta primaria (ABC, signos vitales, conciencia).' }],
        },
        {
          id: 'sec_intervention', type: 'section', title: 'Intervención', required: true,
          description: 'Pasos del tratamiento',
          placeholder_blocks: [
            { type: 'alert', severity: 'warning', placeholder: 'Advertencias críticas de tiempo.' },
            { id: 'blk_int_meds', type: 'dosage_table', required: true, placeholder: 'Medicamentos de primera línea.' },
            { type: 'steps', placeholder: 'Acciones de cuidado de soporte.' },
          ],
        },
        {
          id: 'sec_monitoring', type: 'section', title: 'Monitoreo Post-intervención', required: false,
          description: 'Qué vigilar y por cuánto tiempo',
          placeholder_blocks: [{ type: 'text', placeholder: 'Parámetros, frecuencia y duración del monitoreo.' }],
        },
        {
          id: 'sec_escalation', type: 'section', title: 'Criterios de Escalada', required: false,
          description: 'Cuándo transferir, consultar o escalar',
          placeholder_blocks: [{ type: 'decision', placeholder: 'Punto de decisión para escalada.' }],
        },
        {
          id: 'sec_references', type: 'section', title: 'Referencias', required: false,
          placeholder_blocks: [{ type: 'text', placeholder: 'Base de evidencia, guías, literatura.' }],
        },
      ],
    },
  },
  {
    key: 'clinical-procedure',
    name: 'Procedimiento Clínico',
    description: 'Para procedimientos de rutina con un flujo definido (cirugías menores, infiltraciones, biopsias, etc.).',
    suggestedSpecialty: 'general',
    typeName: 'Procedimiento',
    schema: {
      version: '1.0',
      metadata: { suggested_specialty: 'general', intended_use: 'Procedimientos clínicos de rutina con flujo definido' },
      blocks: [
        {
          id: 'sec_indications', type: 'section', title: 'Indicaciones', required: false,
          placeholder_blocks: [{ type: 'text', placeholder: 'Cuándo se realiza este procedimiento.' }],
        },
        {
          id: 'sec_preparation', type: 'section', title: 'Preparación', required: false,
          description: 'Configuración pre-procedimiento',
          placeholder_blocks: [
            { type: 'checklist', placeholder: 'Materiales, equipos y preparación del paciente.' },
            { type: 'alert', severity: 'info', placeholder: 'Consentimiento, alergias y anticoagulación.' },
          ],
        },
        {
          id: 'sec_steps', type: 'section', title: 'Pasos del Procedimiento', required: true,
          description: 'Técnica paso a paso',
          placeholder_blocks: [{ type: 'steps', placeholder: 'Pasos numerados del procedimiento.' }],
        },
        {
          id: 'sec_complications', type: 'section', title: 'Complicaciones Posibles', required: false,
          placeholder_blocks: [
            { type: 'text', placeholder: 'Eventos adversos esperados y raros.' },
            { type: 'alert', severity: 'warning', placeholder: 'Signos que requieren atención inmediata.' },
          ],
        },
        {
          id: 'sec_post', type: 'section', title: 'Indicaciones Post-procedimiento', required: true,
          description: 'Cuidado después del procedimiento',
          placeholder_blocks: [{ type: 'checklist', placeholder: 'Instrucciones al paciente y cuidado de seguimiento.' }],
        },
      ],
    },
  },
  {
    key: 'pharmacological-reference',
    name: 'Referencia Farmacológica',
    description: 'Para protocolos centrados en dosificación de medicamentos (insulina, antibióticos, dosis pediátricas, etc.).',
    suggestedSpecialty: 'pharmacology',
    typeName: 'Medicación',
    schema: {
      version: '1.0',
      metadata: { suggested_specialty: 'pharmacology', intended_use: 'Referencias de dosificación de medicamentos' },
      blocks: [
        {
          id: 'sec_indications', type: 'section', title: 'Indicaciones', required: false,
          placeholder_blocks: [{ type: 'text', placeholder: 'Situaciones clínicas que aborda este régimen.' }],
        },
        {
          id: 'sec_warnings', type: 'section', title: 'Advertencias y Contraindicaciones', required: false,
          placeholder_blocks: [
            { type: 'alert', severity: 'danger', placeholder: 'Contraindicaciones absolutas.' },
            { type: 'alert', severity: 'warning', placeholder: 'Contraindicaciones relativas y precauciones.' },
          ],
        },
        {
          id: 'sec_dosing', type: 'section', title: 'Dosificación', required: true,
          description: 'Régimen de medicamentos',
          placeholder_blocks: [
            { id: 'blk_dose_table', type: 'dosage_table', required: true, placeholder: 'Medicamentos, dosis, vías, frecuencias y notas.' },
            { type: 'text', placeholder: 'Ajustes de dosis para insuficiencia renal o hepática.' },
          ],
        },
        {
          id: 'sec_monitoring', type: 'section', title: 'Monitoreo', required: false,
          placeholder_blocks: [{ type: 'text', placeholder: 'Laboratorios, signos vitales o síntomas a vigilar y frecuencia.' }],
        },
        {
          id: 'sec_decision', type: 'section', title: 'Reglas de Ajuste de Dosis', required: false,
          placeholder_blocks: [{ type: 'decision', placeholder: 'Cuándo ajustar, suspender o escalar la dosis.' }],
        },
        {
          id: 'sec_adverse', type: 'section', title: 'Efectos Adversos', required: false,
          placeholder_blocks: [{ type: 'text', placeholder: 'Efectos adversos comunes y graves a notificar.' }],
        },
      ],
    },
  },
  {
    key: 'diagnostic-algorithm',
    name: 'Algoritmo Diagnóstico',
    description: 'Para rutas de decisión diagnóstica (dolor torácico, síncope, fiebre pediátrica, etc.).',
    suggestedSpecialty: 'general',
    typeName: 'Diagnóstico',
    schema: {
      version: '1.0',
      metadata: { suggested_specialty: 'general', intended_use: 'Rutas de decisión diagnóstica' },
      blocks: [
        {
          id: 'sec_presentation', type: 'section', title: 'Motivo de Consulta', required: true,
          description: 'Qué activa este algoritmo',
          placeholder_blocks: [{ type: 'text', placeholder: 'Síntoma principal o escenario de presentación.' }],
        },
        {
          id: 'sec_redflags', type: 'section', title: 'Signos de Alarma', required: false,
          placeholder_blocks: [{ type: 'checklist', placeholder: 'Características de alto riesgo que requieren acción inmediata.' }],
        },
        {
          id: 'sec_history', type: 'section', title: 'Historia y Examen Clave', required: false,
          placeholder_blocks: [{ type: 'checklist', placeholder: 'Preguntas de historia dirigida y hallazgos del examen.' }],
        },
        {
          id: 'sec_pathway', type: 'section', title: 'Ruta de Decisión', required: true,
          description: 'Lógica de decisión paso a paso',
          placeholder_blocks: [
            { type: 'decision', placeholder: 'Primer punto de ramificación.' },
            { type: 'decision', placeholder: 'Segundo punto de ramificación.' },
          ],
        },
        {
          id: 'sec_workup', type: 'section', title: 'Estudios Recomendados', required: false,
          placeholder_blocks: [{ type: 'text', placeholder: 'Pruebas, imágenes, derivaciones por cada ruta diagnóstica.' }],
        },
        {
          id: 'sec_differential', type: 'section', title: 'Diagnóstico Diferencial', required: false,
          placeholder_blocks: [{ type: 'text', placeholder: 'Diagnósticos alternativos más comunes y más peligrosos.' }],
        },
      ],
    },
  },
  {
    key: 'physiotherapy-session',
    name: 'Sesión de Fisioterapia',
    description: 'Para protocolos de rehabilitación con evaluación, plan de tratamiento y reglas de progresión.',
    suggestedSpecialty: 'physiotherapy',
    typeName: 'Fisioterapia',
    schema: {
      version: '1.0',
      metadata: { suggested_specialty: 'physiotherapy', intended_use: 'Estructura de sesión de rehabilitación con reglas de progresión' },
      blocks: [
        {
          id: 'sec_goals', type: 'section', title: 'Objetivos del Tratamiento', required: false,
          placeholder_blocks: [{ type: 'text', placeholder: 'Metas a corto y largo plazo para esta fase de rehabilitación.' }],
        },
        {
          id: 'sec_assessment', type: 'section', title: 'Evaluación', required: true,
          description: 'Evaluación al inicio de cada sesión',
          placeholder_blocks: [
            { type: 'checklist', placeholder: 'Dolor, ROM, fuerza, pruebas funcionales a realizar.' },
            { type: 'text', placeholder: 'Medidas de resultado a registrar a lo largo del tiempo.' },
          ],
        },
        {
          id: 'sec_progression', type: 'section', title: 'Criterios de Progresión', required: false,
          description: 'Cuándo avanzar al paciente',
          placeholder_blocks: [{ type: 'decision', placeholder: 'Criterios para progresar a la siguiente fase.' }],
        },
        {
          id: 'sec_plan', type: 'section', title: 'Plan de Tratamiento', required: true,
          description: 'Intervenciones para esta fase',
          placeholder_blocks: [{ type: 'steps', placeholder: 'Ejercicios, técnicas o modalidades (con repeticiones/series/duración).' }],
        },
        {
          id: 'sec_home', type: 'section', title: 'Programa de Ejercicios en Casa', required: false,
          placeholder_blocks: [{ type: 'steps', placeholder: 'Ejercicios que el paciente realiza en casa entre sesiones.' }],
        },
        {
          id: 'sec_precautions', type: 'section', title: 'Precauciones', required: false,
          placeholder_blocks: [{ type: 'text', placeholder: 'Movimientos, cargas o actividades a evitar en esta fase.' }],
        },
      ],
    },
  },
]

const DEV_TENANT_ID = '00000000-0000-0000-0000-000000000001'
const DEV_USER_ID = '00000000-0000-0000-0000-000000000002'

async function seedDevAccount() {
  await prisma.tenant.upsert({
    where: { id: DEV_TENANT_ID },
    update: { seededAt: new Date() },
    create: {
      id: DEV_TENANT_ID,
      name: 'Development Clinic',
      type: 'solo',
      plan: 'free',
      seededAt: new Date(),
    },
  })

  await prisma.user.upsert({
    where: { id: DEV_USER_ID },
    update: {},
    create: {
      id: DEV_USER_ID,
      tenantId: DEV_TENANT_ID,
      firebaseUid: 'dev-firebase-uid',
      email: 'dev@example.com',
      fullName: 'Dev Doctor',
      role: 'owner',
      specialty: 'Cardiología',
    },
  })

  console.log('✓ Seeded developer account')
}

async function seedTenantTemplatesAndTypes(tenantId: string, createdBy: string | null) {
  // Delete existing seeded templates and types for idempotency
  const existingTypes = await prisma.protocolType.findMany({
    where: { tenantId, isSeeded: true, deletedAt: null },
  })
  const existingTemplates = await prisma.protocolTemplate.findMany({
    where: { tenantId, isSeeded: true, deletedAt: null },
  })

  if (existingTypes.length > 0 || existingTemplates.length > 0) {
    await prisma.protocolType.deleteMany({ where: { tenantId, isSeeded: true } })
    await prisma.protocolTemplate.deleteMany({ where: { tenantId, isSeeded: true } })
  }

  for (const t of STARTER_TEMPLATES) {
    const template = await prisma.protocolTemplate.create({
      data: {
        tenantId,
        name: t.name,
        description: t.description,
        suggestedSpecialty: t.suggestedSpecialty,
        schema: t.schema,
        isSeeded: true,
        createdBy,
      },
    })

    await prisma.protocolType.create({
      data: {
        tenantId,
        templateId: template.id,
        name: t.typeName,
        isSeeded: true,
      },
    })
  }

  console.log(`✓ Seeded ${STARTER_TEMPLATES.length} templates + types for tenant ${tenantId}`)
}

async function main() {
  console.log('Seeding database…')
  await seedDevAccount()
  await seedTenantTemplatesAndTypes(DEV_TENANT_ID, DEV_USER_ID)
  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
