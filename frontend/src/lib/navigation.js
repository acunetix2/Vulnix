import {
  BookOpen,
  CheckSquare,
  FileText,
  FolderKanban,
  KeyRound,
  LayoutDashboard,
  Package,
  ScanSearch,
  Settings,
  ShieldCheck,
  Bot,
  Workflow,
  Zap,
  Webhook,
} from 'lucide-react'
import { GitHub, Jira, Slack } from '../components/icons'

/**
 * One source for the console's destinations, shared by the rail and the search
 * palette so a page cannot appear in one and not the other.
 *
 * Keep the primary navigation organized around the workspace, security
 * coverage, and connected tools. Settings owns its own section navigation.
 */
export const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { name: 'Overview', href: '/app/dashboard', icon: LayoutDashboard },
      { name: 'Projects', href: '/app/projects', icon: FolderKanban },
      { name: 'Audits', href: '/app/audits/runs', icon: ScanSearch },
      { name: 'Bulk Triage', href: '/app/bulk-triage', icon: CheckSquare },
    ],
  },
  {
    label: 'Security',
    items: [
      { name: 'Agents', href: '/app/ai-review', icon: Bot },
      { name: 'Secrets', href: '/app/secrets', icon: KeyRound },
      { name: 'Dependencies', href: '/app/dependencies', icon: Package },
      { name: 'Compliance', href: '/app/compliance', icon: ShieldCheck },
      { name: 'Reports', href: '/app/reports', icon: FileText },
    ],
  },
  {
    label: 'Tools',
    items: [
      { name: 'Review activity', href: '/app/scanners', icon: Workflow },
      {
        name: 'Integrations',
        href: '/app/integrations',
        icon: Zap,
        children: [
          { name: 'Slack', href: '/app/integrations/slack', icon: Slack },
          { name: 'Jira', href: '/app/integrations/jira', icon: Jira },
          { name: 'GitHub', href: '/app/integrations/github', icon: GitHub },
          { name: 'Webhooks', href: '/app/integrations/webhooks', icon: Webhook },
        ],
      },
    ],
  },
]

export const NAV_UTILITY_ITEMS = [
  { name: 'Settings', href: '/app/settings/account', icon: Settings },
  { name: 'Docs', href: '/docs/overview', icon: BookOpen, target: '_blank' },
]

export const NAV_ITEMS = NAV_GROUPS.flatMap((group) =>
  group.items.flatMap((item) => [
    { ...item, group: group.label },
    ...(item.children || []).map((child) => ({ ...child, group: group.label })),
  ])
)

NAV_ITEMS.push(...NAV_UTILITY_ITEMS.map((item) => ({ ...item, group: 'Utilities' })))

export const NAV_BY_HREF = new Map(NAV_ITEMS.map((item) => [item.href, item]))
