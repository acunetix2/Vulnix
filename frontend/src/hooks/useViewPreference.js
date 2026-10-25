import { useState } from 'react'

function readPreference(key) {
  try {
    return localStorage.getItem(key) === 'list' ? 'list' : 'grid'
  } catch {
    return 'grid'
  }
}

export function useViewPreference(key) {
  const [view, setView] = useState(() => readPreference(key))

  function setViewPreference(next) {
    setView(next)
    try {
      localStorage.setItem(key, next)
    } catch {
      // Keep the current view even if the browser cannot persist preferences.
    }
  }

  return [view, setViewPreference]
}
