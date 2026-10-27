import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useLocation, useParams, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  BookOpen,
  Terminal,
  Shield,
  Key,
  Webhook,
  Code2,
  Copy,
  Check,
  Layers,
  Cpu,
  FileCode,
  AlertCircle,
  Lock,
  Search,
  Bot,
  RefreshCw,
  Box,
  Compass,
  Gauge,
  Upload,
  PanelLeft,
  ChevronDown,
  ArrowUpRight,
  CornerDownLeft,
} from 'lucide-react'
import { InlineCode } from '../components/app/CodeBlock'
import { VulnixFooter } from '../components/app/VulnixFooter'
import { VulnixLegalGraphicBanner } from './landing/legal/VulnixLegalGraphicBanner'
import { Dialog, DialogContent, DialogTitle } from '../components/ui/dialog'
import { cn } from '../lib/utils'
import {
  ReactIcon, Nextjs, FastAPI, Vitest, Spring, ReactQuery,
  TailwindCSS, Angular, Vue, Astro, Python, Dart, JavaScript
} from '../components/icons/tech'

// Every path, field and number on this page is read from the server that answers
// the console. Nothing here is aspirational: if an endpoint is not listed, the
// product does not have it.
const DOC_SECTIONS = [
  {
    group: 'Getting Started',
    items: [
      { id: 'overview', title: 'What This API Is', icon: Compass },
      { id: 'quickstart', title: 'First Audit end to end', icon: Bot },
      { id: 'conventions', title: 'Errors, Pagination, Time', icon: AlertCircle },
    ],
  },
  {
    group: 'Authentication',
    items: [
      { id: 'auth', title: 'Sign in & Bearer Tokens', icon: Key },
      { id: 'username', title: 'Account Handle', icon: Lock },
      { id: 'workspaces', title: 'Workspaces & Members', icon: Layers },
    ],
  },
  {
    group: 'Audits',
    items: [
      { id: 'intake', title: 'GitHub Import & ZIP Intake', icon: Upload },
      { id: 'runs', title: 'Start, Follow, Cancel a Run', icon: RefreshCw },
      { id: 'findings', title: 'Findings & Triage', icon: FileCode },
      { id: 'report', title: 'Report Download', icon: Box },
    ],
  },
  {
    group: 'Reviewers',
    items: [
      { id: 'ai-select', title: 'Choosing a Reviewer', icon: Cpu },
      { id: 'ai-explain', title: 'Explaining a Finding', icon: Code2 },
      { id: 'credits', title: 'Credits & Usage', icon: Gauge },
    ],
  },
  {
    group: 'Delivery',
    items: [
      { id: 'webhooks', title: 'Signed Webhooks', icon: Webhook },
      { id: 'events', title: 'Event Payloads', icon: FileCode },
      { id: 'retries', title: 'Retries & Delivery Log', icon: RefreshCw },
      { id: 'oauth', title: 'GitHub / Slack / Jira Connections', icon: Lock },
    ],
  },
  {
    group: 'Running the Server',
    items: [
      { id: 'config', title: 'Environment Settings', icon: Terminal },
      { id: 'limits', title: 'Quotas & Size Limits', icon: AlertCircle },
      { id: 'sandbox', title: 'Archive & Egress Guards', icon: Shield },
      { id: 'tools', title: 'Optional Scanner CLIs', icon: Box },
    ],
  },
]

const DOC_ITEMS = DOC_SECTIONS.flatMap((group) =>
  group.items.map((item) => ({ ...item, group: group.group }))
)
const SEARCH_SHORTCUT = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent)
  ? '⌘ K'
  : 'Ctrl K'

function DocCodeBlock({ code, language = 'bash', filename }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // A denied clipboard is not worth a toast.
    }
  }

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-border bg-slate-950 text-slate-100 shadow-sm">
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-3.5 py-1.5 text-xs text-slate-400">
        <span className="font-mono text-[11px] font-medium text-slate-300">
          {filename || language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-200"
        >
          {copied ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>
      <div className="overflow-x-auto p-4 font-mono text-xs leading-relaxed">
        <pre>{code}</pre>
      </div>
    </div>
  )
}

function Callout({ type = 'info', title, children }) {
  const styles = {
    info: 'border-blue-500/30 bg-blue-500/5 text-blue-900 dark:text-blue-200 [&_svg]:text-blue-500',
    warning: 'border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200 [&_svg]:text-amber-500',
    tip: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200 [&_svg]:text-emerald-500',
    danger: 'border-rose-500/30 bg-rose-500/5 text-rose-900 dark:text-rose-200 [&_svg]:text-rose-500',
  }[type]

  return (
    <div className={cn('my-4 flex gap-3 rounded-lg border p-4 text-xs leading-relaxed', styles)}>
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <div className="space-y-1">
        {title && <div className="font-semibold text-foreground">{title}</div>}
        <div className="text-muted-foreground">{children}</div>
      </div>
    </div>
  )
}

function Endpoint({ method, path, description, children }) {
  const methodColors = {
    GET: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600',
    POST: 'border-blue-500/30 bg-blue-500/10 text-blue-600',
    PUT: 'border-amber-500/30 bg-amber-500/10 text-amber-600',
    PATCH: 'border-violet-500/30 bg-violet-500/10 text-violet-600',
    DELETE: 'border-rose-500/30 bg-rose-500/10 text-rose-600',
  }
  return (
    <div className="my-4 rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border pb-3">
        <span className={cn('rounded border px-2 py-0.5 font-mono text-xs font-bold', methodColors[method] || 'border-border bg-muted text-muted-foreground')}>
          {method}
        </span>
        <code className="font-mono text-sm font-semibold text-foreground">{path}</code>
      </div>
      {description && <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
      {children && <div className="mt-3.5 space-y-3">{children}</div>}
    </div>
  )
}

function ParamTable({ rows, columns }) {
  const cols = columns || ['Parameter', 'Type', 'Required', 'Description']
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border bg-muted/50 font-medium text-muted-foreground">
          <tr>
            {cols.map((c) => (
              <th key={c} className="px-3 py-2">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((row) => (
            <tr key={row[0]} className="hover:bg-muted/20">
              <td className="px-3 py-2.5 font-mono font-medium text-foreground">{row[0]}</td>
              <td className="px-3 py-2.5 font-mono text-muted-foreground">{row[1]}</td>
              <td className="px-3 py-2.5">
                {row[2] ? (
                  <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                    Required
                  </span>
                ) : (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    Optional
                  </span>
                )}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">{row[3]}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function List({ children }) {
  return <ul className="list-disc space-y-2 pl-5 text-xs leading-relaxed text-muted-foreground">{children}</ul>
}

function Heading({ icon: Icon, children }) {
  return (
    <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
      <Icon className="size-5 text-primary" />
      {children}
    </h2>
  )
}

const BASE = '$VULNIX_ORIGIN/api/v1'

export function ApiDocs() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState({})
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeResult, setActiveResult] = useState(0)
  const searchInputRef = useRef(null)
  const { docId } = useParams()
  const activeId = docId || 'overview'
  const activeItem = DOC_ITEMS.find((item) => item.id === activeId)

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [activeId])

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return DOC_ITEMS.filter((item) => !query ||
      item.title.toLowerCase().includes(query) ||
      item.id.toLowerCase().includes(query) ||
      item.group.toLowerCase().includes(query)
    )
  }, [searchQuery])

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  useEffect(() => {
    function onKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  function selectDoc(item) {
    if (!item) return
    navigate(`/docs/${item.id}`)
    setSearchOpen(false)
  }

  function handleSearchKeyDown(event) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveResult((index) => searchResults.length ? (index + 1) % searchResults.length : 0)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveResult((index) => searchResults.length ? (index - 1 + searchResults.length) % searchResults.length : 0)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      selectDoc(searchResults[activeResult])
    }
  }

  const location = useLocation()
  const isPublic = !location.pathname.startsWith('/app')
  const { isAuthenticated } = useAuth() || {}
  const activeIndex = DOC_ITEMS.findIndex((item) => item.id === activeId)
  const isDesktop = () => window.matchMedia('(min-width: 1024px)').matches

  function toggleSidebar() {
    if (isDesktop()) setSidebarOpen((open) => !open)
    else setMobileMenuOpen((open) => !open)
  }

  if (!activeItem) return <Navigate to="/docs/overview" replace />

  return (
    <div className={cn(isPublic && 'min-h-screen bg-canvas font-sans text-foreground selection:bg-primary/20 selection:text-primary')}>
      {isPublic && (
        <header className="sticky top-0 z-40 flex h-[52px] items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3 text-xs text-muted-foreground sm:gap-4 sm:text-sm">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-label="Toggle documentation sidebar"
              aria-expanded={isDesktop() ? sidebarOpen : mobileMenuOpen}
              className="shrink-0 rounded-md border border-border p-1.5 transition-colors hover:bg-muted hover:text-foreground"
            >
              <PanelLeft className="size-4" />
            </button>
            <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 truncate">
              <Link to="/" className="shrink-0 transition-colors hover:text-foreground">Home</Link>
              <span className="text-muted-foreground/60">/</span>
              <Link to="/docs/overview" className="shrink-0 transition-colors hover:text-foreground">Docs</Link>
              <span className="text-muted-foreground/60">/</span>
              <span className="truncate text-foreground">{activeItem.title}</span>
            </nav>
          </div>
          <div className="ml-3 flex shrink-0 items-center gap-2">
            {isAuthenticated ? (
              <Link to="/app/dashboard" className="hidden items-center gap-1.5 rounded border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary sm:inline-flex">
                Console <ArrowUpRight className="size-3.5" />
              </Link>
            ) : (
              <>
                <Link to="/signin" className="hidden rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground sm:inline-flex">Sign in</Link>
                <Link to="/signup" className="rounded border border-border px-2.5 py-1 text-xs text-foreground transition-colors hover:border-primary/40 hover:text-primary">Start free</Link>
              </>
            )}
          </div>
        </header>
      )}

      <div className={cn('mx-auto flex min-h-[calc(100vh-52px)] w-full max-w-[1440px]', !isPublic && 'console-enter')}>
        <aside className={cn(
          'fixed top-[52px] z-30 flex h-[calc(100vh-52px)] w-72 shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-transform duration-200 lg:sticky lg:top-[52px]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:hidden',
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}>
          <div className="border-b border-sidebar-border p-4">
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="size-4 text-primary" />
              <span className="text-sm font-semibold tracking-tight text-sidebar-accent-foreground">Vulnix Docs</span>
            </div>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-9 w-full items-center gap-2 rounded-md border border-sidebar-border bg-background/70 px-2.5 text-left text-xs text-muted-foreground shadow-2xs transition-colors hover:border-primary/40 hover:bg-background hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              aria-label="Search documentation, shortcut Control K"
            >
              <Search className="size-3.5 shrink-0" aria-hidden />
              <span className="flex-1">Search documentation</span>
              <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground">{SEARCH_SHORTCUT}</kbd>
            </button>
          </div>

        <nav aria-label="Documentation pages" className="flex-1 space-y-3 overflow-y-auto px-3 py-3 text-xs">
          {DOC_SECTIONS.map((group, index) => {
            const isCollapsed = collapsedGroups[group.group]
            return (
            <div key={group.group} className={cn('space-y-1.5', index > 0 && 'mt-3 border-t border-dashed border-sidebar-border pt-3')}>
              <button
                type="button"
                onClick={() => setCollapsedGroups((current) => ({ ...current, [group.group]: !current[group.group] }))}
                aria-expanded={!isCollapsed}
                className="group flex w-full items-center justify-between px-1 py-1 text-left"
              >
                <span className="text-sm font-semibold tracking-tight text-sidebar-foreground transition-colors group-hover:text-sidebar-accent-foreground">{group.group}</span>
                <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform duration-150', isCollapsed && '-rotate-90')} />
              </button>
              {!isCollapsed && <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = activeId === item.id
                  return (
                    <li key={item.id}>
                      <Link
                        to={`/docs/${item.id}`}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          'group flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs transition-colors',
                          isActive
                            ? 'bg-primary/10 font-medium text-primary shadow-sm'
                            : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )}
                      >
                        <span className={cn('mr-2 h-3.5 w-1 shrink-0 rounded-full', isActive ? 'bg-primary' : 'bg-transparent')} />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </li>
                  )
                })}
              </ul>}
            </div>
            )
          })}
        </nav>
      </aside>

      {mobileMenuOpen && <button type="button" aria-label="Close documentation menu" onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 z-20 bg-black/60 lg:hidden" />}

      <Dialog
        open={searchOpen}
        onOpenChange={(open) => {
          setSearchOpen(open)
          if (!open) {
            setSearchQuery('')
            setActiveResult(0)
          }
        }}
      >
        <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-xl">
          <DialogTitle className="sr-only">Search Vulnix documentation</DialogTitle>
          <div className="flex h-14 items-center gap-3 border-b border-border px-4">
            <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value)
                setActiveResult(0)
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search docs by title or topic..."
              aria-label="Search documentation pages"
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">ESC</kbd>
          </div>
          <div className="max-h-[min(60vh,28rem)] overflow-y-auto p-2">
            {searchResults.length ? searchResults.map((item, index) => {
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectDoc(item)}
                  onMouseEnter={() => setActiveResult(index)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
                    activeResult === index ? 'bg-primary/10 text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-md border border-border bg-background text-primary">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{item.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{item.group}</span>
                  </span>
                  {activeResult === index && <CornerDownLeft className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                </button>
              )
            }) : (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">No documentation pages match that search.</p>
            )}
          </div>
          <div className="flex items-center gap-4 border-t border-border bg-muted/40 px-4 py-2 text-[11px] text-muted-foreground">
            <span><kbd className="mr-1 rounded border border-border bg-background px-1">↑</kbd><kbd className="mr-1 rounded border border-border bg-background px-1">↓</kbd> to navigate</span>
            <span><kbd className="mr-1 rounded border border-border bg-background px-1">↵</kbd> to open</span>
            <span className="ml-auto">Vulnix Docs</span>
          </div>
        </DialogContent>
      </Dialog>

      <main className="flex min-w-0 flex-1 flex-col justify-between px-4 py-6 sm:px-8 md:py-8">
        <div className="mx-auto w-full max-w-4xl space-y-8">
        <div className="border-b border-[#1c272c] pb-6">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-xs font-medium uppercase tracking-widest text-emerald-400">
              {DOC_SECTIONS.find((group) => group.items.some((item) => item.id === activeId))?.group || 'Vulnix Docs'}
            </span>
            <Link
              to={activeId === 'overview' ? '/docs/auth' : '/docs/overview'}
              className="inline-flex items-center gap-1.5 rounded border border-[#233137] bg-[#11181c] px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:border-emerald-500/30 hover:text-white"
            >
              <span>{activeId === 'overview' ? 'API Reference' : 'Docs Overview'}</span>
              <ArrowUpRight className="size-3.5 text-emerald-400" />
            </Link>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {activeId === 'overview' ? 'Driving Vulnix over HTTP' : activeItem.title}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-400">
            {activeId === 'overview'
              ? 'Everything a script, a CI job or another service can do: import a repository, run an audit, read the findings, ask a reviewer about one, and receive signed webhooks about all of it. Every path below is served by the same backend that answers this console.'
              : `Integration Manual / ${activeItem.title}. Explore the topic below, or use the documentation navigation to open another guide.`}
          </p>
        </div>

        {/* ── Supported Technologies ── */}
        {activeId === 'overview' && <section className="scroll-mt-20 space-y-5">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">Supported Technologies</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Vulnix understands projects built with any of these frameworks and runtimes. The agent reads
              real source code, so the analysis is accurate regardless of the language.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {[
              { Icon: ReactIcon,    label: 'React',        category: 'Frontend' },
              { Icon: Nextjs,       label: 'Next.js',      category: 'Framework' },
              { Icon: Vue,          label: 'Vue',          category: 'Frontend' },
              { Icon: Angular,      label: 'Angular',      category: 'Frontend' },
              { Icon: Astro,        label: 'Astro',        category: 'Framework' },
              { Icon: TailwindCSS,  label: 'Tailwind CSS', category: 'Styling' },
              { Icon: FastAPI,      label: 'FastAPI',      category: 'Backend' },
              { Icon: Spring,       label: 'Spring',       category: 'Backend' },
              { Icon: ReactQuery,   label: 'TanStack Query', category: 'Data' },
              { Icon: Vitest,       label: 'Vitest',       category: 'Testing' },
              { Icon: Python,       label: 'Python',       category: 'Language' },
              { Icon: JavaScript,   label: 'JavaScript',   category: 'Language' },
              { Icon: Dart,         label: 'Dart',         category: 'Language' },
            ].map(({ Icon, label, category }) => (
              <div
                key={label}
                className="group flex flex-col items-center gap-2.5 rounded-xl border border-border bg-card p-4 shadow-xs transition-all duration-200 hover:border-primary/40 hover:bg-primary/5 hover:shadow-md"
              >
                <Icon className="size-9 shrink-0 transition-transform duration-200 group-hover:scale-110" aria-hidden="true" />
                <div className="text-center">
                  <div className="text-[11px] font-semibold text-foreground leading-tight">{label}</div>
                  <div className="mt-0.5 text-[10px] text-muted-foreground">{category}</div>
                </div>
              </div>
            ))}
          </div>
        </section>}

        {activeId === 'overview' && <section id="overview" className="scroll-mt-20 space-y-4">
          <Heading icon={Compass}>What this API is</Heading>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Vulnix is self-hosted software: one FastAPI service, one database, one object store. There is no
            shared SaaS host and no vendor domain to point at — the base URL is wherever you deployed it, and
            the console you are reading this in is served by the same process. Everything below is written
            against <InlineCode>{BASE}</InlineCode>.
          </p>
          <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
            <div className="space-y-1.5 rounded-lg border border-border bg-card p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Cpu className="size-3.5 text-primary" /> The agent is the scanner
              </div>
              <p className="text-[11px] leading-normal text-muted-foreground">
                A run walks your files with a reviewer and reports what it reads. Semgrep, Gitleaks, Bandit,
                pip-audit and Trivy are optional inputs a run uses only when it explicitly asks for them;
                by default an audit starts no CLI process at all.
              </p>
            </div>
            <div className="space-y-1.5 rounded-lg border border-border bg-card p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <FileCode className="size-3.5 text-primary" /> Every finding has provenance
              </div>
              <p className="text-[11px] leading-normal text-muted-foreground">
                Each one carries the run that reported it, the file and line it came from, and the evidence
                excerpt that was actually read. Nothing is asserted without a coordinate.
              </p>
            </div>
            <div className="space-y-1.5 rounded-lg border border-border bg-card p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Shield className="size-3.5 text-primary" /> Bounded by default
              </div>
              <p className="text-[11px] leading-normal text-muted-foreground">
                Archives are unpacked under size, ratio and depth limits, outbound calls refuse private and
                link-local addresses, and redirects are never followed.
              </p>
            </div>
          </div>
          <Callout type="tip" title="The machine-readable contract">
            The running server publishes its own schema at <InlineCode>/api/openapi.json</InlineCode> and a
            browsable reference at <InlineCode>/api/docs</InlineCode>. That document is generated from the code
            and is always current; this manual is the narrative around it.
          </Callout>
        </section>}

        <section id="quickstart" className={cn('scroll-mt-20 space-y-4', activeId !== 'quickstart' && 'hidden')}>
          <Heading icon={Bot}>First audit, end to end</Heading>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Four calls: sign in, hand the server a source, run it, read what came back. The examples assume
            the <InlineCode>jq</InlineCode> filter only to keep the output short.
          </p>

          {[
            {
              n: 1,
              title: 'Sign in and keep the token',
              body: (
                <DocCodeBlock
                  filename="login.sh"
                  code={`TOKEN=$(curl -s -X POST $BASE/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"you@example.com","password":"..."}' | jq -r .access_token)

# Every call after this one carries it as a bearer token.
curl -s $BASE/auth/me -H "Authorization: Bearer $TOKEN" | jq '{email, username}'`}
                />
              ),
            },
            {
              n: 2,
              title: 'Give the project a source',
              body: (
                <DocCodeBlock
                  filename="intake.sh"
                  code={`# Preferred: import a repository granted to this workspace's GitHub App installation.
UPLOAD=$(curl -s -X POST $BASE/projects/$PROJECT_ID/uploads/github \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d '{"repo_id": 12345678, "ref": "main"}')
UPLOAD_ID=$(echo "$UPLOAD" | jq -r .id)

# Or a ZIP of the working tree, as multipart form data.
curl -s -X POST $BASE/projects/$PROJECT_ID/uploads \\
  -H "Authorization: Bearer $TOKEN" -F file=@./source.zip | jq .id`}
                />
              ),
            },
            {
              n: 3,
              title: 'Start the audit and follow it',
              body: (
                <DocCodeBlock
                  filename="audit.sh"
                  code={`SCAN=$(curl -s -X POST $BASE/projects/$PROJECT_ID/scans \\
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\
  -d "{\\"upload_id\\":\\"$UPLOAD_ID\\",\\"options\\":{\\"agent_review\\":true}}" | jq -r .id)

# A run is queued then running then completed; poll or read the trace.
curl -s $BASE/scans/$SCAN -H "Authorization: Bearer $TOKEN" \\
  | jq '{status, summary, steps: [.tool_runs[].tool_name]}'`}
                />
              ),
            },
            {
              n: 4,
              title: 'Read the findings',
              body: (
                <DocCodeBlock
                  filename="findings.sh"
                  code={`curl -s "$BASE/scans/$SCAN/findings?limit=50" -H "Authorization: Bearer $TOKEN" \\
  | jq -r '.items[] | [.severity, .file_path, .start_line, .title] | @tsv'`}
                />
              ),
            },
          ].map((step) => (
            <div key={step.n} className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {step.n}
                </span>
                <span>{step.title}</span>
              </div>
              <div>{step.body}</div>
            </div>
          ))}
          <Callout type="warning" title="A run costs nothing until a reviewer answers">
            The audit itself is local work against your own quota of runs per hour. Reviewer replies are
            metered separately — see{' '}
            <Link to="/docs/credits" className="font-medium text-primary underline-offset-2 hover:underline">
              Credits &amp; usage
            </Link>.
          </Callout>
        </section>

        <section id="conventions" className={cn('scroll-mt-20 space-y-4', activeId !== 'conventions' && 'hidden')}>
          <Heading icon={AlertCircle}>Errors, pagination, time</Heading>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Failures are not bare HTTP statuses. The body always decodes to one shape, and the{' '}
            <InlineCode>request_id</InlineCode> in it is what an operator looks up in the server log — the
            log never contains the payload, the source, or a credential.
          </p>
          <DocCodeBlock
            filename="Error (any non-2xx)"
            language="json"
            code={`{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Today's credits are spent. They reset at midnight UTC.",
    "request_id": "7c1d…",
    "details": null
  }
}`}
          />
          <ParamTable
            columns={['Code', 'Status', 'Retry', 'When']}
            rows={[
              ['UNAUTHENTICATED', '401', 'No', 'Missing, expired or malformed bearer token.'],
              ['FORBIDDEN', '403', 'No', 'The token is valid but this workspace role is too low.'],
              ['NOT_FOUND', '404', 'No', 'Unknown id, or a row that belongs to another workspace — the answer is deliberately the same.'],
              ['VALIDATION_ERROR', '422', 'No', 'Body or query failed schema checks.'],
              ['RATE_LIMITED', '429', 'Later', 'A per-minute or per-hour quota was exceeded.'],
              ['QUOTA_EXCEEDED', '429', 'Tomorrow', 'Daily reviewer credits are spent.'],
              ['CONFLICT', '409', 'No', 'The row is in a state that forbids this change.'],
              ['UPLOAD_TOO_LARGE / UNSAFE_ARCHIVE', '413 / 400', 'No', 'The source broke an intake limit — see Archive & egress guards.'],
              ['AI_DISABLED / AI_MODEL_UNAVAILABLE', '503 / 422', 'No / Later', 'No reviewer is switched on, or the selected one is not in the live catalog right now.'],
            ]}
          />
          <h3 className="pt-2 text-sm font-semibold text-foreground">Cursor pagination</h3>
          <p className="text-xs leading-relaxed text-muted-foreground">
            List endpoints are keyset-paginated, newest first, by{' '}
            <InlineCode>created_at</InlineCode> then <InlineCode>id</InlineCode>. There is no{' '}
            <InlineCode>offset</InlineCode>: a cursor stays correct while rows are being inserted.
          </p>
          <DocCodeBlock
            language="http"
            filename="Request / Response"
            code={`GET $BASE/projects/$PROJECT_ID/scans?limit=25&cursor=eyJ…

{
  "items": [ … up to limit rows … ],
  "next_cursor": "eyJ…"   // null when you have reached the oldest row
}`}
          />
          <h3 className="pt-2 text-sm font-semibold text-foreground">Time and identifiers</h3>
          <List>
            <li>Every timestamp is UTC with an ISO 8601 suffix; the server never sends a local time.</li>
            <li>Row ids are UUID strings, opaque to you. Do not build a meaning into one and do not display a
              raw id to an end user — the console shows handles and names instead.</li>
            <li>Requests are <InlineCode>application/json</InlineCode> except upload intake, which is{' '}
              <InlineCode>multipart/form-data</InlineCode>.</li>
          </List>
        </section>

        <section id="auth" className={cn('scroll-mt-20 space-y-4', activeId !== 'auth' && 'hidden')}>
          <Heading icon={Key}>Sign in and bearer tokens</Heading>
          <p className="text-xs leading-relaxed text-muted-foreground">
            The API takes an <InlineCode>Authorization: Bearer &lt;access_token&gt;</InlineCode> header on
            every call. Tokens are short-lived; refresh them rather than asking for the password again.
          </p>
          <Endpoint method="POST" path="/auth/login" description="Exchange credentials for an access token and a refresh token.">
            <ParamTable
              rows={[
                ['email', 'string', true, 'The account email.'],
                ['password', 'string', true, 'The account password.'],
              ]}
            />
          </Endpoint>
          <Endpoint method="POST" path="/auth/refresh" description="Trade a refresh token for a new access token." />
          <Endpoint method="POST" path="/auth/signout" description="End the session belonging to the refresh token." />
          <Endpoint method="GET" path="/auth/me" description="The signed-in account: id, email, handle, display name, workspace list." />
          <List>
            <li>Signup, email confirmation and password change are also on <InlineCode>/auth</InlineCode> —
              the OpenAPI document lists their exact bodies.</li>
            <li>There is no long-lived API-key or PAT mechanism. A CI job signs in with a dedicated account and
              keeps the access token in its own secret store.</li>
          </List>
        </section>

        <section id="username" className={cn('scroll-mt-20 space-y-4', activeId !== 'username' && 'hidden')}>
          <Heading icon={Lock}>Account handle</Heading>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Each account has a unique handle that the console shows in place of any id. It is what appears on
            audit events, triage notes and webhook payloads you forward onward.
          </p>
          <Endpoint method="PATCH" path="/auth/me" description="Change the handle or display name.">
            <ParamTable
              rows={[
                ['username', 'string', false, '3–30 characters, letters, digits and underscore, case-insensitively unique.'],
                ['display_name', 'string', false, 'Free text, shown next to the handle.'],
              ]}
            />
          </Endpoint>
          <ParamTable
            columns={['Code', 'Status', 'Retry', 'When']}
            rows={[
              ['USERNAME_INVALID', '422', 'No', 'Too short, too long, or a character outside the allowed set.'],
              ['USERNAME_RESERVED', '422', 'No', 'A name the platform keeps for itself (admin, support, vulnix-bot …).'],
              ['USERNAME_TAKEN', '409', 'No', 'Another account already uses it, ignoring case.'],
            ]}
          />
        </section>

        <section id="workspaces" className={cn('scroll-mt-20 space-y-4', activeId !== 'workspaces' && 'hidden')}>
          <Heading icon={Layers}>Workspaces and members</Heading>
          <p className="text-xs leading-relaxed text-muted-foreground">
            A workspace is the isolation boundary: projects, runs, findings, connections and usage never cross
            one. Roles are ordered — <InlineCode>viewer &lt; member &lt; admin &lt; owner</InlineCode> — and
            every write checks the caller against the role the endpoint requires.
          </p>
          <Endpoint method="GET" path="/workspaces" description="Workspaces this account belongs to." />
          <Endpoint method="POST" path="/workspaces" description="Create one; the caller becomes its owner." />
          <Endpoint method="GET" path="/workspaces/{workspace_id}/members" description="Members with handle, role and joined_at." />
          <Endpoint
            method="POST"
            path="/workspaces/{workspace_id}/members"
            description="Add an existing account by email, or change nothing about a run of your own."
          >
            <ParamTable
              rows={[
                ['email', 'string', true, 'An account that already exists; there is no invite-and-provision flow.'],
                ['role', 'string', true, 'One of viewer, member, admin.'],
              ]}
            />
          </Endpoint>
          <Endpoint method="PATCH" path="/workspaces/{workspace_id}/members/{user_id}" description="Change a role." />
          <Endpoint method="DELETE" path="/workspaces/{workspace_id}/members/{user_id}" description="Remove a member." />
          <Endpoint method="DELETE" path="/workspaces/{workspace_id}" description="Delete a workspace. Refuses with LAST_OWNER while another owner exists elsewhere, and with WORKSPACE_BUSY when a run is in flight." />
          <Endpoint method="GET" path="/workspaces/{workspace_id}/audit-events" description="The cursor-paginated trail: who did what, when, to which row." />
        </section>

        <section id="intake" className={cn('scroll-mt-20 space-y-4', activeId !== 'intake' && 'hidden')}>
          <Heading icon={Upload}>GitHub import and ZIP intake</Heading>
          <p className="text-xs leading-relaxed text-muted-foreground">
            An audit runs against an <InlineCode>upload</InlineCode> — a quarantined snapshot of a tree. Two
            ways to make one. Both return the same object; a run cannot tell which produced it.
          </p>
          <Endpoint
            method="POST"
            path="/projects/{project_id}/uploads/github"
            description="Stream the repository archive from GitHub through the workspace connection."
          >
            <ParamTable
              rows={[
                ['repo_id', 'integer', true, 'A numeric repository granted to this workspace through its GitHub App installation. A URL is not accepted, and the installation is checked before import.'],
                ['ref', 'string', false, 'Branch or tag. Empty means the repository default branch; the shape is checked server-side before it goes into any URL.'],
              ]}
            />
          </Endpoint>
          <DocCodeBlock
            language="json"
            filename="UploadOut (201 Created)"
            code={`{
  "id": "…uuid…",
  "project_id": "…uuid…",
  "status": "ready",
  "original_filename": "acme-api@main",
  "size_bytes": 4812330,
  "sha256": "…hex…",
  "created_at": "2026-10-23T09:14:02Z",
  "expires_at": "2026-10-30T09:14:02Z"
}`}
          />
          <Endpoint
            method="POST"
            path="/projects/{project_id}/uploads"
            description="multipart/form-data with one file field named file. ZIP only; see the intake limits."
          />
          <Endpoint method="GET" path="/uploads/{upload_id}" description="Status of one snapshot." />
          <Endpoint method="DELETE" path="/uploads/{upload_id}" description="Discard it. Refused with CONFLICT while a run still references it." />
          <Callout type="info" title="Snapshots age out">
            Quarantined sources are deleted after <InlineCode>upload_retention_days</InlineCode> (7 by
            default). Do not treat an <InlineCode>upload_id</InlineCode> as durable — re-import when you need
            a repeatable audit of the same commit.
          </Callout>
        </section>

        <section id="runs" className={cn('scroll-mt-20 space-y-4', activeId !== 'runs' && 'hidden')}>
          <Heading icon={RefreshCw}>Start, follow and cancel a run</Heading>
          <Endpoint method="POST" path="/projects/{project_id}/scans" description="Queue an audit against one snapshot. Returns 202 with the run row.">
            <ParamTable
              rows={[
                ['upload_id', 'string', true, 'The snapshot to read.'],
                ['options.agent_review', 'boolean', false, 'The scanner: walk the tree with the AI agent. Default true.'],
                ['options.static_analysis', 'boolean', false, 'Optional extra evidence from installed static-analysis CLIs. Default false.'],
                ['options.secrets', 'boolean', false, 'Optional gitleaks pass. The agent already reads secrets in source. Default false.'],
                ['options.dependencies', 'boolean', false, 'Optional manifest and lockfile CLI review. Default false.'],
              ]}
            />
          </Endpoint>
          <DocCodeBlock
            language="json"
            filename="ScanOut (202 Accepted)"
            code={`{
  "id": "…uuid…",
  "project_id": "…uuid…",
  "upload_id": "…uuid…",
  "status": "queued",
  "options": { "agent_review": true, "static_analysis": false,
               "secrets": false, "dependencies": false },
  "summary": null,
  "error_code": null,
  "started_at": null,
  "completed_at": null,
  "created_at": "2026-10-23T09:15:00Z"
}`}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            Status moves <InlineCode>queued → running → completed</InlineCode>, or to{' '}
            <InlineCode>failed</InlineCode> / <InlineCode>cancelled</InlineCode> with an{' '}
            <InlineCode>error_code</InlineCode> that says which. When it completes,{' '}
            <InlineCode>summary</InlineCode> carries the finding counts by severity and which analyzers took
            part.
          </p>
          <Endpoint method="GET" path="/projects/{project_id}/scans" description="Cursor-pagated, newest first." />
          <Endpoint
            method="GET"
            path="/scans/{scan_id}"
            description="One run with its tool_runs — the trace of what actually executed."
          >
            <DocCodeBlock
              language="json"
              filename="ScanDetailOut.tool_runs[]"
              code={`{
  "tool_name": "semgrep",
  "status": "skipped",
  "tool_version": null,
  "exit_code": null,
  "duration_ms": null,
  "finding_count": 0,
  "error_code": "TOOL_NOT_INSTALLED"
}`}
            />
          </Endpoint>
          <Callout type="tip" title="Skipped is not failed">
            An optional CLI that is not installed reports{' '}
            <InlineCode>skipped</InlineCode>. The run still completes on the agent's own reading; absence of a
            tool never fails an audit.
          </Callout>
          <Endpoint method="POST" path="/scans/{scan_id}/cancel" description="Stop a queued or running audit. Findings already stored stay." />
        </section>

        <section id="findings" className={cn('scroll-mt-20 space-y-4', activeId !== 'findings' && 'hidden')}>
          <Heading icon={FileCode}>Findings and triage</Heading>
          <Endpoint method="GET" path="/scans/{scan_id}/findings" description="Findings for one run, cursor-paginated." />
          <Endpoint method="GET" path="/findings/{finding_id}" description="One finding with its stored reviewer explanation, if any." />
          <DocCodeBlock
            language="json"
            filename="FindingOut"
            code={`{
  "id": "…uuid…",
  "scan_id": "…uuid…",
  "tool_run_id": "…uuid…",         // which step reported this
  "rule_id": "python/sqlinjection",
  "title": "User input interpolated into a SQL string",
  "category": "injection",
  "severity": "high",              // critical | high | medium | low | info
  "confidence": "high",
  "file_path": "app/repo/users.py",
  "start_line": 42,
  "end_line": 48,
  "evidence": "…the exact lines read…",
  "scanner_message": "…",
  "impact": null,
  "remediation": null,
  "status": "open",                // open | accepted_risk | false_positive | fixed
  "triage_note": null,
  "triaged_at": null,
  "created_at": "2026-10-23T09:21:44Z",
  "ai_explanation": null
}`}
          />
          <Endpoint
            method="PATCH"
            path="/findings/{finding_id}"
            description="Set triage state. Every change writes an audit event and dispatches finding.triaged."
          >
            <ParamTable
              rows={[
                ['status', 'string', true, 'One of open, accepted_risk, false_positive, fixed.'],
                ['triage_note', 'string', false, 'Up to 4000 characters, stored with who wrote it.'],
              ]}
            />
          </Endpoint>
          <Callout type="warning" title="Evidence is data">
            <InlineCode>evidence</InlineCode>, <InlineCode>title</InlineCode> and every reviewer string come
            from untrusted source. They are rendered as escaped text in the console and returned verbatim
            here — treat them the same way in your own UI, and never interpolate one into a shell command or
            a query.
          </Callout>
        </section>

        <section id="report" className={cn('scroll-mt-20 space-y-4', activeId !== 'report' && 'hidden')}>
          <Heading icon={Box}>Report download</Heading>
          <Endpoint
            method="GET"
            path="/scans/{scan_id}/report"
            description="The report built from this run's stored findings, as an attachment. 409 until the run reaches a terminal state."
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            One report per run, generated from the rows in the database — not a second analysis, so pulling
            it costs no credits and cannot produce a different answer than the console shows.
          </p>
          <DocCodeBlock
            filename="report.sh"
            code={`curl -sL -o audit-$(date -u +%Y%m%d).sarif \\
  $BASE/scans/$SCAN/report -H "Authorization: Bearer $TOKEN"`}
          />
        </section>

        <section id="ai-select" className={cn('scroll-mt-20 space-y-4', activeId !== 'ai-select' && 'hidden')}>
          <Heading icon={Cpu}>Choosing a reviewer</Heading>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Reviewers are offered by alias and an opaque selection token. Which engine sits behind an alias is
            resolved on the server and is not part of this API: no response carries a provider name, a hosted
            model tag, or where a reply was computed. A client selects <InlineCode>mdl_…</InlineCode> and never
            learns more than the alias and its one-line note.
          </p>
          <Endpoint method="GET" path="/workspaces/{workspace_id}/ai/models" description="What the server can reach right now; the probe is cached briefly, so repeat calls are cheap.">
            <DocCodeBlock
              language="json"
              filename="Response (200 OK)"
              code={`{
  "items": [
    { "id": "mdl_1a2b3c4d5e6f7a8b", "alias": "Vulnix Fast",
      "note": "Compact reviewer. A quick first pass over the file." },
    { "id": "mdl_9f8e7d6c5b4a3f2e", "alias": "Vulnix Pro",
      "note": "Stronger reasoning, slower to answer." }
  ]
}`}
            />
          </Endpoint>
          <Endpoint
            method="PUT"
            path="/workspaces/{workspace_id}/ai/settings"
            description="Set the workspace's reviewer. Also reports the deployment default, whether AI is switched on at all, today's spend and the daily quota."
          >
            <ParamTable
              rows={[
                ['model_id', 'string', true, 'A selection token from the model list. A raw model name is not accepted.'],
              ]}
            />
          </Endpoint>
          <List>
            <li>Switching reviewers spends nothing. Only a reply costs.</li>
            <li>If the reviewer you selected does not answer in time, or cannot hold the text it was given,
              the request goes to the next configured reviewer. The reply still comes back under an alias,
              flagged <InlineCode>fallback: true</InlineCode> so the console can say it came from somewhere
              else. A reviewer that fails is rested before it is asked again, and a handover costs no credit.</li>
          </List>
        </section>

        <section id="ai-explain" className={cn('scroll-mt-20 space-y-4', activeId !== 'ai-explain' && 'hidden')}>
          <Heading icon={Code2}>Explaining a finding</Heading>
          <Endpoint
            method="POST"
            path="/findings/{finding_id}/explanation"
            description="Ask the selected reviewer about one finding. Idempotent per reviewer: an answer you already have comes back out of the row without a call."
          >
            <DocCodeBlock
              language="json"
              filename="Response (200 OK)"
              code={`{
  "finding_id": "…uuid…",
  "generated_by": "ai",
  "reviewer": "Vulnix Pro",
  "fallback": false,
  "generated_at": "2026-10-23T09:30:11Z",
  "summary": "Untrusted input reaches the SQL string builder at users.py:42.",
  "impact": "Anyone who controls the lookup value reads arbitrary rows.",
  "remediation_steps": ["Bind the value as a parameter instead of formatting it in."],
  "verification_steps": ["Pass a quote in the lookup and assert an empty result, not an error."],
  "confidence": "high",
  "limitations": "Runtime query builder is outside the imported tree.",
  "evidence_refs": ["app/repo/users.py:42-48"],
  "cached": false
}`}
            />
          </Endpoint>
          <ParamTable
            columns={['Code', 'Status', 'Retry', 'When']}
            rows={[
              ['AI_DISABLED', '503', 'No', 'No reviewer is enabled on this deployment.'],
              ['AI_MODEL_UNAVAILABLE', '422', 'Later', 'The entry you selected is not in the live catalog right now.'],
              ['AI_UNAVAILABLE', '503', 'Later', 'Every reviewer refused or ran out of time. One that fails is rested briefly before it is asked again.'],
              ['AI_MISCONFIGURED', '503 / 502', 'No', 'No usable endpoint or credential here, or a reviewer refused the request for a reason that is not about its width. The refusal text it sent is never passed on.'],
              ['AI_INVALID_OUTPUT', '502', 'Later', "The reply did not hold together as the required shape — nothing is stored."],
              ['AI_OUTPUT_TRUNCATED', '502', 'No', "The reply reached the output limit, so it is reported rather than re-asked somewhere else."],
              ['AI_CONTEXT_OVERFLOW', '413', 'No', 'The text to review is wider than that reviewer can read at once — refused before the request is sent, or read from the reviewer\'s own reason code. The audit continues on a wider one, and that reviewer is not rested for it.'],
            ]}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            An explanation is stored on the finding and projected back through{' '}
            <InlineCode>GET /findings/&#123;id&#125;</InlineCode> as <InlineCode>ai_explanation</InlineCode>.
            The projection keeps the answer and the alias that wrote it, and drops the internal routing and
            cost columns, so a client cannot recover more than the console shows.
          </p>
        </section>

        <section id="credits" className={cn('scroll-mt-20 space-y-4', activeId !== 'credits' && 'hidden')}>
          <Heading icon={Gauge}>Credits and usage</Heading>
          <List>
            <li>One credit is one question a reviewer answered. A call that failed, timed out or was refused
              costs nothing, and is counted separately so it stays visible.</li>
            <li>Re-reading an answer you already have is free — a stored explanation is returned from the row
              and no credit is spent, which is why <InlineCode>cached</InlineCode> exists.</li>
            <li>Asking a different reviewer about the same finding <em>is</em> a real call, and costs.</li>
            <li>The daily quota is per user across their workspaces and resets at midnight UTC.</li>
          </List>
          <Endpoint method="GET" path="/workspaces/{workspace_id}/ai/usage" description="Daily totals and a per-reviewer breakdown for the window.">
            <DocCodeBlock
              language="json"
              filename="AiUsageOut"
              code={`{
  "scope": "workspace",
  "since_day": "2026-09-24",
  "until_day": "2026-10-23",
  "total_credits": 41,
  "days": [{ "day": "2026-10-23", "credits": 6,
             "prompt_tokens": 18342, "completion_tokens": 2110 }],
  "models": [{ "alias": "Vulnix Pro", "calls": 44, "credits": 41,
               "failures": 3, "prompt_tokens": 128030,
               "completion_tokens": 15422, "last_day": "2026-10-23" }]
}`}
            />
          </Endpoint>
          <p className="text-xs leading-relaxed text-muted-foreground">
            An audit reviews up to <InlineCode>agent_max_files</InlineCode> files and stops at{' '}
            <InlineCode>agent_max_calls</InlineCode> calls, so one run against a large tree can spend a
            meaningful part of a day. Both knobs are server settings; read them before wiring a nightly audit
            to a big repository.
          </p>
        </section>

        <section id="webhooks" className={cn('scroll-mt-20 space-y-4', activeId !== 'webhooks' && 'hidden')}>
          <Heading icon={Webhook}>Signed webhooks</Heading>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Every delivery is signed with HMAC-SHA256 over{' '}
            <InlineCode>{'<timestamp>. + raw_body'}</InlineCode> using the endpoint's secret. The signature is
            sent as <InlineCode>x-vulnix-signature: v1=&lt;hex&gt;</InlineCode> alongside{' '}
            <InlineCode>x-vulnix-timestamp</InlineCode>, <InlineCode>x-vulnix-delivery</InlineCode> and{' '}
            <InlineCode>x-vulnix-event</InlineCode>.
          </p>
          <DocCodeBlock
            language="javascript"
            filename="verify.js"
            code={`const crypto = require('crypto')

function verify(rawBody, header, timestamp, secret, toleranceSeconds = 300) {
  if (!header || !header.startsWith('v1=')) return false
  // Sign the timestamp and the bytes exactly as received, before parsing.
  const expected = 'v1=' + crypto
    .createHmac('sha256', secret)
    .update(Buffer.from(timestamp + '.', 'utf8'))
    .update(rawBody)
    .digest('hex')
  const a = Buffer.from(expected), b = Buffer.from(header)
  if (a.length !== b.length) return false
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > toleranceSeconds) return false
  return crypto.timingSafeEqual(a, b)
}`}
          />
          <Callout type="danger" title="Verify before you trust a byte of it">
            The payload describes your own source: titles, file paths and notes are attacker-influenced
            strings once a request reaches your endpoint. Never render one unescaped or pass one into a
            command. A secret can be rotated from the console; the old signature stops working immediately,
            so rotate during a quiet window.
          </Callout>
          <Endpoint method="GET" path="/workspaces/{workspace_id}/integrations" description="Which providers are configured, without any credential material." />
          <Endpoint method="PUT" path="/workspaces/{workspace_id}/integrations/{provider}" description="Create or update one endpoint, including its secret." />
          <Endpoint method="DELETE" path="/workspaces/{workspace_id}/integrations/{provider}" description="Remove it." />
          <Endpoint method="POST" path="/workspaces/{workspace_id}/integrations/{provider}/test" description="Send a test event and report what came back." />
          <Endpoint method="GET" path="/workspaces/{workspace_id}/webhooks" description="Registered webhook endpoints for this workspace." />
          <Endpoint method="PATCH" path="/workspaces/{workspace_id}/webhooks/{webhook_id}" description="Change URL, events or the enabled flag." />
          <Endpoint method="DELETE" path="/workspaces/{workspace_id}/webhooks/{webhook_id}" description="Stop delivering to it." />
          <Endpoint method="POST" path="/workspaces/{workspace_id}/webhooks/{webhook_id}/test" description="Fire one signed test delivery through the real path." />
        </section>

        <section id="events" className={cn('scroll-mt-20 space-y-4', activeId !== 'events' && 'hidden')}>
          <Heading icon={FileCode}>Event payloads</Heading>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Four lifecycle events are delivered. Nothing else is, and a name outside this list will not be
            sent.
          </p>
          <ParamTable
            columns={['Event', 'Fires', 'Carries', 'Notes']}
            rows={[
              ['scan.completed', 'A run finished with findings stored.', 'project, scan (status, total_findings, by_severity, analyzers)', 'The scan id lets you fetch details over the API.'],
              ['scan.failed', 'A run failed or was cancelled.', 'the same run object plus error_code', 'Delivery is best-effort; a cancelled run still reports what it stored.'],
              ['finding.triaged', 'An engineer changed a triage state.', 'project, finding (title, category, severity, status)', 'The note text is not sent — pull it if you need it.'],
              ['integration.test', 'You pressed test.', 'workspace_id, test_of', 'Never counts toward real workflow automation.'],
            ]}
          />
          <DocCodeBlock
            language="json"
            filename="scan.completed"
            code={`{
  "event": "scan.completed",
  "occurred_at": "2026-10-23T09:22:03Z",
  "workspace_id": "…uuid…",
  "project": { "id": "…uuid…", "name": "acme-api" },
  "scan": {
    "id": "…uuid…",
    "status": "completed",
    "error_code": null,
    "total_findings": 7,
    "by_severity": { "critical": 1, "high": 2, "medium": 3, "low": 1, "info": 0 },
    "analyzers": ["agent", "gitleaks"]
  }
}`}
          />
        </section>

        <section id="retries" className={cn('scroll-mt-20 space-y-4', activeId !== 'retries' && 'hidden')}>
          <Heading icon={RefreshCw}>Retries and the delivery log</Heading>
          <List>
            <li>Up to <InlineCode>integration_max_attempts</InlineCode> attempts (5 by default), with exponential
              backoff from <InlineCode>integration_backoff_base_seconds</InlineCode> (30s).</li>
            <li>Each attempt has a fixed short timeout ({' '}
              <InlineCode>integration_timeout_seconds</InlineCode>, 5s), follows no redirects, and caps the
              response it will read at <InlineCode>integration_max_body_bytes</InlineCode>.</li>
            <li>A 2xx is success. Only retryable statuses are retried; a permanent rejection ends that
              delivery rather than burning the queue.</li>
            <li>The response body is never stored or logged. Read the outcome, not the echo.</li>
          </List>
          <Endpoint
            method="GET"
            path="/workspaces/{workspace_id}/integrations/deliveries"
            description="Cursor-pagated attempt log: provider, event, status, attempt count, error code, timing."
          />
        </section>

        <section id="oauth" className={cn('scroll-mt-20 space-y-4', activeId !== 'oauth' && 'hidden')}>
          <Heading icon={Lock}>GitHub, Slack and Jira connections</Heading>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Slack and Jira use browser-based OAuth authorization. GitHub uses its App installation flow, where
            an account owner chooses the repositories. Nothing on this API accepts a provider token in a
            request body; provider credentials are encrypted at rest and used only by the server.
          </p>
          <List>
            <li><strong className="text-foreground">GitHub</strong> uses the repositories granted in the
              GitHub App installation. Its short-lived installation token is renewed server-side, and{' '}
              <InlineCode>uploads/github</InlineCode> verifies the repository through that installation before
              streaming an archive. The platform never pushes to your repository.</li>
            <li><strong className="text-foreground">Slack</strong> and <strong className="text-foreground">Jira</strong>{' '}
              supply a destination for findings — a channel, or a site and project — chosen from what the
              connection can actually see.</li>
            <li>A revoked or expired connection surfaces as{' '}
              <InlineCode>OAUTH_CONNECTION_EXPIRED</InlineCode> / <InlineCode>OAUTH_TOKEN_REVOKED</InlineCode>;
              the answer is to reconnect in the console, not to retry the call.</li>
          </List>
          <Callout type="info" title="No hosted API, no published SDKs">
            There is no Vulnix CLI, container image, Helm chart or client library to install. Integration
            means HTTP against your own deployment, and the console itself is the only shipped client.
          </Callout>
        </section>

        <section id="config" className={cn('scroll-mt-20 space-y-4', activeId !== 'config' && 'hidden')}>
          <Heading icon={Terminal}>Environment settings</Heading>
          <p className="text-xs leading-relaxed text-muted-foreground">
            The server reads its configuration from environment variables prefixed{' '}
            <InlineCode>VULNIX_</InlineCode> (and from a git-ignored <InlineCode>.env</InlineCode> next to
            <InlineCode>backend/</InlineCode>). Credentials belong there and never in the repository;{' '}
            <InlineCode>.env.example</InlineCode> carries the key names with empty values.
          </p>
          <ParamTable
            columns={['Variable', 'Kind', 'Default', 'What it decides']}
            rows={[
              ['VULNIX_APP_ENV', 'string', 'development', 'Production turns on the safety checks below and refuses an empty JWT secret.'],
              ['VULNIX_DATABASE_URL', 'string', 'sqlite:///./.data/vulnix.db', 'Any SQLAlchemy URL; Postgres for more than one worker.'],
              ['VULNIX_STORAGE_BACKEND', 'local | s3', 'local', 'Where quarantined archives live.'],
              ['VULNIX_AI_ENABLED', 'boolean', 'false', 'Off means the console still audits, but no reviewer answers.'],
              ['VULNIX_AI_DAILY_QUOTA_PER_USER', 'integer', '300', 'Reviewer credits per user per day, reset at midnight UTC.'],
              ['VULNIX_AI_RATE_PER_MINUTE', 'integer', '60', 'Per-user call ceiling inside a minute.'],
              ['VULNIX_AGENT_MAX_FILES', 'integer', '40', 'Files one audit may review.'],
              ['VULNIX_AGENT_MAX_CALLS', 'integer', '40', 'Reviewer calls one audit may make.'],
              ['VULNIX_INTEGRATIONS_ENABLED', 'boolean', 'false', 'All outbound delivery, webhooks included.'],
              ['VULNIX_INTEGRATION_ALLOW_PRIVATE_TARGETS', 'boolean', 'false', 'Whether a webhook may point at a private address.'],
            ]}
          />
        </section>

        <section id="limits" className={cn('scroll-mt-20 space-y-4', activeId !== 'limits' && 'hidden')}>
          <Heading icon={AlertCircle}>Quotas and size limits</Heading>
          <p className="text-xs leading-relaxed text-muted-foreground">
            These are the numbers the server enforces today, with the settings key that changes each one.
          </p>
          <ParamTable
            columns={['Limit', 'Default', 'Setting']}
            rows={[
              ['Accepted archive size', '100 MiB', 'upload_max_bytes'],
              ['Uncompressed tree', '1 GiB', 'upload_max_uncompressed_bytes'],
              ['Files per archive', '10,000', 'upload_max_files'],
              ['Compression ratio', '100×', 'upload_max_compression_ratio'],
              ['Path nesting depth', '20', 'upload_max_nesting_depth'],
              ['Uploads per user, per hour', '20', 'upload_rate_per_hour'],
              ['Audits started per user, per hour', '20', 'scan_rate_per_hour'],
              ['Whole-run timeout', '900 s', 'scan_total_timeout_seconds'],
              ['One optional tool', '300 s', 'scanner_timeout_seconds'],
              ['Reviewer call, local', '20 s', 'ai_timeout_seconds'],
              ['Reviewer call, hosted', '30–45 s each', 'one timeout per hosted reviewer'],
              ['Rest after a reviewer fails', '60 s', 'ai_provider_cooldown_seconds'],
              ['Reply length, hosted', '2,048 tokens', 'ai_max_output_tokens'],
              ['Reviewer answers per user per day', '300', 'ai_daily_quota_per_user'],
              ['Outbound read per delivery', '64 KiB', 'integration_max_body_bytes'],
            ]}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            A per-minute and per-hour limiter is in-process today, which means it counts against one worker.
            Deploy behind a single process, or move the counters to shared storage before scaling out.
          </p>
        </section>

        <section id="sandbox" className={cn('scroll-mt-20 space-y-4', activeId !== 'sandbox' && 'hidden')}>
          <Heading icon={Shield}>Archive and egress guards</Heading>
          <List>
            <li><strong className="text-foreground">Before anything reads it:</strong> a source must be a ZIP
              (magic bytes are checked, not the filename), with no absolute paths, no{' '}
              <InlineCode>..</InlineCode> traversal, no symlinks escaping the tree, and each of the size,
              ratio, file-count and depth limits above. Rejection is{' '}
              <InlineCode>UNSAFE_ARCHIVE</InlineCode> or <InlineCode>INVALID_ARCHIVE</InlineCode>, and nothing
              is extracted.</li>
            <li><strong className="text-foreground">Reviewer input:</strong> a file is truncated to{' '}
              <InlineCode>agent_max_bytes_per_file</InlineCode> and delivered inside{' '}
              <InlineCode>{"<untrusted_code>"}</InlineCode> delimiters, with the instruction that content
              between them is data. Secrets are redacted before a prompt is ever built.</li>
            <li><strong className="text-foreground">Outbound:</strong> every destination passes an egress guard
              that refuses loopback, RFC 1918, link-local and the cloud metadata address, with redirects never
              followed. Pointing a webhook inward returns <InlineCode>TARGET_BLOCKED</InlineCode> and requires
              an operator to opt in explicitly.</li>
            <li><strong className="text-foreground">Logging:</strong> source text, prompts, tokens and provider
              response bodies are never written to logs — only codes, counts and ids.</li>
          </List>
        </section>

        <section id="tools" className={cn('scroll-mt-20 space-y-4', activeId !== 'tools' && 'hidden')}>
          <Heading icon={Box}>Optional scanner CLIs</Heading>
          <p className="text-xs leading-relaxed text-muted-foreground">
            The agent does the reviewing. These binaries sharpen it when they exist on the host: each one is
            located by name on <InlineCode>PATH</InlineCode> (or by the setting shown), and when it is absent
            its step reports <InlineCode>skipped</InlineCode> and the run carries on.
          </p>
          <ParamTable
            columns={['Tool', 'Contributes', 'Setting']}
            rows={[
              ['semgrep', 'Static-analysis findings, merged with the agent\'s by fingerprint', 'semgrep_path, semgrep_config'],
              ['gitleaks', 'Committed credential detection', 'gitleaks_path'],
              ['bandit', 'Python-specific security findings', 'bandit_path'],
              ['pip-audit', 'Known vulnerabilities in Python dependencies', 'pip_audit_path'],
              ['trivy', 'Filesystem and container-image checks', 'trivy_path'],
            ]}
          />
          <DocCodeBlock
            filename="install-tools.sh"
            code={`# Whatever you install here widens the evidence an audit can cite.
# Nothing is required, and none of it decides whether a run succeeds.
pip install semgrep bandit pip-audit
# gitleaks and trivy come from your own package manager or a vendored
# binary on the worker, since egress is closed by default.`}
          />
        </section>

        <nav aria-label="Documentation page navigation" className="flex items-center justify-between border-t border-border pt-5">
          {activeIndex > 0 ? (
            <Link
              to={`/docs/${DOC_ITEMS[activeIndex - 1].id}`}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              ← {DOC_ITEMS[activeIndex - 1].title}
            </Link>
          ) : <span />}
          {activeIndex < DOC_ITEMS.length - 1 && (
            <Link
              to={`/docs/${DOC_ITEMS[activeIndex + 1].id}`}
              className="ml-auto text-right text-xs font-medium text-primary transition-colors hover:text-primary/80"
            >
              {DOC_ITEMS[activeIndex + 1].title} →
            </Link>
          )}
        </nav>
        </div>
      </main>
      </div>
      {isPublic && (
        <div className="w-full">
          <VulnixLegalGraphicBanner />
          <VulnixFooter className="mt-4" />
        </div>
      )}
    </div>
  )
}
