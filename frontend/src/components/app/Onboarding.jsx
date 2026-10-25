import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CircleCheck,
  ImagePlus,
  Loader2,
  ShieldCheck,
  Bot,
  Upload,
  X,
  Sparkles,
  UserRound,
  Code2,
  Rocket,
} from 'lucide-react'
import { GitHub } from '../icons'
import { toast } from 'sonner'
import { api } from '../../services/api'
import { useAuth } from '../../contexts/AuthContext'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Field, FieldDescription, FieldError, FieldLabel } from '../ui/field'
import { UserAvatar } from './UserAvatar'
import { handleProblem, normalizeHandle } from '../../lib/username'
import { cn } from '../../lib/utils'

/**
 * The welcome sequence, offered once per account and stored on its profile row,
 * so it does not reappear on a second device and cannot be lost by a browser
 * that clears storage. Every stage states what Vulnix actually does; nothing
 * here is a placeholder for a feature the API does not have.
 */
const STAGES = [
  { id: 'how', title: 'See the workflow', icon: Sparkles },
  { id: 'identity', title: 'Set up your profile', icon: UserRound },
  { id: 'code', title: 'Connect your code', icon: Code2 },
  { id: 'go', title: 'Start exploring', icon: Rocket },
]

function StageHeader({ stage, step, onBack, onSkip, first }) {
  const StageIcon = stage.icon

  return (
    <div className="border-b border-border bg-muted/20 px-5 py-4 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary-subtle text-primary">
            <StageIcon className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
              Vulnix onboarding
            </p>
            <h2 className="truncate text-sm font-semibold tracking-tight text-foreground sm:text-base">
              {stage.title}
            </h2>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            disabled={first}
            aria-label="Go to previous step"
            className="gap-1.5 px-2 sm:px-3"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span className="hidden sm:inline">Back</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={onSkip} className="px-2 text-muted-foreground sm:px-3">
            Skip
          </Button>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <div
          className="flex flex-1 gap-1.5"
          role="progressbar"
          aria-label="Onboarding progress"
          aria-valuemin={1}
          aria-valuemax={STAGES.length}
          aria-valuenow={step + 1}
        >
          {STAGES.map((item, index) => (
            <span
              key={item.id}
              aria-hidden="true"
              className={cn(
                'h-1 flex-1 rounded-full transition-colors duration-200',
                index <= step ? 'bg-primary' : 'bg-border'
              )}
            />
          ))}
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {step + 1} <span className="text-border">/</span> {STAGES.length}
        </span>
      </div>
    </div>
  )
}

/** What an audit produces, described by the stages a run really reports. */
const HOW_IT_WORKS = [
  {
    icon: ShieldCheck,
    name: 'Security review',
    note: 'The agent reads each file and reports what it can point at, with the line as evidence.',
  },
  {
    icon: Bot,
    name: 'Suggested edits',
    note: 'For a problem with a fix it can write, the run carries a diff you accept or reject.',
  },
  {
    icon: CircleCheck,
    name: 'Triage trail',
    note: 'Every finding keeps who marked it, when, and what changed between two audits.',
  },
]

function HowStage({ onNext }) {
  return (
    <>
      <div className="grid gap-0 md:grid-cols-2">
        <div className="flex flex-col justify-center gap-3 p-5 sm:p-7">
          <span className="w-fit rounded-full border border-primary/20 bg-primary-subtle px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
            Your first audit
          </span>
          <h3 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            From code to clear next steps
          </h3>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Connect a repository and Vulnix reviews it for security, secrets, and dependency risks.
            Your first report becomes a baseline you can measure against.
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Every finding includes evidence. Run another audit to see what changed.
          </p>
        </div>
        <div className="border-t border-border bg-muted/30 p-6 md:border-t-0 md:border-l">
          <ul className="space-y-3">
            {HOW_IT_WORKS.map((item) => (
              <li
                key={item.name}
                className="rounded-xl border border-border bg-card p-3.5 shadow-2xs transition-colors duration-150 hover:border-primary/30"
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary-subtle text-primary">
                    <item.icon className="size-4" aria-hidden />
                  </span>
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <StageFooter>
        <Button onClick={onNext}>
          Continue
          <ArrowRight data-icon="inline-end" />
        </Button>
      </StageFooter>
    </>
  )
}

/** Every stage ends the same way: one row of actions under a rule. */
function StageFooter({ children }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-6 py-4">
      {children}
    </div>
  )
}

function IdentityStage({ me, onNext }) {
  const { refresh } = useAuth()
  const avatarInput = useRef(null)
  const [displayName, setDisplayName] = useState(me?.display_name || '')
  const [username, setUsername] = useState(me?.username || '')
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  // Two failures, two places: a rejected picture must not read as a broken handle.
  const [avatarError, setAvatarError] = useState(null)
  const [error, setError] = useState(null)

  const [checkingUsername, setCheckingUsername] = useState(false)
  const [usernameStatus, setUsernameStatus] = useState(null)

  const handleDirty = normalizeHandle(username) !== (me?.username || '')
  const nameDirty = displayName.trim() !== (me?.display_name || '')

  useEffect(() => {
    const handle = normalizeHandle(username)
    if (!handleDirty || !handle) {
      setUsernameStatus(null)
      setCheckingUsername(false)
      return
    }

    const localIssue = handleProblem(username)
    if (localIssue) {
      setUsernameStatus({ available: false, reason: localIssue })
      setCheckingUsername(false)
      return
    }

    let cancelled = false
    setCheckingUsername(true)

    const timer = setTimeout(async () => {
      try {
        const res = await api.checkUsername(handle)
        if (!cancelled) {
          setUsernameStatus({
            available: res.available,
            reason: res.reason,
          })
        }
      } catch {
        if (!cancelled) setUsernameStatus(null)
      } finally {
        if (!cancelled) setCheckingUsername(false)
      }
    }, 350)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [username, handleDirty])

  const localHandleIssue = handleDirty && username.trim() ? handleProblem(username) : null
  const serverHandleIssue =
    handleDirty && usernameStatus && !usernameStatus.available ? usernameStatus.reason : null
  const handleIssue = localHandleIssue || serverHandleIssue
  const handleAvailable =
    handleDirty && !handleIssue && usernameStatus?.available && !checkingUsername

  /**
   * The picture is stored on the account, so it can be set here rather than
   * deferred to Settings - an email-and-password signup arrives with nothing.
   */
  async function chooseAvatar(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    setAvatarError(null)
    try {
      await api.uploadAvatar(file)
      await refresh()
    } catch (err) {
      setAvatarError(err.message || 'That picture could not be uploaded.')
    } finally {
      setUploading(false)
    }
  }

  async function save() {
    const changes = {}
    if (nameDirty) changes.display_name = displayName.trim()
    if (handleDirty && username.trim()) changes.username = username.trim()
    if (!Object.keys(changes).length) {
      onNext()
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.updateProfile(changes)
      // The rail shows the handle, so the profile row is re-read before advancing.
      await refresh()
      onNext()
    } catch (err) {
      setError(err.message || 'We could not save that name.')
      setSaving(false)
    }
  }

  return (
    <>
      <div className="space-y-5 p-5 sm:p-6">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">Make this workspace yours</h3>
          <p className="mt-1 text-sm text-muted-foreground">Add a name and handle so your team knows it’s you.</p>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border bg-muted/20 p-4">
          <UserAvatar
            person={{ ...me, display_name: displayName, username }}
            className="size-14 shrink-0"
          />
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => avatarInput.current?.click()}
                disabled={uploading}
              >
                <ImagePlus data-icon="inline-start" />
                {uploading ? 'Uploading…' : me?.avatar_url ? 'Replace picture' : 'Add a picture'}
              </Button>
              <input
                ref={avatarInput}
                type="file"
                className="sr-only"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={chooseAvatar}
                aria-label="Profile picture"
              />
            </div>
            {/* Kept out of the username error: a rejected picture is not a broken
                handle, and the fix for one is not the fix for the other. */}
            {avatarError && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {avatarError}
              </p>
            )}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="onboarding-name">Display name</FieldLabel>
            <Input
              id="onboarding-name"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Your name"
              autoComplete="name"
              maxLength={120}
            />
            <FieldDescription>Up to 120 characters.</FieldDescription>
          </Field>
          <Field data-invalid={handleIssue || error ? true : undefined}>
            <FieldLabel htmlFor="onboarding-handle">Username</FieldLabel>
            <div className="relative">
              <Input
                id="onboarding-handle"
                value={username}
                onChange={(event) => setUsername(event.target.value.replace(/^@+/, ''))}
                placeholder="ada"
                autoComplete="off"
                className="pr-24"
                maxLength={30}
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
                {!checkingUsername && handleDirty && usernameStatus && !usernameStatus.available && (
                  <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                    <X className="size-3" />
                    Taken
                  </span>
                )}
              </div>
            </div>
            <FieldDescription>3 to 30 characters, lowercase.</FieldDescription>
            <FieldError>{handleIssue || error}</FieldError>
          </Field>
        </div>
      </div>
      <StageFooter>
        {/* With nothing changed the button still advances: an account that already
            has a name and no handle has nothing to do here. It waits out a picture
            upload so advancing cannot abandon it half-way. */}
        <Button onClick={save} disabled={saving || uploading || Boolean(handleIssue) || checkingUsername}>
          {saving ? 'Saving…' : nameDirty || handleDirty ? 'Save and continue' : 'Continue'}
          {!saving && <ArrowRight data-icon="inline-end" />}
        </Button>
      </StageFooter>
    </>
  )
}

function CodeStage({ onChoose, onNext, busy }) {
  return (
    <>
      <div className="space-y-4 p-5 sm:p-6">
        <div>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">Choose where to start</h3>
          <p className="mt-1 text-sm text-muted-foreground">Bring in a repository now, or explore Vulnix first.</p>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          A repository is the main way to bring code in; an archive is the second. Both run the
          same audit, and a repository scan runs in a sandbox with no outbound access.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onChoose('/app/integrations/github')}
            className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors duration-150 hover:border-primary/40 hover:bg-primary-subtle/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="grid size-9 place-items-center rounded-lg bg-muted text-foreground">
              <GitHub className="size-4" aria-hidden />
            </span>
            <span className="text-sm font-medium text-foreground">Scan a GitHub repository</span>
            <span className="text-xs leading-relaxed text-muted-foreground">
              Connect the account, pick the repositories Vulnix may read, then audit one.
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onChoose('/app/projects')}
            className="group flex flex-col items-start gap-2 rounded-xl border border-border bg-card p-4 text-left transition-colors duration-150 hover:border-primary/40 hover:bg-primary-subtle/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="grid size-9 place-items-center rounded-lg bg-muted text-foreground">
              <Upload className="size-4" aria-hidden />
            </span>
            <span className="text-sm font-medium text-foreground">Upload an archive</span>
            <span className="text-xs leading-relaxed text-muted-foreground">
              Create a project and hand it a zip of the source, up to 100 MiB.
            </span>
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Picking one takes you there and closes this sequence; nothing is read until you start an
          audit.
        </p>
      </div>
      <StageFooter>
        <Button variant="ghost" onClick={onNext} disabled={busy}>
          Look around first
          <ArrowRight data-icon="inline-end" />
        </Button>
      </StageFooter>
    </>
  )
}

function GoStage({ onEnter, busy }) {
  return (
    <>
      <div className="space-y-5 p-5 sm:p-6">
        <div className="flex items-start gap-4 rounded-xl border border-primary/20 bg-primary-subtle/40 p-4 sm:p-5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Check className="size-5" aria-hidden />
          </span>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">You’re all set</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Your workspace is ready. Start with a project or head to the dashboard to see your
              security overview.
            </p>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          When you run an audit, the run page walks through each step and shows what was checked.
        </p>
      </div>
      <StageFooter>
        <Button onClick={() => onEnter('/app/projects')} disabled={busy}>
          Go to projects
          <ArrowRight data-icon="inline-end" />
        </Button>
        <Button variant="outline" onClick={() => onEnter('/app/dashboard')} disabled={busy}>
          Open the dashboard
        </Button>
      </StageFooter>
    </>
  )
}

export function Onboarding({ me }) {
  const { refresh } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [step, setStep] = useState(0)
  const [closing, setClosing] = useState(false)
  const stage = STAGES[step]

  /**
   * Closing the sequence is a write to the profile row, so it survives a second
   * device. The navigation happens first: a failed write only means the welcome
   * sequence is offered again, and it must not strand the user in a modal.
   */
  async function finish(to = pathname) {
    setClosing(true)
    navigate(to, { replace: true })
    try {
      await api.finishOnboarding()
      await refresh()
    } catch (err) {
      setClosing(false)
      toast.error('Could not close the welcome sequence', { description: err.message })
    }
  }

  return (
    <div className="fixed inset-0 z-60 grid place-items-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Welcome to Vulnix"
        className="console-enter max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl sm:max-h-[calc(100dvh-2.5rem)]"
      >
        <StageHeader
          stage={stage}
          step={step}
          first={step === 0}
          onBack={() => setStep((n) => Math.max(0, n - 1))}
          onSkip={() => finish()}
        />
        {stage.id === 'how' && <HowStage onNext={() => setStep(1)} />}
        {stage.id === 'identity' && <IdentityStage me={me} onNext={() => setStep(2)} />}
        {stage.id === 'code' && (
          <CodeStage onChoose={finish} onNext={() => setStep(3)} busy={closing} />
        )}
        {stage.id === 'go' && <GoStage onEnter={finish} busy={closing} />}
      </div>
    </div>
  )
}
