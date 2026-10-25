import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  StopCircle,
  ScanSearch,
  ShieldCheck,
  Clock,
  FileDown,
  Share2,
  Wrench,
  CircleDashed,
  Globe,
  Network,
} from 'lucide-react'
import { ThreatIntelCard } from '../components/app/ThreatIntelCard'
import { Button } from '../components/ui/button'
import { ScanProgressTrace } from '../components/app/ScanProgressTrace'
import { ShareExportModal } from '../components/app/ShareExportModal'
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
import { PageStack } from '../components/app/Grids'
import { PageHeader } from '../components/app/PageHeader'
import { Panel } from '../components/app/Panel'
import { ScanStatusBadge, Pill, SeverityBadge } from '../components/app/SeverityBadge'
import { InlineCode, FilePath, CodeBlock } from '../components/app/CodeBlock'
import { SuggestionDiff } from '../components/app/SuggestionDiff'
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState'
import { formatDate } from '../lib/utils'
import { SEVERITY_DOTS, SEVERITY_ORDER } from '../lib/severity'
import { cn } from '../lib/utils'
import { api } from '../services/api'

const ACTIVE = new Set(['queued', 'running'])
const POLL_MS = 5000

const EMPTY_COUNTS = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }

const TOOL_TONES = {
  succeeded: 'success',
  failed: 'danger',
  timed_out: 'danger',
  skipped: 'neutral',
  running: 'info',
}

const AGENT_TONES = {
  succeeded: 'success',
  partial: 'warning',
  failed: 'danger',
  skipped: 'neutral',
  off: 'neutral',
}

/* The agent is the scanner. A CLI tool that is merely absent never fails a
   audit, so the wording below can promise that without hedging. */
const STATUS_EXPLANATIONS = {
  completed:
    'The AI agent read this archive and its findings are counted below. Any CLI tool installed on this server added its own.',
  completed_with_errors:
    'The review produced usable findings, but a CLI tool crashed or timed out. The agent’s findings stand on their own — check the tool list below for what is missing.',
  failed:
    'Nothing usable came out of this audit: the archive could not be read, or the agent was unavailable and no CLI tool returned results either.',
  cancelled:
    'The audit was stopped before it finished. Findings already stored remain, but the counts below were not rolled up.',
  running: 'The AI agent is reading the archive file by file; optional CLI tools run after it.',
  queued: 'The audit is waiting for capacity and has not started yet.',
}

function humanize(value) {
  return String(value || '').replace(/_/g, ' ')
}

/** Line numbers to shade inside an excerpt, from the finding's own range. */
function highlightLines(finding) {
  const start = finding.start_line ?? 1
  const end = Math.max(finding.end_line ?? start, start)
  return Array.from({ length: Math.min(end, start + 80) - start + 1 }, (_, i) => start + i)
}

function bySeverity(scan) {
  return scan?.summary?.by_severity || EMPTY_COUNTS
}

function formatDuration(ms) {
  if (ms == null) return '—'
  const secs = Math.round(ms / 1000)
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
}

/** A run is identified by when it happened — its id is a UUID and stays out of the UI. */
function runStamp(scan) {
  return scan?.started_at || scan?.completed_at || scan?.created_at || new Date().toISOString()
}

function runSubtitle(scan) {
  return `Audit started ${formatDate(runStamp(scan))}`
}

const RUN_TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'findings', label: 'Findings' },
]

function RunTabs({ value, onChange, className }) {
  return (
    <nav aria-label="This audit" className={cn('flex items-center gap-1 border-b border-border', className)}>
      {RUN_TABS.map((tab) => {
        const active = tab.key === value
        return (
          <button
            key={tab.key}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onChange(tab.key)}
            className={cn(
              '-mb-px relative rounded-t-md px-3 py-2 text-sm font-medium transition-colors',
              'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
              active && 'border-primary text-foreground'
            )}
          >
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}

export function AuditRunDetail() {
  const { id } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const [scan, setScan] = useState(null)
  const [project, setProject] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [detected, setDetected] = useState(null)
  const [shareModalOpen, setShareModalOpen] = useState(false)

  // The runs list carries its filters in the URL; navigate in with them and we
  // can rebuild the same filtered list on the way back.
  const backParams = new URLSearchParams()
  for (const key of ['status', 'project', 'q']) {
    const value = searchParams.get(key)
    if (value) backParams.set(key, value)
  }
  const runsHref = backParams.toString() ? `/app/audits/runs?${backParams}` : '/app/audits/runs'

  // Which half of this run is showing lives in the URL so a Findings view is
  // linkable from a report or notification, but it never leaves this page.
  const tab = searchParams.get('tab') === 'findings' ? 'findings' : 'overview'
  const changeTab = (next) => {
    const params = new URLSearchParams(searchParams)
    if (next === 'findings') params.set('tab', 'findings')
    else params.delete('tab')
    setSearchParams(params, { replace: true })
  }

  const toolRuns = scan?.tool_runs || []
  const runNames = new Map(toolRuns.map((run) => [run.id, run.tool_name]))
  const agentRun = toolRuns.find((run) => run.tool_name === 'agent') || null
  const cliRuns = toolRuns.filter((run) => run.tool_name !== 'agent')
  const steps = scan?.summary?.steps || []
  const agent = scan?.summary?.agent || null
  const router = scan?.summary?.router || null
  const isActive = scan ? ACTIVE.has(scan.status) : false
  const hasResults = scan ? scan.status === 'completed' || scan.status === 'completed_with_errors' : false

  const load = useCallback(async () => {
    try {
      const s = await api.getScan(id)
      setScan(s)
      setError(null)
      if (s.project_id) {
        try {
          setProject(await api.getProject(s.project_id))
        } catch {
          setProject(null)
        }
      }
    } catch (err) {
      setError(err.message)
    }
  }, [id])

  useEffect(() => {
    let cancelled = false

    async function first() {
      setLoading(true)
      setError(null)
      try {
        const s = await api.getScan(id)
        if (cancelled) return
        setScan(s)
        if (s.project_id) {
          try {
            const p = await api.getProject(s.project_id)
            if (!cancelled) setProject(p)
          } catch {
            if (!cancelled) setProject(null)
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    first()
    return () => {
      cancelled = true
    }
  }, [id, attempt])

  useEffect(() => {
    if (!scan || !ACTIVE.has(scan.status)) return
    const timer = setInterval(load, POLL_MS)
    return () => clearInterval(timer)
  }, [scan, load])

  // Findings are stable once the audit has finished, so pull them once instead
  // of on every 5s poll, and only when the Findings tab is actually open.
  useEffect(() => {
    if (!hasResults || tab !== 'findings' || detected?.scanId === id) return
    let cancelled = false

    async function loadDetected() {
      try {
        const page = await api.getFindings(id, { limit: 100 })
        if (!cancelled) setDetected({ scanId: id, items: page.items || [] })
      } catch {
        if (!cancelled) setDetected({ scanId: id, items: [] })
      }
    }

    loadDetected()
    return () => {
      cancelled = true
    }
  }, [hasResults, tab, detected, id])

  const handleCancel = async () => {
    setCancelling(true)
    try {
      await api.cancelScan(id)
      toast.success('Cancellation requested', {
        description: 'The audit stops at its next checkpoint.',
      })
      setConfirmCancel(false)
      await load()
    } catch (err) {
      toast.error('Could not cancel the audit', { description: err.message || 'Please try again.' })
    } finally {
      setCancelling(false)
    }
  }

  const actions = (
    <>
      {scan && isActive && (
        <Button variant="destructive" onClick={() => setConfirmCancel(true)}>
          <StopCircle data-icon="inline-start" />
          Cancel audit
        </Button>
      )}
      {scan && hasResults && (
        <>
          <Button
            variant="default"
            onClick={() => setShareModalOpen(true)}
            className="gap-1.5"
          >
            <Share2 data-icon="inline-start" />
            Share & Export
          </Button>
          <Button
            variant="outline"
            onClick={() => setShareModalOpen(true)}
            className="gap-1.5"
          >
            <FileDown data-icon="inline-start" />
            Export options
          </Button>
          <Button variant="outline" onClick={() => changeTab('findings')}>
            <ScanSearch data-icon="inline-start" />
            View findings
          </Button>
        </>
      )}
    </>
  )

  if (loading) {
    return (
      <PageStack>
        <PageHeader
          title="Audit"
          breadcrumb={[{ label: 'Audits', to: runsHref }, { label: 'Loading' }]}
        />
        <LoadingState label="Loading audit" />
      </PageStack>
    )
  }

  if (error || !scan) {
    return (
      <PageStack>
        <PageHeader
          title="Audit"
          breadcrumb={[{ label: 'Audits', to: runsHref }, { label: 'Unavailable' }]}
        />
        <Panel>
          <ErrorState
            title="We couldn’t load this audit"
            description={error || 'This audit may have been removed, or it belongs to a project you cannot see.'}
            onRetry={() => setAttempt((a) => a + 1)}
          />
        </Panel>
      </PageStack>
    )
  }

  const breadcrumb = [
    { label: 'Audits', to: runsHref },
    project ? { label: project.name, to: `/app/projects/${project.id}` } : { label: 'Project' },
    { label: 'Run' },
  ]

  const counts = bySeverity(scan)
  const options = scan.options || {}

  return (
    <PageStack>
      <PageHeader
        title={project?.name || 'Audit'}
        description={runSubtitle(scan)}
        breadcrumb={breadcrumb}
        actions={actions}
        meta={
          <div className="flex flex-wrap items-center gap-3">
            <ScanStatusBadge status={scan.status} />
          </div>
        }
      />

      <RunTabs value={tab} onChange={changeTab} />

      {tab === 'findings' ? (
        <>
          <Panel title="Findings" description={hasResults ? 'Counts from this run' : undefined}>
            {hasResults ? (
              scan.summary?.total_findings > 0 ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                    {SEVERITY_ORDER.map((s) => (
                      <div
                        key={s}
                        className="rounded-lg border border-border bg-muted/40 px-3 py-3 text-center"
                      >
                        <p className="text-xl font-semibold tabular-nums text-foreground">
                          {counts[s] || 0}
                        </p>
                        <p className="mt-1 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <span className={cn('size-1.5 rounded-full', SEVERITY_DOTS[s])} aria-hidden />
                          <span className="capitalize">{s}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-xs text-muted-foreground">
                    Findings are what the agent and any installed tools detected. A clean result does not
                    prove the code is secure.
                  </p>
                </>
              ) : (
                <EmptyState
                  icon={ShieldCheck}
                  title="Nothing detected"
                  description="The review finished without findings. This does not prove the code is secure."
                  className="py-10"
                />
              )
            ) : (
              <EmptyState
                icon={CircleDashed}
                title={isActive ? 'Findings pending' : 'No findings for this run'}
                description={
                  isActive
                    ? 'Counts appear once the review finishes.'
                    : STATUS_EXPLANATIONS[scan.status]
                }
                className="py-10"
              />
            )}
          </Panel>

          {hasResults && scan.summary?.total_findings > 0 && (
            <Panel
              title="What was read"
              description="Each finding with the lines it points at. The excerpt is sliced from your stored archive at that location, not quoted by a model, with likely credentials masked."
            >
              {detected?.scanId !== id ? (
                <LoadingState label="Loading the findings of this run" />
              ) : detected.items.length === 0 ? (
                <EmptyState
                  icon={ScanSearch}
                  title="The findings could not be loaded"
                  description="The counts above come from the run record itself, so they still stand. Reload this page to fetch the details again."
                  className="py-10"
                />
              ) : (
                <>
                  <ul className="space-y-4">
                    {detected.items.map((finding) => {
                      const analyzer = runNames.get(finding.tool_run_id) || null
                      return (
                        <li key={finding.id} className="overflow-hidden rounded-lg border border-border">
                          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3 py-2">
                            <SeverityBadge severity={finding.severity} />
                            <Link
                              to={`/app/audits/findings/${finding.id}`}
                              className="min-w-0 flex-1 truncate text-sm font-medium text-foreground hover:underline"
                            >
                              {finding.title}
                            </Link>
                            <Pill tone={analyzer === 'agent' ? 'ai' : 'neutral'}>
                              {analyzer || 'no run recorded'}
                            </Pill>
                            {finding.suggestion?.patch && <Pill tone="ai">suggested edit</Pill>}
                            {finding.ai_explanation?.intel && (
                              <Pill tone="danger">
                                <Globe className="size-3 inline mr-1" />
                                Threat Intel
                              </Pill>
                            )}
                          </div>
                          <div className="space-y-2 p-3">
                            {finding.file_path ? (
                              <FilePath
                                path={finding.file_path}
                                line={finding.start_line}
                                endLine={finding.end_line}
                                className="max-w-full"
                              />
                            ) : (
                              <InlineCode>no file recorded</InlineCode>
                            )}
                            {finding.evidence ? (
                              <CodeBlock
                                code={finding.evidence}
                                startLine={finding.start_line || 1}
                                highlight={highlightLines(finding)}
                                maxHeight="14rem"
                              />
                            ) : (
                              <p className="text-xs text-muted-foreground">
                                No source lines were stored for this finding, so there is nothing to show.
                                Its detail page records why.
                              </p>
                            )}
                            {finding.suggestion?.patch && (
                              <SuggestionDiff suggestion={finding.suggestion} className="pt-1" />
                            )}
                            {(finding.ai_explanation?.intel || finding.ai_explanation?.dep) && (
                              <ThreatIntelCard
                                intel={finding.ai_explanation?.intel}
                                dep={finding.ai_explanation?.dep}
                                className="mt-2"
                              />
                            )}
                          </div>
                        </li>
                      )
                    })}
                  </ul>
                  {detected.items.length < (scan.summary?.total_findings ?? 0) && (
                    <p className="mt-4 text-xs text-muted-foreground">
                      Showing the first {detected.items.length} of {scan.summary.total_findings} on this
                      page.{' '}
                      <Link to={`/app/audits/findings?scan=${id}`} className="underline">
                        Open the full list
                      </Link>
                      .
                    </p>
                  )}
                </>
              )}
            </Panel>
          )}
        </>
      ) : (
        <>
          <Panel
            title="What this status means"
            description={STATUS_EXPLANATIONS[scan.status] || 'Audit in progress.'}
          >
            {scan.error_code ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                Error code
                <InlineCode>{scan.error_code}</InlineCode>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4" aria-hidden />
                  Started {scan.started_at ? formatDate(scan.started_at) : 'not yet'}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-4" aria-hidden />
                  {scan.completed_at
                    ? `Finished ${formatDate(scan.completed_at)}`
                    : isActive
                      ? 'Running now'
                      : 'No completion time'}
                </span>
                {scan.started_at && scan.completed_at && (
                  <span>
                    Duration{' '}
                    {formatDuration(
                      new Date(scan.completed_at) - new Date(scan.started_at)
                    )}
                  </span>
                )}
              </div>
            )}
            {isActive && (
              <p className="mt-3 text-xs text-muted-foreground">
                This page refreshes automatically while the audit runs.
              </p>
            )}
          </Panel>

          <Panel
            title="AI review"
            description="The agent that read this archive, and what it reported"
          >
            {agent ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={AGENT_TONES[agent.status] || 'neutral'}>{humanize(agent.status)}</Pill>
                  {agent.reviewer && <span className="text-sm text-muted-foreground">{agent.reviewer}</span>}
                  {agent.error_code && <InlineCode>{agent.error_code}</InlineCode>}
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                  <span className="tabular-nums">
                    <span className="text-foreground">{agent.files_reviewed ?? 0}</span> file
                    {agent.files_reviewed === 1 ? '' : 's'} read
                  </span>
                  <span className="tabular-nums">
                    <span className="text-foreground">{agent.files_skipped ?? 0}</span> skipped as
                    binary, empty or over the size budget
                  </span>
                  <span className="tabular-nums">
                    <span className="text-foreground">{agent.calls ?? 0}</span> reviewer call
                    {agent.calls === 1 ? '' : 's'}
                  </span>
                  {agent.investigations > 0 && (
                    <span className="tabular-nums">
                      <span className="text-foreground">{agent.investigations}</span> investigation
                      {agent.investigations === 1 ? '' : 's'} across files
                    </span>
                  )}
                  {agent.follow_ups > 0 && (
                    <span className="tabular-nums">
                      <span className="text-foreground">{agent.follow_ups}</span> follow-up call
                      {agent.follow_ups === 1 ? '' : 's'}
                    </span>
                  )}
                  {agent.context_reads > 0 && (
                    <span className="tabular-nums">
                      <span className="text-foreground">{agent.context_reads}</span> targeted code read
                      {agent.context_reads === 1 ? '' : 's'}
                    </span>
                  )}
                  {agent.searches > 0 && (
                    <span className="tabular-nums">
                      <span className="text-foreground">{agent.searches}</span> literal search
                      {agent.searches === 1 ? '' : 'es'}
                    </span>
                  )}
                  {agent.investigation_failures > 0 && (
                    <span className="tabular-nums">
                      <span className="text-foreground">{agent.investigation_failures}</span> failed
                      follow-up{agent.investigation_failures === 1 ? '' : 's'}; the last supported
                      review was kept
                    </span>
                  )}
                  <span className="tabular-nums">
                    <span className="text-foreground">{agent.findings ?? 0}</span> finding
                    {agent.findings === 1 ? '' : 's'} reported
                  </span>
                  {agent.suggestions > 0 && (
                    <span className="tabular-nums">
                      <span className="text-foreground">{agent.suggestions}</span> suggested edit
                      {agent.suggestions === 1 ? '' : 's'} written
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {agent.dropped_findings > 0 ? (
                    <>
                      {agent.dropped_findings} reported finding
                      {agent.dropped_findings === 1 ? ' was' : 's were'} discarded because the line could
                      not be found in the archived copy — Vulnix drops those instead of guessing a
                      location. Prompt <InlineCode>{agent.prompt_version || 'agent'}</InlineCode>.
                    </>
                  ) : (
                    <>
                      Every reported finding pointed at a real line of the archived copy. Prompt{' '}
                      <InlineCode>{agent.prompt_version || 'agent'}</InlineCode>.
                    </>
                  )}
                </p>
              </div>
            ) : agentRun ? (
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Pill tone={TOOL_TONES[agentRun.status] || 'neutral'}>{humanize(agentRun.status)}</Pill>
                The readout is written when the audit finishes. Follow the step trace below for the files
                it is reading now.
              </div>
            ) : (
              <EmptyState
                icon={Wrench}
                title="No AI review recorded"
                description={
                  isActive
                    ? 'The agent appears here once the worker starts reading the archive.'
                    : 'This audit ran with the agent turned off, or ended before it began. Only CLI tools contributed.'
                }
              />
            )}
          </Panel>

          {router && (
            <Panel
              title="Agent Router & Specialist Swarm"
              description="Multi-agent routing fanned findings out to specialist agents concurrently, merging intelligence and patches."
            >
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Routed Findings</p>
                    <p className="text-xl font-semibold text-foreground mt-0.5 tabular-nums">
                      {router.decisions ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Specialist Calls</p>
                    <p className="text-xl font-semibold text-foreground mt-0.5 tabular-nums">
                      {router.dispatched ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Merged Findings</p>
                    <p className="text-xl font-semibold text-foreground mt-0.5 tabular-nums">
                      {router.merged_findings ?? 0}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/40 p-3">
                    <p className="text-xs text-muted-foreground">Router Status</p>
                    <div className="mt-1">
                      <Pill tone="ai">Active · Swarm</Pill>
                    </div>
                  </div>
                </div>

                {router.agent_calls && Object.keys(router.agent_calls).length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                    <span className="text-muted-foreground">Specialists invoked:</span>
                    {Object.entries(router.agent_calls).map(([agentName, count]) => (
                      <span
                        key={agentName}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground"
                      >
                        <span className="size-1.5 rounded-full bg-primary" />
                        <span className="capitalize">{agentName}Agent</span>
                        <span className="text-muted-foreground">({count})</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Panel>
          )}

          <Panel
            title="Optional CLI tools"
            description="analyzers installed on this server — an absent tool is a note, never a failed audit"
            flush={cliRuns.length > 0}
          >
            {cliRuns.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title={isActive ? 'No CLI tool has reported yet' : 'No CLI tool contributed'}
                description={
                  isActive
                    ? 'Each enabled tool appears here as it starts and finishes.'
                    : 'semgrep, bandit, gitleaks, trivy and pip-audit are only run when installed here. The AI review above is the scanner.'
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tool</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Findings</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Exit code</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cliRuns.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="font-medium text-foreground">
                        <div className="flex flex-wrap items-center gap-2">
                          {run.tool_name}
                          {run.tool_version && (
                            <span className="text-xs text-muted-foreground">v{run.tool_version}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          <Pill tone={TOOL_TONES[run.status] || 'neutral'}>
                            {run.status === 'skipped' && run.error_code === 'TOOL_UNAVAILABLE'
                              ? 'not installed'
                              : humanize(run.status)}
                          </Pill>
                          {run.error_code && <InlineCode>{run.error_code}</InlineCode>}
                        </div>
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {run.status === 'succeeded' ? run.finding_count : '—'}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatDuration(run.duration_ms)}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {run.exit_code ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Panel>

          <Panel title="Requested options" description="What was asked for when this audit started">
            <div className="flex flex-wrap gap-2">
              <Pill tone={options.agent_review === false ? 'neutral' : 'ai'}>AI agent review</Pill>
              <Pill tone={options.static_analysis ? 'success' : 'neutral'}>
                Static analysis
              </Pill>
              <Pill tone={options.secrets ? 'success' : 'neutral'}>Secret detection</Pill>
              <Pill tone={options.dependencies ? 'success' : 'neutral'}>Dependency analysis</Pill>
            </div>
          </Panel>

          {(isActive || steps.length > 0) && (
            <Panel
              title="Step trace"
              description="Every checkpoint the worker reported for this audit, in order"
            >
              <ScanProgressTrace
                steps={steps}
                runs={toolRuns}
                startedAt={scan.started_at}
                active={isActive}
              />
            </Panel>
          )}
        </>
      )}

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this audit?</AlertDialogTitle>
            <AlertDialogDescription>
              The agent stops at its next file and any enabled CLI tool is left to finish on its own.
              Findings already detected are kept, but the run is marked cancelled and won’t count as
              a completed review of this archive.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep running</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Cancel audit'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ShareExportModal
        open={shareModalOpen}
        onOpenChange={setShareModalOpen}
        scan={scan}
        project={project}
        findings={detected?.items || []}
      />
    </PageStack>
  )
}
