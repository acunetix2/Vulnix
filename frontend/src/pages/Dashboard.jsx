import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock,
  FolderKanban,
  GitBranch,
  Lock,
  Plus,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Target,
  Zap,
} from 'lucide-react'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell,
  PieChart,
  Pie,
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts'
import { api } from '../services/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { Button } from '../components/ui/button'
import { cn } from '../lib/utils'
import { Panel } from '../components/app/Panel'
import {
  ScanStatusBadge,
  SeverityBadge,
} from '../components/app/SeverityBadge'
import { SEVERITY_ORDER } from '../lib/severity'
import { EmptyState, ErrorState, PanelsSkeleton } from '../components/EmptyState'
import { formatRelativeTime } from '../lib/utils'

const PROJECT_SCAN_LIMIT = 8
const SCAN_DETAIL_LIMIT = 3
const EMPTY_COUNTS = { critical: 0, high: 0, medium: 0, low: 0, info: 0 }

function addCounts(target, source = {}) {
  for (const key of Object.keys(EMPTY_COUNTS)) {
    target[key] += Number(source[key]) || 0
  }
}

const SEV_HEX = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#ca8a04',
  info: '#0284c7',
}

/* ── Custom Recharts tooltip ────────────────────────────────────────────── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-border bg-popover px-3 py-2 shadow-xl text-xs z-50">
      {label && <p className="mb-1.5 font-semibold text-foreground">{label}</p>}
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span
            className="size-2 rounded-full shrink-0"
            style={{ background: entry.color || entry.fill }}
          />
          <span className="text-muted-foreground capitalize">{entry.name}:</span>
          <span className="font-semibold text-foreground tabular-nums">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

/* ── Main export ────────────────────────────────────────────────────────── */
/** Stable timestamp: computed once at module load, not during render. */
const MODULE_NOW = new Date().getTime()

export function Dashboard() {
  const { workspaceId, loading: wsLoading, error: wsError, retry: retryWorkspace } = useWorkspace()
  const [state, setState] = useState({ loading: false, error: null, projects: [], scans: [], findings: [] })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!workspaceId) return
    let cancelled = false
    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }))
      try {
        const projectsPage = await api.getProjects(workspaceId, { limit: 100 })
        const projects = projectsPage.items || []
        const scanLists = await Promise.all(
          projects
            .slice(0, PROJECT_SCAN_LIMIT)
            .map((project) =>
              api
                .getScans(project.id, { limit: 10 })
                .then((page) => ({ project, items: page.items || [] }))
                .catch(() => ({ project, items: [] }))
            )
        )
        const scans = scanLists
          .flatMap(({ project, items }) =>
            items.map((scan) => ({ ...scan, project_name: project.name }))
          )
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        const detailSource = scans.filter(
          (s) => s.status === 'completed' || s.status === 'completed_with_errors'
        )
        const findingPages = await Promise.all(
          detailSource
            .slice(0, SCAN_DETAIL_LIMIT)
            .map((scan) =>
              api
                .getFindings(scan.id, { limit: 100 })
                .then((page) =>
                  (page.items || []).map((f) => ({ ...f, project_name: scan.project_name }))
                )
                .catch(() => [])
            )
        )
        const findings = findingPages
          .flat()
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        if (cancelled) return
        setState({ loading: false, error: null, projects, scans, findings })
      } catch (err) {
        if (!cancelled)
          setState({ loading: false, error: err.message, projects: [], scans: [], findings: [] })
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [workspaceId, attempt])

  const postureScans = useMemo(() => {
    const latestCompleted = new Map()
    for (const scan of state.scans) {
      if (
        (scan.status === 'completed' || scan.status === 'completed_with_errors') &&
        scan.project_id &&
        !latestCompleted.has(scan.project_id)
      ) {
        latestCompleted.set(scan.project_id, scan)
      }
    }
    return [...latestCompleted.values()]
  }, [state.scans])

  const counts = useMemo(() => {
    const total = { ...EMPTY_COUNTS }
    for (const scan of postureScans) addCounts(total, scan.summary?.by_severity)
    return total
  }, [postureScans])

  const detected = SEVERITY_ORDER.reduce((sum, s) => sum + counts[s], 0)
  const priority = counts.critical + counts.high
  const lastScan = state.scans[0]
  const scannedProjects = postureScans.length
  const hasCompletedScans = postureScans.length > 0
  const hasFailedScans = state.scans.some((s) => s.status === 'failed')

  /* Derived chart data */
  const severityPieData = SEVERITY_ORDER.filter((s) => counts[s] > 0).map((s) => ({
    name: s,
    value: counts[s],
    fill: SEV_HEX[s],
  }))

  const projectPosture = state.projects.slice(0, PROJECT_SCAN_LIMIT).map((project) => {
    const scan = postureScans.find((item) => item.project_id === project.id)
    const sev = scan?.summary?.by_severity || {}
    return {
      project,
      scan,
      critical: Number(sev.critical) || 0,
      high: Number(sev.high) || 0,
      medium: Number(sev.medium) || 0,
      low: Number(sev.low) || 0,
    }
  })

  const perProjectBarData = projectPosture.map(({ project, critical, high, medium, low }) => ({
    name: project.name.length > 14 ? project.name.slice(0, 14) + '…' : project.name,
    critical,
    high,
    medium,
    low,
  }))

  const secScore =
    detected === 0
      ? 100
      : Math.max(
          0,
          Math.round(
            100 -
              (counts.critical * 25 +
                counts.high * 10 +
                counts.medium * 3 +
                counts.low * 1) /
                Math.max(state.projects.length, 1)
          )
        )
  const scoreColor =
    secScore >= 80 ? '#10b981' : secScore >= 60 ? '#f59e0b' : '#ef4444'
  const radialData = [{ name: 'Score', value: secScore, fill: scoreColor }]

  const trendNow = MODULE_NOW
  const trendData = useMemo(() => {
    const days = 7
    const buckets = Array.from({ length: days }, (_, i) => {
      const d = new Date(trendNow)
      d.setDate(d.getDate() - (days - 1 - i))
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        scans: 0,
        findings: 0,
      }
    })
    state.scans.forEach((scan) => {
      const dayAgo = Math.floor(
        (trendNow - new Date(scan.created_at).getTime()) / 86400000
      )
      if (dayAgo < days) buckets[days - 1 - dayAgo].scans += 1
    })
    state.findings.forEach((f) => {
      const dayAgo = Math.floor(
        (trendNow - new Date(f.created_at).getTime()) / 86400000
      )
      if (dayAgo < days) buckets[days - 1 - dayAgo].findings += 1
    })
    return buckets
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.scans, state.findings])

  /* Loading / error states */
  if (wsLoading || state.loading) {
    return (
      <div className="space-y-4">
        <DashboardHeading projectCount={null} />
        <PanelsSkeleton />
      </div>
    )
  }

  if (wsError || state.error) {
    return (
      <div className="space-y-4">
        <DashboardHeading projectCount={null} />
        <Panel>
          <ErrorState
            title={wsError ? "We couldn't load your workspace" : "We couldn't load the overview"}
            description={wsError || state.error}
            onRetry={() => (wsError ? retryWorkspace() : setAttempt((a) => a + 1))}
          />
        </Panel>
      </div>
    )
  }

  if (state.projects.length === 0) {
    return (
      <div className="space-y-6">
        <DashboardHeading
          projectCount={0}
          actions={
            <Button render={<Link to="/app/projects" />}>
              <Plus data-icon="inline-start" />
              New project
            </Button>
          }
        />
        <section className="rounded-xl border border-border bg-card">
          <EmptyState
            icon={FolderKanban}
            title="Start with a project"
            description="Create a project to bring code into Vulnix. You can upload an archive or connect a GitHub repository, then launch your first security audit."
            action={
              <Button render={<Link to="/app/projects" />}>
                Create a project <ArrowRight data-icon="inline-end" />
              </Button>
            }
          />
        </section>
      </div>
    )
  }

  const recentScans = state.scans.slice(0, 6)
  const criticalFindings = state.findings
    .filter((f) => ['critical', 'high'].includes(String(f.severity || '').toLowerCase()))
    .slice(0, 6)
  const recentFindings = state.findings.slice(0, 5)

  const scanStatusCounts = {
    completed: state.scans.filter((s) => s.status === 'completed').length,
    running: state.scans.filter((s) => s.status === 'running').length,
    failed: state.scans.filter((s) => s.status === 'failed').length,
    queued: state.scans.filter((s) => s.status === 'queued').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <DashboardHeading
        projectCount={state.projects.length}
        scannedProjects={scannedProjects}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" render={<Link to="/app/audits/runs" />}>
              <Activity data-icon="inline-start" />
              Audit history
            </Button>
            <Button render={<Link to="/app/projects" />}>
              <Plus data-icon="inline-start" />
              Add project
            </Button>
          </div>
        }
      />

      {/* KPI Strip */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <KpiCard
          icon={GitBranch}
          label="Repositories"
          value={state.projects.length}
          sub={`${scannedProjects} scanned`}
          to="/app/projects"
          tone="neutral"
        />
        <KpiCard
          icon={ScanSearch}
          label="Total audits"
          value={state.scans.length}
          sub={lastScan ? `Last: ${formatRelativeTime(lastScan.created_at)}` : 'No audits yet'}
          to="/app/audits/runs"
          tone="neutral"
        />
        <KpiCard
          icon={ShieldAlert}
          label="Open issues"
          value={detected}
          sub={priority > 0 ? `${priority} critical/high` : detected > 0 ? 'No critical/high' : 'All clear'}
          to="/app/audits/findings"
          tone={priority > 0 ? 'danger' : detected > 0 ? 'warning' : 'success'}
        />
        <KpiCard
          icon={Target}
          label="Security score"
          value={`${secScore}/100`}
          sub={secScore >= 80 ? 'Strong posture' : secScore >= 60 ? 'Needs attention' : 'Critical risk'}
          to="/app/audits/findings"
          tone={secScore >= 80 ? 'success' : secScore >= 60 ? 'warning' : 'danger'}
        />
      </div>

      {/* Row 2: Score gauge + Severity donut + Activity trend */}
      <div className="grid gap-4 xl:grid-cols-[200px_minmax(0,1fr)_minmax(0,1.6fr)]">
        {/* Security Score Gauge */}
        <DashCard
          title="Security Score"
          sub="Composite risk index"
          className="flex flex-col items-center justify-center py-4"
        >
          <div className="relative flex items-center justify-center">
            <ResponsiveContainer width={160} height={160}>
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={75}
                barSize={14}
                data={[{ value: 100, fill: 'var(--muted)' }, ...radialData]}
                startAngle={210}
                endAngle={-30}
              >
                <RadialBar dataKey="value" cornerRadius={8} background={false} />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span
                className="text-3xl font-bold tabular-nums"
                style={{ color: scoreColor }}
              >
                {secScore}
              </span>
              <span className="text-[10px] text-muted-foreground font-medium mt-0.5">/ 100</span>
            </div>
          </div>
          <div className="mt-2 text-center">
            <p className="text-sm font-semibold" style={{ color: scoreColor }}>
              {secScore >= 80 ? 'Strong' : secScore >= 60 ? 'Moderate' : 'At Risk'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {secScore >= 80
                ? 'Posture looks healthy'
                : secScore >= 60
                ? 'Address open issues'
                : 'Immediate action needed'}
            </p>
          </div>
        </DashCard>

        {/* Severity Donut */}
        <DashCard
          title="Issue breakdown"
          sub={`${detected} total findings`}
          action={
            <Link
              to="/app/audits/findings"
              className="text-xs text-primary font-medium hover:text-primary-hover flex items-center gap-1"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          }
        >
          {severityPieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={130} height={130}>
                <PieChart>
                  <Pie
                    data={severityPieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={58}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                  >
                    {severityPieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="space-y-2 flex-1 min-w-0">
                {SEVERITY_ORDER.filter((s) => counts[s] > 0).map((s) => (
                  <li key={s}>
                    <Link
                      to={`/app/audits/findings?severity=${s}`}
                      className="flex items-center gap-2 text-xs group"
                    >
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ background: SEV_HEX[s] }}
                      />
                      <span className="capitalize text-muted-foreground group-hover:text-foreground transition-colors flex-1 truncate">
                        {s}
                      </span>
                      <span className="font-semibold tabular-nums text-foreground">{counts[s]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <ShieldCheck className="size-8 text-primary/60" />
              <p className="mt-2 text-sm font-medium text-foreground">
                {hasCompletedScans ? 'No issues found' : 'No audit data yet'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasCompletedScans
                  ? 'All scans came back clean.'
                  : 'Run an audit to see results.'}
              </p>
            </div>
          )}
        </DashCard>

        {/* 7-Day Activity Area Chart */}
        <DashCard
          title="7-Day activity"
          sub="Scans run and findings detected"
          action={
            <Link
              to="/app/audits/runs"
              className="text-xs text-primary font-medium hover:text-primary-hover flex items-center gap-1"
            >
              View runs <ArrowRight className="size-3" />
            </Link>
          }
        >
          <ResponsiveContainer width="100%" height={128}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="gradScans" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradFindings" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f87171" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#f87171" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<ChartTooltip />} />
              <Area
                type="monotone"
                dataKey="scans"
                name="Scans"
                stroke="#34d399"
                strokeWidth={2}
                fill="url(#gradScans)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
              <Area
                type="monotone"
                dataKey="findings"
                name="Findings"
                stroke="#f87171"
                strokeWidth={2}
                fill="url(#gradFindings)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-1">
            <LegendDot color="#34d399" label="Scans" />
            <LegendDot color="#f87171" label="Findings" />
          </div>
        </DashCard>
      </div>

      {/* Row 3: Per-project bar + Scan status */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_280px]">
        {/* Per-project stacked bar */}
        <DashCard
          title="Issues per repository"
          sub="Stacked by severity · latest completed audit"
          action={
            <Link
              to="/app/projects"
              className="text-xs text-primary font-medium hover:text-primary-hover flex items-center gap-1"
            >
              All repos <ArrowRight className="size-3" />
            </Link>
          }
        >
          {perProjectBarData.some((d) => d.critical + d.high + d.medium + d.low > 0) ? (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={perProjectBarData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  allowDecimals={false}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar
                  dataKey="critical"
                  name="Critical"
                  stackId="a"
                  fill={SEV_HEX.critical}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="high"
                  name="High"
                  stackId="a"
                  fill={SEV_HEX.high}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="medium"
                  name="Medium"
                  stackId="a"
                  fill={SEV_HEX.medium}
                  maxBarSize={36}
                />
                <Bar
                  dataKey="low"
                  name="Low"
                  stackId="a"
                  fill={SEV_HEX.low}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={36}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <BarChart3 className="size-7 text-muted-foreground/50" />
              <p className="mt-2 text-sm font-medium text-foreground">No issue data yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Completed audits will populate this chart.
              </p>
            </div>
          )}
          <div className="flex items-center flex-wrap gap-4 mt-2">
            {['critical', 'high', 'medium', 'low'].map((s) => (
              <LegendDot key={s} color={SEV_HEX[s]} label={s} />
            ))}
          </div>
        </DashCard>

        {/* Audit status summary */}
        <DashCard title="Audit status" sub="Across all repositories">
          <div className="space-y-3">
            <ScanStatusRow
              icon={CheckCircle2}
              label="Completed"
              count={scanStatusCounts.completed}
              color="text-emerald-500"
              bg="bg-emerald-500/10"
            />
            <ScanStatusRow
              icon={Activity}
              label="Running"
              count={scanStatusCounts.running}
              color="text-sky-500"
              bg="bg-sky-500/10"
            />
            <ScanStatusRow
              icon={AlertCircle}
              label="Failed"
              count={scanStatusCounts.failed}
              color="text-red-500"
              bg="bg-red-500/10"
            />
            <ScanStatusRow
              icon={Clock}
              label="Queued"
              count={scanStatusCounts.queued}
              color="text-amber-500"
              bg="bg-amber-500/10"
            />
          </div>
          <div className="mt-4 space-y-1">
            <p className="text-[10px] text-muted-foreground font-medium">Distribution</p>
            <div className="flex h-2 overflow-hidden rounded-full gap-px">
              {[
                { key: 'completed', color: '#10b981' },
                { key: 'running', color: '#0ea5e9' },
                { key: 'failed', color: '#ef4444' },
                { key: 'queued', color: '#f59e0b' },
              ].map(({ key, color }) => {
                const pct =
                  state.scans.length > 0
                    ? (scanStatusCounts[key] / state.scans.length) * 100
                    : 0
                return pct > 0 ? (
                  <div
                    key={key}
                    className="h-full"
                    style={{ width: `${pct}%`, background: color }}
                  />
                ) : null
              })}
              {state.scans.length === 0 && (
                <div className="h-full w-full bg-muted rounded-full" />
              )}
            </div>
          </div>
        </DashCard>
      </div>

      {/* Row 4: Priority findings + Recent audits */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        {/* Critical & High findings */}
        <DashCard
          title="Priority findings"
          sub="Critical and high severity from recent audits"
          action={
            <Link
              to="/app/audits/findings"
              className="text-xs text-primary font-medium hover:text-primary-hover flex items-center gap-1"
            >
              Review all <ArrowRight className="size-3" />
            </Link>
          }
          noPad
        >
          {criticalFindings.length ? (
            <ul className="divide-y divide-border">
              {criticalFindings.map((finding) => (
                <li key={finding.id}>
                  <Link
                    to={`/app/audits/findings/${finding.id}`}
                    className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/50"
                  >
                    <SeverityBadge
                      severity={finding.severity}
                      withDot={false}
                      className="mt-0.5 shrink-0 w-[68px] justify-center"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {finding.title || 'Security issue'}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {finding.project_name || 'Unknown'}
                        {finding.file_path ? ` · ${finding.file_path}` : ''}
                      </span>
                    </span>
                    <ArrowUpRight
                      className="mt-0.5 size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center">
              <ShieldCheck className="size-7 text-primary/60" aria-hidden />
              <p className="mt-2 text-sm font-medium text-foreground">
                {hasCompletedScans ? 'No critical or high findings' : 'No findings yet'}
              </p>
              <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
                {hasCompletedScans
                  ? 'The audited repositories look clean.'
                  : 'Findings will appear after an audit completes.'}
              </p>
            </div>
          )}
        </DashCard>

        {/* Recent audits */}
        <DashCard
          title="Recent audits"
          sub="Latest runs across your repos"
          action={
            <Link
              to="/app/audits/runs"
              className="text-xs text-primary font-medium hover:text-primary-hover flex items-center gap-1"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          }
          noPad
        >
          {recentScans.length ? (
            <ul className="divide-y divide-border">
              {recentScans.map((scan) => (
                <li key={scan.id}>
                  <Link
                    to={`/app/audits/runs/${scan.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {scan.project_name}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">
                        {formatRelativeTime(scan.created_at)}
                      </span>
                    </span>
                    <ScanStatusBadge status={scan.status} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              compact
              icon={ScanSearch}
              title="No audits yet"
              description="Run an audit to see activity here."
            />
          )}
        </DashCard>
      </div>

      {/* Row 5: Repository severity matrix */}
      <DashCard
        title="Repository severity matrix"
        sub="Latest completed audit per repository"
        action={
          <Link
            to="/app/projects"
            className="text-xs text-primary font-medium hover:text-primary-hover flex items-center gap-1"
          >
            All repositories <ArrowRight className="size-3" />
          </Link>
        }
        noPad
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="bg-muted/40">
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Repository
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-right">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-red-600" />
                    Critical
                  </span>
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-right">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-orange-500" />
                    High
                  </span>
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-right">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-amber-500" />
                    Medium
                  </span>
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-right">
                  <span className="inline-flex items-center gap-1">
                    <span className="size-2 rounded-full bg-yellow-500" />
                    Low
                  </span>
                </th>
                <th className="px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center">
                  Status
                </th>
                <th className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-right">
                  Last audit
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {projectPosture.map(({ project, scan, critical, high, medium, low }) => {
                const riskLevel =
                  critical > 0
                    ? 'critical'
                    : high > 0
                    ? 'high'
                    : medium > 0
                    ? 'medium'
                    : low > 0
                    ? 'low'
                    : 'none'
                return (
                  <tr key={project.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <Link to="/app/projects" className="flex items-center gap-2 group">
                        <span
                          className={cn(
                            'size-2 shrink-0 rounded-full',
                            riskLevel === 'critical'
                              ? 'bg-red-500'
                              : riskLevel === 'high'
                              ? 'bg-orange-500'
                              : riskLevel === 'medium'
                              ? 'bg-amber-500'
                              : riskLevel === 'low'
                              ? 'bg-yellow-500'
                              : 'bg-emerald-500'
                          )}
                        />
                        <span className="font-medium text-foreground group-hover:text-primary transition-colors truncate max-w-[200px]">
                          {project.name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {scan ? (
                        <span
                          className={cn(
                            'font-semibold',
                            critical > 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-muted-foreground'
                          )}
                        >
                          {critical}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {scan ? (
                        <span
                          className={cn(
                            'font-semibold',
                            high > 0
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-muted-foreground'
                          )}
                        >
                          {high}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {scan ? (
                        <span
                          className={cn(
                            'font-medium',
                            medium > 0
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-muted-foreground'
                          )}
                        >
                          {medium}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {scan ? (
                        <span className={low > 0 ? 'text-foreground' : 'text-muted-foreground'}>
                          {low}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      {scan ? (
                        <ScanStatusBadge status={scan.status} />
                      ) : (
                        <span className="text-xs text-muted-foreground">Not audited</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                      {scan
                        ? formatRelativeTime(scan.completed_at || scan.created_at)
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {state.projects.length > PROJECT_SCAN_LIMIT && (
          <div className="border-t border-border px-4 py-2.5 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing {PROJECT_SCAN_LIMIT} of {state.projects.length} repositories
            </p>
            <Link
              to="/app/projects"
              className="text-xs text-primary font-medium hover:text-primary-hover"
            >
              View all →
            </Link>
          </div>
        )}
      </DashCard>

      {/* Row 6: Recent findings + Quick actions */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
        {/* Recent findings feed */}
        <DashCard
          title="Recent findings"
          sub="From the most recently completed audits"
          action={
            <Link
              to="/app/audits/findings"
              className="text-xs text-primary font-medium hover:text-primary-hover flex items-center gap-1"
            >
              View all <ArrowRight className="size-3" />
            </Link>
          }
          noPad
        >
          {recentFindings.length ? (
            <ul className="divide-y divide-border">
              {recentFindings.map((finding) => (
                <li key={finding.id}>
                  <Link
                    to={`/app/audits/findings/${finding.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors group"
                  >
                    <SeverityBadge
                      severity={finding.severity}
                      withDot={false}
                      className="w-[72px] shrink-0 justify-center"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                        {finding.title || 'Security issue'}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                        {finding.project_name || 'Unknown'}
                        {finding.file_path ? ` · ${finding.file_path}` : ''}
                      </span>
                    </span>
                    <ArrowRight
                      className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              compact
              icon={!hasCompletedScans && hasFailedScans ? ShieldAlert : ShieldCheck}
              title={
                !hasCompletedScans && hasFailedScans
                  ? 'No findings from failed audits'
                  : 'No findings to show'
              }
              description={
                !hasCompletedScans && hasFailedScans
                  ? 'Review the failed audit logs.'
                  : 'Findings appear here after an audit completes.'
              }
              action={
                <Button
                  size="sm"
                  variant="outline"
                  render={
                    <Link
                      to={hasFailedScans ? '/app/audits/runs' : '/app/projects'}
                    />
                  }
                >
                  {hasFailedScans ? 'View audit history' : 'Audit a project'}
                </Button>
              }
            />
          )}
        </DashCard>

        {/* Quick actions */}
        <DashCard title="Quick actions" sub="Jump to common tasks">
          <div className="space-y-2">
            <QuickAction
              icon={ScanSearch}
              label="New scan"
              desc="Run a security audit"
              to="/app/audits/runs"
            />
            <QuickAction
              icon={FolderKanban}
              label="Projects"
              desc="Manage repositories"
              to="/app/projects"
            />
            <QuickAction
              icon={ShieldAlert}
              label="All findings"
              desc="Browse & triage issues"
              to="/app/audits/findings"
            />
            <QuickAction
              icon={BarChart3}
              label="Reports"
              desc="Export & compliance"
              to="/app/reports"
            />
            <QuickAction
              icon={Lock}
              label="Secrets scanner"
              desc="Exposed credentials"
              to="/app/secrets"
            />
            <QuickAction
              icon={Zap}
              label="Integrations"
              desc="Connect your tools"
              to="/app/integrations"
            />
          </div>
        </DashCard>
      </div>
    </div>
  )
}

/* ─── Sub-components ────────────────────────────────────────────────────── */

function DashboardHeading({ projectCount, scannedProjects, actions }) {
  return (
    <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
          Workspace overview
        </p>
        <h1 className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
          Security dashboard
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {projectCount === null
            ? 'Loading workspace…'
            : projectCount === 0
            ? 'Your projects, audits, and findings in one place.'
            : `Security posture across ${projectCount} ${
                projectCount === 1 ? 'project' : 'projects'
              } · ${scannedProjects ?? 0} scanned.`}
        </p>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </header>
  )
}

function KpiCard({ icon: Icon, label, value, sub, to, tone = 'neutral' }) {
  const toneStyles = {
    neutral: 'text-muted-foreground bg-muted',
    success: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10',
    warning: 'text-amber-600 dark:text-amber-400 bg-amber-500/10',
    danger: 'text-red-600 dark:text-red-400 bg-red-500/10',
  }
  const iconCls = toneStyles[tone] || toneStyles.neutral
  const inner = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
        <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground tabular-nums truncate">
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground truncate">{sub}</p>
      </div>
      <span className={cn('p-2.5 rounded-xl shrink-0', iconCls)}>
        <Icon className="size-5" aria-hidden />
      </span>
    </div>
  )
  const shell = cn(
    'rounded-xl border border-border bg-card p-4 transition-all duration-150',
    to &&
      'hover:border-border-strong hover:shadow-sm hover:-translate-y-0.5 focus-visible:outline-ring focus-visible:outline-2'
  )
  return to ? (
    <Link to={to} className={shell}>
      {inner}
    </Link>
  ) : (
    <div className={shell}>{inner}</div>
  )
}

function DashCard({ title, sub, action, children, className, noPad = false }) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-card flex flex-col',
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3.5 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        {action}
      </div>
      <div className={cn('flex-1', !noPad && 'p-4')}>{children}</div>
    </section>
  )
}

function LegendDot({ color, label }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="size-2 rounded-full shrink-0" style={{ background: color }} />
      <span className="capitalize">{label}</span>
    </span>
  )
}

function ScanStatusRow({ icon: Icon, label, count, color, bg }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2.5">
        <span className={cn('p-1.5 rounded-lg', bg)}>
          <Icon className={cn('size-3.5', color)} aria-hidden />
        </span>
        <span className="text-sm text-foreground">{label}</span>
      </div>
      <span className={cn('text-sm font-semibold tabular-nums', color)}>{count}</span>
    </div>
  )
}

function QuickAction({ icon: Icon, label, desc, to }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5 transition-all hover:border-border-strong hover:bg-muted/60 hover:shadow-sm group"
    >
      <Icon
        className="size-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0"
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-foreground group-hover:text-primary transition-colors text-xs">
          {label}
        </span>
        <span className="block text-[11px] text-muted-foreground truncate">{desc}</span>
      </span>
      <ArrowRight
        className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity"
        aria-hidden
      />
    </Link>
  )
}
