import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '../../../services/api'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Field, FieldDescription, FieldError, FieldLabel } from '../../ui/field'
import { SettingsPanel as Panel } from './SettingsPanel'
import { formatDate } from '../../../lib/utils'

const NAME_MAX_LENGTH = 255

function DetailRow({ label, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-sm text-foreground">{children}</dd>
    </div>
  )
}

/** The workspace itself: the one name it carries, and when it last changed. */
export function WorkspacePanel({ workspace, onRenamed }) {
  const [name, setName] = useState(workspace?.name ?? '')
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  if (!workspace) return null

  const trimmed = name.trim()
  const unchanged = trimmed === workspace.name

  async function handleSubmit(event) {
    event.preventDefault()
    if (!trimmed) {
      setError('Enter a name for the workspace.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await api.updateWorkspace(workspace.id, { name: trimmed })
      toast.success('Workspace renamed', { description: `Now “${updated.name}”.` })
      onRenamed?.()
    } catch (err) {
      setError(err.message || 'We could not save the name.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <Panel title="Name" description="Shown in the workspace switcher, on reports, and in the audit log.">
        <form className="space-y-4" onSubmit={handleSubmit}>
          <Field data-invalid={error ? true : undefined}>
            <FieldLabel htmlFor="workspace-name">Workspace name</FieldLabel>
            <Input
              id="workspace-name"
              value={name}
              maxLength={NAME_MAX_LENGTH}
              onChange={(event) => setName(event.target.value)}
              autoComplete="organization"
              aria-invalid={!!error}
              disabled={saving}
            />
            <FieldDescription>Needs the admin or owner role, and is recorded as a change.</FieldDescription>
            <FieldError>{error}</FieldError>
          </Field>
          <div className="flex items-center gap-2">
            <Button type="submit" disabled={unchanged || saving}>
              {saving ? 'Saving…' : 'Save name'}
            </Button>
            {unchanged && !saving && (
              <span className="text-xs text-muted-foreground">Nothing to save yet.</span>
            )}
          </div>
        </form>
      </Panel>

      <Panel title="History" flush>
        <dl className="divide-y divide-border px-4">
          <DetailRow label="Created">{formatDate(workspace.created_at)}</DetailRow>
          <DetailRow label="Last change">{formatDate(workspace.updated_at)}</DetailRow>
        </dl>
      </Panel>
    </div>
  )
}
