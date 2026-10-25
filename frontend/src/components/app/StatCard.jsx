import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { IconTile } from './IconTile'

/**
 * Metric tile. DESIGN.md requires each metric to lead to the filtered data
 * behind it, so pass `to` and the whole tile becomes the link — not a
 * decorative card with an arrow someone has to hunt for.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  to,
  className,
}) {
  const body = (
    <>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-foreground tabular-nums">
          {value}
        </p>
        {hint && (
          <p className="mt-1 flex items-center gap-1.5 truncate text-xs font-medium text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
      {Icon && (
        <IconTile
          icon={Icon}
          size="md"
          className="transition-transform duration-150 group-hover/stat:scale-105"
        />
      )}
    </>
  )

  const shell = cn(
    'console-enter flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.03)]',
    to &&
      'group/stat transition-[border-color,box-shadow,transform] duration-150 ease-smooth hover:border-border-strong hover:shadow-sm hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    className
  )

  if (to) {
    return (
      <Link to={to} className={shell}>
        {body}
      </Link>
    )
  }

  return <div className={shell}>{body}</div>
}
