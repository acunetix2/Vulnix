import { useEffect, useMemo, useState } from 'react'
import { History } from 'lucide-react'
import { api } from '../../../services/api'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../ui/table'
import { SettingsPanel as Panel } from './SettingsPanel'
import { EmptyState, ErrorState, TableSkeleton } from '../../EmptyState'
import { cn, formatDate } from '../../../lib/utils'

const PAGE_SIZE = 10

// The groups this service writes events for. A chip is only offered once an
// event of that kind has been seen, so the row never fills with dead filters.
const GROUP_LABELS = {
  ai: 'AI review',
  finding: 'Findings',
  integration: 'Connections',
  project: 'Projects',
  report: 'Reports',
  scan: 'Audits',
  upload: 'Uploads',
  webhook: 'Webhooks',
  workspace: 'Workspace',
}

const groupOf = (action) => String(action || '').split('.')[0]
const VERBS = {
  created: 'created',
  archived: 'archived',
  updated: 'updated',
  started: 'started',
  completed: 'completed',
  completed_with_errors: 'completed with warnings',
  failed: 'failed',
  cancelled: 'cancelled',
  triaged: 'triaged',
  member_added: 'added a member',
  member_removed: 'removed a member',
  member_role_changed: 'changed a member role',
  connected: 'connected',
  disconnected: 'disconnected',
  model_selected: 'selected a model',
  reviewer_selected: 'selected a reviewer',
  exported: 'exported',
  generated: 'generated',
}

const PROVIDERS = { github: 'GitHub', slack: 'Slack', jira: 'Jira' }

// The Person column already names who did it, so the Activity column is only
// ever the verb phrase - "Started an audit", not "Zorora audit created", which
// reads as a thing called Zorora audit having done a creating. Every action the
// service writes is listed; anything unmapped falls back to verb plus resource.
const ACTIVITIES = {
  'ai.model_selected': 'Chose a reviewer',
  'finding.explained': 'Asked for a finding to be explained',
  'finding.triaged': 'Triaged a finding',
  'integration.connected': 'Connected an app',
  'integration.deleted': 'Removed an integration',
  'integration.disconnected': 'Disconnected an app',
  'integration.redelivered': 'Sent a delivery again',
  'integration.tested': 'Tested an integration',
  'integration.updated': 'Changed an integration',
  'project.created': 'Created a project',
  'project.deleted': 'Deleted a project',
  'project.updated': 'Changed a project',
  'report.exported': 'Exported a report',
  'report.shared': 'Shared a report',
  'scan.cancelled': 'Stopped an audit',
  'scan.completed': 'An audit finished',
  'scan.created': 'Started an audit',
  'scan.started': 'An audit began running',
  'upload.created': 'Uploaded code to audit',
  'upload.deleted': 'Deleted an upload',
  'webhook.created': 'Added a webhook',
  'webhook.deleted': 'Deleted a webhook',
  'webhook.secret_rotated': 'Rotated a webhook signing key',
  'webhook.tested': 'Tested a webhook',
  'webhook.updated': 'Changed a webhook',
  'workspace.created': 'Created this workspace',
  'workspace.member_added': 'Added a member',
  'workspace.member_removed': 'Removed a member',
  'workspace.member_role_changed': "Changed a member's role",
  'workspace.updated': 'Changed workspace settings',
}

const humanize = (value) =>
  String(value || '')
    .split(/[._]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

const capitalize = (value) => value.charAt(0).toUpperCase() + value.slice(1)

function activityOf(event) {
  const known = ACTIVITIES[event.action]
  if (known) return known
  const [, ...parts] = String(event.action || '').split('.')
  const verbKey = parts.join('_')
  const verb = VERBS[verbKey] || humanize(verbKey).toLowerCase()
  return capitalize(`${verb} ${humanize(event.resource_type).toLowerCase()}`)
}

function formatBytes(value) {
  const size = Number(value)
  if (!Number.isFinite(size) || size <= 0) return null
  if (size < 1024) return `${size} B`
  const units = ['KB', 'MB', 'GB']
  let scaled = size / 1024
  let unit = 0
  while (scaled >= 1024 && unit < units.length - 1) {
    scaled /= 1024
    unit += 1
  }
  return `${scaled >= 10 ? Math.round(scaled) : scaled.toFixed(1)} ${units[unit]}`
}

const joinParts = (parts) => parts.filter(Boolean).join(' · ') || null

/**
 * What the action happened to, and the one line of detail that makes the row
 * answer a question rather than restate it: which file and how big, which
 * reviewer, which member and as what, which app.
 */
function itemOf(event) {
  const meta = event.metadata || {}
  const named =
    event.resource_label || meta.name || meta.provider || meta.reviewer || humanize(event.resource_type)

  if (event.action === 'upload.created') {
    return {
      primary: named,
      detail: joinParts([
        formatBytes(meta.size_bytes),
        meta.source === 'github' ? 'from a GitHub repository' : 'uploaded as a ZIP',
      ]),
    }
  }
  if (event.action === 'ai.model_selected') {
    return { primary: meta.reviewer || named, detail: 'Reads the next audits' }
  }
  if (event.action === 'scan.completed') {
    const findings = Number(meta.findings)
    return {
      primary: named,
      detail: Number.isFinite(findings) ? `${findings} finding${findings === 1 ? '' : 's'}` : null,
    }
  }
  if (event.action === 'finding.triaged') {
    return { primary: named, detail: meta.status ? `Set to ${humanize(meta.status)}` : null }
  }
  if (event.action === 'report.exported') {
    return { primary: named, detail: meta.format ? `${String(meta.format).toUpperCase()} file` : null }
  }
  if (event.action === 'integration.tested' || event.action === 'webhook.tested') {
    return {
      primary: PROVIDERS[meta.provider] || meta.host || named,
      detail: meta.ok === undefined ? null : meta.ok ? 'Answered' : 'Did not answer',
    }
  }
  if (groupOf(event.action) === 'integration') {
    return { primary: PROVIDERS[meta.provider] || named, detail: meta.scope || null }
  }
  if (groupOf(event.action) === 'webhook') {
    return {
      primary: meta.host || named,
      detail: Array.isArray(meta.events) && meta.events.length ? `${meta.events.length} events` : null,
    }
  }
  return { primary: named, detail: null }
}

function roleChangeOf(event) {
  if (!event.metadata?.role) return '—'
  const role = humanize(event.metadata.role)
  return event.action.endsWith('member_added') ? `${role} access granted` : `Role set to ${role}`
}

function outcomeOf(event) {
  const action = String(event.action || '')
  // A test that came back is not a test that passed: the integration and webhook
  // test events carry the answer itself, and it would contradict the row's own
  // detail line to call a "did not answer" a success.
  if (event.metadata?.ok === false) return 'Failed'
  // An audit that finished is not necessarily one that came out clean, and the
  // action name cannot tell them apart - the pipeline records which it was.
  if (action === 'scan.completed') {
    const ended = event.metadata?.status
    if (ended === 'failed') return 'Failed'
    if (ended === 'cancelled') return 'Cancelled'
    if (ended === 'completed_with_errors') return 'Needs review'
    return 'Success'
  }
  if (action.endsWith('.failed')) return 'Failed'
  if (action.endsWith('.cancelled')) return 'Cancelled'
  if (action.endsWith('.queued') || action.endsWith('.started')) return 'In progress'
  if (action.endsWith('.completed_with_errors')) return 'Needs review'
  return 'Success'
}

function outcomeTone(outcome) {
  if (outcome === 'Failed' || outcome === 'Cancelled') {
    return 'bg-destructive/10 text-destructive'
  }
  if (outcome === 'Needs review') return 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
  if (outcome === 'In progress') return 'bg-muted text-muted-foreground'
  return 'bg-primary-subtle text-primary'
}

function formatTimestamp(value) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function boundsFor(period, fromDate, toDate) {
  const fromAt = fromDate ? new Date(`${fromDate}T00:00:00`).toISOString() : null
  const toAt = toDate ? new Date(`${toDate}T23:59:59.999`).toISOString() : null
  if (period === 'custom') return { fromAt, toAt }
  if (period === 'all') return { fromAt: null, toAt: null }
  const hours = period === '24h' ? 24 : period === '7d' ? 24 * 7 : 24 * 30
  return { fromAt: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(), toAt: null }
}

function ActorLabel({ label }) {
  if (!label || label === 'Unclaimed account') {
    return <span className="text-muted-foreground">{label || 'System'}</span>
  }
  return <span className="font-medium text-foreground">@{label}</span>
}

/**
 * The server-side trail for this workspace, newest first. Actors appear as the
 * handle on their account, never as an identifier, and a filter is applied by
 * the API rather than locally, so paging stays correct across the whole trail.
 */
export function AuditPanel({ workspaceId }) {
  const [events, setEvents] = useState([])
  const [nextCursor, setNextCursor] = useState(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [pageCursors, setPageCursors] = useState([null])
  const [group, setGroup] = useState(null)
  const [seen, setSeen] = useState([])
  const [period, setPeriod] = useState('7d')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [denied, setDenied] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const { fromAt, toAt } = useMemo(
    () => boundsFor(period, fromDate, toDate),
    [period, fromDate, toDate]
  )
  const invalidRange = Boolean(fromDate && toDate && fromDate > toDate)

  useEffect(() => {
    let cancelled = false
    const cursor = pageCursors[pageIndex] || null

    async function run() {
      if (invalidRange) {
        setEvents([])
        setNextCursor(null)
        setLoading(false)
        return
      }
      if (!cancelled) {
        setLoading(true)
        setError(null)
        setDenied(false)
      }
      try {
        const page = await api.getAuditEvents(workspaceId, {
          limit: PAGE_SIZE,
          ...(cursor ? { cursor } : {}),
          ...(group ? { action: group } : {}),
          ...(!invalidRange && fromAt ? { from_at: fromAt } : {}),
          ...(!invalidRange && toAt ? { to_at: toAt } : {}),
        })
        if (cancelled) return
        const items = page.items || []
        setEvents(items)
        setNextCursor(page.next_cursor || null)
        if (!group) {
          setSeen((prev) => [...new Set([...prev, ...items.map((e) => groupOf(e.action))])].sort())
        }
      } catch (err) {
        if (cancelled) return
        if (err.status === 403 || err.status === 404) setDenied(true)
        else setError(err.message || 'We could not load the audit log.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [workspaceId, attempt, group, pageCursors, pageIndex, fromAt, toAt, invalidRange])

  function goToNextPage() {
    if (!nextCursor) return
    setPageCursors((current) => {
      const next = current.slice(0, pageIndex + 1)
      next[pageIndex + 1] = nextCursor
      return next
    })
    setPageIndex((current) => current + 1)
  }

  function changeGroup(nextGroup) {
    setGroup(nextGroup)
    setPageIndex(0)
    setPageCursors([null])
  }

  function resetPagination() {
    setPageIndex(0)
    setPageCursors([null])
  }

  function changePeriod(next) {
    setPeriod(next)
    resetPagination()
  }

  const chips = [{ id: null, label: 'All events' }].concat(
    seen.filter((name) => name !== group).map((name) => ({
      id: name,
      label: GROUP_LABELS[name] || name,
    }))
  )
  if (group && !seen.includes(group)) chips.push({ id: group, label: GROUP_LABELS[group] || group })

  return (
    <Panel
      title="Audit log"
      description="A readable record of changes made in this workspace."
      flush
      footer={
        events.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Page {pageIndex + 1} · {events.length} of up to {PAGE_SIZE} events
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                disabled={loading || pageIndex === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={goToNextPage}
                disabled={loading || !nextCursor}
              >
                Next
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            No events loaded.
          </p>
        )
      }
    >
      <div className="space-y-3 border-b border-border px-4 py-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap items-center gap-1.5">
            {chips.map((chip) => {
              const active = chip.id === group
              return (
                <button
                  key={chip.id || 'all'}
                  type="button"
                  aria-pressed={active}
                  onClick={() => changeGroup(chip.id)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors duration-150 ease-smooth',
                    active
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-border-strong hover:text-foreground'
                  )}
                >
                  {chip.label}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="audit-period" className="text-xs font-medium text-muted-foreground">
              Time period
            </label>
            <Select value={period} onValueChange={changePeriod}>
              <SelectTrigger id="audit-period" size="sm" aria-label="Time period">
                <SelectValue>
                  {(value) => ({
                    '24h': 'Last 24 hours',
                    '7d': 'Last 7 days',
                    '30d': 'Last 30 days',
                    all: 'All time',
                    custom: 'Custom range',
                  })[value] || 'Time period'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24h">Last 24 hours</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {period === 'custom' && (
          <div className="flex flex-wrap items-end gap-3">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              From
              <Input
                type="date"
                value={fromDate}
                onChange={(event) => {
                  setFromDate(event.target.value)
                  resetPagination()
                }}
                className="h-8 w-40 text-xs"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Through
              <Input
                type="date"
                value={toDate}
                onChange={(event) => {
                  setToDate(event.target.value)
                  resetPagination()
                }}
                className="h-8 w-40 text-xs"
              />
            </label>
            {invalidRange && (
              <p className="pb-2 text-xs text-destructive" role="alert">
                Choose an end date on or after the start date.
              </p>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <TableSkeleton rows={7} columns={5} />
      ) : denied ? (
        <EmptyState
          icon={History}
          title="Audit log unavailable"
          description="This activity log is available to workspace admins."
          action={
            <Button variant="outline" size="sm" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          }
        />
      ) : error ? (
        <ErrorState
          title="We could not load the audit log"
          description={error}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      ) : events.length === 0 ? (
        <EmptyState
          icon={History}
          title={group ? 'Nothing of this kind recorded yet' : 'Nothing recorded yet'}
          description={
            group
              ? 'No event in this workspace carries that action.'
              : 'Creating projects, changing access, and running audits will appear here.'
          }
          action={
            group ? (
              <Button variant="outline" size="sm" onClick={() => setGroup(null)}>
                Show all events
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="border-b border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
            Activity from this workspace, newest first.
          </p>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[18%]">Person</TableHead>
                  <TableHead className="w-[29%]">Activity</TableHead>
                  <TableHead className="w-[23%]">Affected item</TableHead>
                  <TableHead className="w-[14%]">Outcome</TableHead>
                  <TableHead className="w-[16%]">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((event) => {
                  const item = itemOf(event)
                  const role = roleChangeOf(event)
                  return (
                    <TableRow key={event.id}>
                      <TableCell className="font-medium">
                        <ActorLabel label={event.actor_label} />
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-foreground">{activityOf(event)}</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        <span className="block truncate text-foreground" title={item.primary}>
                          {item.primary}
                        </span>
                        {(item.detail || role !== '—') && (
                          <span className="mt-0.5 block text-xs">{item.detail || role}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'rounded-full px-2 py-1 text-[10px] font-medium',
                            outcomeTone(outcomeOf(event))
                          )}
                        >
                          {outcomeOf(event)}
                        </span>
                      </TableCell>
                      <TableCell
                        className="whitespace-nowrap text-xs text-muted-foreground"
                        title={formatTimestamp(event.created_at)}
                      >
                        <span>{formatDate(event.created_at)}</span>
                        <span className="mt-0.5 block tabular-nums">
                          {new Intl.DateTimeFormat(undefined, {
                            hour: 'numeric',
                            minute: '2-digit',
                          }).format(new Date(event.created_at))}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </Panel>
  )
}
