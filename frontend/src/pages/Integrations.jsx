import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  BookOpen,
  CircleAlert,
  Compass,
  Webhook,
} from 'lucide-react'
import { api } from '../services/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { GitHub, Jira, PagerDuty, Slack } from '../components/icons'
import { Button } from '../components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { PageHeader } from '../components/app/PageHeader'
import { Panel } from '../components/app/Panel'
import { CardGrid } from '../components/app/Grids'
import { Toolbar } from '../components/app/Toolbar'
import { Pill } from '../components/app/SeverityBadge'
import { integrationErrorText } from '../lib/integrations'
import { EmptyState, ErrorState, IntegrationsPageSkeleton, LoadingState } from '../components/EmptyState'
import { cn } from '../lib/utils'

/**
 * The catalog. `kind` says how the live state is read: a provider config row,
 * the webhook table, or nothing at all because no server code exists yet.
 */
const INTEGRATIONS = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Approve Vulnix in Slack’s own window. One click, nothing to paste.',
    Icon: Slack,
    kind: 'connection',
    provider: 'slack',
    to: '/app/integrations/slack',
    features: ['Server-side approval', 'Encrypted token', 'Revocable here'],
  },
  {
    id: 'jira',
    name: 'Jira',
    description: 'Approve Vulnix in Atlassian’s own window. One click, nothing to paste.',
    Icon: Jira,
    kind: 'connection',
    provider: 'jira',
    to: '/app/integrations/jira',
    features: ['Server-side approval', 'Encrypted token', 'Revocable here'],
  },
  {
    id: 'webhooks',
    name: 'Webhooks',
    description: 'Send signed audit and triage events to any HTTPS endpoint you control.',
    Icon: Webhook,
    kind: 'webhooks',
    to: '/app/integrations/webhooks',
    features: ['HMAC-signed POSTs', 'Backoff retries', 'Dead-letter log'],
  },
  {
    id: 'github',
    name: 'GitHub',
    description:
      'The main way code gets in: approve Vulnix on GitHub, then pick a repository and branch when you start an audit.',
    Icon: GitHub,
    kind: 'connection',
    provider: 'github',
    to: '/app/integrations/github',
    features: ['Repository allowlist', 'Branch or tag', 'Archive intake'],
  },
  {
    id: 'pagerduty',
    name: 'PagerDuty',
    description: 'Nothing is implemented: no Events API v2 integration and no incident creation.',
    Icon: PagerDuty,
    kind: 'none',
    to: null,
    features: ['Critical alerts', 'Incident creation', 'Escalation policies'],
  },
]

const STATE_LABEL = {
  connected: 'Live',
  paused: 'Configured, paused',
  unconnected: 'Not connected',
  unavailable: 'Not implemented',
}

const STATE_TONES = {
  connected: 'success',
  paused: 'warning',
  unconnected: 'neutral',
  unavailable: 'neutral',
}

const STATE_FILTERS = [
  { value: 'all', label: 'All states' },
  { value: 'connected', label: STATE_LABEL.connected },
  { value: 'paused', label: STATE_LABEL.paused },
  { value: 'unconnected', label: STATE_LABEL.unconnected },
  { value: 'unavailable', label: STATE_LABEL.unavailable },
]

export function Integrations() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()
  const [state, setState] = useState({
    loading: false,
    error: null,
    connections: {},
    webhookCount: 0,
    webhookEnabled: 0,
    serverEnabled: null,
  })
  const [attempt, setAttempt] = useState(0)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false

    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const [hooks, links, status] = await Promise.all([
          api.getWebhooks(workspaceId).catch(() => []),
          api.getConnections(workspaceId).catch(() => []),
          api.getSystemStatus().catch(() => null),
        ])
        if (cancelled) return
        const connections = {}
        for (const row of links || []) connections[row.provider] = row
        const list = hooks || []
        setState({
          loading: false,
          error: null,
          connections,
          webhookCount: list.length,
          webhookEnabled: list.filter((row) => row.enabled).length,
          serverEnabled: status ? status.integrations === 'enabled' : null,
        })
      } catch (error) {
        if (cancelled) return
        setState((s) => ({ ...s, loading: false, error: integrationErrorText(error) }))
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId, attempt])

  const cards = useMemo(
    () =>
      INTEGRATIONS.map((integration) => {
        if (integration.kind === 'connection') {
          const row = state.connections[integration.provider]
          return {
            ...integration,
            live: Boolean(row?.connected),
            state: row?.connected ? 'connected' : 'unconnected',
            detail: row?.connected ? row.account_label || 'Connected' : 'No approval given yet',
          }
        }
        if (integration.kind === 'webhooks') {
          const count = state.webhookCount
          return {
            ...integration,
            live: state.webhookEnabled > 0,
            state:
              count === 0 ? 'unconnected' : state.webhookEnabled > 0 ? 'connected' : 'paused',
            detail:
              count === 0
                ? 'No endpoints registered'
                : `${count} endpoint${count === 1 ? '' : 's'}, ${state.webhookEnabled} enabled`,
          }
        }
        return { ...integration, live: false, state: 'unavailable', detail: 'No API behind this yet' }
      }),
    [state.connections, state.webhookCount, state.webhookEnabled]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cards.filter((integration) => {
      if (filter !== 'all' && integration.state !== filter) return false
      if (!q) return true
      return (
        integration.name.toLowerCase().includes(q) ||
        integration.description.toLowerCase().includes(q) ||
        integration.features.some((feature) => feature.toLowerCase().includes(q))
      )
    })
  }, [cards, search, filter])

  const isFiltered = search.trim() !== '' || filter !== 'all'

  const header = (
    <PageHeader
      title="Integrations"
      description="Connect Vulnix with the tools your team already works in."
    />
  )

  if (wsLoading || state.loading) return <IntegrationsPageSkeleton />

  if (wsError || state.error)
    return (
      <div className="console-enter space-y-4">
        {header}
        <ErrorState
          title="Could not read integration state"
          description={wsError || state.error}
          tone="danger"
          actions={
            wsError ? (
              <Button variant="outline" onClick={retryWorkspace}>
                Try again
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setAttempt((a) => a + 1)}>
                Try again
              </Button>
            )
          }
        />
      </div>
    )

  return (
    <div className="console-enter space-y-4">
      {header}


      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search integrations"
        resultCount={filtered.length}
        onClearFilters={
          isFiltered
            ? () => {
                setSearch('')
                setFilter('all')
              }
            : undefined
        }
        filters={
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger aria-label="Filter by integration state" className="w-fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATE_FILTERS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {filtered.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Compass}
            title="No integration matches"
            description="Nothing in the catalog matches that search. Clear the filters to see all five entries."
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setSearch('')
                  setFilter('all')
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Panel>
      ) : (
        <CardGrid columns={3}>
          {filtered.map((integration) => (
            <IntegrationCard key={integration.id} integration={integration} />
          ))}
        </CardGrid>
      )}

      <Panel
        title="Need a custom integration?"
        description="Webhooks and the REST API are the two surfaces you can build against today."
      >
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link to="/app/integrations/webhooks" />}>
            <Webhook data-icon="inline-start" />
            Configure webhooks
          </Button>
          <Button
            variant="outline"
            render={<Link to="/app/api-docs" />}
          >
            <BookOpen data-icon="inline-start" />
            API documentation
            <ArrowRight data-icon="inline-end" />
          </Button>
        </div>
      </Panel>
    </div>
  )
}

const CARD_SHELL =
  'console-enter flex flex-col rounded-xl border border-border bg-background p-4 shadow-xs'

const ICON_WRAP =
  'flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground [&_svg]:size-5'

function IntegrationCard({ integration }) {
  const { name, description, Icon, to, features, state, detail } = integration

  const body = (
    <>
      <div className="flex items-start gap-3">
        <span className={ICON_WRAP}>
          <Icon />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">{name}</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        {features.map((feature) => (
          <span
            key={feature}
            className={cn(
              'rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground',
              state === 'unavailable' && 'line-through decoration-border-strong'
            )}
          >
            {feature}
          </span>
        ))}
      </div>

      <div className="mt-auto" />

      <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
        {to ? (
          <span className="inline-flex min-w-0 items-center gap-1 text-sm font-medium text-primary transition-colors group-hover/integration:text-primary-hover">
            Configure
            <ArrowRight className="size-4 shrink-0 transition-transform duration-150 ease-smooth group-hover/integration:translate-x-0.5" />
          </span>
        ) : (
          <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
            <CircleAlert className="size-3.5 shrink-0" />
            No screen yet
          </span>
        )}
        <Pill tone={STATE_TONES[state]} className="shrink-0">
          {STATE_LABEL[state]}
        </Pill>
      </div>

      <p className="mt-2 truncate text-xs text-muted-foreground" title={detail}>
        {detail}
      </p>
    </>
  )

  if (to) {
    return (
      <Link
        to={to}
        className={cn(
          CARD_SHELL,
          'group/integration text-left transition-[background-color,border-color,box-shadow,transform] duration-150 ease-smooth hover:border-border-strong hover:shadow-sm active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
        )}
      >
        {body}
      </Link>
    )
  }

  return <div className={CARD_SHELL}>{body}</div>
}
