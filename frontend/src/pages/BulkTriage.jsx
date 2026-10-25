import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckSquare, CircleSlash, RefreshCw, ScanSearch, ShieldAlert, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../services/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { Button } from '../components/ui/button'
import { Checkbox } from '../components/ui/checkbox'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import { Progress } from '../components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
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
import { FindingStatusBadge, Pill, SeverityBadge } from '../components/app/SeverityBadge'
import { FilePath } from '../components/app/CodeBlock'
import { EmptyState, ErrorState, TablePageSkeleton } from '../components/EmptyState'
import { SEVERITY_ORDER, SEVERITY_RANK, normalizeSeverity } from '../lib/severity'
import { cn } from '../lib/utils'

/**
 * There is no bulk-triage endpoint. Applying a decision means one PATCH per
 * finding, so this page loops `api.updateFinding` sequentially, shows real
 * progress, and reports exactly which findings failed rather than pretending the
 * batch succeeded. Findings are assembled the same way the findings list does —
 * projects -> latest completed audit -> its findings — because no workspace-level
 * findings route exists.
 */
const PROJECT_LIMIT = 10
const SCAN_LOOKBACK = 5
const PAGE_SIZE = 50
const DONE_STATUSES = ['completed', 'completed_with_errors']

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'false_positive', label: 'False positive' },
  { value: 'accepted_risk', label: 'Accepted risk' },
  { value: 'fixed', label: 'Fixed' },
]

const CATEGORY_OPTIONS = [
  { value: 'static_analysis', label: 'Static analysis' },
  { value: 'secrets', label: 'Secrets' },
  { value: 'dependencies', label: 'Dependencies' },
]

const DECISION_LABELS = {
  open: 'Set back to open',
  fixed: 'Mark fixed',
  false_positive: 'Mark false positive',
  accepted_risk: 'Accept risk',
}

function allowed(value, values) {
  return value && values.includes(value) ? value : 'all'
}

function sortFindings(a, b) {
  const rank =
    (SEVERITY_RANK[normalizeSeverity(b.severity)] ?? 0) -
    (SEVERITY_RANK[normalizeSeverity(a.severity)] ?? 0)
  if (rank !== 0) return rank
  return String(a.file_path || '').localeCompare(String(b.file_path || ''))
}

export function BulkTriage() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()
  const [searchParams, setSearchParams] = useSearchParams()

  const severity = allowed(searchParams.get('severity'), SEVERITY_ORDER)
  // The triage queue defaults to open findings; ?status= overrides it, including
  // ?status=all.
  const rawStatus = searchParams.get('status')
  const status = rawStatus === null ? 'open' : allowed(rawStatus, STATUS_OPTIONS.map((s) => s.value))
  const category = allowed(searchParams.get('category'), CATEGORY_OPTIONS.map((c) => c.value))

  const [pages, setPages] = useState({})
  const [scans, setScans] = useState([])
  const [failedScans, setFailedScans] = useState(0)
  const [projectCount, setProjectCount] = useState(0)
  const [state, setState] = useState({ loading: false, error: null })
  const [attempt, setAttempt] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  const [selected, setSelected] = useState(() => new Set())
  const [decision, setDecision] = useState('accepted_risk')
  const [note, setNote] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)

  function setParam(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value && value !== 'all') next.set(key, value)
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
        const targets = perProject.filter(Boolean)

        const query = {
          limit: PAGE_SIZE,
          ...(severity !== 'all' && { severity }),
          ...(status !== 'all' && { status }),
          ...(category !== 'all' && { category }),
        }

        const next = {}
        let failures = 0
        await Promise.all(
          targets.map(async (scan) => {
            try {
              const page = await api.getFindings(scan.id, query)
              next[scan.id] = { items: page.items || [], next_cursor: page.next_cursor || null }
            } catch {
              next[scan.id] = { items: [], next_cursor: null }
              failures += 1
            }
          })
        )

        if (cancelled) return
        setScans(targets)
        setPages(next)
        setFailedScans(failures)
        setProjectCount(projects.length)
        setSelected(new Set())
        setState({ loading: false, error: null })
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err.message || 'Please try again.' })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId, attempt, severity, status, category])

  const findings = useMemo(
    () => {
      const byScan = new Map(scans.map((scan) => [scan.id, scan]))
      return Object.entries(pages)
        .flatMap(([scanId, page]) =>
          page.items.map((finding) => ({
            ...finding,
            scan_id: finding.scan_id || scanId,
            project_name: finding.project_name || byScan.get(scanId)?.project_name,
          }))
        )
        .sort(sortFindings)
    },
    [pages, scans]
  )

  const hasMore = Object.values(pages).some((page) => page.next_cursor)
  const openCount = findings.filter((f) => f.status === 'open').length

  async function loadMore() {
    setLoadingMore(true)
    const query = {
      limit: PAGE_SIZE,
      ...(severity !== 'all' && { severity }),
      ...(status !== 'all' && { status }),
      ...(category !== 'all' && { category }),
    }
    let failures = 0
    await Promise.all(
      Object.entries(pages)
        .filter(([, page]) => page.next_cursor)
        .map(async ([scanId, page]) => {
          try {
            const next = await api.getFindings(scanId, { ...query, cursor: page.next_cursor })
            setPages((prev) => ({
              ...prev,
              [scanId]: {
                items: [...(prev[scanId]?.items || []), ...(next.items || [])],
                next_cursor: next.next_cursor || null,
              },
            }))
          } catch {
            failures += 1
          }
        })
    )
    setLoadingMore(false)
    if (failures > 0) {
      toast.error('Some audits could not be paged', {
        description: `${failures} kept their previous page of findings.`,
      })
    }
  }

  function toggle(id) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev)
      const every = findings.every((f) => next.has(f.id))
      if (every) findings.forEach((f) => next.delete(f.id))
      else findings.forEach((f) => next.add(f.id))
      return next
    })
  }

  async function applyTo(list, statusValue, triageNote) {
    const updated = []
    const failed = []
    setProgress({ total: list.length, done: 0 })

    for (let i = 0; i < list.length; i += 1) {
      const finding = list[i]
      try {
        const next = await api.updateFinding(finding.id, { status: statusValue, triage_note: triageNote })
        updated.push(next)
        setPages((prev) => {
          const page = prev[next.scan_id || finding.scan_id]
          if (!page) return prev
          return {
            ...prev,
            [next.scan_id || finding.scan_id]: {
              ...page,
              items: page.items.map((f) => (f.id === next.id ? { ...f, ...next } : f)),
            },
          }
        })
      } catch (err) {
        failed.push({
          id: finding.id,
          title: finding.title || 'Untitled finding',
          message: err.message || 'The request failed.',
        })
      }
      setProgress({ total: list.length, done: i + 1, failed: failed.length })
    }

    return { updated, failed }
  }

  async function runBatch(list) {
    const triageNote = note.trim() === '' ? null : note.trim()
    const { updated, failed } = await applyTo(list, decision, triageNote)
    setProgress(null)
    setResult({ status: decision, updated, failed })
    setSelected(new Set())

    if (failed.length === 0) {
      toast.success(`${updated.length} ${updated.length === 1 ? 'finding' : 'findings'} updated`, {
        description: `All set to ${String(decision).replace(/_/g, ' ')}.`,
      })
    } else {
      toast.error(`${failed.length} of ${list.length} could not be updated`, {
        description: 'The successful ones are saved. Retry the rest below.',
      })
    }
  }

  const header = (
    <PageHeader
      title="Bulk triage"
      description="Apply one decision to many findings at once. Each finding is saved individually, so a failure stops at that finding."
      actions={
        <Button variant="outline" render={<Link to="/app/audits/findings" />}>
          <ScanSearch data-icon="inline-start" />
          Findings list
        </Button>
      }
    />
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
            title={wsError ? 'We couldn’t load your workspace' : 'We couldn’t load findings'}
            description={wsError || state.error}
            onRetry={() => (wsError ? retryWorkspace() : setAttempt((a) => a + 1))}
          />
        </Panel>
      </PageStack>
    )
  }

  if (scans.length === 0) {
    return (
      <PageStack>
        {header}
        <Panel>
          <EmptyState
            icon={ScanSearch}
            title="Nothing to triage yet"
            description="Bulk triage works on findings from completed audits. Run an audit on a project first, then come back."
            action={
              <Button render={<Link to="/app/projects" />}>Choose a project to audit</Button>
            }
          />
        </Panel>
      </PageStack>
    )
  }

  const selection = findings.filter((f) => selected.has(f.id))
  const busy = progress !== null
  /** Keeps this page's filters alive so Back returns to the same queue. */
  const detailHref = (findingId) =>
    `/app/audits/findings/${findingId}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

  const filters = (
    <>
      <Filter label="Severity" value={severity} onChange={(v) => setParam('severity', v)}>
        {SEVERITY_ORDER.map((s) => (
          <SelectItem key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </SelectItem>
        ))}
      </Filter>
      <Filter label="Status" value={status} onChange={(v) => setParam('status', v)}>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </Filter>
      <Filter label="Category" value={category} onChange={(v) => setParam('category', v)}>
        {CATEGORY_OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </Filter>
    </>
  )

  const criticalHighCount = findings.filter(
    (f) => f.severity === 'critical' || f.severity === 'high'
  ).length

  return (
    <PageStack>
      {header}

      <StatGrid columns={4}>
        <StatCard
          icon={CheckSquare}
          label="Available to triage"
          value={findings.length}
          hint={`${selected.size} currently selected`}
          tone="blue"
        />
        <StatCard
          icon={ShieldAlert}
          label="Critical & high"
          value={criticalHighCount}
          hint={criticalHighCount > 0 ? 'Priority remediation backlog' : 'No critical findings'}
          tone={criticalHighCount > 0 ? 'red' : 'green'}
        />
        <StatCard
          icon={ShieldCheck}
          label="Open findings"
          value={openCount}
          hint={`Across ${scans.length} active projects`}
          tone="amber"
        />
        <StatCard
          icon={ScanSearch}
          label="Audited projects"
          value={scans.length}
          hint={`${projectCount} total in workspace`}
          tone="slate"
        />
      </StatGrid>

      {selected.size > 0 && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary-subtle/50 p-3.5 shadow-xs transition-all">
          <div className="flex items-center gap-2.5">
            <span className="flex size-7 items-center justify-center rounded-lg bg-primary text-primary-foreground text-xs font-bold shadow-2xs">
              {selected.size}
            </span>
            <span className="text-sm font-semibold text-foreground">
              {selected.size === 1 ? '1 finding selected' : `${selected.size} findings selected`}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelected(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground h-7 px-2"
            >
              Clear selection
            </Button>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Select value={decision} onValueChange={setDecision}>
              <SelectTrigger size="sm" className="w-[220px] bg-background">
                <SelectValue>
                  {(val) => DECISION_LABELS[val] || val}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="accepted_risk">Accept risk</SelectItem>
                <SelectItem value="false_positive">Mark false positive</SelectItem>
                <SelectItem value="fixed">Mark fixed</SelectItem>
                <SelectItem value="open">Re-open</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={busy}>
              <CheckSquare data-icon="inline-start" />
              Apply to {selected.size}
            </Button>
          </div>
        </div>
      )}

      <Toolbar
        filters={
          <div className="hidden flex-wrap items-center gap-2 sm:flex">{filters}</div>
        }
        resultCount={findings.length}
        onClearFilters={
          severity !== 'all' || category !== 'all' || status !== 'open'
            ? () => setSearchParams({ status: 'open' }, { replace: true })
            : undefined
        }
      >
        <div className="flex flex-wrap items-center gap-2 sm:hidden">{filters}</div>
        <span className="text-xs text-muted-foreground">
          Read the latest completed scan of {scans.length} of {projectCount} projects · {openCount}{' '}
          still open
        </span>
      </Toolbar>

      {busy && (
        <Panel title="Applying decisions" description="One request per finding, in order.">
          <Progress value={(progress.done / Math.max(progress.total, 1)) * 100}>
            <div className="flex w-full items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {progress.done} of {progress.total} saved
                {progress.failed ? ` · ${progress.failed} failed` : ''}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {Math.round((progress.done / Math.max(progress.total, 1)) * 100)}%
              </span>
            </div>
          </Progress>
          <p className="mt-2 text-xs text-muted-foreground">
            Keep this page open until it finishes. Findings that fail are listed afterwards.
          </p>
        </Panel>
      )}

      {result && (
        <Panel
          title={
            result.failed.length === 0
              ? `${result.updated.length} findings set to ${String(result.status).replace(/_/g, ' ')}`
              : `${result.updated.length} saved, ${result.failed.length} failed`
          }
          description="Only the findings listed as saved were written to the server."
        >
          {result.failed.length > 0 && (
            <div className="space-y-2">
              <ul className="space-y-1.5">
                {result.failed.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                    <CircleSlash className="size-3.5 shrink-0 self-center text-destructive" />
                    <span className="min-w-0 break-words text-foreground">{item.title}</span>
                    <span className="text-xs text-muted-foreground">{item.message}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() =>
                    runBatch(
                      findings.filter((f) => result.failed.some((failed) => failed.id === f.id))
                    )
                  }
                >
                  <RefreshCw data-icon="inline-start" />
                  Retry {result.failed.length} failed
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}
          {result.failed.length === 0 && (
            <Button size="sm" variant="ghost" onClick={() => setResult(null)}>
              Dismiss
            </Button>
          )}
        </Panel>
      )}

      {findings.length === 0 ? (
        <Panel>
          <EmptyState
            icon={CheckSquare}
            title="No findings match these filters"
            description="Nothing was loaded for the current severity, status and category combination. Set status to All to see findings you already triaged."
            action={
              <Button variant="outline" onClick={() => setSearchParams({}, { replace: true })}>
                Clear filters
              </Button>
            }
          />
        </Panel>
      ) : (
        <Panel
          flush
          title={`${findings.length} findings to triage`}
          description={`${selected.size} selected`}
          actions={
            <Button variant="outline" size="sm" onClick={selectAllVisible} disabled={busy}>
              {findings.every((f) => selected.has(f.id)) ? 'Clear selection' : 'Select all shown'}
            </Button>
          }
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
                Each decision is a separate request and replaces that finding’s existing triage note.
                {failedScans > 0 && (
                  <span className="text-destructive"> {failedScans} of {scans.length} audits could not be read.</span>
                )}
              </p>
              <div className="flex items-center gap-2">
                {hasMore && (
                  <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore || busy}>
                    {loadingMore ? 'Loading…' : 'Load more'}
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => setConfirmOpen(true)}
                  disabled={busy || selected.size === 0}
                >
                  <CheckSquare data-icon="inline-start" />
                  Triage {selected.size}
                </Button>
              </div>
            </div>
          }
        >
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <span className="sr-only">Select findings</span>
                  </TableHead>
                  <TableHead>Severity</TableHead>
                  <TableHead>Finding</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {findings.map((finding) => (
                  <TableRow
                    key={finding.id}
                    data-selected={selected.has(finding.id) ? 'true' : undefined}
                    className={cn(selected.has(finding.id) && 'bg-muted/60')}
                  >
                    <TableCell>
                      <Checkbox
                        checked={selected.has(finding.id)}
                        disabled={busy}
                        onCheckedChange={() => toggle(finding.id)}
                        aria-label={`Select ${finding.title || 'finding'}`}
                      />
                    </TableCell>
                    <TableCell>
                      <SeverityBadge severity={finding.severity} withDot={false} />
                    </TableCell>
                    <TableCell className="max-w-[40ch] whitespace-normal">
                      <Link
                        to={detailHref(finding.id)}
                        className="font-medium text-foreground transition-colors duration-150 ease-smooth hover:text-primary"
                      >
                        {finding.title || 'Security issue'}
                      </Link>
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        {finding.project_name || 'Unknown project'}
                        {finding.file_path && (
                          <FilePath
                            path={finding.file_path}
                            line={finding.start_line}
                            endLine={finding.end_line}
                            className="max-w-[26ch] py-0 text-[11px]"
                          />
                        )}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {finding.category ? String(finding.category).replace(/_/g, ' ') : '—'}
                    </TableCell>
                    <TableCell>
                      <FindingStatusBadge status={finding.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <ul className="divide-y divide-border md:hidden">
            {findings.map((finding) => (
              <li key={finding.id} className={cn('flex items-start gap-3 px-4 py-3', selected.has(finding.id) && 'bg-muted/60')}>
                <Checkbox
                  checked={selected.has(finding.id)}
                  disabled={busy}
                  onCheckedChange={() => toggle(finding.id)}
                  aria-label={`Select ${finding.title || 'finding'}`}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SeverityBadge severity={finding.severity} />
                    <FindingStatusBadge status={finding.status} />
                    {finding.category && <Pill>{String(finding.category).replace(/_/g, ' ')}</Pill>}
                  </div>
                  <Link
                    to={detailHref(finding.id)}
                    className="mt-1.5 block text-sm font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    {finding.title || 'Security issue'}
                  </Link>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {finding.project_name || 'Unknown project'}
                  </p>
                  {finding.file_path && (
                    <FilePath
                      path={finding.file_path}
                      line={finding.start_line}
                      endLine={finding.end_line}
                      className="mt-1.5 max-w-full py-0"
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={(open) => !open && !busy && setConfirmOpen(false)}>
        <AlertDialogContent className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Set {selection.length} {selection.length === 1 ? 'finding' : 'findings'} to{' '}
              {String(decision).replace(/_/g, ' ')}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {decision === 'accepted_risk'
                ? 'Accepted risk keeps these issues open in the code but records that the team is consciously living with them. Reports will show them as accepted, not fixed.'
                : decision === 'false_positive'
                  ? 'This says the scanners matched a pattern that is not a real problem in these locations. The findings stay recorded.'
                  : 'This records a human judgement that these issues are resolved. Only a later audit can show the pattern is gone.'}{' '}
              Each finding is written separately and its existing triage note is replaced.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-decision">Decision</Label>
              <Select value={decision} onValueChange={setDecision} disabled={busy}>
                <SelectTrigger id="bulk-decision" className="w-full">
                  <SelectValue>
                    {(val) => DECISION_LABELS[val] || val}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {DECISION_LABELS[option.value]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bulk-note">Triage note</Label>
              <Textarea
                id="bulk-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={4000}
                disabled={busy}
                placeholder={
                  decision === 'open'
                    ? 'Optional — why these are back in the queue…'
                    : 'Why this decision applies to all of them…'
                }
              />
              <p className="text-xs leading-relaxed text-muted-foreground">
                {decision === 'open'
                  ? 'Leaving it empty clears the stored note on every selected finding.'
                  : 'Required for false positive and accepted risk, because those decisions need a reason on record.'}
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              Showing {selection.slice(0, 3).map((f) => f.title || 'untitled').join(' · ')}
              {selection.length > 3 ? ` and ${selection.length - 3} more` : ''}
            </p>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={decision === 'accepted_risk' ? 'destructive' : 'default'}
              disabled={
                busy ||
                ((decision === 'false_positive' || decision === 'accepted_risk') && note.trim() === '')
              }
              onClick={(event) => {
                event.preventDefault()
                if (
                  (decision === 'false_positive' || decision === 'accepted_risk') &&
                  note.trim() === ''
                ) {
                  toast.error('Add a triage note first')
                  return
                }
                runBatch(selection).then(() => setConfirmOpen(false))
              }}
            >
              {busy ? 'Applying…' : `Apply to ${selection.length}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageStack>
  )
}

function Filter({ label, value, onChange, children }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={`Filter by ${label.toLowerCase()}`} className="w-full sm:w-auto">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{`All ${label.toLowerCase()}s`}</SelectItem>
        {children}
      </SelectContent>
    </Select>
  )
}
