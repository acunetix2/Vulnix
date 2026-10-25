import { AlertTriangle, Info, RotateCcw } from 'lucide-react'
import { Button } from './ui/button'
import { Skeleton } from './ui/skeleton'
import { Spinner } from './app/Spinner'
import { IconTile } from './app/IconTile'
import { cn } from '../lib/utils'

/**
 * The three states every async console screen must handle. Pages should not
 * hand-roll a spinner or a "no data" block.
 */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  compact = false,
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-8' : 'px-6 py-12',
        className
      )}
    >
      {Icon && (
        <IconTile
          icon={Icon}
          size={compact ? 'md' : 'lg'}
          className={compact ? 'mb-3' : 'mb-3.5'}
        />
      )}
      <h3 className="text-sm font-semibold text-foreground tracking-tight">{title}</h3>
      {description && (
        <p
          className={cn(
            'text-muted-foreground leading-relaxed',
            compact ? 'mt-1 max-w-xs text-xs' : 'mt-1.5 max-w-sm text-xs'
          )}
        >
          {description}
        </p>
      )}
      {action && <div className={compact ? 'mt-3.5' : 'mt-4'}>{action}</div>}
    </div>
  )
}

export function LoadingState({ label = 'Loading', className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-3 py-16 text-center', className)}>
      <Spinner />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  )
}

/** Rows that stand in for a table while its first page is in flight. */
export function TableSkeleton({ rows = 6, columns = 4, className }) {
  return (
    <div className={cn('space-y-2 p-5', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4">
          {Array.from({ length: columns }).map((__, c) => (
            <Skeleton
              key={c}
              className={cn('h-4', c === 0 ? 'w-20 shrink-0' : c === columns - 1 ? 'ml-auto w-16 shrink-0' : 'flex-1')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Grid of panel-shaped placeholders for dashboard-style pages. */
export function PanelsSkeleton({ count = 3, className }) {
  return (
    <div className={cn('space-y-4', className)} role="status" aria-label="Loading">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[88px] rounded-xl" />
        ))}
      </div>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-64 rounded-xl" />
      ))}
    </div>
  )
}

/** Full-page realistic skeleton for list and table pages (Stat cards, Toolbar, and Table). */
export function TablePageSkeleton({
  statCards = 4,
  showToolbar = true,
  rows = 8,
  columns = 5,
  className,
}) {
  return (
    <div className={cn('space-y-6', className)} role="status" aria-label="Loading page">
      {statCards > 0 && (
        <div
          className={cn(
            'grid gap-4',
            statCards === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'
          )}
        >
          {Array.from({ length: statCards }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl border border-border/70 bg-card p-4.5 shadow-xs"
            >
              <Skeleton className="size-11 rounded-xl shrink-0" />
              <div className="space-y-2 flex-1 min-w-0">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-6 w-14" />
                <Skeleton className="h-3 w-28" />
              </div>
            </div>
          ))}
        </div>
      )}

      {showToolbar && (
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-sm">
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-36 rounded-lg" />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border/70 bg-card shadow-xs overflow-hidden">
        <div className="border-b border-border/60 bg-muted/30 px-5 py-3.5 flex items-center gap-4">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={c}
              className={cn(
                'h-3.5',
                c === 0 ? 'w-24 shrink-0' : c === columns - 1 ? 'ml-auto w-20 shrink-0' : 'flex-1'
              )}
            />
          ))}
        </div>
        <div className="divide-y divide-border/40 p-2">
          {Array.from({ length: rows }).map((_, r) => (
            <div key={r} className="flex items-center gap-4 px-3 py-3.5">
              {Array.from({ length: columns }).map((__, c) => (
                <Skeleton
                  key={c}
                  className={cn(
                    'h-4',
                    c === 0 ? 'w-32 shrink-0' : c === columns - 1 ? 'ml-auto w-20 shrink-0' : 'flex-1'
                  )}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Full-page skeleton for Notifications Center */
export function NotificationsPageSkeleton({ className }) {
  return (
    <div className={cn('console-enter space-y-6', className)} role="status" aria-label="Loading notifications">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-40 rounded-lg" />
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg shrink-0" />
      </div>

      <div className="rounded-xl border border-border/70 bg-card shadow-xs overflow-hidden">
        <div className="border-b border-border/60 bg-muted/20 px-5 py-4 flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-3 w-48 rounded-md" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="divide-y divide-border/40">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3.5 px-5 py-3.5">
              <Skeleton className="size-8 rounded-full shrink-0" />
              <div className="space-y-2 flex-1 min-w-0">
                <Skeleton className={cn('h-3.5 rounded-md', i % 2 === 0 ? 'w-3/5' : 'w-2/5')} />
                <Skeleton className="h-3 w-1/3 rounded-md" />
              </div>
              <Skeleton className="h-3 w-16 rounded-md shrink-0 hidden sm:block" />
            </div>
          ))}
        </div>
        <div className="border-t border-border/50 px-5 py-3.5 bg-muted/10">
          <Skeleton className="h-4 w-36 rounded-md" />
        </div>
      </div>
    </div>
  )
}

/** Full-page skeleton for Secrets Dashboard */
export function SecretsPageSkeleton({ className }) {
  return (
    <div className={cn('console-enter space-y-6', className)} role="status" aria-label="Loading secret findings">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg shrink-0" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-border/70 bg-card p-4.5 shadow-xs">
            <Skeleton className="size-11 rounded-xl shrink-0" />
            <div className="space-y-2 flex-1 min-w-0">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="h-6 w-12 rounded-md" />
              <Skeleton className="h-3 w-28 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Skeleton className="h-9 w-full max-w-sm rounded-lg" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card shadow-xs overflow-hidden">
        <div className="border-b border-border/60 bg-muted/20 px-5 py-3.5 flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-36 rounded-md" />
            <Skeleton className="h-3 w-48 rounded-md" />
          </div>
        </div>
        <div className="border-b border-border/60 bg-muted/30 px-5 py-3 flex items-center gap-4">
          <Skeleton className="h-3.5 w-20 shrink-0" />
          <Skeleton className="h-3.5 w-40 shrink-0" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-28 shrink-0 hidden md:block" />
          <Skeleton className="h-3.5 w-24 shrink-0" />
        </div>
        <div className="divide-y divide-border/40 p-2">
          {Array.from({ length: 6 }).map((_, r) => (
            <div key={r} className="flex items-center gap-4 px-3 py-3.5">
              <Skeleton className="h-5 w-16 rounded-full shrink-0" />
              <Skeleton className="h-4 w-36 shrink-0" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-28 shrink-0 hidden md:block" />
              <Skeleton className="h-8 w-20 rounded-lg shrink-0 ml-auto" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3 shadow-xs">
        <Skeleton className="h-5 w-52 rounded-md" />
        <Skeleton className="h-3.5 w-96 rounded-md" />
        <div className="space-y-2 pt-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="size-5 rounded-full shrink-0" />
              <Skeleton className="h-3.5 flex-1 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Full-page skeleton for Reports Dashboard */
export function ReportsPageSkeleton({ className }) {
  return (
    <div className={cn('console-enter space-y-6', className)} role="status" aria-label="Loading reports">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32 rounded-lg" />
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>
        <Skeleton className="h-9 w-28 rounded-lg shrink-0" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-border/70 bg-card p-4.5 shadow-xs">
            <Skeleton className="size-11 rounded-xl shrink-0" />
            <div className="space-y-2 flex-1 min-w-0">
              <Skeleton className="h-3 w-24 rounded-md" />
              <Skeleton className="h-6 w-12 rounded-md" />
              <Skeleton className="h-3 w-28 rounded-md" />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/70 bg-card shadow-xs overflow-hidden">
        <div className="border-b border-border/60 bg-muted/20 px-5 py-3.5 flex items-center justify-between">
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-40 rounded-md" />
            <Skeleton className="h-3 w-56 rounded-md" />
          </div>
        </div>
        <div className="border-b border-border/60 bg-muted/30 px-5 py-3 flex items-center gap-4">
          <Skeleton className="h-3.5 w-32 shrink-0" />
          <Skeleton className="h-3.5 w-28 shrink-0" />
          <Skeleton className="h-3.5 flex-1" />
          <Skeleton className="h-3.5 w-36 shrink-0" />
          <Skeleton className="h-3.5 w-24 shrink-0" />
        </div>
        <div className="divide-y divide-border/40 p-2">
          {Array.from({ length: 6 }).map((_, r) => (
            <div key={r} className="flex items-center gap-4 px-3 py-3.5">
              <Skeleton className="h-4 w-32 shrink-0" />
              <Skeleton className="h-3.5 w-24 shrink-0" />
              <div className="flex items-center gap-2 flex-1">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Skeleton className="h-8 w-20 rounded-lg" />
                <Skeleton className="h-8 w-20 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-8 rounded-lg shrink-0 ml-auto" />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-5 space-y-2 shadow-xs">
        <Skeleton className="h-4 w-48 rounded-md" />
        <Skeleton className="h-3 w-full max-w-xl rounded-md" />
      </div>
    </div>
  )
}

/** Full-page skeleton for Integrations page */
export function IntegrationsPageSkeleton({ className }) {
  return (
    <div className={cn('console-enter space-y-6', className)} role="status" aria-label="Loading integrations">
      <div className="space-y-2">
        <Skeleton className="h-7 w-36 rounded-lg" />
        <Skeleton className="h-4 w-80 rounded-md" />
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Skeleton className="h-9 w-full max-w-sm rounded-lg" />
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col justify-between rounded-xl border border-border/70 bg-card p-5 shadow-xs space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Skeleton className="size-10 rounded-xl shrink-0" />
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28 rounded-md" />
                    <Skeleton className="h-3 w-16 rounded-md" />
                  </div>
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <Skeleton className="h-3.5 w-full rounded-md" />
              <Skeleton className="h-3.5 w-4/5 rounded-md" />
            </div>
            <div className="pt-2 border-t border-border/50 flex items-center justify-between">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="h-8 w-24 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-5 space-y-3 shadow-xs">
        <Skeleton className="h-4 w-52 rounded-md" />
        <Skeleton className="h-3 w-96 rounded-md" />
        <div className="flex gap-2 pt-1">
          <Skeleton className="h-8 w-40 rounded-lg" />
          <Skeleton className="h-8 w-36 rounded-lg" />
        </div>
      </div>
    </div>
  )
}

/** Full-page skeleton for Settings page */
export function SettingsPageSkeleton({ className }) {
  return (
    <div className={cn('console-enter mx-auto max-w-[1200px] pb-12', className)} role="status" aria-label="Loading settings">
      <div className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div className="space-y-2">
          <Skeleton className="h-3 w-24 rounded-md" />
          <Skeleton className="h-7 w-32 rounded-md" />
          <Skeleton className="h-4 w-80 rounded-md" />
        </div>
        <Skeleton className="h-10 w-48 rounded-md" />
      </div>

      <div className="mt-7 grid min-w-0 gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <nav className="hidden space-y-6 lg:block" aria-hidden="true">
          <div className="space-y-2">
            <Skeleton className="h-3 w-20 rounded-md" />
            <Skeleton className="h-8 w-40 rounded-md" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-24 rounded-md" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-44 rounded-md" />
            ))}
          </div>
        </nav>
        <div className="min-w-0 lg:border-l lg:border-border lg:pl-9">
          <div className="mb-5 flex items-start gap-3 border-b border-border pb-5">
            <Skeleton className="size-9 rounded-md" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-36 rounded-md" />
              <Skeleton className="h-4 w-64 rounded-md" />
            </div>
          </div>
          <div className="space-y-5">
            <Skeleton className="h-24 w-full rounded-md" />
            <Skeleton className="h-24 w-full rounded-md" />
          </div>
        </div>
      </div>
    </div>
  )
}

const ERROR_TONES = {
  danger: { tile: 'bg-red-50 text-red-600', Icon: AlertTriangle },
  // "This feature cannot work yet" is not a failure the user can retry, so it
  // must not borrow the alarm colour of a request that just failed.
  info: { tile: 'bg-muted text-muted-foreground', Icon: Info },
}

export function ErrorState({
  title = 'We couldn’t load this page',
  description = 'Check your connection and try again.',
  tone = 'danger',
  onRetry,
  retryLabel = 'Retry',
  actions,
  className,
}) {
  const { tile, Icon } = ERROR_TONES[tone] || ERROR_TONES.danger

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-14 text-center',
        className
      )}
      role="alert"
    >
      <span className={cn('mb-4 flex size-11 items-center justify-center rounded-lg', tile)}>
        <Icon className="size-5" />
      </span>
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      )}
      {(onRetry || actions) && (
        <div className="mt-5 flex items-center gap-2">
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RotateCcw data-icon="inline-start" />
              {retryLabel}
            </Button>
          )}
          {actions}
        </div>
      )}
    </div>
  )
}
