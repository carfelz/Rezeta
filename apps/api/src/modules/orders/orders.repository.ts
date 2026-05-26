import { Injectable, Inject } from '@nestjs/common'
import type {
  Prescription,
  PrescriptionItemRow,
  ImagingOrder,
  ImagingOrderItemRow,
  LabOrder,
  LabOrderItemRow,
} from '@rezeta/shared'
import type {
  CreatePrescriptionGroupDto,
  CreateImagingOrderGroupDto,
  CreateLabOrderGroupDto,
} from '@rezeta/shared'

// Local stubs for types removed from shared in schema reset v2
type PatchImagingOrderDto = { groupOrder?: number | undefined; groupTitle?: string | null | undefined }
type PatchLabOrderDto = { groupOrder?: number | undefined; groupTitle?: string | null | undefined }
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
    createdAt: row.createdAt.toISOString(),
  }
}

function toPrescription(row: {
  id: string
  tenantId: string
  patientId: string
  doctorId: string
  consultationId: string | null
  groupTitle: string | null
  groupOrder: number
  status: string
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
    createdAt: Date
  }>
  pdfUrl: string | null
  signedAt: Date | null
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}): Prescription {
  return {
    id: row.id,
    tenantId: row.tenantId,
    patientId: row.patientId,
    doctorUserId: row.doctorId,
    consultationId: row.consultationId,
    groupTitle: row.groupTitle,
    groupOrder: row.groupOrder,
    status: row.status as Prescription['status'],
    prescriptionItems: row.prescriptionItems.map(toPrescriptionItemRow),
    pdfUrl: row.pdfUrl,
    signedAt: row.signedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

function toImagingOrderItem(row: {
  id: string
  imagingOrderId: string
  studyType: string
  indication: string
  urgency: string
  contrast: boolean
  fastingRequired: boolean
  specialInstructions: string | null
  source: string | null
  createdAt: Date
}): ImagingOrderItemRow {
  return {
    id: row.id,
    imagingOrderId: row.imagingOrderId,
    studyType: row.studyType,
    indication: row.indication,
    urgency: row.urgency as 'routine' | 'urgent' | 'stat',
    contrast: row.contrast,
    fastingRequired: row.fastingRequired,
    specialInstructions: row.specialInstructions,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  }
}

function toLabOrderItem(row: {
  id: string
  labOrderId: string
  testName: string
  indication: string
  urgency: string
  fastingRequired: boolean
  sampleType: string
  specialInstructions: string | null
  source: string | null
  createdAt: Date
}): LabOrderItemRow {
  return {
    id: row.id,
    labOrderId: row.labOrderId,
    testName: row.testName,
    indication: row.indication,
    urgency: row.urgency as 'routine' | 'urgent' | 'stat',
    fastingRequired: row.fastingRequired,
    sampleType: row.sampleType as 'blood' | 'urine' | 'stool' | 'csf' | 'other',
    specialInstructions: row.specialInstructions,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
  }
}

function toImagingOrder(row: {
  id: string
  tenantId: string
  consultationId: string
  patientId: string
  doctorId: string
  groupTitle: string | null
  groupOrder: number
  status: string
  signedAt: Date | null
  pdfUrl: string | null
  items: Array<{
    id: string
    imagingOrderId: string
    studyType: string
    indication: string
    urgency: string
    contrast: boolean
    fastingRequired: boolean
    specialInstructions: string | null
    source: string | null
    createdAt: Date
  }>
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}): ImagingOrder {
  return {
    id: row.id,
    tenantId: row.tenantId,
    consultationId: row.consultationId,
    patientId: row.patientId,
    doctorUserId: row.doctorId,
    groupTitle: row.groupTitle,
    groupOrder: row.groupOrder,
    status: row.status as 'queued' | 'signed',
    signedAt: row.signedAt?.toISOString() ?? null,
    pdfUrl: row.pdfUrl,
    items: row.items.map(toImagingOrderItem),
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
  doctorId: string
  groupTitle: string | null
  groupOrder: number
  status: string
  signedAt: Date | null
  pdfUrl: string | null
  items: Array<{
    id: string
    labOrderId: string
    testName: string
    indication: string
    urgency: string
    fastingRequired: boolean
    sampleType: string
    specialInstructions: string | null
    source: string | null
    createdAt: Date
  }>
  createdAt: Date
  updatedAt: Date
  deletedAt: Date | null
}): LabOrder {
  return {
    id: row.id,
    tenantId: row.tenantId,
    consultationId: row.consultationId,
    patientId: row.patientId,
    doctorUserId: row.doctorId,
    groupTitle: row.groupTitle,
    groupOrder: row.groupOrder,
    status: row.status as 'queued' | 'signed',
    signedAt: row.signedAt?.toISOString() ?? null,
    pdfUrl: row.pdfUrl,
    items: row.items.map(toLabOrderItem),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt?.toISOString() ?? null,
  }
}

const PRESCRIPTION_INCLUDE = {
  prescriptionItems: {
    orderBy: { createdAt: 'asc' as const },
  },
} as const

const IMAGING_ORDER_INCLUDE = {
  items: { orderBy: { createdAt: 'asc' as const } },
} as const

const LAB_ORDER_INCLUDE = {
  items: { orderBy: { createdAt: 'asc' as const } },
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
        doctorId: userId,
        groupTitle: dto.groupTitle ?? null,
        groupOrder: dto.groupOrder,
        status: 'queued',
        prescriptionItems: {
          create: dto.items.map((item) => ({
            drug: item.drug,
            dose: item.dose,
            route: item.route,
            frequency: item.frequency,
            duration: item.duration,
            notes: item.notes ?? null,
            source: item.source ?? null,
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
    const row = await this.prisma.imagingOrder.create({
      data: {
        tenantId,
        consultationId,
        patientId,
        doctorId: userId,
        groupTitle: dto.groupTitle ?? null,
        groupOrder: dto.groupOrder,
        status: 'queued',
        items: {
          create: dto.items.map((item) => ({
            studyType: item.studyType,
            indication: item.indication,
            urgency: item.urgency,
            contrast: item.contrast,
            fastingRequired: item.fastingRequired,
            specialInstructions: item.specialInstructions ?? null,
            source: item.source ?? null,
          })),
        },
      },
      include: IMAGING_ORDER_INCLUDE,
    })
    return [toImagingOrder(row)]
  }

  async findImagingOrderById(id: string, tenantId: string): Promise<ImagingOrder | null> {
    const row = await this.prisma.imagingOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: IMAGING_ORDER_INCLUDE,
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
      include: IMAGING_ORDER_INCLUDE,
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
    const row = await this.prisma.labOrder.create({
      data: {
        tenantId,
        consultationId,
        patientId,
        doctorId: userId,
        groupTitle: dto.groupTitle ?? null,
        groupOrder: dto.groupOrder,
        status: 'queued',
        items: {
          create: dto.items.map((item) => ({
            testName: item.testName,
            indication: item.indication,
            urgency: item.urgency,
            fastingRequired: item.fastingRequired,
            sampleType: item.sampleType,
            specialInstructions: item.specialInstructions ?? null,
            source: item.source ?? null,
          })),
        },
      },
      include: LAB_ORDER_INCLUDE,
    })
    return [toLabOrder(row)]
  }

  async findLabOrderById(id: string, tenantId: string): Promise<LabOrder | null> {
    const row = await this.prisma.labOrder.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: LAB_ORDER_INCLUDE,
    })
    return row ? toLabOrder(row) : null
  }

  async listLabOrdersByConsultation(consultationId: string, tenantId: string): Promise<LabOrder[]> {
    const rows = await this.prisma.labOrder.findMany({
      where: { consultationId, tenantId, deletedAt: null },
      orderBy: [{ groupOrder: 'asc' }, { createdAt: 'asc' }],
      include: LAB_ORDER_INCLUDE,
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

  async patchImagingOrder(
    id: string,
    tenantId: string,
    dto: PatchImagingOrderDto,
  ): Promise<ImagingOrder> {
    const row = await this.prisma.imagingOrder.update({
      where: { id, tenantId },
      data: {
        ...(dto.groupOrder !== undefined ? { groupOrder: dto.groupOrder } : {}),
        ...(dto.groupTitle !== undefined ? { groupTitle: dto.groupTitle } : {}),
      },
      include: IMAGING_ORDER_INCLUDE,
    })
    return toImagingOrder(row)
  }

  async patchLabOrder(id: string, tenantId: string, dto: PatchLabOrderDto): Promise<LabOrder> {
    const row = await this.prisma.labOrder.update({
      where: { id, tenantId },
      data: {
        ...(dto.groupOrder !== undefined ? { groupOrder: dto.groupOrder } : {}),
        ...(dto.groupTitle !== undefined ? { groupTitle: dto.groupTitle } : {}),
      },
      include: LAB_ORDER_INCLUDE,
    })
    return toLabOrder(row)
  }

  async renameImagingOrderGroup(
    consultationId: string,
    groupOrder: number,
    tenantId: string,
    groupTitle: string | null,
  ): Promise<ImagingOrder[]> {
    await this.prisma.imagingOrder.updateMany({
      where: { consultationId, groupOrder, tenantId, deletedAt: null },
      data: { groupTitle },
    })
    return this.listImagingOrdersByConsultation(consultationId, tenantId)
  }

  async renameLabOrderGroup(
    consultationId: string,
    groupOrder: number,
    tenantId: string,
    groupTitle: string | null,
  ): Promise<LabOrder[]> {
    await this.prisma.labOrder.updateMany({
      where: { consultationId, groupOrder, tenantId, deletedAt: null },
      data: { groupTitle },
    })
    return this.listLabOrdersByConsultation(consultationId, tenantId)
  }
}
