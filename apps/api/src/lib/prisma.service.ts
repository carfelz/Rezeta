import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common'
import { PrismaClient } from '@rezeta/db'

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name)

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    })

    this.$on('error' as never, (e: { message: string }) => {
      this.logger.error(e.message)
    })

    this.$on('warn' as never, (e: { message: string }) => {
      this.logger.warn(e.message)
    })
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
