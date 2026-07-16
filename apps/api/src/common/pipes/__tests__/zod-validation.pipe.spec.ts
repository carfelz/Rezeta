import { BadRequestException } from '@nestjs/common'
import type { ArgumentMetadata } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from '../zod-validation.pipe.js'
import { ErrorCode } from '@rezeta/shared'

const TestSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(0),
})

const QuerySchema = z.object({
  categoryId: z.string().uuid().optional(),
  search: z.string().max(10).optional(),
})

const bodyMeta: ArgumentMetadata = { type: 'body', metatype: undefined, data: '' }
const queryMeta: ArgumentMetadata = { type: 'query', metatype: undefined, data: '' }

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(TestSchema)

  it('returns parsed data for a valid body', () => {
    const result = pipe.transform({ name: 'Test', age: 30 }, bodyMeta)
    expect(result).toEqual({ name: 'Test', age: 30 })
  })

  it('throws BadRequestException for an invalid body', () => {
    expect(() => pipe.transform({ name: '', age: -1 }, bodyMeta)).toThrow(BadRequestException)
  })

  it('thrown error includes VALIDATION_ERROR code', () => {
    try {
      pipe.transform({}, bodyMeta)
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException)
      const body = (err as BadRequestException).getResponse() as Record<string, unknown>
      expect(body['code']).toBe(ErrorCode.VALIDATION_ERROR)
      expect(body['details']).toBeDefined()
    }
  })

  it('thrown error includes flattened zod details', () => {
    try {
      pipe.transform({ name: '', age: 'not-a-number' }, bodyMeta)
    } catch (err) {
      const body = (err as BadRequestException).getResponse() as Record<string, unknown>
      const details = body['details'] as { fieldErrors: Record<string, unknown> }
      expect(details.fieldErrors).toBeDefined()
    }
  })

  it('validates query params and returns parsed data for a valid query', () => {
    const queryPipe = new ZodValidationPipe(QuerySchema)
    const uuid = '018e3f2a-3333-7000-8000-000000000001'
    const result = queryPipe.transform({ categoryId: uuid }, queryMeta)
    expect(result).toEqual({ categoryId: uuid })
  })

  it('throws VALIDATION_ERROR for a malformed query param', () => {
    const queryPipe = new ZodValidationPipe(QuerySchema)
    try {
      queryPipe.transform({ categoryId: 'not-a-uuid' }, queryMeta)
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException)
      const body = (err as BadRequestException).getResponse() as Record<string, unknown>
      expect(body['code']).toBe(ErrorCode.VALIDATION_ERROR)
    }
  })

  // @UsePipes broadcasts a body-schema pipe to EVERY argument of a handler,
  // including @Param('id'), @TenantId() and @CurrentUser(). Those must pass
  // through untouched — validating them against the body/query schema wrongly
  // rejects valid requests (see the F3 regression). They are validated
  // elsewhere (ParseUUIDPipe / the auth guard).
  it('does not validate param args — passes them through unchanged', () => {
    const paramMeta: ArgumentMetadata = { type: 'param', metatype: undefined, data: 'id' }
    expect(pipe.transform('any-id-string', paramMeta)).toBe('any-id-string')
  })

  it('does not validate custom args (auth/context) — passes them through unchanged', () => {
    const customMeta: ArgumentMetadata = { type: 'custom', metatype: undefined, data: undefined }
    // e.g. @TenantId() string and @CurrentUser() object
    expect(pipe.transform('tenant-uuid', customMeta)).toBe('tenant-uuid')
    const user = { id: 'u1', role: 'super_admin' }
    expect(pipe.transform(user, customMeta)).toBe(user)
  })
})
