import { cn } from '../../lib/utils'

/**
 * The one content block in the console: page header -> panels separated by 4
 * units. `flush` drops body padding for tables and lists that need to run
 * edge to edge.
 */
export function Panel({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  flush = false,
  footer,
  variant = 'card',
}) {
  const flat = variant === 'flat'

  return (
    <section
      className={cn(
        flat
          ? 'console-enter overflow-hidden border-b border-border bg-transparent last:border-b-0'
          : 'console-enter overflow-hidden rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.03)] transition-shadow duration-150',
        className
      )}
    >
      {(title || actions) && (
        <header
          className={cn(
            'flex items-center justify-between gap-3',
            flat
              ? 'border-b border-border/70 bg-transparent py-3'
              : 'border-b border-border/80 bg-background/50 px-4 py-3 backdrop-blur-xs'
          )}
        >
          <div className="min-w-0">
            {title && (
              <h2 className="truncate text-sm font-semibold text-foreground tracking-tight">{title}</h2>
            )}
            {description && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn(!flush && (flat ? 'py-4' : 'p-4'), bodyClassName)}>{children}</div>
      {footer && (
        <footer
          className={cn(
            'border-t border-border py-2.5 text-xs text-muted-foreground',
            flat ? 'bg-transparent' : 'bg-muted/30 px-4'
          )}
        >
          {footer}
        </footer>
      )}
    </section>
  )
}
