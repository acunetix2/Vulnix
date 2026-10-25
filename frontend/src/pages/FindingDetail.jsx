import { useCallback, useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ChevronLeft,
  FileWarning,
  History,
  Save,
  ShieldCheck,
  Bot,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../services/api'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
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
import {
  AILabelled,
  FindingStatusBadge,
  Pill,
  SeverityBadge,
} from '../components/app/SeverityBadge'
import { CodeBlock, FilePath, InlineCode } from '../components/app/CodeBlock'
import { SuggestionDiff } from '../components/app/SuggestionDiff'
import { ThreatIntelCard } from '../components/app/ThreatIntelCard'
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState'
import { formatDate, formatRelativeTime, cn } from '../lib/utils'

const FINDING_STATUSES = ['open', 'fixed', 'false_positive', 'accepted_risk']

const CATEGORY_LABELS = {
  static_analysis: 'Static analysis',
  secrets: 'Secret detection',
  dependencies: 'Dependencies',
}

/** Confidence is a scanner's own word for how sure it is, not a probability. */
const CONFIDENCE_NOTES = {
  high: 'The scanner considers this pattern a very likely match. It can still be a false positive.',
  medium: 'The scanner is moderately sure. Manual review of the excerpt below is what settles it.',
  low: 'The scanner is not very sure — expect a higher false-positive rate at this level.',
}

const CONFIRMATIONS = {
  false_positive: {
    title: 'Mark this finding as a false positive?',
    body: 'This tells the workspace the scanner’s match is not a real problem. The finding stays recorded, and triage is written to the workspace audit log. Reopen it later by setting the status back to open.',
    action: 'Mark false positive',
  },
  accepted_risk: {
    title: 'Accept the risk on this finding?',
    body: 'This keeps the issue open in the code but records that the team is consciously living with it. Reports will show it as accepted rather than fixed, so the note should say who decided and why. You can change the status later.',
    action: 'Accept risk',
  },
}

function noteRequired(status) {
  return status === 'false_positive' || status === 'accepted_risk'
}

/** Line numbers to highlight in the evidence block, capped for very long spans. */
function highlightRange(start, end) {
  if (start == null) return []
  const from = Number(start)
  if (!Number.isFinite(from)) return []
  const to = Number(end ?? start)
  const span = Math.max(1, Math.min(Number.isFinite(to) ? to - from + 1 : 1, 200))
  return Array.from({ length: span }, (_, i) => from + i)
}

function categoryLabel(category) {
  if (!category) return null
  return CATEGORY_LABELS[category] || String(category).replace(/_/g, ' ')
}

export function FindingDetail() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  // Filters came in on the URL, so Back restores the list exactly as it was.
  const listHref = `/app/audits/findings${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
  const historyHref = `/app/audits/findings/${id}/history${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

  const [finding, setFinding] = useState(null)
  const [scan, setScan] = useState(null)
  const [project, setProject] = useState(null)
  const [state, setState] = useState({ loading: true, error: null, missing: false })
  const [attempt, setAttempt] = useState(0)

  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(null)
  const [pending, setPending] = useState(null)

  const [explanation, setExplanation] = useState(null)
  const [explaining, setExplaining] = useState(false)
  const [explainError, setExplainError] = useState(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const data = await api.getFinding(id)
        if (cancelled) return
        setFinding(data)
        setNote(data.triage_note || '')
        setState({ loading: false, error: null, missing: false })

        api
          .getScan(data.scan_id)
          .then(async (detail) => {
            if (cancelled) return detail
            setScan(detail)
            if (detail.project_id) {
              try {
                setProject(await api.getProject(detail.project_id))
              } catch {
                /* project name is decoration here; the audit still stands */
              }
            }
            return detail
          })
          .catch(() => null)
      } catch (err) {
        if (cancelled) return
        setState({
          loading: false,
          error: err.status === 404 ? null : err.message || 'Please try again.',
          missing: err.status === 404,
        })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id, attempt])

  const breadcrumb = [
    { label: 'Findings', to: listHref },
    { label: project?.name || 'Finding' },
    { label: finding ? String(finding.title).slice(0, 32) : 'Loading' },
  ]

  const handleExplain = useCallback(async () => {
    setExplaining(true)
    setExplainError(null)
    try {
      const data = await api.explainFinding(id)
      setExplanation(data)
      toast.success('AI suggestion ready', {
        description: 'It is a suggestion based on the excerpt shown. Verify it against the code.',
      })
    } catch (err) {
      const message = err.message || 'The explanation service is unavailable.'
      setExplainError(message)
      toast.error('Could not generate the suggestion', { description: message })
    } finally {
      setExplaining(false)
    }
  }, [id])

  const applyTriage = useCallback(
    async (status) => {
      setSaving(status)
      try {
        const updated = await api.updateFinding(id, {
          status,
          triage_note: note.trim() === '' ? null : note.trim(),
        })
        setFinding(updated)
        setPending(null)
        toast.success(`Marked as ${String(status).replace(/_/g, ' ')}`, {
          description:
            status === 'open'
              ? 'The finding is back in the queue.'
              : 'Decision saved and recorded in the workspace audit log.',
        })
      } catch (err) {
        toast.error('Could not save the decision', {
          description: err.message || 'Please try again.',
        })
      } finally {
        setSaving(null)
      }
    },
    [id, note]
  )

  function requestTriage(status) {
    if (noteRequired(status) && note.trim() === '') {
      toast.error('Add a triage note first', {
        description: 'A false positive or accepted-risk decision needs a reason on record.',
      })
      return
    }
    if (CONFIRMATIONS[status]) setPending(status)
    else applyTriage(status)
  }

  const header = (
    <PageHeader
      title={finding?.title || 'Finding'}
      description={
        finding
          ? `${project?.name ? `${project.name} · ` : ''}Detected ${formatRelativeTime(
              finding.created_at
            )}${scan ? ` by scan ${scan.id.slice(0, 8)}` : ''}`
          : 'Evidence, impact and remediation for one detected issue.'
      }
      breadcrumb={breadcrumb}
      actions={
        finding && (
          <>
            <Button variant="outline" render={<Link to={listHref} />}>
              <ChevronLeft data-icon="inline-start" />
              Back
            </Button>
            <Button variant="outline" render={<Link to={historyHref} />}>
              <History data-icon="inline-start" />
              History
            </Button>
          </>
        )
      }
      meta={
        finding && (
          <>
            <SeverityBadge severity={finding.severity} />
            <FindingStatusBadge status={finding.status} />
            {finding.category && <Pill>{categoryLabel(finding.category)}</Pill>}
            {finding.confidence && (
              <Pill>{String(finding.confidence).replace(/_/g, ' ')} confidence</Pill>
            )}
          </>
        )
      }
    />
  )

  if (state.loading) {
    return (
      <PageStack>
        {header}
        <Panel>
          <LoadingState label="Loading finding" />
        </Panel>
      </PageStack>
    )
  }

  if (state.missing || (!finding && !state.error)) {
    return (
      <PageStack>
        <PageHeader title="Finding" breadcrumb={breadcrumb} />
        <Panel>
          <EmptyState
            icon={FileWarning}
            title="This finding is no longer available"
            description="The link may point at a finding from a deleted audit or another workspace. Open the list to pick one that still exists."
            action={
              <Button render={<Link to={listHref} />}>
                Back to findings
                <ChevronLeft data-icon="inline-start" />
              </Button>
            }
          />
        </Panel>
      </PageStack>
    )
  }

  if (state.error) {
    return (
      <PageStack>
        <PageHeader title="Finding" breadcrumb={breadcrumb} />
        <Panel>
          <ErrorState
            title="We couldn’t load this finding"
            description={state.error}
            onRetry={() => setAttempt((a) => a + 1)}
          />
        </Panel>
      </PageStack>
    )
  }

  const aiOutput = explanation || finding.ai_explanation
  const lines = highlightRange(finding.start_line, finding.end_line)
  // Findings the agent reported carry `agent/<class>` rules; their evidence is
  // sliced out of the stored archive, while `scanner_message` holds its quotation.
  const fromAgent = String(finding.rule_id || '').startsWith('agent/')

  return (
    <PageStack>
      {header}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel
            title="Evidence"
            description={
              fromAgent
                ? 'The archived lines at the location below — taken from your stored archive, not quoted by the model. Likely credentials inside them are masked.'
                : 'Source excerpt exactly as the scanner reported it. Shown as text, never interpreted as markup.'
            }
            flush={Boolean(finding.evidence)}
            actions={
              finding.file_path ? (
                <FilePath
                  path={finding.file_path}
                  line={finding.start_line}
                  endLine={finding.end_line}
                  className="max-w-[40ch] py-0"
                />
              ) : null
            }
          >
            {finding.evidence ? (
              <div className="space-y-3 p-4">
                <CodeBlock
                  code={finding.evidence}
                  filename={finding.file_path || undefined}
                  startLine={finding.start_line || 1}
                  highlight={lines}
                  maxHeight="26rem"
                />
                {finding.scanner_message && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">
                      {fromAgent ? 'What the reviewer said it saw' : 'Scanner message'}
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-foreground">
                      {finding.scanner_message}
                    </p>
                    {fromAgent && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        The model’s own words. The block above is the archive; if the two disagree,
                        the archive is the record.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <EmptyState
                icon={FileWarning}
                title="No source excerpt recorded"
                description={
                  fromAgent
                    ? 'The lines at this location are blank in the archived copy, so there is nothing to display here. A finding that cites a line the archive does not hold is dropped rather than stored.'
                    : 'This scanner reported the issue without attaching code, so there is nothing to display here. The location below is still exact.'
                }
                className="py-10"
              />
            )}
          </Panel>

          <Panel title="Location and detection">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="File path">
                {finding.file_path ? (
                  <FilePath path={finding.file_path} className="max-w-full" />
                ) : (
                  <Dash />
                )}
              </Field>
              <Field label="Line range">
                {finding.start_line != null ? (
                  <InlineCode>
                    {finding.start_line}
                    {finding.end_line && finding.end_line !== finding.start_line
                      ? ` – ${finding.end_line}`
                      : ''}
                  </InlineCode>
                ) : (
                  <Dash />
                )}
              </Field>
              <Field label="Scanner rule id">
                {finding.rule_id ? (
                  <InlineCode className="break-all">{finding.rule_id}</InlineCode>
                ) : (
                  <Dash />
                )}
              </Field>
              <Field label="Confidence">
                <p className="text-sm text-foreground">
                  {finding.confidence ? (
                    <span className="capitalize">{String(finding.confidence).replace(/_/g, ' ')}</span>
                  ) : (
                    'Not stated by the scanner'
                  )}
                </p>
                {CONFIDENCE_NOTES[String(finding.confidence || '').toLowerCase()] && (
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {CONFIDENCE_NOTES[String(finding.confidence).toLowerCase()]}
                  </p>
                )}
              </Field>
              <Field label="Audit run">
                {scan ? (
                  <Link
                    to={`/app/audits/runs/${scan.id}`}
                    className="text-sm font-medium text-primary transition-colors duration-150 ease-smooth hover:text-primary-hover"
                  >
                    This audit
                    <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                      {formatDate(scan.created_at)}
                    </span>
                  </Link>
                ) : (
                  <Dash />
                )}
              </Field>
              <Field label="Project">{project?.name || <Dash />}</Field>
            </dl>

            {scan && (
              <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
                {scan.tool_runs?.length
                  ? `The finding does not name its own scanner. This scan ran ${scan.tool_runs
                      .map((run) => run.tool_name)
                      .join(', ')} — one of those produced the rule match above.`
                  : 'This scan recorded no scanner runs.'}
              </p>
            )}
          </Panel>

          {(finding.ai_explanation?.intel || finding.ai_explanation?.dep) && (
            <ThreatIntelCard
              intel={finding.ai_explanation?.intel}
              dep={finding.ai_explanation?.dep}
            />
          )}

          <Panel
            title="Potential impact"
            description="Inference from the rule, in the scanner's words — not an observation of this system being exploited."
          >
            {finding.impact ? (
              <p className="text-sm leading-relaxed text-foreground">{finding.impact}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                The scanner attached no impact description to this rule. Read the evidence above and
                judge the impact in context.
              </p>
            )}
          </Panel>

          <Panel
            title="Remediation"
            description="Guidance from the scanner rule. Nothing here is applied to your code automatically."
          >
            {finding.remediation ? (
              <p className="text-sm leading-relaxed text-foreground">{finding.remediation}</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                No remediation text came with this rule. The rule id above is the starting point for
                looking one up.
              </p>
            )}
            <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
              After changing the code, audit the project again. A fixed status here records a human
              decision; only a later audit can show the pattern is gone.
            </p>
          </Panel>

          {finding.suggestion?.patch && (
            <Panel
              title="Suggested edit"
              description="The fix the agent wrote for these lines, verified against the archived copy of the file."
              actions={<AILabelled>AI output</AILabelled>}
            >
              <SuggestionDiff suggestion={finding.suggestion} />
            </Panel>
          )}

          {aiOutput && (
            <Panel
              className="border-ai/30"
              title="AI suggestion"
              description={
                // A failover has to be visible here too: this panel would
                // otherwise credit the workspace's own selection with the answer.
                aiOutput.fallback
                  ? `${aiOutput.reviewer || 'A different reviewer'} replied; the reviewer this workspace selected did not answer in time. Review the limitations before acting on it.`
                  : `Generated by ${aiOutput.reviewer || 'the configured reviewer'}. Review the limitations before acting on it.`
              }
              actions={<AILabelled>AI output</AILabelled>}
            >
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-foreground">
                  {aiOutput.summary || 'No summary returned.'}
                </p>

                <dl className="space-y-4">
                  {aiOutput.impact && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Impact, as the model inferred it
                      </dt>
                      <dd className="mt-1 text-sm leading-relaxed text-foreground">
                        {aiOutput.impact}
                      </dd>
                    </div>
                  )}

                  {Array.isArray(aiOutput.remediation_steps) && aiOutput.remediation_steps.length > 0 && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Suggested steps
                      </dt>
                      <dd>
                        <ol className="mt-1.5 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-foreground">
                          {aiOutput.remediation_steps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ol>
                      </dd>
                    </div>
                  )}

                  {Array.isArray(aiOutput.verification_steps) && aiOutput.verification_steps.length > 0 && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        How to verify
                      </dt>
                      <dd>
                        <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
                          {aiOutput.verification_steps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  )}

                  {Array.isArray(aiOutput.evidence_refs) && aiOutput.evidence_refs.length > 0 && (
                    <div>
                      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Evidence the model cited
                      </dt>
                      <dd className="mt-1.5 flex flex-wrap gap-1.5">
                        {aiOutput.evidence_refs.map((ref, i) => (
                          <InlineCode key={i}>{ref}</InlineCode>
                        ))}
                      </dd>
                    </div>
                  )}

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Model’s stated confidence">
                      <p className="text-sm text-foreground">
                        {aiOutput.confidence ? (
                          <span className="capitalize">{String(aiOutput.confidence).replace(/_/g, ' ')}</span>
                        ) : (
                          'Not stated'
                        )}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        A level the model was asked to pick, not a calibrated probability.
                      </p>
                    </Field>
                    {aiOutput.generated_at && (
                      <Field label="Generated">
                        <p className="text-sm text-foreground">{formatDate(aiOutput.generated_at)}</p>
                      </Field>
                    )}
                  </div>
                </dl>

                {aiOutput.limitations && (
                  <div className="rounded-lg border border-border bg-muted/50 p-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Limitations
                    </p>
                    <p className="mt-1 text-sm leading-relaxed text-foreground">
                      {aiOutput.limitations}
                    </p>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {!aiOutput && (
            <Panel
              title="AI explanation"
              description="Optional. It reads the excerpt above and writes a suggestion — it never changes the finding or your code."
            >
              {explaining ? (
                <p className="text-sm text-muted-foreground" role="status">
                  Generating the suggestion…
                </p>
              ) : (
                <Button variant="outline" onClick={handleExplain}>
                  <Bot data-icon="inline-start" />
                  Explain with AI
                </Button>
              )}
              {explainError && (
                <p className="mt-3 text-sm text-destructive" role="alert">
                  {explainError}
                </p>
              )}
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Deterministic scanner output above remains the record of what was detected.
              </p>
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel title="Triage" description="Record a decision and the reason behind it.">
            <div className="space-y-4">
              <div>
                <Label htmlFor="triage-note" className="text-foreground">
                  Triage note
                </Label>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Required for false positive and accepted risk.
                </p>
                <Textarea
                  id="triage-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Why this decision, and who made it…"
                  rows={4}
                  maxLength={4000}
                  disabled={saving !== null}
                />
              </div>

              <div className="space-y-2" aria-label="Triage actions">
                <TriageButton
                  icon={ShieldCheck}
                  label="Mark fixed"
                  busy={saving === 'fixed'}
                  disabled={saving !== null}
                  active={finding.status === 'fixed'}
                  onClick={() => requestTriage('fixed')}
                />
                <TriageButton
                  label="False positive"
                  busy={saving === 'false_positive'}
                  disabled={saving !== null}
                  active={finding.status === 'false_positive'}
                  onClick={() => requestTriage('false_positive')}
                />
                <TriageButton
                  label="Accept risk"
                  busy={saving === 'accepted_risk'}
                  disabled={saving !== null}
                  active={finding.status === 'accepted_risk'}
                  onClick={() => requestTriage('accepted_risk')}
                />
                {finding.status !== 'open' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    block
                    disabled={saving !== null}
                    onClick={() => requestTriage('open')}
                  >
                    {saving === 'open' ? 'Reopening…' : 'Set back to open'}
                  </Button>
                )}
              </div>

              <div className="border-t border-border pt-3 text-xs text-muted-foreground">
                {finding.triaged_at ? (
                  <p>
                    Last triaged {formatDate(finding.triaged_at)} ·{' '}
                    <Link
                      to={historyHref}
                      className="text-primary transition-colors duration-150 ease-smooth hover:text-primary-hover"
                    >
                      See audit trail
                    </Link>
                  </p>
                ) : (
                  <p>No triage decision recorded yet.</p>
                )}
              </div>
            </div>
          </Panel>

          <Panel title="Status meaning" flush>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>What it claims</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {FINDING_STATUSES.map((value) => (
                  <TableRow key={value} className={cn(value === finding.status && 'bg-muted/60')}>
                    <TableCell>
                      <FindingStatusBadge status={value} />
                    </TableCell>
                    <TableCell className="whitespace-normal text-xs leading-relaxed text-muted-foreground">
                      {STATUS_MEANINGS[value]}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>

          <Panel title="Reading this page">
            <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">Observed:</span> the excerpt and the
                scanner message are what the tool saw in the archive.
              </li>
              <li>
                <span className="font-medium text-foreground">Inferred:</span> impact and remediation
                come from the rule description, not from testing your system.
              </li>
              <li>
                No scan proves code is secure — it only shows what these scanners looked for.
              </li>
            </ul>
          </Panel>
        </div>
      </div>

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending ? CONFIRMATIONS[pending].title : ''}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending ? CONFIRMATIONS[pending].body : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant={pending === 'accepted_risk' ? 'destructive' : 'default'}
              disabled={saving !== null}
              onClick={(event) => {
                event.preventDefault()
                if (pending) applyTriage(pending)
              }}
            >
              {saving ? 'Saving…' : pending ? CONFIRMATIONS[pending].action : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageStack>
  )
}

const STATUS_MEANINGS = {
  open: 'Not yet reviewed. Still counted against the project.',
  fixed: 'A reviewer believes the code no longer has the issue. A new audit confirms it.',
  false_positive: 'The pattern matched, but the reviewer judged it not a real problem here.',
  accepted_risk: 'A real issue the team has chosen not to fix, with the reason on record.',
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  )
}

function Dash() {
  return <span className="text-sm text-muted-foreground">Not reported</span>
}

function TriageButton({ icon: Icon, label, active, busy, disabled, onClick }) {
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      block justify-start
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
    >
      {busy ? (
        <>
          <Save data-icon="inline-start" />
          Saving…
        </>
      ) : (
        <>
          {Icon && <Icon data-icon="inline-start" />}
          {active ? `${label} — current` : label}
        </>
      )}
    </Button>
  )
}
