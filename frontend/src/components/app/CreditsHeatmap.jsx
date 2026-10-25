import { useEffect, useMemo, useState } from 'react'
import { api } from '../../services/api'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'
import { EmptyState, ErrorState, LoadingState } from '../EmptyState'
import { cn } from '../../lib/utils'

/**
 * Credits consumed per day, straight from `/ai/usage`. One column is a week,
 * one cell is a day, and a cell only gets colour when the server reported
 * credits for it — an account that has never asked the reviewer anything shows
 * an empty grid, which is the truth rather than a picture of activity.
 * Below it, the same response's per-reviewer rollup, named only by the alias
 * the server chose for it: no currency figures, because nothing in the data
 * models a price.
 */
const WEEKS = 52

const CELL_FILL = [
  'bg-muted',
  'bg-primary/25',
  'bg-primary/45',
  'bg-primary/70',
  'bg-primary',
]

const WEEKDAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun']

function toIsoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** 52 Monday-anchored weeks, the last one containing `untilDay`. */
function buildWeeks(untilDay) {
  const anchor = new Date(`${untilDay}T00:00:00`)
  if (Number.isNaN(anchor.getTime())) return []
  const mondayOffset = (anchor.getDay() + 6) % 7
  const first = new Date(anchor)
  first.setDate(anchor.getDate() - mondayOffset - (WEEKS - 1) * 7)

  const weeks = []
  for (let w = 0; w < WEEKS; w += 1) {
    const days = []
    for (let d = 0; d < 7; d += 1) {
      const date = new Date(first)
      date.setDate(first.getDate() + w * 7 + d)
      days.push(toIsoDate(date))
    }
    weeks.push(days)
  }
  return weeks
}

function monthLabelsFor(weeks) {
  const out = []
  let previousMonth = -1
  weeks.forEach((days, index) => {
    // A month is named at the first week whose Monday falls in it, so the
    // label never floats over a column from the month before.
    const month = new Date(`${days[0]}T00:00:00`).getMonth()
    if (month !== previousMonth) {
      out.push({ label: new Date(`${days[0]}T00:00:00`).toLocaleString('en-US', { month: 'short' }), index })
      previousMonth = month
    }
  })
  return out.slice(0, 13)
}

function levelOf(credits, max) {
  if (!credits || max <= 0) return 0
  // A day with a couple of calls should not read as "off the charts": below
  // five credits the count itself is the level.
  if (max <= 4) return Math.min(credits, 4)
  const ratio = credits / max
  if (ratio > 0.66) return 4
  if (ratio > 0.33) return 3
  if (ratio > 0.1) return 2
  return 1
}

export function CreditsHeatmap({ workspaceId, usedToday, dailyQuota }) {
  const [usage, setUsage] = useState(null)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false

    async function load() {
      setError(null)
      try {
        const result = await api.getAiUsage(workspaceId, { days: WEEKS * 7 })
        if (!cancelled) setUsage(result)
      } catch (err) {
        if (!cancelled) {
          setUsage(null)
          setError(err.message || 'Unable to load credit usage')
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId, attempt])

  const grid = useMemo(() => {
    if (!usage) return null
    const credits = new Map(usage.days.map((row) => [row.day, row.credits]))
    const max = usage.days.reduce((peak, row) => (row.credits > peak ? row.credits : peak), 0)
    const weeks = buildWeeks(usage.until_day)
    let busiest = null
    for (const row of usage.days) {
      if (!busiest || row.credits > busiest.credits) busiest = row
    }
    const tokens = usage.days.reduce(
      (sum, row) => sum + (row.prompt_tokens || 0) + (row.completion_tokens || 0),
      0
    )
    return {
      weeks,
      months: monthLabelsFor(weeks),
      credits,
      max,
      busiest,
      tokens,
      activeDays: usage.days.filter((row) => row.credits > 0).length,
    }
  }, [usage])

  const models = usage?.models || []

  if (error) {
    return (
      <ErrorState
        title="We couldn’t load your credit usage"
        description={error}
        onRetry={() => setAttempt((count) => count + 1)}
      />
    )
  }

  if (!usage || !grid) {
    return <LoadingState label="Reading the usage log" />
  }

  if (grid.activeDays === 0 && models.length === 0) {
    return (
      <EmptyState
        compact
        title="No credits spent yet"
        description="One credit is one question a Vulnix reviewer answered. Nothing has been asked on this account, so there is nothing to plot."
      />
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Metric label="Credits (52 weeks)" value={usage.total_credits.toLocaleString()} />
        <Metric label="Days with usage" value={String(grid.activeDays)} />
        <Metric label="Busiest day" value={grid.busiest ? `${grid.busiest.credits} · ${grid.busiest.day}` : '—'} />
        <Metric label="Tokens" value={grid.tokens.toLocaleString()} />
        {typeof dailyQuota === 'number' && typeof usedToday === 'number' && (
          <Metric label="Today" value={`${usedToday} of ${dailyQuota}`} />
        )}
      </div>

      <div className="mt-5 overflow-x-auto pb-1">
        <div className="min-w-[620px]">
          <div className="relative ml-8 h-4 text-[11px] text-muted-foreground">
            {grid.months.map((month) => (
              <span key={month.label + month.index} className="absolute" style={{ left: `${(month.index / WEEKS) * 100}%` }}>
                {month.label}
              </span>
            ))}
          </div>

          <div className="flex gap-2">
            <div className="flex w-7 shrink-0 flex-col gap-[3px] pt-[1px] text-[10px] text-muted-foreground">
              {WEEKDAY_LABELS.map((label, i) => (
                <span key={i} className="h-3 leading-3">
                  {label}
                </span>
              ))}
            </div>

            <div className="flex flex-1 gap-[3px]">
              {grid.weeks.map((days, weekIndex) => (
                <div key={weekIndex} className="flex flex-1 flex-col gap-[3px]">
                  {days.map((day) => {
                    const credits = grid.credits.get(day)
                    const future = day > usage.until_day
                    const level = levelOf(credits, grid.max)
                    return (
                      <span
                        key={day}
                        title={future ? day : `${day} · ${credits || 0} credit${credits === 1 ? '' : 's'}`}
                        className={cn(
                          'h-3 flex-1 rounded-[2px] transition-colors duration-100 ease-smooth',
                          future ? 'bg-transparent' : CELL_FILL[level]
                        )}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-end gap-1.5 pl-8 text-[11px] text-muted-foreground">
            <span>Less</span>
            {CELL_FILL.map((fill) => (
              <span key={fill} className={cn('size-2.5 rounded-[2px]', fill)} />
            ))}
            <span>More</span>
          </div>
        </div>
      </div>

      {models.length > 0 && (
        <div className="mt-6 border-t border-border pt-5">
          <p className="mb-3 text-xs text-muted-foreground">
            Grouped by the reviewer that answered. A credit is spent only on a reply; a call that
            failed costs nothing but is counted here so you can still see it.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reviewer</TableHead>
                <TableHead className="text-right">Calls</TableHead>
                <TableHead className="text-right">Credits</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">In</TableHead>
                <TableHead className="text-right">Out</TableHead>
                <TableHead className="text-right">Last used</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((row) => (
                <TableRow key={row.alias}>
                  <TableCell className="font-medium text-foreground">{row.alias}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.calls}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.credits}</TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums',
                      row.failures > 0 ? 'text-destructive' : 'text-muted-foreground'
                    )}
                  >
                    {row.failures}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.prompt_tokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.completion_tokens.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.last_day || '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

function Metric({ label, value }) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  )
}
