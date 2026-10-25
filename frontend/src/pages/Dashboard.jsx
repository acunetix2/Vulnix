import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  FolderKanban,
  GitBranch,
  Plus,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { api } from '../services/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { Button } from '../components/ui/button'
import { cn } from '../lib/utils'
import { PageHeader } from '../components/app/PageHeader'
import { Panel } from '../components/app/Panel'
import { IconTile } from '../components/app/IconTile'
import {
  ScanStatusBadge,
  SeverityBadge,
} from '../components/app/SeverityBadge'
import { SEVERITY_DOTS, SEVERITY_ORDER } from '../lib/severity'
import { EmptyState, ErrorState, PanelsSkeleton } from '../components/EmptyState'
import { formatRelativeTime } from '../lib/utils'

/**
 * There is no workspace-level findings endpoint, so the overview has to
 * assemble itself from what exists: projects -> their audits -> each audit's
 * `summary.by_severity`. Bounding the fan-out keeps the page honest about how
 * much of the workspace it actually looked at.
 */
const PROJECT_SCAN_LIMIT = 6
const SCAN_DETAIL_LIMIT = 2

const EMPTY_COUNTS = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }

function addCounts(target, source = {}) {
  for (const key of Object.keys(EMPTY_COUNTS)) {
    target[key] += Number(source[key]) || 0
  }
}

export function Dashboard() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()
  const [state, setState] = useState({
    loading: false,
    error: null,
    projects: [],
    scans: [],
    findings: [],
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false

    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const projectsPage = await api.getProjects(workspaceId, { limit: 100 })
        const projects = projectsPage.items || []

        const scanLists = await Promise.all(
          projects
            .slice(0, PROJECT_SCAN_LIMIT)
            .map((project) =>
              api
                .getScans(project.id, { limit: 5 })
                .then((page) => ({ project, items: page.items || [] }))
                .catch(() => ({ project, items: [] }))
            )
        )

        const scans = scanLists
          .flatMap(({ project, items }) => items.map((scan) => ({ ...scan, project_name: project.name })))
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        const detailSource = scans.filter((s) => s.status === 'completed' || s.status === 'completed_with_errors')
        const findingPages = await Promise.all(
          detailSource
            .slice(0, SCAN_DETAIL_LIMIT)
            .map((scan) =>
              api
                .getFindings(scan.id, { limit: 50 })
                .then((page) => (page.items || []).map((f) => ({ ...f, project_name: scan.project_name })))
                .catch(() => [])
            )
        )
        const findings = findingPages
          .flat()
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        if (cancelled) return
        setState({ loading: false, error: null, projects, scans, findings })
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err.message, projects: [], scans: [], findings: [] })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId, attempt])

  const postureScans = useMemo(() => {
    const latestCompleted = new Map()
    for (const scan of state.scans) {
      if (
        (scan.status === 'completed' || scan.status === 'completed_with_errors') &&
        scan.project_id &&
        !latestCompleted.has(scan.project_id)
      ) {
        latestCompleted.set(scan.project_id, scan)
      }
    }
    return [...latestCompleted.values()]
  }, [state.scans])

  const counts = useMemo(() => {
    const total = { ...EMPTY_COUNTS }
    for (const scan of postureScans) addCounts(total, scan.summary?.by_severity)
    return total
  }, [postureScans])

  const detected = SEVERITY_ORDER.reduce((sum, s) => sum + counts[s], 0)
  const priority = counts.critical + counts.high
  const lastScan = state.scans[0]
  const scannedProjects = postureScans.length
  const hasCompletedScans = postureScans.length > 0
  const hasRunningScans = state.scans.some((s) => s.status === 'running')
  const hasFailedScans = state.scans.some((s) => s.status === 'failed')

  if (wsLoading || state.loading) {
    return (
      <div className="space-y-4">
        <PageHeader title="Overview" description="Security posture across this workspace." />
        <PanelsSkeleton />
      </div>
    )
  }

  if (wsError || state.error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Overview" description="Security posture across this workspace." />
        <Panel>
          <ErrorState
            title={wsError ? 'We couldn’t load your workspace' : 'We couldn’t load the overview'}
            description={wsError || state.error}
            onRetry={() => (wsError ? retryWorkspace() : setAttempt((a) => a + 1))}
          />
        </Panel>
      </div>
    )
  }

  if (state.projects.length === 0) {
    return (
      <div className="space-y-6">
        <DashboardHeading
          projectCount={0}
          actions={
            <Button render={<Link to="/app/projects" />}>
              <Plus data-icon="inline-start" />
              New project
            </Button>
          }
        />
        <section className="rounded-lg border border-border bg-card">
          <EmptyState
            icon={FolderKanban}
            title="Start with a project"
            description="Create a project to bring code into Vulnix. You can upload an archive or connect a GitHub repository, then launch your first security audit."
            action={
              <Button render={<Link to="/app/projects" />}>
                Create a project
                <ArrowRight data-icon="inline-end" />
              </Button>
            }
          />
        </section>
      </div>
    )
  }

  const recentScans = state.scans.slice(0, 5)
  const recentFindings = state.findings.slice(0, 5)
  const criticalFindings = state.findings
    .filter((finding) => ['critical', 'high'].includes(String(finding.severity || '').toLowerCase()))
    .slice(0, 5)
  const projectPosture = state.projects.slice(0, PROJECT_SCAN_LIMIT).map((project) => ({
    project,
    scan: postureScans.find((item) => item.project_id === project.id),
  }))

  return (
    <div className="space-y-5">
      <DashboardHeading
        projectCount={state.projects.length}
        actions={
          <Button render={<Link to="/app/projects" />}>
            <Plus data-icon="inline-start" />
            Add project
          </Button>
        }
      />

      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card xl:grid-cols-4">
        <OverviewMetric
          icon={GitBranch}
          label="Repositories"
          value={state.projects.length}
          hint={`${scannedProjects} with completed audits`}
          to="/app/projects"
        />
        <OverviewMetric
          icon={ScanSearch}
          label="Recent audits"
          value={state.scans.length}
          hint={lastScan ? `Latest ${formatRelativeTime(lastScan.created_at)}` : 'No audits yet'}
          to="/app/audits/runs"
        />
        <OverviewMetric
          icon={ShieldAlert}
          label="Detected issues"
          value={detected}
          hint={detected > 0 ? `${priority} critical or high in latest completed audits` : 'No issues in latest completed audits'}
          to="/app/audits/findings"
          tone={priority > 0 ? 'danger' : detected > 0 ? 'warning' : 'success'}
        />
        <OverviewMetric
          icon={lastScan?.status === 'failed' ? ShieldAlert : ShieldCheck}
          label="Latest audit"
          value={
            lastScan
              ? lastScan.status === 'completed'
                ? 'Passed'
                : lastScan.status === 'failed'
                  ? 'Failed'
                  : lastScan.status === 'running'
                    ? 'Running'
                    : lastScan.status.replace(/_/g, ' ')
              : 'Not run'
          }
          hint={lastScan ? lastScan.project_name : 'Start an audit to see results'}
          to={lastScan ? `/app/audits/runs/${lastScan.id}` : '/app/audits/runs'}
          tone={lastScan?.status === 'failed' ? 'danger' : lastScan?.status === 'completed' ? 'success' : 'neutral'}
        />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Issue distribution</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Latest completed audit per repository · {scannedProjects} of {state.projects.length} repositories
              </p>
            </div>
            <Link to="/app/audits/findings" className="text-xs font-medium text-primary hover:text-primary-hover">
              All findings <ArrowRight className="ml-1 inline size-3.5" aria-hidden />
            </Link>
          </div>
          <div className="p-4">
            {detected > 0 ? (
              <SeverityBar counts={counts} total={detected} />
            ) : (
              <div className="flex min-h-36 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-5 text-center">
                {hasCompletedScans ? (
                  <>
                    <ShieldCheck className="size-5 text-primary" aria-hidden />
                    <p className="mt-2 text-sm font-medium text-foreground">No issues found in the latest completed audits</p>
                    <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
                      This view uses the latest completed audit for each repository with available results.
                    </p>
                  </>
                ) : (
                  <>
                    <ScanSearch className="size-5 text-muted-foreground" aria-hidden />
                    <p className="mt-2 text-sm font-medium text-foreground">
                      {hasRunningScans ? 'Audits are still running' : hasFailedScans ? 'No completed audit results yet' : 'No audit data yet'}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Run an audit to build your security overview.</p>
                  </>
                )}
              </div>
            )}
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-border pt-4">
              <PostureFact label="Critical" value={counts.critical} />
              <PostureFact label="High" value={counts.high} />
              <PostureFact label="Open in latest audits" value={detected} />
            </div>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Critical issues</h2>
              <p className="mt-1 text-xs text-muted-foreground">Critical and high findings from recent completed audits</p>
            </div>
            <Link to="/app/audits/findings" className="text-xs font-medium text-primary hover:text-primary-hover">
              Review <ArrowRight className="ml-1 inline size-3.5" aria-hidden />
            </Link>
          </div>
          {criticalFindings.length ? (
            <ul className="divide-y divide-border">
              {criticalFindings.map((finding) => (
                <li key={finding.id}>
                  <Link
                    to={`/app/audits/findings/${finding.id}`}
                    className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted"
                  >
                    <SeverityBadge severity={finding.severity} withDot={false} />
                    <span className="min-w-0 flex-1">
                      <span className="block line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary">
                        {finding.title || 'Security issue'}
                      </span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">
                        {finding.project_name || 'Unknown repository'}
                        {finding.file_path ? ` · ${finding.file_path}` : ''}
                      </span>
                    </span>
                    <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex min-h-36 flex-col items-center justify-center px-5 text-center">
              <ShieldCheck className="size-5 text-primary" aria-hidden />
              <p className="mt-2 text-sm font-medium text-foreground">
                {hasCompletedScans ? 'No critical or high findings in the recent sample' : 'No findings to review yet'}
              </p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                {hasCompletedScans
                  ? 'The list is based on the latest completed audits available here.'
                  : 'Findings will appear after an audit completes.'}
              </p>
            </div>
          )}
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Repository severity</h2>
            <p className="mt-1 text-xs text-muted-foreground">Latest completed audit per repository, where available</p>
          </div>
          <Link to="/app/projects" className="text-xs font-medium text-primary hover:text-primary-hover">
            All repositories <ArrowRight className="ml-1 inline size-3.5" aria-hidden />
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-muted/30 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5">Repository</th>
                <th className="px-3 py-2.5 text-right">Critical</th>
                <th className="px-3 py-2.5 text-right">High</th>
                <th className="px-3 py-2.5 text-right">Medium</th>
                <th className="px-3 py-2.5 text-right">Low</th>
                <th className="px-4 py-2.5 text-right">Latest audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projectPosture.map(({ project, scan }) => {
                const severity = scan?.summary?.by_severity || EMPTY_COUNTS
                return (
                  <tr key={project.id} className="hover:bg-muted/30">
                    <td className="max-w-[260px] px-4 py-3">
                      <Link to="/app/projects" className="block truncate font-medium text-foreground hover:text-primary">
                        {project.name}
                      </Link>
                    </td>
                    {['critical', 'high', 'medium', 'low'].map((level) => (
                      <td key={level} className="px-3 py-3 text-right tabular-nums text-foreground">{scan ? Number(severity[level]) || 0 : '—'}</td>
                    ))}
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {scan ? formatRelativeTime(scan.completed_at || scan.created_at) : 'Not audited'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {state.projects.length > PROJECT_SCAN_LIMIT && (
          <p className="border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            Showing {PROJECT_SCAN_LIMIT} repositories to keep this overview focused.
          </p>
        )}
      </section>

      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Recent audits</h2>
              <p className="mt-1 text-xs text-muted-foreground">Latest runs across your repositories</p>
            </div>
            <Link to="/app/audits/runs" className="text-xs font-medium text-primary hover:text-primary-hover">
              View all <ArrowRight className="ml-1 inline size-3.5" aria-hidden />
            </Link>
          </div>
          {recentScans.length ? (
            <ul className="divide-y divide-border">
              {recentScans.map((scan) => (
                <li key={scan.id}>
                  <Link to={`/app/audits/runs/${scan.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-foreground">{scan.project_name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{formatRelativeTime(scan.created_at)}</span>
                    </span>
                    <ScanStatusBadge status={scan.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={ScanSearch} title="No audits yet" description="Run an audit to see activity here." />
          )}
        </section>

        <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Recent findings</h2>
              <p className="mt-1 text-xs text-muted-foreground">Findings from the most recent completed audits</p>
            </div>
            <Link to="/app/audits/findings" className="text-xs font-medium text-primary hover:text-primary-hover">
              View all <ArrowRight className="ml-1 inline size-3.5" aria-hidden />
            </Link>
          </div>
          {recentFindings.length ? (
            <ul className="divide-y divide-border">
              {recentFindings.map((finding) => (
                <li key={finding.id}>
                  <Link to={`/app/audits/findings/${finding.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted">
                    <SeverityBadge severity={finding.severity} withDot={false} className="w-[82px] shrink-0 justify-center" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground">{finding.title || 'Security issue'}</span>
                      <span className="mt-1 block truncate text-xs text-muted-foreground">{finding.project_name || 'Unknown repository'}{finding.file_path ? ` · ${finding.file_path}` : ''}</span>
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              compact
              icon={!hasCompletedScans && hasFailedScans ? ShieldAlert : ShieldCheck}
              title={!hasCompletedScans && hasFailedScans ? 'No findings from failed audits' : 'No findings to show'}
              description={!hasCompletedScans && hasFailedScans ? 'Review the failed audit to see what prevented analysis.' : 'Findings appear here after an audit completes.'}
              action={<Button size="sm" variant="outline" render={<Link to={hasFailedScans ? '/app/audits/runs' : '/app/projects'} />}>{hasFailedScans ? 'View audit history' : 'Audit a project'}</Button>}
            />
          )}
        </section>
      </div>
    </div>
  )
}

function DashboardHeading({ projectCount, actions }) {
  return (
    <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-medium text-muted-foreground">WORKSPACE OVERVIEW</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Security overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {projectCount === 0
            ? 'Your projects, audits, and security findings in one place.'
            : `Security posture across ${projectCount} ${projectCount === 1 ? 'project' : 'projects'}.`}
        </p>
      </div>
      {actions}
    </header>
  )
}

function OverviewMetric({ icon: Icon, label, value, hint, to, tone = 'neutral' }) {
  const iconTone = {
    neutral: 'text-muted-foreground',
    danger: 'text-red-600 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
    success: 'text-emerald-600 dark:text-emerald-400',
  }

  return (
    <Link
      to={to}
      className="group min-w-0 border-b border-r border-border p-4 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring xl:border-b-0 [&:nth-child(2n)]:border-r-0 xl:[&:nth-child(2n)]:border-r xl:last:border-r-0"
    >
      <div className="flex min-h-7 items-center gap-2 text-xs font-medium text-muted-foreground">
        <IconTile
          icon={Icon}
          size="md"
          className={iconTone[tone]}
        />
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-3 truncate text-2xl font-semibold tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>
    </Link>
  )
}

function PostureFact({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  )
}

/**
 * A stacked bar beats a donut here: the point is comparing severities against
 * each other, and adjacent lengths do that better than arc angles.
 */
function SeverityBar({ counts, total }) {
  return (
    <div className="space-y-4">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted ring-1 ring-border p-0.5">
        {SEVERITY_ORDER.map((s) =>
          counts[s] > 0 ? (
            <span
              key={s}
              className={cn('h-full first:rounded-l-full last:rounded-r-full transition-all', SEVERITY_DOTS[s])}
              style={{ width: `${(counts[s] / total) * 100}%` }}
              title={`${counts[s]} ${s}`}
            />
          ) : null
        )}
      </div>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {SEVERITY_ORDER.map((s) => (
          <li key={s}>
            <Link
              to={`/app/audits/findings?severity=${s}`}
              className="flex items-center gap-2 rounded-md border border-border bg-muted px-3 py-2 text-xs font-medium transition-colors hover:border-border-strong hover:bg-accent"
            >
              <span className={cn('size-2 shrink-0 rounded-full', SEVERITY_DOTS[s])} />
              <span className="capitalize text-muted-foreground">{s}</span>
              <span className="ml-auto font-semibold tabular-nums text-foreground">{counts[s]}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
