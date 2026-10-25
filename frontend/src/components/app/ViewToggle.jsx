import { LayoutGrid, List } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

export function ViewToggle({ value, onChange, className }) {
  return (
    <div
      role="group"
      aria-label="Choose layout"
      className={cn('inline-flex items-center rounded-lg border border-border p-0.5', className)}
    >
      {[
        { value: 'grid', label: 'Grid view', icon: LayoutGrid },
        { value: 'list', label: 'List view', icon: List },
      ].map(({ value: mode, label, icon: Icon }) => (
        <Button
          key={mode}
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={value === mode}
          title={label}
          onClick={() => onChange(mode)}
          className={cn(
            'size-7',
            value === mode
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Icon className="size-4" aria-hidden />
        </Button>
      ))}
    </div>
  )
}
