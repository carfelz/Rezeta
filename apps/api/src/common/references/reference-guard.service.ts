import { Injectable, Inject, NotFoundException } from '@nestjs/common'
import { ErrorCode } from '@rezeta/shared'
import { PrismaService } from '../../lib/prisma.service.js'

/**
 * Verifies that a foreign-key reference supplied in a request body actually
 * belongs to the caller's tenant BEFORE it is linked to a new/updated row.
 *
 * Without this, a create/update endpoint that stamps the caller's own
 * `tenantId` onto a row while trusting a client-supplied `patientId` /
 * `locationId` / etc. allows cross-tenant reference injection: the row passes
 * every later tenant-scoped query yet points at another tenant's data. The
 * single-column FKs in the schema do not stop this at the DB layer.
 *
 * Each method throws `NotFoundException` (never leaking whether the id exists
 * in another tenant) when the referenced row is missing, soft-deleted, or
 * owned by a different tenant.
 */
@Injectable()
export class ReferenceGuardService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async assertPatient(patientId: string, tenantId: string): Promise<void> {
    const found = await this.prisma.patient.findFirst({
      where: { id: patientId, tenantId, deletedAt: null },
      select: { id: true },
    })
    if (!found) {
      throw new NotFoundException({
        code: ErrorCode.PATIENT_NOT_FOUND,
        message: 'Patient not found',
      })
    }
  }

  async assertLocation(locationId: string, tenantId: string): Promise<void> {
    const found = await this.prisma.location.findFirst({
      where: { id: locationId, tenantId, deletedAt: null },
      select: { id: true },
    })
    if (!found) {
      throw new NotFoundException({
        code: ErrorCode.LOCATION_NOT_FOUND,
        message: 'Location not found',
      })
    }
  }

  async assertAppointment(appointmentId: string, tenantId: string): Promise<void> {
    const found = await this.prisma.appointment.findFirst({
      where: { id: appointmentId, tenantId, deletedAt: null },
      select: { id: true },
    })
    if (!found) {
      throw new NotFoundException({
        code: ErrorCode.APPOINTMENT_NOT_FOUND,
        message: 'Appointment not found',
      })
    }
  }

  async assertConsultation(consultationId: string, tenantId: string): Promise<void> {
    const found = await this.prisma.consultation.findFirst({
      where: { id: consultationId, tenantId, deletedAt: null },
      select: { id: true },
    })
    if (!found) {
      throw new NotFoundException({
        code: ErrorCode.CONSULTATION_NOT_FOUND,
        message: 'Consultation not found',
      })
    }
  }
}
