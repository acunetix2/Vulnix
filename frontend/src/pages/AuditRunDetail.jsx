import { useState, useEffect, useCallback } from 'react'
import { useParams, useSearchParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Activity,
  BrainCircuit,
  ChevronRight,
  StopCircle,
  ScanSearch,
  ShieldCheck,
  Share2,
  Wrench,
  CircleDashed,
  Globe,
  Network,
  Search,
  Terminal,
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
  running: 'info',
  partial: 'warning',
  failed: 'danger',
  skipped: 'neutral',
  off: 'neutral',
}

/* The agent is the scanner. A CLI tool that is merely absent never fails a
   audit, so the wording below can promise that without hedging. */
const STATUS_EXPLANATIONS = {
  completed:
    'The AI agent read this archive and its findings are counted below. Optional CLI tools requested for this audit added their own.',
  completed_with_errors:
    'The review produced usable findings, but a CLI tool crashed or timed out. The agent’s findings stand on their own — check the tool list below for what is missing.',
  failed:
    'Nothing usable came out of this audit: the archive could not be read, or the agent was unavailable and no CLI tool returned results either.',
  cancelled:
    'The audit was stopped before it finished. Findings already stored remain, but the counts below were not rolled up.',
  running: 'The AI agent is reading the archive file by file; optional CLI tools run after it.',
  queued: 'The audit is waiting for capacity and has not started yet.',
}

// The codes the worker can end a run with, in the terms an engineer acts on.
const ERROR_HINTS = {
  NO_SOURCE: 'The archive held no file the agent could read as source — check what was uploaded.',
  AI_DISABLED: 'No reviewer is enabled on this server, so the audit had no scanner to run.',
  AGENT_DISABLED: 'The agent is switched off for this deployment, and nothing else was requested.',
  NO_ANALYSIS_REQUESTED: 'AI review was turned off and no optional CLI tool was requested.',
  ALL_SCANNERS_FAILED: 'None of the CLI tools requested for this audit could run here.',
  UPLOAD_UNAVAILABLE: 'The archive behind this audit is gone or was rejected before review.',
  TIMEOUT: 'The audit ran out of wall-clock time before the agent finished.',
  AI_UNAVAILABLE: 'Every reviewer this deployment is configured to use refused the call. The audit is retryable once one answers.',
  AI_MISCONFIGURED: 'The reviewer was asked but has no usable endpoint or credential here.',
  AI_CONTEXT_OVERFLOW: 'A file was wider than every reviewer in the chain can read at once. Selecting the widest reviewer may take it.',
  AI_OUTPUT_TRUNCATED: "A reviewer's answer hit the output limit, so it was reported rather than re-asked.",
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
  { key: 'overview', label: 'Run timeline' },
  { key: 'findings', label: 'Findings' },
]

const SPECIALIST_NAMES = {
  code: 'Code Agent',
  intel: 'Threat Intel Agent',
  dep: 'Dependency Agent',
}

const SPECIALIST_ROLES = {
  code: 'Code analysis and patch generation',
  intel: 'Threat intelligence and exploit context',
  dep: 'Dependency and exposure analysis',
}

function Metric({ label, value, detail, accent = false, danger = false }) {
  return (
    <div className="min-w-0 px-4 py-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p
        className={cn(
          'mt-1.5 truncate text-xl font-semibold tabular-nums',
          danger ? 'text-destructive' : accent ? 'text-primary' : 'text-foreground'
        )}
      >
        {value}
      </p>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</p>
    </div>
  )
}

function AgentNode({ name, role, status, calls, errors = 0, primary = false, children }) {
  return (
    <article
      className={cn(
        'relative overflow-hidden rounded-lg border bg-background/45 p-3.5',
        primary ? 'border-primary/30' : 'border-border/80'
      )}
    >
      {primary && <div className="absolute inset-y-0 left-0 w-0.5 bg-primary" aria-hidden />}
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'mt-0.5 grid size-8 shrink-0 place-items-center rounded-md border',
            primary ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border bg-muted/50 text-muted-foreground'
          )}
        >
          {primary ? <BrainCircuit className="size-4" /> : <Network className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            <Pill tone={AGENT_TONES[status] || TOOL_TONES[status] || 'neutral'}>
              {humanize(status || 'not recorded')}
            </Pill>
          </div>
          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{role}</p>
        </div>
      </div>
      {(calls != null || errors > 0) && (
        <div className="mt-3 flex items-center gap-4 border-t border-border/60 pt-2.5 text-[11px] tabular-nums text-muted-foreground">
          {calls != null && <span>{calls} dispatch{calls === 1 ? '' : 'es'}</span>}
          {errors > 0 && <span className="text-destructive">{errors} error{errors === 1 ? '' : 's'}</span>}
        </div>
      )}
      {children}
    </article>
  )
}

function Telemetry({ icon: Icon, label, value }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/35 p-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-3.5 text-primary" aria-hidden />
        <span className="text-[10px] uppercase tracking-[0.14em]">{label}</span>
      </div>
      <p className="mt-2 text-lg font-semibold tabular-nums text-foreground">{value ?? '—'}</p>
    </div>
  )
}

function RunDuration({ scan, fallback }) {
  const active = ACTIVE.has(scan.status)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active || !scan.started_at) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active, scan.started_at])

  if (!scan.started_at) return formatDuration(fallback)
  const end = scan.completed_at ? new Date(scan.completed_at).getTime() : now
  return formatDuration(end - new Date(scan.started_at).getTime())
}

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
            Share & export
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
  const specialists = Object.entries(router?.agent_calls || {})
  const primaryStatus =
    agent?.status || agentRun?.status || (options.agent_review === false ? 'off' : isActive ? 'running' : 'not_recorded')
  const primaryNodes = options.agent_review === false || (!agent && !agentRun) ? 0 : 1
  const nodeCount = primaryNodes + specialists.length
  const criticalAndHigh = (counts.critical || 0) + (counts.high || 0)
  const cliRequested = Boolean(options.static_analysis || options.secrets || options.dependencies)

  return (
    <PageStack className="audit-ops p-3 sm:p-4">
      <header className="audit-command overflow-hidden rounded-xl border border-border/80 bg-background/50">
        <div className="flex flex-col gap-5 p-4 sm:p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb">
              <ol className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
                {breadcrumb.map((crumb, index) => (
                  <li key={`${crumb.label}-${index}`} className="flex items-center gap-1">
                    {index > 0 && <ChevronRight className="size-3 text-border-strong" aria-hidden />}
                    {crumb.to && index < breadcrumb.length - 1 ? (
                      <Link to={crumb.to} className="transition-colors hover:text-primary">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={cn(index === breadcrumb.length - 1 && 'text-foreground')}>{crumb.label}</span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
            <div className="mt-5 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-primary">
              <Activity className="size-3.5" aria-hidden />
              Autonomous security audit
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-semibold tracking-[-0.04em] text-foreground">
                {project?.name || 'Repository audit'}
              </h1>
              <ScanStatusBadge status={scan.status} />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{runSubtitle(scan)}</p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        </div>

        <div className="grid grid-cols-2 border-y border-border/70 bg-background/35 lg:grid-cols-4 lg:divide-x lg:divide-border/70">
          <Metric
            label="Run state"
            value={
              isActive
                ? 'LIVE'
                : scan.status === 'completed'
                  ? 'COMPLETE'
                  : scan.status === 'completed_with_errors'
                    ? 'ATTENTION'
                    : humanize(scan.status).toUpperCase()
            }
            detail={isActive ? 'Polling worker checkpoints' : humanize(primaryStatus)}
            accent={isActive || scan.status === 'completed'}
            danger={scan.status === 'failed'}
          />
          <Metric
            label="Files inspected"
            value={agent?.files_reviewed ?? '—'}
            detail={agent ? `${agent.files_skipped ?? 0} skipped during intake` : 'Waiting for reviewer telemetry'}
          />
          <Metric
            label="Findings"
            value={scan.summary?.total_findings ?? 0}
            detail={`${criticalAndHigh} critical or high`}
            danger={criticalAndHigh > 0}
          />
          <Metric
            label="Elapsed"
            value={<RunDuration scan={scan} fallback={agentRun?.duration_ms} />}
            detail={scan.completed_at ? `Finished ${formatDate(scan.completed_at)}` : 'Audit clock'}
          />
        </div>

        <div className="flex items-start gap-2.5 px-4 py-3 text-[11px] leading-5 text-muted-foreground sm:px-5">
          <span className={cn('mt-1.5 size-1.5 shrink-0 rounded-full bg-primary', isActive && 'animate-pulse')} aria-hidden />
          <p className="min-w-0">
            {STATUS_EXPLANATIONS[scan.status] || 'Audit in progress.'}
            {scan.error_code && ERROR_HINTS[scan.error_code] && (
              <span className="text-foreground/80"> {ERROR_HINTS[scan.error_code]}</span>
            )}
          </p>
          {scan.error_code && <InlineCode className="ml-auto shrink-0">{scan.error_code}</InlineCode>}
        </div>
      </header>

      <RunTabs value={tab} onChange={changeTab} className="rounded-lg border bg-background/35 px-2" />

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
          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <div className="space-y-4">
              <Panel
                title="Autonomous agent network"
                description="The reviewer and only the specialists actually dispatched in this run"
                actions={
                  <span className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    {nodeCount} node{nodeCount === 1 ? '' : 's'}
                  </span>
                }
              >
                <AgentNode
                  primary
                  name={agent?.reviewer || (options.agent_review === false ? 'Autonomous review off' : 'Vulnix Agent')}
                  role="Repository reviewer · hypothesis testing · cross-file investigation"
                  status={primaryStatus}
                >
                  {agent && (
                    <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/60 pt-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Files</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{agent.files_reviewed ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Investigations</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{agent.investigations ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Findings</p>
                        <p className="mt-1 text-sm font-semibold tabular-nums text-foreground">{agent.findings ?? 0}</p>
                      </div>
                    </div>
                  )}
                </AgentNode>

                <div className="my-4 flex items-center gap-3">
                  <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Specialist dispatch
                  </span>
                  <span className="h-px flex-1 bg-border/70" />
                  <span className="text-[11px] tabular-nums text-muted-foreground">{router?.dispatched ?? 0} calls</span>
                </div>

                {specialists.length > 0 ? (
                  <div className="space-y-2.5">
                    {specialists.map(([name, calls]) => (
                      <AgentNode
                        key={name}
                        name={SPECIALIST_NAMES[name] || `${humanize(name)} Agent`}
                        role={SPECIALIST_ROLES[name] || 'Routed specialist analysis'}
                        status={(router?.agent_errors?.[name] || 0) > 0 ? 'partial' : 'succeeded'}
                        calls={calls}
                        errors={router?.agent_errors?.[name] || 0}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-border/80 px-3 py-4 text-[11px] leading-5 text-muted-foreground">
                    {isActive
                      ? 'No specialist dispatches yet. The router engages only when a finding matches a registered specialist.'
                      : 'No specialist calls were recorded for this run.'}
                  </div>
                )}

                {router && (
                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-[11px] tabular-nums text-muted-foreground">
                    <span>{router.decisions ?? 0} routing decisions</span>
                    <span>{router.merged_findings ?? 0} findings after merge</span>
                  </div>
                )}
              </Panel>

              <Panel title="Investigation telemetry" description="Work performed beyond the initial file review">
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                  <Telemetry icon={Activity} label="Model calls" value={agent?.calls} />
                  <Telemetry icon={BrainCircuit} label="Follow-ups" value={agent?.follow_ups} />
                  <Telemetry icon={Terminal} label="Targeted reads" value={agent?.context_reads} />
                  <Telemetry icon={Search} label="Searches" value={agent?.searches} />
                  <Telemetry icon={Activity} label="Retries" value={agent?.retries} />
                  <Telemetry icon={Wrench} label="Suggested edits" value={agent?.suggestions} />
                </div>
                {agent ? (
                  <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-primary/20 bg-primary/[0.04] p-3">
                    <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0 text-[11px] leading-5 text-muted-foreground">
                      <p className="font-medium text-foreground">Evidence-bound review</p>
                      <p className="mt-0.5">
                        {agent.dropped_findings > 0
                          ? `${agent.dropped_findings} unsupported or unlocatable finding${agent.dropped_findings === 1 ? ' was' : 's were'} discarded.`
                          : 'Every accepted finding was checked against source in the stored archive.'}
                        {agent.investigation_failures > 0 &&
                          ` ${agent.investigation_failures} failed follow-up${agent.investigation_failures === 1 ? '' : 's'} preserved the last supported review.`}
                      </p>
                      <p className="mt-1">Protocol <InlineCode>{agent.prompt_version || 'agent'}</InlineCode></p>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
                    Telemetry appears when the reviewer completes its first readout.
                  </p>
                )}
              </Panel>
            </div>

            <Panel
              title="Execution stream"
              description="Persisted worker checkpoints in chronological order"
              className="self-start"
              actions={
                <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.14em] text-primary">
                  <span className={cn('size-1.5 rounded-full bg-primary', isActive && 'animate-pulse')} />
                  {isActive ? 'Live' : 'Recorded'}
                </span>
              }
            >
              <ScanProgressTrace
                variant="terminal"
                steps={steps}
                runs={toolRuns}
                startedAt={scan.started_at}
                endedAt={scan.completed_at}
                active={isActive}
              />
            </Panel>
          </div>

          <Panel
            title="Optional CLI tools"
            description="only run when this audit opts in — an absent tool is a note, never a failed audit"
            flush={cliRuns.length > 0}
          >
            {cliRuns.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title={
                  !cliRequested
                    ? 'No CLI tool was asked for'
                    : isActive
                      ? 'No CLI tool has reported yet'
                      : 'No CLI tool contributed'
                }
                description={
                  !cliRequested
                    ? 'The AI agent is the scanner. Static analysis, secret detection and dependency analysis add findings only when an audit asks for them.'
                    : isActive
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

          <Panel
            title="Requested options"
            description="What was asked for when this audit started"
          >
            <div className="flex flex-wrap gap-2">
              <Pill tone={options.agent_review === false ? 'neutral' : 'ai'}>AI agent review</Pill>
              <Pill tone={options.static_analysis ? 'success' : 'neutral'}>
                Static analysis{options.static_analysis ? '' : ' (off)'}
              </Pill>
              <Pill tone={options.secrets ? 'success' : 'neutral'}>
                Secret detection{options.secrets ? '' : ' (off)'}
              </Pill>
              <Pill tone={options.dependencies ? 'success' : 'neutral'}>
                Dependency analysis{options.dependencies ? '' : ' (off)'}
              </Pill>
            </div>
          </Panel>
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
