import { useState, useEffect, useCallback } from 'react'
import { api } from '../services/api'

const STORAGE_KEY = 'current_workspace'

/**
 * A first visit has to create the workspace every other page reads, and the
 * console mounts several panels at once - each of them sees the empty list
 * before any POST lands, so each used to create its own. Sharing the in-flight
 * creation keeps one account to one personal workspace.
 */
let personalWorkspace = null

function createPersonalWorkspace() {
  if (!personalWorkspace) {
    personalWorkspace = api.createWorkspace('Personal').finally(() => {
      personalWorkspace = null
    })
  }
  return personalWorkspace
}

/**
 * Loads the user's workspaces, auto-creates a "Personal" workspace on first
 * use, and keeps the selection in localStorage. Every page that needs a
 * workspace id should use this instead of re-implementing the fetch.
 */
export function useWorkspace() {
  const [workspaceId, setWorkspaceId] = useState(
    () => localStorage.getItem(STORAGE_KEY)
  )
  const [workspaces, setWorkspaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        let list = await api.getWorkspaces()

        if (!list || list.length === 0) {
          // First visit: give the user a workspace so they can create projects.
          list = [await createPersonalWorkspace()]
        }

        if (cancelled) return

        setWorkspaces(list)

        const stored = localStorage.getItem(STORAGE_KEY)
        const chosen = list.find((w) => w.id === stored) || list[0]
        localStorage.setItem(STORAGE_KEY, chosen.id)
        setWorkspaceId(chosen.id)
        setError(null)
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        setError(err.message || 'Unable to load workspace')
        setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = useCallback(() => {
    setLoading(true)
    setAttempt((a) => a + 1)
  }, [])

  return { workspaceId, workspaces, loading, error, retry }
}
