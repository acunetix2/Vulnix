import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Layers,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Scale,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/app/Tabs'
import { EmptyState, ErrorState, PanelsSkeleton } from '../components/EmptyState'
import { SEVERITY_DOTS, SEVERITY_ORDER } from '../lib/severity'
import { cn, formatRelativeTime } from '../lib/utils'

/**
 * What exists: scan summaries (`summary.by_severity`, `summary.tool_runs`),
 * the analyzers each scan requested (`scan.options`) and findings filtered by
 * the three real categories. What does not exist: a rule → OWASP/CWE mapping
 * table, a compliance score, or any historical scoring. So the framework
 * mapping is shown as an unmapped catalogue instead of a percentage, and every
 * number on this page can be traced to an audit we actually read.
 */
const PROJECT_LIMIT = 24
const SCAN_LOOKBACK = 5
const FINDING_LIMIT = 100
const DONE_STATUSES = ['completed', 'completed_with_errors']

const EMPTY_COUNTS = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }

const ANALYZERS = [
  { key: 'static_analysis', label: 'Static analysis', category: 'static_analysis' },
  { key: 'secrets', label: 'Secret detection', category: 'secrets' },
  { key: 'dependencies', label: 'Dependency analysis', category: 'dependencies' },
]

const TRIAGE_STATUSES = ['open', 'fixed', 'false_positive', 'accepted_risk']

/** Public catalogue labels only — no counts, no scores, nothing invented. */
const OWASP_TOP_10 = [
  ['A01', 'Broken Access Control'],
  ['A02', 'Cryptographic Failures'],
  ['A03', 'Injection'],
  ['A04', 'Insecure Design'],
  ['A05', 'Security Misconfiguration'],
  ['A06', 'Vulnerable and Outdated Components'],
  ['A07', 'Identification and Authentication Failures'],
  ['A08', 'Software and Data Integrity Failures'],
  ['A09', 'Logging and Monitoring Failures'],
  ['A10', 'Server-Side Request Forgery'],
]

const CWE_TOP = [
  ['CWE-79', 'Cross-site Scripting'],
  ['CWE-89', 'SQL Injection'],
  ['CWE-20', 'Improper Input Validation'],
  ['CWE-78', 'OS Command Injection'],
  ['CWE-22', 'Path Traversal'],
  ['CWE-352', 'Cross-Site Request Forgery'],
  ['CWE-787', 'Out-of-bounds Write'],
  ['CWE-862', 'Missing Authorization'],
]

function tally(target, source = {}) {
  for (const key of Object.keys(target)) target[key] += Number(source[key]) || 0
}

export function ComplianceDashboard() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()

  const [state, setState] = useState({
    loading: false,
    error: null,
    projects: [],
    scans: [],
    findings: [],
    coveredProjects: 0,
    truncated: false,
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
        const projects = (projectsPage.items || []).slice(0, PROJECT_LIMIT)

        const perProject = await Promise.all(
          projects.map((project) =>
            api
              .getScans(project.id, { limit: SCAN_LOOKBACK })
              .then((page) => ({
                project,
                items: (page.items || []).map((scan) => ({ ...scan, project_name: project.name })),
              }))
              .catch(() => ({ project, items: [] }))
          )
        )

        const scans = perProject
          .flatMap(({ items }) => items)
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        const done = []
        for (const scan of scans) {
          if (!DONE_STATUSES.includes(scan.status)) continue
          if (done.some((s) => s.project_id === scan.project_id)) continue
          done.push(scan)
        }

        const failed = []
        const pages = await Promise.all(
          done.map((scan) =>
            api
              .getFindings(scan.id, { limit: FINDING_LIMIT })
              .then((page) => ({
                scan,
                items: (page.items || []).map((f) => ({
                  ...f,
                  scan_id: f.scan_id || scan.id,
                  project_name: scan.project_name,
                })),
                next_cursor: page.next_cursor || null,
              }))
              .catch(() => {
                failed.push(scan.id)
                return { scan, items: [], next_cursor: null }
              })
          )
        )

        if (cancelled) return
        setState({
          loading: false,
          error: null,
          projects,
          scans,
          findings: pages.flatMap((page) => page.items),
          coveredProjects: done.length,
          truncated: pages.some((page) => page.next_cursor),
          failed,
        })
      } catch (err) {
        if (!cancelled) {
          setState({
            loading: false,
            error: err.message,
            projects: [],
            scans: [],
            findings: [],
            coveredProjects: 0,
            truncated: false,
            failed: [],
          })
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId, attempt])

  const derived = useMemo(() => {
    const doneScans = state.scans.filter((scan) => DONE_STATUSES.includes(scan.status))

    const severity = { ...EMPTY_COUNTS }
    for (const scan of doneScans) tally(severity, scan.summary?.by_severity)
    const severityTotal = SEVERITY_ORDER.reduce((sum, s) => sum + severity[s], 0)

    // Which analyzers were enabled, counted per audit rather than per project.
    const requested = {}
    for (const { key, label, category } of ANALYZERS) {
      const enabled = doneScans.filter((scan) => scan.options?.[key] !== false)
      const withFindings = state.findings.filter((f) => f.category === category)
      requested[category] = {
        label,
        scans: enabled.length,
        findings: withFindings.length,
        open: withFindings.filter((f) => !f.status || f.status === 'open').length,
        projects: new Set(withFindings.map((f) => f.project_name)).size,
      }
    }

    // Per-tool coverage straight from the audit summaries.
    const tools = new Map()
    for (const scan of doneScans) {
      for (const run of scan.summary?.tool_runs || []) {
        const entry =
          tools.get(run.tool) ||
          { name: run.tool, runs: 0, succeeded: 0, failed: 0, findings: 0, durations: [] }
        entry.runs += 1
        if (run.status === 'succeeded') entry.succeeded += 1
        if (run.status === 'failed' || run.status === 'timed_out') entry.failed += 1
        entry.findings += Number(run.finding_count) || 0
        if (typeof run.duration_ms === 'number') entry.durations.push(run.duration_ms)
        tools.set(run.tool, entry)
      }
    }
    const toolRows = [...tools.values()]
      .map((tool) => ({
        ...tool,
        avgMs: tool.durations.length
          ? Math.round(tool.durations.reduce((a, b) => a + b, 0) / tool.durations.length)
          : null,
      }))
      .sort((a, b) => b.runs - a.runs || a.name.localeCompare(b.name))

    const triage = {}
    for (const status of TRIAGE_STATUSES) {
      triage[status] = state.findings.filter((f) => (f.status || 'open') === status).length
    }

    const openBySeverity = {}
    for (const severityKey of SEVERITY_ORDER) {
      openBySeverity[severityKey] = state.findings.filter(
        (f) => (f.status || 'open') === 'open' && f.severity === severityKey
      ).length
    }

    return { doneScans, severity, severityTotal, requested, toolRows, triage, openBySeverity }
  }, [state])

  const newestScan = derived.doneScans[0]

  const header = (
    <PageHeader
      title="Compliance"
      description="What the scanners cover today, and which framework mappings are not connected yet."
      actions={
        <Button variant="outline" render={<Link to="/app/reports" />}>
          <Layers data-icon="inline-start" />
          Export an audit report
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
            title={wsError ? 'We couldn’t load your workspace' : 'We couldn’t load compliance data'}
            description={wsError || state.error}
            onRetry={() => (wsError ? retryWorkspace() : setAttempt((a) => a + 1))}
          />
        </Panel>
      </PageStack>
    )
  }

  if (state.projects.length === 0) {
    return (
      <PageStack>
        {header}
        <Panel>
          <EmptyState
            icon={ScanSearch}
            title="Nothing to assess yet"
            description="Compliance coverage is calculated from completed audits. Add a project, upload an archive and run an audit."
            action={
              <Button render={<Link to="/app/projects" />}>
                <ScanSearch data-icon="inline-start" />
                New project
              </Button>
            }
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
          icon={Layers}
          label="Completed audits"
          value={derived.doneScans.length}
          hint={`${state.scans.length} audits in view`}
          tone="blue"
          to="/app/audits/runs"
        />
        <StatCard
          icon={ShieldCheck}
          label="Projects with an audit"
          value={state.coveredProjects}
          hint={`of ${state.projects.length} projects`}
          to="/app/projects"
        />
        <StatCard
          icon={ShieldAlert}
          label="Open critical"
          value={derived.openBySeverity.critical}
          hint={`${derived.openBySeverity.high} high also open`}
          tone={derived.openBySeverity.critical + derived.openBySeverity.high > 0 ? 'red' : 'green'}
          to="/app/audits/findings?status=open&severity=critical"
        />
        <StatCard
          icon={ScanSearch}
          label="Last completed audit"
          value={newestScan ? formatRelativeTime(newestScan.created_at) : 'Never'}
          hint={newestScan ? newestScan.project_name : 'Run one to begin'}
          tone={newestScan ? 'green' : 'slate'}
          to={newestScan ? `/app/audits/runs/${newestScan.id}` : '/app/audits/runs'}
        />
      </StatGrid>

      <Tabs defaultValue="coverage">
        <TabsList>
          <TabsTrigger value="coverage">Scanner coverage</TabsTrigger>
          <TabsTrigger value="posture">Findings posture</TabsTrigger>
          <TabsTrigger value="frameworks">Framework mapping</TabsTrigger>
        </TabsList>

        <TabsContent value="coverage" className="mt-4 space-y-4">
          <Panel
            flush
            title="Coverage by analyzer"
            description="Enabled in a completed audit, counted from audit options and finding categories"
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Analyzer</TableHead>
                  <TableHead>Enabled in</TableHead>
                  <TableHead>Projects with findings</TableHead>
                  <TableHead>Findings loaded</TableHead>
                  <TableHead>Still open</TableHead>
                  <TableHead>
                    <span className="sr-only">Filtered findings</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ANALYZERS.map(({ key, label, category }) => {
                  const row = requestedOrEmpty(derived.requested, category)
                  return (
                    <TableRow key={key}>
                      <TableCell className="font-medium text-foreground">{label}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {row.scans} of {derived.doneScans.length} scans
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{row.projects}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{row.findings}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{row.open}</TableCell>
                      <TableCell className="text-right">
                        <Link
                          to={`/app/audits/findings?category=${category}`}
                          className="text-sm font-medium text-primary transition-colors duration-150 ease-smooth hover:text-primary-hover"
                        >
                          Filter
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </Panel>

          <Panel
            flush
            title="Scanners that reported"
            description="Aggregated from every completed audit’s summary"
            footer={
              <p className="text-xs text-muted-foreground">
                A tool missing from this list was not requested, was not installed on the worker, or
                its run ended before reporting. See an audit for exit codes and error details.
              </p>
            }
          >
            {derived.toolRows.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No scanner results recorded"
                description="Completed audits in view did not carry a tool summary, so no coverage claim can be made."
                className="py-10"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scanner</TableHead>
                    <TableHead>Runs</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead>Failed or timed out</TableHead>
                    <TableHead>Findings reported</TableHead>
                    <TableHead>Avg duration</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {derived.toolRows.map((tool) => (
                    <TableRow key={tool.name}>
                      <TableCell className="font-medium text-foreground">{tool.name}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{tool.runs}</TableCell>
                      <TableCell>
                        <Pill tone={tool.succeeded === tool.runs ? 'success' : 'warning'}>
                          {tool.succeeded} of {tool.runs}
                        </Pill>
                      </TableCell>
                      <TableCell>
                        {tool.failed > 0 ? (
                          <Pill tone="danger">{tool.failed}</Pill>
                        ) : (
                          <span className="text-sm text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">{tool.findings}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatDuration(tool.avgMs)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="posture" className="mt-4 space-y-4">
          <Panel
            title="Severity across completed audits"
            description="Summed from each audit’s own summary counts"
          >
            {derived.severityTotal === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No findings counted"
                description="Completed audits in view reported no findings. This does not prove the code is secure, and it is not a compliance pass."
                className="py-8"
              />
            ) : (
              <SeverityBar counts={derived.severity} total={derived.severityTotal} />
            )}
          </Panel>

          <Panel
            flush
            title="Triage state"
            description={`Counted across ${state.findings.length} findings from ${state.coveredProjects} project audits`}
            footer={
              <p className="text-xs text-muted-foreground">
                Only the newest completed audit per project, and only the first{' '}
                {FINDING_LIMIT} findings of each, are read here; there is no workspace-wide findings
                endpoint and no totals in pagination.
                {state.failed.length > 0 && (
                  <span className="text-destructive"> {state.failed.length} audits could not be read.</span>
                )}
              </p>
            }
          >
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Findings</TableHead>
                  <TableHead>Meaning</TableHead>
                  <TableHead>
                    <span className="sr-only">Filtered findings</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {TRIAGE_STATUSES.map((status) => (
                  <TableRow key={status}>
                    <TableCell>
                      <Pill
                        tone={
                          status === 'open'
                            ? 'danger'
                            : status === 'accepted_risk'
                              ? 'warning'
                              : status === 'fixed'
                                ? 'success'
                                : 'neutral'
                        }
                      >
                        {status.replace(/_/g, ' ')}
                      </Pill>
                    </TableCell>
                    <TableCell className="tabular-nums text-foreground">{derived.triage[status]}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {TRIAGE_MEANING[status]}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to={`/app/audits/findings?status=${status}`}
                        className="text-sm font-medium text-primary transition-colors duration-150 ease-smooth hover:text-primary-hover"
                      >
                        Filter
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        </TabsContent>

        <TabsContent value="frameworks" className="mt-4 space-y-4">
          <Panel title="Is this mapped to a framework?">
            <p className="text-sm text-muted-foreground">
              Findings carry a scanner rule id, a category of static analysis, secrets or
              dependencies, and a severity. Turning those into OWASP or CWE coverage needs a
              maintained rule → weakness mapping and a scoring rule, and neither exists in the
              backend today. There is also no stored history, so a trend line or a compliance score
              would have to be made up.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill tone="neutral">no rule → CWE mapping</Pill>
              <Pill tone="neutral">no scoring rules</Pill>
              <Pill tone="neutral">no historical snapshots</Pill>
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <FrameworkTable
              title="OWASP Top 10 (2021)"
              description="Catalogue listing — the statuses are the honest state"
              rows={OWASP_TOP_10}
            />
            <FrameworkTable
              title="CWE most common weaknesses"
              description="Catalogue listing, not a ranked result"
              rows={CWE_TOP}
            />
          </div>

          <Panel title="What to use today">
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <Scale className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  Export an audit report in Markdown or JSON from{' '}
                  <Link to="/app/reports" className="text-primary underline-offset-4 hover:underline">
                    Reports
                  </Link>{' '}
                  — it includes audit metadata, severity counts, findings and the limitations note, and
                  is the document to attach to a review.
                </span>
              </li>
              <li>
                <Link
                  to="/app/audits/findings?category=static_analysis"
                  className="text-primary underline-offset-4 hover:underline"
                >
                  Filter findings by category
                </Link>{' '}
                to review each analyzer’s output on its own.
              </li>
              <li>
                Triage states on the Findings posture tab are the closest thing to an auditable
                record today; each finding keeps its own history.
              </li>
            </ul>
          </Panel>
        </TabsContent>
      </Tabs>
    </PageStack>
  )
}

const TRIAGE_MEANING = {
  open: 'Not reviewed yet — treat as unverified detection.',
  fixed: 'A reviewer marked it resolved; a new audit confirms it.',
  false_positive: 'A reviewer decided the detector matched something harmless.',
  accepted_risk: 'Known and consciously accepted, with a note on the finding.',
}

const EMPTY_ROW = { scans: 0, findings: 0, open: 0, projects: 0 }

function requestedOrEmpty(map, category) {
  return map[category] || EMPTY_ROW
}

function formatDuration(ms) {
  if (ms == null) return '—'
  const secs = Math.round(ms / 1000)
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
}

function FrameworkTable({ title, description, rows }) {
  return (
    <Panel flush title={title} description={description}>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ref</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Mapping</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(([ref, name]) => (
            <TableRow key={ref}>
              <TableCell>
                <span className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                  {ref}
                </span>
              </TableCell>
              <TableCell className="text-sm text-foreground">{name}</TableCell>
              <TableCell>
                <Pill tone="neutral">not mapped</Pill>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Panel>
  )
}

function SeverityBar({ counts, total }) {
  return (
    <div className="space-y-4">
      <div
        className="flex h-2.5 overflow-hidden rounded-full bg-muted/80 ring-1 ring-border/40 p-0.5"
        role="img"
        aria-label="Findings by severity across completed audits"
      >
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
              className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs font-medium transition-all hover:bg-muted hover:border-border-strong hover:shadow-2xs"
            >
              <span className={cn('size-2 shrink-0 rounded-full', SEVERITY_DOTS[s])} aria-hidden />
              <span className="capitalize text-muted-foreground">{s}</span>
              <span className="ml-auto font-semibold tabular-nums text-foreground">{counts[s]}</span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground">
        Counts represent automated detections across completed scans. Findings are verified once triaged.
      </p>
    </div>
  )
}
