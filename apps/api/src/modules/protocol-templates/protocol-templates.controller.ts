import { Controller, Get, Inject } from '@nestjs/common'
import type { ProtocolTemplate } from '@rezeta/db'
import { TenantId } from '../../common/decorators/tenant-id.decorator.js'
import { ProtocolTemplatesService } from './protocol-templates.service.js'

@Controller('v1/protocol-templates')
export class ProtocolTemplatesController {
  constructor(
    @Inject(ProtocolTemplatesService) private readonly service: ProtocolTemplatesService
  ) {}

  @Get()
  async getTemplates(@TenantId() tenantId: string): Promise<ProtocolTemplate[]> {
    return this.service.getTemplatesVisibleToTenant(tenantId)
  }
}
