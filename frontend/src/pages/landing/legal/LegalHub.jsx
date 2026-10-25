import { LegalLayout } from './LegalLayout'
import { LEGAL_CATEGORIES } from './legalContent'
import { Link } from 'react-router-dom'
import { ShieldCheck, ArrowRight } from 'lucide-react'

export function LegalHub() {
  const hubDoc = {
    id: 'hub',
    title: 'Vulnix Site Policy & Legal Center',
    category: 'Site Policy',
    effectiveDate: 'October 25, 2026',
    version: '3.4',
    description:
      'All official contracts, privacy statements, data protection addenda, and security disclosure policies governing the Vulnix application security platform.',
    summary: [
      {
        section: '1. Core Terms & Agreements',
        anchor: '#core-terms',
        summary: 'Standard terms for self-service developers, organizations, and commercial enterprise contracts.',
      },
      {
        section: '2. Privacy, Code & Data Protection',
        anchor: '#privacy-data',
        summary: 'Our strict zero-training code fence, GDPR/CCPA data rights, and subprocessor directory.',
        highlight: 'Zero-training guarantee.',
      },
      {
        section: '3. Service Commitments & Safe Harbor',
        anchor: '#governance-security',
        summary: '99.95% cloud availability SLAs and our comprehensive vulnerability disclosure safe harbor.',
      },
    ],
  }

  return (
    <LegalLayout doc={hubDoc}>
      <div className="space-y-12">
        {/* Core Commitments Banner */}
        <div className="p-6 rounded-xl border border-emerald-500/30 bg-emerald-950/15 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-mono font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Developer-First Trust Principles</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight">
              Security Built on Transparency & Zero Code Training
            </h2>
            <p className="text-xs sm:text-sm text-zinc-300 max-w-2xl leading-relaxed">
              Vulnix is built by developers, for developers. We believe you should always retain 100% ownership of your proprietary software. We never train generative AI models on customer code, our scanning workers run in ephemeral memory, and our policies are documented in plain English.
            </p>
          </div>
        </div>

        {/* Categories Directory */}
        <div className="space-y-10">
          {LEGAL_CATEGORIES.map((cat) => (
            <div key={cat.id} id={cat.id} className="space-y-4">
              <div className="flex items-center gap-2 border-b border-[#1c272c] pb-2">
                <h3 className="text-lg font-bold text-white tracking-tight">
                  {cat.name}
                </h3>
                <span className="text-xs text-zinc-500 font-mono">
                  ({cat.items.length} documents)
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
                        Official terms and guidelines regarding {item.name.toLowerCase()} at Vulnix.
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

        {/* Contact and Legal Questions */}
        <div className="p-6 rounded-xl border border-[#233137] bg-[#0c1316] space-y-3">
          <h3 className="text-base font-semibold text-white">
            Have Questions or Need a Custom Enterprise Agreement?
          </h3>
          <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
            Our legal and compliance teams are available to assist with custom vendor risk questionnaires, signed Business Associate Agreements (BAAs), or mutual enterprise MSAs.
          </p>
          <div className="pt-2 flex flex-wrap gap-4 text-xs font-medium">
            <a
              href="mailto:legal@vulnix.com"
              className="text-emerald-400 hover:text-emerald-300 hover:underline"
            >
              legal@vulnix.com
            </a>
            <span className="text-zinc-600">•</span>
            <a
              href="mailto:privacy@vulnix.com"
              className="text-emerald-400 hover:text-emerald-300 hover:underline"
            >
              privacy@vulnix.com
            </a>
            <span className="text-zinc-600">•</span>
            <a
              href="mailto:security@vulnix.com"
              className="text-emerald-400 hover:text-emerald-300 hover:underline"
            >
              security@vulnix.com
            </a>
          </div>
        </div>
      </div>
    </LegalLayout>
  )
}
