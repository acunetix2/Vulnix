import { useEffect, useRef, useState } from 'react'
import { AtSign, Check, ImagePlus, KeyRound, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../services/api'
import { useAuth } from '../../../contexts/AuthContext'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Field, FieldDescription, FieldError, FieldLabel } from '../../ui/field'
import { SettingsPanel as Panel } from './SettingsPanel'
import { UserAvatar } from '../../app/UserAvatar'
import { ErrorState } from '../../EmptyState'
import { Skeleton } from '../../ui/skeleton'
import { formatDate } from '../../../lib/utils'
import { handleProblem, normalizeHandle } from '../../../lib/username'

function IdentityRow({ label, value, hint }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 truncate text-sm font-medium text-foreground" title={hint}>
        {value}
      </p>
    </div>
  )
}

/**
 * The account row Vulnix owns: a name, a handle, and a password it forwards to
 * the provider that actually holds the credential. Sign-in state itself is the
 * provider's, so the email row has no control next to it.
 */
export function AccountPanel({ me, onSaved, onRetry, loading, loadError }) {
  const { user, refresh } = useAuth()
  const [displayName, setDisplayName] = useState(me?.display_name ?? '')
  const [username, setUsername] = useState(me?.username ?? '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const avatarInput = useRef(null)
  const [formError, setFormError] = useState(null)
  const [passwordReady, setPasswordReady] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [changing, setChanging] = useState(false)
  const [checkingUsernameFor, setCheckingUsernameFor] = useState(null)
  const [usernameStatus, setUsernameStatus] = useState(null)

  const savedName = me?.display_name || ''
  const savedHandle = me?.username || ''
  const nameDirty = displayName.trim() !== savedName.trim()
  const handleDirty = normalizeHandle(username) !== savedHandle
  const normalizedHandle = normalizeHandle(username)
  const localHandleIssue = handleDirty ? handleProblem(username) : null
  const currentUsernameStatus =
    usernameStatus?.handle === normalizedHandle ? usernameStatus : null
  const checkingUsername = checkingUsernameFor === normalizedHandle
  const changed = nameDirty || handleDirty

  useEffect(() => {
    let cancelled = false
    api
      .getSystemStatus()
      .then((status) => !cancelled && setPasswordReady(status?.supabase_auth === 'configured'))
      .catch(() => !cancelled && setPasswordReady(false))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!me || !handleDirty || !normalizedHandle || localHandleIssue) return

    let cancelled = false
    const timer = setTimeout(async () => {
      setCheckingUsernameFor(normalizedHandle)
      try {
        const res = await api.checkUsername(normalizedHandle)
        if (!cancelled) {
          setUsernameStatus({
            handle: normalizedHandle,
            available: res.available,
            reason: res.reason,
          })
        }
      } catch {
        if (!cancelled) setUsernameStatus(null)
      } finally {
        if (!cancelled) {
          setCheckingUsernameFor((current) =>
            current === normalizedHandle ? null : current,
          )
        }
      }
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [me, handleDirty, normalizedHandle, localHandleIssue])

  if (!me && !loading && loadError) {
    return (
      <ErrorState
        title="We couldn’t load your account"
        description={loadError}
        onRetry={onRetry}
      />
    )
  }

  if (!me) {
    return (
      <div className="space-y-4" role="status" aria-label="Loading your account">
        <Panel title="Profile" description="Your name and public avatar.">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="size-16 rounded-full shrink-0" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-3 w-48 rounded-md" />
              </div>
            </div>
            <div className="grid gap-4 max-w-lg">
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-24 rounded-md" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-20 rounded-md" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            </div>
          </div>
        </Panel>
      </div>
    )
  }

  // Checked while typing so the reason appears next to the field instead of
  // arriving as a rejected request after Save.
  const nameIssue = displayName.trim() ? null : 'A display name cannot be blank.'
  const serverHandleIssue =
    handleDirty && currentUsernameStatus && !currentUsernameStatus.available
      ? currentUsernameStatus.reason
      : null
  const handleIssue = localHandleIssue || serverHandleIssue
  const handleAvailable =
    handleDirty && !handleIssue && currentUsernameStatus?.available && !checkingUsername
  const blocked = Boolean(nameIssue || handleIssue || checkingUsername)

  async function handleSubmit(event) {
    event.preventDefault()
    if (!changed || blocked) return
    setSaving(true)
    setFormError(null)
    try {
      const changes = {}
      if (nameDirty) changes.display_name = displayName.trim()
      if (handleDirty) changes.username = username.trim()
      const updated = await api.updateProfile(changes)
      onSaved(updated)
      toast.success('Account updated', {
        description: updated.username ? `You are now @${updated.username}.` : 'Your name is saved.',
      })
    } catch (err) {
      setFormError(err.message || 'We could not save your account.')
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatar(event) {
    const file = event.target.files?.[0]
    // Cleared so picking the same file again after a rejection still fires.
    event.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const updated = await api.uploadAvatar(file)
      onSaved(updated)
      // The rail reads the session object, not this panel's state.
      refresh()
      toast.success('Profile picture updated')
    } catch (err) {
      toast.error('Could not upload that picture', { description: err.message })
    } finally {
      setUploading(false)
    }
  }

  async function handlePasswordChange(event) {
    event.preventDefault()
    if (password.length < 8) {
      toast.error('Use at least 8 characters', {
        description: 'The provider enforces the same minimum.',
      })
      return
    }
    if (password !== passwordConfirm) {
      toast.error('Passwords do not match')
      return
    }
    setChanging(true)
    try {
      await api.changePassword(password)
      setPassword('')
      setPasswordConfirm('')
      toast.success('Password changed', { description: 'Other sessions may need to sign in again.' })
    } catch (err) {
      toast.error('Could not change the password', { description: err.message })
    } finally {
      setChanging(false)
    }
  }

  return (
    <div className="space-y-4">
      <Panel
        title="Identity"
        description="Choose how your name and profile appear to your team."
      >
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="flex items-center gap-4 rounded-lg border border-border bg-muted/20 p-3">
            <UserAvatar person={me} className="size-14" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Profile picture</p>
              <p className="mt-0.5 mb-2 text-xs leading-relaxed text-muted-foreground">
                {me.avatar_url
                  ? 'Your picture appears beside your name across Vulnix.'
                  : 'Upload a picture to personalize your profile.'}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={uploading}
                onClick={() => avatarInput.current?.click()}
              >
                <ImagePlus data-icon="inline-start" />
                {uploading ? 'Uploading…' : 'Upload a picture'}
              </Button>
              {/* 2 MB and a real PNG/JPEG/GIF/WebP signature: the server checks the
                  bytes, so a renamed file is refused rather than stored. */}
              <input
                ref={avatarInput}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                className="sr-only"
                onChange={handleAvatar}
                disabled={uploading}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={nameIssue ? true : undefined}>
              <FieldLabel htmlFor="account-name">Display name</FieldLabel>
              <Input
                id="account-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your name"
                autoComplete="name"
                maxLength={120}
              />
              <FieldDescription>Shown across your workspace.</FieldDescription>
              <FieldError>{nameIssue}</FieldError>
            </Field>

            <Field data-invalid={handleIssue || formError ? true : undefined}>
              <FieldLabel htmlFor="account-handle">Username</FieldLabel>
              <div className="relative">
                <AtSign className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="account-handle"
                  value={username}
                  onChange={(event) => setUsername(event.target.value.replace(/^@+/, ''))}
                  placeholder="ada"
                  autoComplete="off"
                  className="pl-8 pr-24"
                  maxLength={31}
                />
                <div className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 flex items-center gap-1.5">
                  {checkingUsername && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="size-3.5 animate-spin" />
                      Checking…
                    </span>
                  )}
                  {!checkingUsername && handleAvailable && (
                    <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <Check className="size-3" />
                      Available
                    </span>
                  )}
                  {!checkingUsername &&
                    handleDirty &&
                    currentUsernameStatus &&
                    !currentUsernameStatus.available && (
                    <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                      <X className="size-3" />
                      Taken
                    </span>
                  )}
                </div>
              </div>
              <FieldDescription>
                Use 3–30 letters, numbers, dots, underscores, or hyphens. Your username must be unique.
              </FieldDescription>
              <FieldError>{handleIssue || formError}</FieldError>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <IdentityRow label="Email" value={me.email || user?.email || '—'} />
            <IdentityRow label="Joined" value={formatDate(me.created_at)} />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" disabled={saving || !changed || blocked}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            {changed && !saving && (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDisplayName(savedName)
                  setUsername(savedHandle)
                  setFormError(null)
                }}
              >
                Discard
              </Button>
            )}
          </div>
        </form>
      </Panel>

      <Panel
        title="Password"
        description={
          passwordReady
            ? 'Update the password you use to sign in.'
            : 'Password changes are not available for this sign-in method. Use your sign-in provider’s password reset option.'
        }
      >
        {passwordReady ? (
          <form className="space-y-4" onSubmit={handlePasswordChange}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="account-password">New password</FieldLabel>
                <Input
                  id="account-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
                <FieldDescription>Minimum 8 characters.</FieldDescription>
              </Field>
              <Field>
                <FieldLabel htmlFor="account-password-confirm">Confirm password</FieldLabel>
                <Input
                  id="account-password-confirm"
                  type="password"
                  value={passwordConfirm}
                  onChange={(event) => setPasswordConfirm(event.target.value)}
                  autoComplete="new-password"
                />
              </Field>
            </div>
            <Button type="submit" variant="outline" disabled={changing || !password}>
              <KeyRound data-icon="inline-start" />
              {changing ? 'Updating…' : 'Change password'}
            </Button>
          </form>
        ) : (
          <ErrorState
            title="Credentials live with your provider"
            description="To choose a new password, use the password reset option for your sign-in method."
          />
        )}
      </Panel>
    </div>
  )
}
