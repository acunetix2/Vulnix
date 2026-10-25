import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Circle, Minus, X } from 'lucide-react'
import { Spinner } from './Spinner'
import { Progress } from '../ui/progress'
import { cn } from '../../lib/utils'

/**
 * The live step list of a scan. Rows come from `scan.summary.steps`, which the
 * worker rewrites on every checkpoint: the agent's own head line, one row per
 * source file it reads, and one row per optional CLI tool. A row only turns
 * green once the worker has said that step finished — there is no estimated
 * total here, because the file list is only known once the archive is read.
 */
const FINISHED = new Set(['succeeded', 'done', 'failed', 'skipped', 'timed_out', 'error'])

function markFor(status) {
  if (status === 'running') return <Spinner className="size-3.5" label="Running" />
  if (status === 'succeeded' || status === 'done')
    return <Check className="size-3.5 shrink-0 text-primary" aria-hidden />
  if (status === 'partial')
    return <AlertTriangle className="size-3.5 shrink-0 text-amber-600" aria-hidden />
  if (status === 'failed' || status === 'error' || status === 'timed_out')
    return <X className="size-3.5 shrink-0 text-destructive" aria-hidden />
  if (status === 'skipped')
    return <Minus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
  return <Circle className="size-3.5 shrink-0 text-border" aria-hidden />
}

function msToClock(ms) {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`
}

/** Tool runs are the fallback for scans recorded before the worker traced steps. */
function rowsFrom(steps, runs) {
  if (steps.length > 0) return steps
  return runs.map((run) => ({
    label: run.tool_name,
    status: run.status,
    detail: run.error_code,
    duration_ms: run.duration_ms,
    finding_count: run.finding_count,
  }))
}

export function ScanProgressTrace({ steps = [], runs = [], startedAt, active }) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!active || !startedAt) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active, startedAt])

  const rows = rowsFrom(steps, runs)
  const total = rows.length
  const done = rows.filter((row) => FINISHED.has(row.status)).length
  const current = rows.find((row) => row.status === 'running')
  const elapsed = startedAt ? now - new Date(startedAt).getTime() : null
  const pct = total === 0 ? 0 : (done / total) * 100

  return (
    <div>
      <Progress value={pct}>
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          <span className="tabular-nums text-muted-foreground">
            {done} of {total} reported step{total === 1 ? '' : 's'} finished
          </span>
          {current && (
            <span className="flex min-w-0 items-center gap-1.5 text-foreground">
              <Spinner className="size-3.5" label="Current step" />
              <span className="truncate">{current.label}</span>
            </span>
          )}
          {elapsed !== null && (
            <span className="ml-auto tabular-nums text-xs text-muted-foreground">
              {active ? 'running' : 'took'} {msToClock(elapsed)}
            </span>
          )}
        </div>
      </Progress>

      {total === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Queued. The first step appears here as soon as the worker unpacks the archive.
        </p>
      ) : (
        <ol className="mt-3 space-y-1">
          {rows.map((row, index) => (
            <li
              key={`${row.label}-${index}`}
              className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 text-sm transition-colors duration-150 ease-smooth odd:bg-muted/30"
            >
              <span className="grid size-4 shrink-0 place-items-center">{markFor(row.status)}</span>
              <span className="min-w-0 flex-1 truncate text-foreground">{row.label}</span>
              {row.finding_count > 0 && (
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                  {row.finding_count} finding{row.finding_count === 1 ? '' : 's'}
                </span>
              )}
              {row.detail && (
                <span
                  className={cn(
                    'shrink-0 truncate text-xs',
                    row.status === 'failed' || row.status === 'timed_out'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  )}
                >
                  {row.detail}
                </span>
              )}
              {Number.isFinite(row.duration_ms) && row.duration_ms > 0 && (
                <span className="shrink-0 tabular-nums text-xs text-muted-foreground">
                  {msToClock(row.duration_ms)}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
