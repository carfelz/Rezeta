import { Injectable, Logger } from '@nestjs/common'
import { Cron } from '@nestjs/schedule'
import { WeeklySummaryService } from './weekly-summary.service.js'

@Injectable()
export class WeeklySummaryScheduler {
  private readonly logger = new Logger(WeeklySummaryScheduler.name)

  constructor(private readonly weeklySummary: WeeklySummaryService) {}

  // Weekly summary emails — Sunday at 8:00 AM
  @Cron('0 8 * * 0')
  async handleWeeklySummary(): Promise<void> {
    this.logger.log('Cron triggered: weekly summary emails')
    await this.weeklySummary.sendWeeklySummaries()
  }
}
