import { NestFactory } from '@nestjs/core'
import { CreateInstitutionSchema } from '@rezeta/shared'
import type { CreateInstitutionDto, InstitutionCreatedDto } from '@rezeta/shared'
import { AppModule } from '../app.module.js'
import { StaffService } from '../modules/staff/index.js'
import { PlatformUsersRepository } from '../modules/platform-users/index.js'
import { AUTH_PROVIDER, type IAuthProvider } from '../lib/auth/index.js'

export interface BootstrapArgs {
  platformEmail: string
  platformName: string | null
  institution: CreateInstitutionDto | null
}

export interface BootstrapDeps {
  authProvider: Pick<IAuthProvider, 'createUser' | 'generatePasswordResetLink'>
  platformUsers: Pick<PlatformUsersRepository, 'create'>
  staff: Pick<StaffService, 'createInstitution'>
}

export interface BootstrapResult {
  platformUserId: string
  setPasswordLink: string
  institution: InstitutionCreatedDto | null
}

/**
 * Parses `--platform-email` (required), `--platform-name` (optional), and the
 * optional institution block (`--name`, `--type`, `--plan`, `--admin-name`,
 * `--admin-email` — all required together). The institution block is run
 * through `CreateInstitutionSchema.parse` here — the same value-set and
 * format validation the HTTP controller gets from its `ZodValidationPipe` —
 * so a malformed `--type`, `--plan`, or `--admin-email` fails fast in the CLI
 * instead of reaching StaffService/the database/Firebase unvalidated.
 */
export function parseArgs(argv: string[]): BootstrapArgs {
  const map = new Map<string, string>()
  for (const arg of argv) {
    const match = /^--([^=]+)=(.*)$/.exec(arg)
    if (match) map.set(match[1]!, match[2]!)
  }
  const platformEmail = map.get('platform-email')
  if (!platformEmail || platformEmail.trim() === '') {
    throw new Error('Missing required flag --platform-email')
  }
  const instKeys = ['name', 'type', 'plan', 'admin-name', 'admin-email']
  const anyInst = instKeys.some((k) => map.has(k))
  let institution: CreateInstitutionDto | null = null
  if (anyInst) {
    for (const k of instKeys) {
      if (!map.get(k)) throw new Error(`Institution flag --${k} is required when creating one`)
    }
    institution = CreateInstitutionSchema.parse({
      institutionName: map.get('name'),
      type: map.get('type'),
      plan: map.get('plan'),
      adminFullName: map.get('admin-name'),
      adminEmail: map.get('admin-email'),
    })
  }
  return {
    platformEmail,
    platformName: map.get('platform-name') ?? null,
    institution,
  }
}

export async function bootstrapPlatform(
  deps: BootstrapDeps,
  args: BootstrapArgs,
): Promise<BootstrapResult> {
  // 1. Control-plane identity: Admin SDK user + platform_users row.
  const { externalUid } = await deps.authProvider.createUser(args.platformEmail)
  const platformUser = await deps.platformUsers.create({
    externalUid,
    email: args.platformEmail,
    fullName: args.platformName,
  })
  const setPasswordLink = await deps.authProvider.generatePasswordResetLink(args.platformEmail)

  // 2. Optionally create the first institution, attributed to this platform user.
  let institution: InstitutionCreatedDto | null = null
  if (args.institution) {
    institution = await deps.staff.createInstitution(args.institution, platformUser.id)
  }

  return { platformUserId: platformUser.id, setPasswordLink, institution }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2))
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] })
  try {
    const deps: BootstrapDeps = {
      authProvider: app.get<IAuthProvider>(AUTH_PROVIDER),
      platformUsers: app.get(PlatformUsersRepository),
      staff: app.get(StaffService),
    }
    const result = await bootstrapPlatform(deps, args)
    console.log(
      `✓ Platform user ${result.platformUserId} (${args.platformEmail}) created.\n` +
        `  Set-password link: ${result.setPasswordLink}` +
        (result.institution
          ? `\n✓ Institution ${result.institution.tenantId}; super_admin ${result.institution.userId} (${result.institution.email})`
          : ''),
    )
  } finally {
    await app.close()
  }
}

/**
 * True when `argvPath` (typically `process.argv[1]`) is this script itself —
 * either the TypeScript source (run via ts-node/tsx) or its compiled
 * `dist/.../create-institution.js` counterpart — as opposed to a test file
 * importing this module's exports (e.g. `__tests__/create-institution.spec.ts`).
 * Exported as a pure predicate so the self-invoke guard is unit-testable
 * without needing to spawn a subprocess.
 */
export function isSelfInvoked(argvPath: string | undefined): boolean {
  return argvPath !== undefined && /create-institution\.(ts|js)$/.test(argvPath)
}

// Only self-invoke when run as a script (not when imported by tests).
if (isSelfInvoked(process.argv[1])) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
