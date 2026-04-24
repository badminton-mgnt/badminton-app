import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext()
const SESSION_MAX_AGE_MS = 30 * 60 * 1000
const SESSION_STARTED_AT_KEY = 'auth_session_started_at'

const getSessionStartedAt = (session) => {
  const signedInAtMs = session?.user?.last_sign_in_at
    ? new Date(session.user.last_sign_in_at).getTime()
    : null

  return Number.isFinite(signedInAtMs) ? signedInAtMs : Date.now()
}

const getStoredSessionStartedAt = () => {
  const raw = localStorage.getItem(SESSION_STARTED_AT_KEY)
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : null
}

const persistSessionStartedAt = (value) => {
  localStorage.setItem(SESSION_STARTED_AT_KEY, String(value))
}

const clearSessionStartedAt = () => {
  localStorage.removeItem(SESSION_STARTED_AT_KEY)
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const isSigningOutRef = useRef(false)

  useEffect(() => {
    let isMounted = true
    let intervalId

    const hasSessionExpired = (startedAt) => Date.now() - startedAt >= SESSION_MAX_AGE_MS

    const forceSignOut = async () => {
      if (isSigningOutRef.current) return

      try {
        isSigningOutRef.current = true
        await supabase.auth.signOut()
      } finally {
        clearSessionStartedAt()
        if (isMounted) {
          setUser(null)
        }
        isSigningOutRef.current = false
      }
    }

    const resolveSessionStartedAt = (session) => {
      const storedStartedAt = getStoredSessionStartedAt()
      const sessionStartedAt = getSessionStartedAt(session)
      const resolvedStartedAt = storedStartedAt ?? sessionStartedAt

      if (storedStartedAt === null) {
        persistSessionStartedAt(resolvedStartedAt)
      }

      return resolvedStartedAt
    }

    const enforceSessionLimit = async (sessionArg) => {
      const session = sessionArg ?? (await supabase.auth.getSession()).data.session

      if (!session) {
        clearSessionStartedAt()
        if (isMounted) {
          setUser(null)
        }
        return
      }

      const sessionStartedAt = resolveSessionStartedAt(session)
      if (hasSessionExpired(sessionStartedAt)) {
        await forceSignOut()
        return
      }

      if (isMounted) {
        setUser(session.user)
      }
    }

    // Check current session
    const checkAuth = async () => {
      try {
        await enforceSessionLimit()
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void checkAuth()

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_OUT') {
          clearSessionStartedAt()
          setUser(null)
          return
        }

        if (event === 'SIGNED_IN' && session) {
          persistSessionStartedAt(getSessionStartedAt(session))
        }

        void enforceSessionLimit(session)
      }
    )

    intervalId = window.setInterval(() => {
      void enforceSessionLimit()
    }, 60 * 1000)

    return () => {
      isMounted = false
      if (intervalId) {
        window.clearInterval(intervalId)
      }
      subscription?.unsubscribe()
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
