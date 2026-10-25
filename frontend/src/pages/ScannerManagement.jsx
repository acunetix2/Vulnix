import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CircleDashed,
  Clock,
  ScanSearch,
  ShieldCheck,
  TriangleAlert,
  Wrench,
} from 'lucide-react'
import { api } from '../services/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { Button } from '../components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { PageStack, StatGrid } from '../components/app/Grids'
import { PageHeader } from '../components/app/PageHeader'
import { Panel } from '../components/app/Panel'
import { StatCard } from '../components/app/StatCard'
import { Pill } from '../components/app/SeverityBadge'
import { InlineCode } from '../components/app/CodeBlock'
import { EmptyState, ErrorState, PanelsSkeleton } from '../components/EmptyState'
import { SEVERITY_ORDER } from '../lib/severity'
import { cn, formatRelativeTime } from '../lib/utils'

/**
 * Agent-first: the AI review agent is the scanner, and the CLI tools below it
 * (semgrep, bandit, gitleaks, pip-audit, trivy) are optional inputs that only
 * appear when installed on the worker. Nothing here can be enabled or tuned —
 * what is real and worth showing is every `tool_run` the API records: status,
 * version, duration, exit code, error code and finding count.
 */
const PROJECT_LIMIT = 12
const SCANS_PER_PROJECT = 3
const DETAIL_LIMIT = 10

const RUN_TONES = {
  succeeded: 'success',
  failed: 'danger',
  timed_out: 'danger',
  skipped: 'neutral',
  running: 'info',
  queued: 'neutral',
}

function runMeaning(run) {
  if (run.tool_name === 'agent') {
    if (run.status === 'skipped')
      return 'Turned off for this scan, or no reviewer is configured on this server. The CLI tools still ran.'
    if (run.status === 'succeeded') return 'Read the archive and its findings were counted.'
    if (run.status === 'failed')
      return `${run.error_code || 'The agent'} could not complete; enabled CLI tools still count.`
    return 'Reading files now, one at a time.'
  }
  if (run.status === 'skipped' && run.error_code === 'TOOL_UNAVAILABLE')
    return 'Not installed on this worker. Its absence is a note, not a failed scan.'
  const meanings = {
    succeeded: 'Finished and its findings were counted.',
    failed: 'Exited unexpectedly; anything it would have found is missing.',
    timed_out: 'Killed at the worker time limit; results are incomplete.',
    skipped: 'Nothing to analyze — the manifest or file types it needs were absent.',
    running: 'Still working when this page was read.',
    queued: 'Waiting for worker capacity.',
  }
  return meanings[run.status] || 'Status reported by the worker.'
}

function formatDuration(ms) {
  if (ms == null) return '—'
  const secs = Math.round(ms / 1000)
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
}

export function ScannerManagement() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()

  const [state, setState] = useState({
    loading: false,
    error: null,
    runs: [],
    scans: [],
    inspected: 0,
    failed: [],
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
        const names = new Map(projects.map((p) => [p.id, p.name]))

        const lists = await Promise.all(
          projects
            .slice(0, PROJECT_LIMIT)
            .map((project) =>
              api
                .getScans(project.id, { limit: SCANS_PER_PROJECT })
                .then((page) => page.items || [])
                .catch(() => [])
            )
        )

        const recent = lists
          .flat()
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .slice(0, DETAIL_LIMIT)

        const failed = []
        const details = await Promise.all(
          recent.map((scan) =>
            api
              .getScan(scan.id)
              .then((detail) => detail)
              .catch(() => {
                failed.push(scan.id)
                return { ...scan, tool_runs: [] }
              })
          )
        )

        const runs = details.flatMap((scan) =>
          (scan.tool_runs || []).map((run) => ({
            ...run,
            scan_id: scan.id,
            scan_status: scan.status,
            project_name: names.get(scan.project_id) || 'Unknown project',
            scan_created_at: scan.created_at,
          }))
        )

        if (cancelled) return
        setState({ loading: false, error: null, runs, scans: details, inspected: details.length, failed })
      } catch (err) {
        if (!cancelled) {
          setState({ loading: false, error: err.message, runs: [], scans: [], inspected: 0, failed: [] })
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId, attempt])

  const tools = useMemo(() => {
    const map = new Map()
    for (const run of state.runs) {
      const entry =
        map.get(run.tool_name) ||
        { name: run.tool_name, runs: 0, succeeded: 0, problems: 0, skipped: 0, findings: 0, durations: [], versions: new Set(), errors: new Set() }
      entry.runs += 1
      if (run.status === 'succeeded') entry.succeeded += 1
      if (run.status === 'failed' || run.status === 'timed_out') entry.problems += 1
      if (run.status === 'skipped') entry.skipped += 1
      entry.findings += Number(run.finding_count) || 0
      if (typeof run.duration_ms === 'number') entry.durations.push(run.duration_ms)
      if (run.tool_version) entry.versions.add(run.tool_version)
      if (run.error_code) entry.errors.add(run.error_code)
      map.set(run.tool_name, entry)
    }
    return [...map.values()]
      .map((tool) => ({
        ...tool,
        versions: [...tool.versions],
        errors: [...tool.errors],
        avgMs: tool.durations.length
          ? Math.round(tool.durations.reduce((a, b) => a + b, 0) / tool.durations.length)
          : null,
        maxMs: tool.durations.length ? Math.max(...tool.durations) : null,
      }))
      .sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name))
  }, [state.runs])

  const totals = useMemo(() => {
    const severity = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }
    for (const scan of state.scans) {
      const bySeverity = scan.summary?.by_severity || {}
      for (const key of SEVERITY_ORDER) severity[key] += Number(bySeverity[key]) || 0
    }
    const finished = state.scans.filter(
      (scan) => scan.status === 'completed' || scan.status === 'completed_with_errors'
    ).length
    return {
      severity,
      findings: SEVERITY_ORDER.reduce((sum, s) => sum + severity[s], 0),
      finished,
      problems: state.runs.filter((run) => run.status === 'failed' || run.status === 'timed_out').length,
      slowest: tools.reduce((acc, tool) => ((tool.maxMs ?? -1) > (acc?.maxMs ?? -1) ? tool : acc), null),
    }
  }, [state.scans, state.runs, tools])

  const header = (
    <PageHeader
      title="Review activity"
      description={`The AI agent is the scanner; CLI tools are optional input. Read from the ${state.inspected || DETAIL_LIMIT} most recent scans.`}
      actions={
        <Button variant="outline" render={<Link to="/app/audits/runs" />}>
          <ScanSearch data-icon="inline-start" />
          All scans
        </Button>
      }
    />
  )

  if (wsLoading || state.loading) {
    return (
      <PageStack>
        {header}
        <PanelsSkeleton />
      </PageStack>
    )
  }

  if (wsError || state.error) {
    return (
      <PageStack>
        {header}
        <Panel>
          <ErrorState
            title={wsError ? 'We couldn’t load your workspace' : 'We couldn’t load review activity'}
            description={wsError || state.error}
            onRetry={() => (wsError ? retryWorkspace() : setAttempt((a) => a + 1))}
          />
        </Panel>
      </PageStack>
    )
  }

  return (
    <PageStack>
      {header}

      <StatGrid>
        <StatCard
          icon={Wrench}
          label="Analyzers observed"
          value={tools.length}
          hint={`across ${state.runs.length} recorded runs`}
          tone="slate"
          to="/app/audits/runs"
        />
        <StatCard
          icon={ScanSearch}
          label="Audits inspected"
          value={state.inspected}
          hint={`${totals.finished} finished`}
          tone="blue"
          to="/app/audits/runs"
        />
        <StatCard
          icon={TriangleAlert}
          label="Failed or timed-out runs"
          value={totals.problems}
          hint={totals.problems ? 'findings may be missing' : 'none in these scans'}
          tone={totals.problems > 0 ? 'red' : 'green'}
          to="/app/audits/runs?status=completed_with_errors"
        />
        <StatCard
          icon={Clock}
          label="Slowest run"
          value={totals.slowest ? formatDuration(totals.slowest.maxMs) : '—'}
          hint={totals.slowest ? totals.slowest.name : 'no durations recorded'}
          tone="amber"
        />
      </StatGrid>

      <Panel
        flush
        title="Per-analyzer totals"
        description="Derived from the tool runs of the audits above — not a registry of installed tools"
        footer={
          <p className="text-xs text-muted-foreground">
            An analyzer absent from this list was not requested, had nothing matching its file types,
            or is not installed on the worker. Counts cover only the {state.inspected} most recent
            scans read here.
            {state.failed.length > 0 && (
              <span className="text-destructive"> {state.failed.length} audits could not be opened.</span>
            )}
          </p>
        }
      >
        {tools.length === 0 ? (
          <EmptyState
            icon={CircleDashed}
            title="No runs recorded yet"
            description="Scans exist but none reported a step in the pages we read. Open a scan to check whether it is still queued or running."
            action={
              <Button render={<Link to="/app/audits/runs" />}>
                <ScanSearch data-icon="inline-start" />
                Open scans
              </Button>
            }
            className="py-10"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Analyzer</TableHead>
                <TableHead>Version seen</TableHead>
                <TableHead>Runs</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead>Findings reported</TableHead>
                <TableHead>Avg / longest</TableHead>
                <TableHead>Error codes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tools.map((tool) => (
                <TableRow key={tool.name}>
                  <TableCell className="font-medium text-foreground">{tool.name}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {tool.versions.length ? tool.versions.join(', ') : '—'}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">{tool.runs}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Pill tone={tool.succeeded === tool.runs ? 'success' : 'warning'}>
                        {tool.succeeded}/{tool.runs} succeeded
                      </Pill>
                      {tool.problems > 0 && <Pill tone="danger">{tool.problems} failed</Pill>}
                      {tool.skipped > 0 && <Pill tone="neutral">{tool.skipped} skipped</Pill>}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {tool.succeeded > 0 ? tool.findings : '—'}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatDuration(tool.avgMs)} / {formatDuration(tool.maxMs)}
                  </TableCell>
                  <TableCell>
                    {tool.errors.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {tool.errors.map((code) => (
                          <InlineCode key={code}>{code}</InlineCode>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">none</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Panel
        flush
        title="Recent runs"
        description="Newest first, with the exit code and error detail each run reported"
      >
        {state.runs.length === 0 ? (
          <EmptyState
            icon={Wrench}
            title="Nothing to list"
            description="Run a scan from a project; the agent and each enabled tool report their status, duration and finding count here as the scan progresses."
            action={
              <Button render={<Link to="/app/projects" />}>
                <ScanSearch data-icon="inline-start" />
                Choose a project
              </Button>
            }
            className="py-10"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Analyzer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Exit code</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Findings</TableHead>
                <TableHead>Scan</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.runs.slice(0, 40).map((run) => (
                <TableRow key={run.id}>
                  <TableCell className="font-medium text-foreground">
                    {run.tool_name}
                    {run.tool_version && (
                      <span
                        className={cn(
                          'ml-1.5 text-xs text-muted-foreground',
                          run.tool_name !== 'agent' && 'font-mono'
                        )}
                      >
                        {run.tool_name === 'agent' ? run.tool_version : `v${run.tool_version}`}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill tone={RUN_TONES[run.status] || 'neutral'}>
                        {String(run.status).replace(/_/g, ' ')}
                      </Pill>
                      {run.error_code && <InlineCode>{run.error_code}</InlineCode>}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{runMeaning(run)}</p>
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {run.exit_code ?? '—'}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatDuration(run.duration_ms)}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {run.status === 'succeeded' ? run.finding_count : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to={`/app/audits/runs/${run.scan_id}`}
                      aria-label={`Open audit in ${run.project_name}`}
                      className="text-sm font-medium text-primary transition-colors duration-150 ease-smooth hover:text-primary-hover"
                    >
                      {run.project_name}
                    </Link>
                    <span className="block text-xs text-muted-foreground">
                      {formatRelativeTime(run.scan_created_at)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <Panel
        title="Findings from the audits read"
        description="Severity totals straight from each audit summary"
      >
        {totals.findings === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No findings counted"
            description="The scans inspected here carry no severity counts. A clean scan does not prove the code is secure."
            className="py-8"
          />
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-5">
            {SEVERITY_ORDER.map((s) => (
              <li key={s}>
                <Link
                  to={`/app/audits/findings?severity=${s}`}
                  className="block rounded-lg border border-border bg-muted/40 px-3 py-2.5 transition-[border-color,background-color] duration-150 ease-smooth hover:border-border-strong hover:bg-muted"
                >
                  <p className="text-lg font-semibold tabular-nums text-foreground">{totals.severity[s]}</p>
                  <p className="text-xs font-medium text-muted-foreground capitalize">{s}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          A CLI tool that failed or timed out means its share of findings is missing rather than
          zero; the agent’s own findings are counted either way.
        </p>
      </Panel>
    </PageStack>
  )
}
