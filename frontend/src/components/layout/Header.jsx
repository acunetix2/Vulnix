import { Menu, Moon, Search, Sun } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { Button } from '../ui/button'
import { NotificationDropdown } from '../app/NotificationDropdown'
import { cn } from '../../lib/utils'
import { useTheme } from '../../contexts/ThemeContext'
import { NAV_ITEMS } from '../../lib/navigation'

const IS_MAC =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent)

function Key({ children }) {
  return (
    <kbd className="ml-auto hidden shrink-0 rounded border border-border bg-background px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground sm:block">
      {children}
    </kbd>
  )
}

export function Header({ onMenuClick, onSearchClick }) {
  const { theme, toggleTheme } = useTheme()
  const { pathname } = useLocation()
  const activePage = NAV_ITEMS
    .filter(({ href }) => pathname === href || pathname.startsWith(`${href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]
  const pageTitle =
    activePage?.name ??
    (pathname === '/app/notifications'
      ? 'Notifications'
      : pathname.startsWith('/app/settings/')
        ? 'Settings'
        : pathname.startsWith('/app/audits/')
          ? 'Audits'
          : 'Overview')

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-30 flex h-16 items-center gap-3 border-b border-border pr-4 pl-3',
        'bg-background/85 backdrop-blur-sm lg:left-16 lg:pr-6 lg:pl-5'
      )}
    >
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="Open navigation"
        onClick={onMenuClick}
      >
        <Menu />
      </Button>

      <h1 className="min-w-0 flex-1 truncate text-base font-semibold tracking-tight text-foreground sm:text-lg">
        {pageTitle}
      </h1>

      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {/* Search opens the command palette; keep it beside the global theme control. */}
        <button
          type="button"
          onClick={onSearchClick}
          aria-label="Search Vulnix"
          className={cn(
            'flex h-10 w-10 items-center justify-center gap-2 rounded-lg border border-border sm:w-auto sm:justify-start sm:px-3.5',
            'bg-muted/40 text-sm text-muted-foreground shadow-2xs',
            'transition-colors duration-150 ease-smooth hover:border-border-strong hover:bg-muted/70',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring'
          )}
        >
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="hidden sm:block">Search</span>
          <Key>{IS_MAC ? '⌘' : 'Ctrl'} K</Key>
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          aria-pressed={theme === 'dark'}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </Button>
        <NotificationDropdown />
      </div>
    </header>
  )
}
