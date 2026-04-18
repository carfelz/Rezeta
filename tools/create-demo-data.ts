/**
 * Creates a demo tenant, user, locations, and patients for local development.
 *
 * Usage:
 *   pnpm demo:data --firebase-uid=<uid>
 *
 * The Firebase user must already exist in the Firebase emulator (or project)
 * before running this script. Create it via the emulator UI at
 * http://localhost:4000/auth, then pass the generated UID here.
 *
 * If --firebase-uid is omitted, a placeholder UID is used and you'll need
 * to update it manually in the database before logging in.
 */

import { PrismaClient } from '../packages/db/generated/index.js'

const prisma = new PrismaClient()

const firebaseUid = process.argv
  .find((a) => a.startsWith('--firebase-uid='))
  ?.split('=')[1] ?? 'demo-firebase-uid-replace-me'

async function main() {
  console.log('Creating demo tenant…')

  const tenant = await prisma.tenant.create({
    data: {
      name: 'Clínica Demo',
      type: 'solo',
      plan: 'solo',
      country: 'DO',
      language: 'es',
      timezone: 'America/Santo_Domingo',
    },
  })

  console.log(`✓ Tenant created: ${tenant.id}`)

  // ── Doctor user ────────────────────────────────────────────────────────────
  const user = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      firebaseUid,
      email: 'demo@rezeta.app',
      fullName: 'Dr. Juan García',
      role: 'owner',
      specialty: 'Cardiología',
      licenseNumber: 'CMP-12345',
    },
  })

  console.log(`✓ User created: ${user.id} (firebaseUid: ${firebaseUid})`)

  // ── Locations ──────────────────────────────────────────────────────────────
  const [loc1, loc2] = await Promise.all([
    prisma.location.create({
      data: {
        tenantId: tenant.id,
        name: 'Centro Médico Nacional',
        address: 'Av. Máximo Gómez 68, Santo Domingo',
        city: 'Santo Domingo',
        phone: '809-555-0100',
        isOwned: false,
        commissionPercent: 30,
      },
    }),
    prisma.location.create({
      data: {
        tenantId: tenant.id,
        name: 'Consultorio Privado',
        address: 'Av. Abraham Lincoln 304, Piantini',
        city: 'Santo Domingo',
        phone: '809-555-0200',
        isOwned: true,
        commissionPercent: 0,
      },
    }),
  ])

  await Promise.all([
    prisma.doctorLocation.create({
      data: { userId: user.id, locationId: loc1.id, consultationFee: 3500, commissionPct: 30 },
    }),
    prisma.doctorLocation.create({
      data: { userId: user.id, locationId: loc2.id, consultationFee: 5000, commissionPct: 0 },
    }),
  ])

  console.log(`✓ Locations created: ${loc1.name}, ${loc2.name}`)

  // ── Demo patients ──────────────────────────────────────────────────────────
  const patientsData = [
    {
      firstName: 'Ana María',
      lastName: 'Reyes',
      dateOfBirth: new Date('1982-03-15'),
      sex: 'female',
      documentType: 'cedula',
      documentNumber: '001-1234567-8',
      phone: '809-555-1001',
      email: 'ana.reyes@example.com',
      bloodType: 'O+',
      allergies: ['Penicilina'],
      chronicConditions: ['Hipertensión arterial', 'Diabetes tipo 2'],
    },
    {
      firstName: 'Carlos',
      lastName: 'Martínez',
      dateOfBirth: new Date('1975-07-22'),
      sex: 'male',
      documentType: 'cedula',
      documentNumber: '001-9876543-2',
      phone: '829-555-1002',
      bloodType: 'A+',
      allergies: [],
      chronicConditions: ['Dislipidemia'],
    },
    {
      firstName: 'María',
      lastName: 'González',
      dateOfBirth: new Date('1990-11-08'),
      sex: 'female',
      documentType: 'cedula',
      documentNumber: '402-5555555-5',
      phone: '849-555-1003',
      email: 'maria.g@example.com',
      bloodType: 'B+',
      allergies: ['Aspirina', 'AINES'],
      chronicConditions: [],
    },
    {
      firstName: 'Pedro',
      lastName: 'Álvarez',
      dateOfBirth: new Date('1958-01-30'),
      sex: 'male',
      documentType: 'cedula',
      documentNumber: '001-1111111-1',
      phone: '809-555-1004',
      bloodType: 'AB+',
      allergies: [],
      chronicConditions: ['Insuficiencia cardíaca congestiva', 'Fibrilación auricular'],
    },
    {
      firstName: 'Laura',
      lastName: 'Fernández',
      dateOfBirth: new Date('2000-05-14'),
      sex: 'female',
      documentType: 'cedula',
      documentNumber: '402-6666666-6',
      phone: '829-555-1005',
      bloodType: 'O-',
      allergies: ['Sulfas'],
      chronicConditions: [],
    },
  ]

  for (const p of patientsData) {
    await prisma.patient.create({
      data: {
        tenantId: tenant.id,
        ownerUserId: user.id,
        ...p,
      },
    })
  }

  console.log(`✓ ${patientsData.length} demo patients created`)

  console.log('\nDemo data ready. Summary:')
  console.log(`  Tenant ID : ${tenant.id}`)
  console.log(`  User ID   : ${user.id}`)
  console.log(`  Firebase  : ${firebaseUid}`)
  console.log(`  Locations : ${loc1.id}, ${loc2.id}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
