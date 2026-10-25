import { Search, X } from 'lucide-react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

/**
 * Search + filter row for list pages. Filters are passed as children so pages
 * stay free to use Select/Popover without this component knowing about them.
 */
export function Toolbar({
  search,
  onSearch,
  placeholder = 'Search…',
  filters,
  onClearFilters,
  resultCount,
  children,
  className,
}) {
  const hasSearch = onSearch !== undefined

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-wrap items-center gap-2">
        {hasSearch && (
          <div className="relative w-full min-w-0 sm:w-96 md:w-[26rem] lg:max-w-xl">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={placeholder}
              aria-label={placeholder}
              className="h-11 rounded-lg pl-10.5 pr-10 text-sm shadow-2xs"
            />
            {search && (
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Clear search"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => onSearch('')}
              >
                <X className="size-4" />
              </Button>
            )}
          </div>
        )}

        {filters && (
          <div className="flex flex-wrap items-center gap-2">{filters}</div>
        )}

        {children && (
          <div className="flex flex-wrap items-center gap-2 sm:ml-auto">{children}</div>
        )}
      </div>

      {(resultCount !== undefined || onClearFilters) && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {resultCount !== undefined && (
            <span className="tabular-nums">
              {resultCount} {resultCount === 1 ? 'result' : 'results'}
            </span>
          )}
          {onClearFilters && (
            <Button variant="link" size="xs" onClick={onClearFilters} className="h-auto p-0">
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
