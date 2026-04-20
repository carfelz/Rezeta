import { SetMetadata } from '@nestjs/common'

/**
 * Mark an endpoint as a provisioning route.
 *
 * The Firebase ID token is still verified (we need the uid), but the guard
 * does NOT require a matching User row in the database. The controller reads
 * req.firebaseToken and performs the DB creation itself.
 *
 * Used exclusively by POST /v1/auth/provision.
 */
export const IS_PROVISION_ROUTE_KEY = 'isProvisionRoute'
export const ProvisionRoute = () => SetMetadata(IS_PROVISION_ROUTE_KEY, true)
