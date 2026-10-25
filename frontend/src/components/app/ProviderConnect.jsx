import { ExternalLink, ShieldCheck, Unlink, CheckCircle2 } from 'lucide-react'
import { Button } from '../ui/button'
import { Panel } from './Panel'
import { ErrorState } from '../EmptyState'
import { capabilityReasonText } from '../../lib/integrations'

/**
 * The credential surface for an integration provider: one centred action, no
 * forms. When this server has no app configured for the provider, the button says so
 * instead of opening a window that can only fail.
 */
export function ProviderConnect({
  name,
  icon: Icon,
  capability,
  connection,
  busy,
  error,
  onConnect,
  onDisconnect,
  onRetry,
}) {
  if (error) {
    return (
      <Panel>
        <ErrorState
          tone="danger"
          title="We couldn’t read your connection status"
          description={error}
          onRetry={onRetry}
          retryLabel="Try again"
        />
      </Panel>
    )
  }

  if (connection) {
    return (
      <Panel>
        <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50 dark:bg-emerald-950/40 dark:text-emerald-400 dark:ring-emerald-950/20 mb-4">
            <CheckCircle2 className="size-7" />
          </div>
          <h3 className="text-base font-semibold text-foreground">
            Connected as {connection.account_label || name}
          </h3>
          <p className="mt-1.5 max-w-md text-sm text-muted-foreground leading-relaxed">
            Vulnix reaches this account through the encrypted server approval. Repositories and branches are accessible when you configure an audit.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <Button variant="outline" onClick={onDisconnect} disabled={busy}>
              <Unlink data-icon="inline-start" />
              {busy ? 'Disconnecting…' : 'Disconnect integration'}
            </Button>
          </div>
        </div>
      </Panel>
    )
  }

  // Not connected: centred Connect action, with the server's own reason when
  // there is nothing here to connect to.
  const unavailable = capability && capability.oauth_available === false
  const isGitHub = name === 'GitHub'

  return (
    <Panel>
      <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-8 ring-primary/5 mb-5 shadow-xs">
          {Icon ? <Icon className="size-8" /> : <ExternalLink className="size-8" />}
        </div>
        <h3 className="text-lg font-bold text-foreground">
          Connect {name}
        </h3>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground leading-relaxed">
          {isGitHub
            ? 'Install the Vulnix GitHub App and choose which repositories it can access. They will be available for audits as soon as GitHub returns you here.'
            : `Link your ${name} workspace to enable automated security scans, repository import, and continuous vulnerability monitoring.`}
        </p>
        <div className="mt-8 flex flex-col sm:flex-row items-center gap-3">
          <Button
            size="lg"
            onClick={onConnect}
            disabled={busy || unavailable}
            className="px-8 font-medium shadow-sm hover:shadow-md transition-all"
          >
            <ExternalLink data-icon="inline-start" />
            {busy ? `Opening ${name}…` : `Connect ${name}`}
          </Button>
        </div>
        <div className="mt-5 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-3.5 text-emerald-600" />
          <span>
            {unavailable
              ? capabilityReasonText(capability.reason)
              : isGitHub
                ? 'GitHub App installation · Tokens encrypted and renewed server-side'
                : 'OAuth 2.0 encrypted authorization · No credentials stored in browser'}
          </span>
        </div>
      </div>
    </Panel>
  )
}
