import { cn } from '../../lib/utils'

/**
 * Responsive card grid for list pages (projects, integrations, team...).
 */
export function CardGrid({ children, columns = 3, className }) {
  const widths = {
    2: 'sm:grid-cols-2',
    3: 'md:grid-cols-2 xl:grid-cols-3',
    4: 'sm:grid-cols-2 xl:grid-cols-4',
  }
  return (
    <div className={cn('grid grid-cols-1 gap-4', widths[columns] || widths[3], className)}>
      {children}
    </div>
  )
}

/** Grid of metric tiles. */
export function StatGrid({ children, columns = 4, className }) {
  const widths = {
    2: 'sm:grid-cols-2',
    3: 'sm:grid-cols-2 lg:grid-cols-3',
    4: 'sm:grid-cols-2 lg:grid-cols-4',
    5: 'sm:grid-cols-2 lg:grid-cols-5',
  }
  return (
    <div className={cn('grid grid-cols-1 gap-4', widths[columns] || widths[4], className)}>
      {children}
    </div>
  )
}

/** Consistent vertical rhythm for a page's sections. */
export function PageStack({ children, className }) {
  return <div className={cn('space-y-4', className)}>{children}</div>
}
