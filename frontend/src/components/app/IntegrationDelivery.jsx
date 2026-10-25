import { RotateCcw } from 'lucide-react'
import { Button } from '../ui/button'
import { DeliveryStatusBadge } from './SeverityBadge'
import { EmptyState } from '../EmptyState'
import { eventLabel, integrationErrorHint } from '../../lib/integrations'
import { formatRelativeTime } from '../../lib/utils'

/**
 * The outbox log. Rows are the deliveries the server actually recorded; a dead
 * letter can be requeued, which is the only action offered here.
 */
export function DeliveryList({
  deliveries = [],
  loading = false,
  onRedeliver,
  busyId = null,
  emptyLabel = 'No deliveries recorded yet.',
}) {
  if (!loading && deliveries.length === 0) {
    return (
      <EmptyState
        title="Nothing sent yet"
        description={emptyLabel}
        className="border-0 py-6"
      />
    )
  }

  return (
    <ul className="divide-y divide-border">
      {deliveries.map((row) => {
        const retryable = row.status === 'dead' || row.status === 'failed'
        return (
          <li key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 py-2.5 first:pt-0 last:pb-0">
            <DeliveryStatusBadge status={row.status} />
            <span className="min-w-0 flex-1 truncate text-sm text-foreground">
              {eventLabel(row.event_type)}
              <span className="text-muted-foreground"> · {row.target_label || row.channel}</span>
            </span>
            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
              {row.attempts > 1 ? `${row.attempts} attempts · ` : ''}
              {formatRelativeTime(row.created_at)}
            </span>
            {row.http_status ? (
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                HTTP {row.http_status}
              </span>
            ) : null}
            {retryable && onRedeliver ? (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => onRedeliver(row)}
                disabled={busyId === row.id}
              >
                <RotateCcw data-icon="inline-start" />
                Redeliver
              </Button>
            ) : null}
            {row.last_error_code ? (
              <p className="w-full text-xs text-muted-foreground">
                <span className="font-mono">{row.last_error_code}</span>
                {integrationErrorHint(row.last_error_code)
                  ? ` — ${integrationErrorHint(row.last_error_code)}`
                  : ''}
              </p>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
