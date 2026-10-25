import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Plus,
  FolderKanban,
  Clock,
  MoreVertical,
  ScanSearch,
  Eye,
  Trash2,
  Loader2,
  ArrowRight,
  GitBranch,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
import { CardGrid, PageStack, StatGrid } from '../components/app/Grids'
import { PageHeader } from '../components/app/PageHeader'
import { Toolbar } from '../components/app/Toolbar'
import { Panel } from '../components/app/Panel'
import { StatCard } from '../components/app/StatCard'
import { ViewToggle } from '../components/app/ViewToggle'
import { useViewPreference } from '../hooks/useViewPreference'
import { Pill } from '../components/app/SeverityBadge'
import { EmptyState, ErrorState, PanelsSkeleton } from '../components/EmptyState'
import { formatRelativeTime } from '../lib/utils'
import { api } from '../services/api'
import { useWorkspace } from '../hooks/useWorkspace'

const SOURCE_LABELS = {
  zip_upload: 'ZIP upload',
  git_import: 'Git import',
}

const PAGE_SIZE = 24

export function Projects() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()
  const [searchParams, setSearchParams] = useSearchParams()

  const [state, setState] = useState({
    loading: false,
    error: null,
    projects: [],
    cursor: null,
    loadingMore: false,
  })
  const [attempt, setAttempt] = useState(0)
  const [view, setView] = useViewPreference('vulnix.projects.view')

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '' })

  const [pendingDelete, setPendingDelete] = useState(null)
  const [confirmProjectName, setConfirmProjectName] = useState('')
  const [deleting, setDeleting] = useState(false)

  const search = searchParams.get('q') || ''
  const setSearch = (value) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set('q', value)
    else next.delete('q')
    setSearchParams(next, { replace: true })
  }

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false

    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const page = await api.getProjects(workspaceId, { limit: PAGE_SIZE })
        if (cancelled) return
        setState({
          loading: false,
          error: null,
          projects: page.items || [],
          cursor: page.next_cursor || null,
          loadingMore: false,
        })
      } catch (err) {
        if (!cancelled)
          setState({ loading: false, error: err.message, projects: [], cursor: null, loadingMore: false })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId, attempt])

  // Cursor pagination: there is no `total`, only a next_cursor, so the only
  // honest control is "Load more" — never numbered pages.
  const loadMore = useCallback(async () => {
    if (!state.cursor || state.loadingMore) return
    setState((s) => ({ ...s, loadingMore: true }))
    try {
      const page = await api.getProjects(workspaceId, { limit: PAGE_SIZE, cursor: state.cursor })
      setState((s) => ({
        ...s,
        projects: [...s.projects, ...(page.items || [])],
        cursor: page.next_cursor || null,
        loadingMore: false,
      }))
    } catch (err) {
      setState((s) => ({ ...s, loadingMore: false }))
      toast.error('Could not load more projects', { description: err.message || 'Please try again.' })
    }
  }, [workspaceId, state.cursor, state.loadingMore])

  const handleCreate = useCallback(async () => {
    if (!newProject.name.trim()) return
    setCreating(true)
    try {
      const project = await api.createProject(workspaceId, {
        name: newProject.name.trim(),
        description: newProject.description.trim() || null,
        source_type: 'zip_upload',
      })
      setState((s) => ({ ...s, projects: [project, ...s.projects] }))
      toast.success('Project created', { description: `${project.name} is ready to audit.` })
      setIsCreateOpen(false)
      setNewProject({ name: '', description: '' })
    } catch (err) {
      toast.error('Could not create project', { description: err.message || 'Please try again.' })
    } finally {
      setCreating(false)
    }
  }, [newProject, workspaceId])

  const handleDelete = useCallback(async () => {
    if (!pendingDelete || confirmProjectName.trim() !== pendingDelete.name) return
    setDeleting(true)
    try {
      await api.deleteProject(pendingDelete.id, confirmProjectName.trim())
      setState((s) => ({ ...s, projects: s.projects.filter((p) => p.id !== pendingDelete.id) }))
      toast.success('Project deleted', { description: `${pendingDelete.name} and its audit data were permanently deleted.` })
      setPendingDelete(null)
      setConfirmProjectName('')
    } catch (err) {
      toast.error('Could not delete project', { description: err.message || 'Please try again.' })
    } finally {
      setDeleting(false)
    }
  }, [confirmProjectName, pendingDelete])

  const header = (
    <PageHeader
      title="Projects"
      description="Repositories and archives you audit for vulnerabilities."
      actions={
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger render={<Button />}>
            <Plus data-icon="inline-start" />
            New project
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create a project</DialogTitle>
              <DialogDescription>
                Give the project a name. You can upload a ZIP archive or start an audit next.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-4 py-1"
              onSubmit={(e) => {
                e.preventDefault()
                handleCreate()
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="project-name">Name</Label>
                <Input
                  id="project-name"
                  placeholder="Payment API"
                  value={newProject.name}
                  onChange={(e) => setNewProject((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="project-description">Description (optional)</Label>
                <Textarea
                  id="project-description"
                  placeholder="What does this project do?"
                  value={newProject.description}
                  onChange={(e) => setNewProject((p) => ({ ...p, description: e.target.value }))}
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreateOpen(false)}
                  disabled={creating}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={!newProject.name.trim() || creating}>
                  {creating ? 'Creating…' : 'Create project'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    />
  )

  if (wsLoading || state.loading) {
    return (
      <PageStack>
        {header}
        <PanelsSkeleton count={2} />
      </PageStack>
    )
  }

  if (wsError || state.error) {
    return (
      <PageStack>
        {header}
        <Panel>
          <ErrorState
            title={wsError ? 'We couldn’t load your workspace' : 'We couldn’t load your projects'}
            description={wsError || state.error}
            onRetry={() => (wsError ? retryWorkspace() : setAttempt((a) => a + 1))}
          />
        </Panel>
      </PageStack>
    )
  }

  const filtered = state.projects.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase())
  )

  const totalProjects = state.projects.length
  const zipProjects = state.projects.filter((p) => p.source_type === 'zip_upload').length
  const gitProjects = state.projects.filter((p) => p.source_type === 'git_import').length

  return (
    <PageStack>
      {header}

      <StatGrid columns={3}>
        <StatCard
          icon={FolderKanban}
          label="Total projects"
          value={totalProjects}
          hint={`${filtered.length} matching current filter`}
          tone="slate"
        />
        <StatCard
          icon={ScanSearch}
          label="ZIP source packages"
          value={zipProjects}
          hint="Direct file uploads"
          tone="blue"
        />
        <StatCard
          icon={GitBranch}
          label="Git repositories"
          value={gitProjects}
          hint="Connected version control"
          tone="green"
        />
      </StatGrid>

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Search projects…"
        resultCount={filtered.length}
        onClearFilters={search ? () => setSearch('') : undefined}
      >
        <ViewToggle value={view} onChange={setView} />
      </Toolbar>

      {filtered.length === 0 ? (
        <Panel>
          <EmptyState
            icon={FolderKanban}
            title={search ? 'No projects match this search' : 'No projects yet'}
            description={
              search
                ? 'Try a different name or clear the search.'
                : 'Create a project, upload a ZIP archive, and run your first audit.'
            }
            action={
              search ? (
                state.cursor ? (
                  <Button variant="outline" onClick={loadMore} disabled={state.loadingMore}>
                    {state.loadingMore ? 'Loading…' : 'Load more and search again'}
                  </Button>
                ) : undefined
              ) : (
                <Button onClick={() => setIsCreateOpen(true)}>
                  <Plus data-icon="inline-start" />
                  Create project
                </Button>
              )
            }
          />
        </Panel>
      ) : (
        <>
          {view === 'grid' ? (
            <CardGrid>
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDelete={(item) => {
                    setPendingDelete(item)
                    setConfirmProjectName('')
                  }}
                />
              ))}
            </CardGrid>
          ) : (
            <div className="divide-y divide-border border-y border-border">
              {filtered.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onDelete={(item) => {
                    setPendingDelete(item)
                    setConfirmProjectName('')
                  }}
                  layout="list"
                />
              ))}
            </div>
          )}

          {state.cursor && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={state.loadingMore}>
                {state.loadingMore ? (
                  <>
                    <Loader2 data-icon="inline-start" className="animate-spin" />
                    Loading…
                  </>
                ) : (
                  'Load more projects'
                )}
              </Button>
            </div>
          )}
        </>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(o) => {
        if (!o && !deleting) {
          setPendingDelete(null)
          setConfirmProjectName('')
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{pendingDelete?.name}” permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the project, its uploaded archives, audits, findings, and tool results. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-project-delete">Type the project name to continue</Label>
            <Input
              id="confirm-project-delete"
              value={confirmProjectName}
              onChange={(event) => setConfirmProjectName(event.target.value)}
              placeholder={pendingDelete?.name}
              autoComplete="off"
              disabled={deleting}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || confirmProjectName.trim() !== pendingDelete?.name}
            >
              {deleting ? 'Deleting…' : 'Delete project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageStack>
  )
}

function ProjectCard({ project, onDelete, layout = 'grid' }) {
  if (layout === 'list') {
    return (
      <div className="group flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-5">
        <Link to={`/app/projects/${project.id}`} className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-subtle text-primary">
            <FolderKanban className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground group-hover:text-primary">
              {project.name}
            </span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
              {project.description || 'No description provided.'}
            </span>
          </span>
        </Link>
        <div className="flex flex-wrap items-center gap-3 pl-[52px] text-xs text-muted-foreground sm:pl-0">
          <Pill tone={project.source_type === 'git_import' ? 'brand' : 'neutral'}>
            {SOURCE_LABELS[project.source_type] || project.source_type}
          </Pill>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden />
            Updated {formatRelativeTime(project.updated_at)}
          </span>
        </div>
        <div className="flex items-center gap-2 pl-[52px] sm:pl-0">
          <Button size="sm" variant="outline" render={<Link to={`/app/projects/${project.id}/scan`} />}>
            <ScanSearch data-icon="inline-start" />
            Audit
          </Button>
          <ProjectActions project={project} onDelete={onDelete} />
        </div>
      </div>
    )
  }

  return (
    <div className="console-enter group relative rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-all duration-150 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-md">
      <Link
        to={`/app/projects/${project.id}`}
        className="block rounded-xl p-4.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <div className="flex items-start gap-3.5 pr-9">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-primary ring-1 ring-primary/20 transition-transform duration-150 group-hover:scale-105">
            <FolderKanban className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors tracking-tight">
              {project.name}
            </h3>
            <p className="mt-1 line-clamp-2 min-h-8 text-xs leading-relaxed text-muted-foreground">
              {project.description || 'No description provided.'}
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/70 pt-3 text-xs text-muted-foreground">
          <Pill tone={project.source_type === 'git_import' ? 'brand' : 'neutral'}>
            {SOURCE_LABELS[project.source_type] || project.source_type}
          </Pill>
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="size-3.5" aria-hidden />
            {formatRelativeTime(project.updated_at)}
          </span>
          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-xs text-primary transition-transform duration-150 ease-smooth group-hover:translate-x-0.5">
            Open project
            <ArrowRight className="size-3" />
          </span>
        </div>
      </Link>

      <div className="absolute right-2.5 top-2.5">
        <ProjectActions project={project} onDelete={onDelete} />
      </div>
    </div>
  )
}

function ProjectActions({ project, onDelete }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Actions for ${project.name}`}
          />
        }
      >
        <MoreVertical className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem render={<Link to={`/app/projects/${project.id}/scan`} />}>
          <ScanSearch />
          Start an audit
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link to={`/app/projects/${project.id}`} />}>
          <Eye />
          View details
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => onDelete(project)}>
          <Trash2 />
          Delete project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
