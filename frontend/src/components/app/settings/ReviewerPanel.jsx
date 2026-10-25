import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../services/api'
import { Button } from '../../ui/button'
import { SettingsPanel as Panel } from './SettingsPanel'
import { Pill } from '../../app/SeverityBadge'
import { AiModelPicker } from '../../app/AiModelPicker'
import { CreditsHeatmap } from '../../app/CreditsHeatmap'
import { Skeleton } from '../../ui/skeleton'

/**
 * Which reviewer answers, and what it has cost. Rows carry an alias and a
 * selection token only - the model behind a reviewer is resolved on the server
 * and never reaches this document.
 */
export function ReviewerPanel({ workspaceId }) {
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  const [pending, setPending] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!cancelled) setLoading(true)
      try {
        const fresh = await api.getAiSettings(workspaceId)
        if (cancelled) return
        setSettings(fresh)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err.message || 'The reviewer list could not be read.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [workspaceId, attempt])

  async function handleSelect(modelId) {
    setPending(modelId)
    setSaving(true)
    try {
      const updated = await api.setAiModel(workspaceId, modelId)
      setSettings(updated)
      const chosen = updated.models.find((model) => model.id === updated.selected)
      toast.success(`Now reviewing with ${chosen?.alias || 'the selected reviewer'}`, {
        description: 'Applies to every explanation generated from now on, in this workspace.',
      })
    } catch (err) {
      toast.error('Could not switch the reviewer', { description: err.message })
    } finally {
      setPending(null)
      setSaving(false)
    }
  }

  if (loading && !settings) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading reviewers">
        <Panel title="Vulnix reviewers" description="The agent that explains findings and reads repositories for you.">
          <div className="grid gap-3 sm:grid-cols-2 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-border/60 p-3.5">
                <Skeleton className="size-8 rounded-lg shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-4 w-28 rounded-md" />
                  <Skeleton className="h-3 w-40 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    )
  }

  const models = settings?.models || []
  const selected = models.find((model) => model.id === settings?.selected)

  return (
    <div className="space-y-4">
      <Panel
        title="Vulnix reviewers"
        description="The agent that explains findings and reads repositories for you."
        actions={
          <Pill tone={settings?.enabled ? 'ai' : 'neutral'}>
            {settings?.enabled ? 'Enabled' : 'Disabled'}
          </Pill>
        }
      >
        <AiModelPicker
          models={models}
          selected={settings?.selected}
          pending={pending}
          saving={saving}
          error={error}
          onRetry={() => setAttempt((n) => n + 1)}
          onSelect={handleSelect}
        />
        {settings && !settings.enabled && (
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Reviewers are switched off for this deployment (VULNIX_AI_ENABLED), so a selection here
            changes nothing until they are turned on.
          </p>
        )}
      </Panel>

      <Panel
        title="Credits"
        description="Calls and tokens recorded against this workspace, one square per day."
        actions={
          settings && (
            <span className="text-xs text-muted-foreground">
              {settings.used_today} / {settings.daily_quota} today
            </span>
          )
        }
        flush={false}
      >
        {selected ? (
          <p className="mb-3 text-xs text-muted-foreground">
            Currently {selected.alias}. Switching reviewers does not spend credits; explanations and
            agent audits do.
          </p>
        ) : (
          <p className="mb-3 text-xs text-muted-foreground">
            No reviewer is selected, so agent audits record the tools that ran and nothing else.
          </p>
        )}
        <CreditsHeatmap
          workspaceId={workspaceId}
          usedToday={settings?.used_today}
          dailyQuota={settings?.daily_quota}
        />
      </Panel>

      <Panel title="Review activity" description="Which tools ran, which were absent, and what the agent read.">
        <Button variant="outline" size="sm" render={<Link to="/app/scanners" />}>
          Audit history
          <ArrowRight data-icon="inline-end" />
        </Button>
      </Panel>
    </div>
  )
}
