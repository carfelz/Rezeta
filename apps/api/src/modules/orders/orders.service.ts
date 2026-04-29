import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import type { Prescription, ImagingOrder, LabOrder } from '@rezeta/shared'
import type {
  CreatePrescriptionGroupDto,
  CreateImagingOrderGroupDto,
  CreateLabOrderGroupDto,
  GenerateAllOrdersDto,
} from '@rezeta/shared'
import { ErrorCode } from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'
import { OrdersRepository } from './orders.repository.js'

export interface GenerateAllOrdersResult {
  prescriptions: Prescription[]
  imagingOrders: ImagingOrder[]
  labOrders: LabOrder[]
}

@Injectable()
export class OrdersService {
  constructor(
    @Inject(OrdersRepository) private repo: OrdersRepository,
    @Inject(PrismaService) private prisma: PrismaService,
  ) {}

  private async getConsultationPatient(consultationId: string, tenantId: string): Promise<string> {
    const consultation = await this.prisma.consultation.findFirst({
      where: { id: consultationId, tenantId, deletedAt: null },
      select: { patientId: true },
    })
    if (!consultation) {
      throw new NotFoundException({
        code: ErrorCode.CONSULTATION_NOT_FOUND,
        message: 'Consultation not found',
      })
    }
    return consultation.patientId
  }

  async createPrescription(
    consultationId: string,
    tenantId: string,
    userId: string,
    dto: CreatePrescriptionGroupDto,
  ): Promise<Prescription> {
    const patientId = await this.getConsultationPatient(consultationId, tenantId)
    return this.repo.createPrescription(tenantId, consultationId, patientId, userId, dto)
  }

  async listPrescriptions(consultationId: string, tenantId: string): Promise<Prescription[]> {
    await this.getConsultationPatient(consultationId, tenantId)
    return this.repo.listPrescriptionsByConsultation(consultationId, tenantId)
  }

  async getPrescription(
    consultationId: string,
    prescriptionId: string,
    tenantId: string,
  ): Promise<Prescription> {
    await this.getConsultationPatient(consultationId, tenantId)
    const p = await this.repo.findPrescriptionById(prescriptionId, tenantId)
    if (!p || p.consultationId !== consultationId) {
      throw new NotFoundException({
        code: ErrorCode.PRESCRIPTION_NOT_FOUND,
        message: 'Prescription not found',
      })
    }
    return p
  }

  async createImagingOrder(
    consultationId: string,
    tenantId: string,
    userId: string,
    dto: CreateImagingOrderGroupDto,
  ): Promise<ImagingOrder[]> {
    const patientId = await this.getConsultationPatient(consultationId, tenantId)
    return this.repo.createImagingOrder(tenantId, consultationId, patientId, userId, dto)
  }

  async listImagingOrders(consultationId: string, tenantId: string): Promise<ImagingOrder[]> {
    await this.getConsultationPatient(consultationId, tenantId)
    return this.repo.listImagingOrdersByConsultation(consultationId, tenantId)
  }

  async getImagingOrder(
    consultationId: string,
    orderId: string,
    tenantId: string,
  ): Promise<ImagingOrder> {
    await this.getConsultationPatient(consultationId, tenantId)
    const order = await this.repo.findImagingOrderById(orderId, tenantId)
    if (!order || order.consultationId !== consultationId) {
      throw new NotFoundException({
        code: ErrorCode.IMAGING_ORDER_NOT_FOUND,
        message: 'Imaging order not found',
      })
    }
    return order
  }

  async createLabOrder(
    consultationId: string,
    tenantId: string,
    userId: string,
    dto: CreateLabOrderGroupDto,
  ): Promise<LabOrder[]> {
    const patientId = await this.getConsultationPatient(consultationId, tenantId)
    return this.repo.createLabOrder(tenantId, consultationId, patientId, userId, dto)
  }

  async listLabOrders(consultationId: string, tenantId: string): Promise<LabOrder[]> {
    await this.getConsultationPatient(consultationId, tenantId)
    return this.repo.listLabOrdersByConsultation(consultationId, tenantId)
  }

  async getLabOrder(consultationId: string, orderId: string, tenantId: string): Promise<LabOrder> {
    await this.getConsultationPatient(consultationId, tenantId)
    const order = await this.repo.findLabOrderById(orderId, tenantId)
    if (!order || order.consultationId !== consultationId) {
      throw new NotFoundException({
        code: ErrorCode.LAB_ORDER_NOT_FOUND,
        message: 'Lab order not found',
      })
    }
    return order
  }

  async generateAll(
    consultationId: string,
    tenantId: string,
    userId: string,
    dto: GenerateAllOrdersDto,
  ): Promise<GenerateAllOrdersResult> {
    const patientId = await this.getConsultationPatient(consultationId, tenantId)

    const [prescriptions, imagingGroups, labGroups] = await Promise.all([
      Promise.all(
        dto.prescriptions.map((p) =>
          this.repo.createPrescription(tenantId, consultationId, patientId, userId, p),
        ),
      ),
      Promise.all(
        dto.imagingOrders.map((g) =>
          this.repo.createImagingOrder(tenantId, consultationId, patientId, userId, g),
        ),
      ),
      Promise.all(
        dto.labOrders.map((g) =>
          this.repo.createLabOrder(tenantId, consultationId, patientId, userId, g),
        ),
      ),
    ])

    return {
      prescriptions,
      imagingOrders: imagingGroups.flat(),
      labOrders: labGroups.flat(),
    }
  }
}
