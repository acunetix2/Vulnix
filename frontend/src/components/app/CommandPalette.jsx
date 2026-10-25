import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FolderKanban, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '../ui/dialog'
import { NAV_BY_HREF, NAV_ITEMS } from '../../lib/navigation'
import { Spinner } from './Spinner'
import { api } from '../../services/api'
import { useWorkspace } from '../../hooks/useWorkspace'
import { cn } from '../../lib/utils'

/**
 * The console's one search box: click the bar in the header or press the
 * shortcut, type, and jump to a destination or a project. Nothing is invented -
 * the only live records offered are projects, which is the one collection the
 * API returns in full for a workspace.
 */
const RECENTS_KEY = 'vulnix.search.recents'
const RECENTS_LIMIT = 5

function readRecents() {
  try {
    const stored = JSON.parse(localStorage.getItem(RECENTS_KEY))
    return Array.isArray(stored) ? stored.filter((row) => row && row.href && row.name) : []
  } catch {
    return []
  }
}

function writeRecents(rows) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(rows))
  } catch {
    // A storage failure only costs the remembered list.
  }
}

export function CommandPalette({ open, onOpenChange }) {
  const navigate = useNavigate()
  const { workspaceId } = useWorkspace()

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [recents, setRecents] = useState(readRecents)
  const [projects, setProjects] = useState([])
  const [loadingProjects, setLoadingProjects] = useState(false)
  const listRef = useRef(null)
  const inputRef = useRef(null)

  // The palette is a keyboard tool: it has to take the caret the moment it
  // opens, or the first keystroke is lost to the page behind it.
  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false

    async function load() {
      setLoadingProjects(true)
      try {
        const page = await api.getProjects(workspaceId, { limit: 100 })
        if (!cancelled) setProjects(page.items || [])
      } catch {
        // Search still works with the destinations alone.
        if (!cancelled) setProjects([])
      } finally {
        if (!cancelled) setLoadingProjects(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId])

  // One global shortcut, so the bar is not the only way in.
  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpenChange(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onOpenChange])

  useEffect(() => {
    const row = listRef.current?.querySelector(`[data-index="${active}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  }, [active, query])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    const hrefs = new Set()
    const out = []

    if (!q && recents.length > 0) {
      const rows = recents
        .map((row) => ({
          ...row,
          icon: NAV_BY_HREF.get(row.href)?.icon,
          group: 'Recents',
          target: NAV_BY_HREF.get(row.href)?.target,
        }))
        .filter((row) => {
          if (hrefs.has(row.href)) return false
          hrefs.add(row.href)
          return true
        })
      if (rows.length > 0) out.push({ label: 'Recents', rows })
    }

    const pages = NAV_ITEMS.filter(
      (item) => !q || item.name.toLowerCase().includes(q) || item.group.toLowerCase().includes(q)
    ).map((item) => ({
      name: item.name,
      href: item.href,
      icon: item.icon,
      group: item.group,
      target: item.target,
    }))
    if (pages.length > 0) out.push({ label: q ? 'Pages' : 'All pages', rows: pages })

    const matched = projects
      .filter(
        (project) =>
          !q ||
          project.name.toLowerCase().includes(q) ||
          (project.description || '').toLowerCase().includes(q)
      )
      .map((project) => ({
        name: project.name,
        href: `/app/projects/${project.id}`,
        icon: FolderKanban,
        group: 'Project',
      }))
    if (matched.length > 0) out.push({ label: 'Projects', rows: matched })

    return out
  }, [query, recents, projects])

  const rows = useMemo(() => groups.flatMap((group) => group.rows), [groups])

  function select(row) {
    if (!row) return
    const next = [{ name: row.name, href: row.href }, ...recents.filter((r) => r.href !== row.href)]
      .slice(0, RECENTS_LIMIT)
    setRecents(next)
    writeRecents(next)
    setQuery('')
    setActive(0)
    onOpenChange(false)
    if (row.target === '_blank') {
      window.open(row.href, '_blank', 'noopener,noreferrer')
    } else {
      navigate(row.href)
    }
  }

  function onListKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((index) => (rows.length === 0 ? 0 : (index + 1) % rows.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((index) => (rows.length === 0 ? 0 : (index - 1 + rows.length) % rows.length))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      select(rows[active])
    }
  }

  let index = -1

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setQuery('')
          setActive(0)
        }
        onOpenChange(next)
      }}
    >
      <DialogContent
        className="gap-0 overflow-hidden p-0 sm:max-w-2xl"
        onKeyDown={onListKeyDown}
      >
        <DialogTitle className="sr-only">Search Vulnix</DialogTitle>

        <div className="flex h-14 items-center gap-3 border-b border-border px-4">
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setActive(0)
            }}
            placeholder="Search pages and projects…"
            aria-label="Search pages and projects"
            className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
          {loadingProjects && <Spinner className="size-4" label="Loading projects" />}
        </div>

        <div ref={listRef} className="max-h-[340px] min-h-[120px] overflow-y-auto p-1.5">
          {rows.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted-foreground">
              Nothing matches “{query}”.
            </p>
          ) : (
            groups.map((group) => (
              <div key={group.label} className="mb-1 last:mb-0">
                <p className="px-2.5 pt-2 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                  {group.label}
                </p>
                {group.rows.map((row) => {
                  index += 1
                  const isActive = index === active
                  return (
                    <button
                      key={`${row.group}-${row.href}`}
                      type="button"
                      data-index={index}
                      onClick={() => select(row)}
                      onMouseMove={() => setActive(index)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm',
                        'transition-colors duration-100 ease-smooth',
                        isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60'
                      )}
                    >
                      {row.icon && <row.icon className="size-4 shrink-0" aria-hidden />}
                      <span className="min-w-0 flex-1 truncate text-foreground">{row.name}</span>
                      <span className="shrink-0 text-xs">{row.group}</span>
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-border px-3.5 py-2 text-[11px] text-muted-foreground">
          <span>
            <Key>↑</Key> <Key>↓</Key> navigate
          </span>
          <span>
            <Key>⏎</Key> open
          </span>
          <span>
            <Key>Esc</Key> close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Key({ children }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-sans text-[10px] text-foreground">
      {children}
    </kbd>
  )
}
