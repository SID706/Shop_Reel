import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

export const authFeatures = {
  google: true,
  emailOtp: false,
  phoneOtp: false,
} as const

type Profile = {
  id: string
  handle: string
  display_name: string
}

type AuthContextValue = {
  loading: boolean
  session: Session | null
  profile: Profile | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  isHandleAvailable: (handle: string) => Promise<boolean>
  completeOnboarding: (input: {
    handle: string
    ageConfirmed: boolean
    termsVersion: string
    privacyVersion: string
  }) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)
const mockStorageKey = 'shopreel.mock-auth'
const mockSessionKey = 'shopreel.mock-session'
const mockProfileKey = 'shopreel.mock-profile'

function mockEnabled() {
  return import.meta.env.DEV && (
    import.meta.env.VITE_AUTH_MOCK === 'true' ||
    Boolean(localStorage.getItem(mockStorageKey))
  )
}

function mockSessionEnabled() {
  return Boolean(localStorage.getItem(mockSessionKey) || localStorage.getItem(mockProfileKey))
}

function mockUser(): User {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    aud: 'authenticated',
    role: 'authenticated',
    email: 'mock@example.com',
    app_metadata: {},
    user_metadata: { full_name: 'Mock Shopper' },
    created_at: new Date(0).toISOString(),
  } as User
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)

  useEffect(() => {
    let active = true

    async function load() {
      if (mockEnabled() && mockSessionEnabled()) {
        const savedProfile = localStorage.getItem(mockProfileKey)
        if (active) {
          setSession({ user: mockUser(), access_token: 'mock-token', token_type: 'bearer', expires_in: 3600, refresh_token: 'mock-refresh' })
          try {
            setProfile(savedProfile ? JSON.parse(savedProfile) as Profile : null)
          } catch {
            localStorage.removeItem(mockProfileKey)
            setProfile(null)
          }
          setLoading(false)
        }
        return
      }

      if (!supabase) {
        setLoading(false)
        return
      }

      const { data } = await supabase.auth.getSession()
      if (active) {
        setSession(data.session)
        setLoading(false)
      }
      const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession)
        if (!nextSession) setProfile(null)
      })
      return () => listener.subscription.unsubscribe()
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!session || mockEnabled()) return
    void supabase?.from('profiles').select('id, handle, display_name').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setProfile(data))
  }, [session])

  const isHandleAvailable = useCallback(async (handle: string) => {
    const normalized = handle.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,20}$/.test(normalized)) return false
    if (mockEnabled()) return normalized !== 'taken' && !profile?.handle
    const { data, error } = await supabase?.rpc('is_handle_available', { requested_handle: normalized }) ?? { data: false, error: new Error('Supabase is not configured') }
    if (error) throw error
    return data === true
  }, [profile])

  const completeOnboarding = useCallback(async (input: {
    handle: string
    ageConfirmed: boolean
    termsVersion: string
    privacyVersion: string
  }) => {
    if (!session) throw new Error('You must be signed in')
    if (mockEnabled()) {
      const nextProfile = { id: session.user.id, handle: input.handle.trim().toLowerCase(), display_name: session.user.user_metadata.full_name ?? '' }
      localStorage.setItem(mockProfileKey, JSON.stringify(nextProfile))
      setProfile(nextProfile)
      return
    }
    const { error } = await supabase?.rpc('complete_onboarding', {
      requested_handle: input.handle.trim().toLowerCase(),
      confirm_age: input.ageConfirmed,
      terms_version: input.termsVersion,
      privacy_version: input.privacyVersion,
    }) ?? { error: new Error('Supabase is not configured') }
    if (error) throw error
    setProfile({ id: session.user.id, handle: input.handle.trim().toLowerCase(), display_name: session.user.user_metadata.full_name ?? '' })
  }, [session])

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    session,
    profile,
    async signInWithGoogle() {
      if (mockEnabled()) {
        localStorage.setItem(mockStorageKey, 'true')
        localStorage.setItem(mockSessionKey, 'true')
        setSession({ user: mockUser(), access_token: 'mock-token', token_type: 'bearer', expires_in: 3600, refresh_token: 'mock-refresh' })
        return
      }
      if (!supabase) throw new Error('Supabase is not configured')
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/login` },
      })
      if (error) throw error
    },
    async signOut() {
      if (mockEnabled()) {
        localStorage.removeItem(mockStorageKey)
        localStorage.removeItem(mockSessionKey)
        localStorage.removeItem(mockProfileKey)
        setSession(null)
        setProfile(null)
        return
      }
      const { error } = await supabase?.auth.signOut() ?? { error: new Error('Supabase is not configured') }
      if (error) throw error
    },
    isHandleAvailable,
    completeOnboarding,
  }), [completeOnboarding, isHandleAvailable, loading, profile, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
