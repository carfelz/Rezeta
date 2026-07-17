import { describe, it, expect, vi } from 'vitest'
import { parseArgs, bootstrapPlatform } from '../create-institution.js'

describe('parseArgs', () => {
  it('parses the platform flags plus optional institution flags', () => {
    const args = parseArgs([
      '--platform-email=staff@rezeta.com',
      '--platform-name=Rezeta Staff',
      '--name=Clínica Norte',
      '--type=clinic',
      '--plan=free',
      '--admin-name=Dra. Ana',
      '--admin-email=ana@clinica.com',
    ])
    expect(args).toEqual({
      platformEmail: 'staff@rezeta.com',
      platformName: 'Rezeta Staff',
      institution: {
        institutionName: 'Clínica Norte',
        type: 'clinic',
        plan: 'free',
        adminFullName: 'Dra. Ana',
        adminEmail: 'ana@clinica.com',
      },
    })
  })

  it('parses a platform-only bootstrap (no institution)', () => {
    const args = parseArgs(['--platform-email=staff@rezeta.com'])
    expect(args.platformEmail).toBe('staff@rezeta.com')
    expect(args.platformName).toBeNull()
    expect(args.institution).toBeNull()
  })

  it('throws when --platform-email is missing', () => {
    expect(() => parseArgs(['--platform-name=Staff'])).toThrow(/platform-email/i)
  })

  it('rejects an institution --type outside the CreateInstitutionSchema enum', () => {
    expect(() =>
      parseArgs([
        '--platform-email=staff@rezeta.com',
        '--name=Clínica Norte',
        '--type=hospital',
        '--plan=free',
        '--admin-name=Dra. Ana',
        '--admin-email=ana@clinica.com',
      ]),
    ).toThrow(/invalid enum value/i)
  })

  it('rejects an institution --plan outside the CreateInstitutionSchema enum', () => {
    expect(() =>
      parseArgs([
        '--platform-email=staff@rezeta.com',
        '--name=Clínica Norte',
        '--type=clinic',
        '--plan=enterprise',
        '--admin-name=Dra. Ana',
        '--admin-email=ana@clinica.com',
      ]),
    ).toThrow(/invalid enum value/i)
  })

  it('rejects a malformed --admin-email', () => {
    expect(() =>
      parseArgs([
        '--platform-email=staff@rezeta.com',
        '--name=Clínica Norte',
        '--type=clinic',
        '--plan=free',
        '--admin-name=Dra. Ana',
        '--admin-email=not-an-email',
      ]),
    ).toThrow(/invalid email/i)
  })
})

describe('bootstrapPlatform', () => {
  function makeDeps() {
    return {
      authProvider: {
        createUser: vi.fn().mockResolvedValue({ externalUid: 'ext-staff' }),
        generatePasswordResetLink: vi.fn().mockResolvedValue('https://reset/link'),
      },
      platformUsers: { create: vi.fn().mockResolvedValue({ id: 'p1', externalUid: 'ext-staff' }) },
      staff: {
        createInstitution: vi
          .fn()
          .mockResolvedValue({ tenantId: 't1', userId: 'u1', email: 'ana@clinica.com' }),
      },
    }
  }

  it('creates the platform identity (Admin SDK + row + reset link) and returns the link', async () => {
    const deps = makeDeps()
    const result = await bootstrapPlatform(deps as never, {
      platformEmail: 'staff@rezeta.com',
      platformName: 'Rezeta Staff',
      institution: null,
    })
    expect(deps.authProvider.createUser).toHaveBeenCalledWith('staff@rezeta.com')
    expect(deps.platformUsers.create).toHaveBeenCalledWith({
      externalUid: 'ext-staff',
      email: 'staff@rezeta.com',
      fullName: 'Rezeta Staff',
    })
    expect(deps.authProvider.generatePasswordResetLink).toHaveBeenCalledWith('staff@rezeta.com')
    expect(result.platformUserId).toBe('p1')
    expect(result.setPasswordLink).toBe('https://reset/link')
    expect(result.institution).toBeNull()
    expect(deps.staff.createInstitution).not.toHaveBeenCalled()
  })

  it('also creates the first institution attributed to the new platform user', async () => {
    const deps = makeDeps()
    const result = await bootstrapPlatform(deps as never, {
      platformEmail: 'staff@rezeta.com',
      platformName: null,
      institution: {
        institutionName: 'Clínica Norte',
        type: 'clinic',
        plan: 'free',
        adminFullName: 'Dra. Ana',
        adminEmail: 'ana@clinica.com',
      },
    })
    expect(deps.platformUsers.create).toHaveBeenCalledWith({
      externalUid: 'ext-staff',
      email: 'staff@rezeta.com',
      fullName: null,
    })
    expect(deps.staff.createInstitution).toHaveBeenCalledWith(
      {
        institutionName: 'Clínica Norte',
        type: 'clinic',
        plan: 'free',
        adminFullName: 'Dra. Ana',
        adminEmail: 'ana@clinica.com',
      },
      'p1',
    )
    expect(result.institution).toEqual({ tenantId: 't1', userId: 'u1', email: 'ana@clinica.com' })
  })
})
