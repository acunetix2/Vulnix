import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'

/**
 * The two halves of an audit cycle, in the URL rather than in local state:
 * the runs that happened, and what they found. A tab is a link because the
 * destination is worth bookmarking and worth landing on from a notification.
 */
const TABS = [
  { to: '/app/audits/runs', label: 'Runs' },
  { to: '/app/audits/findings', label: 'Findings' },
]

export function AuditTabs({ className }) {
  const { pathname } = useLocation()

  return (
    <nav aria-label="Audits" className={cn('flex items-center gap-1 border-b border-border', className)}>
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.to)
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className={cn(
              '-mb-px relative rounded-t-md px-3 py-2 text-sm font-medium transition-colors',
              'border-b-2 border-transparent text-muted-foreground hover:text-foreground',
              active && 'border-primary text-foreground'
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
