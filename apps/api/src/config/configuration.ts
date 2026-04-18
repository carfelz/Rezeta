export const configuration = () => ({
  port: parseInt(process.env['PORT'] ?? '3000', 10),
  database: {
    url: process.env['DATABASE_URL'] ?? '',
  },
  firebase: {
    projectId: process.env['FIREBASE_PROJECT_ID'] ?? '',
    clientEmail: process.env['FIREBASE_CLIENT_EMAIL'] ?? '',
    privateKey: (process.env['FIREBASE_PRIVATE_KEY'] ?? '').replace(/\\n/g, '\n'),
  },
  storage: {
    bucket: process.env['GCS_BUCKET'] ?? '',
  },
  nodeEnv: process.env['NODE_ENV'] ?? 'development',
})

export type AppConfig = ReturnType<typeof configuration>
