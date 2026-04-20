export interface AppConfig {
  port: number
  database: { url: string }
  firebase: {
    projectId: string
    clientEmail: string
    privateKey: string
    emulatorHost: string
  }
  storage: { bucket: string }
  nodeEnv: string
}

export const configuration = (): AppConfig => ({
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  database: {
    url: process.env['DATABASE_URL'] ?? '',
  },
  firebase: {
    projectId: process.env['FIREBASE_PROJECT_ID'] ?? '',
    clientEmail: process.env['FIREBASE_CLIENT_EMAIL'] ?? '',
    privateKey: (process.env['FIREBASE_PRIVATE_KEY'] ?? '').replace(/\\n/g, '\n'),
    emulatorHost: process.env['FIREBASE_AUTH_EMULATOR_HOST'] ?? '',
  },
  storage: {
    bucket: process.env['GCS_BUCKET'] ?? '',
  },
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
})
