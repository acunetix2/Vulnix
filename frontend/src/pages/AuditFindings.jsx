import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  CheckSquare,
  ChevronRight,
  FileCode2,
  Inbox,
  ScanSearch,
  SlidersHorizontal,
  Wrench,
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
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '../components/ui/sheet'
import { PageStack } from '../components/app/Grids'
import { PageHeader } from '../components/app/PageHeader'
import { AuditTabs } from '../components/app/AuditTabs'
import { ViewToggle } from '../components/app/ViewToggle'
import { useViewPreference } from '../hooks/useViewPreference'
import { Panel } from '../components/app/Panel'
import { Toolbar } from '../components/app/Toolbar'
import { FindingStatusBadge, SeverityBadge } from '../components/app/SeverityBadge'
import { CodeBlock, FilePath } from '../components/app/CodeBlock'
import { SuggestionDiff } from '../components/app/SuggestionDiff'
import { EmptyState, ErrorState, TablePageSkeleton } from '../components/EmptyState'
import { SEVERITY_ORDER, SEVERITY_RANK, normalizeSeverity } from '../lib/severity'
import { cn, formatRelativeTime } from '../lib/utils'

/**
 * There is no workspace-level findings endpoint, so this table assembles itself
 * the same way the overview does: projects -> the latest completed audit in each
 * -> that audit's findings. The fan-out is bounded, and the panel footer says how
 * many audits were actually read so the list is never mistaken for the whole
 * workspace. Severity, status, category and scanner are pushed to the server
 * because `GET /scans/:id/findings` filters there; the text box can only narrow
 * what has already been fetched, and says so.
 */
const PROJECT_LIMIT = 12
const SCAN_LOOKBACK = 5
const PAGE_SIZE = 50
const DONE_STATUSES = ['completed', 'completed_with_errors']

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'false_positive', label: 'False positive' },
  { value: 'accepted_risk', label: 'Accepted risk' },
  { value: 'fixed', label: 'Fixed' },
]

/** The only categories the normaliser produces. Anything else is a bad URL. */
const CATEGORY_OPTIONS = [
  { value: 'static_analysis', label: 'Static analysis' },
  { value: 'secrets', label: 'Secrets' },
  { value: 'dependencies', label: 'Dependencies' },
]

const CATEGORY_LABELS = Object.fromEntries(CATEGORY_OPTIONS.map((c) => [c.value, c.label]))

function union(list, additions) {
  const set = new Set(list)
  for (const value of additions) set.add(String(value))
  return [...set].sort((a, b) => a.localeCompare(b))
}

/** Keeps a URL-supplied filter only if the API would accept it. */
function allowed(value, values) {
  return value && values.includes(value) ? value : 'all'
}

/** Critical/high first, then by file and line so the ramp stays skimmable. */
function sortFindings(a, b) {
  const rank =
    (SEVERITY_RANK[normalizeSeverity(b.severity)] ?? 0) -
    (SEVERITY_RANK[normalizeSeverity(a.severity)] ?? 0)
  if (rank !== 0) return rank
  const pathA = String(a.file_path || '')
  const pathB = String(b.file_path || '')
  if (pathA !== pathB) return pathA.localeCompare(pathB)
  return (a.start_line || 0) - (b.start_line || 0)
}

function buildQuery({ severity, status, category, tool }, cursor) {
  const query = { limit: PAGE_SIZE }
  for (const [key, value] of Object.entries({ severity, status, category, tool })) {
    if (value && value !== 'all') query[key] = value
  }
  if (cursor) query.cursor = cursor
  return query
}

function FilterSelect({ label, value, onChange, options, className }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger size="sm" aria-label={`Filter by ${label.toLowerCase()}`} className={className}>
        <SelectValue placeholder={label}>
          {(val) => {
            if (!val || val === 'all') return `All ${label.toLowerCase()}s`
            const found = options.find((o) => o.value === val)
            return found ? found.label : val
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{`All ${label.toLowerCase()}s`}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export function AuditFindings() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()
  const [searchParams, setSearchParams] = useSearchParams()

  // Dashboard and ScanDetail link straight in with these params, so they are
  // read from the URL rather than held in local state.
  const severity = allowed(searchParams.get('severity'), SEVERITY_ORDER)
  const status = allowed(searchParams.get('status'), STATUS_OPTIONS.map((s) => s.value))
  const category = allowed(searchParams.get('category'), CATEGORY_OPTIONS.map((c) => c.value))
  const tool = searchParams.get('tool') || 'all'
  const scanId = searchParams.get('scan') || ''
  const q = searchParams.get('q') || ''

  const [state, setState] = useState({
    loading: false,
    error: null,
    pages: {},
    scans: [],
    failed: [],
    scope: null,
  })
  // Scanner options are learned from the tool runs of the scans we actually
  // read, so a scanner that never ran never appears as a dead choice.
  const [tools, setTools] = useState([])
  const [attempt, setAttempt] = useState(0)
  const [view, setView] = useViewPreference('vulnix.audits.findings.view')
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedId, setSelectedId] = useState(null)
  const [selectedDetail, setSelectedDetail] = useState({ id: null, loading: false, error: null, finding: null })
  const [detailTab, setDetailTab] = useState('overview')

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
        let scans = []
        let scope = null

        if (scanId) {
          // AuditRunDetail links here with ?scan= — show that one audit's findings.
          const scan = await api.getScan(scanId)
          const project = scan.project_id
            ? await api.getProject(scan.project_id).catch(() => null)
            : null
          scans = [
            {
              ...scan,
              project_name: project?.name,
              tool_names: (scan.tool_runs || []).map((run) => run.tool_name),
            },
          ]
          scope = { kind: 'scan', count: 1, project_name: project?.name }
        } else {
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

          const candidates = perProject.filter(Boolean)
          // Findings carry no scanner name, so each scan's tool runs are read
          // alongside its findings to populate the scanner filter.
          scans = await Promise.all(
            candidates.map((scan) =>
              api
                .getScan(scan.id)
                .then((detail) => ({
                  ...scan,
                  tool_names: (detail.tool_runs || []).map((run) => run.tool_name),
                }))
                .catch(() => ({ ...scan, tool_names: [] }))
            )
          )
          scope = {
            kind: 'workspace',
            count: (projectsPage.items || []).length,
            scanned: scans.length,
            capped: projects.length < (projectsPage.items || []).length,
          }
        }

        const query = buildQuery({ severity, status, category, tool })
        const pages = {}
        const failed = []

        await Promise.all(
          scans.map(async (scan) => {
            try {
              const page = await api.getFindings(scan.id, query)
              pages[scan.id] = { items: page.items || [], next_cursor: page.next_cursor || null }
            } catch {
              pages[scan.id] = { items: [], next_cursor: null }
              failed.push(scan.id)
            }
          })
        )

        if (cancelled) return
        setState({ loading: false, error: null, pages, scans, failed, scope })
        setTools((prev) =>
          union(
            prev,
            scans.flatMap((scan) => scan.tool_names || [])
          )
        )
      } catch (err) {
        if (!cancelled) {
          setState({ loading: false, error: err.message, pages: {}, scans: [], failed: [], scope: null })
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId, attempt, severity, status, category, tool, scanId])

  const loaded = useMemo(() => {
    const byScan = new Map(state.scans.map((scan) => [scan.id, scan]))
    return Object.entries(state.pages).flatMap(([id, page]) => {
      const scan = byScan.get(id)
      return page.items.map((finding) => ({
        ...finding,
        scan_id: finding.scan_id || id,
        project_name: finding.project_name || scan?.project_name,
      }))
    })
  }, [state.pages, state.scans])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const matched = needle
      ? loaded.filter(
          (finding) =>
            finding.title?.toLowerCase().includes(needle) ||
            finding.file_path?.toLowerCase().includes(needle) ||
            finding.rule_id?.toLowerCase().includes(needle)
        )
      : loaded
    return [...matched].sort(sortFindings)
  }, [loaded, q])
  const activeSelectedId = rows.some((finding) => finding.id === selectedId)
    ? selectedId
    : rows[0]?.id || null

  useEffect(() => {
    if (!activeSelectedId) return

    let cancelled = false
    api
      .getFinding(activeSelectedId)
      .then((finding) => {
        if (!cancelled) setSelectedDetail({ id: activeSelectedId, loading: false, error: null, finding })
      })
      .catch((error) => {
        if (!cancelled) {
          setSelectedDetail({
            id: activeSelectedId,
            loading: false,
            error: error.message || 'Could not load finding evidence.',
            finding: null,
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [activeSelectedId])

  const categories = useMemo(() => {
    const seen = new Set(loaded.map((finding) => finding.category).filter(Boolean))
    const known = CATEGORY_OPTIONS.filter((option) => seen.has(option.value))
    const extra = [...seen]
      .filter((value) => !CATEGORY_LABELS[value])
      .sort()
      .map((value) => ({ value, label: String(value).replace(/_/g, ' ') }))
    return [...known, ...extra]
  }, [loaded])

  const hasMore = Object.values(state.pages).some((page) => page.next_cursor)
  const hasActiveFilters =
    severity !== 'all' || status !== 'all' || category !== 'all' || tool !== 'all' || q !== ''

  /** Carries the current filters into the detail route so Back restores them. */
  function detailHref(findingId) {
    const query = searchParams.toString()
    return `/app/audits/findings/${findingId}${query ? `?${query}` : ''}`
  }

  async function loadMore() {
    setLoadingMore(true)
    const pending = Object.entries(state.pages).filter(([, page]) => page.next_cursor)
    const query = buildQuery({ severity, status, category, tool })
    let failedCount = 0

    await Promise.all(
      pending.map(async ([id, page]) => {
        try {
          const next = await api.getFindings(id, { ...query, cursor: page.next_cursor })
          setState((s) => {
            const current = s.pages[id] || { items: [], next_cursor: null }
            return {
              ...s,
              pages: {
                ...s.pages,
                [id]: {
                  items: [...current.items, ...(next.items || [])],
                  next_cursor: next.next_cursor || null,
                },
              },
            }
          })
        } catch {
          failedCount += 1
        }
      })
    )

    setLoadingMore(false)
    if (failedCount > 0) {
      toast.error('Could not load more findings', {
        description: `${failedCount} ${failedCount === 1 ? 'audit is' : 'audits are'} still on the previous page. Try again.`,
      })
    }
  }

  const scanCount = state.scans.length
  const scopeLine = !state.scope
    ? 'Detected issues from completed audits in this workspace.'
    : state.scope.kind === 'scan'
      ? `Findings from ${state.scope.project_name ? `${state.scope.project_name}, ` : ''}one audit`
      : scanCount === 0
        ? `No completed audit among the ${state.scope.count} projects in this workspace yet.`
        : `Findings from the latest completed audit of ${state.scope.scanned} ${
            state.scope.scanned === 1 ? 'project' : 'projects'
          }${
            state.scope.count > state.scope.scanned
              ? ` (${state.scope.count} projects in this workspace)`
              : ''
          }`

  const header = (
    <div className="space-y-5 border-b border-border pb-0">
      <PageHeader
        title="Findings"
        description={scopeLine}
        actions={
          <>
            {scanId && (
              <Button variant="outline" onClick={() => setParam('scan', '')}>
                All runs
              </Button>
            )}
            <Button variant="outline" render={<Link to="/app/bulk-triage" />}>
              <CheckSquare data-icon="inline-start" />
              Bulk triage
            </Button>
          </>
        }
      />
      <AuditTabs className="border-0" />
    </div>
  )

  if (wsLoading || state.loading) {
    return (
      <PageStack>
        {header}
        <TablePageSkeleton statCards={0} rows={10} columns={6} />
      </PageStack>
    )
  }

  if (wsError || state.error) {
    return (
      <PageStack>
        {header}
        <Panel variant="flat">
          <ErrorState
            title={wsError ? 'We couldn’t load your workspace' : 'We couldn’t load findings'}
            description={wsError || state.error}
            onRetry={() => (wsError ? retryWorkspace() : setAttempt((a) => a + 1))}
          />
        </Panel>
      </PageStack>
    )
  }

  if (scanCount === 0) {
    return (
      <PageStack>
        {header}
        <Panel variant="flat">
          <EmptyState
            icon={ScanSearch}
            title="No completed audits yet"
            description="Findings appear once an audit finishes. A run that fails or is cancelled produces nothing to triage."
            action={
              <Button render={<Link to="/app/projects" />}>
                <ScanSearch data-icon="inline-start" />
                Choose a project to audit
              </Button>
            }
          />
        </Panel>
      </PageStack>
    )
  }

  const filterControls = (stacked) => (
    <>
      <FilterSelect
        label="Severity"
        value={severity}
        onChange={(v) => setParam('severity', v)}
        className={stacked ? 'w-full' : undefined}
        options={SEVERITY_ORDER.map((s) => ({ value: s, label: s.charAt(0).toUpperCase() + s.slice(1) }))}
      />
      <FilterSelect
        label="Status"
        value={status}
        onChange={(v) => setParam('status', v)}
        className={stacked ? 'w-full' : undefined}
        options={STATUS_OPTIONS}
      />
      <FilterSelect
        label="Category"
        value={category}
        onChange={(v) => setParam('category', v)}
        className={stacked ? 'w-full' : undefined}
        options={facetOptions(categories, category, CATEGORY_LABELS)}
      />
      <FilterSelect
        label="Analyzer"
        value={tool}
        onChange={(v) => setParam('tool', v)}
        className={stacked ? 'w-full' : undefined}
        options={facetOptions(tools, tool)}
      />
    </>
  )

  return (
    <PageStack>
      {header}

      <Toolbar
        search={q}
        onSearch={(v) => setParam('q', v)}
        placeholder="Search title, path or rule…"
        filters={
          <>
            <div className="hidden flex-wrap items-center gap-2 md:flex">{filterControls(false)}</div>
            <Sheet>
              <SheetTrigger
                render={
                  <Button variant="outline" size="sm" className="md:hidden">
                    <SlidersHorizontal data-icon="inline-start" />
                    Filters
                  </Button>
                }
              />
              <SheetContent side="bottom" className="gap-0 p-0">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                  <SheetDescription>
                    Severity, status, category and analyzer are applied by the API.
                  </SheetDescription>
                </SheetHeader>
                <div className="grid gap-3 px-4 pb-4 sm:grid-cols-2">{filterControls(true)}</div>
                <SheetFooter>
                  {hasActiveFilters && (
                    <Button variant="ghost" onClick={() => setSearchParams({}, { replace: true })}>
                      Clear filters
                    </Button>
                  )}
                  <SheetClose render={<Button />}>Show {rows.length} results</SheetClose>
                </SheetFooter>
              </SheetContent>
            </Sheet>
          </>
        }
        resultCount={rows.length}
        onClearFilters={hasActiveFilters ? () => setSearchParams({}, { replace: true }) : undefined}
      >
        <ViewToggle value={view} onChange={setView} />
      </Toolbar>

      {rows.length === 0 ? (
        <Panel variant="flat">
          <EmptyState
            icon={Inbox}
            title="No findings match these filters"
            description="Every loaded finding was filtered out. Widen the severity, status, category or analyzer filter to see what was reported."
            action={
              <Button variant="outline" onClick={() => setSearchParams({}, { replace: true })}>
                Clear filters
              </Button>
            }
          />
        </Panel>
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Findings</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {rows.length} shown · {scanCount} {scanCount === 1 ? 'audit' : 'audits'}
                {state.failed.length > 0 && (
                  <span className="text-destructive"> · {state.failed.length} audits could not be read</span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2">
              {hasMore && (
                <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              )}
            </div>
          </div>

          <div className="grid min-h-[620px] lg:grid-cols-[minmax(300px,0.82fr)_minmax(0,1.18fr)]">
            <div className="min-w-0 border-b border-border lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2">
                <span className="text-xs font-medium text-muted-foreground">Issue</span>
                <span className="text-xs text-muted-foreground">Severity · Status</span>
              </div>
              <div className={view === 'grid' ? 'grid gap-2 p-2 sm:grid-cols-2 lg:grid-cols-1' : 'divide-y divide-border'}>
                {rows.map((finding) => (
                  <button
                    key={`${finding.scan_id}-${finding.id}`}
                    type="button"
                    onClick={() => setSelectedId(finding.id)}
                    aria-pressed={activeSelectedId === finding.id}
                    className={cn(
                      'w-full min-w-0 text-left transition-colors focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ring',
                      view === 'grid'
                        ? 'rounded-lg border border-border p-3 hover:bg-muted'
                        : 'border-l-2 border-transparent px-4 py-3 hover:bg-muted',
                      activeSelectedId === finding.id &&
                        (view === 'grid'
                          ? 'border-primary bg-primary-subtle/50'
                          : 'border-l-primary bg-primary-subtle/40')
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <SeverityBadge severity={finding.severity} withDot={false} />
                      <FindingStatusBadge status={finding.status} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm font-medium text-foreground">
                      {finding.title || 'Security issue'}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {finding.project_name || 'Unknown project'}
                      {finding.file_path ? ` · ${finding.file_path}` : ''}
                    </p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span className="truncate">
                        {labelise(finding.category || 'uncategorized', CATEGORY_LABELS)}
                      </span>
                      <span className="shrink-0">{formatRelativeTime(finding.created_at)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <FindingPreview
              finding={rows.find((finding) => finding.id === activeSelectedId)}
              detail={selectedDetail.id === activeSelectedId ? selectedDetail : { loading: true }}
              tab={detailTab}
              onTabChange={setDetailTab}
              href={activeSelectedId ? detailHref(activeSelectedId) : '/app/audits/findings'}
            />
          </div>
          <div className="border-t border-border px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
            Confidence is each analyzer’s own ranking, not a calibrated probability. A clean audit is not a guarantee that code is secure.
          </div>
        </section>
      )}
    </PageStack>
  )
}

function FindingPreview({ finding, detail, tab, onTabChange, href }) {
  const selected = detail.finding || finding
  const tabs = [
    { id: 'overview', label: 'Overview', icon: ScanSearch },
    { id: 'remediation', label: 'Remediation', icon: Wrench },
    { id: 'code', label: 'Code evidence', icon: FileCode2 },
  ]

  if (!finding) {
    return (
      <div className="flex min-h-[420px] items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Select a finding to review its evidence and suggested fix.
      </div>
    )
  }

  return (
    <div className="min-w-0">
      <header className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <SeverityBadge severity={finding.severity} />
            <FindingStatusBadge status={finding.status} />
          </div>
          <h3 className="mt-3 text-base font-semibold leading-snug text-foreground">
            {finding.title || 'Security issue'}
          </h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <span>{finding.project_name || 'Unknown project'}</span>
            {finding.file_path && <FilePath path={finding.file_path} line={finding.start_line} className="max-w-full py-0" />}
          </div>
        </div>
        <Button size="sm" variant="outline" render={<Link to={href} />}>
          Full details
          <ChevronRight data-icon="inline-end" />
        </Button>
      </header>

      <nav aria-label="Finding details" className="flex gap-1 overflow-x-auto border-b border-border px-3">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground',
              tab === id && 'border-primary text-foreground'
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      <div className="min-h-[320px] space-y-4 p-4">
        {detail.loading ? (
          <p className="text-sm text-muted-foreground" role="status">Loading evidence…</p>
        ) : detail.error ? (
          <p className="text-sm text-destructive" role="alert">{detail.error}</p>
        ) : !selected ? (
          <p className="text-sm text-muted-foreground">Finding details are unavailable.</p>
        ) : tab === 'code' ? (
          selected.evidence ? (
            <CodeBlock
              code={selected.evidence}
              filename={selected.file_path || undefined}
              startLine={selected.start_line || 1}
              maxHeight="28rem"
            />
          ) : (
            <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              No source excerpt was recorded for this finding.
            </p>
          )
        ) : tab === 'remediation' ? (
          selected.suggestion?.patch ? (
            <SuggestionDiff suggestion={selected.suggestion} />
          ) : selected.ai_explanation?.remediation_steps?.length ? (
            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-foreground">
                {selected.ai_explanation.summary || 'Suggested remediation'}
              </p>
              <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-foreground">
                {selected.ai_explanation.remediation_steps.map((step, index) => <li key={index}>{step}</li>)}
              </ol>
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border p-6 text-sm text-muted-foreground">
              No remediation proposal is available. Open full details to request an AI explanation or review triage options.
            </p>
          )
        ) : (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed text-foreground">
              {selected.description || selected.scanner_message || 'Review the source evidence and rule context before deciding how to address this issue.'}
            </p>
            {selected.impact && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Potential impact</h4>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground">{selected.impact}</p>
              </div>
            )}
            <dl className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
              <PreviewFact label="Rule" value={selected.rule_id || 'Not provided'} />
              <PreviewFact label="Confidence" value={selected.confidence || 'Not stated'} />
              <PreviewFact label="Category" value={labelise(selected.category || 'uncategorized', CATEGORY_LABELS)} />
              <PreviewFact label="Detected" value={formatRelativeTime(selected.created_at)} />
            </dl>
          </div>
        )}
      </div>
    </div>
  )
}

function PreviewFact({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm text-foreground">{value}</dd>
    </div>
  )
}

/** Keeps the active value visible even when no loaded finding has that facet. */
function labelise(value, labels) {
  if (labels[value]) return labels[value]
  return String(value)
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
}

function facetOptions(values, active, labels = {}) {
  const options = values.map((value) =>
    typeof value === 'string' ? { value, label: labelise(value, labels) } : value
  )
  if (active && active !== 'all' && !options.some((option) => option.value === active)) {
    options.push({ value: active, label: labelise(active, labels) })
  }
  return options
}
