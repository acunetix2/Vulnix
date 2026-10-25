import { useEffect, useState } from 'react'
import { ExternalLink, RefreshCw, Search } from 'lucide-react'
import { api, invalidate } from '../../services/api'
import { integrationErrorText } from '../../lib/integrations'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Pill } from './SeverityBadge'
import { ErrorState, LoadingState } from '../EmptyState'
import { Panel } from './Panel'

export function GitHubRepositoryAccess({ workspaceId }) {
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [state, setState] = useState({
    loading: true,
    error: null,
    repositories: [],
    selected: [],
    truncated: false,
  })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((current) => ({ ...current, loading: true, error: null }))

    const timer = setTimeout(async () => {
      try {
        const result = await api.getGitHubRepositories(workspaceId, page, query.trim())
        if (cancelled) return

        const selected = result?.selected || []
        setState({
          loading: false,
          error: null,
          repositories: result?.repositories || [],
          selected,
          truncated: Boolean(result?.truncated),
        })
      } catch (error) {
        if (cancelled) return
        setState((current) => ({
          ...current,
          loading: false,
          error: integrationErrorText(error),
        }))
      }
    }, query.trim() ? 250 : 0)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [workspaceId, page, query, attempt])

  return (
    <Panel>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Repositories available for audits</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              This list comes directly from the repositories selected when installing the Vulnix GitHub App.
              Change access in GitHub; no second allowlist is needed here.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            render={
              <a
                href="https://github.com/settings/installations"
                target="_blank"
                rel="noreferrer"
              />
            }
          >
            Manage repository access in GitHub
            <ExternalLink data-icon="inline-end" />
          </Button>
        </div>

        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              invalidate(`/workspaces/${workspaceId}/integrations/github/repositories`)
              setAttempt((value) => value + 1)
            }}
            disabled={state.loading}
          >
            <RefreshCw data-icon="inline-start" />
            Reload repositories
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => {
              setPage(1)
              setQuery(event.target.value)
            }}
            placeholder="Search connected repositories"
            className="pl-9"
            aria-label="Search connected GitHub repositories"
          />
        </div>

        {state.error ? (
          <ErrorState
            title="Could not load repositories"
            description={state.error}
            onRetry={() => setAttempt((value) => value + 1)}
          />
        ) : state.loading ? (
          <LoadingState label="Loading connected repositories" />
        ) : state.repositories.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center">
            <p className="text-sm font-medium text-foreground">
              {query.trim() ? 'No matching repositories' : 'No repositories installed'}
            </p>
            <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
              {query.trim()
                ? 'Try a different search.'
                : 'Install the Vulnix GitHub App on the account that owns your repositories, then choose the repositories it may access in GitHub. Reload this list after changing installation access.'}
            </p>
          </div>
        ) : (
          <div className="max-h-[420px] divide-y divide-border overflow-y-auto">
            {state.repositories.map((repo) => (
              <div
                key={repo.id}
                className="flex items-start gap-3 px-2 py-3"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-medium">{repo.full_name}</span>
                    {repo.private && <Pill tone="neutral">Private</Pill>}
                    <Pill tone="success">Available</Pill>
                  </span>
                  {repo.description && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {repo.description}
                    </span>
                  )}
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {repo.default_branch || 'No default branch'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={state.loading || page <= 1}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">Page {page}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPage((value) => value + 1)}
              disabled={state.loading || !state.truncated}
            >
              Next
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {state.selected.length} available on this page
          </p>
        </div>
      </div>
    </Panel>
  )
}
