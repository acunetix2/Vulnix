import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  Bot,
  XCircle,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import { SEVERITY_DOTS, SEVERITY_ORDER, SEVERITY_TONES } from '../../lib/severity'

/**
 * The one pill implementation for the console. Tones are semantic; pages pass
 * `tone` rather than re-typing background/ring/text classes.
 */
const TONES = {
  neutral: 'bg-muted text-muted-foreground ring-border',
  brand: 'bg-primary-subtle text-primary ring-primary/20',
  success: 'bg-primary-subtle text-primary ring-primary/20',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  warning: 'bg-amber-50 text-amber-700 ring-amber-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  ai: 'bg-ai-subtle text-ai ring-ai/20',
}

/**
 * Severity uses its own ramp so the ranking stays readable at a glance, but
 * every pill also carries its label — colour alone never encodes meaning.
 */
const FINDING_STATUS_TONES = {
  open: 'danger',
  confirmed: 'danger',
  in_progress: 'info',
  triaged: 'info',
  false_positive: 'neutral',
  fixed: 'success',
  resolved: 'success',
  mitigated: 'success',
  accepted_risk: 'warning',
  closed: 'neutral',
}

const SCAN_STATUS_TONES = {
  queued: 'neutral',
  running: 'info',
  completed: 'success',
  completed_with_errors: 'warning',
  failed: 'danger',
  cancelled: 'neutral',
}

const SCAN_STATUS_ICONS = {
  queued: Clock,
  running: Loader2,
  completed: CheckCircle2,
  completed_with_errors: AlertTriangle,
  failed: AlertCircle,
  cancelled: XCircle,
}

function humanize(value) {
  return String(value).replace(/_/g, ' ')
}

export function Pill({ tone = 'neutral', dot, icon: Icon, className, children }) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        TONES[tone] || TONES.neutral,
        className
      )}
    >
      {dot && <span className={cn('size-1.5 shrink-0 rounded-full', dot)} />}
      {Icon && <Icon className="size-3 shrink-0" />}
      <span className="truncate">{children}</span>
    </span>
  )
}

export function SeverityBadge({ severity, withDot = true, className, children }) {
  const s = String(severity || 'info').toLowerCase()
  const tone = SEVERITY_TONES[s] || SEVERITY_TONES.info
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1.5 rounded-md px-1.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
        tone,
        className
      )}
    >
      {withDot && (
        <span className={cn('size-1.5 shrink-0 rounded-full', SEVERITY_DOTS[s])} aria-hidden />
      )}
      {children ?? humanize(s)}
    </span>
  )
}

export function FindingStatusBadge({ status, className }) {
  const s = String(status || 'open').toLowerCase()
  return (
    <Pill tone={FINDING_STATUS_TONES[s] || 'neutral'} className={className}>
      {humanize(s)}
    </Pill>
  )
}

export function ScanStatusBadge({ status, className, showIcon = true }) {
  const s = String(status || 'queued').toLowerCase()
  const IconComponent = showIcon ? SCAN_STATUS_ICONS[s] : undefined
  return (
    <Pill
      tone={SCAN_STATUS_TONES[s] || 'neutral'}
      icon={IconComponent}
      className={cn(s === 'running' && '[&_svg]:animate-spin', className)}
    >
      {humanize(s)}
    </Pill>
  )
}

const DELIVERY_STATUS_TONES = {
  pending: 'neutral',
  succeeded: 'success',
  failed: 'warning',
  dead: 'danger',
}

/**
 * Outbox state. 'failed' is a delivery waiting for its next retry, so it reads
 * as a warning; 'dead' is the one an operator has to act on.
 */
export function DeliveryStatusBadge({ status, className }) {
  const s = String(status || 'pending').toLowerCase()
  return (
    <Pill tone={DELIVERY_STATUS_TONES[s] || 'neutral'} className={className}>
      {s === 'dead' ? 'Dead letter' : humanize(s)}
    </Pill>
  )
}

/** Marks content that came from a model, not a scanner. Never decorative. */
export function AILabelled({ children = 'AI', className }) {
  return (
    <Pill tone="ai" icon={Bot} className={className}>
      {children}
    </Pill>
  )
}

/** Compact severity counts, e.g. a project's findings_count object */
export function SeverityCounts({ counts = {}, className, totalLabel = 'No findings' }) {
  const present = SEVERITY_ORDER.filter((s) => Number(counts[s]) > 0)

  if (present.length === 0) {
    return <span className="text-xs text-muted-foreground">{totalLabel}</span>
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {present.map((s) => (
        <SeverityBadge key={s} severity={s}>
          {counts[s]} {s}
        </SeverityBadge>
      ))}
    </div>
  )
}
