import { Injectable, Logger } from '@nestjs/common'

/**
 * Sends the set-password / first-login email to an invited user.
 *
 * There is no transactional-email provider wired yet, so this logs the link in
 * dev/test. Replace the body with a real send when email infrastructure lands;
 * the call site (UsersService.createUser) does not change.
 */
@Injectable()
export class InvitationMailerService {
  private readonly logger = new Logger(InvitationMailerService.name)

  async sendSetPasswordEmail(email: string, link: string): Promise<void> {
    this.logger.log(`Set-password email for ${email}: ${link}`)
    return Promise.resolve()
  }

  /**
   * Notifies a user the first time a login is seen from a new device
   * fingerprint (identity design §7 "New-device email"). Same log-only dev
   * path as `sendSetPasswordEmail` — replace the body when a real
   * transactional-email provider lands; the call site
   * (`LoginTelemetryService.upsertDevice`) does not change.
   */
  async sendNewDeviceEmail(email: string, deviceLabel: string): Promise<void> {
    this.logger.log(`New-device email for ${email}: ${deviceLabel}`)
    return Promise.resolve()
  }
}
