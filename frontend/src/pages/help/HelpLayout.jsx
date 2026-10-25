import { useState, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  PanelLeft,
  ChevronDown,
  Printer,
  Copy,
  Check,
  BookOpen,
  ArrowUpRight,
  Search,
  LifeBuoy,
} from 'lucide-react'
import { HELP_CATEGORIES } from './helpContent'
import { VulnixLegalGraphicBanner } from '../landing/legal/VulnixLegalGraphicBanner'

/**
 * Universal Help Center layout matching the Legal pages layout,
 * featuring dark cyber aesthetic, collapsible category sidebar, search filter,
 * breadcrumbs, summary table, animated 3D graphic banner, and tiny footer.
 */
export function HelpLayout({ doc, children }) {
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsedCategories, setCollapsedCategories] = useState({})

  // Auto-scroll to anchor or top on navigation
  useEffect(() => {
    if (location.hash) {
      const el = window.document.querySelector(location.hash)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' })
      }
    } else {
      window.scrollTo(0, 0)
    }
  }, [location.pathname, location.hash])

  const toggleCategory = (catId) => {
    setCollapsedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId],
    }))
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handlePrint = () => {
    window.print()
  }

  // Filter items in sidebar if user searches
  const filteredCategories = HELP_CATEGORIES.map((cat) => {
    if (!searchQuery.trim()) return cat
    const q = searchQuery.toLowerCase()
    const matchingItems = cat.items.filter(
      (item) => item.name.toLowerCase().includes(q)
    )
    return { ...cat, items: matchingItems }
  }).filter((cat) => cat.items.length > 0)

  return (
    <div className="min-h-screen bg-[#070b0d] text-[#e6edf3] font-sans flex flex-col selection:bg-emerald-500/20 selection:text-emerald-300">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 h-13 border-b border-[#1c272c] bg-[#090e11]/95 backdrop-blur px-4 flex items-center justify-between">
        <div className="flex items-center space-x-3 overflow-hidden text-sm">
          {/* Sidebar Toggle Button */}
          <button
            onClick={() => {
              setSidebarOpen(!sidebarOpen)
              setMobileMenuOpen(!mobileMenuOpen)
            }}
            title="Toggle Sidebar"
            aria-label="Toggle Sidebar"
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/5 border border-[#233137] transition-colors focus:outline-none focus:ring-1 focus:ring-emerald-400"
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs md:text-sm text-zinc-400 truncate">
            <Link to="/" className="hover:text-white transition-colors">
              Home
            </Link>
            <span className="text-zinc-600">/</span>
            <Link to="/help" className="hover:text-white transition-colors">
              Help Center
            </Link>
            {doc?.category && (
              <>
                <span className="text-zinc-600">/</span>
                <span className="hidden sm:inline text-zinc-400 truncate">
                  {doc.category}
                </span>
              </>
            )}
            {doc?.title && (
              <>
                <span className="text-zinc-600">/</span>
                <span className="text-zinc-100 font-semibold truncate">
                  {doc.title}
                </span>
              </>
            )}
          </nav>
        </div>

        {/* Right actions */}
        <div className="flex items-center space-x-3 shrink-0">
          <Link
            to="/resources/support"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors px-2.5 py-1 rounded border border-[#233137] hover:border-zinc-600"
          >
            <LifeBuoy className="w-3.5 h-3.5" />
            <span>Support</span>
          </Link>
          <Link
            to="/app/dashboard"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-emerald-400 transition-colors px-2.5 py-1 rounded border border-[#233137] hover:border-emerald-500/30"
          >
            <span>Console</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 flex w-full max-w-[1440px] mx-auto">
        {/* Left Sidebar */}
        <aside
          className={`
            fixed md:sticky top-13 z-30 h-[calc(100vh-3.25rem)] w-72 shrink-0 border-r border-[#1c272c] bg-[#090e11] flex flex-col transition-all duration-200
            ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:hidden'}
            ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b border-[#1c272c]">
            <div className="flex items-center justify-between mb-3">
              <Link to="/help" className="text-base font-semibold text-white tracking-tight flex items-center gap-2 hover:text-emerald-300 transition-colors">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <span>Help Center</span>
              </Link>
            </div>

            {/* Quick search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Filter help articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#11181c] border border-[#233137] rounded-md pl-8 pr-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
              />
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-1 text-xs">
            {filteredCategories.map((cat, idx) => {
              const isCollapsed = collapsedCategories[cat.id]
              return (
                <div
                  key={cat.id}
                  className={`space-y-1.5 ${idx !== 0 ? 'border-t border-dashed border-[#233137] pt-3 mt-3' : 'pt-1'}`}
                >
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(cat.id)}
                    className="w-full flex items-center justify-between py-1 px-1 text-left group transition-colors focus:outline-none"
                  >
                    <span className="text-[14px] sm:text-[15px] font-semibold text-white tracking-tight group-hover:text-emerald-300 transition-colors">
                      {cat.name}
                    </span>
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-zinc-400 group-hover:text-white transition-transform duration-200 ${
                        isCollapsed ? '-rotate-90' : ''
                      }`}
                    />
                  </button>

                  {/* Category Items */}
                  {!isCollapsed && (
                    <ul className="space-y-0.5 pl-0.5 mt-1">
                      {cat.items.map((item) => {
                        const isActive =
                          location.pathname === item.path ||
                          (location.pathname === '/help' && item.id === 'quickstart')

                        return (
                          <li key={item.id}>
                            <Link
                              to={item.path}
                              onClick={() => setMobileMenuOpen(false)}
                              className={`
                                group flex items-center px-2 py-1.5 rounded-md text-xs transition-colors
                                ${
                                  isActive
                                    ? 'bg-[#151f24] text-white font-medium shadow-sm'
                                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-[#11181c]'
                                }
                              `}
                            >
                              {/* Green Active Bar */}
                              {isActive ? (
                                <span className="w-1 h-3.5 bg-emerald-400 rounded-full mr-2 shrink-0" />
                              ) : (
                                <span className="w-1 h-3.5 bg-transparent mr-2 shrink-0" />
                              )}
                              <span className="truncate">{item.name}</span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              )
            })}
          </nav>

          {/* Sidebar Footer Link */}
          <div className="p-3 border-t border-[#1c272c] bg-[#080d10]">
            <Link
              to="/resources/support"
              className="flex items-center justify-between text-xs text-zinc-400 hover:text-white transition-colors p-2 rounded hover:bg-white/5"
            >
              <span className="flex items-center gap-2">
                <LifeBuoy className="w-3.5 h-3.5 text-emerald-400" />
                <span>Need more help?</span>
              </span>
              <span className="text-[11px] text-emerald-400">Contact team →</span>
            </Link>
          </div>
        </aside>

        {/* Mobile backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/60 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 px-4 sm:px-8 py-6 md:py-8 flex flex-col justify-between">
          <div className="max-w-4xl w-full mx-auto space-y-8">
            {/* Document Header & Metadata */}
            {doc && (
              <div className="border-b border-[#1c272c] pb-6">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <span className="text-xs uppercase tracking-widest text-emerald-400 font-mono font-medium">
                    {doc.category || 'Help Guide'}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyLink}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-zinc-400 hover:text-white bg-[#11181c] border border-[#233137] hover:border-zinc-700 transition-colors"
                      title="Copy link to document"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied' : 'Copy link'}</span>
                    </button>
                    <button
                      onClick={handlePrint}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-zinc-400 hover:text-white bg-[#11181c] border border-[#233137] hover:border-zinc-700 transition-colors"
                      title="Print document"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print</span>
                    </button>
                  </div>
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mb-2">
                  {doc.title}
                </h1>
                <p className="text-sm text-zinc-400 leading-relaxed mb-3">
                  {doc.description}
                </p>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 font-mono">
                  <span>Effective: {doc.effectiveDate}</span>
                  <span>•</span>
                  <span>Version {doc.version}</span>
                  <span>•</span>
                  <span>{doc.readTime || '4 min read'}</span>
                  <span>•</span>
                  <span>Published by Vulnix Security Team</span>
                </div>
              </div>
            )}

            {/* Collapsible Summary Box matching Legal reference */}
            {doc?.summary && doc.summary.length > 0 && (
              <section aria-labelledby="summary-heading" className="rounded-lg border border-[#1f2b30] bg-[#0c1316] overflow-hidden">
                <button
                  id="summary-heading"
                  onClick={() => setSummaryOpen(!summaryOpen)}
                  className="w-full flex items-center justify-between px-4 sm:px-6 py-3.5 text-left font-semibold text-white text-base hover:bg-white/[0.02] transition-colors focus:outline-none"
                >
                  <span className="flex items-center gap-2">
                    <span>Summary</span>
                    <span className="text-xs font-normal text-zinc-400">
                      (Article overview)
                    </span>
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 text-zinc-400 transition-transform duration-200 ${
                      summaryOpen ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {summaryOpen && (
                  <div className="border-t border-[#1f2b30] overflow-x-auto">
                    <table className="w-full text-left text-xs sm:text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-[#1f2b30] text-zinc-400 text-xs font-medium">
                          <th className="py-2.5 px-4 sm:px-6 w-1/3">Section</th>
                          <th className="py-2.5 px-4 sm:px-6 w-2/3">What can you find there?</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#182327]">
                        {doc.summary.map((row, idx) => (
                          <tr key={idx} className="hover:bg-[#10181c]/60 transition-colors">
                            <td className="py-3 px-4 sm:px-6 align-top">
                              <a
                                href={row.anchor}
                                className="text-emerald-400 hover:text-emerald-300 hover:underline font-medium break-words inline-block"
                              >
                                {row.section}
                              </a>
                            </td>
                            <td className="py-3 px-4 sm:px-6 align-top text-zinc-300 leading-relaxed">
                              {row.summary}
                              {row.highlight && (
                                <span className="block mt-1 font-semibold text-zinc-100">
                                  {row.highlight}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Document Content */}
            <div className="prose prose-invert max-w-none space-y-8">
              {children}
            </div>
          </div>

          {/* Vulnix Purple 3D Isometric Landscape Banner */}
          <VulnixLegalGraphicBanner />

          {/* Tiny Footer matching Legal pages */}
          <footer className="pt-4 border-t border-[#1c272c] max-w-4xl w-full mx-auto">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-zinc-500">
              <div className="flex items-center gap-2">
                <span>© 2026 Vulnix, Inc.</span>
                <span>•</span>
                <span>All rights reserved.</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <Link to="/legal/terms" className="hover:text-zinc-300 transition-colors">
                  Terms
                </Link>
                <Link to="/legal/privacy" className="hover:text-zinc-300 transition-colors">
                  Privacy
                </Link>
                <Link to="/legal/security-disclosure" className="hover:text-zinc-300 transition-colors">
                  Security
                </Link>
                <Link to="/resources/status" className="hover:text-zinc-300 transition-colors">
                  Status
                </Link>
                <Link to="/docs" className="hover:text-zinc-300 transition-colors">
                  Docs
                </Link>
                <Link to="/company" className="hover:text-zinc-300 transition-colors">
                  Contact
                </Link>
                <Link to="/legal/privacy-settings" className="hover:text-zinc-300 transition-colors">
                  Cookie Preferences
                </Link>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}
