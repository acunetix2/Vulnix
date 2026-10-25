import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  Play,
  MoreVertical,
  AlertTriangle,
  Activity,
  ScanSearch,
  Clock,
  Trash2,
  Loader2,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../components/ui/dropdown-menu'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import { PageHeader } from '../components/app/PageHeader'
import { StatCard } from '../components/app/StatCard'
import { StatGrid, PageStack } from '../components/app/Grids'
import { Panel } from '../components/app/Panel'
import { ScanStatusBadge, SeverityCounts, Pill } from '../components/app/SeverityBadge'
import { EmptyState, ErrorState, PanelsSkeleton } from '../components/EmptyState'
import { formatRelativeTime, formatDate } from '../lib/utils'
import { SEVERITY_DOTS, SEVERITY_ORDER } from '../lib/severity'
import { cn } from '../lib/utils'
import { api } from '../services/api'

const SOURCE_LABELS = { zip_upload: 'ZIP upload', git_import: 'Git import' }
const SCANS_PAGE = 10

const EMPTY_COUNTS = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }

function severityFromScan(scan) {
  return scan?.summary?.by_severity || EMPTY_COUNTS
}

function duration(started, completed) {
  if (!started) return '—'
  const end = completed ? new Date(completed) : new Date()
  const secs = Math.max(0, Math.floor((end - new Date(started)) / 1000))
  if (secs < 60) return `${secs}s`
  if (secs < 3600) return `${Math.floor(secs / 60)}m ${secs % 60}s`
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`
}

export function ProjectDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [project, setProject] = useState(null)
  const [scans, setScans] = useState([])
  const [state, setState] = useState({ loading: true, error: null, cursor: null, loadingMore: false })
  const [attempt, setAttempt] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmProjectName, setConfirmProjectName] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    async function load() {
      setState({ loading: true, error: null, cursor: null, loadingMore: false })
      try {
        const [p, page] = await Promise.all([
          api.getProject(id),
          api.getScans(id, { limit: SCANS_PAGE }).catch(() => ({ items: [], next_cursor: null })),
        ])
        if (cancelled) return
        setProject(p)
        setScans(page.items || [])
        setState({ loading: false, error: null, cursor: page.next_cursor || null, loadingMore: false })
      } catch (err) {
        if (!cancelled) setState({ loading: false, error: err.message, cursor: null, loadingMore: false })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id, attempt])

  const loadMoreScans = useCallback(async () => {
    if (!state.cursor || state.loadingMore) return
    setState((s) => ({ ...s, loadingMore: true }))
    try {
      const page = await api.getScans(id, { limit: SCANS_PAGE, cursor: state.cursor })
      setScans((prev) => [...prev, ...(page.items || [])])
      setState((s) => ({ ...s, cursor: page.next_cursor || null, loadingMore: false }))
    } catch (err) {
      setState((s) => ({ ...s, loadingMore: false }))
      toast.error('Could not load more audits', { description: err.message || 'Please try again.' })
    }
  }, [id, state.cursor, state.loadingMore])

  const handleDelete = async () => {
    if (!project || confirmProjectName.trim() !== project.name) return
    setDeleting(true)
    try {
      await api.deleteProject(id, confirmProjectName.trim())
      toast.success('Project deleted', {
        description: `${project.name} and its audit data were permanently deleted.`,
      })
      setConfirmDelete(false)
      navigate('/app/projects')
    } catch (err) {
      toast.error('Could not delete project', { description: err.message || 'Please try again.' })
      setDeleting(false)
    }
  }

  const breadcrumb = [{ label: 'Projects', to: '/app/projects' }, { label: project?.name || 'Project' }]

  if (state.loading) {
    return (
      <PageStack>
        <PageHeader title="Project" breadcrumb={breadcrumb} />
        <PanelsSkeleton count={2} />
      </PageStack>
    )
  }

  if (state.error || !project) {
    return (
      <PageStack>
        <PageHeader title="Project" breadcrumb={breadcrumb} />
        <Panel>
          <ErrorState
            title="We couldn’t load this project"
            description={state.error || 'The project may have been archived or you may not have access to it.'}
            onRetry={() => setAttempt((a) => a + 1)}
          />
        </Panel>
      </PageStack>
    )
  }

  const finished = scans.filter(
    (s) => s.status === 'completed' || s.status === 'completed_with_errors'
  )
  const latest = finished[0]
  const current = severityFromScan(latest)
  const previous = severityFromScan(finished[1])
  const totalNow = SEVERITY_ORDER.reduce((n, s) => n + (current[s] || 0), 0)
  const totalPrev = SEVERITY_ORDER.reduce((n, s) => n + (previous[s] || 0), 0)
  const delta = finished.length >= 2 ? totalNow - totalPrev : null

  const actions = (
    <>
      <Button render={<Link to={`/app/projects/${id}/scan`} />}>
        <Play data-icon="inline-start" />
        New audit
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="outline" size="icon" aria-label="Project actions" />}
        >
          <MoreVertical />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem render={<Link to={`/app/projects/${id}/scan`} />}>
            <ScanSearch />
            Start an audit
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link to="/app/audits/runs" />}>
            <Clock />
            All audits
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onClick={() => {
            setConfirmProjectName('')
            setConfirmDelete(true)
          }}>
            <Trash2 />
            Delete project
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  )

  return (
    <PageStack>
      <PageHeader
        title={project.name}
        description={project.description}
        breadcrumb={breadcrumb}
        actions={actions}
        meta={
          <>
            <Pill tone="neutral">{SOURCE_LABELS[project.source_type] || project.source_type}</Pill>
            <span className="text-xs text-muted-foreground">
              Created {formatRelativeTime(project.created_at)}
            </span>
            <span aria-hidden className="text-border-strong">
              ·
            </span>
            <span className="text-xs text-muted-foreground">
              {scans.length} {scans.length === 1 ? 'scan' : 'scans'}
            </span>
          </>
        }
      />

      <StatGrid>
        <StatCard
          icon={Activity}
          label="Detected issues"
          value={totalNow}
          hint={
            delta === null
              ? latest
                ? 'Latest completed audit'
                : 'No completed audit yet'
              : `${delta <= 0 ? '' : '+'}${delta} vs. previous audit`
          }
          tone={totalNow > 0 ? 'amber' : 'green'}
          to={latest ? `/app/audits/findings?scan=${latest.id}` : undefined}
        />
        <StatCard
          icon={AlertTriangle}
          label="Critical + High"
          value={(current.critical || 0) + (current.high || 0)}
          hint="From the latest completed audit"
          tone={(current.critical || 0) + (current.high || 0) > 0 ? 'red' : 'green'}
          to={latest ? `/app/audits/findings?severity=critical&scan=${latest.id}` : undefined}
        />
        <StatCard
          icon={ScanSearch}
          label="Audits"
          value={scans.length}
          hint={finished.length ? `${finished.length} finished` : 'None finished yet'}
          tone="blue"
          to={`/app/audits/runs?project=${id}`}
        />
        <StatCard
          icon={Clock}
          label="Last audit"
          value={scans[0] ? formatRelativeTime(scans[0].created_at) : 'Never'}
          hint={scans[0] ? String(scans[0].status).replace(/_/g, ' ') : 'Run an audit to begin'}
          tone="slate"
        />
      </StatGrid>

      {latest ? (
        <Panel
          title="Latest findings by severity"
          description={`From the run started ${formatDate(latest.started_at || latest.created_at)}`}
        >
          <SeverityGrid counts={current} scanId={latest.id} />
        </Panel>
      ) : (
        <Panel>
          <EmptyState
            icon={ScanSearch}
            title="No completed audits yet"
            description="Severity counts appear once an audit finishes. Start one to analyse this project."
            action={
              <Button render={<Link to={`/app/projects/${id}/scan`} />}>
                <Play data-icon="inline-start" />
                Start an audit
              </Button>
            }
            className="py-10"
          />
        </Panel>
      )}

      <Panel
        title="Audit history"
        description="Most recent audits of this project"
        flush={scans.length > 0}
        actions={
          <Link
            to="/app/audits/runs"
            className="inline-flex items-center text-sm font-medium text-primary transition-colors duration-150 ease-smooth hover:text-primary-hover"
          >
            All audits
          </Link>
        }
        footer={
          state.cursor ? (
            <div className="flex justify-center">
              <Button variant="outline" size="sm" onClick={loadMoreScans} disabled={state.loadingMore}>
                {state.loadingMore ? (
                  <>
                    <Loader2 data-icon="inline-start" className="animate-spin" />
                    Loading…
                  </>
                ) : (
                  'Load more audits'
                )}
              </Button>
            </div>
          ) : undefined
        }
      >
        {scans.length === 0 ? (
          <EmptyState
            icon={ScanSearch}
            title="No audits yet"
            description="Upload an archive and run your first audit of this project."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Findings</TableHead>
                <TableHead>
                  <span className="sr-only">Open audit</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scans.map((scan) => {
                const sev = severityFromScan(scan)
                const count = SEVERITY_ORDER.reduce((n, s) => n + (sev[s] || 0), 0)
                return (
                  <TableRow key={scan.id}>
                    <TableCell>
                      <ScanStatusBadge status={scan.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(scan.created_at)}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {duration(scan.started_at, scan.completed_at)}
                    </TableCell>
                    <TableCell>
                      {count > 0 ? (
                        <SeverityCounts counts={severityFromScan(scan)} />
                      ) : scan.status === 'failed' || scan.status === 'cancelled' ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <span className="text-muted-foreground">No findings</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        to={`/app/audits/runs/${scan.id}`}
                        className="text-sm font-medium text-primary transition-colors duration-150 ease-smooth hover:text-primary-hover"
                      >
                        View
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Panel>

      <AlertDialog open={confirmDelete} onOpenChange={(open) => {
        if (!open && !deleting) {
          setConfirmDelete(false)
          setConfirmProjectName('')
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{project.name}” permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the project, uploaded archives, audits, findings, and tool results. This cannot be undone. A running audit must finish or be cancelled first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirm-project-delete-detail">Type the project name to continue</Label>
            <Input
              id="confirm-project-delete-detail"
              value={confirmProjectName}
              onChange={(event) => setConfirmProjectName(event.target.value)}
              placeholder={project.name}
              autoComplete="off"
              disabled={deleting}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || confirmProjectName.trim() !== project.name}
            >
              {deleting ? 'Deleting…' : 'Delete project'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageStack>
  )
}

function SeverityGrid({ counts, scanId }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {SEVERITY_ORDER.map((s) => (
        <li key={s}>
          <Link
            to={`/app/audits/findings?severity=${s}&scan=${scanId}`}
            className="flex flex-col items-center rounded-lg border border-border bg-muted/40 px-3 py-3 text-center transition-colors duration-150 ease-smooth hover:border-border-strong hover:bg-muted"
          >
            <span className="text-xl font-semibold tabular-nums text-foreground">{counts[s] || 0}</span>
            <span className="mt-1 flex items-center justify-center gap-1.5 text-xs font-medium text-muted-foreground">
              <span className={cn('size-1.5 rounded-full', SEVERITY_DOTS[s])} aria-hidden />
              <span className="capitalize">{s}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
