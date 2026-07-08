import { BadRequestException } from '@nestjs/common'
import type { ArgumentMetadata } from '@nestjs/common'
import { ParsePositiveIntPipe } from '../parse-positive-int.pipe.js'
import { ErrorCode } from '@rezeta/shared'

const queryMeta: ArgumentMetadata = { type: 'query', metatype: Number, data: 'version' }

describe('ParsePositiveIntPipe', () => {
  const pipe = new ParsePositiveIntPipe()

  it('passes undefined through unchanged (optional param not sent)', () => {
    expect(pipe.transform(undefined, queryMeta)).toBeUndefined()
  })

  it('parses a valid positive integer string', () => {
    expect(pipe.transform('1', queryMeta)).toBe(1)
    expect(pipe.transform('7', queryMeta)).toBe(7)
  })

  it('rejects 0', () => {
    expect(() => pipe.transform('0', queryMeta)).toThrow(BadRequestException)
  })

  it('rejects negative integers', () => {
    expect(() => pipe.transform('-1', queryMeta)).toThrow(BadRequestException)
  })

  it('rejects non-integer numbers', () => {
    expect(() => pipe.transform('1.5', queryMeta)).toThrow(BadRequestException)
  })

  it('rejects non-numeric strings', () => {
    expect(() => pipe.transform('abc', queryMeta)).toThrow(BadRequestException)
  })

  it('thrown error includes VALIDATION_ERROR code and the field name', () => {
    try {
      pipe.transform('0', queryMeta)
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException)
      const body = (err as BadRequestException).getResponse() as Record<string, unknown>
      expect(body['code']).toBe(ErrorCode.VALIDATION_ERROR)
      expect(body['details']).toEqual({ field: 'version', reason: 'must be an integer >= 1' })
    }
  })
})
