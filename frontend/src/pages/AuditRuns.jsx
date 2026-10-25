import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowRight,
  Clock,
  FolderKanban,
  ScanSearch,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { PageStack } from '../components/app/Grids'
import { PageHeader } from '../components/app/PageHeader'
import { AuditTabs } from '../components/app/AuditTabs'
import { Panel } from '../components/app/Panel'
import { Toolbar } from '../components/app/Toolbar'
import { ViewToggle } from '../components/app/ViewToggle'
import { useViewPreference } from '../hooks/useViewPreference'
import { ScanStatusBadge, SeverityCounts } from '../components/app/SeverityBadge'
import { EmptyState, ErrorState, TablePageSkeleton } from '../components/EmptyState'
import { formatRelativeTime } from '../lib/utils'
import { api } from '../services/api'
import { useWorkspace } from '../hooks/useWorkspace'

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

export function AuditRuns() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()
  const [searchParams, setSearchParams] = useSearchParams()

  const status = searchParams.get('status') || 'all'
  const project = searchParams.get('project') || 'all'
  const q = searchParams.get('q') || ''

  const [state, setState] = useState({ loading: false, error: null, scans: [], projects: [] })
  const [attempt, setAttempt] = useState(0)
  const [view, setView] = useViewPreference('vulnix.audits.runs.view')

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
    return () => {
      cancelled = true
    }
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
        <Panel>
          <ErrorState
            title={wsError ? 'We couldn’t load your workspace' : 'We couldn’t load audits'}
            description={wsError || state.error}
            onRetry={() => (wsError ? retryWorkspace() : setAttempt((a) => a + 1))}
          />
        </Panel>
      </PageStack>
    )
  }

  const STATUS_LABELS = {
    all: 'All statuses',
    queued: 'Queued',
    running: 'Running',
    completed: 'Completed',
    completed_with_errors: 'Completed with errors',
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
          <SelectItem value="completed_with_errors">Completed with errors</SelectItem>
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

      <section
        aria-label="Audit summary"
        className="grid grid-cols-2 divide-x divide-y divide-border border-y border-border sm:grid-cols-4 sm:divide-y-0"
      >
        {[
          { label: 'Runs in view', value: totalScans, detail: `${filtered.length} match filters`, icon: ScanSearch },
          {
            label: 'Completed',
            value: completedScans,
            detail: totalScans ? `${Math.round((completedScans / totalScans) * 100)}% of runs` : 'No runs yet',
            icon: ShieldCheck,
          },
          {
            label: 'Needs attention',
            value: failedScans,
            detail: failedScans ? 'Review failed runs' : 'No failed runs',
            icon: AlertCircle,
          },
          {
            label: 'In progress',
            value: runningScans,
            detail: runningScans ? 'Analysis is underway' : 'No active runs',
            icon: Clock,
          },
        ].map(({ label, value, detail, icon: Icon }) => (
          <div key={label} className="min-w-0 px-4 py-4 first:pl-0 sm:first:pl-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Icon className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate text-xs font-medium">{label}</span>
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{detail}</p>
          </div>
        ))}
      </section>

      <Toolbar
        search={q}
        onSearch={(v) => setParam('q', v)}
        placeholder="Search by project…"
        filters={filters}
        resultCount={filtered.length}
        onClearFilters={hasActiveFilters ? () => setSearchParams({}, { replace: true }) : undefined}
      >
        <ViewToggle value={view} onChange={setView} />
      </Toolbar>

      {state.scans.length === 0 ? (
        <Panel variant="flat">
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
        </Panel>
      ) : filtered.length === 0 ? (
        <Panel variant="flat">
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
        </Panel>
      ) : view === 'grid' ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((scan) => (
            <Link
              key={scan.id}
              to={`/app/audits/runs/${scan.id}${searchParams.toString() ? `?${searchParams}` : ''}`}
              className="group min-w-0 border-y border-border py-4 transition-colors hover:border-foreground/25 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
                    <FolderKanban className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">
                      {scan.project_name}
                    </span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {formatRelativeTime(scan.created_at)}
                    </span>
                  </span>
                </div>
                <ScanStatusBadge status={scan.status} />
              </div>
              <div className="mt-4 flex items-end justify-between gap-3 border-t border-border pt-3">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Findings
                  </p>
                  <div className="mt-1">
                    {scan.summary?.by_severity ? (
                      <SeverityCounts counts={scan.summary.by_severity} />
                    ) : scan.status === 'failed' || scan.status === 'cancelled' ? (
                      <span className="text-xs text-muted-foreground">No results · interrupted</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Analysis pending</span>
                    )}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">
                  {duration(scan.started_at, scan.completed_at)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <Panel
          flush
          variant="flat"
          title="Run history"
          description={`${filtered.length} ${filtered.length === 1 ? 'run' : 'runs'} matching your filters`}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Findings</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((scan) => (
                <TableRow key={scan.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell className="py-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground ring-1 ring-border/50">
                        <FolderKanban className="size-3.5" />
                      </span>
                      <span className="font-semibold text-foreground text-sm tracking-tight truncate">
                        {scan.project_name}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="py-3">
                    <ScanStatusBadge status={scan.status} />
                  </TableCell>
                  <TableCell className="py-3 text-muted-foreground text-xs">
                    {formatRelativeTime(scan.created_at)}
                  </TableCell>
                  <TableCell className="py-3 tabular-nums text-xs text-muted-foreground">
                    {duration(scan.started_at, scan.completed_at)}
                  </TableCell>
                  <TableCell className="py-3">
                    {scan.summary?.by_severity ? (
                      <SeverityCounts counts={scan.summary.by_severity} />
                    ) : scan.status === 'failed' || scan.status === 'cancelled' ? (
                      <span className="text-xs text-muted-foreground italic">None (interrupted)</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Pending</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right py-3">
                    <Link
                      to={`/app/audits/runs/${scan.id}${searchParams.toString() ? `?${searchParams}` : ''}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover transition-colors px-2.5 py-1 rounded-md hover:bg-primary-subtle"
                    >
                      View details
                      <ArrowRight className="size-3" />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}
    </PageStack>
  )
}
