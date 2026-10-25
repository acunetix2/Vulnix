import { useState } from 'react'
import { LegalDocumentView } from './LegalDocumentView'
import { PRIVACY_SETTINGS_DATA } from './legalContent'
import { Download, Trash2, Sliders } from 'lucide-react'
import { toast } from 'sonner'

export function PrivacySettings() {
  const [analyticsEnabled, setAnalyticsEnabled] = useState(() => {
    return localStorage.getItem('vulnix_analytics_consent') !== 'false'
  })
  const [telemetryEnabled, setTelemetryEnabled] = useState(() => {
    return localStorage.getItem('vulnix_telemetry_consent') !== 'false'
  })
  const [saving, setSaving] = useState(false)

  const handleSavePreferences = () => {
    setSaving(true)
    localStorage.setItem('vulnix_analytics_consent', analyticsEnabled ? 'true' : 'false')
    localStorage.setItem('vulnix_telemetry_consent', telemetryEnabled ? 'true' : 'false')
    setTimeout(() => {
      setSaving(false)
      toast.success('Privacy preferences saved successfully')
    }, 400)
  }

  return (
    <LegalDocumentView data={PRIVACY_SETTINGS_DATA}>
      {/* Interactive Controls Panel */}
      <div className="mt-10 p-6 rounded-xl border border-[#233137] bg-[#0c1316] space-y-6">
        <div className="flex items-center gap-3 border-b border-[#1c272c] pb-4">
          <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Sliders className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">
              Interactive Privacy & Cookie Controls
            </h3>
            <p className="text-xs text-zinc-400">
              Customize how telemetry, cookies, and diagnostic metrics are handled for your browser session.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Essential Cookies */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-[#11181c] border border-[#1f2b30]">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-white">Strictly Necessary Cookies</span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/40">
                  Always Active
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Required for authentication, session tokens, CSRF validation, and basic security operations.
              </p>
            </div>
            <div className="shrink-0 text-xs text-zinc-500 font-mono">
              Enforced
            </div>
          </div>

          {/* Analytics Cookies */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-[#11181c] border border-[#1f2b30]">
            <div className="space-y-1">
              <span className="text-sm font-medium text-white">Product Performance & Analytics</span>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Allows aggregated measurements of platform responsiveness, CLI invocation rates, and documentation visits.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                checked={analyticsEnabled}
                onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>

          {/* Scanner Telemetry */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-lg bg-[#11181c] border border-[#1f2b30]">
            <div className="space-y-1">
              <span className="text-sm font-medium text-white">Scanner Engine Telemetry</span>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Collects anonymized crash reports, scanner exit codes, and rule timing to improve SAST detection rates.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer shrink-0 mt-1">
              <input
                type="checkbox"
                checked={telemetryEnabled}
                onChange={(e) => setTelemetryEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
            </label>
          </div>
        </div>

        <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={handleSavePreferences}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-emerald-500 hover:bg-emerald-600 text-black font-semibold text-xs transition-colors shadow-sm"
          >
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
          <span className="text-xs text-zinc-500">
            Preferences apply to this browser and synced account profiles.
          </span>
        </div>
      </div>

      {/* Data Subject Action Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
        <div className="p-4 rounded-lg border border-[#233137] bg-[#0c1316] space-y-2">
          <div className="flex items-center gap-2 text-white font-medium text-sm">
            <Download className="w-4 h-4 text-emerald-400" />
            <span>Export Your Data</span>
          </div>
          <p className="text-xs text-zinc-400">
            Download a machine-readable archive of your workspace findings, scan histories, and team member logs.
          </p>
          <button
            onClick={() => toast.info('Export request queued. You will receive an email archive link.')}
            className="text-xs text-emerald-400 hover:underline inline-block pt-1"
          >
            Request Full Archive →
          </button>
        </div>

        <div className="p-4 rounded-lg border border-[#233137] bg-[#0c1316] space-y-2">
          <div className="flex items-center gap-2 text-white font-medium text-sm">
            <Trash2 className="w-4 h-4 text-red-400" />
            <span>Erasure & Deletion</span>
          </div>
          <p className="text-xs text-zinc-400">
            Submit a GDPR / CCPA right-to-erasure ticket to purge all personal identifiers and historical workspaces.
          </p>
          <button
            onClick={() => toast.info('Contact privacy@vulnix.com with your registered organization ID.')}
            className="text-xs text-red-400 hover:underline inline-block pt-1"
          >
            Submit Erasure Request →
          </button>
        </div>
      </div>
    </LegalDocumentView>
  )
}
