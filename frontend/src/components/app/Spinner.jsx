import { cn } from '../../lib/utils'

/**
 * 8-spoke radial pill spinner matching modern iOS/Apple loading design.
 * Features 8 rounded capsule spokes arranged radially with progressive
 * trailing opacity and smooth continuous rotation.
 */
const SPOKES = [
  { rotate: 0, opacity: 1 },
  { rotate: 45, opacity: 0.88 },
  { rotate: 90, opacity: 0.75 },
  { rotate: 135, opacity: 0.62 },
  { rotate: 180, opacity: 0.49 },
  { rotate: 225, opacity: 0.36 },
  { rotate: 270, opacity: 0.24 },
  { rotate: 315, opacity: 0.15 },
]

export function Spinner({ className, label = 'Loading' }) {
  return (
    <svg
      viewBox="0 0 24 24"
      role="status"
      aria-label={label}
      fill="none"
      className={cn(
        'size-5 shrink-0 animate-spin text-primary [animation-duration:0.8s]',
        className
      )}
    >
      {SPOKES.map(({ rotate, opacity }) => (
        <line
          key={rotate}
          x1="12"
          y1="3.2"
          x2="12"
          y2="6.8"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity={opacity}
          transform={`rotate(${rotate} 12 12)`}
        />
      ))}
    </svg>
  )
}
