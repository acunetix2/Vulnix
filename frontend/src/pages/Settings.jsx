import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Building2,
  CircleUser,
  History,
  ShieldAlert,
  Bot,
  Users,
} from 'lucide-react'
import { api } from '../services/api'
import { useWorkspace } from '../hooks/useWorkspace'
import { ErrorState, SettingsPageSkeleton, TableSkeleton } from '../components/EmptyState'
import { AccountPanel } from '../components/app/settings/AccountPanel'
import { WorkspacePanel } from '../components/app/settings/WorkspacePanel'
import { MembersPanel } from '../components/app/settings/MembersPanel'
import { ReviewerPanel } from '../components/app/settings/ReviewerPanel'
import { AuditPanel } from '../components/app/settings/AuditPanel'
import { DangerZonePanel } from '../components/app/settings/DangerZonePanel'
import { IconTile } from '../components/app/IconTile'
import { cn } from '../lib/utils'

/**
 * One settings surface. The three pages it replaces each kept their own tab
 * state, so a bookmark or a back button could not return you to what you were
 * editing - the tab now lives in the URL.
 *
 * Every row here is backed by an endpoint that exists. The appearance and
 * notification toggles this page used to carry wrote localStorage that nothing
 * read, so they are gone rather than parked.
 */
const TABS = [
  {
    id: 'account',
    label: 'Account',
    description: 'Your profile, sign-in, and personal details.',
    icon: CircleUser,
    group: 'Personal',
  },
  {
    id: 'workspace',
    label: 'General',
    description: 'Workspace name and shared details.',
    icon: Building2,
    group: 'Workspace',
  },
  {
    id: 'members',
    label: 'Members & roles',
    description: 'People who can access this workspace.',
    icon: Users,
    group: 'Workspace',
  },
  {
    id: 'reviewer',
    label: 'AI reviewer',
    description: 'AI reviewer settings and usage.',
    icon: Bot,
    group: 'Workspace',
  },
  {
    id: 'audit',
    label: 'Audit log',
    description: 'A chronological record of workspace changes.',
    icon: History,
    group: 'Workspace',
  },
  {
    id: 'data',
    label: 'Data & deletion',
    description: 'Leave or permanently delete this workspace.',
    icon: ShieldAlert,
    group: 'Workspace',
  },
]

const GROUPS = [...new Set(TABS.map((tab) => tab.group))]
const DEFAULT_TAB = 'account'

export function Settings() {
  const { tab } = useParams()
  const { workspaceId, workspaces, loading, error, retry } = useWorkspace()
  const [me, setMe] = useState(null)
  const [profileAttempt, setProfileAttempt] = useState(0)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState(null)

  const active = TABS.some((row) => row.id === tab) ? tab : DEFAULT_TAB

  useEffect(() => {
    let cancelled = false

    api
      .getMe()
      .then((profile) => {
        if (!cancelled) {
          setMe(profile)
          setProfileError(null)
        }
      })
      .catch((loadError) => {
        if (!cancelled) {
          setMe(null)
          setProfileError(loadError.message || 'Please try again.')
        }
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false)
      })

    return () => {
      cancelled = true
    }
    // Re-read when the workspace changes: the roles in `me` decide what the
    // members and danger-zone tabs are allowed to offer.
  }, [profileAttempt, workspaceId])

  const navigate = useNavigate()
  const retryProfile = () => {
    setProfileLoading(true)
    setProfileError(null)
    setProfileAttempt((attempt) => attempt + 1)
  }

  useEffect(() => {
    if (tab === 'integrations') navigate('/app/integrations', { replace: true })
  }, [tab, navigate])

  function selectTab(id) {
    navigate(`/app/settings/${id}`)
  }

  const current = workspaces.find((w) => w.id === workspaceId)
  const role = me?.workspaces?.find((w) => w.id === workspaceId)?.role
  const activeTab = TABS.find((row) => row.id === active) || TABS[0]
  const ActiveIcon = activeTab.icon

  if (loading && !me) {
    return <SettingsPageSkeleton />
  }

  return (
    <div className="console-enter mx-auto max-w-[1200px] pb-12">
      <header className="flex flex-col justify-between gap-4 border-b border-border pb-5 sm:flex-row sm:items-end">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Workspace console
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Account preferences and workspace configuration.
          </p>
        </div>
      </header>

      <div className="mt-8 grid min-w-0 gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
        <nav
          aria-label="Settings sections"
          className="min-w-0 lg:sticky lg:top-20 lg:self-start"
        >
          <div className="flex gap-1 overflow-x-auto border-b border-border pb-2 lg:block lg:space-y-6 lg:overflow-visible lg:border-0 lg:pb-0">
            {GROUPS.map((group) => {
              return (
                <div key={group} className="min-w-0 shrink-0 lg:shrink">
                  <div className="mb-2 hidden items-center px-2 lg:flex">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {group}
                    </p>
                  </div>
                  <div className="flex gap-1 lg:flex-col">
                    {TABS.filter((item) => item.group === group).map((tab) => {
                      const Icon = tab.icon
                      const isActive = active === tab.id
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => selectTab(tab.id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={cn(
                            'flex shrink-0 items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-sm font-medium whitespace-nowrap transition-colors lg:w-full',
                            isActive
                              ? 'bg-primary-subtle font-semibold text-primary'
                              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                          )}
                        >
                          <IconTile
                            icon={Icon}
                            size="sm"
                            className={cn(
                              'border-transparent bg-transparent text-muted-foreground',
                              isActive && 'border-primary/30 bg-primary/10 text-primary'
                            )}
                          />
                          {tab.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </nav>

        <section className="min-w-0 lg:border-l lg:border-border lg:pl-9">
          <div className="mb-5 flex items-start gap-3 border-b border-border pb-5">
            <IconTile icon={ActiveIcon} size="md" className="mt-0.5" />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                {activeTab.label}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{activeTab.description}</p>
            </div>
          </div>
          {active === 'account' && (
            // Remounting on a saved value is what re-seeds the form, so no
            // effect has to copy the profile into local state.
            <AccountPanel
              key={`${me?.id}:${me?.display_name}:${me?.username}`}
              me={me}
              loading={profileLoading}
              loadError={profileError}
              onSaved={setMe}
              onRetry={retryProfile}
            />
          )}
          {loading && active !== 'account' && (
            <div className="border-y border-border py-4">
              <TableSkeleton rows={5} columns={4} />
            </div>
          )}
          {!loading && error && active !== 'account' && (
            <ErrorState title="We couldn’t load your workspace" description={error} onRetry={retry} />
          )}
          {!loading && !error && !workspaceId && active !== 'account' && (
            <ErrorState
              title="No workspace is selected"
              description="Every setting below belongs to a workspace, and this session has none."
              onRetry={retry}
            />
          )}
          {!loading && workspaceId && !error && (
            <>
              {active === 'workspace' && (
                <WorkspacePanel key={current?.name} workspace={current} onRenamed={retry} />
              )}
              {active === 'members' && (
                <MembersPanel workspaceId={workspaceId} me={me} onChanged={retry} />
              )}
              {active === 'reviewer' && <ReviewerPanel workspaceId={workspaceId} />}
              {active === 'audit' && <AuditPanel workspaceId={workspaceId} />}
              {active === 'data' && (
                <DangerZonePanel
                  workspace={current}
                  me={me}
                  isOwner={role === 'owner'}
                  onWorkspaceGone={retry}
                />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default Settings
