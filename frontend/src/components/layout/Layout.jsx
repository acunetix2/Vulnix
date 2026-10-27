import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { CommandPalette } from '../app/CommandPalette'
import { Onboarding } from '../app/Onboarding'
import { FloatingHelp } from '../app/FloatingHelp'
import { VulnixFooter } from '../app/VulnixFooter'
import { useAuth } from '../../contexts/AuthContext'
import { cn } from '../../lib/utils'

/**
 * Consistent canvas for every inner page. Pages pick a width instead of
 * inventing their own max-width + centring, which is what made the console
 * read as two different apps.
 */
const WIDTHS = {
  full: 'max-w-none',
  default: 'max-w-[1400px]',
  wide: 'max-w-[1120px]',
  narrow: 'max-w-[780px]',
}

export function ContentWidth({ width = 'default', className, children }) {
  return <div className={cn('mx-auto w-full', WIDTHS[width], className)}>{children}</div>
}

export function Layout() {
  const { user, refresh } = useAuth()
  // The session object is whatever the sign-in response carried. One read of the
  // profile row is what puts the handle and the picture in the rail — and the
  // onboarding stamp, which is why the sequence only renders once that read lands.
  useEffect(() => {
    refresh()
  }, [refresh])
  const needsOnboarding =
    Boolean(user) && 'onboarding_completed_at' in user && !user.onboarding_completed_at

  // The drawer belongs to the route it was opened from. Comparing against that
  // route means navigation closes it without an effect, and back/forward
  // cannot leave it stranded over an unrelated page.
  const [openedOn, setOpenedOn] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const { pathname } = useLocation()
  const navOpen = openedOn === pathname

  return (
    <div className="min-h-dvh bg-canvas">
      <Sidebar
        isOpen={navOpen}
        onClose={() => setOpenedOn(null)}
      />
      <Header
        onMenuClick={() => setOpenedOn(pathname)}
        onSearchClick={() => setSearchOpen(true)}
      />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />

      <main className="lg:pl-16">
        <div className="console-content mx-auto w-full max-w-[1400px] px-4 pt-20 pb-10 sm:px-5 lg:px-6">
          <Outlet />
        </div>
      </main>
      <div className="lg:pl-16">
        <VulnixFooter banner />
      </div>
      <FloatingHelp />
      {needsOnboarding && <Onboarding me={user} />}
    </div>
  )
}
