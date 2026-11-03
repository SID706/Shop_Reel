import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { authFeatures, useAuth } from '../features/auth/AuthProvider'
import { ArrowRight, Check, LockKeyhole, Sparkles } from 'lucide-react'

export function LoginPage() {
  const { loading, session, profile, signInWithGoogle } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!loading && session) navigate(profile ? '/' : '/onboarding', { replace: true })
  }, [loading, navigate, profile, session])

  if (loading || session) return <main className="grid min-h-dvh place-items-center p-6 text-sm text-muted-foreground">Opening ShopReel…</main>

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
    <main className="relative min-h-dvh overflow-hidden bg-[#090b0d] px-5 py-8 text-white">
      <div className="pointer-events-none absolute -left-24 -top-24 size-72 rounded-full bg-amber-300/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 size-80 rounded-full bg-rose-500/10 blur-3xl" />
      <section className="relative mx-auto flex min-h-[calc(100dvh-4rem)] max-w-md flex-col justify-between">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><span className="grid size-10 place-items-center rounded-2xl bg-amber-300 text-black"><Sparkles size={20} /></span><span className="text-lg font-semibold tracking-tight">ShopReel</span></div>
          <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-white/45">Discover better</span>
        </div>
        <div className="py-12">
          <div className="mb-7 grid grid-cols-3 gap-2">
            {['Find your next favorite', 'Save the good stuff', 'Shop with confidence'].map((text, index) => <div key={text} className="rounded-2xl border border-white/10 bg-white/[0.05] p-3"><span className="grid size-7 place-items-center rounded-full bg-white/10 text-xs text-amber-200">{index + 1}</span><p className="mt-3 text-xs leading-4 text-white/65">{text}</p></div>)}
          </div>
          <p className="text-sm font-semibold text-amber-200">Your visual shopping world</p>
          <h1 className="mt-3 text-4xl font-semibold leading-[1.05] tracking-tight">Discover things worth adding to your bag.</h1>
          <p className="mt-4 max-w-sm text-sm leading-6 text-white/50">Watch honest product reels from creators you’ll love, then save your best finds in one place.</p>
          <Button className="mt-8 min-h-14 w-full rounded-2xl bg-white text-black shadow-xl shadow-amber-300/10 hover:bg-white/90" onClick={() => void handleGoogleLogin()} disabled={!authFeatures.google}>
            <span className="mr-3 grid size-7 place-items-center rounded-full bg-black text-xs font-bold text-white">G</span>
            Continue with Google
            <ArrowRight size={18} className="ml-auto" />
          </Button>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-white/35"><LockKeyhole size={13} /> Secure sign-in powered by Google</div>
          {error && <p role="alert" className="mt-4 rounded-xl border border-rose-400/20 bg-rose-400/10 p-3 text-sm text-rose-200">{error}</p>}
        </div>
        <div className="border-t border-white/10 pt-5 text-xs text-white/35">
          <p className="mb-3">More ways to sign in are coming soon.</p>
          <div className="flex gap-4"><span><Check size={13} className="mr-1 inline text-amber-300" />Email later</span><span><Check size={13} className="mr-1 inline text-amber-300" />Phone later</span><span><Check size={13} className="mr-1 inline text-amber-300" />WhatsApp later</span></div>
        </div>
      </section>
    </main>
  )
}
