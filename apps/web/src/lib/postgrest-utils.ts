/**
 * Strip characters that have special meaning in PostgREST filter strings.
 * Commas separate conditions in .or(), parentheses group conditions.
 */
export function sanitizeForPostgrestFilter(value: string): string {
  return value.replace(/[,()]/g, '')
}
