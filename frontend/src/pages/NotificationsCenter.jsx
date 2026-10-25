import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, CircleSlash, History, Settings2 } from 'lucide-react'
import { api } from '../services/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { Button } from '../components/ui/button'
import { PageStack } from '../components/app/Grids'
import { PageHeader } from '../components/app/PageHeader'
import { Panel } from '../components/app/Panel'
import { EmptyState, ErrorState, NotificationsPageSkeleton, TableSkeleton } from '../components/EmptyState'
import { formatRelativeTime } from '../lib/utils'

const PREVIEW_SIZE = 5

/**
 * There is no notification router, table or delivery job behind this screen —
 * only the workspace audit trail. So the page says so, and offers the real
 * trail as "workspace activity" rather than inventing unread badges.
 */
const RESOURCE_ROUTES = {
  project: (id) => `/app/projects/${id}`,
  scan: (id) => `/app/audits/runs/${id}`,
  finding: (id) => `/app/audits/findings/${id}`,
  workspace: () => '/app/settings/workspace',
}

function hrefFor(event) {
  if (!event.resource_type) return null
  if (event.resource_type === 'workspace') return RESOURCE_ROUTES.workspace()
  return event.resource_id ? RESOURCE_ROUTES[event.resource_type]?.(event.resource_id) ?? null : null
}

function describe(action) {
  return String(action || 'event').replace(/\./g, ' ')
}

export function NotificationsCenter() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [restricted, setRestricted] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!workspaceId) return undefined
    let cancelled = false

    async function load() {
      if (!cancelled) {
        setLoading(true)
        setError(null)
        setRestricted(false)
      }
      try {
        const page = await api.getAuditEvents(workspaceId, { limit: PREVIEW_SIZE })
        if (cancelled) return
        setEvents(page.items || [])
      } catch (err) {
        if (cancelled) return
        if (err.status === 403 || err.status === 404) setRestricted(true)
        else setError(err.message || 'We couldn’t load workspace activity.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId, attempt])

  const header = (
    <PageHeader
      title="Notifications"
      description="Workspace activity and recent changes."
      actions={
        <Button variant="outline" render={<Link to="/app/settings/workspace" />}>
          <Settings2 data-icon="inline-start" />
          Workspace settings
        </Button>
      }
    />
  )

  if (wsLoading || loading) {
    return <NotificationsPageSkeleton />
  }

  if (wsError || !workspaceId) {
    return (
      <PageStack>
        {header}
        <Panel>
          <ErrorState
            title="We couldn’t load your workspace"
            description={wsError || 'No workspace is selected for this session.'}
            onRetry={retryWorkspace}
          />
        </Panel>
      </PageStack>
    )
  }

  return (
    <PageStack>
      {header}

      <Panel
        title="Workspace activity"
        description="Recent events in this workspace."
        flush
      >
        {restricted ? (
          <EmptyState
            icon={CircleSlash}
            title="Activity is restricted"
            description="The audit trail is available to workspace admins and owners. This console can’t read your role yet, so it can’t tell you which one you hold."
            action={
              <Button variant="outline" size="sm" onClick={() => setAttempt((a) => a + 1)}>
                Try again
              </Button>
            }
          />
        ) : error ? (
          <ErrorState
            title="We couldn’t load workspace activity"
            description={error}
            onRetry={() => setAttempt((a) => a + 1)}
          />
        ) : events.length === 0 ? (
          <EmptyState
            icon={History}
            title="Nothing has happened yet"
            description="As soon as a project, upload or audit is created in this workspace it shows up here."
            action={
              <Button size="sm" render={<Link to="/app/projects" />}>
                Go to projects
                <ArrowRight data-icon="inline-end" />
              </Button>
            }
          />
        ) : (
          <>
            <ul className="divide-y divide-border">
              {events.map((event) => {
                const to = hrefFor(event)
                const inner = (
                  <>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-foreground">{describe(event.action)}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {event.resource_type || 'workspace'}
                        {event.metadata?.name ? ` · ${event.metadata.name}` : ''}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                      {formatRelativeTime(event.created_at)}
                    </span>
                  </>
                )

                return (
                  <li key={event.id}>
                    {to ? (
                      <Link
                        to={to}
                        className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60"
                      >
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex items-center gap-3 px-4 py-2.5">{inner}</div>
                    )}
                  </li>
                )
              })}
            </ul>
            <div className="border-t border-border px-4 py-3">
              <Button size="sm" variant="link" render={<Link to="/app/settings/audit" />}>
                See the full activity trail
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
          </>
        )}
      </Panel>
    </PageStack>
  )
}
