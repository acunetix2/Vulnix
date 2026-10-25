import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AlertCircle, MailCheck, RotateCw } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../contexts/AuthContext'
import { Button } from '../components/ui/button'
import { Spinner } from '../components/app/Spinner'

const API_BASE = '/api/v1'

/**
 * Transient redirect screen: one calm progress state, one honest success state,
 * one honest failure state the user can act on. No decorative motion.
 */
function CallbackFrame({ children }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-5 py-10">
      <div className="mx-auto w-full max-w-sm text-center">{children}</div>
    </main>
  )
}

export function AuthCallback() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [error, setError] = useState(null)
  const [confirmed, setConfirmed] = useState(false)
  // A callback URL carries a single-use code, so the exchange must run exactly
  // once even if this screen re-renders or React double-invokes effects in dev.
  const hasRunRef = useRef(false)

  const loginWithToken = useCallback(
    async (accessToken, refreshToken, successMsg) => {
      const response = await fetch(`${API_BASE}/auth/confirm-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_token: accessToken, refresh_token: refreshToken || '' }),
      })
      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new Error(errorData?.detail || 'Could not validate session')
      }
      const data = await response.json()
      login(data.access_token, data.user)
      toast.success('Welcome to Vulnix!', { description: successMsg })
      navigate('/app/dashboard', { replace: true })
    },
    [login, navigate]
  )

  const handleCallback = useCallback(async () => {
    try {
      const searchStr = window.location.search
      const hashStr = window.location.hash.replace(/^#/, '')
      const params = new URLSearchParams(searchStr)
      const hashParams = new URLSearchParams(hashStr)
      const code = params.get('code')
      const errorDescription =
        params.get('error_description') ||
        hashParams.get('error_description') ||
        params.get('error') ||
        hashParams.get('error')

      if (errorDescription) {
        throw new Error(decodeURIComponent(errorDescription))
      }

      const provider = sessionStorage.getItem('oauth_provider')
      const redirectUri = sessionStorage.getItem('oauth_redirect_uri')

      // Case 1: Implicit flow — Supabase put tokens in the URL hash.
      // Covers OAuth (google/github) and email-confirmation redirects.
      const implicitToken = hashParams.get('access_token')
      if (implicitToken) {
        const implicitType = hashParams.get('type')
        const refreshToken = hashParams.get('refresh_token') || ''
        // Strip tokens from the address bar so they don't linger
        window.history.replaceState(null, '', window.location.pathname)

        if (implicitType === 'signup' || implicitType === 'recovery' || implicitType === 'invite') {
          // Email confirmation landed here
          const response = await fetch(`${API_BASE}/auth/confirm-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_token: implicitToken, refresh_token: refreshToken }),
          })
          if (!response.ok) {
            const errorData = await response.json().catch(() => null)
            throw new Error(errorData?.detail || 'Email confirmation failed')
          }
          const data = await response.json()
          login(data.access_token, data.user)
          setConfirmed(true)
          toast.success('Email confirmed!', { description: 'Welcome to Vulnix! Your account is ready.' })
          setTimeout(() => navigate('/app/dashboard', { replace: true }), 1200)
          return
        }

        // OAuth implicit flow (no type= param, or provider stored before redirect)
        sessionStorage.removeItem('oauth_provider')
        sessionStorage.removeItem('oauth_redirect_uri')
        await loginWithToken(
          implicitToken,
          refreshToken,
          provider ? `Signed in successfully with ${provider}` : 'Signed in successfully'
        )
        return
      }

      // Case 2: PKCE / authorization-code flow — exchange ?code= for a session
      if (code) {
        if (provider && redirectUri) {
          // OAuth with PKCE
          const response = await fetch(`${API_BASE}/auth/oauth/callback`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider, code, redirect_uri: redirectUri }),
          })
          if (!response.ok) {
            const errorData = await response.json().catch(() => null)
            throw new Error(errorData?.detail || 'OAuth callback failed')
          }
          const data = await response.json()
          sessionStorage.removeItem('oauth_provider')
          sessionStorage.removeItem('oauth_redirect_uri')
          login(data.access_token, data.user)
          toast.success('Welcome to Vulnix!', { description: `Signed in successfully with ${provider}` })
          navigate('/app/dashboard', { replace: true })
          return
        }

        // Email confirmation (PKCE)
        const confirmRedirect = `${window.location.origin}/auth/callback`
        const response = await fetch(`${API_BASE}/auth/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, redirect_uri: confirmRedirect }),
        })
        if (!response.ok) {
          const errorData = await response.json().catch(() => null)
          throw new Error(errorData?.detail || 'Email confirmation failed')
        }
        const data = await response.json()
        login(data.access_token, data.user)
        setConfirmed(true)
        toast.success('Email confirmed!', { description: 'Welcome to Vulnix! Your account is ready.' })
        setTimeout(() => navigate('/app/dashboard', { replace: true }), 1200)
        return
      }

      throw new Error('No authorization code or session token received from the provider')
    } catch (err) {
      console.error('Auth callback error:', err)
      sessionStorage.removeItem('oauth_provider')
      sessionStorage.removeItem('oauth_redirect_uri')
      setError(err.message || 'Authentication failed')

      toast.error('Authentication failed', {
        description: err.message || 'Unable to complete sign in. Please try again.'
      })
    }
  }, [login, loginWithToken, navigate])

  useEffect(() => {
    if (hasRunRef.current) return
    hasRunRef.current = true
    handleCallback()
  }, [handleCallback])

  const handleRetry = () => {
    setError(null)
    handleCallback()
  }

  if (confirmed) {
    return (
      <CallbackFrame>
        <div role="status" aria-live="polite" className="flex flex-col items-center">
          <span className="mb-4 grid size-11 place-items-center rounded-lg bg-primary-subtle text-primary">
            <MailCheck className="size-5" aria-hidden />
          </span>
          <h1 className="text-base font-semibold text-foreground">Email confirmed</h1>
          <p className="mt-1 text-sm text-muted-foreground">Taking you to your dashboard…</p>
        </div>
      </CallbackFrame>
    )
  }

  if (error) {
    return (
      <CallbackFrame>
        <div role="alert" className="flex flex-col items-center">
          <span className="mb-4 grid size-11 place-items-center rounded-lg bg-destructive-subtle text-destructive">
            <AlertCircle className="size-5" aria-hidden />
          </span>
          <h1 className="text-base font-semibold text-foreground">We couldn’t finish signing you in</h1>
          <p className="mt-1 text-sm text-destructive">{error}</p>
          <div className="mt-5 flex w-full flex-col gap-2">
            <Button type="button" size="lg" block onClick={handleRetry}>
              <RotateCw data-icon="inline-start" />
              Try again
            </Button>
            <Button type="button" variant="outline" size="lg" block render={<Link to="/signin" />}>
              Back to sign in
            </Button>
          </div>
        </div>
      </CallbackFrame>
    )
  }

  return (
    <CallbackFrame>
      <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
        <Spinner className="size-6" />
        <div>
          <h1 className="text-base font-semibold text-foreground">Completing sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Please wait while we authenticate your account.
          </p>
        </div>
      </div>
    </CallbackFrame>
  )
}
