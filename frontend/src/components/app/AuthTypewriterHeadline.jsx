import { useEffect, useState } from 'react'

export function AuthTypewriterHeadline({ phrases, accent }) {
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [characterCount, setCharacterCount] = useState(0)
  const [deleting, setDeleting] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updatePreference = () => setReducedMotion(media.matches)
    media.addEventListener('change', updatePreference)
    return () => media.removeEventListener('change', updatePreference)
  }, [])

  useEffect(() => {
    if (reducedMotion || phrases.length < 2) return undefined

    const phrase = phrases[phraseIndex]
    let delay
    if (!deleting && characterCount < phrase.length) {
      delay = 58
    } else if (!deleting) {
      delay = 1450
    } else if (characterCount > 0) {
      delay = 27
    } else {
      delay = 280
    }

    const timeout = window.setTimeout(() => {
      if (!deleting && characterCount < phrase.length) {
        setCharacterCount((count) => count + 1)
      } else if (!deleting) {
        setDeleting(true)
      } else if (characterCount > 0) {
        setCharacterCount((count) => count - 1)
      } else {
        setPhraseIndex((index) => (index + 1) % phrases.length)
        setDeleting(false)
      }
    }, delay)

    return () => window.clearTimeout(timeout)
  }, [characterCount, deleting, phraseIndex, phrases, reducedMotion])

  const phrase = phrases[phraseIndex] || ''
  const visibleText = reducedMotion ? phrases[0] || '' : phrase.slice(0, characterCount)

  return (
    <h1 className="auth-copy-enter auth-copy-delay-1 max-w-2xl text-4xl font-semibold leading-[1.08] tracking-tight text-white sm:text-5xl xl:text-6xl">
      <span className="block min-h-[1.15em]" aria-live="off">
        {visibleText}
        {!reducedMotion && (
          <span
            aria-hidden="true"
            className="ml-1 inline-block h-[0.85em] w-[2px] translate-y-1 bg-[#00dc82] motion-safe:animate-pulse"
          />
        )}
      </span>
      <span className="mt-2 block text-[#00dc82]">{accent}</span>
    </h1>
  )
}
