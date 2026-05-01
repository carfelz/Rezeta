import { describe, it, expect, afterEach } from 'vitest'
import { configuration } from '../configuration.js'

describe('configuration', () => {
  const orig = { ...process.env }

  afterEach(() => {
    // Restore env
    for (const key of Object.keys(process.env)) {
      if (!(key in orig)) delete process.env[key]
    }
    Object.assign(process.env, orig)
  })

  it('returns default port 3000 when PORT not set', () => {
    delete process.env.PORT
    expect(configuration().port).toBe(3000)
  })

  it('parses PORT from environment', () => {
    process.env.PORT = '8080'
    expect(configuration().port).toBe(8080)
  })

  it('returns DATABASE_URL from environment', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test'
    expect(configuration().database.url).toBe('postgresql://localhost/test')
  })

  it('returns firebase config from environment', () => {
    process.env.FIREBASE_PROJECT_ID = 'my-project'
    process.env.FIREBASE_CLIENT_EMAIL = 'svc@my-project.iam.gserviceaccount.com'
    process.env.FIREBASE_PRIVATE_KEY = 'key'
    process.env.FIREBASE_WEB_API_KEY = 'web-key'
    const cfg = configuration()
    expect(cfg.firebase.projectId).toBe('my-project')
    expect(cfg.firebase.clientEmail).toBe('svc@my-project.iam.gserviceaccount.com')
    expect(cfg.firebase.webApiKey).toBe('web-key')
  })

  it('replaces \\n with newlines in private key', () => {
    process.env.FIREBASE_PRIVATE_KEY = 'line1\\nline2'
    expect(configuration().firebase.privateKey).toBe('line1\nline2')
  })

  it('returns GCS bucket from environment', () => {
    process.env.GCS_BUCKET = 'my-bucket'
    expect(configuration().storage.bucket).toBe('my-bucket')
  })

  it('defaults nodeEnv to development', () => {
    delete process.env.NODE_ENV
    expect(configuration().nodeEnv).toBe('development')
  })

  it('returns NODE_ENV from environment', () => {
    process.env.NODE_ENV = 'production'
    expect(configuration().nodeEnv).toBe('production')
  })
})
