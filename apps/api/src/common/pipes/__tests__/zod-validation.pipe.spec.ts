import { BadRequestException } from '@nestjs/common'
import type { ArgumentMetadata } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from '../zod-validation.pipe.js'
import { ErrorCode } from '@rezeta/shared'

const TestSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(0),
})

const bodyMeta: ArgumentMetadata = { type: 'body', metatype: undefined, data: '' }
const paramMeta: ArgumentMetadata = { type: 'param', metatype: undefined, data: 'id' }

describe('ZodValidationPipe', () => {
  const pipe = new ZodValidationPipe(TestSchema)

  it('passes through non-body metadata unchanged', () => {
    const input = 'abc123'
    const result = pipe.transform(input, paramMeta)
    expect(result).toBe(input)
  })

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

  it('passes through query metadata unchanged', () => {
    const queryMeta: ArgumentMetadata = { type: 'query', metatype: undefined, data: 'page' }
    expect(pipe.transform('2', queryMeta)).toBe('2')
  })
})
