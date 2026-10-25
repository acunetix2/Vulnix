import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  ChevronRight,
  Copy,
  Package,
  PackageSearch,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../services/api'
import { useWorkspace } from '../hooks/useWorkspace'
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
import { PageStack, StatGrid } from '../components/app/Grids'
import { PageHeader } from '../components/app/PageHeader'
import { Panel } from '../components/app/Panel'
import { StatCard } from '../components/app/StatCard'
import { Toolbar } from '../components/app/Toolbar'
import { FindingStatusBadge, SeverityBadge } from '../components/app/SeverityBadge'
import { FilePath, InlineCode } from '../components/app/CodeBlock'
import { EmptyState, ErrorState, TableSkeleton } from '../components/EmptyState'
import { SEVERITY_DOTS, SEVERITY_ORDER } from '../lib/severity'
import { cn, formatRelativeTime } from '../lib/utils'

/**
 * Dependency risk is real, but only as findings: `category=dependencies` is a
 * valid server-side filter, so every number below comes from advisory findings
 * the scanners actually produced. A dependency *inventory* is not — there is no
 * SBOM endpoint, no registry lookup and no version-comparison table, so total
 * package counts, "outdated" and ecosystem splits would be invented.
 */
const PROJECT_LIMIT = 24
const SCAN_LOOKBACK = 5
const FINDING_LIMIT = 100
const DONE_STATUSES = ['completed', 'completed_with_errors']

const EMPTY_COUNTS = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }

const REMEDIATION_STEPS = [
  'Check the advisory linked in the finding for the fixed version and affected version range.',
  'Update the package version in your manifest (requirements.txt, package.json, pyproject.toml, etc.).',
  'Regenerate the lockfile to ensure the transitive graph is also updated.',
  'Run your test suite against the upgraded dependency before committing.',
  'Re-run an audit so the finding can be marked fixed here.',
]

/**
 * pip-audit writes `Package: name version`, trivy `Pkg: name installedVersion`.
 * Reading the package out of the evidence line is a display convenience, not a
 * new fact: when it doesn't parse we show the scanner's own title instead.
 */
function packageOf(finding) {
  const evidence = String(finding.evidence || '')
  const match = evidence.match(/^(?:Package|Pkg):\s*(.+?)\s+(\S+)$/i)
  if (match) return { name: match[1], version: match[2] }
  return { name: finding.title || 'Unknown package', version: null }
}

export function DependencyDashboard() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()

  const [state, setState] = useState({
    loading: false,
    error: null,
    rows: [],
    scannedProjects: [],
    failed: [],
  })
  const [q, setQ] = useState('')
  const [severity, setSeverity] = useState('all')
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
              .then((page) => {
                const done = (page.items || [])
                  .filter((scan) => DONE_STATUSES.includes(scan.status))
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
                return done.length ? { ...done[0], project_name: project.name } : null
              })
              .catch(() => null)
          )
        )
        const scannedProjects = perProject.filter(Boolean)

        const failed = []
        const pages = await Promise.all(
          scannedProjects.map((scan) =>
            api
              .getFindings(scan.id, { category: 'dependencies', limit: FINDING_LIMIT })
              .then((page) => ({
                scan,
                items: page.items || [],
                next_cursor: page.next_cursor || null,
              }))
              .catch(() => {
                failed.push(scan.id)
                return { scan, items: [], next_cursor: null }
              })
          )
        )

        const rows = pages.flatMap(({ scan, items, next_cursor }) =>
          items.map((finding) => ({
            ...finding,
            scan_id: finding.scan_id || scan.id,
            project_name: scan.project_name,
            truncated: Boolean(next_cursor),
          }))
        )

        if (cancelled) return
        setState({ loading: false, error: null, rows, scannedProjects, failed })
      } catch (err) {
        if (!cancelled) {
          setState({ loading: false, error: err.message, rows: [], scannedProjects: [], failed: [] })
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId, attempt])

  const counts = useMemo(() => {
    const bySeverity = { ...EMPTY_COUNTS }
    let open = 0
    for (const row of state.rows) {
      const s = String(row.severity || 'info').toLowerCase()
      if (bySeverity[s] !== undefined) bySeverity[s] += 1
      if (!row.status || row.status === 'open') open += 1
    }
    const total = SEVERITY_ORDER.reduce((sum, s) => sum + bySeverity[s], 0)
    return {
      bySeverity,
      total,
      open,
      advisories: new Set(state.rows.map((row) => row.rule_id).filter(Boolean)).size,
      packages: new Set(state.rows.map((row) => packageOf(row).name)).size,
      projects: new Set(state.rows.map((row) => row.project_name)).size,
    }
  }, [state.rows])

  /** Top packages by number of advisories — useful for triage prioritisation. */
  const topPackages = useMemo(() => {
    const map = new Map()
    for (const row of state.rows) {
      const { name, version } = packageOf(row)
      const key = name
      const entry = map.get(key) || {
        name,
        version,
        advisories: 0,
        critical: 0,
        high: 0,
        projects: new Set(),
      }
      entry.advisories += 1
      const sev = String(row.severity || '').toLowerCase()
      if (sev === 'critical') entry.critical += 1
      if (sev === 'high') entry.high += 1
      if (row.project_name) entry.projects.add(row.project_name)
      map.set(key, entry)
    }
    return [...map.values()]
      .sort(
        (a, b) =>
          b.critical - a.critical ||
          b.high - a.high ||
          b.advisories - a.advisories ||
          a.name.localeCompare(b.name)
      )
      .slice(0, 8)
  }, [state.rows])

  /** Per-project advisory count for the risk table. */
  const projectRisk = useMemo(() => {
    const map = new Map()
    for (const row of state.rows) {
      const proj = row.project_name || 'Unknown project'
      const entry = map.get(proj) || { name: proj, ...EMPTY_COUNTS, total: 0, scanId: row.scan_id }
      const sev = String(row.severity || 'info').toLowerCase()
      if (entry[sev] !== undefined) entry[sev] += 1
      entry.total += 1
      map.set(proj, entry)
    }
    return [...map.values()].sort((a, b) => b.critical - a.critical || b.high - a.high || b.total - a.total)
  }, [state.rows])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return state.rows.filter((row) => {
      if (severity !== 'all' && String(row.severity || '').toLowerCase() !== severity) return false
      if (!needle) return true
      const pkg = packageOf(row)
      return (
        pkg.name.toLowerCase().includes(needle) ||
        row.rule_id?.toLowerCase().includes(needle) ||
        row.title?.toLowerCase().includes(needle) ||
        row.file_path?.toLowerCase().includes(needle) ||
        row.project_name?.toLowerCase().includes(needle)
      )
    })
  }, [state.rows, q, severity])

  async function copyRemediation() {
    const text = [
      'Dependency vulnerability remediation steps',
      '',
      ...REMEDIATION_STEPS.map((step, i) => `${i + 1}. ${step}`),
    ].join('\n')
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Remediation steps copied', { description: 'Five steps for your ticket or PR description.' })
    } catch {
      toast.error('Clipboard unavailable in this browser context')
    }
  }

  const header = (
    <PageHeader
      title="Dependency security"
      description="Advisory findings from the dependency scanner in the latest completed audit of each project."
      actions={
        <Button variant="outline" render={<Link to="/app/audits/findings?category=dependencies" />}>
          <ScanSearch data-icon="inline-start" />
          All dependency findings
        </Button>
      }
    />
  )

  if (wsLoading || state.loading) {
    return (
      <PageStack>
        {header}
        <Panel flush>
          <TableSkeleton rows={7} columns={6} />
        </Panel>
      </PageStack>
    )
  }

  if (wsError || state.error) {
    return (
      <PageStack>
        {header}
        <Panel>
          <ErrorState
            title={wsError ? "We couldn't load your workspace" : "We couldn't load dependency findings"}
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
          icon={TriangleAlert}
          label="Advisory findings"
          value={state.rows.length}
          hint={`${counts.open} still open`}
          tone={counts.open > 0 ? 'red' : 'green'}
          to="/app/audits/findings?category=dependencies"
        />
        <StatCard
          icon={Package}
          label="Packages affected"
          value={counts.packages}
          hint={`${counts.advisories} distinct advisories`}
          tone="amber"
          to="/app/audits/findings?category=dependencies"
        />
        <StatCard
          icon={ScanSearch}
          label="Projects affected"
          value={counts.projects}
          hint={`of ${state.scannedProjects.length} audited`}
          tone="blue"
          to="/app/projects"
        />
        <StatCard
          icon={ShieldCheck}
          label="Audits read"
          value={state.scannedProjects.length}
          hint={state.scannedProjects.length ? 'one completed audit each' : 'none completed yet'}
          tone="slate"
          to="/app/audits/runs"
        />
      </StatGrid>

      {/* Severity distribution + supply chain engines */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Findings by severity"
          description="Severity distribution of third-party package advisories across audited projects"
        >
          {counts.total === 0 ? (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <div className="flex items-center gap-3">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                  <ShieldCheck className="size-4.5" />
                </span>
                <div>
                  <h4 className="text-sm font-semibold text-foreground tracking-tight">No dependency vulnerabilities</h4>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Dependency scanners completed across your recent scans with 0 package advisories detected.
                  </p>
                </div>
              </div>
              <Button size="sm" variant="outline" render={<Link to="/app/audits/findings?category=dependencies" />}>
                All findings
              </Button>
            </div>
          ) : (
            <SeverityBar counts={counts.bySeverity} total={counts.total} />
          )}
        </Panel>

        <Panel
          title="Supply chain engines"
          description="Installed analyzers evaluating dependencies"
        >
          <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <div className="rounded-lg border border-border/80 bg-muted/30 p-2.5">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <Package className="size-3.5 text-primary" />
                Trivy &amp; Pip-Audit
              </h4>
              <p className="mt-1 text-muted-foreground text-[11px]">
                Checks lockfiles and manifests against OSV, PyPI Advisory DB, and GitHub Security Advisories.
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/30 p-2.5">
              <h4 className="font-semibold text-foreground flex items-center gap-2">
                <TriangleAlert className="size-3.5 text-amber-600" />
                Manifest Detection
              </h4>
              <p className="mt-1 text-muted-foreground text-[11px]">
                Analyzes package-lock.json, requirements.txt, poetry.lock, and Gemfiles in uploaded ZIPs.
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* Top affected packages */}
      {topPackages.length > 0 && (
        <Panel
          flush
          title="Most-affected packages"
          description="Ranked by critical and high advisory count — the highest-value targets for an upgrade sprint"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Package</TableHead>
                <TableHead>Version seen</TableHead>
                <TableHead>Advisories</TableHead>
                <TableHead>Critical</TableHead>
                <TableHead>High</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>
                  <span className="sr-only">Filter findings</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topPackages.map((pkg) => (
                <TableRow key={pkg.name}>
                  <TableCell className="font-mono text-sm font-medium text-foreground">
                    {pkg.name}
                  </TableCell>
                  <TableCell>
                    {pkg.version ? (
                      <span className="font-mono text-xs text-muted-foreground">{pkg.version}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-foreground font-semibold">{pkg.advisories}</TableCell>
                  <TableCell>
                    {pkg.critical > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-400">
                        {pkg.critical}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {pkg.high > 0 ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-950/50 dark:text-orange-400">
                        {pkg.high}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground text-xs">
                    {pkg.projects.size} {pkg.projects.size === 1 ? 'project' : 'projects'}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to={`/app/audits/findings?category=dependencies`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors duration-150 ease-smooth hover:text-primary-hover px-2.5 py-1 rounded-md hover:bg-primary-subtle"
                    >
                      Filter
                      <ArrowRight className="size-3.5" aria-hidden />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      {/* Per-project risk breakdown */}
      {projectRisk.length > 0 && (
        <Panel
          flush
          title="Risk by project"
          description="Advisory count per project from the most recent completed audit — sorted by severity"
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Project</TableHead>
                <TableHead className="text-right">Critical</TableHead>
                <TableHead className="text-right">High</TableHead>
                <TableHead className="text-right">Medium</TableHead>
                <TableHead className="text-right">Low</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>
                  <span className="sr-only">View audit</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {projectRisk.map((proj) => (
                <TableRow key={proj.name}>
                  <TableCell className="font-medium text-foreground max-w-[22ch] truncate">
                    {proj.name}
                  </TableCell>
                  {['critical', 'high', 'medium', 'low'].map((sev) => (
                    <TableCell key={sev} className="text-right tabular-nums">
                      {proj[sev] > 0 ? (
                        <span
                          className={cn(
                            'font-semibold',
                            sev === 'critical' && 'text-red-600 dark:text-red-400',
                            sev === 'high' && 'text-orange-600 dark:text-orange-400',
                            sev === 'medium' && 'text-amber-600 dark:text-amber-400',
                            sev === 'low' && 'text-muted-foreground'
                          )}
                        >
                          {proj[sev]}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                  ))}
                  <TableCell className="text-right tabular-nums font-semibold text-foreground">
                    {proj.total}
                  </TableCell>
                  <TableCell className="text-right">
                    {proj.scanId ? (
                      <Link
                        to={`/app/audits/runs/${proj.scanId}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors duration-150 ease-smooth hover:text-primary-hover px-2.5 py-1 rounded-md hover:bg-primary-subtle"
                      >
                        Audit
                        <ChevronRight className="size-3.5" aria-hidden />
                      </Link>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      {/* Main findings table */}
      <Panel
        flush
        title="Dependency findings"
        description="Newest first, grouped by the audit that reported them"
        footer={
          <p className="text-xs text-muted-foreground">
            The search box only narrows the findings already loaded; advisory, severity, status and
            scanner filters run on the server.
            {state.rows.some((row) => row.truncated) &&
              ' At least one project has more dependency findings than the first page we loaded.'}
            {state.failed.length > 0 && (
              <span className="text-destructive">
                {' '}
                {state.failed.length} of {state.scannedProjects.length} scans could not be read.
              </span>
            )}
          </p>
        }
      >
        <div className="border-b border-border px-4 py-3">
          <Toolbar
            search={q}
            onSearch={setQ}
            placeholder="Search package, advisory or manifest…"
            resultCount={rows.length}
            filters={
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger size="sm" aria-label="Filter by severity">
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All severities</SelectItem>
                  {SEVERITY_ORDER.map((s) => (
                    <SelectItem key={s} value={s} className="capitalize">
                      {s.charAt(0).toUpperCase() + s.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
            onClearFilters={q || severity !== 'all' ? () => { setQ(''); setSeverity('all') } : undefined}
          />
        </div>

        {state.rows.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No dependency findings to show"
            description="Run an audit with dependency analysis on a project that has a manifest, or open a finished audit to read its advisories."
            action={
              <Button render={<Link to="/app/projects" />}>
                <ScanSearch data-icon="inline-start" />
                Choose a project to audit
              </Button>
            }
            className="py-10"
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title="No findings match these filters"
            description="Clear the search or severity filter to see every loaded dependency finding."
            action={
              <Button variant="outline" onClick={() => { setQ(''); setSeverity('all') }}>
                Clear filters
              </Button>
            }
            className="py-10"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Severity</TableHead>
                <TableHead>Advisory</TableHead>
                <TableHead>Package</TableHead>
                <TableHead>Manifest</TableHead>
                <TableHead>Upgrade path</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <span className="sr-only">Open finding</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const pkg = packageOf(row)
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <SeverityBadge severity={row.severity} withDot={false} />
                    </TableCell>
                    <TableCell className="max-w-[26ch]">
                      {row.rule_id ? <InlineCode>{row.rule_id}</InlineCode> : (
                        <span className="text-muted-foreground">no id</span>
                      )}
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {row.project_name || 'Unknown project'} · {formatRelativeTime(row.created_at)}
                      </p>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-sm text-foreground">{pkg.name}</span>
                      {pkg.version && (
                        <span className="ml-1 font-mono text-xs text-muted-foreground">{pkg.version}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.file_path ? (
                        <FilePath path={row.file_path} className="max-w-[22ch] py-0" />
                      ) : (
                        <span className="text-muted-foreground">not reported</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[28ch]">
                      <p className="truncate text-xs text-muted-foreground" title={row.remediation || ''}>
                        {row.remediation || 'See the advisory'}
                      </p>
                    </TableCell>
                    <TableCell>
                      <FindingStatusBadge status={row.status} />
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to={`/app/audits/findings/${row.id}`}
                        aria-label={`Open ${row.title || 'dependency finding'}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors duration-150 ease-smooth hover:text-primary-hover px-2.5 py-1 rounded-md hover:bg-primary-subtle"
                      >
                        Inspect
                        <ChevronRight className="size-3.5" aria-hidden />
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      {/* Remediation guidance */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Remediating a vulnerable dependency"
          description="Order of operations to safely upgrade and verify the fix"
          actions={
            <Button variant="outline" size="sm" onClick={copyRemediation}>
              <Copy data-icon="inline-start" />
              Copy steps
            </Button>
          }
        >
          <ol className="space-y-3">
            {REMEDIATION_STEPS.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-bold tabular-nums text-primary ring-1 ring-primary/20">
                  {i + 1}
                </span>
                <p className="text-xs leading-relaxed text-foreground">{step}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            General guidance: each finding contains scanner-specific remediation details in the advisory link.
          </p>
        </Panel>

        <Panel
          title="Scanner mechanics"
          description="How dependency auditing works in Vulnix"
        >
          <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
              <h4 className="font-semibold text-foreground text-xs flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Advisory Database Matching
              </h4>
              <p className="mt-1">
                Packages are checked against OSV.dev, GitHub Security Advisories (GHSA), and the
                PyPI Advisory DB. The scanner resolves installed versions from lockfiles, not just declared ranges.
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
              <h4 className="font-semibold text-foreground text-xs flex items-center gap-2">
                <Package className="size-4 text-amber-600" />
                Manifest Coverage
              </h4>
              <p className="mt-1">
                Supported manifests include <code className="rounded bg-muted px-1">requirements.txt</code>,{' '}
                <code className="rounded bg-muted px-1">poetry.lock</code>,{' '}
                <code className="rounded bg-muted px-1">package-lock.json</code>, and{' '}
                <code className="rounded bg-muted px-1">Gemfile.lock</code>. Upload an archive containing
                these files to enable detection.
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
              <h4 className="font-semibold text-foreground text-xs flex items-center gap-2">
                <RefreshCw className="size-4 text-sky-600" />
                Re-scanning After Upgrade
              </h4>
              <p className="mt-1">
                After upgrading a package and regenerating the lockfile, upload a new archive and run a fresh
                audit. If the advisory no longer applies, mark the finding fixed during triage.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </PageStack>
  )
}

/**
 * A stacked bar rather than a chart library: the comparison being made is
 * adjacent severity counts against each other, and lengths say that directly.
 */
function SeverityBar({ counts, total }) {
  return (
    <div className="space-y-4">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted/80 ring-1 ring-border/40 p-0.5" role="img" aria-label="Dependency findings by severity">
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
              to={`/app/audits/findings?category=dependencies&severity=${s}`}
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
        pip-audit labels every advisory it reports as medium, so a severity split can understate
        Python findings; the scanner's own label is always shown on the finding itself.
      </p>
    </div>
  )
}
