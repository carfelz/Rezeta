import { describe, expect, it } from 'vitest'
import { csvEscape } from '../csv.js'

describe('csvEscape', () => {
  it('neutralizes a leading = so Excel renders a formula-injection payload as text', () => {
    expect(csvEscape('=HYPERLINK("https://evil.example","click")')).toBe(
      '"\'=HYPERLINK(""https://evil.example"",""click"")"',
    )
  })

  it('neutralizes a leading +, -, and @ the same way', () => {
    expect(csvEscape('+1+1')).toBe("'+1+1")
    expect(csvEscape('-1+1')).toBe("'-1+1")
    expect(csvEscape('@SUM(1,1)')).toBe(`"'@SUM(1,1)"`)
  })

  it('prefixes ordinary negative-number-looking strings too (accepted trade-off: no way to tell "-5" from an attack at the string level)', () => {
    expect(csvEscape('-5')).toBe("'-5")
  })

  it('still quotes/escapes commas, quotes, and newlines after neutralization', () => {
    expect(csvEscape('=1,2')).toBe(`"'=1,2"`)
    expect(csvEscape('=say "hi"')).toBe(`"'=say ""hi"""`)
  })

  it('leaves ordinary text alone', () => {
    expect(csvEscape('Ana García')).toBe('Ana García')
    expect(csvEscape('')).toBe('')
  })

  it('still quotes commas/quotes/newlines with no leading trigger char', () => {
    expect(csvEscape('a,b')).toBe('"a,b"')
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""')
    expect(csvEscape('line1\nline2')).toBe('"line1\nline2"')
  })
})
