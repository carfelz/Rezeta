import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../lib/prisma.service.js'
import { PdfService } from '../../lib/pdf.service.js'
import { AuditLogService } from '../../common/audit-log/audit-log.service.js'
import { httpAuditContextStore } from '../../common/audit-log/audit-context.store.js'
import {
  InvoicesRepository,
  type InvoiceListParams,
  type InvoiceRow,
} from './invoices.repository.js'
import type {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  UpdateInvoiceStatusDto,
  InvoiceWithDetails,
  InvoiceStatus,
  Currency,
} from '@rezeta/shared'

interface InvoiceListResult {
  items: InvoiceWithDetails[]
  hasMore: boolean
  nextCursor: string | undefined
}

@Injectable()
export class InvoicesService {
  constructor(
    @Inject(InvoicesRepository) private repo: InvoicesRepository,
    @Inject(PrismaService) private prisma: PrismaService,
    @Inject(PdfService) private pdf: PdfService,
    @Inject(AuditLogService) private auditLog: AuditLogService,
  ) {}

  async list(params: InvoiceListParams): Promise<InvoiceListResult> {
    const limit = params.limit ?? 50
    const rows = await this.repo.findMany({ ...params, limit })
    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows
    const nextCursor = hasMore ? items[items.length - 1]?.id : undefined
    return { items: items.map((r) => this.toDto(r)), hasMore, nextCursor }
  }

  async getById(id: string, tenantId: string): Promise<InvoiceWithDetails> {
    const row = await this.repo.findById(id, tenantId)
    if (!row) throw new NotFoundException('Invoice not found')
    return this.toDto(row)
  }

  async create(
    tenantId: string,
    userId: string,
    dto: CreateInvoiceDto,
  ): Promise<InvoiceWithDetails> {
    const location = await this.prisma.location.findFirst({
      where: { id: dto.locationId, tenantId, deletedAt: null },
      select: { commissionPercent: true },
    })
    if (!location) throw new NotFoundException('Location not found')

    const commissionPct = Number(location.commissionPercent)
    const row = await this.repo.create(tenantId, userId, dto, commissionPct)
    return this.toDto(row)
  }

  async update(id: string, tenantId: string, dto: UpdateInvoiceDto): Promise<InvoiceWithDetails> {
    const existing = await this.repo.findById(id, tenantId)
    if (!existing) throw new NotFoundException('Invoice not found')
    if (existing.status !== 'draft') {
      throw new BadRequestException('Only draft invoices can be edited')
    }
    const row = await this.repo.update(id, tenantId, dto)
    return this.toDto(row)
  }

  async updateStatus(
    id: string,
    tenantId: string,
    dto: UpdateInvoiceStatusDto,
  ): Promise<InvoiceWithDetails> {
    const existing = await this.repo.findById(id, tenantId)
    if (!existing) throw new NotFoundException('Invoice not found')

    const allowed = this.allowedTransitions(existing.status)
    if (!allowed.includes(dto.status)) {
      throw new BadRequestException(
        `Cannot transition from '${existing.status}' to '${dto.status}'`,
      )
    }

    const row = await this.repo.updateStatus(id, tenantId, dto.status, dto.paymentMethod)

    const httpCtx = httpAuditContextStore.getStore()
    const actorType: 'user' | 'system' = httpCtx ? 'user' : 'system'
    const actorBase = {
      tenantId,
      ...(httpCtx?.actorUserId ? { actorUserId: httpCtx.actorUserId } : {}),
      actorType,
      entityType: 'Invoice' as const,
      entityId: id,
      status: 'success' as const,
    }

    if (dto.status === 'issued') {
      void this.auditLog.record({
        ...actorBase,
        category: 'system',
        action: 'invoice_issued',
        metadata: { invoiceNumber: row.invoiceNumber },
      })
    } else {
      void this.auditLog.record({
        ...actorBase,
        category: 'entity',
        action: 'update',
        changes: { status: { before: existing.status, after: dto.status } },
      })
    }

    return this.toDto(row)
  }

  async delete(id: string, tenantId: string): Promise<void> {
    const existing = await this.repo.findById(id, tenantId)
    if (!existing) throw new NotFoundException('Invoice not found')
    if (existing.status === 'issued' || existing.status === 'paid') {
      throw new BadRequestException('Cannot delete issued or paid invoices')
    }
    await this.repo.softDelete(id, tenantId)
  }

  async createFromConsultation(params: {
    consultationId: string
    patientId: string
    locationId: string
    userId: string
    tenantId: string
  }): Promise<void> {
    const dl = await this.prisma.doctorLocation.findFirst({
      where: { userId: params.userId, locationId: params.locationId },
      select: { consultationFee: true, commissionPct: true },
    })

    if (!dl || Number(dl.consultationFee) === 0) return

    const fee = Number(dl.consultationFee)
    const commissionPct = Number(dl.commissionPct)

    await this.repo.create(
      params.tenantId,
      params.userId,
      {
        patientId: params.patientId,
        locationId: params.locationId,
        consultationId: params.consultationId,
        currency: 'DOP',
        items: [{ description: 'Consulta médica', quantity: 1, unitPrice: fee, total: fee }],
      },
      commissionPct,
    )
  }

  async getInvoicePdf(id: string, tenantId: string): Promise<Buffer> {
    const invoice = await this.getById(id, tenantId)

    const doctor = await this.prisma.user.findFirst({
      where: { id: invoice.doctorUserId },
      select: { fullName: true, specialty: true, licenseNumber: true },
    })

    const buffer = await this.pdf.generateInvoice({
      invoice,
      doctor: {
        fullName: doctor?.fullName ?? null,
        specialty: doctor?.specialty ?? null,
        licenseNumber: doctor?.licenseNumber ?? null,
      },
    })

    const httpCtx = httpAuditContextStore.getStore()
    void this.auditLog.record({
      tenantId,
      ...(httpCtx?.actorUserId ? { actorUserId: httpCtx.actorUserId } : {}),
      actorType: httpCtx ? 'user' : 'system',
      category: 'communication',
      action: 'pdf_generated',
      entityType: 'Invoice',
      entityId: id,
      metadata: { documentType: 'invoice', invoiceNumber: invoice.invoiceNumber },
      status: 'success',
    })

    return buffer
  }

  private allowedTransitions(current: string): string[] {
    switch (current) {
      case 'draft':
        return ['issued', 'cancelled']
      case 'issued':
        return ['paid', 'cancelled']
      default:
        return []
    }
  }

  private toDto(row: InvoiceRow): InvoiceWithDetails {
    return {
      id: row.id,
      tenantId: row.tenantId,
      patientId: row.patientId,
      doctorUserId: row.userId,
      locationId: row.locationId,
      consultationId: row.consultationId,
      invoiceNumber: row.invoiceNumber,
      status: row.status as InvoiceStatus,
      currency: row.currency as Currency,
      subtotal: Number(row.subtotal),
      tax: Number(row.tax),
      commissionAmount: Number(row.commissionAmount),
      commissionPercent: Number(row.commissionPercent),
      netToDoctor: Number(row.netToDoctor),
      total: Number(row.total),
      paymentMethod: row.paymentMethod,
      issuedAt: row.issuedAt?.toISOString() ?? null,
      paidAt: row.paidAt?.toISOString() ?? null,
      dueDate: row.dueDate?.toISOString() ?? null,
      notes: row.notes,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      deletedAt: row.deletedAt?.toISOString() ?? null,
      items: row.items.map((it) => ({
        id: it.id,
        invoiceId: it.invoiceId,
        description: it.description,
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        total: Number(it.total),
      })),
      patientName: `${row.patient.firstName} ${row.patient.lastName}`.trim(),
      locationName: row.location.name,
    }
  }
}
