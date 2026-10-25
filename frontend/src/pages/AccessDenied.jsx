import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  FolderKanban,
  LayoutDashboard,
  ScanSearch,
  Settings,
  ShieldOff,
} from 'lucide-react'
import { Button } from '../components/ui/button'
import { PageHeader } from '../components/app/PageHeader'
import { Panel } from '../components/app/Panel'
import { Pill } from '../components/app/SeverityBadge'

/**
 * Reached when a screen decides the current account may not view it. No data is
 * fetched here, so the job is to be calm and give three concrete exits: back to
 * where they came from, somewhere they can open, and a clear statement of what
 * is actually missing.
 */
const STEPS = [
  {
    title: 'Check you are in the right workspace',
    body:
      'Access is scoped per workspace. If the link came from another team, switch workspaces and try again.',
    to: '/app/settings/workspace',
    label: 'Review workspace',
  },
  {
    title: 'Ask a workspace administrator for access',
    body:
      'Permissions are granted at workspace level. An administrator can give your account the role this screen needs.',
    to: null,
    label: null,
  },
  {
    title: 'Open a page you do have access to',
    body:
      'The overview, projects, audits and findings are available to every workspace member.',
    to: '/app/dashboard',
    label: 'Go to overview',
  },
]

const DESTINATIONS = [
  { label: 'Overview', to: '/app/dashboard', icon: LayoutDashboard },
  { label: 'Projects', to: '/app/projects', icon: FolderKanban },
  { label: 'Audits', to: '/app/audits/runs', icon: ScanSearch },
  { label: 'Findings', to: '/app/audits/findings', icon: BarChart3 },
  { label: 'Settings', to: '/app/settings', icon: Settings },
]

export function AccessDenied() {
  const navigate = useNavigate()

  return (
    <div className="console-enter mx-auto w-full max-w-[780px] space-y-4">
      <PageHeader
        title="Access denied"
        description="Your account can’t open this part of the workspace."
        meta={
          <>
            <Pill tone="neutral" icon={ShieldOff}>
              403
            </Pill>
            <Pill tone="neutral">No data was changed</Pill>
          </>
        }
        actions={
          <>
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft data-icon="inline-start" />
              Go back
            </Button>
            <Button render={<Link to="/app/dashboard" />}>
              <LayoutDashboard data-icon="inline-start" />
              Overview
            </Button>
          </>
        }
      />

      <Panel
        title="What to do next"
        description="Three ways to get back to work"
      >
        <ol className="divide-y divide-border">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-3 py-3 first:pt-0 last:pb-0">
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{step.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                {step.to && (
                  <Link
                    to={step.to}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary-hover"
                  >
                    {step.label}
                    <ArrowRight className="size-4" />
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ol>
      </Panel>

      <Panel title="Pages you can open" flush>
        <ul className="divide-y divide-border">
          {DESTINATIONS.map((destination) => (
            <li key={destination.to}>
              <Link
                to={destination.to}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <destination.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {destination.label}
                </span>
                <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
