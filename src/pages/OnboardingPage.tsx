import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { useAuth } from '../features/auth/AuthProvider'

export function OnboardingPage() {
  const { isHandleAvailable, completeOnboarding } = useAuth()
  const navigate = useNavigate()
  const [handle, setHandle] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [consent, setConsent] = useState(false)
  const [availability, setAvailability] = useState<'idle' | 'checking' | 'available' | 'taken' | 'error'>('idle')
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const normalized = handle.trim().toLowerCase()
    if (!normalized) { setAvailability('idle'); setAvailabilityError(null); return }
    setAvailability('checking')
    setAvailabilityError(null)
    const timer = window.setTimeout(() => {
      void isHandleAvailable(normalized)
        .then((available) => setAvailability(available ? 'available' : 'taken'))
        .catch((checkError: unknown) => {
          setAvailability('error')
          setAvailabilityError(checkError instanceof Error ? checkError.message : 'Unable to check handle availability.')
        })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [handle, isHandleAvailable])

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    let available: boolean
    try {
      available = await isHandleAvailable(handle)
    } catch (submitError) {
      return setError(submitError instanceof Error ? submitError.message : 'Unable to check handle availability.')
    }
    if (!available) return setError('Choose an available handle.')
    if (!ageConfirmed || !consent) return setError('Confirm that you are 18+ and accept both legal documents.')
    try {
      if (!displayName.trim()) return setError('Enter your name.')
      await completeOnboarding({ handle: handle.trim().toLowerCase(), displayName: displayName.trim(), ageConfirmed, termsVersion: '2026-01', privacyVersion: '2026-01' })
      navigate('/', { replace: true })
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to save onboarding')
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center justify-center p-6">
      <form className="w-full rounded-xl border border-border bg-card p-6" onSubmit={(event) => void submit(event)}>
        <p className="text-sm font-semibold text-primary">Almost there</p>
        <h1 className="mt-2 text-2xl font-semibold">Create your ShopReel profile</h1>
        <label className="mt-6 block text-sm font-medium" htmlFor="display-name">Your name</label>
        <input id="display-name" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="How should we call you?" required className="mt-2 min-h-11 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-ring" />
        <label className="mt-6 block text-sm font-medium" htmlFor="handle">Unique handle</label>
        <input id="handle" value={handle} onChange={(event) => setHandle(event.target.value.toLowerCase())} placeholder="your_handle" pattern="[a-z0-9_]{3,20}" autoComplete="username" required className="mt-2 min-h-11 w-full rounded-md border bg-background px-3 outline-none focus:ring-2 focus:ring-ring" />
        <p className="mt-2 text-xs text-muted-foreground" aria-live="polite">{availability === 'checking' ? 'Checking availability…' : availability === 'available' ? 'Handle is available.' : availability === 'taken' ? 'That handle is unavailable.' : availability === 'error' ? availabilityError ?? 'Could not check availability. Please try again.' : '3–20 lowercase letters, numbers, or underscores.'}</p>
        <label className="mt-6 flex gap-3 text-sm"><input type="checkbox" checked={ageConfirmed} onChange={(event) => setAgeConfirmed(event.target.checked)} /> I confirm that I am 18 or older.</label>
        <label className="mt-4 flex gap-3 text-sm"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /> I agree to the <a className="text-primary underline" href="/terms">Terms</a> and <a className="text-primary underline" href="/privacy">Privacy Policy</a>.</label>
        <Button className="mt-6 w-full" type="submit">Finish setup</Button>
        {error && <p role="alert" className="mt-4 text-sm text-red-400">{error}</p>}
      </form>
    </main>
  )
}
