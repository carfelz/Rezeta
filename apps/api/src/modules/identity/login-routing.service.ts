import { Inject, Injectable } from '@nestjs/common'
import type { LoginMethodsResponseDto } from '@rezeta/shared'
import { SsoConnectionRepository } from './sso-connection.repository.js'

/**
 * Resolves which login methods to show for an email, without ever touching
 * the users table — only `SsoConnectionRepository.findActiveByDomain` is
 * consulted, so this endpoint (public, unauthenticated) can never be used to
 * enumerate registered accounts. A domain with no active SSO connection gets
 * the constant password+google shape; a domain claimed by an active
 * connection gets `sso` plus (when the connection still allows it) password
 * and google, alongside the provider id/display name the frontend needs to
 * kick off the SSO redirect.
 */
@Injectable()
export class LoginRoutingService {
  constructor(@Inject(SsoConnectionRepository) private repository: SsoConnectionRepository) {}

  async methodsForEmail(email: string): Promise<LoginMethodsResponseDto> {
    const domain = email.slice(email.lastIndexOf('@') + 1).toLowerCase()
    const connection = await this.repository.findActiveByDomain(domain)

    if (!connection) return { methods: ['password', 'google'] }

    return {
      methods: connection.allowPassword ? ['password', 'google', 'sso'] : ['sso'],
      ssoProviderId: connection.providerId,
      ssoDisplayName: connection.displayName,
    }
  }
}
