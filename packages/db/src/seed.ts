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
    schema: {
      version: '1.0',
      metadata: {
        suggested_specialty: 'emergency_medicine',
        intended_use: 'Intervenciones agudas urgentes',
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
          title: 'Evaluación Inicial',
          required: true,
          description: 'Primeras acciones al encontrar al paciente',
          placeholder_blocks: [
            {
              type: 'checklist',
              placeholder: 'Encuesta primaria (ABC, signos vitales, conciencia).',
            },
          ],
        },
        {
          id: 'sec_intervention',
          type: 'section',
          title: 'Intervención',
          required: true,
          description: 'Pasos del tratamiento',
          placeholder_blocks: [
            { type: 'alert', severity: 'warning', placeholder: 'Advertencias críticas de tiempo.' },
            {
              id: 'blk_int_meds',
              type: 'dosage_table',
              required: true,
              placeholder: 'Medicamentos de primera línea.',
            },
            { type: 'steps', placeholder: 'Acciones de cuidado de soporte.' },
          ],
        },
        {
          id: 'sec_monitoring',
          type: 'section',
          title: 'Monitoreo Post-intervención',
          required: false,
          description: 'Qué vigilar y por cuánto tiempo',
          placeholder_blocks: [
            { type: 'text', placeholder: 'Parámetros, frecuencia y duración del monitoreo.' },
          ],
        },
        {
          id: 'sec_escalation',
          type: 'section',
          title: 'Criterios de Escalada',
          required: false,
          description: 'Cuándo transferir, consultar o escalar',
          placeholder_blocks: [
            { type: 'decision', placeholder: 'Punto de decisión para escalada.' },
          ],
        },
        {
          id: 'sec_references',
          type: 'section',
          title: 'Referencias',
          required: false,
          placeholder_blocks: [
            { type: 'text', placeholder: 'Base de evidencia, guías, literatura.' },
          ],
        },
      ],
    },
  },
  {
    key: 'diagnostic-algorithm',
    name: 'Algoritmo Diagnóstico',
    description:
      'Para rutas de decisión diagnóstica (dolor torácico, síncope, fiebre pediátrica, etc.).',
    schema: {
      version: '1.0',
      metadata: { suggested_specialty: 'general', intended_use: 'Rutas de decisión diagnóstica' },
      blocks: [
        {
          id: 'sec_presentation',
          type: 'section',
          title: 'Motivo de Consulta',
          required: true,
          description: 'Qué activa este algoritmo',
          placeholder_blocks: [
            { type: 'text', placeholder: 'Síntoma principal o escenario de presentación.' },
          ],
        },
        {
          id: 'sec_redflags',
          type: 'section',
          title: 'Signos de Alarma',
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
          title: 'Historia y Examen Clave',
          required: false,
          placeholder_blocks: [
            {
              type: 'checklist',
              placeholder: 'Preguntas de historia dirigida y hallazgos del examen.',
            },
          ],
        },
        {
          id: 'sec_pathway',
          type: 'section',
          title: 'Ruta de Decisión',
          required: true,
          description: 'Lógica de decisión paso a paso',
          placeholder_blocks: [
            { type: 'decision', placeholder: 'Primer punto de ramificación.' },
            { type: 'decision', placeholder: 'Segundo punto de ramificación.' },
          ],
        },
        {
          id: 'sec_workup',
          type: 'section',
          title: 'Estudios Recomendados',
          required: false,
          placeholder_blocks: [
            {
              type: 'text',
              placeholder: 'Pruebas, imágenes, derivaciones por cada ruta diagnóstica.',
            },
          ],
        },
        {
          id: 'sec_differential',
          type: 'section',
          title: 'Diagnóstico Diferencial',
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
]

// ─────────────────────────────────────────────────────────────────────────────
// Dev accounts — Firebase UIDs from the dev project's Authentication console.
// Each account gets its own tenant, locations, patients, and appointments.
// ─────────────────────────────────────────────────────────────────────────────

interface DevAccount {
  index: number
  externalUid: string
  email: string
  fullName: string
  specialty: string
  licenseNumber: string
  practiceName: string
  locations: Array<{
    name: string
    address: string
    city: string
    phone: string
    isOwned: boolean
    commissionPercent: number
    consultationFee: number
  }>
  patients: Array<{
    documentType: 'cedula' | 'passport' | 'rnc'
    documentNumber: string
    firstName: string
    lastName: string
    dateOfBirth: string // YYYY-MM-DD
    sex: 'male' | 'female'
    phone: string
    email?: string
    bloodType?: string
    allergies?: string[]
    chronicConditions?: string[]
  }>
}

const DEV_ACCOUNTS: DevAccount[] = [
  {
    index: 1,
    externalUid: 'j6RK1lLW6AY8OvoygMQvejQLwXj1',
    email: 'test@test.com',
    fullName: 'Dr. Carlos Feliz',
    specialty: 'Cardiología',
    licenseNumber: 'CMD-12345',
    practiceName: 'Consultorio Dr. Carlos Feliz',
    locations: [
      {
        name: 'Centro Médico Real',
        address: 'Av. Abraham Lincoln 304, Piantini',
        city: 'Santo Domingo',
        phone: '809-555-0101',
        isOwned: false,
        commissionPercent: 30,
        consultationFee: 2500,
      },
      {
        name: 'Consultorio Privado',
        address: 'Av. Anacaona 17, Mirador Sur',
        city: 'Santo Domingo',
        phone: '809-555-0102',
        isOwned: true,
        commissionPercent: 0,
        consultationFee: 3500,
      },
    ],
    patients: [
      {
        documentType: 'cedula',
        documentNumber: '001-1234567-8',
        firstName: 'Ana María',
        lastName: 'Reyes',
        dateOfBirth: '1982-03-14',
        sex: 'female',
        phone: '809-555-1001',
        email: 'ana.reyes@example.com',
        bloodType: 'O+',
        allergies: ['Penicilina'],
        chronicConditions: ['Hipertensión'],
      },
      {
        documentType: 'cedula',
        documentNumber: '001-2345678-9',
        firstName: 'José Luis',
        lastName: 'Martínez',
        dateOfBirth: '1965-11-02',
        sex: 'male',
        phone: '809-555-1002',
        bloodType: 'A+',
        chronicConditions: ['Diabetes tipo 2', 'Dislipidemia'],
      },
      {
        documentType: 'cedula',
        documentNumber: '402-3456789-0',
        firstName: 'Carmen',
        lastName: 'Pérez',
        dateOfBirth: '1978-07-22',
        sex: 'female',
        phone: '809-555-1003',
      },
      {
        documentType: 'passport',
        documentNumber: 'P12345678',
        firstName: 'Roberto',
        lastName: 'Castro',
        dateOfBirth: '1990-01-08',
        sex: 'male',
        phone: '809-555-1004',
      },
    ],
  },
  {
    index: 2,
    externalUid: 'qXpawgupDOTZolTIHNqtD1FvDjf1',
    email: 'dev@example.com',
    fullName: 'Dra. María Pérez',
    specialty: 'Pediatría',
    licenseNumber: 'CMD-23456',
    practiceName: 'Pediatría Dra. María Pérez',
    locations: [
      {
        name: 'Hospital Infantil Robert Reid',
        address: 'Av. Independencia, La Feria',
        city: 'Santo Domingo',
        phone: '809-555-0201',
        isOwned: false,
        commissionPercent: 25,
        consultationFee: 1800,
      },
      {
        name: 'Centro Pediátrico Naco',
        address: 'C/ Erick Leonard Ekman 13, Naco',
        city: 'Santo Domingo',
        phone: '809-555-0202',
        isOwned: false,
        commissionPercent: 35,
        consultationFee: 2200,
      },
    ],
    patients: [
      {
        documentType: 'cedula',
        documentNumber: '001-3456789-1',
        firstName: 'Sofía',
        lastName: 'Rodríguez',
        dateOfBirth: '2018-05-10',
        sex: 'female',
        phone: '809-555-1101',
        bloodType: 'B+',
        allergies: ['Maní'],
      },
      {
        documentType: 'cedula',
        documentNumber: '001-4567890-2',
        firstName: 'Mateo',
        lastName: 'González',
        dateOfBirth: '2020-09-18',
        sex: 'male',
        phone: '809-555-1102',
      },
      {
        documentType: 'cedula',
        documentNumber: '001-5678901-3',
        firstName: 'Valentina',
        lastName: 'Hernández',
        dateOfBirth: '2015-12-03',
        sex: 'female',
        phone: '809-555-1103',
        chronicConditions: ['Asma'],
      },
      {
        documentType: 'cedula',
        documentNumber: '001-6789012-4',
        firstName: 'Diego',
        lastName: 'Mejía',
        dateOfBirth: '2019-02-25',
        sex: 'male',
        phone: '809-555-1104',
      },
    ],
  },
  {
    index: 3,
    externalUid: '6G7FMPoWWtRhTpCrpqCDwDBjcAB3',
    email: 'test@rezeta.com',
    fullName: 'Dr. Juan García',
    specialty: 'Fisioterapia',
    licenseNumber: 'CMD-34567',
    practiceName: 'Rehabilitación Dr. Juan García',
    locations: [
      {
        name: 'Centro de Rehabilitación Bella Vista',
        address: 'Av. Sarasota 27, Bella Vista',
        city: 'Santo Domingo',
        phone: '809-555-0301',
        isOwned: false,
        commissionPercent: 40,
        consultationFee: 1500,
      },
      {
        name: 'Clínica Deportiva Santiago',
        address: 'C/ del Sol 86, Centro de la Ciudad',
        city: 'Santiago',
        phone: '809-555-0302',
        isOwned: true,
        commissionPercent: 0,
        consultationFee: 2000,
      },
    ],
    patients: [
      {
        documentType: 'cedula',
        documentNumber: '031-7890123-5',
        firstName: 'Pedro',
        lastName: 'Almonte',
        dateOfBirth: '1988-04-12',
        sex: 'male',
        phone: '829-555-1201',
        chronicConditions: ['Lesión de LCA — post quirúrgico'],
      },
      {
        documentType: 'cedula',
        documentNumber: '031-8901234-6',
        firstName: 'Lucía',
        lastName: 'Vásquez',
        dateOfBirth: '1972-08-30',
        sex: 'female',
        phone: '829-555-1202',
        chronicConditions: ['Lumbalgia crónica'],
      },
      {
        documentType: 'cedula',
        documentNumber: '031-9012345-7',
        firstName: 'Andrés',
        lastName: 'Cruz',
        dateOfBirth: '1995-06-15',
        sex: 'male',
        phone: '829-555-1203',
      },
      {
        documentType: 'cedula',
        documentNumber: '031-0123456-8',
        firstName: 'Patricia',
        lastName: 'Núñez',
        dateOfBirth: '1980-10-21',
        sex: 'female',
        phone: '829-555-1204',
        chronicConditions: ['Hombro congelado bilateral'],
      },
    ],
  },
]

function uuid(prefix: string, accountIdx: number, rowIdx: number): string {
  // Deterministic UUIDs so repeated runs upsert cleanly. Format 8-4-4-4-12.
  const a = String(accountIdx).padStart(2, '0')
  const r = String(rowIdx).padStart(4, '0')
  return `00000000-0000-0000-${prefix}-${a}000000${r}`
}

const tenantId = (i: number): string => uuid('a000', i, 0)
const userId = (i: number): string => uuid('a001', i, 0)
const locationId = (i: number, j: number): string => uuid('a002', i, j)
const patientId = (i: number, j: number): string => uuid('a003', i, j)
const appointmentId = (i: number, j: number): string => uuid('a004', i, j)

async function seedDevAccount(acc: DevAccount): Promise<void> {
  const tId = tenantId(acc.index)
  const uId = userId(acc.index)

  await prisma.tenant.upsert({
    where: { id: tId },
    update: { seededAt: new Date(), name: acc.practiceName },
    create: {
      id: tId,
      name: acc.practiceName,
      type: 'solo',
      plan: 'free',
      country: 'DO',
      language: 'es',
      timezone: 'America/Santo_Domingo',
      seededAt: new Date(),
    },
  })

  await prisma.user.upsert({
    where: { id: uId },
    update: {
      externalUid: acc.externalUid,
      email: acc.email,
      fullName: acc.fullName,
      specialty: acc.specialty,
      licenseNumber: acc.licenseNumber,
    },
    create: {
      id: uId,
      tenantId: tId,
      externalUid: acc.externalUid,
      email: acc.email,
      fullName: acc.fullName,
      specialty: acc.specialty,
      licenseNumber: acc.licenseNumber,
      role: 'owner',
    },
  })

  console.log(`✓ Tenant + user: ${acc.fullName} (uid=${acc.externalUid})`)

  // Locations + doctor-location links
  for (let j = 0; j < acc.locations.length; j++) {
    const loc = acc.locations[j]!
    const lId = locationId(acc.index, j + 1)
    await prisma.location.upsert({
      where: { id: lId },
      update: {
        name: loc.name,
        address: loc.address,
        city: loc.city,
        phone: loc.phone,
        isOwned: loc.isOwned,
        commissionPercent: loc.commissionPercent,
      },
      create: {
        id: lId,
        tenantId: tId,
        name: loc.name,
        address: loc.address,
        city: loc.city,
        phone: loc.phone,
        isOwned: loc.isOwned,
        commissionPercent: loc.commissionPercent,
      },
    })
    await prisma.doctorLocation.upsert({
      where: { userId_locationId: { userId: uId, locationId: lId } },
      update: { consultationFee: loc.consultationFee, commissionPct: loc.commissionPercent },
      create: {
        userId: uId,
        locationId: lId,
        consultationFee: loc.consultationFee,
        commissionPct: loc.commissionPercent,
      },
    })
  }
  console.log(`  ${acc.locations.length} locations linked`)

  // Patients
  for (let j = 0; j < acc.patients.length; j++) {
    const p = acc.patients[j]!
    const pId = patientId(acc.index, j + 1)
    await prisma.patient.upsert({
      where: { id: pId },
      update: {
        firstName: p.firstName,
        lastName: p.lastName,
        documentType: p.documentType,
        documentNumber: p.documentNumber,
        dateOfBirth: new Date(p.dateOfBirth),
        sex: p.sex,
        phone: p.phone,
        email: p.email ?? null,
        bloodType: p.bloodType ?? null,
        allergies: p.allergies ?? [],
        chronicConditions: p.chronicConditions ?? [],
      },
      create: {
        id: pId,
        tenantId: tId,
        ownerUserId: uId,
        firstName: p.firstName,
        lastName: p.lastName,
        documentType: p.documentType,
        documentNumber: p.documentNumber,
        dateOfBirth: new Date(p.dateOfBirth),
        sex: p.sex,
        phone: p.phone,
        email: p.email ?? null,
        bloodType: p.bloodType ?? null,
        allergies: p.allergies ?? [],
        chronicConditions: p.chronicConditions ?? [],
      },
    })
  }
  console.log(`  ${acc.patients.length} patients`)

  // Sample appointments — 2 upcoming (tomorrow, day-after) at primary location
  const primaryLoc = locationId(acc.index, 1)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  tomorrow.setHours(9, 0, 0, 0)
  const dayAfter = new Date()
  dayAfter.setDate(dayAfter.getDate() + 2)
  dayAfter.setHours(14, 30, 0, 0)

  const appointments = [
    {
      patientIdx: 1,
      startsAt: tomorrow,
      endsAt: new Date(tomorrow.getTime() + 30 * 60 * 1000),
      reason: 'Consulta de seguimiento',
    },
    {
      patientIdx: 2,
      startsAt: dayAfter,
      endsAt: new Date(dayAfter.getTime() + 30 * 60 * 1000),
      reason: 'Primera consulta',
    },
  ]

  for (let j = 0; j < appointments.length; j++) {
    const a = appointments[j]!
    const aId = appointmentId(acc.index, j + 1)
    await prisma.appointment.upsert({
      where: { id: aId },
      update: {
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        reason: a.reason,
        status: 'scheduled',
      },
      create: {
        id: aId,
        tenantId: tId,
        patientId: patientId(acc.index, a.patientIdx),
        userId: uId,
        locationId: primaryLoc,
        startsAt: a.startsAt,
        endsAt: a.endsAt,
        status: 'scheduled',
        reason: a.reason,
      },
    })
  }
  console.log(`  ${appointments.length} upcoming appointments`)

  await seedTenantTemplates(tId, uId)
}

async function seedTenantTemplates(tenantId: string, createdBy: string | null) {
  // Delete existing seeded templates and categories for idempotency
  await prisma.protocolTemplate.deleteMany({ where: { tenantId, isSeeded: true } })
  await prisma.protocolCategory.deleteMany({ where: { tenantId, isSeeded: true } })

  // Seed the 2 default categories first so templates can link to them.
  const emergenciasCategory = await prisma.protocolCategory.create({
    data: { tenantId, name: 'Emergencias', color: '#EF4444', isSeeded: true },
  })
  const diagnosticoCategory = await prisma.protocolCategory.create({
    data: { tenantId, name: 'Diagnóstico', color: '#3B82F6', isSeeded: true },
  })

  const categoryIdByName = new Map([
    ['Emergencias', emergenciasCategory.id],
    ['Diagnóstico', diagnosticoCategory.id],
  ])

  for (const t of STARTER_TEMPLATES) {
    const categoryName = t.key === 'emergency-intervention' ? 'Emergencias' : 'Diagnóstico'
    const categoryId = categoryIdByName.get(categoryName)!
    await prisma.protocolTemplate.create({
      data: {
        tenantId,
        name: t.name,
        description: t.description,
        categoryId,
        schema: t.schema,
        isSeeded: true,
        createdBy,
      },
    })
  }

  console.log(`✓ Seeded 2 templates and 2 categories for tenant ${tenantId}`)
}

async function main() {
  console.log('Seeding database…')
  for (const acc of DEV_ACCOUNTS) {
    await seedDevAccount(acc)
  }
  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
