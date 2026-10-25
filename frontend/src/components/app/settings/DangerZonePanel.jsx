import { useState } from 'react'
import { LogOut, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../services/api'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Field, FieldDescription, FieldLabel } from '../../ui/field'
import { SettingsPanel as Panel } from './SettingsPanel'

/**
 * The two actions that remove access rather than grant it. Both are refused
 * server-side when they would leave a workspace without an owner, so the
 * messages here are what the API answered, not a client-side guess.
 */
export function DangerZonePanel({ workspace, me, isOwner, onWorkspaceGone }) {
  const [confirmName, setConfirmName] = useState('')
  const [busy, setBusy] = useState(null)

  if (!workspace) return null

  async function handleLeave() {
    setBusy('leave')
    try {
      await api.removeMember(workspace.id, me.id)
      toast.success('You left this workspace', { description: 'Your account and its history are untouched.' })
      onWorkspaceGone?.()
    } catch (err) {
      toast.error('Could not leave', { description: err.message })
    } finally {
      setBusy(null)
    }
  }

  async function handleDelete(event) {
    event.preventDefault()
    setBusy('delete')
    try {
      await api.deleteWorkspace(workspace.id, confirmName)
      toast.success('Workspace deleted', {
        description: `“${workspace.name}” and everything audited inside it is gone.`,
      })
      onWorkspaceGone?.()
    } catch (err) {
      toast.error('Workspace not deleted', { description: err.message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Leave this workspace"
        description="Removes your access here only. Promote someone else to owner first if you are the only one."
        className="border-border"
        footer={
          <Button
            variant="outline"
            size="sm"
            disabled={busy === 'leave' || !me}
            onClick={handleLeave}
            className="text-destructive hover:bg-destructive/10"
          >
            <LogOut data-icon="inline-start" />
            {busy === 'leave' ? 'Leaving…' : 'Leave workspace'}
          </Button>
        }
      >
        <p className="text-xs leading-relaxed text-muted-foreground">
          {me
            ? 'You can always be invited back by an admin or owner of this workspace.'
            : 'Your account could not be read, so there is nothing to leave.'}
        </p>
      </Panel>

      <Panel
        title="Delete this workspace"
        description="Irreversible. Type the name to confirm."
        className="border-border"
      >
        {isOwner ? (
          <form className="space-y-4" onSubmit={handleDelete}>
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
              <p className="text-xs leading-relaxed text-foreground">
                Going ahead removes every project, upload, audit, finding, tool run, integration,
                webhook, credit record and audit entry under <strong>{workspace.name}</strong>, plus
                the stored archives they point at. Nothing is archived first.
              </p>
            </div>
            <Field>
              <FieldLabel htmlFor="delete-confirm">Workspace name</FieldLabel>
              <Input
                id="delete-confirm"
                value={confirmName}
                onChange={(event) => setConfirmName(event.target.value)}
                placeholder={workspace.name}
                autoComplete="off"
              />
              <FieldDescription>Must match exactly, or the server refuses the deletion.</FieldDescription>
            </Field>
            <Button
              type="submit"
              variant="outline"
              disabled={busy === 'delete' || confirmName.trim() !== workspace.name}
              className="text-destructive hover:bg-destructive/10"
            >
              <TriangleAlert data-icon="inline-start" />
              {busy === 'delete' ? 'Deleting…' : `Delete “${workspace.name}”`}
            </Button>
          </form>
        ) : (
          <p className="text-xs leading-relaxed text-muted-foreground">
            Deleting a workspace belongs to an owner, and your role here is not owner. Ask an owner,
            or step into a workspace you do own.
          </p>
        )}
      </Panel>
    </div>
  )
}
