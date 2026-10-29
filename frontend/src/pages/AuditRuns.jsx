import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FolderKanban,
  ScanSearch,
  ShieldCheck,
  Activity,
  XCircle,
  TimerReset,
  Loader2,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  BarChart3,
  Filter,
  ChevronDown,
  CalendarDays,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { PageStack } from '../components/app/Grids'
import { PageHeader } from '../components/app/PageHeader'
import { AuditTabs } from '../components/app/AuditTabs'
import { Toolbar } from '../components/app/Toolbar'
import { ScanStatusBadge, SeverityCounts } from '../components/app/SeverityBadge'
import { EmptyState, ErrorState, TablePageSkeleton } from '../components/EmptyState'
import { formatRelativeTime } from '../lib/utils'
import { api } from '../services/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { cn } from '../lib/utils'

const PROJECT_LIMIT = 12
const SCANS_PER_PROJECT = 5

function duration(started, completed) {
  if (!started) return '—'
  const end = completed ? new Date(completed) : new Date()
  const secs = Math.max(0, Math.floor((end - new Date(started)) / 1000))
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
}

function StatusIcon({ status, className }) {
  const base = cn('size-4 shrink-0', className)
  switch (status) {
    case 'completed': return <CheckCircle2 className={cn(base, 'text-emerald-500')} />
    case 'completed_with_errors': return <AlertTriangle className={cn(base, 'text-amber-500')} />
    case 'failed': return <XCircle className={cn(base, 'text-destructive')} />
    case 'running': return <Loader2 className={cn(base, 'text-primary animate-spin')} />
    case 'queued': return <TimerReset className={cn(base, 'text-muted-foreground')} />
    case 'cancelled': return <XCircle className={cn(base, 'text-muted-foreground')} />
    default: return <Activity className={cn(base, 'text-muted-foreground')} />
  }
}

function StatCard({ icon: Icon, label, value, detail, accent, danger, trend }) {
  return (
    <div className={cn(
      'relative overflow-hidden rounded-xl border p-5 transition-all',
      danger ? 'border-destructive/30 bg-destructive/5' :
      accent ? 'border-primary/30 bg-primary/5' :
      'border-border bg-card'
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className={cn(
          'grid size-9 shrink-0 place-items-center rounded-lg',
          danger ? 'bg-destructive/10 text-destructive' :
          accent ? 'bg-primary/10 text-primary' :
          'bg-muted text-muted-foreground'
        )}>
          <Icon className="size-4" aria-hidden />
        </div>
        {trend != null && (
          <span className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
            trend > 0 ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive'
          )}>
            {trend > 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className={cn(
        'mt-4 text-3xl font-bold tracking-tight tabular-nums',
        danger ? 'text-destructive' : accent ? 'text-primary' : 'text-foreground'
      )}>
        {value}
      </p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{label}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  )
}

function SeverityBar({ counts }) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return <span className="text-xs text-muted-foreground italic">No findings</span>

  const bars = [
    { key: 'critical', color: 'bg-red-600', label: 'C' },
    { key: 'high', color: 'bg-orange-500', label: 'H' },
    { key: 'medium', color: 'bg-amber-400', label: 'M' },
    { key: 'low', color: 'bg-blue-400', label: 'L' },
    { key: 'info', color: 'bg-slate-400', label: 'I' },
  ].filter(b => counts[b.key] > 0)

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        {bars.map(({ key, color }) => (
          <div
            key={key}
            className={cn('h-full', color)}
            style={{ width: `${(counts[key] / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="flex items-center gap-1">
        {bars.map(({ key, color }) => (
          <span key={key} className="flex items-center gap-0.5 text-[10px] tabular-nums text-muted-foreground">
            <span className={cn('size-1.5 rounded-full', color)} />
            {counts[key]}
          </span>
        ))}
      </div>
    </div>
  )
}

function RunRow({ scan, searchParams }) {
  const href = `/app/audits/runs/${scan.id}${searchParams.toString() ? `?${searchParams}` : ''}`
  const totalFindings = scan.summary?.total_findings ?? 0
  const critHigh = (scan.summary?.by_severity?.critical ?? 0) + (scan.summary?.by_severity?.high ?? 0)

  return (
    <div className="group relative flex items-start gap-4 border-b border-border/60 px-5 py-4 transition-colors last:border-0 hover:bg-muted/40">
      {/* Timeline indicator */}
      <div className="relative mt-0.5 flex flex-col items-center gap-1">
        <StatusIcon status={scan.status} />
        <div className="h-full w-px bg-border/60" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                <FolderKanban className="size-3.5" aria-hidden />
              </span>
              <Link
                to={href}
                className="font-semibold text-foreground transition-colors hover:text-primary"
              >
                {scan.project_name}
              </Link>
              <ScanStatusBadge status={scan.status} />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="size-3" />
                {formatRelativeTime(scan.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {duration(scan.started_at, scan.completed_at)}
              </span>
              {critHigh > 0 && (
                <span className="flex items-center gap-1 font-medium text-destructive">
                  <AlertCircle className="size-3" />
                  {critHigh} critical/high
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {scan.summary?.by_severity ? (
              <div className="flex flex-col gap-1 text-right">
                <span className="text-xs text-muted-foreground">{totalFindings} finding{totalFindings !== 1 ? 's' : ''}</span>
                <SeverityBar counts={scan.summary.by_severity} />
              </div>
            ) : scan.status === 'failed' || scan.status === 'cancelled' ? (
              <span className="text-xs text-muted-foreground italic">Interrupted</span>
            ) : (
              <span className="text-xs text-muted-foreground">Pending</span>
            )}
            <Link
              to={href}
              className="hidden shrink-0 items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground opacity-0 transition-all hover:border-primary/50 hover:text-primary group-hover:flex group-hover:opacity-100"
            >
              View <ArrowRight className="size-3" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActivitySummaryBar({ scans }) {
  if (scans.length === 0) return null

  const last30 = scans.slice(0, 30)
  const maxFindings = Math.max(...last30.map(s => s.summary?.total_findings ?? 0), 1)

  return (
    <div className="flex items-end gap-0.5 h-8">
      {last30.map((scan, i) => {
        const findings = scan.summary?.total_findings ?? 0
        const height = Math.max(2, (findings / maxFindings) * 100)
        const statusColor =
          scan.status === 'completed' ? 'bg-emerald-500/60 hover:bg-emerald-500' :
          scan.status === 'completed_with_errors' ? 'bg-amber-400/60 hover:bg-amber-400' :
          scan.status === 'failed' ? 'bg-destructive/60 hover:bg-destructive' :
          'bg-muted-foreground/30 hover:bg-muted-foreground/60'
        return (
          <div
            key={scan.id || i}
            title={`${scan.project_name} · ${findings} findings · ${scan.status}`}
            className={cn('flex-1 min-w-[2px] rounded-sm transition-colors cursor-pointer', statusColor)}
            style={{ height: `${height}%` }}
          />
        )
      })}
    </div>
  )
}

export function AuditRuns() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()
  const [searchParams, setSearchParams] = useSearchParams()

  const status = searchParams.get('status') || 'all'
  const project = searchParams.get('project') || 'all'
  const q = searchParams.get('q') || ''

  const [state, setState] = useState({ loading: false, error: null, scans: [], projects: [] })
  const [attempt, setAttempt] = useState(0)

  function setParam(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value && value !== 'all' && value !== '') next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false

    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const projectsPage = await api.getProjects(workspaceId, { limit: 100 })
        const projects = projectsPage.items || []

        const lists = await Promise.all(
          projects
            .slice(0, PROJECT_LIMIT)
            .map((p) =>
              api
                .getScans(p.id, { limit: SCANS_PER_PROJECT })
                .then((page) => (page.items || []).map((s) => ({ ...s, project_name: p.name })))
                .catch(() => [])
            )
        )

        const scans = lists
          .flat()
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        if (cancelled) return
        setState({ loading: false, error: null, scans, projects })
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err.message, scans: [], projects: [] })
      }
    }

    load()
    return () => { cancelled = true }
  }, [workspaceId, attempt])

  const filtered = useMemo(
    () =>
      state.scans.filter((scan) => {
        if (status !== 'all' && scan.status !== status) return false
        if (project !== 'all' && scan.project_id !== project) return false
        if (q && !scan.project_name?.toLowerCase().includes(q.toLowerCase())) return false
        return true
      }),
    [state.scans, status, project, q]
  )

  const hasActiveFilters = status !== 'all' || project !== 'all' || q !== ''

  const totalScans = state.scans.length
  const completedScans = state.scans.filter(
    (s) => s.status === 'completed' || s.status === 'completed_with_errors'
  ).length
  const failedScans = state.scans.filter((s) => s.status === 'failed').length
  const runningScans = state.scans.filter((s) => s.status === 'running').length
  const successRate = totalScans ? Math.round((completedScans / totalScans) * 100) : 0

  const totalFindings = state.scans.reduce((acc, s) => acc + (s.summary?.total_findings ?? 0), 0)
  const criticalFindings = state.scans.reduce((acc, s) => acc + (s.summary?.by_severity?.critical ?? 0), 0)

  const header = (
    <div className="space-y-5 border-b border-border pb-0">
      <PageHeader
        title="Audits"
        description="Review run history, track analysis progress, and inspect findings across your projects."
        actions={
          <Button render={<Link to="/app/projects" />}>
            <ScanSearch data-icon="inline-start" />
            Start an audit
          </Button>
        }
      />
      <AuditTabs className="border-0" />
    </div>
  )

  if (wsLoading || state.loading) {
    return (
      <PageStack>
        {header}
        <TablePageSkeleton statCards={4} rows={8} columns={5} />
      </PageStack>
    )
  }

  if (wsError || state.error) {
    return (
      <PageStack>
        {header}
        <div className="rounded-xl border border-border bg-card p-6">
          <ErrorState
            title={wsError ? "We couldn't load your workspace" : "We couldn't load audits"}
            description={wsError || state.error}
            onRetry={() => (wsError ? retryWorkspace() : setAttempt((a) => a + 1))}
          />
        </div>
      </PageStack>
    )
  }

  const STATUS_LABELS = {
    all: 'All statuses',
    queued: 'Queued',
    running: 'Running',
    completed: 'Completed',
    completed_with_errors: 'With errors',
    failed: 'Failed',
    cancelled: 'Cancelled',
  }

  const filters = (
    <>
      <Select value={status} onValueChange={(v) => setParam('status', v)}>
        <SelectTrigger size="sm" aria-label="Filter by status">
          <SelectValue placeholder="Status">
            {(val) => STATUS_LABELS[val] || val || 'Status'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All statuses</SelectItem>
          <SelectItem value="queued">Queued</SelectItem>
          <SelectItem value="running">Running</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="completed_with_errors">With errors</SelectItem>
          <SelectItem value="failed">Failed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      <Select value={project} onValueChange={(v) => setParam('project', v)}>
        <SelectTrigger size="sm" aria-label="Filter by project">
          <SelectValue placeholder="Project">
            {(val) => {
              if (!val || val === 'all') return 'All projects'
              const match = state.projects.find((p) => p.id === val)
              return match ? match.name : val
            }}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All projects</SelectItem>
          {state.projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  )

  return (
    <PageStack>
      {header}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={BarChart3}
          label="Total runs"
          value={totalScans}
          detail={`${filtered.length} match current filters`}
        />
        <StatCard
          icon={ShieldCheck}
          label="Success rate"
          value={`${successRate}%`}
          detail={`${completedScans} of ${totalScans} completed`}
          accent={successRate >= 80}
        />
        <StatCard
          icon={AlertCircle}
          label="Critical findings"
          value={criticalFindings}
          detail={`${totalFindings} total across all runs`}
          danger={criticalFindings > 0}
        />
        <StatCard
          icon={Activity}
          label="Active runs"
          value={runningScans + state.scans.filter(s => s.status === 'queued').length}
          detail={`${failedScans} failed · needs attention`}
          accent={runningScans > 0}
        />
      </div>

      {/* ── Activity chart + overview ── */}
      {state.scans.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Run activity</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Finding volume across the {Math.min(30, state.scans.length)} most recent runs
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500/60" />Completed</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-amber-400/60" />With errors</span>
              <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-destructive/60" />Failed</span>
            </div>
          </div>
          <div className="px-5 py-4">
            <ActivitySummaryBar scans={state.scans} />
          </div>
        </div>
      )}

      {/* ── Filters + Run list ── */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 border-b border-border bg-background/60 px-5 py-3">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Filter className="size-3.5" />
            <span>Filter</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {filters}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {filtered.length} run{filtered.length !== 1 ? 's' : ''}
            </span>
            {hasActiveFilters && (
              <button
                onClick={() => setSearchParams({}, { replace: true })}
                className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="border-b border-border px-5 py-2.5">
          <input
            type="search"
            value={q}
            onChange={e => setParam('q', e.target.value)}
            placeholder="Search by project name…"
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
        </div>

        {/* Run list */}
        {state.scans.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={ScanSearch}
              title="No audits yet"
              description="Open a project and start an audit; audits that are running or finished appear here."
              action={
                <Button render={<Link to="/app/projects" />}>
                  <ScanSearch data-icon="inline-start" />
                  Choose a project
                </Button>
              }
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={ScanSearch}
              title="No audits match these filters"
              description="Adjust the status or project filter, or clear them to see every audit."
              action={
                <Button variant="outline" onClick={() => setSearchParams({}, { replace: true })}>
                  Clear filters
                </Button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-border/0">
            {filtered.map((scan) => (
              <RunRow key={scan.id} scan={scan} searchParams={searchParams} />
            ))}
          </div>
        )}

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="border-t border-border bg-background/40 px-5 py-2.5">
            <p className="text-[11px] text-muted-foreground">
              Showing {filtered.length} of {totalScans} runs ·{' '}
              {state.projects.length} projects scanned ·{' '}
              Findings are per-run, not deduplicated across runs
            </p>
          </div>
        )}
      </div>
    </PageStack>
  )
}
