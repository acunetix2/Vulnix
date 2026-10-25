import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Building2,
  ChevronRight,
  CircleUser,
  LogOut,
  MoreHorizontal,
  Settings as SettingsIcon,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { UserAvatar } from '../app/UserAvatar'
import { IconTile } from '../app/IconTile'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'
import { NAV_GROUPS, NAV_UTILITY_ITEMS } from '../../lib/navigation'

// Destinations live in one place so the search palette cannot drift from the
// rail. See lib/navigation.js for the information architecture.
const groups = NAV_GROUPS

const GROUP_FLAGS = 'vulnix.nav.groups'

function readFlags() {
  try {
    const stored = JSON.parse(localStorage.getItem(GROUP_FLAGS))
    return stored && typeof stored === 'object' ? stored : {}
  } catch {
    return {}
  }
}

function writeFlags(value) {
  try {
    localStorage.setItem(GROUP_FLAGS, JSON.stringify(value))
  } catch {
    // A storage failure (private mode, quota) must never break navigation.
  }
}

/**
 * Groups start expanded and stay wherever the user left them. A deliberate
 * collapse outranks the active route: hiding the section you are looking at
 * would be a surprise, but silently ignoring the collapse button is worse.
 */
function useGroupFlags() {
  const [flags, setFlags] = useState(readFlags)

  function isExpanded(key) {
    return flags[key] !== false
  }

  function toggle(key, next) {
    setFlags((prev) => {
      const value = { ...prev, [key]: next }
      writeFlags(value)
      return value
    })
  }

  return { isExpanded, toggle }
}

/** The icon rail has no room for a label, so the label has to arrive on hover. */
function RailTooltip({ label, children }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right" sideOffset={10} className="px-2 py-1">
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

function NavItem({ item, collapsed = false, depth = 0, className }) {
  if (!item.href) {
    // A destination that exists in the product story but not yet in the API.
    // Kept as static text so nobody clicks into a blank route.
    return (
      <span
        className={cn(
          'flex items-center gap-2.5 rounded-md py-1.5 pr-2.5 pl-9 text-sm',
          'text-sidebar-foreground/45'
        )}
      >
        <span className="truncate">{item.name}</span>
        <span className="ml-auto shrink-0 text-[11px]">{item.note}</span>
      </span>
    )
  }

  const link = (
    <NavLink
      to={item.href}
      target={item.target}
      rel={item.target === '_blank' ? 'noopener noreferrer' : undefined}
      aria-label={item.name}
      className={cn(
        'group relative flex items-center gap-2.5 rounded-md py-1.5 pr-2.5',
        collapsed ? 'justify-center px-0' : depth > 0 ? 'pl-9' : 'pl-2',
        'text-base text-sidebar-foreground transition-colors duration-150 ease-smooth',
        'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
        'aria-[current=page]:bg-brand aria-[current=page]:font-semibold aria-[current=page]:text-brand-foreground',
        'aria-[current=page]:hover:bg-brand/90 aria-[current=page]:hover:text-brand-foreground',
        className
      )}
    >
      {item.icon && (
        <IconTile
          icon={item.icon}
          size="sm"
          className={cn(
            'border-transparent bg-transparent text-sidebar-foreground transition-colors duration-150 group-hover:border-sidebar-border group-hover:bg-sidebar-accent',
            'group-aria-[current=page]:border-transparent group-aria-[current=page]:bg-transparent group-aria-[current=page]:text-brand-foreground group-aria-[current=page]:shadow-none'
          )}
        />
      )}
      {!collapsed && <span className="truncate">{item.name}</span>}
    </NavLink>
  )

  return collapsed ? <RailTooltip label={item.name}>{link}</RailTooltip> : link
}

const chevron = 'size-3.5 shrink-0 transition-transform duration-200 ease-smooth'

/**
 * The signed-in account, at the foot of the rail. The handle is what the console
 * promises to show instead of a primary key, so it leads; the email is the
 * secondary line and the fallback for an account that never claimed one.
 */
function SidebarProfile({ rail }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const primary = user?.username ? `@${user.username}` : user?.display_name || user?.email || 'Account'
  const secondary = user?.username ? user?.display_name || user?.email : user?.display_name

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Account menu"
            className={cn(
              'flex min-h-11 w-full items-center gap-3 rounded-lg p-2 text-left transition-colors duration-150 ease-smooth',
              'hover:bg-sidebar-accent focus-visible:bg-sidebar-accent',
              rail && 'justify-center'
            )}
          />
        }
      >
        <UserAvatar person={user} className="size-9 shrink-0" />
        {!rail && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-semibold text-sidebar-accent-foreground">{primary}</span>
            {secondary && (
              <span className="block truncate text-sm text-sidebar-foreground/70">
                {secondary}
              </span>
            )}
          </span>
        )}
        {!rail && <MoreHorizontal className="size-5 shrink-0 text-sidebar-foreground/60" aria-hidden />}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side={rail ? 'right' : 'top'} sideOffset={8} className="w-72 p-2">
        <DropdownMenuLabel className="px-3 py-2">
          <div className="flex min-w-0 flex-col space-y-1">
            <p className="truncate text-base font-semibold text-foreground">{primary}</p>
            <p className="truncate text-sm text-muted-foreground">{user?.email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11 gap-2.5 px-3 py-2 text-base" onClick={() => navigate('/app/settings/account')}>
          <CircleUser data-icon="inline-start" className="size-[18px]" />
          Account
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 gap-2.5 px-3 py-2 text-base" onClick={() => navigate('/app/settings/workspace')}>
          <Building2 data-icon="inline-start" className="size-[18px]" />
          Workspace
        </DropdownMenuItem>
        <DropdownMenuItem className="min-h-11 gap-2.5 px-3 py-2 text-base" onClick={() => navigate('/app/settings')}>
          <SettingsIcon data-icon="inline-start" className="size-[18px]" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11 gap-2.5 px-3 py-2 text-base" variant="destructive" onClick={logout}>
          <LogOut data-icon="inline-start" className="size-[18px]" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/** A destination that owns sub-destinations, e.g. Integrations to Slack/Jira/Webhooks. */
function ParentItem({ item, pathname, collapsed, open, onToggle }) {
  const childActive = item.children.some(
    (child) => child.href && pathname.startsWith(child.href)
  )

  return (
    <div>
      <div className={cn('flex items-center rounded-md', childActive && 'bg-sidebar-accent/60')}>
        <NavItem item={item} collapsed={collapsed} className="min-w-0 flex-1" />
        {!collapsed && (
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? 'Hide' : 'Show'} ${item.name} destinations`}
            onClick={() => onToggle(!open)}
            className="grid size-7 shrink-0 place-items-center rounded-md text-sidebar-foreground/55 transition-colors duration-150 ease-smooth hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <ChevronRight className={cn(chevron, open && 'rotate-90')} aria-hidden />
          </button>
        )}
      </div>

      <div
        className={cn(
          'grid transition-[grid-template-rows,opacity] duration-200 ease-smooth',
          open && !collapsed ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        )}
      >
        <div className="overflow-hidden">
          <div className="space-y-px pt-0.5 pb-1">
            {item.children.map((child) => (
              <NavItem key={child.name} item={child} collapsed={collapsed} depth={1} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export function Sidebar({ isOpen, onClose }) {
  const { pathname } = useLocation()
  const nav = useGroupFlags()
  const [hovered, setHovered] = useState(false)
  const expanded = isOpen || hovered
  const rail = !expanded

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-[1px] lg:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-sidebar-border bg-sidebar shadow-xl',
          'transition-[transform,width] duration-200 ease-drawer lg:w-16 lg:shadow-none',
          expanded && 'lg:w-60',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <TooltipProvider delay={250}>
          <div
            className={cn(
              'flex h-16 shrink-0 items-center border-b border-sidebar-border',
              rail ? 'justify-center px-2' : 'gap-2.5 px-4'
            )}
          >
            <Link
              to="/app/dashboard"
              className={cn('flex min-w-0 items-center gap-2', rail && 'justify-center')}
              onClick={onClose}
              aria-label="Vulnix overview"
            >
              <img src="/vulnix-logo.png" alt="" className="size-7 shrink-0 rounded-md" />
              {!rail && (
                <span className="truncate text-sm font-semibold tracking-tight text-sidebar-accent-foreground">
                  <span className="text-brand">Vulnix</span>
                </span>
              )}
            </Link>
          </div>

          <nav className="rail-scroll flex-1 overflow-y-auto px-3 py-4" aria-label="Console">
            {groups.map((group) => {
              // An icon rail has no header to collapse behind, so every
              // destination stays visible; grouping is carried by a divider.
              const open = rail || nav.isExpanded(group.label)

              return (
                <div
                  key={group.label}
                  className={cn(
                    'mb-4 last:mb-0',
                    rail && 'border-t border-sidebar-border pt-3 first:border-0 first:pt-0'
                  )}
                >
                  {!rail && (
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => nav.toggle(group.label, !open)}
                      className="mb-1.5 flex w-full items-center gap-1.5 px-2 text-[11px] font-medium tracking-wide text-sidebar-foreground/60 transition-colors duration-150 ease-smooth hover:text-sidebar-accent-foreground"
                    >
                      <ChevronRight className={cn(chevron, 'size-3', open && 'rotate-90')} aria-hidden />
                      <span>{group.label}</span>
                      <span className="ml-auto tabular-nums text-[10px] text-sidebar-foreground/45">
                        {group.items.length}
                      </span>
                    </button>
                  )}

                  <div
                    className={cn(
                      'grid transition-[grid-template-rows,opacity] duration-200 ease-smooth',
                      open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="space-y-px">
                        {group.items.map((item) =>
                          item.children ? (
                            <ParentItem
                              key={item.name}
                              item={item}
                              pathname={pathname}
                              collapsed={rail}
                              open={nav.isExpanded(`${group.label}/${item.name}`)}
                              onToggle={(next) => nav.toggle(`${group.label}/${item.name}`, next)}
                            />
                          ) : (
                            <NavItem key={item.name} item={item} collapsed={rail} />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </nav>
        </TooltipProvider>

        <div className="shrink-0 border-t border-sidebar-border p-2">
          <TooltipProvider delay={250}>
            <div className="mb-2 space-y-px">
              {NAV_UTILITY_ITEMS.map((item) => (
                <NavItem key={item.name} item={item} collapsed={rail} />
              ))}
            </div>
          </TooltipProvider>
          <SidebarProfile rail={rail} />
        </div>
      </aside>
    </>
  )
}
