import {
  Activity,
  Bot,
  Check,
  CircleAlert,
  Code2,
  GitBranch,
  KeyRound,
  Layers,
  LockKeyhole,
  Package,
  ScanLine,
  ShieldCheck,
  Users,
} from 'lucide-react'

const VISUALS = {
  scan: {
    icon: ScanLine,
    title: 'Security scan',
    subtitle: 'Analysis in progress',
    metrics: [['Files analyzed', '1,284'], ['Issues found', '08']],
    rows: ['SQL injection risk', 'Exposed API key', 'Outdated dependency'],
  },
  code: {
    icon: Code2,
    title: 'Code review',
    subtitle: 'AI-assisted remediation',
    metrics: [['Risk level', 'High'], ['Confidence', '94%']],
    rows: ['Unsafe query construction', 'Input validation missing', 'Suggested fix ready'],
  },
  pipeline: {
    icon: GitBranch,
    title: 'CI pipeline',
    subtitle: 'Pull request #248',
    metrics: [['Checks passed', '12'], ['Needs attention', '02']],
    rows: ['Source analysis complete', 'Dependency check complete', 'Report attached'],
  },
  compliance: {
    icon: ShieldCheck,
    title: 'Compliance',
    subtitle: 'Security controls',
    metrics: [['Controls met', '38 / 42'], ['Coverage', '90%']],
    rows: ['Access control', 'Audit logging', 'Vulnerability management'],
  },
  reports: {
    icon: Activity,
    title: 'Scan report',
    subtitle: 'Latest project activity',
    metrics: [['Open findings', '08'], ['Resolved', '24']],
    rows: ['Critical findings reduced', 'Remediation rate improved', 'Report ready to export'],
  },
  deps: {
    icon: Package,
    title: 'Dependencies',
    subtitle: 'Package health',
    metrics: [['Packages checked', '326'], ['Updates needed', '07']],
    rows: ['Direct dependencies', 'Transitive dependencies', 'License review'],
  },
  secrets: {
    icon: KeyRound,
    title: 'Secret detection',
    subtitle: 'Repository review',
    metrics: [['Files checked', '1,284'], ['Exposures', '01']],
    rows: ['Credential pattern detected', 'Location and evidence attached', 'Remediation guidance ready'],
  },
  integrations: {
    icon: Layers,
    title: 'Connected tools',
    subtitle: 'Workspace integrations',
    metrics: [['Connected', '04'], ['Events delivered', '128']],
    rows: ['GitHub pull requests', 'Slack notifications', 'Jira issue tracking'],
  },
  team: {
    icon: Users,
    title: 'Team workspace',
    subtitle: 'Shared security workflow',
    metrics: [['Team members', '08'], ['Assigned findings', '16']],
    rows: ['Ownership is clear', 'Changes are tracked', 'Progress stays visible'],
  },
}

export function ProductVisual({ name = 'scan', className = '' }) {
  const visual = VISUALS[name] || VISUALS.scan
  const Icon = visual.icon

  return (
    <div className={`mx-auto w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-700/70 bg-[#0b1120] shadow-2xl shadow-black/30 ${className}`}>
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-emerald-500/10 text-emerald-400">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          <span>
            <span className="block text-xs font-semibold text-slate-100">{visual.title}</span>
            <span className="block text-[10px] text-slate-500">{visual.subtitle}</span>
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-medium text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          Protected
        </span>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-[1.15fr_0.85fr] sm:p-5">
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-3">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-md bg-violet-500/10 text-violet-300">
                <Bot className="size-4" aria-hidden="true" />
              </span>
              <span className="text-xs font-medium text-slate-200">Vulnix analysis</span>
            </div>
            <span className="text-[10px] text-slate-500">Just now</span>
          </div>

          {visual.rows.map((row, index) => (
            <div key={row} className="flex items-center gap-2.5 rounded-lg px-1 py-1">
              <span className={`grid size-6 shrink-0 place-items-center rounded-md ${index === 0 ? 'bg-amber-500/10 text-amber-400' : 'bg-slate-800 text-slate-400'}`}>
                {index === 0
                  ? <CircleAlert className="size-3.5" aria-hidden="true" />
                  : <Check className="size-3.5" aria-hidden="true" />}
              </span>
              <span className="min-w-0 flex-1 truncate text-[11px] text-slate-300">{row}</span>
              <span className="text-[10px] text-slate-500">{index === 0 ? 'Review' : 'Ready'}</span>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-1">
          {visual.metrics.map(([label, value], index) => (
            <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                {index === 0 ? <LockKeyhole className="size-3" aria-hidden="true" /> : <Layers className="size-3" aria-hidden="true" />}
                {label}
              </div>
              <div className="mt-2 text-xl font-semibold tracking-tight text-white">{value}</div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${index === 0 ? 'w-3/4 bg-emerald-400' : 'w-1/2 bg-violet-400'}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function GradientArt({ variant = 0 }) {
  const palettes = [
    'from-violet-500/20 via-fuchsia-500/10 to-transparent',
    'from-emerald-500/20 via-cyan-500/10 to-transparent',
    'from-blue-500/20 via-violet-500/10 to-transparent',
  ]
  const palette = palettes[Math.abs(variant) % palettes.length]

  return (
    <div className={`relative mx-auto flex aspect-[16/10] w-full max-w-3xl items-center justify-center overflow-hidden rounded-2xl border border-slate-700/70 bg-gradient-to-br ${palette} bg-[#0b1120]`}>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(148,163,184,0.08),transparent_65%)]" />
      <div className="relative grid size-24 place-items-center rounded-3xl border border-white/10 bg-slate-950/60 text-emerald-300 shadow-2xl shadow-emerald-950/40">
        <ShieldCheck className="size-11" strokeWidth={1.4} aria-hidden="true" />
      </div>
      <div className="absolute left-[18%] top-[24%] size-12 rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-sm" />
      <div className="absolute bottom-[22%] right-[18%] size-16 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-sm" />
    </div>
  )
}
