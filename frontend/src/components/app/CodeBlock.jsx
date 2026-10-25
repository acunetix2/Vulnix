import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { cn } from '../../lib/utils'

/**
 * File path chip. Renders untrusted paths as text only, and can carry a line
 * reference so `app/routes.py:41` is one copyable unit rather than prose.
 */
export function FilePath({ path, line, endLine, className, as = 'span' }) {
  const Tag = as
  const range = line == null ? null : endLine && endLine !== line ? `${line}-${endLine}` : `${line}`
  return (
    <Tag
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground',
        className
      )}
      title={path}
    >
      <span className="truncate">{path}</span>
      {range && <span className="shrink-0 text-muted-foreground">:{range}</span>}
    </Tag>
  )
}

async function copyText(text, okMessage) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(okMessage)
    return true
  } catch {
    toast.error('Clipboard unavailable in this browser context')
    return false
  }
}

/**
 * Source excerpt viewer for scanner evidence.
 *
 * Content is passed as a string and laid out per-line, so nothing from an
 * uploaded archive is ever interpreted as markup. Long lines scroll inside the
 * block instead of pushing the whole panel sideways.
 */
export function CodeBlock({
  code = '',
  startLine = 1,
  highlight = [],
  language,
  filename,
  maxHeight = '24rem',
  className,
}) {
  const [copied, setCopied] = useState(false)
  const lines = String(code).replace(/\n$/, '').split('\n')
  const highlightSet = new Set(highlight)
  const digits = String(startLine + lines.length - 1).length

  const handleCopy = async () => {
    if (await copyText(code, 'Evidence copied')) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <figure
      className={cn(
        'overflow-hidden rounded-lg border border-slate-800 bg-slate-950',
        className
      )}
    >
      {(filename || language) && (
        <figcaption className="flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-3 py-1.5">
          <span className="min-w-0 truncate font-mono text-xs text-slate-400">
            {filename}
            {language && <span className="ml-2 text-slate-600">{language}</span>}
          </span>
          {/* Standard control metrics; only the surface colours track the code chrome. */}
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleCopy}
            className="text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Copy evidence"
          >
            {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </figcaption>
      )}

      <div className="overflow-auto" style={{ maxHeight }}>
        <pre className="min-w-full text-xs leading-relaxed">
          <code className="block font-mono">
            {lines.map((text, i) => {
              const n = startLine + i
              const active = highlightSet.has(n)
              return (
                <span
                  key={n}
                  className={cn(
                    'flex',
                    active ? 'bg-amber-400/10' : i % 2 === 1 && 'bg-white/[0.015]'
                  )}
                >
                  <span
                    aria-hidden
                    className="sticky left-0 shrink-0 select-none border-r border-slate-800 bg-slate-950 px-2 text-right tabular-nums text-slate-600"
                    style={{ minWidth: `${digits + 2}ch` }}
                  >
                    {n}
                  </span>
                  <span
                    className={cn(
                      'px-3 whitespace-pre text-slate-300',
                      active && 'text-slate-100'
                    )}
                  >
                    {text === '' ? ' ' : text}
                  </span>
                </span>
              )
            })}
          </code>
        </pre>
      </div>
    </figure>
  )
}

/** Single-line inline code, e.g. a rule id or a scanner name. */
export function InlineCode({ children, className }) {
  return (
    <code
      className={cn(
        'rounded border border-border bg-muted px-1 py-0.5 font-mono text-xs text-foreground',
        className
      )}
    >
      {children}
    </code>
  )
}

/** Copy button for values that must be readable in full (webhook URLs, keys). */
export function CopyButton({ value, label = 'Copy', className }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className={className}
      onClick={async () => {
        if (await copyText(value, `${label} copied`)) {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }
      }}
    >
      {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
      {copied ? 'Copied' : label}
    </Button>
  )
}
