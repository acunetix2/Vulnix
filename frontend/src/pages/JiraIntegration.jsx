import { Link } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { useWorkspace } from '../hooks/useWorkspace'
import { useOAuth, useOAuthReturnNotice } from '../hooks/useOAuth'
import { Button } from '../components/ui/button'
import { PageStack } from '../components/app/Grids'
import { PageHeader } from '../components/app/PageHeader'
import { Panel } from '../components/app/Panel'
import { Pill } from '../components/app/SeverityBadge'
import { ProviderConnect } from '../components/app/ProviderConnect'
import { ErrorState, LoadingState } from '../components/EmptyState'

const PROVIDER = 'jira'

export function JiraIntegration() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()
  const oauth = useOAuth(PROVIDER, workspaceId)

  useOAuthReturnNotice(PROVIDER)

  const header = (
    <PageHeader
      breadcrumb={[{ label: 'Integrations', to: '/app/integrations' }, { label: 'Jira' }]}
      title="Jira"
      description="One approval, given in Atlassian’s own window and stored on the server. Vulnix can then act as this account within the scopes you granted."
      meta={
        <>
          <Pill tone="neutral" icon={ShieldCheck}>
            Jira
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
          <LoadingState label="Checking your Jira connection" />
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
        name="Jira"
        icon={ShieldCheck}
        capability={oauth.capability}
        connection={oauth.connection}
        busy={oauth.busy}
        error={oauth.error}
        onConnect={oauth.connect}
        onDisconnect={oauth.disconnect}
        onRetry={oauth.refresh}
      />
    </PageStack>
  )
}
