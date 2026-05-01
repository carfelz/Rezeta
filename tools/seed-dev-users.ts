/**
 * Seed dev users into the Firebase Auth dev project and Postgres.
 *
 * Prerequisites:
 *   - Firebase credentials set in root .env (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL,
 *     FIREBASE_PRIVATE_KEY)
 *   - Postgres running: pnpm docker:up
 *
 * Credentials (for manual login):
 *   dr.garcia@ejemplo.do  / Test1234!  → Consultorio García, Cardiología
 *   dra.reyes@ejemplo.do  / Test1234!  → Consultorio Reyes, Pediatría
 *
 * Safe to re-run: fully idempotent.
 */

import admin from 'firebase-admin'
import { PrismaClient } from '../packages/db/generated/index.js'

// ── Guards ────────────────────────────────────────────────────────────────────

if (process.env['NODE_ENV'] === 'production') {
  console.error('ERROR: seed-dev-users must not run in production.')
  process.exit(1)
}

// ── Firebase Admin init ───────────────────────────────────────────────────────

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env['FIREBASE_PROJECT_ID'],
      clientEmail: process.env['FIREBASE_CLIENT_EMAIL'],
      privateKey: process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n'),
    }),
  })
}

const prisma = new PrismaClient()

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOrCreateFirebaseUser(email: string, password: string): Promise<string> {
  try {
    const existing = await admin.auth().getUserByEmail(email)
    console.log(`  Firebase: found existing user ${email} (uid=${existing.uid})`)
    return existing.uid
  } catch (err: unknown) {
    const code = (err as { code?: string }).code
    if (code !== 'auth/user-not-found') throw err
  }

  const created = await admin.auth().createUser({ email, password })
  console.log(`  Firebase: created user ${email} (uid=${created.uid})`)
  return created.uid
}

interface DevUser {
  email: string
  password: string
  tenantName: string
  fullName: string
  specialty: string
  licenseNumber: string
}

async function seedUser(dev: DevUser) {
  console.log(`\nSeeding ${dev.email}…`)

  const uid = await getOrCreateFirebaseUser(dev.email, dev.password)

  const existingUser = await prisma.user.findUnique({ where: { firebaseUid: uid } })

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: {
        fullName: dev.fullName,
        specialty: dev.specialty,
        licenseNumber: dev.licenseNumber,
      },
    })
    console.log(`  Postgres: updated existing user (id=${existingUser.id})`)
    return
  }

  const user = await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({
      data: {
        name: dev.tenantName,
        type: 'solo',
        plan: 'free',
        country: 'DO',
        language: 'es',
        timezone: 'America/Santo_Domingo',
      },
    })

    return tx.user.create({
      data: {
        tenantId: tenant.id,
        firebaseUid: uid,
        email: dev.email,
        fullName: dev.fullName,
        specialty: dev.specialty,
        licenseNumber: dev.licenseNumber,
        role: 'owner',
      },
    })
  })

  console.log(`  Postgres: created tenant + user (userId=${user.id}, tenantId=${user.tenantId})`)
}

// ── Dev user definitions ──────────────────────────────────────────────────────

const DEV_USERS: DevUser[] = [
  {
    email: 'test@test.com',
    password: 'Test12345',
    tenantName: 'Consultorio Test',
    fullName: 'Dr. Test García',
    specialty: 'Medicina General',
    licenseNumber: 'MED-DO-00001',
  },
  {
    email: 'dr.garcia@ejemplo.do',
    password: 'Test1234!',
    tenantName: 'Consultorio García',
    fullName: 'Dr. Juan García',
    specialty: 'Cardiología',
    licenseNumber: 'MED-DO-12345',
  },
  {
    email: 'dra.reyes@ejemplo.do',
    password: 'Test1234!',
    tenantName: 'Consultorio Reyes',
    fullName: 'Dra. Ana Reyes',
    specialty: 'Pediatría',
    licenseNumber: 'MED-DO-67890',
  },
]

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('Seeding dev users into Firebase dev project and Postgres…')
  for (const dev of DEV_USERS) {
    await seedUser(dev)
  }
  console.log('\nDone.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
