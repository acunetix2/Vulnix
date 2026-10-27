import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  ArrowRight,
  Database,
  Zap,
  Cpu,
  Shield,
  Plug,
  Activity,
} from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { cn } from '../../../lib/utils'
import { API_BASE_URL } from '../../../lib/constants'

const READY_URL = `${API_BASE_URL}/ready`
const HEALTH_URL = API_BASE_URL.startsWith('http')
  ? new URL('/health', API_BASE_URL).toString()
  : '/health'
const POLL_MS = 30_000

// ── helpers ──────────────────────────────────────────────────────────────────

function componentStatus(value) {
  if (!value) return 'unknown'
  if (value === 'up' || value === 'enabled' || value === 'configured') return 'operational'
  if (value === 'down') return 'outage'
  if (value === 'not_configured' || value === 'disabled') return 'degraded'
  return 'unknown'
}

function overallStatus(components) {
  const statuses = Object.values(components).map(componentStatus)
  if (statuses.includes('outage')) return 'outage'
  if (statuses.includes('degraded')) return 'degraded'
  if (statuses.every((s) => s === 'operational')) return 'operational'
  return 'unknown'
}

const STATUS_META = {
  operational: {
    label: 'Operational',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500',
    bgLight: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    Icon: CheckCircle2,
  },
  degraded: {
    label: 'Degraded',
    color: 'text-amber-500',
    bg: 'bg-amber-500',
    bgLight: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    Icon: AlertTriangle,
  },
  outage: {
    label: 'Outage',
    color: 'text-rose-500',
    bg: 'bg-rose-500',
    bgLight: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    Icon: XCircle,
  },
  unknown: {
    label: 'Unknown',
    color: 'text-slate-400',
    bg: 'bg-slate-400',
    bgLight: 'bg-slate-400/10',
    border: 'border-slate-400/30',
    Icon: Clock,
  },
}

// Maps backend component keys → human labels & icons
const COMPONENT_MAP = [
  { key: 'database',     label: 'Database',           Icon: Database,  description: 'PostgreSQL persistence layer' },
  { key: 'supabase_auth',label: 'Auth Provider',      Icon: Shield,    description: 'Supabase authentication gateway' },
  { key: 'ai',           label: 'AI Review Engine',   Icon: Cpu,       description: 'Primary LLM reviewer' },
  { key: 'ai_fallback',  label: 'AI Fallback',        Icon: Zap,       description: 'Reviewer handover when the primary is down' },
  { key: 'ai_hosted_primary',   label: 'Hosted reviewer',      Icon: Activity, description: 'First hosted review engine, credential present or not' },
  { key: 'ai_hosted_secondary', label: 'Hosted reviewer alt',  Icon: Activity, description: 'Second hosted engine that takes over an audit' },
  { key: 'ai_hosted_tertiary',  label: 'Hosted reviewer reserve', Icon: Activity, description: 'Last engine in the chain, for narrow files' },
  { key: 'integrations', label: 'Integrations',       Icon: Plug,      description: 'GitHub, Slack, Jira webhooks' },
]

const MAX_HISTORY_CHECKS = 60
const COMPONENT_KEYS = COMPONENT_MAP.map(({ key }) => key)

function UptimeBars({ history }) {
  const emptySlots = MAX_HISTORY_CHECKS - history.length
  const bars = [
    ...Array.from({ length: emptySlots }, () => null),
    ...history,
  ]

  return (
    <div
      className="flex h-8 items-stretch gap-0.5"
      role="img"
      aria-label={`${history.length} of ${MAX_HISTORY_CHECKS} recent checks recorded this visit`}
    >
      {bars.map((check, index) => {
        const status = check?.status || 'unknown'
        const meta = STATUS_META[status]
        const title = check
          ? `${meta.label} — ${new Date(check.checkedAt).toLocaleString()}`
          : 'No check recorded this visit'

        return (
          <div
            key={check?.checkedAt || `empty-${index}`}
            title={title}
            className={cn('min-w-0 flex-1 rounded-[2px]', check ? meta.bg : 'bg-muted')}
          />
        )
      })}
    </div>
  )
}

function StatusBadge({ status, className }) {
  const meta = STATUS_META[status] || STATUS_META.unknown
  const Icon = meta.Icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', meta.bgLight, meta.border, meta.color, className)}>
      <Icon className="size-3.5 shrink-0" />
      {meta.label}
    </span>
  )
}

function ComponentRow({ label, Icon, description, value, history, error }) {
  const status = error ? 'outage' : componentStatus(value)
  const meta = STATUS_META[status]
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-xs transition-all hover:shadow-sm">
      <div className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg border', meta.bgLight, meta.border)}>
        <Icon className={cn('size-5', meta.color)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-sm text-foreground">{label}</span>
          <StatusBadge status={status} />
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{description}</p>
        <div className="mt-2">
          <UptimeBars history={history} />
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{history.length} recent checks this visit</span>
            <span>{history.length ? meta.label : 'No checks yet'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function OverallBanner({ overall, lastChecked }) {
  const meta = STATUS_META[overall] || STATUS_META.unknown
  const Icon = meta.Icon

  const bannerStyle = {
    operational: 'bg-emerald-50 border-emerald-200',
    degraded:    'bg-amber-50 border-amber-200',
    outage:      'bg-rose-50 border-rose-200',
    unknown:     'bg-slate-100 border-slate-200',
  }[overall] || 'bg-slate-100 border-slate-200'

  const headline = {
    operational: 'All systems operational',
    degraded:    'Some services degraded',
    outage:      'Active service disruption',
    unknown:     'Checking system health…',
  }[overall]

  return (
    <div className={cn('rounded-2xl border p-6 shadow-lg', bannerStyle)}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={cn('flex size-14 items-center justify-center rounded-2xl border', meta.bgLight, meta.border)}>
            <Icon className={cn('size-7', meta.color)} />
          </div>
          <div>
            <h2 className={cn('text-xl font-bold', meta.color)}>{headline}</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {lastChecked ? `Automatically checked ${lastChecked}` : 'Checking automatically…'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
      <div className="size-10 shrink-0 rounded-lg bg-muted animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="flex justify-between">
          <div className="h-4 w-32 rounded bg-muted animate-pulse" />
          <div className="h-6 w-24 rounded-full bg-muted animate-pulse" />
        </div>
        <div className="h-2.5 w-48 rounded bg-muted animate-pulse" />
        <div className="h-8 w-full rounded bg-muted animate-pulse mt-2" />
      </div>
    </div>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export function SystemStatus() {
  const [ready, setReady]           = useState(null)   // raw /ready response
  const [health, setHealth]         = useState(null)   // raw /health response
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(null)
  const [lastChecked, setLastChecked] = useState(null)
  const [checkHistory, setCheckHistory] = useState({})

  const recordChecks = useCallback((statuses, checkedAt) => {
    setCheckHistory((current) => {
      const next = { ...current }
      for (const key of COMPONENT_KEYS) {
        const status = statuses[key] || 'down'
        next[key] = [
          ...(current[key] || []),
          { status: componentStatus(status), checkedAt },
        ].slice(-MAX_HISTORY_CHECKS)
      }
      return next
    })
  }, [])

  const poll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [readyRes, healthRes] = await Promise.all([
        fetch(READY_URL, { cache: 'no-store' }),
        fetch(HEALTH_URL, { cache: 'no-store' }),
      ])
      if (!readyRes.ok) throw new Error(`Readiness check returned HTTP ${readyRes.status}.`)
      if (!healthRes.ok) throw new Error(`Liveness check returned HTTP ${healthRes.status}.`)

      const [readyData, healthData] = await Promise.all([readyRes.json(), healthRes.json()])
      const checkedAt = new Date()
      setReady(readyData)
      setHealth(healthData)
      setLastChecked(checkedAt.toLocaleTimeString())
      recordChecks(readyData, checkedAt.toISOString())
    } catch (err) {
      recordChecks({}, new Date().toISOString())
      setError(err instanceof Error ? `Could not load live system status: ${err.message}` : 'Could not load live system status.')
    } finally {
      setLoading(false)
    }
  }, [recordChecks])

  useEffect(() => {
    const initialCheck = setTimeout(poll, 0)
    const timer = setInterval(poll, POLL_MS)
    return () => {
      clearTimeout(initialCheck)
      clearInterval(timer)
    }
  }, [poll])

  // Derive overall
  const components = ready
    ? {
        database:     ready.database,
        supabase_auth: ready.supabase_auth,
        ai:           ready.ai,
        ai_fallback:  ready.ai_fallback,
        ai_hosted_primary: ready.ai_hosted_primary,
        ai_hosted_secondary: ready.ai_hosted_secondary,
        ai_hosted_tertiary: ready.ai_hosted_tertiary,
        integrations: ready.integrations,
      }
    : {}

  const overall = error
    ? 'outage'
    : loading && !ready
    ? 'unknown'
    : overallStatus(components)

  return (
    <div className="min-h-screen bg-canvas">
      {/* Nav */}
      <header className="sticky top-0 z-50 h-16 border-b border-border/80 bg-background/90 backdrop-blur-md">
        <div className="mx-auto flex h-full max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2.5">
            <img src="/vulnix-logo.png" alt="Vulnix" className="size-8 rounded-full" />
            <span className="font-bold text-base text-foreground tracking-tight">Vulnix</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" render={<Link to="/docs" />}>
              Docs
            </Button>
            <Button size="sm" render={<Link to="/signup" />}>
              Start free
              <ArrowRight className="size-3.5" data-icon="inline-end" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-12 sm:px-6">

        {/* Page title */}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">System status</h1>
          <p className="text-sm text-muted-foreground">
            Service checks update automatically every 30 seconds. Bars show checks recorded while this page is open.
          </p>
        </div>

        {/* Overall banner */}
        <OverallBanner
          overall={overall}
          lastChecked={lastChecked}
        />

        {/* Error alert */}
        {error && (
          <div className="flex items-center gap-3 rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-400">
            <XCircle className="size-5 shrink-0" />
            {error}
          </div>
        )}

        {/* Raw health probe */}
        {health && !error && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className={cn('size-2 rounded-full animate-pulse', health.status === 'ok' ? 'bg-emerald-500' : 'bg-rose-500')} />
            API response: <span className="font-medium text-foreground">{health.status === 'ok' ? 'Online' : 'Unavailable'}</span>
          </div>
        )}

        {/* Per-component rows */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Services</h2>
          {loading && !ready ? (
            <div className="space-y-3">
              {COMPONENT_MAP.map((c) => <SkeletonRow key={c.key} />)}
            </div>
          ) : (
            <div className="space-y-3">
              {COMPONENT_MAP.map(({ key, label, Icon, description }) => (
                <ComponentRow
                  key={key}
                  label={label}
                  Icon={Icon}
                  description={description}
                  value={ready?.[key]}
                  history={checkHistory[key] || []}
                  error={error}
                />
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  )
}
