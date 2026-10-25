import { useState, useRef, useCallback, useEffect } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { toast } from 'sonner'
import {
  ArrowRight,
  FileArchive,
  Info,
  Search,
  ShieldCheck,
  Bot,
  Upload,
  X,
} from 'lucide-react'
import { GitHub } from '../components/icons'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Switch } from '../components/ui/switch'
import { Alert, AlertDescription } from '../components/ui/alert'
import { Progress } from '../components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs'
import { PageStack } from '../components/app/Grids'
import { PageHeader } from '../components/app/PageHeader'
import { Spinner } from '../components/app/Spinner'
import { Pill } from '../components/app/SeverityBadge'
import { EmptyState, ErrorState, LoadingState } from '../components/EmptyState'
import { UPLOAD_LIMITS, API_BASE_URL } from '../lib/constants'
import { cn, formatFileSize } from '../lib/utils'
import { integrationErrorText } from '../lib/integrations'
import { api, getAuthHeaders } from '../services/api'
import { useWorkspace } from '../hooks/useWorkspace'

/**
 * Upload the ZIP and report byte progress via XHR — fetch()/api.createUpload
 * expose no upload events, so progress is impossible without it. The request is
 * still pointed at the API base URL and authenticated through the api module.
 */
function uploadWithProgress(projectId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE_URL}/projects/${projectId}/uploads`)

    const auth = getAuthHeaders()
    if (auth.Authorization) xhr.setRequestHeader('Authorization', auth.Authorization)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.onload = () => {
      let body = null
      try {
        body = JSON.parse(xhr.responseText)
      } catch {
        /* non-JSON error body */
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(body)
      } else {
        reject(new Error(body?.error?.message || body?.message || `Upload failed with status ${xhr.status}`))
      }
    }

    const form = new FormData()
    form.append('file', file)
    xhr.send(form)
  })
}

const OPTION_ROWS = [
  {
    key: 'agent_review',
    label: 'AI review',
    description: 'Review source code for security issues.',
  },
  {
    key: 'static_analysis',
    label: 'Static analysis',
    description: 'Semgrep and Bandit, when installed.',
  },
  {
    key: 'secrets',
    label: 'Secret detection',
    description: 'Find exposed credentials with Gitleaks.',
  },
  {
    key: 'dependencies',
    label: 'Dependency analysis',
    description: 'Check packages for known vulnerabilities.',
  },
]

const EMPTY_REPOS = {
  loading: false,
  error: null,
  list: [],
  allowed: [],
  byId: new Map(),
  truncated: false,
}

export function NewScan() {
  const navigate = useNavigate()
  const { projectId } = useParams()

  const [source, setSource] = useState('github')
  const [file, setFile] = useState(null)
  const [error, setError] = useState(null)
  const [options, setOptions] = useState({
    agent_review: true,
    static_analysis: true,
    secrets: true,
    dependencies: true,
  })

  const [phase, setPhase] = useState('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const fileInputRef = useRef(null)

  const { workspaceId } = useWorkspace()
  const [reloadAttempt, setReloadAttempt] = useState(0)
  const [proj, setProj] = useState({ loading: true, error: null, data: null })
  const [projects, setProjects] = useState([])

  const [githubAccess, setGithubAccess] = useState({ loading: true, connected: false })
  const [repoPage, setRepoPage] = useState(1)
  const [repoAttempt, setRepoAttempt] = useState(0)
  const [repos, setRepos] = useState(EMPTY_REPOS)
  const [query, setQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [target, setTarget] = useState({ repoId: '', ref: '' })

  useEffect(() => {
    if (!projectId) return
    let cancelled = false

    async function run() {
      setProj({ loading: true, error: null, data: null })
      try {
        const p = await api.getProject(projectId)
        if (!cancelled) setProj({ loading: false, error: null, data: p })
      } catch (e) {
        if (!cancelled)
          setProj({ loading: false, error: e.message || 'Could not load this project.', data: null })
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [projectId, reloadAttempt])

  // Powers the "scan a different project" switcher.
  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    api
      .getProjects(workspaceId, { limit: 100 })
      .then((page) => !cancelled && setProjects(page.items || []))
      .catch(() => !cancelled && setProjects([]))
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    setGithubAccess({ loading: true, connected: false })
    api
      .getConnections(workspaceId)
      .then((links) => {
        if (cancelled) return
        setGithubAccess({
          loading: false,
          connected: (links || []).some((row) => row.provider === 'github'),
        })
      })
      .catch(() => !cancelled && setGithubAccess({ loading: false, connected: false }))
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  // GitHub's App installation determines access; this list is the current
  // installation's repository set, not a second Vulnix-side allowlist.
  useEffect(() => {
    if (!workspaceId || !githubAccess.connected) return
    let cancelled = false

    async function load() {
      setRepos((s) => ({ ...s, loading: true, error: null }))
      try {
        const data = await api.getGitHubRepositories(workspaceId, repoPage, query.trim())
        if (cancelled) return
        const list = data?.repositories || []
        const allowed = list
        setRepos({
          loading: false,
          error: null,
          list,
          allowed,
          byId: new Map(allowed.map((row) => [String(row.id), row])),
          truncated: Boolean(data?.truncated),
        })
      } catch (err) {
        if (cancelled) return
        setRepos((s) => ({ ...s, loading: false, error: integrationErrorText(err) }))
      }
    }

    const debounce = setTimeout(load, query.trim() ? 300 : 0)
    return () => {
      cancelled = true
      clearTimeout(debounce)
    }
  }, [workspaceId, githubAccess.connected, repoPage, repoAttempt, query])

  const visible = repos.list

  const selectedRepo = target.repoId ? repos.byId.get(String(target.repoId)) : null

  const chooseFile = (candidate) => {
    setError(null)
    if (!candidate) return
    if (!candidate.name.toLowerCase().endsWith('.zip')) {
      setError('That file isn’t a .zip archive.')
      return
    }
    if (candidate.size > UPLOAD_LIMITS.MAX_SIZE_BYTES) {
      setError(
        `Archive is ${formatFileSize(candidate.size)}. The maximum accepted size is ${formatFileSize(
          UPLOAD_LIMITS.MAX_SIZE_BYTES
        )}.`
      )
      return
    }
    setFile(candidate)
  }

  const startScan = useCallback(
    async (uploadId) => {
      setPhase('creating')
      const scan = await api.createScan(projectId, { upload_id: uploadId, options }, crypto.randomUUID())
      setPhase('launched')
      toast.success('Audit started', {
        description: 'Archive stored. Opening the audit to follow its progress.',
      })
      navigate(`/app/audits/runs/${scan.id}`, { replace: true })
    },
    [projectId, options, navigate]
  )

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault()
      setError(null)

      try {
        if (source === 'github') {
          if (!target.repoId) {
            setError('Pick a repository to audit.')
            return
          }
          setPhase('fetching')
          const upload = await api.importGitHubRepository(
            projectId,
            Number(target.repoId),
            target.ref.trim()
          )
          await startScan(upload.id)
          return
        }

        if (!file) {
          setError('Select a ZIP archive first.')
          return
        }
        setPhase('uploading')
        setUploadProgress(0)
        const upload = await uploadWithProgress(projectId, file, setUploadProgress)
        await startScan(upload.id)
      } catch (err) {
        setPhase('idle')
        const message = err?.message || integrationErrorText(err) || 'Could not start the audit'
        setError(message)
        toast.error('Could not start the audit', { description: message })
      }
    },
    [source, target, file, projectId, startScan]
  )

  const busy = phase === 'uploading' || phase === 'fetching' || phase === 'creating'
  const projectName = proj.data?.name || 'This project'

  const header = (
    <PageHeader
      title="New audit"
      breadcrumb={[
        { label: 'Projects', to: '/app/projects' },
        { label: projectName, to: `/app/projects/${projectId}` },
        { label: 'New audit' },
      ]}
      description={`Configure a security review for ${projectName}.`}
    />
  )

  if (proj.loading) {
    return (
      <PageStack className="mx-auto max-w-4xl">
        {header}
        <LoadingState label="Loading project" />
      </PageStack>
    )
  }

  if (proj.error) {
    return (
      <PageStack className="mx-auto max-w-4xl">
        {header}
        <div>
          <ErrorState
            title="We couldn’t load this project"
            description={proj.error}
            onRetry={() => setReloadAttempt((a) => a + 1)}
          />
        </div>
      </PageStack>
    )
  }

  return (
    <PageStack className="mx-auto max-w-4xl space-y-8">
      {header}

      <form onSubmit={handleSubmit} className="space-y-8">
        {projects.length > 1 && (
          <div className="flex flex-col gap-2 border-b border-border pb-6 sm:flex-row sm:items-center sm:justify-between">
            <Label htmlFor="audit-project" className="text-sm font-medium">Project</Label>
            <Select value={projectId} onValueChange={(v) => navigate(`/app/projects/${v}/scan`)}>
              <SelectTrigger id="audit-project" className="w-full sm:w-80" aria-label="Select project">
                <SelectValue placeholder="Select a project">
                  {(val) => projects.find((p) => p.id === val)?.name || val || 'Select a project'}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <section className="space-y-4 border-b border-border pb-7">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Source</h2>
            <p className="mt-1 text-xs text-muted-foreground">Choose where to get the code.</p>
          </div>
          <Tabs value={source} onValueChange={(value) => !busy && setSource(value)}>
            <TabsList aria-label="Source" className="h-11 w-full max-w-md rounded-lg p-1">
              <TabsTrigger value="github" className="gap-2 rounded-lg data-active:text-primary">
                <GitHub className="size-4" aria-hidden />
                GitHub
              </TabsTrigger>
              <TabsTrigger value="zip" className="gap-2 rounded-lg data-active:text-primary">
                <FileArchive className="size-4" aria-hidden />
                Upload ZIP
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </section>

        {source === 'github' ? (
          <section className="space-y-5 border-b border-border pb-7">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Repository</h2>
              <p className="mt-1 text-xs text-muted-foreground">Select a repository and branch.</p>
            </div>
            {githubAccess.loading ? (
              <LoadingState label="Checking your GitHub approval" />
            ) : !githubAccess.connected ? (
              <EmptyState
                icon={GitHub}
                title="GitHub isn’t connected to this workspace"
                description="Approve Vulnix once in GitHub’s own window and the repositories you allow will appear here."
                action={
                  <Button type="button" render={<Link to="/app/integrations/github" />}>
                    Connect GitHub
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                }
              />
            ) : repos.error ? (
              <ErrorState
                title="Could not read your repositories"
                description={repos.error}
                onRetry={() => setRepoAttempt((n) => n + 1)}
              />
            ) : repos.loading && repos.allowed.length === 0 ? (
              <LoadingState label="Reading repositories available to the GitHub App" />
            ) : repos.allowed.length === 0 ? (
              <EmptyState
                icon={GitHub}
                title={query.trim() ? 'No matching repositories' : 'No repositories installed'}
                description={
                  query.trim()
                    ? `No installed repositories match “${query}”.`
                    : 'Choose repositories for the Vulnix GitHub App in GitHub. They will appear here automatically; no separate Vulnix access list is needed.'
                }
                action={
                  !query.trim() && (
                    <Button variant="outline" render={<Link to="/app/integrations/github" />}>
                      Manage GitHub App access
                      <ArrowRight data-icon="inline-end" />
                    </Button>
                  )
                }
              />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    Select a repository and branch to start this audit.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    render={<Link to="/app/integrations/github" />}
                  >
                    Browse repositories
                    <ArrowRight data-icon="inline-end" />
                  </Button>
                </div>
                <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="scan-repo">Repository</Label>
                    <Select
                      value={target.repoId}
                      onValueChange={(value) =>
                        setTarget({ repoId: value ?? '', ref: '' })
                      }
                      disabled={busy}
                    >
                      <SelectTrigger id="scan-repo" className="w-full">
                        <SelectValue placeholder="One you allowed">
                          {(val) =>
                            repos.byId?.get(String(val))?.full_name ||
                            repos.allowed.find((r) => String(r.id) === String(val))?.full_name ||
                            val ||
                            'One you allowed'
                          }
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {repos.allowed.map((repo) => (
                          <SelectItem key={repo.id} value={String(repo.id)}>
                            {repo.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="scan-ref">Branch or tag</Label>
                    <Input
                      id="scan-ref"
                      value={target.ref}
                      onChange={(event) => setTarget((s) => ({ ...s, ref: event.target.value }))}
                      placeholder={selectedRepo?.default_branch || 'main'}
                      disabled={busy || !selectedRepo}
                      aria-describedby="scan-ref-hint"
                    />
                    <p id="scan-ref-hint" className="text-xs text-muted-foreground">
                      {selectedRepo
                        ? `Default: ${selectedRepo.default_branch || 'main'}`
                        : 'Select a repository.'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  <p className="text-xs text-muted-foreground">
                    {repos.allowed.length} available on this page
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuery('')
                      setRepoPage(1)
                      setPickerOpen(true)
                    }}
                    disabled={busy}
                  >
                    Browse repositories
                  </Button>
                </div>
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-5 border-b border-border pb-7">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Upload ZIP</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {formatFileSize(UPLOAD_LIMITS.MAX_SIZE_BYTES)} maximum
              </p>
            </div>
            <div className="space-y-3">
              <div
                className="rounded-xl border-2 border-dashed border-border bg-muted/20 p-8 text-center transition-colors hover:border-primary/40 hover:bg-primary-subtle/40"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  chooseFile(e.dataTransfer.files?.[0])
                }}
              >
                <input
                  ref={fileInputRef}
                  id="archive"
                  type="file"
                  accept=".zip"
                  aria-label="Choose a ZIP archive to upload"
                  className="sr-only"
                  onChange={(e) => chooseFile(e.target.files?.[0])}
                  disabled={busy}
                />
                {!file ? (
                  <>
                    <Upload className="mx-auto size-6 text-muted-foreground" aria-hidden />
                    <p className="mt-3 text-sm font-medium text-foreground">Drop your project ZIP here</p>
                    <Button
                      type="button"
                      variant="outline"
                      className="mt-4 active:scale-[0.98]"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={busy}
                    >
                      Choose file
                    </Button>
                  </>
                ) : (
                  <div className="flex items-center justify-center gap-3 text-left">
                    <FileArchive className="size-6 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-sm text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                    {!busy && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Remove file"
                        onClick={() => setFile(null)}
                      >
                        <X />
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {phase === 'idle' && 'Upload progress'}
                    {phase === 'uploading' && 'Uploading…'}
                    {(phase === 'creating' || phase === 'launched') && 'Upload complete'}
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {phase === 'idle' ? 0 : phase === 'uploading' ? uploadProgress : 100}%
                  </span>
                </div>
                <Progress
                  value={phase === 'idle' ? 0 : phase === 'uploading' ? uploadProgress : 100}
                />
              </div>
            </div>
          </section>
        )}

        {error && (
          <Alert variant="destructive">
            <Info />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <section className="space-y-4 border-b border-border pb-7">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Checks</h2>
            <p className="mt-1 text-xs text-muted-foreground">Choose what to include.</p>
          </div>
          <div className="grid gap-x-8 divide-y divide-border sm:grid-cols-2 sm:divide-y-0">
            {OPTION_ROWS.map((option) => (
              <div
                key={option.key}
                className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0 sm:border-b"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Label htmlFor={option.key}>{option.label}</Label>
                    {option.key === 'agent_review' && (
                      <Pill tone="ai" icon={Bot}>
                        Core
                      </Pill>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{option.description}</p>
                </div>
                <Switch
                  id={option.key}
                  checked={options[option.key]}
                  disabled={busy}
                  onCheckedChange={(checked) =>
                    setOptions((prev) => ({ ...prev, [option.key]: checked }))
                  }
                />
              </div>
            ))}
          </div>
          {OPTION_ROWS.every((option) => !options[option.key]) && (
            <Alert variant="destructive" className="mt-4">
              <Info />
              <AlertDescription>
                Turn on at least one check.
              </AlertDescription>
            </Alert>
          )}
        </section>

        {phase !== 'idle' && (
          <section className="border-b border-border pb-6">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Audit progress</h2>
            <ScanPhase phase={phase} />
          </section>
        )}

        <div className="flex items-center justify-end gap-3 border-t border-border pt-5">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/app/projects/${projectId}`)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="lg"
            className="min-w-36 shadow-sm transition-[transform,box-shadow] active:scale-[0.98] hover:shadow"
            disabled={busy || (source === 'zip' && !file)}
          >
            {busy ? 'Starting…' : 'Start audit'}
            {!busy && <ArrowRight data-icon="inline-end" />}
          </Button>
        </div>
      </form>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Repositories Vulnix may read</DialogTitle>
            <DialogDescription>
              Every name here came from GitHub under your own approval. Nothing outside this list can
              be fetched, whatever a request claims.
            </DialogDescription>
          </DialogHeader>

          <div className="relative min-w-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setRepoPage(1)
                setQuery(event.target.value)
              }}
              placeholder="Search all GitHub repositories"
              className="pl-8.5"
              aria-label="Search GitHub repositories"
            />
          </div>

          <div className="max-h-[360px] min-w-0 overflow-y-auto divide-y divide-border">
            {repos.loading ? (
              <LoadingState label="Reading repositories from GitHub" />
            ) : visible.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {query.trim()
                  ? `No repositories match “${query}”.`
                  : 'No repositories are available from this GitHub installation.'}
              </p>
            ) : (
              visible.map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => {
                    setTarget({ repoId: String(repo.id), ref: '' })
                    setPickerOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-start gap-3 px-3 py-2.5 text-left',
                    'transition-colors duration-150 ease-smooth hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none'
                  )}
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
                      {repo.default_branch || 'no branch yet'}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRepoPage((p) => Math.max(1, p - 1))}
                disabled={repoPage <= 1}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">Page {repoPage}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRepoPage((p) => p + 1)}
                disabled={!repos.truncated}
              >
                Next
                <ArrowRight data-icon="inline-end" />
              </Button>
            </div>
            {repos.truncated && (
              <p className="text-xs text-muted-foreground">
                More installed repositories are available.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setPickerOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageStack>
  )
}

function ScanPhase({ phase }) {
  if (phase === 'fetching') {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" label="Fetching repository" />
        GitHub is packing that ref and Vulnix is pulling the archive down.
      </div>
    )
  }
  if (phase === 'uploading' || phase === 'creating') {
    return <LoadingState label={phase === 'uploading' ? 'Uploading archive' : 'Queueing the audit'} />
  }
  if (phase === 'launched') {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" aria-hidden />
          Audit queued. Follow live progress on the audit page.
        </div>
        <Pill tone="neutral" icon={ShieldCheck}>
          Queued
        </Pill>
      </div>
    )
  }
  return null
}
