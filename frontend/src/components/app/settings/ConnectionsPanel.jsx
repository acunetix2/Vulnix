import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { api } from '../../../services/api'
import { Button } from '../../ui/button'
import { SettingsPanel as Panel } from './SettingsPanel'
import { Pill } from '../../app/SeverityBadge'
import { EmptyState, ErrorState, TableSkeleton } from '../../EmptyState'
import { formatDate } from '../../../lib/utils'

/**
 * Connection state, read from the server. The approve / revoke controls live on
 * each provider page, so this row only answers "is it connected, and as what".
 */
const PROVIDERS = [
  { id: 'github', name: 'GitHub', to: '/app/integrations/github', note: 'Where the code comes from.' },
  { id: 'slack', name: 'Slack', to: '/app/integrations/slack', note: 'Where findings are announced.' },
  { id: 'jira', name: 'Jira', to: '/app/integrations/jira', note: 'Where triage becomes a ticket.' },
]

export function ConnectionsPanel({ workspaceId }) {
  const [rows, setRows] = useState(null)
  const [webhooks, setWebhooks] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function run() {
      setError(null)
      try {
        const [links, hooks] = await Promise.all([
          api.getConnections(workspaceId),
          api.getWebhooks(workspaceId).catch(() => []),
        ])
        if (cancelled) return
        const byProvider = {}
        for (const row of links || []) byProvider[row.provider] = row
        setRows(byProvider)
        setWebhooks(hooks || [])
      } catch (err) {
        if (!cancelled) setError(err.message || 'Connection state could not be read.')
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [workspaceId, attempt])

  return (
    <div className="space-y-4">
      <Panel
        title="Connected accounts"
        description="Approved in the provider’s own window; tokens stay on the server."
        flush
      >
        {error ? (
          <ErrorState
            title="We couldn’t read these connections"
            description={error}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        ) : !rows ? (
          <TableSkeleton rows={3} columns={2} />
        ) : (
          <ul className="divide-y divide-border">
            {PROVIDERS.map((provider) => {
              const row = rows[provider.id]
              const connected = Boolean(row?.connected)
              return (
                <li key={provider.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{provider.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {connected
                        ? `As ${row.account_label || 'an approved account'} · ${formatDate(row.connected_at)}`
                        : provider.note}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Pill tone={connected ? 'success' : 'neutral'}>
                      {connected ? 'Connected' : 'Not connected'}
                    </Pill>
                    <Button size="xs" variant="link" render={<Link to={provider.to} />}>
                      {connected ? 'Manage' : 'Connect'}
                      <ArrowRight data-icon="inline-end" />
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Panel
        title="Webhooks"
        description="Signed deliveries this workspace asks the server to make."
        actions={
          webhooks && (
            <span className="text-xs text-muted-foreground">
              {webhooks.filter((row) => row.enabled).length} of {webhooks.length} enabled
            </span>
          )
        }
      >
        {webhooks && webhooks.length === 0 ? (
          <EmptyState
            title="No endpoints yet"
            description="A webhook sends audit and triage events to an HTTPS URL you control."
            action={
              <Button variant="outline" size="sm" render={<Link to="/app/integrations/webhooks" />}>
                Add an endpoint
              </Button>
            }
          />
        ) : !webhooks ? (
          <TableSkeleton rows={2} columns={2} />
        ) : (
          <Button variant="outline" size="sm" render={<Link to="/app/integrations/webhooks" />}>
            Manage endpoints
            <ArrowRight data-icon="inline-end" />
          </Button>
        )}
      </Panel>
    </div>
  )
}
