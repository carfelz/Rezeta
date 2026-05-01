import { Injectable, Inject } from '@nestjs/common'
import { Prisma } from '@rezeta/db'
import { PrismaService } from '../../lib/prisma.service.js'
import type { CreateInvoiceDto, UpdateInvoiceDto } from '@rezeta/shared'

export interface InvoiceListParams {
  tenantId: string
  userId: string
  status?: string
  patientId?: string
  locationId?: string
  cursor?: string
  limit?: number
}

const BASE_INCLUDE = {
  items: true,
  patient: { select: { firstName: true, lastName: true } },
  location: { select: { name: true } },
} as const

export type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof BASE_INCLUDE }>

@Injectable()
export class InvoicesRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async findMany({
    tenantId,
    userId,
    status,
    patientId,
    locationId,
    cursor,
    limit = 50,
  }: InvoiceListParams): Promise<InvoiceRow[]> {
    return this.prisma.invoice.findMany({
      where: {
        tenantId,
        userId,
        deletedAt: null,
        ...(status ? { status } : {}),
        ...(patientId ? { patientId } : {}),
        ...(locationId ? { locationId } : {}),
      },
      include: BASE_INCLUDE,
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
  }

  async findById(id: string, tenantId: string): Promise<InvoiceRow | null> {
    return this.prisma.invoice.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: BASE_INCLUDE,
    })
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateInvoiceDto,
    commissionPercent: number,
  ): Promise<InvoiceRow> {
    const subtotal = dto.items.reduce((sum, it) => sum + it.total, 0)
    const tax = 0
    const commissionAmount = (subtotal * commissionPercent) / 100
    const netToDoctor = subtotal - commissionAmount
    const total = subtotal + tax

    const invoiceNumber = await this.nextInvoiceNumber(tenantId)

    return this.prisma.invoice.create({
      data: {
        tenantId,
        userId,
        patientId: dto.patientId,
        locationId: dto.locationId,
        consultationId: dto.consultationId ?? null,
        invoiceNumber,
        currency: dto.currency ?? 'DOP',
        status: 'draft',
        subtotal,
        tax,
        commissionPercent,
        commissionAmount,
        netToDoctor,
        total,
        notes: dto.notes ?? null,
        items: {
          create: dto.items.map((it) => ({
            description: it.description,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            total: it.total,
          })),
        },
      },
      include: BASE_INCLUDE,
    })
  }

  async update(id: string, tenantId: string, dto: UpdateInvoiceDto): Promise<InvoiceRow> {
    const data: Record<string, unknown> = {}
    if (dto.currency) data['currency'] = dto.currency
    if (dto.notes !== undefined) data['notes'] = dto.notes ?? null

    if (dto.items) {
      const subtotal = dto.items.reduce((sum, it) => sum + it.total, 0)
      const existing = await this.prisma.invoice.findFirstOrThrow({
        where: { id, tenantId },
        select: { commissionPercent: true },
      })
      const commissionPct = Number(existing.commissionPercent)
      const commissionAmount = (subtotal * commissionPct) / 100
      data['subtotal'] = subtotal
      data['commissionAmount'] = commissionAmount
      data['netToDoctor'] = subtotal - commissionAmount
      data['total'] = subtotal

      await this.prisma.invoiceItem.deleteMany({ where: { invoiceId: id } })
      data['items'] = {
        create: dto.items.map((it) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total,
        })),
      }
    }

    return this.prisma.invoice.update({
      where: { id },
      data,
      include: BASE_INCLUDE,
    })
  }

  async updateStatus(
    id: string,
    _tenantId: string,
    status: string,
    paymentMethod?: string | null,
  ): Promise<InvoiceRow> {
    return this.prisma.invoice.update({
      where: { id },
      data: {
        status,
        ...(status === 'issued' ? { issuedAt: new Date() } : {}),
        ...(status === 'paid' ? { paidAt: new Date(), paymentMethod: paymentMethod ?? null } : {}),
      },
      include: BASE_INCLUDE,
    })
  }

  async softDelete(id: string, tenantId: string): Promise<void> {
    await this.prisma.invoice.update({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    })
  }

  private async nextInvoiceNumber(tenantId: string): Promise<string> {
    const year = new Date().getFullYear()
    const count = await this.prisma.invoice.count({
      where: { tenantId, invoiceNumber: { startsWith: `F-${year}-` } },
    })
    const seq = String(count + 1).padStart(5, '0')
    return `F-${year}-${seq}`
  }
}
