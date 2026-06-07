/**
 * Full development seed for the test user `test@test.com`.
 *
 * Populates the entire app surface for one solo doctor so every module can be
 * exercised end-to-end: locations, schedules, patients, appointments,
 * consultations (block-based, via protocol usages), prescriptions, lab &
 * imaging orders, invoices, protocols (with versions) and audit logs.
 *
 * Prerequisites:
 *   - Postgres running + migrated:  pnpm docker:up && pnpm db:migrate:dev
 *   - Firebase creds in root .env (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
 *     FIREBASE_PRIVATE_KEY)
 *
 * Run:
 *   pnpm seed:test-user
 *
 * Login after seeding:
 *   test@test.com  /  Test12345
 *
 * Idempotent: re-running wipes this tenant's clinical data and rebuilds it.
 * The Firebase user, tenant and doctor record are preserved across runs.
 */

import admin from 'firebase-admin'
import { PrismaClient } from '../packages/db/generated/index.js'

// ── Guards ──────────────────────────────────────────────────────────────────
if (process.env['NODE_ENV'] === 'production') {
  console.error('ERROR: seed-test-user must not run in production.')
  process.exit(1)
}

const EMAIL = 'test@test.com'
const PASSWORD = 'Test12345'

const prisma = new PrismaClient()

// ── Firebase Admin ────────────────────────────────────────────────────────────
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env['FIREBASE_PROJECT_ID'],
      clientEmail: process.env['FIREBASE_CLIENT_EMAIL'],
      privateKey: process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n'),
    }),
  })
}

async function getOrCreateFirebaseUser(email: string, password: string): Promise<string> {
  try {
    const existing = await admin.auth().getUserByEmail(email)
    console.log(`  Firebase: found ${email} (uid=${existing.uid})`)
    return existing.uid
  } catch (err: unknown) {
    if ((err as { code?: string }).code !== 'auth/user-not-found') throw err
  }
  const created = await admin.auth().createUser({ email, password })
  console.log(`  Firebase: created ${email} (uid=${created.uid})`)
  return created.uid
}

// ── Date helpers (anchored to "now") ─────────────────────────────────────────
const NOW = new Date()
function atTime(daysFromNow: number, hour: number, minute = 0): Date {
  const d = new Date(NOW)
  d.setDate(d.getDate() + daysFromNow)
  d.setHours(hour, minute, 0, 0)
  return d
}
function dob(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day))
}

// ── Tenant + doctor (get-or-create, never wiped) ─────────────────────────────
async function ensureDoctor(uid: string) {
  const existing = await prisma.user.findUnique({ where: { externalUid: uid } })
  if (existing) {
    await prisma.tenant.update({
      where: { id: existing.tenantId },
      data: { seededAt: NOW },
    })
    console.log(`  Postgres: reusing user ${existing.id} / tenant ${existing.tenantId}`)
    return existing
  }
  const created = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: 'Consultorio Test',
        type: 'solo',
        plan: 'free',
        country: 'DO',
        language: 'es',
        timezone: 'America/Santo_Domingo',
        seededAt: NOW,
      },
    })
    return tx.user.create({
      data: {
        tenantId: tenant.id,
        externalUid: uid,
        email: EMAIL,
        fullName: 'Dr. Test García',
        role: 'owner',
        specialty: 'Medicina General',
        licenseNumber: 'MED-DO-00001',
        preferences: { language: 'es', theme: 'light' },
      },
    })
  })
  console.log(`  Postgres: created user ${created.id} / tenant ${created.tenantId}`)
  return created
}

// ── Wipe this tenant's clinical data (FK-safe order) ─────────────────────────
async function wipeTenant(tenantId: string) {
  await prisma.auditLog.deleteMany({ where: { tenantId } })
  await prisma.attachment.deleteMany({ where: { tenantId } })
  await prisma.protocolSuggestion.deleteMany({ where: { tenantId } })
  await prisma.labOrderItem.deleteMany({ where: { labOrder: { tenantId } } })
  await prisma.labOrder.deleteMany({ where: { tenantId } })
  await prisma.imagingOrderItem.deleteMany({ where: { imagingOrder: { tenantId } } })
  await prisma.imagingOrder.deleteMany({ where: { tenantId } })
  await prisma.prescription.deleteMany({ where: { tenantId } }) // items cascade
  await prisma.invoice.deleteMany({ where: { tenantId } }) // items cascade
  await prisma.protocolUsage.deleteMany({ where: { tenantId } })
  await prisma.consultationAmendment.deleteMany({ where: { consultation: { tenantId } } })
  await prisma.consultation.deleteMany({ where: { tenantId } })
  await prisma.appointment.deleteMany({ where: { tenantId } })
  await prisma.protocolVersion.deleteMany({ where: { tenantId } })
  await prisma.protocol.deleteMany({ where: { tenantId } })
  await prisma.protocolTemplate.deleteMany({ where: { tenantId } })
  await prisma.protocolCategory.deleteMany({ where: { tenantId } })
  await prisma.patient.deleteMany({ where: { tenantId } })
  await prisma.scheduleException.deleteMany({ where: { location: { tenantId } } })
  await prisma.scheduleBlock.deleteMany({ where: { location: { tenantId } } })
  await prisma.doctorLocation.deleteMany({ where: { user: { tenantId } } })
  await prisma.location.deleteMany({ where: { tenantId } })
  console.log('  Postgres: wiped existing clinical data for tenant')
}

// ── Protocol content (block-based) ───────────────────────────────────────────
function hypertensionContent() {
  return {
    version: '1.0',
    blocks: [
      {
        id: 'sec_eval',
        type: 'section',
        title: 'Evaluación',
        blocks: [
          {
            id: 'blk_vitals',
            type: 'vitals',
            fields: [
              { id: 'sbp', label: 'PA sistólica', unit: 'mmHg', input_type: 'number' },
              { id: 'dbp', label: 'PA diastólica', unit: 'mmHg', input_type: 'number' },
              { id: 'hr', label: 'Frecuencia cardíaca', unit: 'lpm', input_type: 'number' },
              { id: 'weight', label: 'Peso', unit: 'kg', input_type: 'number' },
            ],
          },
          {
            id: 'blk_anamnesis',
            type: 'checklist',
            title: 'Anamnesis dirigida',
            items: [
              { id: 'i1', text: 'Adherencia al tratamiento' },
              { id: 'i2', text: 'Síntomas de daño a órgano diana', critical: true },
              { id: 'i3', text: 'Consumo de sal y alcohol' },
            ],
          },
        ],
      },
      {
        id: 'blk_meds',
        type: 'dosage_table',
        title: 'Esquema farmacológico',
        columns: ['Fármaco', 'Dosis', 'Vía', 'Frecuencia', 'Notas'],
        rows: [
          {
            id: 'r1',
            drug: 'Losartán',
            dose: '50 mg',
            route: 'VO',
            frequency: 'cada 24h',
            notes: 'Titular según PA',
          },
          {
            id: 'r2',
            drug: 'Amlodipino',
            dose: '5 mg',
            route: 'VO',
            frequency: 'cada 24h',
            notes: 'Si no controla con monoterapia',
          },
        ],
      },
      {
        id: 'blk_labs',
        type: 'lab_order',
        title: 'Laboratorios de control',
        orders: [
          {
            id: 'l1',
            test_name: 'Perfil lipídico',
            indication: 'Riesgo cardiovascular',
            urgency: 'routine',
            fasting_required: true,
            sample_type: 'blood',
          },
          {
            id: 'l2',
            test_name: 'Creatinina y electrolitos',
            indication: 'Función renal basal',
            urgency: 'routine',
            fasting_required: false,
            sample_type: 'blood',
          },
        ],
      },
      {
        id: 'blk_alert',
        type: 'alert',
        severity: 'warning',
        title: 'Crisis hipertensiva',
        content: 'PA > 180/120 mmHg con síntomas → referir a emergencias.',
      },
      {
        id: 'blk_notes',
        type: 'clinical_notes',
        label: 'Plan',
        content: 'Control en 4 semanas. Dieta hiposódica y actividad física.',
      },
    ],
  }
}

function diabetesContent() {
  return {
    version: '1.0',
    blocks: [
      {
        id: 'sec_eval',
        type: 'section',
        title: 'Evaluación metabólica',
        blocks: [
          {
            id: 'blk_vitals',
            type: 'vitals',
            fields: [
              { id: 'glucose', label: 'Glucosa capilar', unit: 'mg/dL', input_type: 'number' },
              { id: 'weight', label: 'Peso', unit: 'kg', input_type: 'number' },
              { id: 'bmi', label: 'IMC', unit: 'kg/m²', input_type: 'number' },
            ],
          },
        ],
      },
      {
        id: 'blk_meds',
        type: 'dosage_table',
        title: 'Tratamiento',
        columns: ['Fármaco', 'Dosis', 'Vía', 'Frecuencia', 'Notas'],
        rows: [
          {
            id: 'r1',
            drug: 'Metformina',
            dose: '850 mg',
            route: 'VO',
            frequency: 'cada 12h',
            notes: 'Con las comidas',
          },
        ],
      },
      {
        id: 'blk_labs',
        type: 'lab_order',
        title: 'Control glucémico',
        orders: [
          {
            id: 'l1',
            test_name: 'Hemoglobina glicosilada (HbA1c)',
            indication: 'Control trimestral',
            urgency: 'routine',
            fasting_required: false,
            sample_type: 'blood',
          },
        ],
      },
      {
        id: 'blk_notes',
        type: 'clinical_notes',
        label: 'Plan',
        content: 'Educación nutricional. Meta HbA1c < 7%. Control en 3 meses.',
      },
    ],
  }
}

// Minimal authoring template (what shows up under "plantillas")
function starterTemplateSchema() {
  return {
    version: '1.0',
    metadata: { suggested_specialty: 'general', intended_use: 'Seguimiento de enfermedad crónica' },
    blocks: [
      {
        id: 'sec_eval',
        type: 'section',
        title: 'Evaluación',
        required: true,
        placeholder_blocks: [{ type: 'vitals', placeholder: 'Signos vitales relevantes.' }],
      },
      {
        id: 'sec_plan',
        type: 'section',
        title: 'Plan',
        required: true,
        placeholder_blocks: [{ type: 'dosage_table', placeholder: 'Esquema farmacológico.' }],
      },
    ],
  }
}

// ── Audit helper ─────────────────────────────────────────────────────────────
async function audit(
  tenantId: string,
  actorUserId: string,
  action: string,
  entityType: string,
  entityId: string,
) {
  await prisma.auditLog.create({
    data: {
      tenantId,
      actorUserId,
      actorType: 'user',
      category: 'entity',
      action,
      entityType,
      entityId,
      status: 'success',
    },
  })
}

// ── Main seed ────────────────────────────────────────────────────────────────
async function seed(tenantId: string, userId: string) {
  // ── Locations + doctor links + schedules ──────────────────────────────────
  const locOwned = await prisma.location.create({
    data: {
      tenantId,
      name: 'Consultorio Privado',
      address: 'Av. Abraham Lincoln 304, Piantini',
      city: 'Santo Domingo',
      phone: '809-555-0200',
      isOwned: true,
      commissionPercent: 0,
    },
  })
  const locCenter = await prisma.location.create({
    data: {
      tenantId,
      name: 'Centro Médico Nacional',
      address: 'Av. Máximo Gómez 68, Santo Domingo',
      city: 'Santo Domingo',
      phone: '809-555-0100',
      isOwned: false,
      commissionPercent: 30,
    },
  })

  await prisma.doctorLocation.createMany({
    data: [
      { userId, locationId: locOwned.id, consultationFee: 5000, commissionPct: 0, roomOrOffice: 'Consultorio 1' },
      { userId, locationId: locCenter.id, consultationFee: 3500, commissionPct: 30, roomOrOffice: 'Suite 304' },
    ],
  })

  // Weekly availability: owned clinic Mon/Wed/Fri AM, center Tue/Thu PM
  await prisma.scheduleBlock.createMany({
    data: [
      { userId, locationId: locOwned.id, dayOfWeek: 1, startTime: '08:00:00', endTime: '12:00:00', slotDurationMin: 30 },
      { userId, locationId: locOwned.id, dayOfWeek: 3, startTime: '08:00:00', endTime: '12:00:00', slotDurationMin: 30 },
      { userId, locationId: locOwned.id, dayOfWeek: 5, startTime: '08:00:00', endTime: '12:00:00', slotDurationMin: 30 },
      { userId, locationId: locCenter.id, dayOfWeek: 2, startTime: '14:00:00', endTime: '18:00:00', slotDurationMin: 20 },
      { userId, locationId: locCenter.id, dayOfWeek: 4, startTime: '14:00:00', endTime: '18:00:00', slotDurationMin: 20 },
    ],
  })
  await prisma.scheduleException.create({
    data: {
      userId,
      locationId: locOwned.id,
      date: atTime(10, 0),
      type: 'blocked',
      reason: 'Congreso médico',
    },
  })
  console.log('  ✓ 2 locations, schedules, 1 exception')

  // ── Patients ───────────────────────────────────────────────────────────────
  const patientsData = [
    {
      firstName: 'Ana María', lastName: 'Reyes', dateOfBirth: dob(1982, 3, 15), sex: 'female',
      documentType: 'cedula', documentNumber: '001-1234567-8', phone: '809-555-1001',
      email: 'ana.reyes@example.com', bloodType: 'O+',
      allergies: ['Penicilina'], chronicConditions: ['Hipertensión arterial', 'Diabetes tipo 2'],
    },
    {
      firstName: 'Carlos', lastName: 'Martínez', dateOfBirth: dob(1975, 7, 22), sex: 'male',
      documentType: 'cedula', documentNumber: '001-9876543-2', phone: '829-555-1002',
      bloodType: 'A+', allergies: [], chronicConditions: ['Dislipidemia'],
    },
    {
      firstName: 'María', lastName: 'González', dateOfBirth: dob(1990, 11, 8), sex: 'female',
      documentType: 'cedula', documentNumber: '402-5555555-5', phone: '849-555-1003',
      email: 'maria.g@example.com', bloodType: 'B+',
      allergies: ['Aspirina', 'AINES'], chronicConditions: [],
    },
    {
      firstName: 'Pedro', lastName: 'Álvarez', dateOfBirth: dob(1958, 1, 30), sex: 'male',
      documentType: 'cedula', documentNumber: '001-1111111-1', phone: '809-555-1004',
      bloodType: 'AB+', allergies: [],
      chronicConditions: ['Insuficiencia cardíaca congestiva', 'Fibrilación auricular'],
    },
    {
      firstName: 'Laura', lastName: 'Fernández', dateOfBirth: dob(2000, 5, 14), sex: 'female',
      documentType: 'cedula', documentNumber: '402-6666666-6', phone: '829-555-1005',
      bloodType: 'O-', allergies: ['Sulfas'], chronicConditions: [],
    },
    {
      firstName: 'José', lastName: 'Pérez', dateOfBirth: dob(1968, 9, 2), sex: 'male',
      documentType: 'cedula', documentNumber: '001-2222222-2', phone: '809-555-1006',
      bloodType: 'A-', allergies: [], chronicConditions: ['Hipertensión arterial'],
    },
    {
      firstName: 'Rosa', lastName: 'Jiménez', dateOfBirth: dob(1995, 12, 20), sex: 'female',
      documentType: 'passport', documentNumber: 'P1234567', phone: '849-555-1007',
      email: 'rosa.j@example.com', bloodType: 'B-', allergies: [], chronicConditions: [],
    },
    {
      firstName: 'Miguel', lastName: 'Santos', dateOfBirth: dob(1948, 4, 10), sex: 'male',
      documentType: 'cedula', documentNumber: '001-3333333-3', phone: '809-555-1008',
      bloodType: 'O+', allergies: ['Yodo'],
      chronicConditions: ['Diabetes tipo 2', 'Enfermedad renal crónica'],
    },
  ]
  const patients: Awaited<ReturnType<typeof prisma.patient.create>>[] = []
  for (const p of patientsData) {
    const created = await prisma.patient.create({ data: { tenantId, ownerUserId: userId, ...p } })
    patients.push(created)
    await audit(tenantId, userId, 'create', 'patient', created.id)
  }
  console.log(`  ✓ ${patients.length} patients`)

  // ── Protocol categories + authoring template ──────────────────────────────
  const catChronic = await prisma.protocolCategory.create({
    data: { tenantId, name: 'Crónicos', color: '#2D5760', isSeeded: true },
  })
  await prisma.protocolCategory.create({
    data: { tenantId, name: 'Agudos', color: '#B45309', isSeeded: true },
  })
  await prisma.protocolTemplate.create({
    data: {
      tenantId,
      name: 'Seguimiento de enfermedad crónica',
      description: 'Plantilla base para protocolos de control de crónicos.',
      suggestedSpecialty: 'general',
      schema: starterTemplateSchema(),
      isSeeded: true,
      createdBy: userId,
    },
  })

  // ── Protocols (active, with versions) ─────────────────────────────────────
  async function createProtocol(
    title: string,
    description: string,
    content: object,
    isFavorite: boolean,
  ) {
    const protocol = await prisma.protocol.create({
      data: {
        tenantId,
        categoryId: catChronic.id,
        title,
        description,
        specialty: 'Medicina General',
        tags: ['crónico', 'seguimiento'],
        status: 'active',
        visibility: 'private',
        isFavorite,
        createdBy: userId,
      },
    })
    const version = await prisma.protocolVersion.create({
      data: {
        tenantId,
        protocolId: protocol.id,
        versionNumber: 1,
        content,
        changeSummary: 'Versión inicial',
        createdBy: userId,
        approvedBy: userId,
        approvedAt: NOW,
      },
    })
    await prisma.protocol.update({
      where: { id: protocol.id },
      data: { currentVersionId: version.id },
    })
    await audit(tenantId, userId, 'create', 'protocol', protocol.id)
    return { protocol, version }
  }

  const htn = await createProtocol(
    'Manejo de Hipertensión Arterial',
    'Protocolo de control ambulatorio de HTA esencial.',
    hypertensionContent(),
    true,
  )
  const dm = await createProtocol(
    'Control de Diabetes Tipo 2',
    'Seguimiento metabólico del paciente diabético.',
    diabetesContent(),
    false,
  )
  console.log('  ✓ 2 categories, 1 template, 2 active protocols')

  // ── Appointments + completed consultations workflow ───────────────────────
  // Past completed visits (drive history + invoices + protocol usage stats),
  // today's mix (open consultation + upcoming), and future scheduled.
  let invoiceSeq = 1
  const nextInvoiceNumber = () =>
    `INV-2026-${String(invoiceSeq++).padStart(4, '0')}`

  // Helper: a fully completed visit with consultation, protocol usage,
  // prescription, lab order and a paid invoice.
  async function completedVisit(opts: {
    patient: (typeof patients)[number]
    location: typeof locOwned
    when: Date
    proto: typeof htn
    vitals: Record<string, number>
    fee: number
    commissionPct: number
    rx: { drug: string; dose: string; route: string; frequency: string; duration: string }[]
    labs?: { test_name: string; indication: string }[]
  }) {
    const endsAt = new Date(opts.when.getTime() + 30 * 60000)
    const appointment = await prisma.appointment.create({
      data: {
        tenantId,
        patientId: opts.patient.id,
        userId,
        locationId: opts.location.id,
        startsAt: opts.when,
        endsAt,
        status: 'completed',
        reason: 'Consulta de seguimiento',
      },
    })
    const consultation = await prisma.consultation.create({
      data: {
        tenantId,
        patientId: opts.patient.id,
        doctorId: userId,
        locationId: opts.location.id,
        appointmentId: appointment.id,
        status: 'signed',
        startedAt: opts.when,
        signedAt: endsAt,
      },
    })

    // Working-copy snapshot of the protocol with vitals filled in.
    const content = JSON.parse(JSON.stringify(opts.proto.version.content)) as {
      blocks: { id: string; type: string; blocks?: { id: string; type: string; values?: object }[] }[]
    }
    for (const sec of content.blocks) {
      for (const inner of sec.blocks ?? []) {
        if (inner.type === 'vitals') inner.values = opts.vitals
      }
    }
    await prisma.protocolUsage.create({
      data: {
        tenantId,
        protocolId: opts.proto.protocol.id,
        protocolVersionId: opts.proto.version.id,
        userId,
        patientId: opts.patient.id,
        consultationId: consultation.id,
        content,
        status: 'completed',
        completedAt: endsAt,
        appliedAt: opts.when,
      },
    })

    await prisma.prescription.create({
      data: {
        tenantId,
        consultationId: consultation.id,
        patientId: opts.patient.id,
        doctorId: userId,
        groupTitle: 'Tratamiento',
        status: 'signed',
        signedAt: endsAt,
        prescriptionItems: {
          create: opts.rx.map((r) => ({ ...r, notes: null, source: 'manual' })),
        },
      },
    })

    if (opts.labs?.length) {
      await prisma.labOrder.create({
        data: {
          tenantId,
          consultationId: consultation.id,
          patientId: opts.patient.id,
          doctorId: userId,
          groupTitle: 'Laboratorios',
          status: 'signed',
          signedAt: endsAt,
          items: {
            create: opts.labs.map((l) => ({
              testName: l.test_name,
              indication: l.indication,
              urgency: 'routine',
              sampleType: 'blood',
            })),
          },
        },
      })
    }

    const subtotal = opts.fee
    const tax = Math.round(subtotal * 0.18 * 100) / 100
    const total = subtotal + tax
    const commissionAmount = Math.round(subtotal * (opts.commissionPct / 100) * 100) / 100
    await prisma.invoice.create({
      data: {
        tenantId,
        patientId: opts.patient.id,
        consultationId: consultation.id,
        locationId: opts.location.id,
        userId,
        invoiceNumber: nextInvoiceNumber(),
        currency: 'DOP',
        status: 'paid',
        subtotal,
        tax,
        total,
        commissionPercent: opts.commissionPct,
        commissionAmount,
        netToDoctor: total - commissionAmount,
        paymentMethod: 'cash',
        issuedAt: endsAt,
        paidAt: endsAt,
        items: {
          create: [
            { description: 'Consulta médica', quantity: 1, unitPrice: subtotal, total: subtotal },
          ],
        },
      },
    })

    await audit(tenantId, userId, 'create', 'consultation', consultation.id)
    return { appointment, consultation }
  }

  // Ana María — hypertensive + diabetic, two prior visits (builds history)
  await completedVisit({
    patient: patients[0]!, location: locOwned, when: atTime(-90, 9), proto: htn,
    vitals: { sbp: 158, dbp: 96, hr: 78, weight: 82 }, fee: 5000, commissionPct: 0,
    rx: [{ drug: 'Losartán', dose: '50 mg', route: 'VO', frequency: 'cada 24h', duration: '30 días' }],
    labs: [{ test_name: 'Perfil lipídico', indication: 'Riesgo cardiovascular' }],
  })
  await completedVisit({
    patient: patients[0]!, location: locOwned, when: atTime(-30, 9, 30), proto: htn,
    vitals: { sbp: 142, dbp: 88, hr: 74, weight: 81 }, fee: 5000, commissionPct: 0,
    rx: [
      { drug: 'Losartán', dose: '50 mg', route: 'VO', frequency: 'cada 24h', duration: '30 días' },
      { drug: 'Amlodipino', dose: '5 mg', route: 'VO', frequency: 'cada 24h', duration: '30 días' },
    ],
  })

  // Miguel — diabetic at the center (commission applies)
  await completedVisit({
    patient: patients[7]!, location: locCenter, when: atTime(-21, 15), proto: dm,
    vitals: { glucose: 186, weight: 90, bmi: 31 }, fee: 3500, commissionPct: 30,
    rx: [{ drug: 'Metformina', dose: '850 mg', route: 'VO', frequency: 'cada 12h', duration: '30 días' }],
    labs: [{ test_name: 'Hemoglobina glicosilada', indication: 'Control trimestral' }],
  })

  // José — single HTN visit
  await completedVisit({
    patient: patients[5]!, location: locOwned, when: atTime(-14, 10), proto: htn,
    vitals: { sbp: 150, dbp: 92, hr: 80, weight: 88 }, fee: 5000, commissionPct: 0,
    rx: [{ drug: 'Amlodipino', dose: '5 mg', route: 'VO', frequency: 'cada 24h', duration: '30 días' }],
  })
  console.log('  ✓ 4 completed visits (consultations, usages, Rx, labs, paid invoices)')

  // ── Today: one in-progress consultation + an issued (unpaid) invoice ───────
  const todayAppt = await prisma.appointment.create({
    data: {
      tenantId, patientId: patients[0]!.id, userId, locationId: locOwned.id,
      startsAt: atTime(0, 9), endsAt: atTime(0, 9, 30),
      status: 'completed', reason: 'Control de presión arterial',
    },
  })
  const openConsult = await prisma.consultation.create({
    data: {
      tenantId, patientId: patients[0]!.id, doctorId: userId, locationId: locOwned.id,
      appointmentId: todayAppt.id, status: 'open', startedAt: atTime(0, 9),
    },
  })
  await prisma.protocolUsage.create({
    data: {
      tenantId, protocolId: htn.protocol.id, protocolVersionId: htn.version.id,
      userId, patientId: patients[0]!.id, consultationId: openConsult.id,
      content: htn.version.content as object, status: 'in_progress', appliedAt: atTime(0, 9),
    },
  })
  // Pending invoice (issued, not paid) for a different patient
  await prisma.invoice.create({
    data: {
      tenantId, patientId: patients[5]!.id, locationId: locOwned.id, userId,
      invoiceNumber: nextInvoiceNumber(), currency: 'DOP', status: 'issued',
      subtotal: 5000, tax: 900, total: 5900, netToDoctor: 5900,
      issuedAt: atTime(-2, 11), dueDate: atTime(13, 0),
      items: { create: [{ description: 'Consulta médica', quantity: 1, unitPrice: 5000, total: 5000 }] },
    },
  })
  console.log('  ✓ today open consultation + 1 issued invoice')

  // ── Future + cancelled/no-show appointments (calendar coverage) ────────────
  await prisma.appointment.createMany({
    data: [
      {
        tenantId, patientId: patients[1]!.id, userId, locationId: locOwned.id,
        startsAt: atTime(0, 10), endsAt: atTime(0, 10, 30), status: 'scheduled',
        reason: 'Evaluación de dislipidemia',
      },
      {
        tenantId, patientId: patients[2]!.id, userId, locationId: locCenter.id,
        startsAt: atTime(1, 14), endsAt: atTime(1, 14, 20), status: 'scheduled',
        reason: 'Primera consulta',
      },
      {
        tenantId, patientId: patients[7]!.id, userId, locationId: locCenter.id,
        startsAt: atTime(7, 15), endsAt: atTime(7, 15, 20), status: 'scheduled',
        reason: 'Control de diabetes',
      },
      {
        tenantId, patientId: patients[3]!.id, userId, locationId: locOwned.id,
        startsAt: atTime(-7, 11), endsAt: atTime(-7, 11, 30), status: 'no_show',
        reason: 'Control de insuficiencia cardíaca',
      },
      {
        tenantId, patientId: patients[4]!.id, userId, locationId: locOwned.id,
        startsAt: atTime(-3, 8), endsAt: atTime(-3, 8, 30), status: 'cancelled',
        reason: 'Chequeo general', notes: 'Reprogramada a solicitud del paciente',
      },
    ],
  })
  console.log('  ✓ 5 scheduled/cancelled/no-show appointments')

  // ── Auth audit events ──────────────────────────────────────────────────────
  await prisma.auditLog.create({
    data: { tenantId, actorUserId: userId, actorType: 'user', category: 'auth', action: 'login', status: 'success' },
  })
}

// ── Entry point ──────────────────────────────────────────────────────────────
async function main() {
  console.log(`Seeding full dev data for ${EMAIL}…`)
  const uid = await getOrCreateFirebaseUser(EMAIL, PASSWORD)
  const user = await ensureDoctor(uid)
  await wipeTenant(user.tenantId)
  await seed(user.tenantId, user.id)

  const counts = await prisma.$transaction([
    prisma.patient.count({ where: { tenantId: user.tenantId } }),
    prisma.appointment.count({ where: { tenantId: user.tenantId } }),
    prisma.consultation.count({ where: { tenantId: user.tenantId } }),
    prisma.prescription.count({ where: { tenantId: user.tenantId } }),
    prisma.invoice.count({ where: { tenantId: user.tenantId } }),
    prisma.protocol.count({ where: { tenantId: user.tenantId } }),
  ])
  console.log('\nDone. Summary:')
  console.log(`  Login        : ${EMAIL} / ${PASSWORD}`)
  console.log(`  Tenant       : ${user.tenantId}`)
  console.log(`  Patients     : ${counts[0]}`)
  console.log(`  Appointments : ${counts[1]}`)
  console.log(`  Consultations: ${counts[2]}`)
  console.log(`  Prescriptions: ${counts[3]}`)
  console.log(`  Invoices     : ${counts[4]}`)
  console.log(`  Protocols    : ${counts[5]}`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
