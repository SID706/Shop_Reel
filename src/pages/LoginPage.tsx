import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { authFeatures, useAuth } from '../features/auth/AuthProvider'

export function LoginPage() {
  const { session, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  if (session) return <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center p-6"><Button onClick={() => navigate('/')}>Continue to ShopReel</Button></main>

  async function handleGoogleLogin() {
    setError(null)
    try {
      await signInWithGoogle()
      if (import.meta.env.DEV && localStorage.getItem('shopreel.mock-auth')) navigate('/onboarding')
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to sign in')
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center p-6">
      <section className="w-full rounded-xl border border-border bg-card p-6">
        <p className="text-sm font-semibold text-primary">ShopReel</p>
        <h1 className="mt-2 text-2xl font-semibold">Sign in to discover</h1>
        <p className="mt-2 text-sm text-muted-foreground">Use your Google account to save creators and build your bag.</p>
        <Button className="mt-6 w-full" onClick={() => void handleGoogleLogin()} disabled={!authFeatures.google}>
          Continue with Google
        </Button>
        <p className="mt-4 text-center text-xs text-muted-foreground">Email OTP and phone OTP are currently disabled.</p>
        {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
      </section>
    </main>
  )
}
