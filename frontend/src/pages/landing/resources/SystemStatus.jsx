import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Activity,
  CheckCircle2,
  CircleDashed,
  Clock,
  Database,
  Plug,
  RefreshCw,
  Shield,
  Zap,
} from 'lucide-react'
import { Button } from '../../../components/ui/button'
import { cn } from '../../../lib/utils'
import { API_BASE_URL } from '../../../lib/constants'

const STATUS_URL = `${API_BASE_URL}/status`
const READY_URL = `${API_BASE_URL}/ready`
const POLL_MS = 60_000
const WINDOWS = [
  { key: '6h', label: '6 hours' },
  { key: '24h', label: '24 hours' },
  { key: '7d', label: '7 days' },
]

// The words the status API answers with, and what each looks like to someone who
// has never seen this codebase. An outage is shown in amber, not red: this page
// exists to inform, and a wall of red tells a visitor nothing they can act on.
const STATE = {
  operational: { label: 'Working',       dot: 'bg-emerald-500', text: 'text-emerald-600', bar: 'bg-emerald-500' },
  degraded:    { label: 'Having trouble', dot: 'bg-amber-500',  text: 'text-amber-600',   bar: 'bg-amber-500' },
  outage:      { label: 'Down',          dot: 'bg-rose-400',    text: 'text-rose-500',    bar: 'bg-rose-400' },
  not_enabled: { label: 'Not turned on', dot: 'bg-slate-300',   text: 'text-muted-foreground', bar: 'bg-muted' },
  nodata:      { label: 'No result yet', dot: 'bg-slate-300',   text: 'text-muted-foreground', bar: 'bg-muted' },
  unknown:     { label: 'Checking',      dot: 'bg-slate-400',   text: 'text-muted-foreground', bar: 'bg-muted' },
}

const COMPONENTS = [
  { key: 'database', label: 'Database', Icon: Database, description: 'Where your projects, audits and findings are kept' },
  { key: 'redis', label: 'Audit queue', Icon: Activity, description: 'Holds audits in line and passes them on to be read' },
  { key: 'supabase_auth', label: 'Authentication', Icon: Shield, description: 'Getting into your account, by password or another app' },
  { key: 'ai', label: 'Code review', Icon: Zap, description: 'Reads your code and writes up what it finds' },
  { key: 'ai_fallback', label: 'Backup reviewer', Icon: Zap, description: 'Finishes an audit if the first one cannot' },
  { key: 'integrations', label: 'Connected apps', Icon: Plug, description: 'Sending your results to GitHub, Slack and Jira' },
]

// A live browser check is only as good as the words /ready uses, so the same
// judgement is made here in miniature for deployments without recorded history.
function readLiveState(value) {
  if (value === 'up' || value === 'enabled' || value === 'configured' || value === 'ready') return 'operational'
  if (value === 'disabled' || value === 'not_configured' || value === 'unregistered') return 'not_enabled'
  if (value === 'down') return 'outage'
  return 'degraded'
}

// Mirrors overall_state() on the server: the database carries everything, so it
// being down is an outage; the queue only delays work, so it degrades.
function deriveOverall(states) {
  const values = Object.values(states)
  if (!values.length) return 'unknown'
  if (states.database === 'outage') return 'outage'
  if (values.some((state) => state === 'outage' || state === 'degraded')) return 'degraded'
  return 'operational'
}

function formatTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDayTime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(seconds) {
  if (seconds < 60) return 'under a minute'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min`
  const hours = minutes / 60
  return hours < 10 ? `${hours.toFixed(1)} h` : `${Math.round(hours)} h`
}

function headlineFor(overall, incident) {
  if (overall === 'operational') {
    return {
      title: 'Everything is working',
      body: 'Every part of Vulnix answered a moment ago, so audits, sign-in and findings are all available.',
    }
  }
  if (overall === 'degraded') {
    return {
      title: 'Most of Vulnix is working',
      body: 'One part is having trouble, so some things may be slower than usual or keep you waiting. Nothing you saved is at risk, and there is nothing you need to do.',
    }
  }
  if (overall === 'outage') {
    return {
      title: incident?.ongoing ? "We're aware, and we're on it" : 'Part of Vulnix was down',
      body: 'We could not reach part of Vulnix, so an audit may not start or finish while it lasts. Nothing you saved is at risk, and there is nothing you need to do - this page updates itself.',
    }
  }
  return {
    title: 'Nothing to show yet',
    body: 'We have not finished our first check of Vulnix. Once it runs, what it finds appears here on its own.',
  }
}

function Banner({ status, overall, recorded, clientError, loading }) {
  if (clientError) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 shadow-sm sm:p-8">
        <div className="flex items-start gap-4">
          <span className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl bg-white ring-1 ring-slate-200">
            <CircleDashed className="size-6 text-slate-500" />
          </span>
          <div>
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">We are experiencing downtime</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Vulnix is not answering right now, so an audit may not start or finish and signing in may not
              work. Nothing you have saved is at risk, and there is nothing you need to do - this page updates
              itself, and you will see it come back.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (loading && !status) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="h-7 w-56 animate-pulse rounded-lg bg-muted" />
        <div className="mt-3 h-4 w-full max-w-xl animate-pulse rounded bg-muted" />
      </div>
    )
  }

  const copy = headlineFor(overall, status?.incidents?.at(-1))
  const accent = STATE[overall] ?? STATE.unknown

  return (
    <div
      className={cn(
        'rounded-2xl border p-6 shadow-sm sm:p-8',
        overall === 'operational' && 'border-emerald-500/25 bg-emerald-500/[0.08]',
        overall === 'degraded' && 'border-amber-500/25 bg-amber-500/[0.07]',
        overall === 'outage' && 'border-amber-500/30 bg-amber-500/[0.10]',
        (overall === 'unknown' || overall === 'nodata') && 'border-border bg-card',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-4">
          <span
            className={cn(
              'mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-xl',
              overall === 'operational' ? 'bg-emerald-500/15' : 'bg-white/70 ring-1 ring-amber-500/25',
            )}
          >
            {overall === 'operational' ? (
              <CheckCircle2 className="size-6 text-emerald-600" />
            ) : (
              <Activity className={cn('size-6', accent.text)} />
            )}
          </span>
          <div>
            <h2 className="text-xl font-bold text-foreground sm:text-2xl">{copy.title}</h2>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">{copy.body}</p>
            {!recorded && overall !== 'unknown' && (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                This is what one look right now can see, not our running history. The bars below fill in as we
                keep looking.
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn('size-2 rounded-full', accent.dot)} />
          {STATE[overall]?.label ?? 'Checking'}
        </div>
      </div>
    </div>
  )
}

// The ribbon is drawn even when nothing has been recorded: a row of grey slices
// says "no data for this window" in the same shape as the bars that do, so the
// page never shows an empty box where a chart belongs. The count mirrors the
// grid the server returns, and only has to be invented when that grid is
// missing - a failed request, or a service no check has named yet.
const SLICES = 60

function HistoryStrip({ buckets, windowKey }) {
  const label = WINDOWS.find((w) => w.key === windowKey)?.label ?? 'the window'
  const slices = buckets.length ? buckets : Array.from({ length: SLICES }, () => ({ state: 'nodata' }))
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground">History</h3>
        <p className="text-[11px] text-muted-foreground">
          Each bar is one stretch of the last {label.toLowerCase()}
        </p>
      </div>
      <div
        className="mt-4 flex h-10 items-stretch gap-[3px]"
        role="img"
        aria-label={`History across the last ${label}, one bar per stretch`}
      >
        {slices.map((bucket, index) => {
          const meta = STATE[bucket.state] ?? STATE.nodata
          return (
            <div
              key={index}
              title={`${bucket.started_at ? formatDayTime(bucket.started_at) : 'This stretch'} — ${meta.label}${bucket.probes ? ` (${bucket.probes} checks)` : ''}`}
              className={cn('min-w-0 flex-1 rounded-[3px]', meta.bar)}
            />
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span>{buckets.length ? formatDayTime(buckets[0].started_at) : ''}</span>
        <span>Now</span>
      </div>
    </div>
  )
}

function Incidents({ incidents, windowKey }) {
  if (!incidents?.length) {
    return (
      <p className="rounded-xl border border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        Nothing went down in this period.
      </p>
    )
  }
  return (
    <ul className="space-y-2">
      {incidents.map((incident) => (
        <li
          key={incident.started_at}
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-card px-4 py-3 text-xs"
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <Clock className="size-3.5" />
            {formatDayTime(incident.started_at)}
            {incident.ongoing ? ' — still happening' : ''}
          </span>
          <span className="font-medium text-foreground">
            {incident.ongoing ? 'We are on it' : `Fixed after ${formatDuration(incident.duration_seconds)}`}
          </span>
        </li>
      ))}
      <li className="px-1 text-[11px] text-muted-foreground">
        We look once a minute, so a very brief problem is listed by when we first noticed it. Showing: {' '}
        {WINDOWS.find((w) => w.key === windowKey)?.label}.
      </li>
    </ul>
  )
}

function ServiceRow({ label, Icon, description, state, history, buckets, windowKey }) {
  const meta = STATE[state] ?? STATE.unknown
  const bars = history?.bars?.length
    ? history.bars
    : Array.from({ length: buckets.length || SLICES }, () => 'nodata')
  const start = `${(WINDOWS.find((w) => w.key === windowKey)?.label ?? 'window').toLowerCase()} ago`
  return (
    <div className="px-4 py-5 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className={cn('size-4', meta.text)} />
          {label}
        </span>
        <span className={cn('text-sm font-medium', meta.text)}>{meta.label}</span>
      </div>

      <div
        className="mt-3 flex h-8 items-stretch gap-[3px]"
        role="img"
        aria-label={`History for ${label}${history ? '' : ', nothing measured yet'}`}
      >
        {bars.map((bar, index) => {
          const slice = STATE[bar] ?? STATE.nodata
          const when = buckets[index]?.started_at
          return (
            <span
              key={index}
              title={`${when ? formatDayTime(when) : 'This stretch'} — ${slice.label}`}
              className={cn('min-w-0 flex-1 rounded-[3px]', slice.bar)}
            />
          )
        })}
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{start}</span>
        <span
          className="font-medium text-foreground/80"
          title={
            history
              ? `${history.checks} checks, ${history.outage_checks} of them found something down`
              : undefined
          }
        >
          {history ? `${history.uptime_percent}% working` : 'Nothing measured yet'}
        </span>
        <span>Now</span>
      </div>

      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
    </div>
  )
}

function Fact({ label, value }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{value}</div>
    </div>
  )
}

export function SystemStatus() {
  const [windowKey, setWindowKey] = useState('24h')
  const [status, setStatus] = useState(null)
  const [live, setLive] = useState(null)
  const [clientError, setClientError] = useState(false)
  const [loading, setLoading] = useState(true)

  const poll = useCallback(async () => {
    setClientError(false)
    try {
      const response = await fetch(`${STATUS_URL}?window=${windowKey}`, { cache: 'no-store' })
      if (!response.ok) throw new Error(`Status service returned ${response.status}.`)
      const body = await response.json()
      setStatus(body)
      // Until the scheduler has written its first observation the page answers for
      // itself, from one live readiness check, and says which one it is showing.
      if (body.latest) {
        setLive(null)
      } else {
        const ready = await fetch(READY_URL, { cache: 'no-store' })
        setLive(ready.ok ? await ready.json() : null)
      }
    } catch {
      setClientError(true)
    } finally {
      setLoading(false)
    }
  }, [windowKey])

  useEffect(() => {
    const first = setTimeout(poll, 0)
    const timer = setInterval(poll, POLL_MS)
    return () => {
      clearTimeout(first)
      clearInterval(timer)
    }
  }, [poll])

  const services = useMemo(() => {
    if (status?.components && Object.keys(status.components).length) return status.components
    if (!live) return {}
    return Object.fromEntries(
      Object.entries(live)
        .filter(([, value]) => typeof value === 'string')
        .map(([key, value]) => [key, readLiveState(value)]),
    )
  }, [status, live])

  const recorded = Boolean(status?.latest)
  const overall = recorded ? (status.overall ?? 'unknown') : deriveOverall(services)
  const servicesNote = clientError
    ? 'We could not check anything just now, so every row below shows no result.'
    : recorded
      ? 'Something listed as "not turned on" was never switched on for this site. It is not a problem.'
      : 'Nothing has been measured yet, so this shows what one look right now can see.'

  return (
    <div className="min-h-screen bg-canvas">
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

      <main className="mx-auto max-w-5xl space-y-6 px-4 py-12 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">System status</h1>
            <p className="text-sm text-muted-foreground">
              {clientError || recorded
                ? 'We look at every part of Vulnix once a minute and keep the results for two weeks.'
                : 'We look at every part of Vulnix once a minute. Nothing has been measured yet, so what you see below is one look happening right now.'}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={poll} disabled={loading}>
            <RefreshCw className="size-3.5" data-icon="inline-start" />
            Check now
          </Button>
        </div>

        <Banner
          status={status}
          overall={overall}
          recorded={recorded}
          clientError={clientError}
          loading={loading}
        />

        <div className="flex flex-wrap items-center gap-2">
          {WINDOWS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setWindowKey(option.key)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                windowKey === option.key
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700'
                  : 'border-border bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {option.label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-muted-foreground">
            {status?.latest ? `Updated ${formatTime(status.latest.checked_at)}` : 'Not updated yet'}
          </span>
        </div>

        {!clientError && (
          <div className="grid gap-3 sm:grid-cols-3">
            <Fact
              label="Working"
              value={
                status?.uptime_percent == null
                  ? 'Nothing measured yet'
                  : `${status.uptime_percent}% of the time`
              }
            />
            <Fact
              label="Checks taken"
              value={status?.total_checks ? `${status.total_checks}` : '0'}
            />
            <Fact
              label="How fast it answers"
              value={
                status?.latest?.latency_ms == null
                  ? '—'
                  : status.latest.latency_ms < 1000
                    ? `${status.latest.latency_ms} ms`
                    : `${(status.latest.latency_ms / 1000).toFixed(1)} seconds`
              }
            />
          </div>
        )}

        <HistoryStrip buckets={status?.buckets ?? []} windowKey={windowKey} />

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">What we look at</h2>
          <p className="text-[11px] text-muted-foreground">{servicesNote}</p>
          {loading && !status ? (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              {COMPONENTS.map((c) => (
                <div key={c.key} className="h-[132px] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card shadow-xs">
              {COMPONENTS.map(({ key, label, Icon, description }) => (
                <ServiceRow
                  key={key}
                  label={label}
                  Icon={Icon}
                  description={description}
                  state={clientError && !services[key] ? 'unknown' : (services[key] ?? 'unknown')}
                  history={status?.services?.[key]}
                  buckets={status?.buckets ?? []}
                  windowKey={windowKey}
                />
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-base font-semibold text-foreground">Recent problems</h2>
          <Incidents incidents={status?.incidents ?? []} windowKey={windowKey} />
        </section>
      </main>
    </div>
  )
}
