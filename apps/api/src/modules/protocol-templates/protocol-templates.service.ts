import { Injectable, Inject } from '@nestjs/common'
import type { ProtocolTemplate } from '@rezeta/db'
import { ProtocolTemplatesRepository } from './protocol-templates.repository.js'

@Injectable()
export class ProtocolTemplatesService {
  constructor(@Inject(ProtocolTemplatesRepository) private repo: ProtocolTemplatesRepository) {}

  async getTemplatesVisibleToTenant(tenantId: string): Promise<ProtocolTemplate[]> {
    return this.repo.findVisibleTemplates(tenantId)
  }
}
