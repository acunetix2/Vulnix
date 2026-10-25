import { useCallback, useEffect, useRef, useState } from 'react'
import { AtSign, Check, Loader2, Mail, Search, UserMinus, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../../services/api'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Field, FieldDescription } from '../../ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../ui/table'
import { SettingsPanel as Panel } from './SettingsPanel'
import { Pill } from '../../app/SeverityBadge'
import { UserAvatar } from '../../app/UserAvatar'
import { EmptyState, ErrorState, TableSkeleton } from '../../EmptyState'
import { formatDate } from '../../../lib/utils'

const RANK = { viewer: 0, member: 1, admin: 2, owner: 3 }
const GRANTABLE = ['viewer', 'member', 'admin']

/**
 * Access to this workspace, read from the members endpoint. A row is editable
 * when the actor outranks it - or when it is the actor's own row, which is how
 * an owner hands the workspace over or leaves it. The server enforces all of
 * it; the controls here only avoid offering what is certain to be refused.
 */
export function MembersPanel({ workspaceId, me, onChanged }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(null)

  // Search & add member
  const [query, setQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [inviteRole, setInviteRole] = useState('member')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState(null)
  const dropdownRef = useRef(null)

  const myRole = me?.workspaces?.find((w) => w.id === workspaceId)?.role
  const canManage = RANK[myRole] >= RANK.admin

  const reload = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!cancelled) setLoading(true)
      try {
        const list = await api.getMembers(workspaceId)
        if (cancelled) return
        setRows(list)
        setError(null)
      } catch (err) {
        if (!cancelled) setError(err.message || 'We could not read who has access.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [workspaceId, attempt])

  // Debounced search for users by username or email
  useEffect(() => {
    const trimmed = query.trim().replace(/^@+/, '')
    if (selectedUser || !trimmed || trimmed.length < 2) {
      setSearchResults([])
      setSearching(false)
      return
    }

    let cancelled = false
    setSearching(true)

    const timer = setTimeout(async () => {
      try {
        const res = await api.searchUsers(trimmed)
        if (!cancelled) {
          setSearchResults(res || [])
          setShowDropdown(true)
        }
      } catch {
        if (!cancelled) setSearchResults([])
      } finally {
        if (!cancelled) setSearching(false)
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, selectedUser])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const existingUserIds = new Set(rows.map((r) => r.user_id))

  function handleSelectUser(user) {
    setSelectedUser(user)
    setQuery(user.username ? `@${user.username}` : user.email)
    setShowDropdown(false)
    setInviteError(null)
  }

  function handleClearSelection() {
    setSelectedUser(null)
    setQuery('')
    setShowDropdown(false)
    setInviteError(null)
  }

  async function handleInvite(event) {
    event.preventDefault()
    const target = selectedUser ? selectedUser.id : query.trim()
    if (!target) return
    setInviting(true)
    setInviteError(null)
    try {
      const payload = selectedUser
        ? { username: selectedUser.username, email: selectedUser.email, identifier: selectedUser.email || selectedUser.username }
        : query.trim()
      const added = await api.addMember(workspaceId, payload, inviteRole)
      toast.success(`${added.label} can now reach this workspace`, {
        description: `Role: ${added.role}.`,
      })
      handleClearSelection()
      reload()
      onChanged?.()
    } catch (err) {
      setInviteError(err.message || 'The invitation was not saved.')
    } finally {
      setInviting(false)
    }
  }

  async function handleRole(row, role) {
    setBusy(row.user_id)
    try {
      const updated = await api.setMemberRole(workspaceId, row.user_id, role)
      setRows((prev) => prev.map((item) => (item.user_id === row.user_id ? updated : item)))
      toast.success(`${updated.label} is now ${updated.role}`)
      onChanged?.()
    } catch (err) {
      toast.error('Role unchanged', { description: err.message })
    } finally {
      setBusy(null)
    }
  }

  async function handleRemove(row) {
    const leaving = row.user_id === me?.id
    setBusy(row.user_id)
    try {
      await api.removeMember(workspaceId, row.user_id)
      setRows((prev) => prev.filter((item) => item.user_id !== row.user_id))
      toast.success(leaving ? 'You left this workspace' : `${row.label} no longer has access`)
      onChanged?.()
    } catch (err) {
      toast.error('Could not remove access', { description: err.message })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <Panel
          title="Give access"
          description="Search existing Vulnix accounts by username or email address to add them to this workspace."
        >
          <form className="space-y-3" onSubmit={handleInvite}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="relative flex-1" ref={dropdownRef}>
                <Field>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={query}
                      onChange={(event) => {
                        setQuery(event.target.value)
                        setSelectedUser(null)
                        setShowDropdown(true)
                      }}
                      onFocus={() => {
                        if (searchResults.length > 0) setShowDropdown(true)
                      }}
                      placeholder="Search by username or email (e.g. @ada or user@company.com)…"
                      autoComplete="off"
                      className="pl-9 pr-8 min-w-0"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                      {searching && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
                      {!searching && query && (
                        <button
                          type="button"
                          onClick={handleClearSelection}
                          className="rounded p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <X className="size-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <FieldDescription>
                    Search by @username, full name, or email. Only registered accounts can be added.
                  </FieldDescription>
                </Field>

                {/* Autocomplete dropdown */}
                {showDropdown && query.trim().length >= 2 && (
                  <div className="absolute z-30 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-lg">
                    {searching ? (
                      <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" />
                        Searching accounts…
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="p-3 text-xs text-muted-foreground text-center">
                        No registered accounts found matching &ldquo;{query}&rdquo;.
                      </div>
                    ) : (
                      searchResults.map((user) => {
                        const isMember = existingUserIds.has(user.id)
                        return (
                          <button
                            key={user.id}
                            type="button"
                            disabled={isMember}
                            onClick={() => handleSelectUser(user)}
                            className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                              isMember
                                ? 'opacity-50 cursor-not-allowed bg-muted/30'
                                : 'hover:bg-accent hover:text-accent-foreground cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <UserAvatar person={user} className="size-7 shrink-0 text-xs" />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground text-xs">
                                  {user.display_name || user.username || user.email}
                                  {user.username && (
                                    <span className="ml-1.5 text-muted-foreground font-normal">
                                      @{user.username}
                                    </span>
                                  )}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">{user.email}</p>
                              </div>
                            </div>
                            {isMember ? (
                              <span className="shrink-0 text-[11px] font-medium text-muted-foreground">
                                Already member
                              </span>
                            ) : (
                              <span className="shrink-0 text-xs text-primary font-medium">Select</span>
                            )}
                          </button>
                        )
                      })
                    )}
                  </div>
                )}
              </div>

              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="w-full sm:w-40 shrink-0" aria-label="Role to grant">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GRANTABLE.map((role) => (
                    <SelectItem key={role} value={role}>
                      {role}
                    </SelectItem>
                  ))}
                  {myRole === 'owner' && <SelectItem value="owner">owner</SelectItem>}
                </SelectContent>
              </Select>
            </div>

            {selectedUser && (
              <div className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                <div className="flex items-center gap-2">
                  <UserAvatar person={selectedUser} className="size-6 text-xs" />
                  <span className="font-medium text-foreground">
                    Selected: {selectedUser.display_name || selectedUser.email}
                  </span>
                  {selectedUser.username && (
                    <span className="text-muted-foreground">(@{selectedUser.username})</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleClearSelection}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Change
                </button>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button type="submit" disabled={inviting || (!query.trim() && !selectedUser)}>
                <UserPlus data-icon="inline-start" />
                {inviting ? 'Adding…' : 'Add member'}
              </Button>
              {inviteError && <p className="text-xs text-destructive">{inviteError}</p>}
            </div>
          </form>
        </Panel>
      )}

      <Panel
        title="Members"
        description={
          canManage
            ? 'Highest role first. Changing a role is recorded in the audit log.'
            : 'Everyone with access. Only an admin or owner can change it.'
        }
        flush
      >
        {loading ? (
          <TableSkeleton rows={4} columns={3} />
        ) : error ? (
          <ErrorState
            title="We could not read this roster"
            description={error}
            onRetry={() => setAttempt((n) => n + 1)}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="Nobody is listed" description="This workspace has no members." />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead className="w-40">Role</TableHead>
                <TableHead className="w-32">Since</TableHead>
                <TableHead className="w-28" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const isMe = row.user_id === me?.id
                // A manager may act on anyone below their own role; your own row
                // is always yours to step down from or leave.
                const editable = canManage && (isMe || RANK[row.role] < RANK[myRole])
                return (
                  <TableRow key={row.user_id}>
                    <TableCell className="align-middle">
                      <p className="text-sm font-medium text-foreground">{row.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.email || 'no email on file'}
                        {isMe && ' · you'}
                      </p>
                    </TableCell>
                    <TableCell className="align-middle">
                      {editable ? (
                        <Select
                          value={row.role}
                          onValueChange={(role) => role !== row.role && handleRole(row, role)}
                          disabled={busy === row.user_id}
                        >
                          <SelectTrigger className="w-32" aria-label={`Role for ${row.label}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {GRANTABLE.map((role) => (
                              <SelectItem key={role} value={role}>
                                {role}
                              </SelectItem>
                            ))}
                            {(myRole === 'owner' || row.role === 'owner') && (
                              <SelectItem value="owner">owner</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Pill tone={row.role === 'owner' ? 'success' : 'neutral'}>{row.role}</Pill>
                      )}
                    </TableCell>
                    <TableCell className="align-middle text-xs text-muted-foreground">
                      {formatDate(row.joined_at)}
                    </TableCell>
                    <TableCell className="align-middle text-right">
                      {(isMe || editable) && (
                        <Button
                          variant="ghost"
                          size="xs"
                          disabled={busy === row.user_id}
                          onClick={() => handleRemove(row)}
                        >
                          <UserMinus data-icon="inline-start" />
                          {isMe ? 'Leave' : 'Remove'}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  )
}
