import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { api } from '../services/api'
import { integrationErrorText } from '../lib/integrations'

/**
 * One place to learn what a provider can do here and who is connected to it.
 *
 * The console never handles a token: `connect` hands the browser to the
 * provider's own window, and the only thing that comes back is a redirect with
 * a result flag on it. Everything below reads that result rather than a
 * credential.
 */
export function useOAuth(provider, workspaceId) {
  const [state, setState] = useState({ loading: true, error: null, capability: null, connection: null })
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }))
      if (!workspaceId) {
        setState({ loading: false, error: null, capability: null, connection: null })
        return
      }
      try {
        // Both lists are cheap and cover every provider, so one round trip answers
        // "can I offer Connect" and "did somebody already use it".
        const [providers, connections] = await Promise.all([
          api.getProviderCapabilities(workspaceId),
          api.getConnections(workspaceId),
        ])
        if (cancelled) return
        const capability = (providers || []).find((row) => row.provider === provider) || null
        const connection = (connections || []).find((row) => row.provider === provider) || null
        setState({ loading: false, error: null, capability, connection })
      } catch (error) {
        if (cancelled) return
        setState({ loading: false, error: integrationErrorText(error), capability: null, connection: null })
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [provider, workspaceId, attempt])

  const refresh = useCallback(() => setAttempt((count) => count + 1), [])

  async function connect() {
    setBusy(true)
    try {
      const result = await api.startConnect(workspaceId, provider)
      // A full navigation, not a popup: providers block popups, and the callback
      // redirects the top frame back to this page anyway.
      window.location.assign(result.authorize_url)
    } catch (error) {
      toast.error('Could not start the connection', { description: integrationErrorText(error) })
      setBusy(false)
    }
  }

  async function disconnect() {
    setBusy(true)
    try {
      await api.disconnect(workspaceId, provider)
      refresh()
      toast.success('Disconnected', {
        description: 'Vulnix forgets the approval and will not reach that account again.',
      })
    } catch (error) {
      toast.error('Could not disconnect', { description: integrationErrorText(error) })
    } finally {
      setBusy(false)
    }
  }

  return { ...state, busy, refresh, connect, disconnect }
}

/**
 * The provider's redirect lands here with `?connected=1` or `?oauth_error=…`.
 * Say which happened, once, then take the flag off the address so a reload does
 * not repeat the claim.
 */
export function useOAuthReturnNotice(provider) {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  useEffect(() => {
    const connected = params.get('connected')
    const failure = params.get('oauth_error')
    if (!connected && !failure) return

    if (connected) {
      toast.success(`${labelFor(provider)} connected`, {
        description: 'The approval is stored on the server. Nothing to paste.',
      })
    } else {
      // The failure code is the server's own, so it reads the same sentence the
      // rest of the app uses for the same refusal.
      toast.error(`${labelFor(provider)} was not connected`, {
        description: integrationErrorText({ code: failure }),
      })
    }

    const next = new URLSearchParams(params)
    next.delete('connected')
    next.delete('oauth_error')
    const query = next.toString()
    navigate(query ? `${window.location.pathname}?${query}` : window.location.pathname, {
      replace: true,
    })
    // `params` and `navigate` are stable enough for a one-shot read of the URL,
    // and re-running on their identity would clear the flag before the toast.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider])
}

const LABELS = { slack: 'Slack', jira: 'Jira', github: 'GitHub' }

function labelFor(provider) {
  return LABELS[provider] || 'Integration'
}
