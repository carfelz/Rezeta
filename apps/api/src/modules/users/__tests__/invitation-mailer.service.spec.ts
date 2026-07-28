import { describe, it, expect, vi } from 'vitest'
import { Logger } from '@nestjs/common'
import { InvitationMailerService } from '../invitation-mailer.service.js'

describe('InvitationMailerService', () => {
  it('logs the set-password link (dev path)', async () => {
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    const mailer = new InvitationMailerService()
    await mailer.sendSetPasswordEmail('nurse@clinic.do', 'https://reset.example/abc')
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('nurse@clinic.do'))
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('https://reset.example/abc'))
    spy.mockRestore()
  })

  it('logs the new-device notification (dev path)', async () => {
    const spy = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    const mailer = new InvitationMailerService()
    await mailer.sendNewDeviceEmail('dr@clinic.do', 'Mozilla/5.0 (Macintosh)')
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('dr@clinic.do'))
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('Mozilla/5.0 (Macintosh)'))
    spy.mockRestore()
  })
})
