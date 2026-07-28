const FORMULA_TRIGGER_CHARS = new Set(['=', '+', '-', '@'])

/**
 * CSV field escaping for exports opened in Excel (identity login CSV,
 * audit log CSV). Applies two independent defenses, in order:
 *
 * 1. Formula-injection neutralization — a field whose first character is
 *    `=`, `+`, `-`, or `@` is a live formula the moment Excel opens the
 *    CSV (e.g. a crafted `user_agent` request header or display name
 *    containing `=HYPERLINK(...)`). Prefixing a literal `'` forces Excel
 *    to render the cell as text instead of evaluating it. Accepted
 *    trade-off: an ordinary negative-number-looking value ("-5") gets the
 *    same `'` prefix — the string alone can't distinguish "untrusted text
 *    that starts with a minus" from "a negative number," and safety wins.
 * 2. RFC 4180 quoting — wrap in double quotes (doubling embedded quotes)
 *    when the field contains a comma, double quote, or newline.
 */
export function csvEscape(value: string): string {
  const neutralized = value.length > 0 && FORMULA_TRIGGER_CHARS.has(value[0] as string) ? `'${value}` : value
  if (neutralized.includes(',') || neutralized.includes('"') || neutralized.includes('\n')) {
    return `"${neutralized.replace(/"/g, '""')}"`
  }
  return neutralized
}
