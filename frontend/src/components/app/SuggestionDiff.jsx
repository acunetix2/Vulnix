import { cn } from '../../lib/utils'
import { FilePath } from './CodeBlock'

/**
 * A unified diff, painted. The patch text is built by the server from the
 * archived file - never written by a model - so a `-` line is a line that
 * really exists there and a `+` line is what the agent would put in its place.
 * Nothing here is applied: it is a proposal until a human accepts it.
 */
const LINE_STYLES = {
  remove: 'bg-red-50 text-red-900',
  add: 'bg-emerald-50 text-emerald-900',
  hunk: 'bg-muted/60 text-muted-foreground',
  context: 'text-muted-foreground',
}

const MARKERS = { remove: '-', add: '+', hunk: '', context: ' ' }

function classify(line) {
  if (line.startsWith('@@')) return 'hunk'
  if (line.startsWith('-')) return 'remove'
  if (line.startsWith('+')) return 'add'
  return 'context'
}

function parse(patch) {
  const rows = []
  let removed = 0
  let added = 0
  for (const line of String(patch || '').split('\n')) {
    if (line.startsWith('--- ') || line.startsWith('+++ ') || line.startsWith('diff ')) continue
    if (!line && rows.length === 0) continue
    const kind = classify(line)
    if (kind === 'remove') removed += 1
    if (kind === 'add') added += 1
    rows.push({ kind, text: line.slice(kind === 'context' ? 0 : 1) || ' ' })
  }
  return { rows, removed, added }
}

export function SuggestionDiff({ suggestion, className }) {
  if (!suggestion?.patch) return null

  const { rows, removed, added } = parse(suggestion.patch)
  const counts = suggestion.lines_removed ?? removed
  const additions = suggestion.lines_added ?? added

  return (
    <div className={cn('space-y-2', className)}>
      <FilePath path={suggestion.path} line={suggestion.start_line} endLine={suggestion.end_line} />

      {suggestion.why && (
        <p className="text-sm leading-relaxed text-foreground">{suggestion.why}</p>
      )}

      <div className="overflow-x-auto rounded-lg border border-border bg-background">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/40 px-3 py-1.5">
          <span className="text-xs font-medium text-muted-foreground">Proposed edit</span>
          <span className="flex items-center gap-2 font-mono text-[11px]">
            <span className="text-red-700">−{counts}</span>
            <span className="text-emerald-700">+{additions}</span>
          </span>
        </div>
        <pre className="px-0 py-1 font-mono text-xs leading-relaxed">
          {rows.map((row, i) => (
            <div
              key={`${row.kind}-${i}`}
              className={cn('flex min-w-max', LINE_STYLES[row.kind])}
            >
              <span
                aria-hidden
                className="w-6 shrink-0 select-none border-r border-border/60 px-1.5 text-center opacity-70"
              >
                {MARKERS[row.kind]}
              </span>
              <code className="whitespace-pre px-2">{row.text}</code>
            </div>
          ))}
        </pre>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        The lines above were checked against the archived copy of{' '}
        <span className="font-medium text-foreground">{suggestion.path}</span> before this
        proposal was stored. Accepting it is a separate step; nothing is changed in your
        repository on its own.
      </p>
    </div>
  )
}
