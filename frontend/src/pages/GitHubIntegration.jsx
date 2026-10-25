import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useWorkspace } from '../hooks/useWorkspace'
import { useOAuth, useOAuthReturnNotice } from '../hooks/useOAuth'
import { GitHub } from '../components/icons'
import { Button } from '../components/ui/button'
import { PageStack } from '../components/app/Grids'
import { PageHeader } from '../components/app/PageHeader'
import { Panel } from '../components/app/Panel'
import { Pill } from '../components/app/SeverityBadge'
import { ProviderConnect } from '../components/app/ProviderConnect'
import { ErrorState, LoadingState } from '../components/EmptyState'
import { GitHubRepositoryAccess } from '../components/app/GitHubRepositoryAccess'

const PROVIDER = 'github'

/**
 * This screen answers one question: has the workspace approved Vulnix on GitHub
 * yet. Repository and branch picking lives in the audit intake, next to the
 * project it produces.
 */
export function GitHubIntegration() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()
  const oauth = useOAuth(PROVIDER, workspaceId)

  useOAuthReturnNotice(PROVIDER)

  const header = (
    <PageHeader
      breadcrumb={[{ label: 'Integrations', to: '/app/integrations' }, { label: 'GitHub' }]}
      title="GitHub"
      description="Approve Vulnix once in GitHub’s own window, then choose repositories when you start an audit."
      meta={
        <>
          <Pill tone="neutral" icon={GitHub}>
            GitHub
          </Pill>
          <Pill
            tone={oauth.connection ? 'success' : 'neutral'}
            dot={oauth.connection ? undefined : 'bg-border-strong'}
          >
            {oauth.connection ? 'Connected' : 'Not connected'}
          </Pill>
        </>
      }
      actions={
        <Button variant="outline" render={<Link to="/app/integrations" />}>
          <ArrowLeft data-icon="inline-start" />
          Back
        </Button>
      }
    />
  )

  if (wsLoading || oauth.loading)
    return (
      <PageStack>
        {header}
        <Panel>
          <LoadingState label="Checking your GitHub connection" />
        </Panel>
      </PageStack>
    )

  if (wsError)
    return (
      <PageStack>
        {header}
        <Panel>
          <ErrorState title="Workspace unavailable" description={wsError} onRetry={retryWorkspace} />
        </Panel>
      </PageStack>
    )

  return (
    <PageStack>
      {header}
      <ProviderConnect
        name="GitHub"
        icon={GitHub}
        capability={oauth.capability}
        connection={oauth.connection}
        busy={oauth.busy}
        error={oauth.error}
        onConnect={oauth.connect}
        onDisconnect={oauth.disconnect}
        onRetry={oauth.refresh}
      />
      {!oauth.connection?.connected && (
        <Panel>
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-subtle text-brand">
              <ShieldCheck className="size-4" aria-hidden />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Choose repository access in GitHub</h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                Connect opens the Vulnix GitHub App installation flow. Choose the account and repositories
                there; they become available for audits automatically after GitHub returns you here.
              </p>
            </div>
          </div>
        </Panel>
      )}
      {oauth.connection?.connected && (
        <GitHubRepositoryAccess key={workspaceId} workspaceId={workspaceId} />
      )}
    </PageStack>
  )
}
