import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '../../lib/utils'

/**
 * Standard page header: optional breadcrumb, title, description, right-aligned
 * actions. Every app page starts with <PageHeader ... />.
 */
export function PageHeader({ title, description, actions, breadcrumb, meta, children }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-2">
            <ol className="flex items-center gap-1 text-xs text-muted-foreground">
              {breadcrumb.map((crumb, i) => {
                const last = i === breadcrumb.length - 1
                return (
                  <li key={`${crumb.label}-${i}`} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight className="size-3 text-border-strong" aria-hidden />}
                    {crumb.to && !last ? (
                      <Link to={crumb.to} className="transition-colors hover:text-foreground">
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={cn(last && 'text-foreground')}>{crumb.label}</span>
                    )}
                  </li>
                )
              })}
            </ol>
          </nav>
        )}
        <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
      </div>
      {(actions || children) && (
        <div className="flex shrink-0 items-center gap-2">{actions}{children}</div>
      )}
    </div>
  )
}
