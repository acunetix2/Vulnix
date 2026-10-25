import { Link, useNavigate } from 'react-router-dom'
import { VulnixLogo } from '../components/VulnixLogo'

export function NotFound() {
  const navigate = useNavigate()

  return (
    <div className="relative min-h-screen w-full bg-[#06080e] text-slate-100 flex flex-col justify-between overflow-hidden selection:bg-[#00dc82]/30 selection:text-[#00dc82]">
      {/* Top Left Brand Header */}
      <header className="relative z-20 w-full px-6 py-6 sm:px-10">
        <Link to="/" className="inline-flex items-center gap-2.5 group">
          <VulnixLogo className="size-8 w-auto rounded-full" />
          <span className="text-xl font-bold tracking-tight text-white group-hover:text-slate-200 transition-colors">
            Vulnix
          </span>
        </Link>
      </header>

      {/* Main Center Area with Giant Background 404 */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
        {/* Giant subtle 404 backdrop matching Image 2 */}
        <div
          className="pointer-events-none absolute inset-0 flex items-center justify-center select-none"
          aria-hidden
        >
          <span className="font-mono text-[16rem] sm:text-[22rem] md:text-[28rem] font-bold tracking-tighter text-white/[0.035] leading-none">
            404
          </span>
        </div>

        {/* Foreground Content */}
        <div className="relative z-20 flex flex-col items-center text-center max-w-md">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white flex items-center justify-center gap-2">
            Looking for something? <span role="img" aria-label="magnifying glass">🔍</span>
          </h1>
          <p className="mt-2.5 mb-7 text-sm sm:text-base text-slate-400 leading-relaxed">
            We couldn’t find the page that you’re looking for!
          </p>

          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))}
            className="rounded-lg bg-[#00dc82] px-6 py-2.5 text-sm font-semibold text-[#042412] hover:bg-[#00c575] transition-all shadow-[0_0_25px_rgba(0,220,130,0.25)] hover:shadow-[0_0_35px_rgba(0,220,130,0.4)] active:scale-[0.98]"
          >
            Head back
          </button>

          {/* Underneath links matching Image 2 */}
          <div className="mt-9 flex items-center gap-3 text-xs text-slate-500">
            <Link
              to="/docs"
              className="hover:text-slate-300 underline underline-offset-4 decoration-slate-700 hover:decoration-slate-400 transition-colors"
            >
              Documentation
            </Link>
            <span className="text-slate-700">·</span>
            <Link
              to="/resources/status"
              className="hover:text-slate-300 underline underline-offset-4 decoration-slate-700 hover:decoration-slate-400 transition-colors"
            >
              System status
            </Link>
            <span className="text-slate-700">·</span>
            <Link
              to="/resources/support"
              className="hover:text-slate-300 underline underline-offset-4 decoration-slate-700 hover:decoration-slate-400 transition-colors"
            >
              Support
            </Link>
          </div>
        </div>
      </div>

      {/* Spacer for vertical balance */}
      <div className="h-12 pointer-events-none" aria-hidden />
    </div>
  )
}

export default NotFound
