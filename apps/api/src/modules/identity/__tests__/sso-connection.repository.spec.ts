/* eslint-disable @typescript-eslint/unbound-method */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SsoConnectionRepository } from '../sso-connection.repository.js'
import type { PrismaService } from '../../../lib/prisma.service.js'

const prisma = {
  ssoConnection: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
} as unknown as PrismaService

function makeRepo(): SsoConnectionRepository {
  return new SsoConnectionRepository(prisma)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('SsoConnectionRepository', () => {
  it('listAll returns non-deleted connections with tenant name, newest first', async () => {
    vi.mocked(prisma.ssoConnection.findMany).mockResolvedValue([])
    await makeRepo().listAll()
    expect(prisma.ssoConnection.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
      include: { tenant: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    })
  })

  it('findById retrieves a connection by id and filters out deleted rows', async () => {
    vi.mocked(prisma.ssoConnection.findFirst).mockResolvedValue(null)
    await makeRepo().findById('c1')
    expect(prisma.ssoConnection.findFirst).toHaveBeenCalledWith({
      where: { id: 'c1', deletedAt: null },
    })
  })

  it('findById returns the row when found', async () => {
    const row = {
      id: 'c1',
      tenantId: 't1',
      type: 'oidc',
      providerId: 'p1',
      displayName: 'Azure AD',
      issuerUrl: 'https://login.microsoftonline.com',
      clientId: 'client1',
      domains: ['example.com'],
      allowPassword: true,
      status: 'active',
      createdAt: new Date('2026-07-01T00:00:00Z'),
      deletedAt: null,
    }
    vi.mocked(prisma.ssoConnection.findFirst).mockResolvedValue(row as never)
    const result = await makeRepo().findById('c1')
    expect(result).toBe(row)
  })

  it('findActiveByDomain filters on active status, not-deleted, and domain membership', async () => {
    vi.mocked(prisma.ssoConnection.findFirst).mockResolvedValue(null)
    await makeRepo().findActiveByDomain('clinica.do')
    expect(prisma.ssoConnection.findFirst).toHaveBeenCalledWith({
      where: { status: 'active', deletedAt: null, domains: { has: 'clinica.do' } },
    })
  })

  it('findActiveClaimingDomains filters on active status and domain hasSome without excludeId', async () => {
    vi.mocked(prisma.ssoConnection.findMany).mockResolvedValue([])
    await makeRepo().findActiveClaimingDomains(['a.do', 'b.do'])
    expect(prisma.ssoConnection.findMany).toHaveBeenCalledWith({
      where: { status: 'active', deletedAt: null, domains: { hasSome: ['a.do', 'b.do'] } },
    })
  })

  it('findActiveClaimingDomains excludes the given id', async () => {
    vi.mocked(prisma.ssoConnection.findMany).mockResolvedValue([])
    await makeRepo().findActiveClaimingDomains(['a.do', 'b.do'], 'c1')
    expect(prisma.ssoConnection.findMany).toHaveBeenCalledWith({
      where: { status: 'active', deletedAt: null, domains: { hasSome: ['a.do', 'b.do'] }, id: { not: 'c1' } },
    })
  })

  it('create writes the connection with the given fields', async () => {
    vi.mocked(prisma.ssoConnection.create).mockResolvedValue({} as never)
    const input = {
      tenantId: 't1',
      providerId: 'p1',
      displayName: 'Azure AD',
      issuerUrl: 'https://login.microsoftonline.com',
      clientId: 'client1',
      domains: ['example.com'],
      allowPassword: true,
    }
    await makeRepo().create(input)
    expect(prisma.ssoConnection.create).toHaveBeenCalledWith({
      data: input,
      include: { tenant: { select: { name: true } } },
    })
  })

  it('update modifies the specified fields and scopes by tenantId', async () => {
    vi.mocked(prisma.ssoConnection.update).mockResolvedValue({} as never)
    const updates = {
      displayName: 'New Name',
      status: 'inactive',
    }
    await makeRepo().update('c1', 't1', updates)
    expect(prisma.ssoConnection.update).toHaveBeenCalledWith({
      where: { id: 'c1', tenantId: 't1' },
      data: updates,
      include: { tenant: { select: { name: true } } },
    })
  })

  it('softDelete stamps deletedAt with a Date and scopes by tenantId', async () => {
    vi.mocked(prisma.ssoConnection.update).mockResolvedValue({} as never)
    await makeRepo().softDelete('c1', 't1')
    const call = vi.mocked(prisma.ssoConnection.update).mock.calls[0] as unknown as [
      { where: unknown; data: unknown },
    ]
    const { where, data } = call[0]
    expect(where).toEqual({ id: 'c1', tenantId: 't1' })
    expect((data as Record<string, unknown>).deletedAt).toBeInstanceOf(Date)
  })
})
