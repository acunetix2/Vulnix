import { Check, RefreshCw } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

/**
 * Reviewer switcher.
 *
 * A row appears here only because the server confirmed a moment ago that it
 * answers. Each row carries an alias and a selection token and nothing else -
 * where a reviewer runs, and what runs it, is not this document's business.
 * Native radios carry the keyboard for free; the styled row is the label.
 */
export function AiModelPicker({
  models,
  selected,
  pending,
  saving = false,
  error = null,
  onRetry,
  onSelect,
}) {
  if (error) {
    return (
      <div className="flex items-start justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <p className="text-sm leading-relaxed text-destructive">{error}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw data-icon="inline-start" />
            Retry
          </Button>
        )}
      </div>
    )
  }

  if (!models.length) {
    return (
      <div className="rounded-lg border border-border bg-muted/40 p-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          No Vulnix reviewer is answering right now. Audits still run and report what the code
          shows; only the written-up explanations wait for one.
        </p>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
            <RefreshCw data-icon="inline-start" />
            Check again
          </Button>
        )}
      </div>
    )
  }

  return (
    <fieldset className="group gap-0" disabled={saving}>
      <legend className="sr-only">Vulnix reviewer</legend>
      <div className="grid gap-2">
        {models.map((model) => {
          const isSelected = model.id === selected
          const isPending = model.id === pending
          return (
            <label
              key={model.id}
              className={cn(
                'relative flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors duration-150 ease-smooth',
                isSelected
                  ? 'border-primary/60 bg-primary/5'
                  : 'border-border bg-background hover:bg-muted/60',
                saving && !isSelected && 'opacity-60'
              )}
            >
              <input
                type="radio"
                name="ai-model"
                value={model.id}
                checked={isSelected}
                disabled={saving}
                onChange={() => onSelect(model.id)}
                className="peer sr-only"
              />
              <span
                aria-hidden
                className={cn(
                  'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150 ease-smooth',
                  isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input',
                  'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-background'
                )}
              >
                {isPending ? (
                  <RefreshCw className="size-2.5 animate-spin" />
                ) : isSelected ? (
                  <Check className="size-2.5" strokeWidth={3} />
                ) : null}
              </span>

              <span className="min-w-0 flex-1">
                <span className="text-sm font-semibold text-foreground">{model.alias}</span>
                <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                  {model.note}
                </span>
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
