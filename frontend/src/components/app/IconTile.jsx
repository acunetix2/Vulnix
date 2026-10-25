import { cn } from '../../lib/utils'

const SIZES = {
  sm: 'size-8 rounded-lg [&_svg]:size-[18px]',
  md: 'size-12 rounded-xl [&_svg]:size-6',
  lg: 'size-14 rounded-xl [&_svg]:size-7',
}

export function IconTile({ icon: Icon, size = 'md', className, iconClassName, ...props }) {
  if (!Icon) return null

  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-border bg-muted text-foreground shadow-[inset_0_1px_0_color-mix(in_oklab,var(--foreground)_8%,transparent),0_1px_2px_rgba(0,0,0,0.08)]',
        SIZES[size] || SIZES.md,
        className
      )}
      {...props}
    >
      <Icon
        aria-hidden
        strokeWidth={1.65}
        className={cn('drop-shadow-[0_1px_0_color-mix(in_oklab,var(--foreground)_10%,transparent)]', iconClassName)}
      />
    </span>
  )
}
