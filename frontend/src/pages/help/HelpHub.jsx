import { HelpLayout } from './HelpLayout'
import { HELP_CATEGORIES } from './helpContent'
import { Link } from 'react-router-dom'
import { ShieldCheck, ArrowRight, LifeBuoy } from 'lucide-react'

export function HelpHub() {
  const hubDoc = {
    id: 'hub',
    title: 'Vulnix Documentation & Help Center',
    category: 'Help Center',
    effectiveDate: 'October 25, 2026',
    version: '2.4',
    readTime: 'Overview',
    description:
      'Official guides, scanner engine setup, API references, triage workflows, and troubleshooting documentation for the Vulnix platform.',
    summary: [
      {
        section: '1. Getting Started & Setup',
        anchor: '#getting-started',
        summary: 'Initialize workspaces, invite teammates, and configure your first repository audit.',
      },
      {
        section: '2. Code Scanners & Lifecycle',
        anchor: '#repositories-scanning',
        summary: 'Deep dive into Semgrep, Gitleaks, Bandit, Trivy, and ephemeral archive uploads.',
        highlight: 'Zero code retention guarantee.',
      },
      {
        section: '3. AI Review & Findings Triage',
        anchor: '#vulnerabilities-ai',
        summary: 'Understand CVSS 3.1 scoring, verified diff generation, and false-positive handling.',
      },
      {
        section: '4. CI/CD & Compliance',
        anchor: '#integrations-cicd',
        summary: 'GitHub Actions PR status checks, Slack/Jira sync, and SOC 2 / OWASP audit exports.',
      },
    ],
  }

  return (
    <HelpLayout doc={hubDoc}>
      <div className="space-y-12">
        {/* Core Commitments Banner */}
        <div className="p-6 rounded-xl border border-emerald-500/30 bg-emerald-950/15 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Developer-First Guidance</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Practical Security Guides Without the Noise
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl leading-relaxed">
              Vulnix is engineered to keep developers moving fast while eliminating security vulnerabilities. Browse step-by-step walkthroughs for connecting repositories, configuring multi-engine AST linters, generating verified AI fixes, and preparing compliance evidence.
            </p>
          </div>
        </div>

        {/* Categories Directory */}
        <div className="space-y-10">
          {HELP_CATEGORIES.map((cat) => (
            <div key={cat.id} id={cat.id} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-[#1c272c] pb-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {cat.name}
                </h3>
                <span className="text-xs text-zinc-500 font-mono">
                  ({cat.items.length} guides)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {cat.items.map((item) => (
                  <Link
                    key={item.id}
                    to={item.path}
                    className="group p-4 rounded-lg border border-[#233137] bg-[#0c1316] hover:bg-[#11181c] hover:border-emerald-500/40 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-white font-medium text-sm group-hover:text-emerald-300 transition-colors">
                        <span>{item.name}</span>
                        <ArrowRight className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 group-hover:translate-x-0.5 transition-all" />
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed line-clamp-2">
                        Comprehensive instructions and technical specifications for {item.name.toLowerCase()}.
                      </p>
                    </div>
                    <div className="pt-3 text-[11px] font-mono text-zinc-500 flex items-center gap-1.5">
                      <span>{item.path}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Contact and Engineering Support */}
        <div className="p-6 rounded-xl border border-[#233137] bg-[#0c1316] space-y-3">
          <div className="flex items-center gap-2 text-emerald-400">
            <LifeBuoy className="w-4 h-4" />
            <h3 className="text-base font-semibold text-white">
              Can't Find What You're Looking For?
            </h3>
          </div>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Our engineering and security teams are standing by to assist with custom pipeline integrations, on-premise deployments, or custom scanner rule packs.
          </p>
          <div className="pt-2 flex flex-wrap gap-3">
            <Link
              to="/resources/support"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 transition-colors"
            >
              <span>Contact Engineering Support</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/docs"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#11181c] border border-[#233137] text-zinc-300 text-xs font-semibold hover:text-white hover:border-zinc-600 transition-colors"
            >
              <span>View API Reference</span>
            </Link>
          </div>
        </div>
      </div>
    </HelpLayout>
  )
}
