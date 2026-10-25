/**
 * The account handle rules, mirrored from the API so a form can explain a
 * problem before the request is sent. The server stays the authority: this only
 * decides what to warn about while typing.
 */

// Handles that would let a profile impersonate the product or its staff.
export const RESERVED_HANDLES = new Set([
  'admin',
  'administrator',
  'root',
  'support',
  'system',
  'webmaster',
  'vulnix',
  'security',
  'moderator',
])

const HANDLE_PATTERN = /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/

export function normalizeHandle(value) {
  return String(value ?? '')
    .trim()
    .replace(/^@+/, '')
    .toLowerCase()
}

/** Returns the rule the handle breaks, or null when it is claimable. */
export function handleProblem(value) {
  const handle = normalizeHandle(value)
  if (!handle) return 'Pick a username.'
  if (handle.length < 3) return 'A username is at least 3 characters.'
  if (handle.length > 30) return 'A username is at most 30 characters.'
  if (!HANDLE_PATTERN.test(handle)) {
    return 'Use letters, digits, dot, underscore or hyphen — start and end with a letter or digit.'
  }
  if (RESERVED_HANDLES.has(handle)) return 'That username is reserved.'
  return null
}
