import { useEffect, useState } from 'react'
import { Bell, ExternalLink, History } from 'lucide-react'
import { Link } from 'react-router-dom'
import { api } from '../../services/api'
import { formatRelativeTime } from '../../lib/utils'
import { Button } from '../ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'

const RESOURCE_ROUTES = {
  project: (id) => `/app/projects/${id}`,
  scan: (id) => `/app/audits/runs/${id}`,
  finding: (id) => `/app/audits/findings/${id}`,
  workspace: () => '/app/settings/workspace',
}

function activityHref(event) {
  if (event.resource_type === 'workspace') return RESOURCE_ROUTES.workspace()
  return event.resource_type && event.resource_id
    ? RESOURCE_ROUTES[event.resource_type]?.(event.resource_id)
    : undefined
}

function activityTitle(action) {
  return String(action || 'Workspace activity').replace(/\./g, ' ')
}

export function NotificationDropdown() {
  const [open, setOpen] = useState(false)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!open) return undefined

    let cancelled = false
    async function loadRecentActivity() {
      setLoading(true)
      setError('')
      try {
        const workspaces = await api.getWorkspaces()
        if (!workspaces?.length) {
          if (!cancelled) setEvents([])
          return
        }
        const selectedId = localStorage.getItem('current_workspace')
        const workspace = workspaces.find(({ id }) => id === selectedId) || workspaces[0]
        const page = await api.getAuditEvents(workspace.id, { limit: 5 })
        if (!cancelled) setEvents(page.items || [])
      } catch (err) {
        if (!cancelled) setError(err.message || 'Recent activity could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadRecentActivity()
    return () => {
      cancelled = true
    }
  }, [open, attempt])

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="relative text-muted-foreground"
            aria-label="Open notifications"
            title="Notifications"
          />
        }
      >
        <Bell />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[min(22rem,calc(100vw-2rem))] p-0">
        <DropdownMenuLabel className="px-4 py-3">
          <span className="block text-sm font-semibold text-foreground">Recent activity</span>
          <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
            Latest changes in your workspace
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-0" />

        {loading ? (
          <p className="px-4 py-5 text-sm text-muted-foreground" role="status">
            Loading recent activity…
          </p>
        ) : error ? (
          <div className="px-4 py-4">
            <p className="text-sm text-muted-foreground">{error}</p>
            <button
              type="button"
              className="mt-2 text-sm font-medium text-primary hover:underline"
              onClick={() => setAttempt((value) => value + 1)}
            >
              Try again
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="flex items-center gap-3 px-4 py-5">
            <History className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <p className="text-sm text-muted-foreground">No recent workspace activity.</p>
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto py-1">
            {events.map((event) => {
              const to = activityHref(event)
              const description = [
                event.resource_type,
                event.metadata?.name,
              ].filter(Boolean).join(' · ')
              const content = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">
                      {activityTitle(event.action)}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {description || 'Workspace'}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatRelativeTime(event.created_at)}
                  </span>
                </>
              )

              return (
                <div key={event.id} className="px-1">
                  {to ? (
                    <DropdownMenuItem
                      className="min-h-14 items-start gap-3 px-3 py-2.5"
                      render={<Link to={to} />}
                    >
                      {content}
                    </DropdownMenuItem>
                  ) : (
                    <div className="flex min-h-14 items-start gap-3 rounded-md px-3 py-2.5">
                      {content}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <DropdownMenuSeparator className="my-0" />
        <DropdownMenuItem
          className="min-h-11 justify-between px-4 py-2.5 font-medium text-primary focus:text-primary"
          render={<Link to="/app/notifications" />}
        >
          View all notifications
          <ExternalLink className="size-4" aria-hidden />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
