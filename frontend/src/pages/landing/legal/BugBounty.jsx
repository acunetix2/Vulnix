import { LegalDocumentView } from './LegalDocumentView'
import { BUG_BOUNTY_DATA } from './legalContent'
import { Award, Mail, Key } from 'lucide-react'
import { toast } from 'sonner'

export function BugBounty() {
  const handleCopyPgp = () => {
    navigator.clipboard.writeText('-----BEGIN PGP PUBLIC KEY BLOCK-----\nVersion: Vulnix Security 2026\n\nmQENBF+VulnixKeyForBounties...\n-----END PGP PUBLIC KEY BLOCK-----')
    toast.success('PGP Public Key copied to clipboard')
  }

  return (
    <LegalDocumentView data={BUG_BOUNTY_DATA}>
      {/* Reward Matrix Table */}
      <div className="mt-8 p-6 rounded-xl border border-[#233137] bg-[#0c1316] space-y-5">
        <div className="flex items-center gap-3 border-b border-[#1c272c] pb-4">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Award className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              Bounty Reward Tiers (CVSS v3.1 Matrix)
            </h3>
            <p className="text-xs text-zinc-400">
              Cash payouts are determined by reproducibility, exploit complexity, and business impact.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-[#1f2b30] text-zinc-400 font-mono">
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">CVSS Range</th>
                <th className="py-2.5 px-3">Bounty Reward</th>
                <th className="py-2.5 px-3">Example Vulnerabilities</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#182327]">
              <tr className="hover:bg-white/[0.02]">
                <td className="py-3 px-3 font-semibold text-red-400">Critical</td>
                <td className="py-3 px-3 font-mono text-zinc-300">9.0 – 10.0</td>
                <td className="py-3 px-3 font-mono font-bold text-emerald-400">$5,000 – $15,000</td>
                <td className="py-3 px-3 text-zinc-300">Remote Code Execution on scan workers, sandbox escape, cross-tenant data leak</td>
              </tr>
              <tr className="hover:bg-white/[0.02]">
                <td className="py-3 px-3 font-semibold text-amber-400">High</td>
                <td className="py-3 px-3 font-mono text-zinc-300">7.0 – 8.9</td>
                <td className="py-3 px-3 font-mono font-bold text-emerald-400">$2,000 – $5,000</td>
                <td className="py-3 px-3 text-zinc-300">Stored XSS in finding descriptions, token privilege escalation, API auth bypass</td>
              </tr>
              <tr className="hover:bg-white/[0.02]">
                <td className="py-3 px-3 font-semibold text-blue-400">Medium</td>
                <td className="py-3 px-3 font-mono text-zinc-300">4.0 – 6.9</td>
                <td className="py-3 px-3 font-mono font-bold text-emerald-400">$500 – $1,500</td>
                <td className="py-3 px-3 text-zinc-300">CSRF on sensitive mutations, rate-limit circumvention, sensitive log exposure</td>
              </tr>
              <tr className="hover:bg-white/[0.02]">
                <td className="py-3 px-3 font-semibold text-zinc-400">Low</td>
                <td className="py-3 px-3 font-mono text-zinc-300">0.1 – 3.9</td>
                <td className="py-3 px-3 font-mono text-zinc-400">$150 – $400</td>
                <td className="py-3 px-3 text-zinc-300">Subdomain takeover without impact, verbose error disclosures</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Submission Action Box */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        <div className="p-5 rounded-xl border border-[#233137] bg-[#0c1316] space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-medium text-sm">
              <Mail className="w-4 h-4 text-emerald-400" />
              <span>Submit Vulnerability Report</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Email your encrypted report to our 24/7 security triage inbox. Reports are acknowledged within 24 hours.
            </p>
          </div>
          <a
            href="mailto:bounty@vulnix.com?subject=Vulnix%20Bug%20Bounty%20Report"
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs transition-colors w-full sm:w-auto"
          >
            Email bounty@vulnix.com
          </a>
        </div>

        <div className="p-5 rounded-xl border border-[#233137] bg-[#0c1316] space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-white font-medium text-sm">
              <Key className="w-4 h-4 text-emerald-400" />
              <span>PGP Public Encryption Key</span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Fingerprint: <code className="text-zinc-300 font-mono text-[11px]">7F3D 4B22 9E81 0A6C C34B</code>. Use this key to encrypt sensitive proof-of-concept exploits.
            </p>
          </div>
          <button
            onClick={handleCopyPgp}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-md bg-[#162126] hover:bg-[#1d2a31] text-zinc-200 border border-[#283840] font-medium text-xs transition-colors w-full sm:w-auto"
          >
            <Key className="w-3.5 h-3.5 text-emerald-400" />
            <span>Copy PGP Key</span>
          </button>
        </div>
      </div>
    </LegalDocumentView>
  )
}
