import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronRight,
  Clock,
  Copy,
  KeyRound,
  ScanSearch,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../services/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { Button } from '../components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
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
import { EmptyState, ErrorState, SecretsPageSkeleton, TableSkeleton } from '../components/EmptyState'
import { SEVERITY_ORDER } from '../lib/severity'
import { formatRelativeTime } from '../lib/utils'

/**
 * Secrets are real findings: `GET /scans/:id/findings?category=secrets` filters
 * them server-side. What is *not* real is exposure history — Vulnix audits a
 * uploaded archive, so there is no commit, branch, author or rotation timeline
 * to show, and gitleaks runs with `--redact` so no secret value is ever stored.
 */
const PROJECT_LIMIT = 24
const SCAN_LOOKBACK = 5
const FINDING_LIMIT = 100
const DONE_STATUSES = ['completed', 'completed_with_errors']

const EMPTY_COUNTS = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }

const CHECKLIST = [
  'Revoke and reissue the credential at the provider — assume anything committed has been read.',
  'Remove it from the file, then from build artefacts, logs and any shared snippets.',
  'Load it at runtime from environment variables or a secret manager instead of source.',
  'Check the provider’s usage records for calls made with the exposed credential.',
  'Run another audit so the finding can be marked fixed here.',
]

export function SecretsDashboard() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()

  const [state, setState] = useState({
    loading: false,
    error: null,
    rows: [],
    scannedProjects: [],
    failed: [],
  })
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
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
              .getFindings(scan.id, { category: 'secrets', limit: FINDING_LIMIT })
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
    return { bySeverity, open }
  }, [state.rows])

  const priority = counts.bySeverity.critical + counts.bySeverity.high
  const projectsAffected = new Set(state.rows.map((row) => row.project_name)).size
  const newest = state.rows.reduce(
    (acc, row) => (row.created_at && (!acc || new Date(row.created_at) > new Date(acc)) ? row.created_at : acc),
    null
  )

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return state.rows
      .filter((row) => {
        if (status === 'open' && row.status && row.status !== 'open') return false
        if (status === 'closed' && (!row.status || row.status === 'open')) return false
        if (!needle) return true
        return (
          row.title?.toLowerCase().includes(needle) ||
          row.rule_id?.toLowerCase().includes(needle) ||
          row.file_path?.toLowerCase().includes(needle) ||
          row.project_name?.toLowerCase().includes(needle)
        )
      })
      .sort(
        (a, b) =>
          SEVERITY_ORDER.indexOf(String(a.severity).toLowerCase()) -
            SEVERITY_ORDER.indexOf(String(b.severity).toLowerCase()) ||
          new Date(b.created_at) - new Date(a.created_at)
      )
  }, [state.rows, q, status])

  const header = (
    <PageHeader
      title="Secret detection"
      description="Credentials found by the secret scanner in the latest completed audit of each project."
      actions={
        <Button variant="outline" render={<Link to="/app/audits/findings?category=secrets" />}>
          <ScanSearch data-icon="inline-start" />
          All secret findings
        </Button>
      }
    />
  )

  if (wsLoading || state.loading) {
    return <SecretsPageSkeleton />
  }

  if (wsError || state.error) {
    return (
      <PageStack>
        {header}
        <Panel>
          <ErrorState
            title={wsError ? 'We couldn’t load your workspace' : 'We couldn’t load secret findings'}
            description={wsError || state.error}
            onRetry={() => (wsError ? retryWorkspace() : setAttempt((a) => a + 1))}
          />
        </Panel>
      </PageStack>
    )
  }

  async function copyChecklist() {
    const text = ['Recovering from an exposed credential', '', ...CHECKLIST.map((step, i) => `${i + 1}. ${step}`)].join(
      '\n'
    )
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Checklist copied', { description: 'Five steps for the incident notes or ticket.' })
    } catch {
      toast.error('Clipboard unavailable in this browser context')
    }
  }

  return (
    <PageStack>
      {header}

      <StatGrid>
        <StatCard
          icon={KeyRound}
          label="Secrets detected"
          value={state.rows.length}
          hint={`${counts.open} still open`}
          tone={state.rows.length > 0 ? 'amber' : 'green'}
          to="/app/audits/findings?category=secrets"
        />
        <StatCard
          icon={ShieldCheck}
          label="Critical or high"
          value={priority}
          hint={priority > 0 ? 'Rotate these first' : 'None in what we loaded'}
          tone={priority > 0 ? 'red' : 'green'}
          to="/app/audits/findings?category=secrets"
        />
        <StatCard
          icon={ScanSearch}
          label="Projects affected"
          value={projectsAffected}
          hint={`of ${state.scannedProjects.length} audited`}
          to="/app/projects"
        />
        <StatCard
          icon={Clock}
          label="Most recent"
          value={newest ? formatRelativeTime(newest) : 'None yet'}
          hint={newest ? 'from the audits we read' : 'run an audit to begin'}
          tone="blue"
          to="/app/audits/runs"
        />
      </StatGrid>

      {counts.open > 0 && (
        <Alert variant="destructive">
          <AlertTitle>{counts.open} open {counts.open === 1 ? 'secret' : 'secrets'}</AlertTitle>
          <AlertDescription>
            Treat these credentials as exposed: revoke them at the provider before editing the code.
          </AlertDescription>
        </Alert>
      )}

      <Toolbar
        search={q}
        onSearch={setQ}
        placeholder="Search rule, path or project…"
        filters={
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger size="sm" aria-label="Filter by triage status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="closed">Triaged</SelectItem>
            </SelectContent>
          </Select>
        }
        resultCount={rows.length}
        onClearFilters={
          q || status !== 'all' ? () => { setQ(''); setStatus('all') } : undefined
        }
      />

      <Panel
        flush
        title="Detected secrets"
        description={`${rows.length} of ${state.rows.length} loaded findings`}
        footer={
          <p className="text-xs text-muted-foreground">
            Secret values are never stored — the scanner runs in redacting mode, so only the rule and
            location are available.
            {state.rows.some((row) => row.truncated) &&
              ' Some projects have more secret findings than the first page we loaded.'}
            {state.failed.length > 0 && (
              <span className="text-destructive">
                {' '}
                {state.failed.length} of {state.scannedProjects.length} scans could not be read.
              </span>
            )}
          </p>
        }
      >
        {state.rows.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No secrets detected"
            description={
              state.scannedProjects.length === 0
                ? 'No completed audit to read yet. Upload an archive and run an audit with secret detection enabled.'
                : 'The secret scanner reported nothing across the scans we read. This does not prove no credential is committed — it only means none matched the rules that ran.'
            }
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
            icon={KeyRound}
            title="No secrets match these filters"
            description="Clear the search or status filter to see every detected secret again."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQ('')
                  setStatus('all')
                }}
              >
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
                <TableHead>Finding</TableHead>
                <TableHead>Rule</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Detected</TableHead>
                <TableHead>
                  <span className="sr-only">Open finding</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} className="hover:bg-muted/40 transition-colors">
                  <TableCell>
                    <SeverityBadge severity={row.severity} withDot={false} />
                  </TableCell>
                  <TableCell className="max-w-[34ch]">
                    <Link
                      to={`/app/audits/findings/${row.id}`}
                      className="font-medium text-foreground transition-colors duration-150 ease-smooth hover:text-primary tracking-tight"
                    >
                      {row.title || 'Exposed secret'}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {row.project_name || 'Unknown project'}
                    </p>
                  </TableCell>
                  <TableCell>{row.rule_id ? <InlineCode>{row.rule_id}</InlineCode> : '—'}</TableCell>
                  <TableCell>
                    {row.file_path ? (
                      <FilePath
                        path={row.file_path}
                        line={row.start_line}
                        endLine={row.end_line}
                        className="max-w-[26ch] py-0"
                      />
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    <FindingStatusBadge status={row.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {formatRelativeTime(row.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      to={`/app/audits/findings/${row.id}`}
                      aria-label={`Open ${row.title || 'secret finding'}`}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary transition-colors duration-150 ease-smooth hover:text-primary-hover px-2.5 py-1 rounded-md hover:bg-primary-subtle"
                    >
                      Inspect
                      <ChevronRight className="size-3.5" aria-hidden />
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="Recovering from an exposure"
          description="Order of operations to contain the leak before altering code"
          actions={
            <Button variant="outline" size="sm" onClick={copyChecklist}>
              <Copy data-icon="inline-start" />
              Copy checklist
            </Button>
          }
        >
          <ol className="space-y-3">
            {CHECKLIST.map((step, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-xs font-bold tabular-nums text-primary ring-1 ring-primary/20">
                  {i + 1}
                </span>
                <p className="text-xs leading-relaxed text-foreground">{step}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-muted-foreground">
            General security guidance: each individual finding contains scanner-specific remediation details.
          </p>
        </Panel>

        <Panel
          title="Scanner mechanics & safety guarantees"
          description="How secret detection protects credentials during analysis"
        >
          <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
              <h4 className="font-semibold text-foreground text-xs flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Zero Secret Storage (Redaction Mode)
              </h4>
              <p className="mt-1 text-muted-foreground">
                Scanners operate strictly with redacting flags enabled. Raw tokens, private keys, and passwords are never written to database storage or returned in API responses.
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
              <h4 className="font-semibold text-foreground text-xs flex items-center gap-2">
                <KeyRound className="size-4 text-amber-600" />
                Entropy & Signature Matching
              </h4>
              <p className="mt-1 text-muted-foreground">
                Gitleaks runs against known credential patterns for major providers (AWS, GitHub, Slack, OpenAI, Stripe) as well as high-entropy Shannon strings.
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
              <h4 className="font-semibold text-foreground text-xs flex items-center gap-2">
                <History className="size-4 text-sky-600" />
                Verification & Re-scanning
              </h4>
              <p className="mt-1 text-muted-foreground">
                After revoking and moving credentials into runtime environment managers, run a new audit to resolve findings.
              </p>
            </div>
          </div>
        </Panel>
      </div>
    </PageStack>
  )
}
