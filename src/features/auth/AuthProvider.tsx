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
  avatar_url: string | null
  bio: string
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
    displayName: string
    ageConfirmed: boolean
    termsVersion: string
    privacyVersion: string
  }) => Promise<void>
  updateProfile: (input: {
    displayName: string
    avatarUrl: string | null
    bio: string
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

    async function loadProfile(userId: string) {
      if (!supabase) return null
      const { data } = await supabase.from('profiles').select('id, handle, display_name, avatar_url, bio').eq('id', userId).maybeSingle()
      return data
    }

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
        if (data.session) setProfile(await loadProfile(data.session.user.id))
        setLoading(false)
      }
      const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession)
        if (!nextSession) {
          setProfile(null)
          return
        }
        void loadProfile(nextSession.user.id).then((nextProfile) => {
          if (active) setProfile(nextProfile)
        })
      })
      return () => listener.subscription.unsubscribe()
    }

    void load()
    return () => {
      active = false
    }
  }, [])

  const isHandleAvailable = useCallback(async (handle: string) => {
    const normalized = handle.trim().toLowerCase()
    if (!/^[a-z0-9_]{3,20}$/.test(normalized)) return false
    if (mockEnabled()) return normalized !== 'taken' && !profile?.handle
    const { data, error } = await supabase?.rpc('is_handle_available', { requested_handle: normalized }) ?? { data: false, error: new Error('Supabase is not configured') }
    if (error) {
      if ('code' in error && error.code === 'PGRST202') {
        throw new Error('Supabase database setup is incomplete. Apply the ShopReel migrations, then refresh this page.')
      }
      throw error
    }
    return data === true
  }, [profile])

  const completeOnboarding = useCallback(async (input: {
    handle: string
    displayName: string
    ageConfirmed: boolean
    termsVersion: string
    privacyVersion: string
  }) => {
    if (!session) throw new Error('You must be signed in')
    if (mockEnabled()) {
      const nextProfile = { id: session.user.id, handle: input.handle.trim().toLowerCase(), display_name: input.displayName.trim(), avatar_url: null, bio: '' }
      localStorage.setItem(mockProfileKey, JSON.stringify(nextProfile))
      setProfile(nextProfile)
      return
    }
    if (!supabase) throw new Error('Supabase is not configured')
    const { error: metadataError } = await supabase.auth.updateUser({ data: { full_name: input.displayName.trim() } })
    if (metadataError) throw metadataError
    const { error } = await supabase.rpc('complete_onboarding', {
      requested_handle: input.handle.trim().toLowerCase(),
      confirm_age: input.ageConfirmed,
      terms_version: input.termsVersion,
      privacy_version: input.privacyVersion,
    }) ?? { error: new Error('Supabase is not configured') }
    if (error) throw error
    setProfile({ id: session.user.id, handle: input.handle.trim().toLowerCase(), display_name: input.displayName.trim(), avatar_url: null, bio: '' })
  }, [session])

  const updateProfile = useCallback(async (input: {
    displayName: string
    avatarUrl: string | null
    bio: string
  }) => {
    if (!session) throw new Error('You must be signed in')
    if (mockEnabled()) {
      const nextProfile = { ...(profile ?? { id: session.user.id, handle: '' }), display_name: input.displayName.trim(), avatar_url: input.avatarUrl, bio: input.bio }
      localStorage.setItem(mockProfileKey, JSON.stringify(nextProfile))
      setProfile(nextProfile)
      return
    }
    if (!supabase) throw new Error('Supabase is not configured')
    const { data, error } = await supabase.rpc('update_profile', {
      requested_display_name: input.displayName.trim(),
      requested_avatar_url: input.avatarUrl,
      requested_bio: input.bio,
    })
    if (error) throw error
    setProfile(data)
  }, [profile, session])

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
    updateProfile,
  }), [completeOnboarding, isHandleAvailable, loading, profile, session, updateProfile])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside AuthProvider')
  return value
}
