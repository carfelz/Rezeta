import * as admin from 'firebase-admin'
import type { ProjectConfig, ProjectConfigManager } from 'firebase-admin/auth'

export interface EnableTotpDeps {
  projectConfigManager: Pick<ProjectConfigManager, 'updateProjectConfig'>
}

/**
 * Idempotent: re-running with the project already in this state just
 * re-applies the same desired config (Identity Platform's updateProjectConfig
 * is a full-replace PATCH on multiFactorConfig, not an incremental toggle) —
 * safe to run on every deploy, not just once. `adjacentIntervals: 5` widens
 * the accepted TOTP clock-skew window to ±5 * 30s (~2.5 min either side),
 * matching Google's own documented default for Identity Platform TOTP.
 */
export async function enableTotpMfa(deps: EnableTotpDeps): Promise<ProjectConfig> {
  return deps.projectConfigManager.updateProjectConfig({
    multiFactorConfig: {
      state: 'ENABLED',
      providerConfigs: [{ state: 'ENABLED', totpProviderConfig: { adjacentIntervals: 5 } }],
    },
  })
}

export interface FirebaseCredentials {
  projectId: string
  clientEmail: string
  privateKey: string
}

/**
 * Mirrors FirebaseAuthProvider.onModuleInit's env-var resolution
 * (apps/api/src/lib/auth/firebase-auth.provider.ts) — duplicated rather than
 * imported because that logic is private to the Nest-managed provider
 * lifecycle and this script intentionally does not boot a full Nest
 * application context (it only needs a project-level Admin SDK call, not the
 * database or any business module). Returns null when neither the explicit
 * trio nor FIREBASE_ADMIN_KEY resolve to complete credentials.
 */
export function resolveCredentials(): FirebaseCredentials | null {
  let projectId = process.env['FIREBASE_PROJECT_ID'] ?? ''
  let clientEmail = process.env['FIREBASE_CLIENT_EMAIL'] ?? ''
  let privateKey = process.env['FIREBASE_PRIVATE_KEY'] ?? ''

  if ((!projectId || !clientEmail || !privateKey) && process.env['FIREBASE_ADMIN_KEY']) {
    try {
      const parsed = JSON.parse(process.env['FIREBASE_ADMIN_KEY']) as {
        project_id?: string
        client_email?: string
        private_key?: string
      }
      projectId = projectId || parsed.project_id || ''
      clientEmail = clientEmail || parsed.client_email || ''
      privateKey = privateKey || parsed.private_key || ''
    } catch {
      return null
    }
  }

  if (!projectId || !clientEmail || !privateKey) return null
  return { projectId, clientEmail, privateKey }
}

async function main(): Promise<void> {
  const creds = resolveCredentials()
  if (!creds) {
    console.error(
      'Missing Firebase service account credentials — set FIREBASE_PROJECT_ID + ' +
        'FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY, or FIREBASE_ADMIN_KEY (JSON blob).',
    )
    process.exit(1)
  }

  const app =
    admin.apps.length > 0
      ? (admin.apps[0] as admin.app.App)
      : admin.initializeApp({
          projectId: creds.projectId,
          credential: admin.credential.cert({
            projectId: creds.projectId,
            clientEmail: creds.clientEmail,
            privateKey: creds.privateKey.replace(/\\n/g, '\n'),
          }),
        })

  const manager = app.auth().projectConfigManager()
  const before = await manager.getProjectConfig()
  console.log(`Current multiFactorConfig.state: ${before.multiFactorConfig?.state ?? 'DISABLED'}`)

  const after = await enableTotpMfa({ projectConfigManager: manager })
  console.log(
    `✓ TOTP MFA enabled for project ${creds.projectId}. ` +
      `multiFactorConfig.state=${after.multiFactorConfig?.state}`,
  )
}

/**
 * True when `argvPath` (typically `process.argv[1]`) is this script itself —
 * either the TypeScript source (run via ts-node/tsx) or its compiled
 * `dist/.../enable-totp-mfa.js` counterpart — as opposed to a test file
 * importing this module's exports. Mirrors
 * `apps/api/src/scripts/create-institution.ts`'s `isSelfInvoked`.
 */
export function isSelfInvoked(argvPath: string | undefined): boolean {
  return argvPath !== undefined && /enable-totp-mfa\.(ts|js)$/.test(argvPath)
}

if (isSelfInvoked(process.argv[1])) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
