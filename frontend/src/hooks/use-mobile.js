import * as React from "react"

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  // Read the viewport during the first render rather than in an effect, so the
  // value is never `undefined` for a frame and nothing cascades on mount.
  const [isMobile, setIsMobile] = React.useState(
    () => window.innerWidth < MOBILE_BREAKPOINT
  )

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}
