import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Bot, History, ScanSearch, SquarePen } from 'lucide-react'
import { api } from '../services/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { Button } from '../components/ui/button'
import { PageStack } from '../components/app/Grids'
import { PageHeader } from '../components/app/PageHeader'
import { Panel } from '../components/app/Panel'
import {
  AILabelled,
  FindingStatusBadge,
  Pill,
  SeverityBadge,
} from '../components/app/SeverityBadge'
import { EmptyState, ErrorState, TableSkeleton } from '../components/EmptyState'
import { formatDate, formatRelativeTime } from '../lib/utils'

/**
 * There is no per-finding history endpoint. The only real trail is the workspace
 * audit log, which records `finding.triaged` and `finding.explained` events, plus
 * the timestamps stored on the finding itself. Both are combined here and every
 * entry says where it came from — this page never invents a timeline.
 */
const AUDIT_LIMIT = 50

function describeEvent(event) {
  const status = event.metadata?.status
  if (event.action === 'finding.triaged') {
    return {
      icon: SquarePen,
      title: 'Triage decision recorded',
      detail: status ? `Status set to ${String(status).replace(/_/g, ' ')}` : null,
      status: status || null,
    }
  }
  if (event.action === 'finding.explained') {
    return {
      icon: Bot,
      title: 'AI explanation generated',
      detail: 'A model was asked to explain this finding. The result lives on the finding itself.',
      ai: true,
    }
  }
  return {
    icon: History,
    title: String(event.action).replace(/[._]/g, ' '),
    detail: null,
  }
}

export function FindingHistory() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const backHref = `/app/audits/findings/${id}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`

  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()

  const [finding, setFinding] = useState(null)
  const [events, setEvents] = useState([])
  const [cursor, setCursor] = useState(null)
  const [state, setState] = useState({ loading: false, error: null, auditError: null })
  const [attempt, setAttempt] = useState(0)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      setState({ loading: true, error: null, auditError: null })
      try {
        const data = await api.getFinding(id)
        if (cancelled) return
        setFinding(data)
        setState({ loading: false, error: null, auditError: null })

        if (workspaceId) {
          try {
            const page = await api.getAuditEvents(workspaceId, { limit: AUDIT_LIMIT })
            if (cancelled) return
            setEvents((page.items || []).filter(matchesFinding))
            setCursor(page.next_cursor || null)
          } catch (err) {
            if (cancelled) return
            setEvents([])
            setCursor(null)
            setState((s) => ({
              ...s,
              auditError:
                err.status === 403
                  ? 'The workspace audit log is only visible to owners and admins. The timestamps on the finding itself are still shown.'
                  : err.message || 'The audit log could not be read.',
            }))
          }
        }
      } catch (err) {
        if (cancelled) return
        if (err.status === 404) setFinding(null)
        setState({
          loading: false,
          error: err.status === 404 ? null : err.message || 'Please try again.',
          auditError: null,
        })
      }
    }

    function matchesFinding(event) {
      return event.resource_type === 'finding' && event.resource_id === id
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id, workspaceId, attempt])

  async function loadMore() {
    if (!workspaceId || !cursor) return
    setLoadingMore(true)
    try {
      const page = await api.getAuditEvents(workspaceId, { limit: AUDIT_LIMIT, cursor })
      setEvents((prev) =>
        [...prev, ...(page.items || []).filter((e) => e.resource_type === 'finding' && e.resource_id === id)]
      )
      setCursor(page.next_cursor || null)
    } catch (err) {
      setState((s) => ({ ...s, auditError: err.message || 'The audit log could not be read.' }))
    } finally {
      setLoadingMore(false)
    }
  }

  const header = (
    <PageHeader
      title="Finding history"
      description={finding?.title || 'Every recorded action on this finding'}
      breadcrumb={[
        { label: 'Findings', to: '/app/audits/findings' },
        { label: 'Finding', to: backHref },
        { label: 'History' },
      ]}
      actions={
        <Button variant="outline" render={<Link to={backHref} />}>
          Back to finding
        </Button>
      }
      meta={
        finding && (
          <>
            <SeverityBadge severity={finding.severity} />
            <FindingStatusBadge status={finding.status} />
          </>
        )
      }
    />
  )

  if (wsLoading || state.loading) {
    return (
      <PageStack>
        {header}
        <Panel flush>
          <TableSkeleton rows={5} columns={3} />
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
            title={wsError ? 'We couldn’t load your workspace' : 'We couldn’t load this history'}
            description={wsError || state.error}
            onRetry={() => (wsError ? retryWorkspace() : setAttempt((a) => a + 1))}
          />
        </Panel>
      </PageStack>
    )
  }

  if (!finding) {
    return (
      <PageStack>
        {header}
        <Panel>
          <EmptyState
            icon={History}
            title="This finding no longer exists"
            description="Its history cannot be shown. It may have belonged to an audit that was deleted."
            action={<Button render={<Link to="/app/audits/findings" />}>Back to findings</Button>}
          />
        </Panel>
      </PageStack>
    )
  }

  const timeline = [
    {
      key: 'detected',
      at: finding.created_at,
      source: 'scan',
      icon: ScanSearch,
      title: 'Detected by the scanner',
      detail: finding.rule_id ? `Rule ${finding.rule_id}` : 'No rule id recorded',
    },
    ...events.map((event) => ({
      key: event.id,
      at: event.created_at,
      source: 'audit',
      actor: event.actor_label,
      ...describeEvent(event),
    })),
  ].sort((a, b) => new Date(b.at) - new Date(a.at))

  return (
    <PageStack>
      {header}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel
          className="lg:col-span-2"
          title="Recorded actions"
          description={`Newest first · ${events.length} audit ${events.length === 1 ? 'entry' : 'entries'} for this finding`}
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-xl text-xs leading-relaxed text-muted-foreground">
                The workspace audit log records triage decisions and AI explanation requests only.
                Comments, assignments and severity changes have no backing endpoint, so they cannot
                be shown.
                {state.auditError && <span className="text-destructive"> {state.auditError}</span>}
              </p>
              {cursor && (
                <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading…' : 'Load older events'}
                </Button>
              )}
            </div>
          }
        >
          <ol className="relative space-y-6 border-l border-border pl-5">
            {timeline.map((entry) => (
              <li key={entry.key} className="console-enter relative">
                <span
                  className="absolute -left-[26px] top-1 flex size-4 items-center justify-center rounded-full bg-muted text-muted-foreground ring-1 ring-border"
                  aria-hidden
                >
                  <entry.icon className="size-2.5" />
                </span>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{entry.title}</p>
                  <time
                    className="text-xs text-muted-foreground"
                    dateTime={entry.at ? new Date(entry.at).toISOString() : undefined}
                  >
                    {formatDate(entry.at)}
                  </time>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Pill tone={entry.source === 'audit' ? 'neutral' : 'info'}>
                    {entry.source === 'audit' ? 'workspace audit' : 'finding record'}
                  </Pill>
                  {entry.status && <FindingStatusBadge status={entry.status} />}
                  {entry.ai && <AILabelled>AI action</AILabelled>}
                  {entry.actor && <span className="text-xs text-muted-foreground">by {entry.actor}</span>}
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(entry.at)}
                  </span>
                </div>
                {entry.detail && (
                  <p className="mt-1 max-w-prose break-words text-sm leading-relaxed text-muted-foreground">
                    {entry.detail}
                  </p>
                )}
              </li>
            ))}
          </ol>
        </Panel>

        <Panel title="Finding record" description="Values stored on the finding itself">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Current status
              </dt>
              <dd className="mt-1">
                <FindingStatusBadge status={finding.status} />
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Triage note
              </dt>
              <dd className="mt-1 leading-relaxed text-foreground">
                {finding.triage_note || 'No note recorded.'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Last triaged
              </dt>
              <dd className="mt-1 text-foreground">
                {finding.triaged_at ? formatDate(finding.triaged_at) : 'Never'}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Audit
              </dt>
              <dd className="mt-1">
                <Link
                  to={`/app/audits/runs/${finding.scan_id}`}
                  className="text-primary transition-colors duration-150 ease-smooth hover:text-primary-hover"
                >
                  Open the audit that found this
                </Link>
              </dd>
            </div>
          </dl>

          <Button variant="outline" size="sm" mt-4 block render={<Link to={backHref} />}>
            Back to finding
          </Button>
        </Panel>
      </div>
    </PageStack>
  )
}
