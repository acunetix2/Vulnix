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

const humanize = (value) =>
  String(value || '')
    .split(/[._]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')

function activityOf(event) {
  const [, ...parts] = String(event.action || '').split('.')
  const verbKey = parts.join('_')
  const verb = VERBS[verbKey] || humanize(verbKey).toLowerCase()
  const subject =
    event.resource_label ||
    event.metadata?.name ||
    event.metadata?.provider ||
    event.metadata?.reviewer ||
    humanize(event.resource_type)
  return `${subject} ${verb}`
}

function roleChangeOf(event) {
  if (!event.metadata?.role) return '—'
  const role = humanize(event.metadata.role)
  return event.action.endsWith('member_added') ? `${role} access granted` : `Role set to ${role}`
}

function outcomeOf(event) {
  const action = String(event.action || '')
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
                {events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="font-medium">
                      <ActorLabel label={event.actor_label} />
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-foreground">{activityOf(event)}</span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {event.resource_label ||
                        event.metadata?.name ||
                        event.metadata?.provider ||
                        event.metadata?.reviewer ||
                        humanize(event.resource_type)}
                      {roleChangeOf(event) !== '—' && (
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {roleChangeOf(event)}
                        </span>
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
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </Panel>
  )
}
