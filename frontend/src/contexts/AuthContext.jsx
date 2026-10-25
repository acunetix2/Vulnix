import { createContext, useCallback, useContext, useState } from 'react'
import { api, clearApiCache } from '../services/api'

const AuthContext = createContext(null)

/**
 * The stored session is read synchronously on the first render, so there is no
 * authentication "still loading" phase to render a spinner for.
 */
function readStoredSession() {
  const token = localStorage.getItem('auth_token')
  const userData = localStorage.getItem('user_data')

  if (token && userData) {
    try {
      return JSON.parse(userData)
    } catch {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('user_data')
    }
  }

  return null
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredSession)
  const loading = false

  const login = useCallback((token, userData) => {
    // Whoever read these rows before is not the person reading them now.
    clearApiCache()
    // The chosen workspace belongs to the account, not to the browser. Leaving
    // the previous one behind aims the first read at somebody else's rows.
    localStorage.removeItem('current_workspace')
    localStorage.setItem('auth_token', token)
    localStorage.setItem('user_data', JSON.stringify(userData))
    setUser(userData)
  }, [])

  const logout = useCallback(() => {
    clearApiCache()
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user_data')
    localStorage.removeItem('current_workspace')
    setUser(null)
  }, [])

  /**
   * The token says who is calling; the profile row says what to show them.
   * Re-reading it is what makes a rename appear in the header without a reload.
   */
  const refresh = useCallback(async () => {
    if (!localStorage.getItem('auth_token')) return null
    try {
      const me = await api.getMe()
      localStorage.setItem('user_data', JSON.stringify(me))
      setUser(me)
      return me
    } catch {
      // One failed read must not sign nobody out; the stored identity stays.
      return null
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, login, logout, refresh, loading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
