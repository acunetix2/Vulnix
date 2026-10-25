import { useEffect, useRef, useState } from 'react'
import {
  Check,
  Copy,
  FileCode,
  FileDown,
  FileJson,
  FileSpreadsheet,
  FileText,
  Loader2,
  Mail,
  Search,
  Send,
  Share2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { api } from '../../services/api'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Field, FieldDescription, FieldLabel } from '../ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { UserAvatar } from './UserAvatar'
import { generateAuditPdf } from '../../lib/pdfReport'

export function ShareExportModal({ open, onOpenChange, scan, project, findings = [] }) {
  const [activeTab, setActiveTab] = useState('share') // 'share' | 'export'

  // Share state
  const [query, setQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState(null)
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [role, setRole] = useState('viewer')
  const [note, setNote] = useState('')
  const [sharing, setSharing] = useState(false)
  const [copied, setCopied] = useState(false)
  const dropdownRef = useRef(null)

  // Export state
  const [exportingFormat, setExportingFormat] = useState(null)

  // Debounced search for users
  useEffect(() => {
    const clean = query.trim().replace(/^@+/, '')
    if (selectedUser || !clean || clean.length < 2) {
      setSearchResults([])
      setSearching(false)
      return
    }

    let cancelled = false
    setSearching(true)

    const timer = setTimeout(async () => {
      try {
        const res = await api.searchUsers(clean)
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

  // Handle outside click for autocomplete
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const scanId = scan?.id || ''
  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/app/audits/runs/${scanId}`
    : ''

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      toast.success('Link copied to clipboard', {
        description: 'Anyone with workspace access can open this audit report.',
      })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handleSelectUser = (user) => {
    setSelectedUser(user)
    setQuery(user.username ? `@${user.username}` : user.email)
    setShowDropdown(false)
  }

  const handleClearSelection = () => {
    setSelectedUser(null)
    setQuery('')
    setShowDropdown(false)
  }

  const handleSendShare = async (e) => {
    e.preventDefault()
    const recipient = selectedUser ? (selectedUser.username ? `@${selectedUser.username}` : selectedUser.email) : query.trim()
    if (!recipient) {
      toast.error('Please enter a username or email address')
      return
    }

    setSharing(true)
    try {
      await api.shareReport(scanId, {
        recipient,
        role,
        note: note.trim() || undefined,
      })
      toast.success('Report shared successfully', {
        description: `Shared with ${recipient} as ${role}.`,
      })
      handleClearSelection()
      setNote('')
      onOpenChange(false)
    } catch (err) {
      toast.error('Could not share report', {
        description: err.message || 'Please verify the recipient and try again.',
      })
    } finally {
      setSharing(false)
    }
  }

  const handleDownloadPdf = async () => {
    setExportingFormat('pdf')
    try {
      generateAuditPdf({ scan, project, findings })
      toast.success('PDF report generated', {
        description: 'Your report download has started.',
      })
    } catch (err) {
      toast.error('Failed to generate PDF', { description: err.message })
    } finally {
      setExportingFormat(null)
    }
  }

  const handleDownloadBackendReport = async (format) => {
    setExportingFormat(format)
    try {
      const response = await api.getReport(scanId, format)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = format === 'markdown' ? 'md' : format
      a.download = `vulnix-report-${scanId.slice(0, 8)}.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`${format.toUpperCase()} export downloaded`)
    } catch (err) {
      toast.error(`Could not export as ${format.toUpperCase()}`, {
        description: err.message || 'Please try again.',
      })
    } finally {
      setExportingFormat(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-0 gap-0 overflow-hidden">
        {/* Header with Title and Tabs */}
        <div className="border-b border-border bg-muted/20 px-6 pt-5 pb-0">
          <DialogHeader className="pb-3 text-left">
            <DialogTitle className="text-base font-semibold">
              Share & Export Audit Report
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Share findings with collaborators by username or email, or download formatted reports.
            </DialogDescription>
          </DialogHeader>

          {/* Tab Navigation */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('share')}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'share'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Share2 className="size-3.5" />
              Share with collaborators
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('export')}
              className={`flex items-center gap-2 border-b-2 px-3 py-2 text-xs font-medium transition-colors ${
                activeTab === 'export'
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileDown className="size-3.5" />
              Export & Downloads
            </button>
          </div>
        </div>

        {/* Tab Body */}
        <div className="p-6">
          {activeTab === 'share' ? (
            <div className="space-y-5">
              {/* Quick Copy Link */}
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">Direct report URL</p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{shareUrl}</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="shrink-0 gap-1.5"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-emerald-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      Copy link
                    </>
                  )}
                </Button>
              </div>

              {/* Share form */}
              <form onSubmit={handleSendShare} className="space-y-4">
                <div className="relative" ref={dropdownRef}>
                  <Field>
                    <FieldLabel className="text-xs font-medium">Recipient</FieldLabel>
                    <div className="relative mt-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value)
                          setSelectedUser(null)
                          setShowDropdown(true)
                        }}
                        onFocus={() => {
                          if (searchResults.length > 0) setShowDropdown(true)
                        }}
                        placeholder="Search by username (@handle) or email..."
                        className="pl-9 pr-8"
                        autoComplete="off"
                      />
                      <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center">
                        {searching && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                        {!searching && query && (
                          <button
                            type="button"
                            onClick={handleClearSelection}
                            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                          >
                            <X className="size-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                    <FieldDescription className="text-[11px]">
                      Search registered Vulnix users by username or email.
                    </FieldDescription>
                  </Field>

                  {/* Suggestions dropdown */}
                  {showDropdown && query.trim().length >= 2 && (
                    <div className="absolute z-40 mt-1 max-h-52 w-full overflow-auto rounded-lg border border-border bg-popover p-1 shadow-xl">
                      {searching ? (
                        <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                          <Loader2 className="size-3.5 animate-spin" />
                          Searching accounts…
                        </div>
                      ) : searchResults.length === 0 ? (
                        <div className="p-3 text-xs text-muted-foreground text-center">
                          No registered accounts matching &ldquo;{query}&rdquo;.
                        </div>
                      ) : (
                        searchResults.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => handleSelectUser(u)}
                            className="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-accent cursor-pointer"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <UserAvatar person={u} className="size-6 shrink-0 text-xs" />
                              <div className="min-w-0">
                                <p className="truncate font-medium text-foreground">
                                  {u.display_name || u.username || u.email}
                                  {u.username && (
                                    <span className="ml-1.5 text-muted-foreground font-normal">
                                      @{u.username}
                                    </span>
                                  )}
                                </p>
                                <p className="truncate text-[10px] text-muted-foreground">{u.email}</p>
                              </div>
                            </div>
                            <span className="text-primary font-medium shrink-0">Select</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Selected user badge */}
                {selectedUser && (
                  <div className="flex items-center justify-between rounded-md border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <UserAvatar person={selectedUser} className="size-5 text-[10px]" />
                      <span className="truncate font-medium text-foreground">
                        {selectedUser.display_name || selectedUser.email}
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
                      Clear
                    </button>
                  </div>
                )}

                {/* Role & Message */}
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Access Level</label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger className="w-full text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">Viewer (Read-only)</SelectItem>
                        <SelectItem value="reviewer">Reviewer (Can triage)</SelectItem>
                        <SelectItem value="admin">Admin (Full access)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground block mb-1">Optional note</label>
                    <Input
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="e.g. Please check CVE findings..."
                      className="text-xs"
                      maxLength={200}
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenChange(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={sharing || (!query.trim() && !selectedUser)}
                    className="gap-1.5"
                  >
                    {sharing ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Sharing…
                      </>
                    ) : (
                      <>
                        <Send className="size-3.5" />
                        Share report
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          ) : (
            /* Export tab */
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Download this audit report in your preferred format for offline review, compliance archiving, or pipeline integration.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* PDF Card */}
                <div className="flex flex-col justify-between rounded-lg border border-border p-3.5 bg-card hover:border-primary/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-red-500/10 text-red-600 dark:text-red-400">
                      <FileText className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">PDF Security Report</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        Executive summary, severity matrix, scanner results, and findings table.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground">PDF · Formatted</span>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={handleDownloadPdf}
                      disabled={exportingFormat !== null}
                      className="gap-1"
                    >
                      {exportingFormat === 'pdf' ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          Building…
                        </>
                      ) : (
                        <>
                          <FileDown className="size-3" />
                          Download PDF
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* CSV Card */}
                <div className="flex flex-col justify-between rounded-lg border border-border p-3.5 bg-card hover:border-primary/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <FileSpreadsheet className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">CSV Spreadsheet</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        Tabular dataset of all findings for Excel, Google Sheets, or Jira backlog import.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground">CSV · Data table</span>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleDownloadBackendReport('csv')}
                      disabled={exportingFormat !== null}
                      className="gap-1"
                    >
                      {exportingFormat === 'csv' ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          Building…
                        </>
                      ) : (
                        <>
                          <FileDown className="size-3" />
                          Download CSV
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* JSON Card */}
                <div className="flex flex-col justify-between rounded-lg border border-border p-3.5 bg-card hover:border-primary/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <FileJson className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">JSON Machine Report</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        Machine-readable audit artifact with scanner metadata, evidence, and rule IDs.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground">JSON · Raw AST</span>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleDownloadBackendReport('json')}
                      disabled={exportingFormat !== null}
                      className="gap-1"
                    >
                      {exportingFormat === 'json' ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          Exporting…
                        </>
                      ) : (
                        <>
                          <FileDown className="size-3" />
                          Download JSON
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Markdown Card */}
                <div className="flex flex-col justify-between rounded-lg border border-border p-3.5 bg-card hover:border-primary/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <FileCode className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">Markdown Summary</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                        Formatted documentation ready for GitHub/GitLab PR comments or wiki notes.
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-between">
                    <span className="text-[10px] font-medium text-muted-foreground">MD · Developer doc</span>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => handleDownloadBackendReport('markdown')}
                      disabled={exportingFormat !== null}
                      className="gap-1"
                    >
                      {exportingFormat === 'markdown' ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          Exporting…
                        </>
                      ) : (
                        <>
                          <FileDown className="size-3" />
                          Download MD
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
