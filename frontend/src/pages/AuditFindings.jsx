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
  AlertCircle,
  Shield,
  Bug,
  KeyRound,
  Package,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
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
import { Panel } from '../components/app/Panel'
import { FindingStatusBadge, SeverityBadge } from '../components/app/SeverityBadge'
import { CodeBlock, FilePath } from '../components/app/CodeBlock'
import { SuggestionDiff } from '../components/app/SuggestionDiff'
import { EmptyState, ErrorState, TablePageSkeleton } from '../components/EmptyState'
import { SEVERITY_ORDER, SEVERITY_RANK, normalizeSeverity } from '../lib/severity'
import { cn, formatRelativeTime } from '../lib/utils'

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

const CATEGORY_OPTIONS = [
  { value: 'static_analysis', label: 'Static analysis' },
  { value: 'secrets', label: 'Secrets' },
  { value: 'dependencies', label: 'Dependencies' },
]

const CATEGORY_LABELS = Object.fromEntries(CATEGORY_OPTIONS.map((c) => [c.value, c.label]))

const CATEGORY_ICONS = {
  static_analysis: Bug,
  secrets: KeyRound,
  dependencies: Package,
}

const SEVERITY_COLORS = {
  critical: { dot: 'bg-red-600', badge: 'bg-red-600/10 text-red-600 border-red-600/20', ring: 'ring-red-600/30' },
  high: { dot: 'bg-orange-500', badge: 'bg-orange-500/10 text-orange-600 border-orange-500/20', ring: 'ring-orange-500/30' },
  medium: { dot: 'bg-amber-400', badge: 'bg-amber-400/10 text-amber-600 border-amber-400/20', ring: 'ring-amber-400/30' },
  low: { dot: 'bg-blue-400', badge: 'bg-blue-400/10 text-blue-600 border-blue-400/20', ring: 'ring-blue-400/30' },
  info: { dot: 'bg-slate-400', badge: 'bg-slate-400/10 text-slate-500 border-slate-400/20', ring: 'ring-slate-400/30' },
}

function union(list, additions) {
  const set = new Set(list)
  for (const value of additions) set.add(String(value))
  return [...set].sort((a, b) => a.localeCompare(b))
}

function allowed(value, values) {
  return value && values.includes(value) ? value : 'all'
}

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

function SeveritySummaryBar({ findings }) {
  const counts = {}
  for (const f of findings) {
    const s = normalizeSeverity(f.severity)
    counts[s] = (counts[s] || 0) + 1
  }
  const total = findings.length
  if (total === 0) return null

  return (
    <div className="flex items-center gap-4">
      {SEVERITY_ORDER.filter(s => counts[s]).map(s => {
        const colors = SEVERITY_COLORS[s] || SEVERITY_COLORS.info
        return (
          <div key={s} className="flex items-center gap-1.5">
            <span className={cn('size-2 rounded-full', colors.dot)} />
            <span className="text-xs font-semibold text-foreground tabular-nums">{counts[s]}</span>
            <span className="text-xs capitalize text-muted-foreground">{s}</span>
          </div>
        )
      })}
    </div>
  )
}

function FindingRow({ finding, isActive, onClick }) {
  const sev = normalizeSeverity(finding.severity)
  const colors = SEVERITY_COLORS[sev] || SEVERITY_COLORS.info
  const CatIcon = CATEGORY_ICONS[finding.category] || Bug

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      className={cn(
        'group w-full min-w-0 text-left transition-all focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-ring',
        'border-l-2 px-4 py-3 hover:bg-muted/50',
        isActive
          ? 'border-l-primary bg-primary/5'
          : 'border-l-transparent'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              'inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
              colors.badge
            )}>
              {sev}
            </span>
            <span className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              <CatIcon className="size-3" />
              {labelise(finding.category || 'uncategorized', CATEGORY_LABELS)}
            </span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm font-medium text-foreground group-hover:text-primary">
            {finding.title || 'Security issue'}
          </p>
          {finding.file_path && (
            <p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">
              {finding.file_path}{finding.start_line ? `:${finding.start_line}` : ''}
            </p>
          )}
        </div>
        <FindingStatusBadge status={finding.status} />
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-[10px] text-muted-foreground">
          {finding.project_name || 'Unknown project'}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatRelativeTime(finding.created_at)}
        </span>
      </div>
    </button>
  )
}

export function AuditFindings() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()
  const [searchParams, setSearchParams] = useSearchParams()

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
  const [tools, setTools] = useState([])
  const [attempt, setAttempt] = useState(0)
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
    return () => { cancelled = true }
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
    setSelectedDetail({ id: activeSelectedId, loading: true, error: null, finding: null })
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
    return () => { cancelled = true }
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
            title={wsError ? "We couldn't load your workspace" : "We couldn't load findings"}
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

      {/* ── Severity summary bar ── */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-card px-5 py-3.5">
          <SeveritySummaryBar findings={rows} />
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>{rows.length} finding{rows.length !== 1 ? 's' : ''}</span>
            <span>·</span>
            <span>{scanCount} audit{scanCount !== 1 ? 's' : ''}</span>
            {state.failed.length > 0 && (
              <>
                <span>·</span>
                <span className="text-destructive">{state.failed.length} audits failed to load</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="hidden flex-wrap items-center gap-2 md:flex">
          <SlidersHorizontal className="size-3.5 shrink-0 text-muted-foreground" />
          {filterControls(false)}
        </div>
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

        <div className="ml-auto flex items-center gap-2">
          <input
            type="search"
            value={q}
            onChange={e => setParam('q', e.target.value)}
            placeholder="Search title, path or rule…"
            className="w-52 rounded-md border border-border bg-background px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          {hasActiveFilters && (
            <button
              onClick={() => setSearchParams({}, { replace: true })}
              className="rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Clear all
            </button>
          )}
          {hasMore && (
            <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
              {loadingMore ? 'Loading…' : 'Load more'}
            </Button>
          )}
        </div>
      </div>

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
          <div className="grid min-h-[680px] lg:grid-cols-[minmax(300px,0.78fr)_minmax(0,1.22fr)]">
            {/* ── Left: Finding list ── */}
            <div className="min-w-0 border-b border-border lg:border-b-0 lg:border-r">
              <div className="flex items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
                <span className="text-xs font-semibold text-foreground">{rows.length} Issues</span>
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Severity · Status</span>
              </div>
              <div className="divide-y divide-border/60 overflow-y-auto" style={{ maxHeight: '720px' }}>
                {rows.map((finding) => (
                  <FindingRow
                    key={`${finding.scan_id}-${finding.id}`}
                    finding={finding}
                    isActive={activeSelectedId === finding.id}
                    onClick={() => { setSelectedId(finding.id); setDetailTab('overview') }}
                  />
                ))}
              </div>
            </div>

            {/* ── Right: Detail preview ── */}
            <FindingPreview
              finding={rows.find((finding) => finding.id === activeSelectedId)}
              detail={selectedDetail.id === activeSelectedId ? selectedDetail : { loading: true }}
              tab={detailTab}
              onTabChange={setDetailTab}
              href={activeSelectedId ? detailHref(activeSelectedId) : '/app/audits/findings'}
            />
          </div>

          {/* Footer */}
          <div className="border-t border-border bg-background/40 px-5 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
            Confidence is each analyzer's own ranking, not a calibrated probability. A clean audit does not guarantee code is secure.
          </div>
        </section>
      )}
    </PageStack>
  )
}

function FindingPreview({ finding, detail, tab, onTabChange, href }) {
  const selected = detail.finding || finding
  const sev = finding ? normalizeSeverity(finding.severity) : null
  const colors = sev ? (SEVERITY_COLORS[sev] || SEVERITY_COLORS.info) : null

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'remediation', label: 'Remediation', icon: Wrench },
    { id: 'code', label: 'Code evidence', icon: FileCode2 },
  ]

  if (!finding) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 p-8 text-center">
        <div className="grid size-12 place-items-center rounded-xl border border-border bg-muted">
          <Shield className="size-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Select a finding</p>
        <p className="max-w-xs text-xs text-muted-foreground">
          Click any issue on the left to review its evidence, source code context, and suggested fix.
        </p>
      </div>
    )
  }

  return (
    <div className="flex min-w-0 flex-col">
      {/* Header */}
      <header className="border-b border-border p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {colors && (
                <span className={cn(
                  'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  colors.badge
                )}>
                  {sev}
                </span>
              )}
              <FindingStatusBadge status={finding.status} />
              {finding.rule_id && (
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                  {finding.rule_id}
                </span>
              )}
            </div>
            <h3 className="mt-3 text-base font-semibold leading-snug text-foreground">
              {finding.title || 'Security issue'}
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span className="font-medium text-foreground/70">{finding.project_name || 'Unknown project'}</span>
              {finding.file_path && (
                <>
                  <span>·</span>
                  <FilePath path={finding.file_path} line={finding.start_line} className="max-w-full py-0" />
                </>
              )}
            </div>
          </div>
          <Link
            to={href}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            Full details
            <ExternalLink className="size-3" />
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <nav aria-label="Finding details" className="flex gap-0 overflow-x-auto border-b border-border">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => onTabChange(id)}
            aria-current={tab === id ? 'page' : undefined}
            className={cn(
              'flex shrink-0 items-center gap-2 border-b-2 border-transparent px-4 py-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground',
              tab === id && 'border-primary bg-primary/5 text-primary'
            )}
          >
            <Icon className="size-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </nav>

      {/* Tab content */}
      <div className="min-h-[280px] flex-1 overflow-y-auto p-5">
        {detail.loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <span className="size-4 animate-spin rounded-full border-2 border-border border-t-primary" />
            Loading evidence…
          </div>
        ) : detail.error ? (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive" role="alert">{detail.error}</p>
          </div>
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
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              <FileCode2 className="mx-auto mb-2 size-8 opacity-30" />
              No source excerpt was recorded for this finding.
            </div>
          )
        ) : tab === 'remediation' ? (
          selected.suggestion?.patch ? (
            <SuggestionDiff suggestion={selected.suggestion} />
          ) : selected.ai_explanation?.remediation_steps?.length ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-foreground">
                {selected.ai_explanation.summary || 'Suggested remediation'}
              </p>
              <ol className="space-y-2.5 pl-0">
                {selected.ai_explanation.remediation_steps.map((step, index) => (
                  <li key={index} className="flex gap-3 text-sm leading-relaxed text-foreground">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              <Wrench className="mx-auto mb-2 size-8 opacity-30" />
              No remediation proposal is available. Open full details to request an AI explanation or review triage options.
            </div>
          )
        ) : (
          <div className="space-y-5">
            <p className="text-sm leading-relaxed text-foreground">
              {selected.description || selected.scanner_message || 'Review the source evidence and rule context before deciding how to address this issue.'}
            </p>
            {selected.impact && (
              <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 p-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-amber-600">Potential impact</h4>
                <p className="mt-1.5 text-sm leading-relaxed text-foreground">{selected.impact}</p>
              </div>
            )}
            <dl className="grid gap-4 rounded-xl border border-border bg-muted/30 p-4 sm:grid-cols-2">
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
      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="mt-1 truncate text-sm text-foreground">{value}</dd>
    </div>
  )
}

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
