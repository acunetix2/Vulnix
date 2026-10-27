import { Link } from 'react-router-dom'
import { VulnixLogo } from '../VulnixLogo'
import { VulnixLegalGraphicBanner } from '../../pages/landing/legal/VulnixLegalGraphicBanner'
import { cn } from '../../lib/utils'

const FOOTER_LINKS = [
  { label: 'Help Center', to: '/help' },
  { label: 'Terms', to: '/legal/terms' },
  { label: 'Privacy', to: '/legal/privacy' },
  { label: 'Security', to: '/resources/security' },
  { label: 'Status', to: '/resources/status' },
  { label: 'Community', to: '/community/events' },
  { label: 'Docs', to: '/docs' },
  { label: 'Contact', to: '/resources/support' },
]

export function VulnixFooter({ dark = false, banner = false, className }) {
  const year = new Date().getFullYear()

  return (
    <footer
      className={cn(
        'border-t px-4 py-5 sm:px-6',
        dark ? 'border-slate-800/80 text-slate-400' : 'border-border text-muted-foreground',
        className
      )}
    >
      {banner && <VulnixLegalGraphicBanner />}

      <div className="mx-auto flex w-full max-w-[1120px] flex-col items-center justify-between gap-4 sm:flex-row">
        <div className="flex items-center gap-3 text-xs">
          <Link
            to="/"
            aria-label="Vulnix home"
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-full transition-colors',
              dark ? 'hover:bg-white/10' : 'hover:bg-muted'
            )}
          >
            <VulnixLogo className="size-7 rounded-full" />
          </Link>
          <span>© {year} Vulnix. All rights reserved.</span>
        </div>

        <nav aria-label="Footer" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs">
          {FOOTER_LINKS.map(({ label, to }) => (
            <Link
              key={label}
              to={to}
              className={cn(
                'transition-colors',
                dark ? 'hover:text-white' : 'hover:text-foreground'
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
