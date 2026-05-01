import { Injectable, Inject } from '@nestjs/common'
import type { Prescription, PrescriptionItemRow, ImagingOrder, LabOrder } from '@rezeta/shared'
import type {
  CreatePrescriptionGroupDto,
  CreateImagingOrderGroupDto,
  CreateLabOrderGroupDto,
} from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'

function toPrescriptionItemRow(row: {
  id: string
  prescriptionId: string
  drug: string
  dose: string
  route: string
  frequency: string
  duration: string
  notes: string | null
  source: string | null
  sortOrder: number
  createdAt: Date
}): PrescriptionItemRow {
  return {
    id: row.id,
    prescriptionId: row.prescriptionId,
    drug: row.drug,
    dose: row.dose,
    route: row.route,
    frequency: row.frequency,
    duration: row.duration,
    notes: row.notes,
    source: row.source,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  }
}

function toPrescription(row: {
  id: string
  tenantId: string
  patientId: string
  userId: string
  consultationId: string | null
  groupTitle: string | null
  groupOrder: number
  status: string
  items: unknown
  prescriptionItems: Array<{
    id: string
    prescriptionId: string
    drug: string
    dose: string
    route: string
    frequency: string
    duration: string
    notes: string | null
    source: string | null
    sortOrder: number
    createdAt: Date
  }>
  pdfUrl: string | null
  notes: string | null
  signedAt: Date | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}): Prescription {
  return {
    id: row.id,
    tenantId: row.tenantId,
    patientId: row.patientId,
    doctorUserId: row.userId,
    consultationId: row.consultationId,
    groupTitle: row.groupTitle,
    groupOrder: row.groupOrder,
    status: row.status as Prescription['status'],
    items: (row.items as Prescription['items']) ?? [],
    prescriptionItems: row.prescriptionItems.map(toPrescriptionItemRow),
    pdfUrl: row.pdfUrl,
    notes: row.notes,
    signedAt: row.signedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

function toImagingOrder(row: {
  id: string
  tenantId: string
  consultationId: string
  patientId: string
  userId: string
  groupTitle: string | null
  groupOrder: number
  studyType: string
  indication: string
  urgency: string
  contrast: boolean
  fastingRequired: boolean
  specialInstructions: string | null
  source: string | null
  status: string
  signedAt: Date | null
  pdfUrl: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}): ImagingOrder {
  return {
    id: row.id,
    tenantId: row.tenantId,
    consultationId: row.consultationId,
    patientId: row.patientId,
    doctorUserId: row.userId,
    groupTitle: row.groupTitle,
    groupOrder: row.groupOrder,
    studyType: row.studyType,
    indication: row.indication,
    urgency: row.urgency as 'routine' | 'urgent' | 'stat',
    contrast: row.contrast,
    fastingRequired: row.fastingRequired,
    specialInstructions: row.specialInstructions,
    source: row.source,
    status: row.status as 'draft' | 'signed',
    signedAt: row.signedAt?.toISOString() ?? null,
    pdfUrl: row.pdfUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

function toLabOrder(row: {
  id: string
  tenantId: string
  consultationId: string
  patientId: string
  userId: string
  groupTitle: string | null
  groupOrder: number
  testName: string
  testCode: string | null
  indication: string
  urgency: string
  fastingRequired: boolean
  sampleType: string
  specialInstructions: string | null
  source: string | null
  status: string
  signedAt: Date | null
  pdfUrl: string | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}): LabOrder {
  return {
    id: row.id,
    tenantId: row.tenantId,
    consultationId: row.consultationId,
    patientId: row.patientId,
    doctorUserId: row.userId,
    groupTitle: row.groupTitle,
    groupOrder: row.groupOrder,
    testName: row.testName,
    testCode: row.testCode,
    indication: row.indication,
    urgency: row.urgency as 'routine' | 'urgent' | 'stat',
    fastingRequired: row.fastingRequired,
    sampleType: row.sampleType as 'blood' | 'urine' | 'stool' | 'other',
    specialInstructions: row.specialInstructions,
    source: row.source,
    status: row.status as 'draft' | 'signed',
    signedAt: row.signedAt?.toISOString() ?? null,
    pdfUrl: row.pdfUrl,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

const PRESCRIPTION_INCLUDE = {
  prescriptionItems: {
    orderBy: { sortOrder: 'asc' as const },
  },
} as const

@Injectable()
export class OrdersRepository {
  constructor(@Inject(PrismaService) private prisma: PrismaService) {}

  async createPrescription(
    tenantId: string,
    consultationId: string,
    patientId: string,
    userId: string,
    dto: CreatePrescriptionGroupDto,
  ): Promise<Prescription> {
    const row = await this.prisma.prescription.create({
      data: {
        tenantId,
        consultationId,
        patientId,
        userId,
        groupTitle: dto.groupTitle ?? null,
        groupOrder: dto.groupOrder,
        status: 'draft',
        items: dto.items,
        prescriptionItems: {
          create: dto.items.map((item, idx) => ({
            drug: item.drug,
            dose: item.dose,
            route: item.route,
            frequency: item.frequency,
            duration: item.duration,
            notes: item.notes ?? null,
            source: item.source ?? null,
            sortOrder: idx + 1,
          })),
        },
      },
      include: PRESCRIPTION_INCLUDE,
    })
    return toPrescription(row)
  }

  async findPrescriptionById(id: string, tenantId: string): Promise<Prescription | null> {
    const row = await this.prisma.prescription.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: PRESCRIPTION_INCLUDE,
    })
    return row ? toPrescription(row) : null
  }

  async listPrescriptionsByConsultation(
    consultationId: string,
    tenantId: string,
  ): Promise<Prescription[]> {
    const rows = await this.prisma.prescription.findMany({
      where: { consultationId, tenantId, deletedAt: null },
      orderBy: { groupOrder: 'asc' },
      include: PRESCRIPTION_INCLUDE,
    })
    return rows.map(toPrescription)
  }

  async updatePrescriptionPdfUrl(id: string, tenantId: string, pdfUrl: string): Promise<void> {
    await this.prisma.prescription.update({
      where: { id },
      data: { pdfUrl },
    })
  }

  async createImagingOrder(
    tenantId: string,
    consultationId: string,
    patientId: string,
    userId: string,
    dto: CreateImagingOrderGroupDto,
  ): Promise<ImagingOrder[]> {
    const rows = await Promise.all(
      dto.orders.map((order) =>
        this.prisma.imagingOrder.create({
          data: {
            tenantId,
            consultationId,
            patientId,
            userId,
            groupTitle: dto.groupTitle ?? null,
            groupOrder: dto.groupOrder,
            studyType: order.study_type,
            indication: order.indication,
            urgency: order.urgency,
            contrast: order.contrast,
            fastingRequired: order.fasting_required,
            specialInstructions: order.special_instructions ?? null,
            source: order.source ?? null,
            status: 'draft',
          },
        }),
      ),
    )
    return rows.map(toImagingOrder)
  }

  async findImagingOrderById(id: string, tenantId: string): Promise<ImagingOrder | null> {
    const row = await this.prisma.imagingOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    return row ? toImagingOrder(row) : null
  }

  async listImagingOrdersByConsultation(
    consultationId: string,
    tenantId: string,
  ): Promise<ImagingOrder[]> {
    const rows = await this.prisma.imagingOrder.findMany({
      where: { consultationId, tenantId, deletedAt: null },
      orderBy: [{ groupOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return rows.map(toImagingOrder)
  }

  async createLabOrder(
    tenantId: string,
    consultationId: string,
    patientId: string,
    userId: string,
    dto: CreateLabOrderGroupDto,
  ): Promise<LabOrder[]> {
    const rows = await Promise.all(
      dto.orders.map((order) =>
        this.prisma.labOrder.create({
          data: {
            tenantId,
            consultationId,
            patientId,
            userId,
            groupTitle: dto.groupTitle ?? null,
            groupOrder: dto.groupOrder,
            testName: order.test_name,
            testCode: order.test_code ?? null,
            indication: order.indication,
            urgency: order.urgency,
            fastingRequired: order.fasting_required,
            sampleType: order.sample_type,
            specialInstructions: order.special_instructions ?? null,
            source: order.source ?? null,
            status: 'draft',
          },
        }),
      ),
    )
    return rows.map(toLabOrder)
  }

  async findLabOrderById(id: string, tenantId: string): Promise<LabOrder | null> {
    const row = await this.prisma.labOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
    })
    return row ? toLabOrder(row) : null
  }

  async listLabOrdersByConsultation(consultationId: string, tenantId: string): Promise<LabOrder[]> {
    const rows = await this.prisma.labOrder.findMany({
      where: { consultationId, tenantId, deletedAt: null },
      orderBy: [{ groupOrder: 'asc' }, { createdAt: 'asc' }],
    })
    return rows.map(toLabOrder)
  }

  async softDeletePrescription(id: string, tenantId: string): Promise<void> {
    await this.prisma.prescription.update({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    })
  }

  async softDeleteImagingOrder(id: string, tenantId: string): Promise<void> {
    await this.prisma.imagingOrder.update({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    })
  }

  async softDeleteLabOrder(id: string, tenantId: string): Promise<void> {
    await this.prisma.labOrder.update({
      where: { id, tenantId },
      data: { deletedAt: new Date() },
    })
  }
}
