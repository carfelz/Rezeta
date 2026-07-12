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

/** Round to 2 decimal places — money is 2dp DOP. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

/**
 * Recompute each line total from quantity * unitPrice (never trusting the
 * client-supplied `total`) and derive the invoice subtotal from those.
 */
function computeLineTotals(
  items: { description: string; quantity: number; unitPrice: number }[],
): { lineTotals: number[]; subtotal: number } {
  const lineTotals = items.map((it) => round2(it.quantity * it.unitPrice))
  const subtotal = round2(lineTotals.reduce((sum, t) => sum + t, 0))
  return { lineTotals, subtotal }
}

/**
 * Round the commission first, then derive net as the remainder, so the two
 * parts always reconcile with the subtotal to the cent.
 */
function splitCommission(
  subtotal: number,
  commissionPercent: number,
): { commissionAmount: number; netToDoctor: number } {
  const commissionAmount = round2((subtotal * commissionPercent) / 100)
  const netToDoctor = round2(subtotal) - commissionAmount
  return { commissionAmount, netToDoctor }
}

/** Number of attempts to place an invoice number before giving up on P2002 races. */
const MAX_INVOICE_NUMBER_ATTEMPTS = 5

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
    const { lineTotals, subtotal } = computeLineTotals(dto.items)
    const tax = 0
    const { commissionAmount, netToDoctor } = splitCommission(subtotal, commissionPercent)
    const total = round2(subtotal + tax)

    const itemsCreate = dto.items.map((it, i) => ({
      description: it.description,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      total: lineTotals[i]!,
    }))

    // The invoice number is generated count-then-create, which can race under
    // concurrency. The partial unique index on (tenant_id, invoice_number)
    // rejects a collision with P2002; retry with a freshly recomputed number.
    for (let attempt = 0; attempt < MAX_INVOICE_NUMBER_ATTEMPTS; attempt++) {
      const invoiceNumber = await this.nextInvoiceNumber(tenantId)
      try {
        return await this.prisma.invoice.create({
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
            items: { create: itemsCreate },
          },
          include: BASE_INCLUDE,
        })
      } catch (err) {
        if (this.isUniqueViolation(err) && attempt < MAX_INVOICE_NUMBER_ATTEMPTS - 1) {
          continue
        }
        throw err
      }
    }
    // Unreachable: the loop either returns or throws on the final attempt.
    throw new Error('Failed to allocate an invoice number')
  }

  async update(id: string, tenantId: string, dto: UpdateInvoiceDto): Promise<InvoiceRow> {
    const data: Record<string, unknown> = {}
    if (dto.currency) data['currency'] = dto.currency
    if (dto.notes !== undefined) data['notes'] = dto.notes ?? null

    if (dto.items) {
      const { lineTotals, subtotal } = computeLineTotals(dto.items)
      const existing = await this.prisma.invoice.findFirstOrThrow({
        where: { id, tenantId },
        select: { commissionPercent: true, tax: true },
      })
      const commissionPct = Number(existing.commissionPercent)
      const tax = Number(existing.tax)
      const { commissionAmount, netToDoctor } = splitCommission(subtotal, commissionPct)
      data['subtotal'] = subtotal
      data['commissionAmount'] = commissionAmount
      data['netToDoctor'] = netToDoctor
      data['total'] = round2(subtotal + tax)

      await this.prisma.invoiceItem.deleteMany({
        where: { invoiceId: id, invoice: { tenantId } },
      })
      data['items'] = {
        create: dto.items.map((it, i) => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: lineTotals[i]!,
        })),
      }
    }

    return this.prisma.invoice.update({
      where: { id, tenantId },
      data,
      include: BASE_INCLUDE,
    })
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: string,
    paymentMethod?: string | null,
  ): Promise<InvoiceRow> {
    return this.prisma.invoice.update({
      where: { id, tenantId },
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

  /** Structural check for Prisma's unique-constraint violation, without importing Prisma types. */
  private isUniqueViolation(err: unknown): err is { code: string } {
    return (
      err !== null &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    )
  }
}
