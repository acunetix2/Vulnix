import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  ArrowLeft,
  CircleAlert,
  Clock,
  Plus,
  RotateCw,
  SquarePen,
  Trash2,
  Webhook as WebhookIcon,
  Zap,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../services/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Switch } from '../components/ui/switch'
import { Checkbox } from '../components/ui/checkbox'
import { FieldError } from '../components/ui/field'
import { Alert, AlertDescription, AlertTitle } from '../components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { PageHeader } from '../components/app/PageHeader'
import { Panel } from '../components/app/Panel'
import { StatCard } from '../components/app/StatCard'
import { StatGrid } from '../components/app/Grids'
import { Pill } from '../components/app/SeverityBadge'
import { CopyButton, InlineCode } from '../components/app/CodeBlock'
import { DeliveryList } from '../components/app/IntegrationDelivery'
import { eventLabel, integrationErrorText } from '../lib/integrations'
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState'
import { formatRelativeTime } from '../lib/utils'

const ALLOWED_PORTS = new Set(['', '443', '8443'])
const DELIVERY_PAGE_SIZE = 20

/** The event types the server will actually publish. `*` subscribes to all of them. */
const EVENT_TYPES = [
  { value: '*', label: 'All current and future events' },
  { value: 'scan.completed', label: 'Audit completed' },
  { value: 'scan.failed', label: 'Audit failed' },
  { value: 'finding.triaged', label: 'Finding triaged' },
  { value: 'integration.test', label: 'Integration test send' },
]

const EVENT_LABELS = EVENT_TYPES.reduce(
  (acc, event) => ({ ...acc, [event.value]: event.label }),
  {}
)

const EMPTY_FORM = { name: '', url: '', events: [], enabled: true }

function isAllowedEndpointUrl(value) {
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      ALLOWED_PORTS.has(url.port) &&
      value.length <= 1024
    )
  } catch {
    return false
  }
}

function validateForm(form) {
  const errors = {}

  const name = form.name.trim()
  if (!name) errors.name = 'Give the endpoint a name you will recognise later.'
  else if (name.length > 120) errors.name = 'Keep the name under 120 characters.'

  const url = form.url.trim()
  if (!url) errors.url = 'Enter the HTTPS endpoint that should receive events.'
  else if (!isAllowedEndpointUrl(url))
    errors.url =
      'Use a full https:// URL on port 443 or 8443, without credentials in it.'

  if (form.events.length === 0) errors.events = 'Subscribe to at least one event.'

  return errors
}

export function WebhooksConfig() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()
  const [state, setState] = useState({
    loading: false,
    error: null,
    webhooks: [],
    deliveries: [],
    serverDisabled: false,
  })
  const [attempt, setAttempt] = useState(0)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState({})
  const [pendingDelete, setPendingDelete] = useState(null)
  const [reveal, setReveal] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!workspaceId) return

    let cancelled = false

    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const [webhooks, page, status] = await Promise.all([
          api.getWebhooks(workspaceId),
          api
            .getDeliveries(workspaceId, { channel: 'webhook', limit: DELIVERY_PAGE_SIZE })
            .then((result) => result.items || [])
            .catch(() => []),
          api.getSystemStatus().catch(() => null),
        ])
        if (cancelled) return
        setState({
          loading: false,
          error: null,
          webhooks: webhooks || [],
          deliveries: page,
          serverDisabled: Boolean(status && status.integrations !== 'enabled'),
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

  const reloadDeliveries = async () => {
    try {
      const page = await api.getDeliveries(workspaceId, {
        channel: 'webhook',
        limit: DELIVERY_PAGE_SIZE,
      })
      setState((s) => ({ ...s, deliveries: page.items || [] }))
    } catch {
      // The log is secondary; a failed refresh must not undo the action that ran.
    }
  }

  const setFormValue = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    setFormErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  /** `*` means "everything", so selecting it clears the specific choices. */
  const toggleEvent = (value) => {
    const selected = form.events.includes(value)
    const next = selected
      ? form.events.filter((event) => event !== value)
      : value === '*'
        ? ['*']
        : [...form.events.filter((event) => event !== '*'), value]
    setFormValue('events', next)
  }

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormErrors({})
    setDialogOpen(true)
  }

  const openEdit = (webhook) => {
    setEditing(webhook)
    setForm({
      name: webhook.name,
      url: webhook.url,
      events: webhook.events || [],
      enabled: Boolean(webhook.enabled),
    })
    setFormErrors({})
    setDialogOpen(true)
  }

  async function submitForm() {
    const errors = validateForm(form)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      toast.warning('Check the highlighted fields')
      return
    }
    setSaving(true)
    const body = {
      name: form.name.trim(),
      url: form.url.trim(),
      events: form.events,
      enabled: form.enabled,
    }
    try {
      const saved = editing
        ? await api.updateWebhook(workspaceId, editing.id, body)
        : await api.createWebhook(workspaceId, body)

      // The generated key exists in this response and never in any later one,
      // so the reveal is the only chance to copy it. It goes to the reveal
      // dialog alone - the list row keeps only the masked hint.
      const { secret, ...row } = saved
      setState((s) => ({
        ...s,
        webhooks: editing
          ? s.webhooks.map((item) => (item.id === row.id ? row : item))
          : [row, ...s.webhooks],
      }))
      setDialogOpen(false)
      if (editing) {
        toast.success('Webhook updated')
        return
      }
      setReveal({ name: row.name, secret, hint: row.secret_hint })
      toast.success('Webhook registered', {
        description:
          'Copy the signing secret now - Vulnix stores it encrypted and will not show it again.',
      })
    } catch (error) {
      toast.error(editing ? 'Could not update the webhook' : 'Could not register the webhook', {
        description: integrationErrorText(error),
      })
    } finally {
      setSaving(false)
    }
  }

  async function confirmDelete() {
    const target = pendingDelete
    setPendingDelete(null)
    if (!target) return
    try {
      await api.deleteWebhook(workspaceId, target.id)
      setState((s) => ({ ...s, webhooks: s.webhooks.filter((row) => row.id !== target.id) }))
      toast.success('Webhook removed', {
        description: 'Queued deliveries for it are parked as dead letters rather than retried.',
      })
    } catch (error) {
      toast.error('Could not remove the webhook', { description: integrationErrorText(error) })
    }
  }

  async function toggleEnabled(webhook, checked) {
    setBusyId(webhook.id)
    try {
      const saved = await api.updateWebhook(workspaceId, webhook.id, { enabled: checked })
      setState((s) => ({
        ...s,
        webhooks: s.webhooks.map((row) => (row.id === saved.id ? saved : row)),
      }))
    } catch (error) {
      toast.error('Could not change this webhook', { description: integrationErrorText(error) })
    } finally {
      setBusyId(null)
    }
  }

  /**
   * The recovery path for a lost or leaked key. Rotation is the only way to read
   * a signing secret again, and the receiving endpoint has to be updated to match.
   */
  async function rotate(webhook) {
    setBusyId(webhook.id)
    try {
      const { secret, ...row } = await api.rotateWebhookSecret(workspaceId, webhook.id)
      setState((s) => ({
        ...s,
        webhooks: s.webhooks.map((item) => (item.id === row.id ? row : item)),
      }))
      setReveal({ name: row.name, secret, hint: row.secret_hint })
    } catch (error) {
      toast.error('Could not generate a new secret', { description: integrationErrorText(error) })
    } finally {
      setBusyId(null)
    }
  }

  async function sendTest(webhook) {
    setBusyId(webhook.id)
    try {
      const result = await api.testWebhook(workspaceId, webhook.id)
      await reloadDeliveries()
      if (result.ok) {
        toast.success('Test event delivered', {
          description: `${webhook.name} answered with a success status.`,
        })
        return
      }
      const code = result.delivery.last_error_code || 'DELIVERY_FAILED'
      toast.error('Your endpoint did not accept the test event', {
        description: `${integrationErrorText({ code })} (${code})`,
      })
    } catch (error) {
      toast.error('Test could not be sent', { description: integrationErrorText(error) })
    } finally {
      setBusyId(null)
    }
  }

  async function redeliver(delivery) {
    setBusyId(delivery.id)
    try {
      await api.redeliverDelivery(workspaceId, delivery.id)
      await reloadDeliveries()
      toast.success('Delivery requeued')
    } catch (error) {
      toast.error('Could not requeue this delivery', { description: integrationErrorText(error) })
    } finally {
      setBusyId(null)
    }
  }

  const header = (
    <PageHeader
      breadcrumb={[{ label: 'Integrations', to: '/app/integrations' }, { label: 'Webhooks' }]}
      title="Webhooks"
      description="POST signed audit and triage events to an HTTPS endpoint of your own."
      meta={
        <>
          <Pill tone="neutral" icon={WebhookIcon}>
            Event delivery
          </Pill>
          <Pill tone="neutral" dot="bg-border-strong">
            {state.webhooks.length} endpoints
          </Pill>
        </>
      }
      actions={
        <>
          <Button variant="outline" render={<Link to="/app/integrations" />}>
            <ArrowLeft data-icon="inline-start" />
            Back
          </Button>
          <Button onClick={openCreate}>
            <Plus data-icon="inline-start" />
            Add webhook
          </Button>
        </>
      }
    />
  )

  if (wsLoading) return <div className="console-enter space-y-4">{header}</div>
  if (wsError)
    return (
      <div className="console-enter space-y-4">
        {header}
        <ErrorState
          title="Workspace unavailable"
          description={wsError}
          tone="danger"
          actions={<Button variant="outline" onClick={retryWorkspace}>Try again</Button>}
        />
      </div>
    )

  if (state.loading)
    return (
      <div className="console-enter space-y-4">
        {header}
        <Panel title="Endpoints">
          <LoadingState label="Loading webhooks" />
        </Panel>
      </div>
    )

  if (state.error)
    return (
      <div className="console-enter space-y-4">
        {header}
        <ErrorState
          title="Could not load webhooks"
          description={state.error}
          tone="danger"
          actions={
            <Button variant="outline" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </Button>
          }
        />
      </div>
    )

  const enabledCount = state.webhooks.filter((row) => row.enabled).length
  const deadCount = state.deliveries.filter((row) => row.status === 'dead').length

  return (
    <div className="console-enter mx-auto w-full max-w-[1120px] space-y-4">
      {header}

      {state.serverDisabled && (
        <Alert>
          <CircleAlert />
          <AlertTitle>Outbound integrations are disabled on this server</AlertTitle>
          <AlertDescription>
            Endpoints can still be listed here, but registering, editing and testing are refused
            until an administrator sets VULNIX_INTEGRATIONS_ENABLED. Egress is off by default so
            that a workspace webhook can never become an internal network proxy.
          </AlertDescription>
        </Alert>
      )}

      <StatGrid columns={3}>
        <StatCard
          icon={WebhookIcon}
          label="Configured endpoints"
          value={state.webhooks.length}
          hint="Stored on the server"
        />
        <StatCard
          icon={Zap}
          label="Enabled"
          value={enabledCount}
          hint="Paused endpoints receive nothing"
          tone="green"
        />
        <StatCard
          icon={Activity}
          label="Dead letters"
          value={deadCount}
          hint={`In the ${state.deliveries.length} most recent webhook deliveries`}
          tone="amber"
        />
      </StatGrid>

      {state.webhooks.length === 0 ? (
        <Panel>
          <EmptyState
            icon={WebhookIcon}
            title="No webhooks registered"
            description="Register an endpoint and Vulnix will POST signed events to it whenever an audit finishes, fails, or a finding is triaged."
            action={
              <Button onClick={openCreate}>
                <Plus data-icon="inline-start" />
                Add webhook
              </Button>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {state.webhooks.map((webhook) => (
            <WebhookRow
              key={webhook.id}
              webhook={webhook}
              lastDelivery={state.deliveries.find((row) => row.target_id === webhook.id)}
              busy={busyId === webhook.id}
              onEdit={() => openEdit(webhook)}
              onDelete={() => setPendingDelete(webhook)}
              onTest={() => sendTest(webhook)}
              onRotate={() => rotate(webhook)}
              onToggle={(checked) => toggleEnabled(webhook, checked)}
            />
          ))}
        </div>
      )}

      <Panel
        title="Delivery log"
        description={`The ${state.deliveries.length} most recent webhook attempts for this workspace`}
      >
        <DeliveryList
          deliveries={state.deliveries}
          onRedeliver={redeliver}
          busyId={busyId}
          emptyLabel="Nothing has been posted to an endpoint yet. Use Send test on one to record the first attempt."
        />
      </Panel>

      <Panel title="How delivery works" description="What your endpoint has to do">
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Each attempt is a JSON POST carrying{' '}
            <InlineCode>x-vulnix-signature: v1=&lt;hmac-sha256&gt;</InlineCode>,{' '}
            <InlineCode>x-vulnix-timestamp</InlineCode>, <InlineCode>x-vulnix-event</InlineCode> and{' '}
            <InlineCode>x-vulnix-delivery</InlineCode>. HMAC the raw request body with your signing
            secret and compare it before trusting the payload. Vulnix generates that secret when the
            endpoint is created and shows it once - rotate it from the card whenever the receiving
            side needs a new one.
          </p>
          <p>
            Before every attempt Vulnix resolves the host and refuses it if it points at a private,
            loopback, link-local or metadata address. Redirects are not followed, the response body
            is capped, and the request times out after a few seconds.
          </p>
          <p>
            A non-2xx answer, a timeout or a refused address is retried with exponential backoff up
            to five attempts, then parked as a dead letter for you to requeue from the log above.
          </p>
          <p>
            Payloads carry identifiers and severity counts only - never source code, file paths,
            evidence or credentials. Free-text fields such as a project name are redacted and
            truncated first.
          </p>
        </div>
      </Panel>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit webhook' : 'Create webhook'}</DialogTitle>
            <DialogDescription>
              Name the endpoint, point it at your service and pick the events it should receive.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-name">Name</Label>
              <Input
                id="webhook-name"
                value={form.name}
                onChange={(event) => setFormValue('name', event.target.value)}
                placeholder="Security desk inbox"
                aria-invalid={Boolean(formErrors.name) || undefined}
              />
              <FieldError>{formErrors.name}</FieldError>
            </div>

            <div className="space-y-2">
              <Label htmlFor="webhook-url">Endpoint URL</Label>
              <Input
                id="webhook-url"
                type="url"
                inputMode="url"
                value={form.url}
                onChange={(event) => setFormValue('url', event.target.value)}
                placeholder="https://example.com/security/webhooks/vulnix"
                aria-invalid={Boolean(formErrors.url) || undefined}
              />
              <p className="text-xs text-muted-foreground">
                HTTPS on port 443 or 8443, able to accept POST with a JSON body. Addresses that
                resolve to your internal network are refused.
              </p>
              <FieldError>{formErrors.url}</FieldError>
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-sm font-medium text-foreground">Events to subscribe</legend>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {EVENT_TYPES.map((event) => (
                  <div key={event.value} className="flex min-w-0 items-center gap-2">
                    <Checkbox
                      id={`event-${event.value}`}
                      checked={form.events.includes(event.value)}
                      onCheckedChange={() => toggleEvent(event.value)}
                    />
                    <Label
                      htmlFor={`event-${event.value}`}
                      className="min-w-0 cursor-pointer font-normal"
                    >
                      <span className="truncate">{event.label}</span>
                    </Label>
                  </div>
                ))}
              </div>
              <FieldError>{formErrors.events}</FieldError>
            </fieldset>

            <div className="space-y-2 rounded-lg border border-border bg-muted/40 p-3">
              <Label className="text-foreground">Signing secret</Label>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {editing
                  ? 'The stored key stays as it is. Generate a new one from the webhook card if the receiving service needs to change it.'
                  : 'Vulnix generates a strong signing key when the endpoint is created and shows it once, so there is nothing to invent or paste here.'}
              </p>
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
              <div className="min-w-0">
                <Label htmlFor="webhook-enabled" className="cursor-pointer">
                  Enabled
                </Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pause delivery without deleting the endpoint.
                </p>
              </div>
              <Switch
                id="webhook-enabled"
                checked={form.enabled}
                onCheckedChange={(checked) => setFormValue('enabled', checked)}
                className="shrink-0"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Update' : 'Create'} webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={reveal !== null}
        onOpenChange={(open) => {
          if (!open) setReveal(null)
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Signing secret for {reveal?.name}</DialogTitle>
            <DialogDescription>
              Copy it into your endpoint&apos;s verifier settings now. It is stored encrypted and no
              listing ever returns it again, so this is the only time it can be read.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex min-w-0 items-start gap-2">
              <span className="min-w-0 flex-1 break-all rounded-md border border-border bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
                {reveal?.secret}
              </span>
              <CopyButton value={reveal?.secret || ''} label="Copy signing secret" className="shrink-0" />
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              HMAC the raw request body with it and compare the result against the{' '}
              <InlineCode>x-vulnix-signature</InlineCode> header before trusting a payload. If this
              value is lost, generate a new one from the webhook card - deliveries signed with the
              old key will then fail verification until the endpoint is updated.
            </p>
            {reveal?.hint && (
              <p className="text-xs text-muted-foreground">
                Stored as <InlineCode>{reveal.hint}</InlineCode>.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button onClick={() => setReveal(null)}>I&apos;ve saved it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this webhook?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete?.name || 'This webhook'} stops receiving events immediately, and its
              signing secret is deleted. Deliveries already recorded stay in the log.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Remove webhook</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

const SECTION_LABEL = 'text-xs font-medium text-muted-foreground'

function WebhookRow({ webhook, lastDelivery, busy, onEdit, onDelete, onTest, onRotate, onToggle }) {
  return (
    <Panel
      title={webhook.name}
      actions={
        <>
          <Pill tone={webhook.enabled ? 'success' : 'neutral'}>
            {webhook.enabled ? 'Enabled' : 'Paused'}
          </Pill>
          <Button variant="outline" size="icon-sm" aria-label={`Edit ${webhook.name}`} onClick={onEdit}>
            <SquarePen />
          </Button>
          <Button
            variant="destructive"
            size="icon-sm"
            aria-label={`Remove ${webhook.name}`}
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="min-w-0">
          <p className={SECTION_LABEL}>Endpoint</p>
          <div className="mt-2 flex min-w-0 items-start gap-2">
            <span className="min-w-0 flex-1 break-all rounded-md border border-border bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
              {webhook.url}
            </span>
            <CopyButton value={webhook.url} label="Copy URL" className="shrink-0" />
          </div>
        </div>

        <div className="min-w-0">
          <p className={SECTION_LABEL}>Subscribed events</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(webhook.events || []).length === 0 ? (
              <span className="text-sm text-muted-foreground">No events selected.</span>
            ) : (
              webhook.events.map((event) => (
                <Pill key={event} tone="neutral">
                  {EVENT_LABELS[event] || eventLabel(event)}
                </Pill>
              ))
            )}
          </div>
        </div>

        <div className="min-w-0">
          <p className={SECTION_LABEL}>Signing secret</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="min-w-0 rounded-md border border-border bg-muted px-2 py-1.5 font-mono text-xs text-foreground">
              {webhook.configured ? webhook.secret_hint : 'None recorded'}
            </span>
            <span className="min-w-0 flex-1 text-xs leading-relaxed text-muted-foreground">
              {webhook.configured
                ? 'Generated by Vulnix and stored encrypted. Only its last characters are ever shown.'
                : 'Generate one to sign the deliveries this endpoint receives.'}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={onRotate}
              disabled={busy}
              className="shrink-0"
            >
              <RotateCw data-icon="inline-start" />
              {webhook.configured ? 'Rotate secret' : 'Generate secret'}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {lastDelivery ? (
              <span className="flex min-w-0 items-center gap-1.5">
                <Clock className="size-4 shrink-0" />
                <span className="truncate">
                  Last {eventLabel(lastDelivery.event_type)} {formatRelativeTime(lastDelivery.created_at)}
                </span>
              </span>
            ) : (
              <span>No delivery recorded yet</span>
            )}
            <span className="flex items-center gap-2">
              <Label htmlFor={`webhook-${webhook.id}-enabled`} className="cursor-pointer font-normal">
                Enabled
              </Label>
              <Switch
                id={`webhook-${webhook.id}-enabled`}
                checked={Boolean(webhook.enabled)}
                onCheckedChange={onToggle}
                disabled={busy}
              />
            </span>
          </div>
          <Button variant="outline" size="sm" onClick={onTest} disabled={busy} className="shrink-0">
            Send test
          </Button>
        </div>
      </div>
    </Panel>
  )
}
