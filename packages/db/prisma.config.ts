import path from 'node:path'
import { config as loadEnv } from 'dotenv'
import type { PrismaConfig } from 'prisma'

// Load env from monorepo root — single source of truth.
// Path is resolved from this config file's location.
loadEnv({ path: path.resolve(__dirname, '../../.env') })

export default {
  schema: path.join('prisma', 'schema.prisma'),
} satisfies PrismaConfig
