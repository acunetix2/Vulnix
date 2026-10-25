import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs'
import { cn } from '../../lib/utils'

/**
 * Console tab strip. Replaces the six hand-rolled underline rows that used to
 * exist across the app, and brings Base UI's arrow-key roving focus with it.
 */
function ConsoleTabsList({ className, children }) {
  return (
    <TabsList
      variant="line"
      className={cn(
        'w-full justify-start gap-0 rounded-none border-b border-border bg-transparent p-0 h-9',
        className
      )}
    >
      {children}
    </TabsList>
  )
}

function ConsoleTabsTrigger({ value, count, className, children }) {
  return (
    <TabsTrigger
      value={value}
      className={cn(
        'h-full rounded-none px-3 py-0 text-sm font-medium text-muted-foreground transition-[color] duration-150 ease-smooth hover:text-foreground data-active:text-foreground data-active:shadow-none data-active:after:bg-primary after:bottom-0 after:h-0.5',
        className
      )}
    >
      {children}
      {count !== undefined && (
        <span className="tabular-nums text-muted-foreground">{count}</span>
      )}
    </TabsTrigger>
  )
}

export { Tabs, TabsContent, ConsoleTabsList as TabsList, ConsoleTabsTrigger as TabsTrigger }
