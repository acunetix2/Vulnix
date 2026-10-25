import React from 'react'
import {
  ShieldAlert,
  Flame,
  Globe,
  ExternalLink,
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'
import { Pill } from './SeverityBadge'
import { InlineCode } from './CodeBlock'
import { cn } from '../../lib/utils'

export function ThreatIntelCard({ intel, dep, className }) {
  if (!intel && !dep) return null

  const hasExploit = intel?.has_known_exploit
  const epss = intel?.epss_max != null ? intel.epss_max : null
  const epssPct = intel?.epss_percentile_max != null ? (1.0 - intel.epss_percentile_max) * 100 : null
  const cvss = intel?.cvss_max != null ? intel.cvss_max : null
  const cves = intel?.cve_ids || []
  const advisories = intel?.advisories || []

  // EPSS risk severity color
  const epssTone =
    epss == null
      ? 'neutral'
      : epss >= 0.3
        ? 'danger'
        : epss >= 0.1
          ? 'warning'
          : 'success'

  return (
    <div
      className={cn(
        'rounded-lg border border-border/80 bg-gradient-to-br from-card to-muted/30 p-3.5 space-y-3 shadow-xs',
        className
      )}
    >
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-md bg-rose-500/10 text-rose-500 dark:bg-rose-500/20">
            <Globe className="size-3.5" />
          </div>
          <div>
            <span className="text-xs font-semibold tracking-wide uppercase text-foreground">
              IntelAgent · Live Threat Intelligence
            </span>
            <span className="ml-2 text-[10px] text-muted-foreground">
              NVD · EPSS · OSV feeds
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {hasExploit && (
            <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
              <Flame className="size-3" />
              Active PoC / Exploit
            </span>
          )}
          {cvss != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              CVSS {cvss.toFixed(1)}
            </span>
          )}
          {epss != null && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                epssTone === 'danger' && 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
                epssTone === 'warning' && 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                epssTone === 'success' && 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
              )}
            >
              <Activity className="size-3" />
              EPSS {(epss * 100).toFixed(1)}%
              {epssPct != null && ` (Top ${Math.max(1, Math.round(epssPct))}%)`}
            </span>
          )}
        </div>
      </div>

      {/* CVE tags */}
      {cves.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Matched CVEs:</span>
          {cves.map((cve) => (
            <a
              key={cve}
              href={`https://nvd.nist.gov/vuln/detail/${cve}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs font-mono font-medium text-foreground hover:bg-muted/80 hover:text-primary transition-colors"
            >
              {cve}
              <ExternalLink className="size-2.5 opacity-60" />
            </a>
          ))}
        </div>
      )}

      {/* Synthesis summary */}
      {intel?.summary && (
        <p className="text-xs leading-relaxed text-muted-foreground">
          {intel.summary}
        </p>
      )}

      {/* Advisories if present */}
      {advisories.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Upstream Advisories ({advisories.length})
          </span>
          <div className="space-y-1">
            {advisories.slice(0, 3).map((adv, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-2 rounded bg-muted/40 px-2.5 py-1.5 text-xs"
              >
                <div className="min-w-0 flex-1 truncate">
                  <span className="font-mono font-medium text-foreground">{adv.id}</span>
                  {adv.summary && (
                    <span className="ml-2 text-muted-foreground truncate">
                      — {adv.summary}
                    </span>
                  )}
                </div>
                {adv.fixed_versions?.length > 0 && (
                  <span className="shrink-0 text-emerald-600 dark:text-emerald-400 font-medium">
                    Fixed: {adv.fixed_versions.join(', ')}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DepAgent info if present */}
      {dep && (
        <div className="mt-2 flex items-center justify-between rounded bg-muted/40 px-2.5 py-1.5 text-xs border border-border/40">
          <div className="flex items-center gap-1.5 text-foreground font-medium">
            <Layers className="size-3.5 text-primary" />
            <span>DepAgent (SCA)</span>
          </div>
          <div className="flex items-center gap-3 text-muted-foreground">
            {dep.upgrade_recommendation && (
              <span>{dep.upgrade_recommendation}</span>
            )}
            {dep.license_status && (
              <span className="text-xs text-muted-foreground">
                License: {dep.license_status}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
