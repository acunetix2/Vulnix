import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, ShieldCheck, Inbox, CircleSlash } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../services/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { Button } from '../components/ui/button'
import { PageStack, StatGrid } from '../components/app/Grids'
import { PageHeader } from '../components/app/PageHeader'
import { Panel } from '../components/app/Panel'
import { AiModelPicker } from '../components/app/AiModelPicker'
import { StatCard } from '../components/app/StatCard'
import { CreditsHeatmap } from '../components/app/CreditsHeatmap'
import { AILabelled, Pill, SeverityBadge } from '../components/app/SeverityBadge'
import { CodeBlock, FilePath, InlineCode } from '../components/app/CodeBlock'
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState'
import { SEVERITY_RANK, normalizeSeverity } from '../lib/severity'
import { formatDate } from '../lib/utils'

/**
 * The only AI route that exists is `POST /findings/:id/explanation`, so this page
 * is a per-finding explanation queue rather than a project-level "generate
 * review" button. Nothing is simulated: model output appears only after the
 * server returns it, and every block carrying it is labelled as AI.
 */
const PROJECT_LIMIT = 8
const SCAN_LOOKBACK = 3
const FINDINGS_PER_SCAN = 50
const LIST_LIMIT = 12
const DONE_STATUSES = ['completed', 'completed_with_errors']

export function AISecurityReview() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()

  const [findings, setFindings] = useState([])
  const [scanCount, setScanCount] = useState(0)
  const [state, setState] = useState({ loading: false, error: null })
  const [attempt, setAttempt] = useState(0)

  const [results, setResults] = useState({})
  const [inflight, setInflight] = useState(() => new Set())
  const [errors, setErrors] = useState({})

  const [ai, setAi] = useState({ loading: true, error: null, settings: null })
  const [switching, setSwitching] = useState(null)

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false

    async function loadModels() {
      setAi((s) => ({ ...s, loading: true, error: null }))
      try {
        const settings = await api.getAiSettings(workspaceId)
        if (!cancelled) setAi({ loading: false, error: null, settings })
      } catch (err) {
        if (!cancelled)
          setAi({ loading: false, error: err.message || 'The model list could not be read.', settings: null })
      }
    }

    loadModels()
    return () => {
      cancelled = true
    }
  }, [workspaceId, attempt])

  async function switchModel(modelId) {
    setSwitching(modelId)
    try {
      const settings = await api.setAiModel(workspaceId, modelId)
      setAi({ loading: false, error: null, settings })
      const chosen = settings.models.find((m) => m.id === settings.selected)
      toast.success(`Now reviewing with ${chosen?.alias || 'the selected reviewer'}`, {
        description: 'Applies to every explanation generated from now on, in this workspace.',
      })
    } catch (err) {
      toast.error('Could not switch the model', {
        description: err.message || 'The selection was not saved.',
      })
    } finally {
      setSwitching(null)
    }
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
        const scans = perProject.filter(Boolean)

        const pages = await Promise.all(
          scans.map((scan) =>
            api
              .getFindings(scan.id, { limit: FINDINGS_PER_SCAN })
              .then((page) =>
                (page.items || []).map((finding) => ({ ...finding, project_name: scan.project_name }))
              )
              .catch(() => [])
          )
        )

        if (cancelled) return
        setScanCount(scans.length)
        setFindings(
          pages
            .flat()
            .sort((a, b) => (SEVERITY_RANK[normalizeSeverity(b.severity)] ?? 0) - (SEVERITY_RANK[normalizeSeverity(a.severity)] ?? 0))
            .slice(0, LIST_LIMIT)
        )
        setState({ loading: false, error: null })
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err.message || 'Please try again.' })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId, attempt])

  const explainedCount = useMemo(
    () => findings.filter((f) => results[f.id] || f.ai_explanation).length,
    [findings, results]
  )

  const selectedModel = useMemo(
    () => (ai.settings?.models || []).find((m) => m.id === ai.settings?.selected) || null,
    [ai.settings]
  )

  async function explain(finding) {
    setInflight((prev) => new Set(prev).add(finding.id))
    setErrors((prev) => ({ ...prev, [finding.id]: null }))
    try {
      const data = await api.explainFinding(finding.id)
      setResults((prev) => ({ ...prev, [finding.id]: data }))
      toast.success('Explanation generated', {
        description: 'Model output is a suggestion. Check it against the evidence in the finding.',
      })
    } catch (err) {
      const message = err.message || 'The explanation service is unavailable.'
      setErrors((prev) => ({ ...prev, [finding.id]: message }))
      toast.error('Could not generate the explanation', { description: message })
    } finally {
      setInflight((prev) => {
        const next = new Set(prev)
        next.delete(finding.id)
        return next
      })
    }
  }

  const header = (
    <PageHeader
      title="Agents"
      description="Model-written explanations for issues the scanners already reported."
      actions={
        <Button variant="outline" render={<Link to="/app/audits/findings" />}>
          <ShieldCheck data-icon="inline-start" />
          All findings
        </Button>
      }
    />
  )

  if (wsLoading || state.loading) {
    return (
      <PageStack>
        {header}
        <Panel>
          <LoadingState label="Loading findings to explain" />
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
            title={wsError ? 'We couldn’t load your workspace' : 'We couldn’t load findings'}
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

      <StatGrid columns={4}>
        <StatCard
          icon={Bot}
          label="Findings in review"
          value={findings.length}
          hint={`Highest severity from ${scanCount} ${scanCount === 1 ? 'audit' : 'audits'}`}
          tone="blue"
        />
        <StatCard
          icon={Bot}
          label="Explanations generated"
          value={explainedCount}
          hint={
            explainedCount === findings.length && findings.length > 0
              ? '100% of queue reviewed'
              : `${findings.length - explainedCount} awaiting generation`
          }
          tone="ai"
        />
        <StatCard
          icon={CircleSlash}
          label="Critical & high"
          value={findings.filter((f) => ['critical', 'high'].includes(normalizeSeverity(f.severity))).length}
          hint="Priority vulnerability triage"
          tone={findings.some((f) => normalizeSeverity(f.severity) === 'critical') ? 'red' : 'green'}
          to="/app/audits/findings?severity=critical"
        />
        <StatCard
          icon={ShieldCheck}
          label="Reviewer"
          value={selectedModel?.alias || 'None available'}
          hint={selectedModel ? 'Writes the explanations below' : 'No reviewer is answering'}
          tone="green"
        />
      </StatGrid>

      <Panel
        title="Vulnix reviewers"
        description="Which reviewer answers is chosen here; switching changes what explains the findings below."
        actions={selectedModel ? <Pill tone="ai">{selectedModel.alias}</Pill> : null}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          {ai.loading ? (
            <LoadingState label="Checking which reviewers answer" />
          ) : (
            <AiModelPicker
              models={ai.settings?.models || []}
              selected={ai.settings?.selected || null}
              pending={switching}
              saving={switching !== null}
              error={ai.error}
              onRetry={() => setAttempt((a) => a + 1)}
              onSelect={switchModel}
            />
          )}

          <div className="space-y-3 rounded-lg border border-border bg-muted/40 p-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Credits today
              </p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                {ai.settings ? `${ai.settings.used_today} / ${ai.settings.daily_quota}` : '—'}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                One credit is one question a reviewer answered. Re-reading an answer you already
                have costs nothing, and so does a call that failed.
              </p>
            </div>
            {ai.settings && !ai.settings.enabled && (
              <p className="border-t border-border pt-2 text-xs leading-relaxed text-destructive">
                Reviewers are switched off on this deployment. Findings below stay as the code
                reports them until one is turned on.
              </p>
            )}
          </div>
        </div>
      </Panel>

      <Panel
        title="Credits usage"
        description="Your own AI calls, day by day, across the last 52 weeks."
      >
        <CreditsHeatmap
          workspaceId={workspaceId}
          usedToday={ai.settings?.used_today}
          dailyQuota={ai.settings?.daily_quota}
        />
      </Panel>

      {findings.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Inbox}
            title="No findings to explain"
            description="No findings from recent audits. Run an audit from a project to populate this queue."
            action={
              <Button render={<Link to="/app/projects" />}>
                Run an audit from a project
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          <Panel
            title="Explain a finding"
            description={`Top-severity findings from the latest completed audit of ${scanCount} ${
              scanCount === 1 ? 'project' : 'projects'
            }`}
            flush
          >
            <ul className="divide-y divide-border">
              {findings.map((finding) => {
                const output = results[finding.id] || finding.ai_explanation
                const busy = inflight.has(finding.id)
                return (
                  <li key={finding.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <SeverityBadge severity={finding.severity} withDot={false} />
                          {output && <AILabelled>Explained</AILabelled>}
                        </div>
                        <Link
                          to={`/app/audits/findings/${finding.id}`}
                          className="mt-1.5 block text-sm font-medium text-foreground transition-colors duration-150 ease-smooth hover:text-primary"
                        >
                          {finding.title || 'Security issue'}
                        </Link>
                        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="truncate">{finding.project_name || 'Unknown project'}</span>
                          {finding.file_path && (
                            <FilePath
                              path={finding.file_path}
                              line={finding.start_line}
                              endLine={finding.end_line}
                              className="max-w-[28ch] py-0 text-[11px]"
                            />
                          )}
                        </p>
                      </div>
                      <Button
                        variant={output ? 'ghost' : 'outline'}
                        size="sm"
                        onClick={() => explain(finding)}
                        disabled={busy}
                      >
                        <Bot data-icon="inline-start" />
                        {busy ? 'Generating…' : output ? 'Generate again' : 'Explain with AI'}
                      </Button>
                    </div>

                    {errors[finding.id] && (
                      <p className="px-4 pb-3 text-sm text-destructive" role="alert">
                        {errors[finding.id]}
                      </p>
                    )}

                    {output && !busy && <AIResult output={output} finding={finding} />}
                  </li>
                )
              })}
            </ul>
          </Panel>
        </div>
      )}
    </PageStack>
  )
}

/**
 * Model output, rendered as text and labelled as such. Confidence is shown as the
 * level the model was asked to pick, never as a percentage.
 */
function AIResult({ output, finding }) {
  const steps = Array.isArray(output.remediation_steps) ? output.remediation_steps : []
  const checks = Array.isArray(output.verification_steps) ? output.verification_steps : []
  const refs = Array.isArray(output.evidence_refs) ? output.evidence_refs : []

  // The server compares what this workspace asked for with what replied, and
  // says so; the page never infers it from a name it cannot see.
  const answered = output.reviewer || 'A Vulnix reviewer'

  return (
    <div className="console-enter border-t border-ai/30 bg-ai-subtle/60 px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <AILabelled>AI suggestion</AILabelled>
        <p className="text-xs text-muted-foreground">
          {answered}
          {output.generated_at ? ` · ${formatDate(output.generated_at)}` : ''} · suggestion, not fact
        </p>
      </div>

      {output.fallback && (
        <p className="mt-1.5 text-xs text-muted-foreground">
          The reviewer this workspace selected did not answer in time, so {answered} replied
          instead.
        </p>
      )}

      <p className="mt-2 text-sm leading-relaxed text-foreground">
        {output.summary || 'The model returned no summary.'}
      </p>

      {output.impact && (
        <div className="mt-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Inferred impact
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-foreground">{output.impact}</p>
        </div>
      )}

      {steps.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Suggested steps
          </h3>
          <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-foreground">
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}

      {checks.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            How to verify
          </h3>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
            {checks.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ul>
        </div>
      )}

      {refs.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Evidence the model cited
          </h3>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {refs.map((ref) => (
              <InlineCode key={ref}>{ref}</InlineCode>
            ))}
          </div>
        </div>
      )}

      {finding.evidence && (
        <div className="mt-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            What the scanner saw
          </h3>
          <CodeBlock
            className="mt-1.5"
            code={finding.evidence}
            filename={finding.file_path || undefined}
            startLine={finding.start_line || 1}
            highlight={
              finding.start_line != null
                ? Array.from(
                    { length: Math.max(1, Math.min((finding.end_line || finding.start_line) - finding.start_line + 1, 80)) },
                    (_, i) => finding.start_line + i
                  )
                : []
            }
            maxHeight="16rem"
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Pill tone="neutral">
          {output.confidence ? `${String(output.confidence).replace(/_/g, ' ')} stated confidence` : 'No stated confidence'}
        </Pill>
        <p className="text-xs text-muted-foreground">
          A level the model picked, not a calibrated probability.
        </p>
      </div>

      {output.limitations && (
        <div className="mt-3 rounded-lg border border-border bg-background p-3">
          <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Limitations
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-foreground">{output.limitations}</p>
        </div>
      )}
    </div>
  )
}
