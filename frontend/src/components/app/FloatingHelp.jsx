import { CircleHelp } from 'lucide-react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/utils'

export function FloatingHelp({ dark = false }) {
  return (
    <Link
      to="/help"
      aria-label="Get help"
      title="Get help"
      className={cn(
        'fixed right-5 bottom-5 z-40 inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold shadow-lg',
        'transition-[transform,background-color,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.97]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        dark
          ? 'bg-[#00dc82] text-[#07120d] hover:bg-[#34e99b]'
          : 'bg-primary text-primary-foreground hover:bg-primary-hover'
      )}
    >
      <CircleHelp className="size-5" aria-hidden />
      <span>Help</span>
    </Link>
  )
}
