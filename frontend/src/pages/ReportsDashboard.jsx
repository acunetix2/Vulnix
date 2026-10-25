import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Download,
  Eye,
  FileJson,
  FileText,
  FolderKanban,
  Info,
  ScanSearch,
  Share2,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../services/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { Button } from '../components/ui/button'
import { ShareExportModal } from '../components/app/ShareExportModal'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { CardGrid, PageStack, StatGrid } from '../components/app/Grids'
import { PageHeader } from '../components/app/PageHeader'
import { Panel } from '../components/app/Panel'
import { StatCard } from '../components/app/StatCard'
import { SeverityCounts, ScanStatusBadge } from '../components/app/SeverityBadge'
import { Toolbar } from '../components/app/Toolbar'
import { EmptyState, ErrorState, LoadingState, ReportsPageSkeleton } from '../components/EmptyState'
import { SEVERITY_ORDER } from '../lib/severity'
import { formatDate, formatFileSize, formatRelativeTime } from '../lib/utils'

/**
 * There is no report library: `GET /scans/:id/report?format=json|markdown`
 * renders a file on request and nothing is stored. So this screen lists the
 * audits that can be reported, previews the real body before download, and hands
 * the file over. Formats are exactly the two the API accepts.
 */
const PROJECT_LIMIT = 24
const SCANS_PER_PROJECT = 3
const FORMATS = [
  { value: 'markdown', label: 'Markdown', extension: 'md', icon: FileText },
  { value: 'json', label: 'JSON', extension: 'json', icon: FileJson },
]
const PREVIEW_LIMIT = 20000

const EMPTY_COUNTS = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }

/** What the generated report document contains — shown as a reference card. */
const REPORT_CONTENTS = [
  { icon: FileText, title: 'Audit metadata', desc: 'Project name, scan ID, timestamps, and scanner versions.' },
  { icon: ShieldAlert, title: 'Findings with evidence', desc: 'Every detected finding, severity, location, and evidence excerpt.' },
  { icon: ShieldCheck, title: 'Severity summary', desc: 'Critical, high, medium, low, and info counts in a table.' },
  { icon: Info, title: 'Limitations note', desc: 'What the scanners cover, what they do not, and how to interpret absence of findings.' },
]

function filenameFrom(response, scanId, format) {
  const header = response.headers.get('content-disposition') || ''
  const match = header.match(/filename="?([^";]+)"?/)
  if (match) return match[1]
  const extension = FORMATS.find((f) => f.value === format)?.extension || format
  return `vulnix-report-${String(scanId).slice(0, 8)}.${extension}`
}

async function errorFrom(response) {
  const body = await response.text().catch(() => '')
  try {
    const parsed = JSON.parse(body)
    return parsed?.detail || parsed?.error?.message || `Request failed with status ${response.status}`
  } catch {
    return body || `Request failed with status ${response.status}`
  }
}

function saveFile(text, filename, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: mime }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export function ReportsDashboard() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()

  const [state, setState] = useState({ loading: false, error: null, scans: [], projects: [] })
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(null)
  const [shareScan, setShareScan] = useState(null)
  const [q, setQ] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [preview, setPreview] = useState({
    open: false,
    scan: null,
    format: 'markdown',
    loading: false,
    error: null,
    text: '',
    filename: '',
    bytes: 0,
  })

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
            .map((project) =>
              api
                .getScans(project.id, { limit: SCANS_PER_PROJECT })
                .then((page) => (page.items || []).map((scan) => ({ ...scan, project_name: project.name })))
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

  const totals = useMemo(() => {
    const counts = { ...EMPTY_COUNTS }
    for (const scan of state.scans) {
      const bySeverity = scan.summary?.by_severity || {}
      for (const key of SEVERITY_ORDER) counts[key] += Number(bySeverity[key]) || 0
    }
    const reportable = state.scans.filter(
      (scan) => scan.status === 'completed' || scan.status === 'completed_with_errors'
    ).length
    const failed = state.scans.filter((scan) => scan.status === 'failed').length
    return { counts, reportable, failed }
  }, [state.scans])

  const visibleScans = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return state.scans.filter((scan) => {
      if (statusFilter === 'ready' && scan.status !== 'completed' && scan.status !== 'completed_with_errors') return false
      if (statusFilter === 'failed' && scan.status !== 'failed') return false
      if (!needle) return true
      return (
        scan.project_name?.toLowerCase().includes(needle) ||
        scan.id?.toLowerCase().includes(needle)
      )
    })
  }, [state.scans, q, statusFilter])

  const header = (
    <PageHeader
      title="Reports"
      description="Preview and export the report generated for an audit, in Markdown or JSON."
      actions={
        <Button variant="outline" render={<Link to="/app/audits/runs" />}>
          <ScanSearch data-icon="inline-start" />
          All audits
        </Button>
      }
    />
  )

  if (wsLoading || state.loading) {
    return <ReportsPageSkeleton />
  }

  if (wsError || state.error) {
    return (
      <PageStack>
        {header}
        <Panel>
          <ErrorState
            title={wsError ? "We couldn't load your workspace" : "We couldn't load audits"}
            description={wsError || state.error}
            onRetry={() => (wsError ? retryWorkspace() : setAttempt((a) => a + 1))}
          />
        </Panel>
      </PageStack>
    )
  }

  async function fetchBody(scan, format) {
    const response = await api.getReport(scan.id, format)
    if (!response.ok) throw new Error(await errorFrom(response))
    const text = await response.text()
    return { text, filename: filenameFrom(response, scan.id, format) }
  }

  async function openPreview(scan, format) {
    setPreview({ open: true, scan, format, loading: true, error: null, text: '', filename: '', bytes: 0 })
    try {
      const { text, filename } = await fetchBody(scan, format)
      setPreview({
        open: true,
        scan,
        format,
        loading: false,
        error: null,
        text,
        filename,
        bytes: new Blob([text]).size,
      })
    } catch (err) {
      setPreview({ open: true, scan, format, loading: false, error: err.message, text: '', filename: '', bytes: 0 })
    }
  }

  function closePreview() {
    setPreview((p) => ({ ...p, open: false }))
  }

  async function download(scan, format) {
    setBusy(`${scan.id}:${format}`)
    try {
      const { text, filename } = await fetchBody(scan, format)
      saveFile(text, filename, format === 'json' ? 'application/json' : 'text/markdown;charset=utf-8')
      toast.success('Report downloaded', { description: filename })
    } catch (err) {
      toast.error('Could not generate the report', { description: err.message || 'Please try again.' })
    } finally {
      setBusy(null)
    }
  }

  function downloadPreview() {
    if (!preview.text) return
    saveFile(
      preview.text,
      preview.filename,
      preview.format === 'json' ? 'application/json' : 'text/markdown;charset=utf-8'
    )
    toast.success('Report downloaded', { description: preview.filename })
  }

  const summary = preview.scan?.summary?.by_severity || EMPTY_COUNTS
  const canClearFilters = q || statusFilter !== 'all'

  return (
    <PageStack>
      {header}

      {/* Stats — consistent with ComplianceDashboard / SecretsDashboard */}
      <StatGrid columns={4}>
        <StatCard
          icon={FileText}
          label="Ready to export"
          value={totals.reportable}
          hint="Completed audits"
          tone={totals.reportable > 0 ? 'green' : 'slate'}
          to="/app/audits/runs"
        />
        <StatCard
          icon={ScanSearch}
          label="Findings covered"
          value={SEVERITY_ORDER.reduce((sum, s) => sum + totals.counts[s], 0)}
          hint="Across the audits in view"
          tone="blue"
          to="/app/audits/findings"
        />
        <StatCard
          icon={ShieldAlert}
          label="Critical or high"
          value={totals.counts.critical + totals.counts.high}
          hint="Prioritize these in review"
          tone={totals.counts.critical + totals.counts.high > 0 ? 'red' : 'green'}
          to="/app/audits/findings?severity=critical"
        />
        <StatCard
          icon={FileJson}
          label="Available formats"
          value={FORMATS.length}
          hint="Markdown · JSON"
          tone="slate"
        />
      </StatGrid>

      {/* Available reports panel */}
      <Panel
        variant="flat"
        title="Available reports"
        description="Choose an audit to preview or export its findings and analysis."
        footer={
          <p className="text-xs text-muted-foreground">
            Reports are generated on demand in Markdown or JSON. They include audit metadata,
            analyzer results, severity counts, findings, evidence excerpts, and analysis limitations.
            Source code is not exported beyond those excerpts.
          </p>
        }
      >
        {/* Search + filter toolbar */}
        {state.scans.length > 0 && (
          <div className="border-b border-border px-4 py-3">
            <Toolbar
              search={q}
              onSearch={setQ}
              placeholder="Search project name or audit ID…"
              resultCount={visibleScans.length}
              filters={
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger size="sm" aria-label="Filter by audit status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All audits</SelectItem>
                    <SelectItem value="ready">Ready to export</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              }
              onClearFilters={canClearFilters ? () => { setQ(''); setStatusFilter('all') } : undefined}
            />
          </div>
        )}

        {state.scans.length === 0 ? (
          <EmptyState
            icon={ScanSearch}
            title="No audits to report on"
            description="Reports are per audit. Create a project, upload an archive and run an audit, then return here to export it."
            action={
              <Button render={<Link to="/app/projects" />}>
                <ScanSearch data-icon="inline-start" />
                Go to projects
              </Button>
            }
            className="py-10"
          />
        ) : visibleScans.length === 0 ? (
          <EmptyState
            icon={ScanSearch}
            title="No audits match these filters"
            description="Clear the search or status filter to see all available audits."
            action={
              <Button variant="outline" onClick={() => { setQ(''); setStatusFilter('all') }}>
                Clear filters
              </Button>
            }
            className="py-10"
          />
        ) : (
          <CardGrid columns={2} className="gap-x-6 gap-y-0">
            {visibleScans.map((scan) => {
              const isReportable = scan.status === 'completed' || scan.status === 'completed_with_errors'
              return (
                <article key={scan.id} className="min-w-0 border-b border-border py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary-subtle text-primary">
                        <FolderKanban className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-foreground">
                          {scan.project_name || 'Project'}
                        </h3>
                        <Link
                          to={`/app/audits/runs/${scan.id}`}
                          className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary"
                        >
                          Audit details
                          <ScanSearch className="size-3" aria-hidden />
                        </Link>
                      </div>
                    </div>
                    <ScanStatusBadge status={scan.status} />
                  </div>
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-y border-border py-3">
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Detected findings
                      </p>
                      <div className="mt-1">
                        <SeverityCounts counts={scan.summary?.by_severity} totalLabel="No findings" />
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <p>{formatRelativeTime(scan.created_at)}</p>
                      <p className="mt-0.5">{formatDate(scan.created_at)}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {isReportable ? (
                      <>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setShareScan(scan)}
                          className="text-xs"
                        >
                          <Share2 data-icon="inline-start" />
                          Share
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openPreview(scan, 'markdown')}
                          className="text-xs"
                        >
                          <Eye data-icon="inline-start" />
                          Preview
                        </Button>
                        {FORMATS.map(({ value, label, icon: Icon }) => (
                          <Button
                            key={value}
                            variant="ghost"
                            size="sm"
                            disabled={busy !== null}
                            onClick={() => download(scan, value)}
                            className="text-xs"
                            aria-label={`Download ${label} report for the audit of ${scan.project_name || 'this project'}`}
                          >
                            {busy === `${scan.id}:${value}` ? (
                              'Preparing…'
                            ) : (
                              <>
                                <Icon data-icon="inline-start" />
                                {label}
                              </>
                            )}
                          </Button>
                        ))}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        {scan.status === 'failed'
                          ? 'Audit failed — no report available.'
                          : scan.status === 'running'
                            ? 'Audit still running…'
                            : 'Report not available for this status.'}
                      </p>
                    )}
                  </div>
                </article>
              )
            })}
          </CardGrid>
        )}
      </Panel>

      {/* What's in a report */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title="What's included in a report"
          description="Every generated report contains the following sections"
        >
          <ul className="space-y-3">
            {REPORT_CONTENTS.map(({ icon: Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted-foreground">
            Source code is not exported beyond the evidence excerpts already captured during the audit.
          </p>
        </Panel>

        <Panel
          title="Format guide"
          description="Choosing the right format for your workflow"
        >
          <div className="space-y-3">
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                <FileText className="size-3.5 text-primary" />
                Markdown (.md)
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Human-readable in any text editor. Renders natively on GitHub, GitLab, and Confluence.
                Best for attaching to PRs, tickets, or compliance reviews that a person will read.
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                <FileJson className="size-3.5 text-amber-600" />
                JSON (.json)
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Machine-readable structured data. Ideal for ingesting findings into a SIEM, JIRA
                automation, or custom dashboards that parse security scan output programmatically.
              </p>
            </div>
            <div className="rounded-lg border border-border/80 bg-muted/30 p-3">
              <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                <Share2 className="size-3.5 text-sky-600" />
                Share link
              </h4>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Generate a time-limited shareable link to an audit's findings page. No download
                required — reviewers can inspect findings in the browser with full detail.
              </p>
            </div>
          </div>
        </Panel>
      </div>

      {/* Preview modal */}
      <Dialog open={preview.open} onOpenChange={(open) => (open ? null : closePreview())}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {preview.format === 'json' ? 'JSON report' : 'Markdown report'} preview
            </DialogTitle>
            <DialogDescription>
              {preview.scan
                ? `${preview.scan.project_name || 'Audit'} · started ${formatDate(preview.scan.created_at)} · generated when you opened it`
                : 'Generated on request'}
            </DialogDescription>
          </DialogHeader>

          {preview.loading ? (
            <LoadingState label="Generating report body" />
          ) : preview.error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive-subtle p-3">
              <p className="text-sm font-medium text-destructive">Could not generate this report</p>
              <p className="mt-1 text-sm text-muted-foreground">{preview.error}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className="font-medium capitalize">{preview.scan?.status}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Size</dt>
                  <dd className="font-medium tabular-nums">{formatFileSize(preview.bytes)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Critical / high</dt>
                  <dd className="font-medium tabular-nums">
                    {summary.critical} / {summary.high}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Total findings</dt>
                  <dd className="font-medium tabular-nums">
                    {preview.scan?.summary?.total_findings ?? '—'}
                  </dd>
                </div>
              </dl>

              <div className="max-h-[45vh] overflow-auto rounded-lg border border-border bg-muted/40">
                <pre className="p-3 font-mono text-xs whitespace-pre text-foreground">
                  {preview.text.slice(0, PREVIEW_LIMIT)}
                  {preview.text.length > PREVIEW_LIMIT ? '\n… truncated for preview — download the full file.' : ''}
                </pre>
              </div>

              <p className="text-xs text-muted-foreground">
                Scanner text is shown as escaped plain text and truncated here; the downloaded file
                keeps the full evidence excerpt and the limitations note. Absence of findings is not
                proof of security.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              disabled={preview.loading || !preview.scan}
              onClick={() =>
                openPreview(preview.scan, preview.format === 'json' ? 'markdown' : 'json')
              }
            >
              Switch to {preview.format === 'json' ? 'Markdown' : 'JSON'}
            </Button>
            <Button onClick={downloadPreview} disabled={!preview.text}>
              <Download data-icon="inline-start" />
              Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShareExportModal
        open={Boolean(shareScan)}
        onOpenChange={(open) => !open && setShareScan(null)}
        scan={shareScan}
        project={shareScan ? { name: shareScan.project_name } : null}
      />
    </PageStack>
  )
}
