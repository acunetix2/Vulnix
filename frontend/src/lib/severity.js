/** Severity is a ranking, not a colour palette. Keep the order in one place. */
export const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info']

export const SEVERITY_DOTS = {
  critical: 'bg-red-600',
  high: 'bg-orange-600',
  medium: 'bg-amber-500',
  low: 'bg-yellow-500',
  info: 'bg-sky-600',
}

export const SEVERITY_TONES = {
  critical: 'bg-red-100 text-red-800 ring-red-200',
  high: 'bg-orange-100 text-orange-800 ring-orange-200',
  medium: 'bg-amber-100 text-amber-800 ring-amber-200',
  low: 'bg-yellow-100 text-yellow-800 ring-yellow-200',
  info: 'bg-sky-100 text-sky-800 ring-sky-200',
}

/** Sort weight for "critical first" table ordering. */
export const SEVERITY_RANK = SEVERITY_ORDER.reduce(
  (acc, s, i) => ({ ...acc, [s]: SEVERITY_ORDER.length - i }),
  {}
)

export function normalizeSeverity(severity) {
  const s = String(severity || '').toLowerCase()
  return SEVERITY_ORDER.includes(s) ? s : 'info'
}
