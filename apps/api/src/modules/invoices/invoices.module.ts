import { Module } from '@nestjs/common'
import { InvoicesController } from './invoices.controller.js'
import { InvoicesService } from './invoices.service.js'
import { InvoicesRepository } from './invoices.repository.js'

@Module({
  controllers: [InvoicesController],
  providers: [InvoicesService, InvoicesRepository],
  exports: [InvoicesService],
})
export class InvoicesModule {}
