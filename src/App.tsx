import { createContext, useContext, useState, type FormEvent, type MouseEvent, type ReactNode } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bookmark,
  Check,
  ChevronRight,
  Copy,
  Heart,
  Home,
  ImagePlus,
  Link2,
  LogOut,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Plus,
  Search,
  Send,
  Share,
  Settings,
  Share2,
  Sparkles,
  MessageSquareText,
  UserRound,
  UserRoundPlus,
  Users,
  UserPlus,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react'
import {
  BrowserRouter,
  Link,
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import { cn } from './lib/utils'
import { AuthProvider, useAuth } from './features/auth/AuthProvider'
import { browserVideoProvider } from './features/upload/media'
import { putWithProgress, requestUploadUrl } from './features/upload/uploadApi'
import { LoginPage } from './pages/LoginPage'
import { OnboardingPage } from './pages/OnboardingPage'

type Reel = {
  id: string
  creator: string
  creatorName: string
  product: string
  price: string
  caption: string
  image: string
  accent: string
  tags: string[]
  likes: number
  views: number
}

type Comment = { id: string; author: string; text: string; time: string }

function formatCount(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : String(value)
}

function DemoProvider({ children }: { children: ReactNode }) {
  const [reels, setReels] = useState<Reel[]>([])
  const [liked, setLiked] = useState<string[]>([])
  const [saved, setSaved] = useState<string[]>([])
  const [comments, setComments] = useState<Record<string, Comment[]>>({})

  const toggleLike = (id: string) => {
    setLiked((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }
  const toggleSave = (id: string) => {
    setSaved((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])
  }
  const addComment = (id: string, text: string) => {
    setComments((current) => ({ ...current, [id]: [...(current[id] ?? []), { id: crypto.randomUUID(), author: 'you', text, time: 'now' }] }))
  }
  const addReel = (reel: Reel) => setReels((current) => [reel, ...current])
  return <DemoContext.Provider value={{ reels, liked, saved, comments, toggleLike, toggleSave, addComment, addReel }}>{children}</DemoContext.Provider>
}

type DemoContextValue = {
  reels: Reel[]
  liked: string[]
  saved: string[]
  comments: Record<string, Comment[]>
  toggleLike: (id: string) => void
  toggleSave: (id: string) => void
  addComment: (id: string, text: string) => void
  addReel: (reel: Reel) => void
}
const DemoContext = createContext<DemoContextValue | null>(null)
function useDemo() {
  const context = useContext(DemoContext)
  if (!context) throw new Error('useDemo must be used inside DemoProvider')
  return context
}

function AppLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-black text-white"><div className="mx-auto min-h-dvh w-full max-w-lg border-x border-white/[0.04]">{children}</div><BottomNav /></div>
}

const navItems = [
  { to: '/', label: 'Feed', icon: Home },
  { to: '/wishlist', label: 'Wishlist', icon: Bookmark },
  { to: '/upload', label: 'Create', icon: Plus },
  { to: '/chats', label: 'Chats', icon: MessageCircle },
  { to: '/profile', label: 'Profile', icon: UserRound },
]
function BottomNav() {
  return <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-black/85 px-3 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"><div className="mx-auto grid max-w-lg grid-cols-5">
    {navItems.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => cn('flex min-h-[68px] flex-col items-center justify-center gap-1 text-[10px] font-medium transition', isActive ? 'text-amber-300' : 'text-white/40 hover:text-white/80')}>{({ isActive }) => <><Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} /><span>{label}</span></>}</NavLink>)}
  </div></nav>
}

function FeedPage() {
  const { reels, liked, saved, toggleLike, toggleSave, comments, addComment } = useDemo()
  const [activeReel, setActiveReel] = useState<Reel | null>(null)
  const [sheet, setSheet] = useState<'comments' | 'share' | null>(null)
  const [muted, setMuted] = useState(true)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [unread, setUnread] = useState(0)
  return <AppLayout><main className="relative min-h-dvh pb-20">
    <header className="pointer-events-none fixed inset-x-0 top-0 z-20 mx-auto flex max-w-lg items-center justify-between px-6 py-5"><Link to="/" className="pointer-events-auto text-xl font-black tracking-[-0.06em]">shop<span className="text-amber-300">reel</span><span className="text-amber-300">.</span></Link><div className="pointer-events-auto flex items-center gap-2"><Link to="/discover" aria-label="Discover" className="rounded-full border border-white/15 bg-black/35 p-2.5 text-white/75 backdrop-blur-xl"><Search size={17} /></Link><button aria-label="Notifications" onClick={() => { setNotificationsOpen((current) => !current); setUnread(0) }} className="relative rounded-full border border-white/15 bg-black/35 p-2.5 text-white/85 backdrop-blur-xl"><Bell size={17} />{unread > 0 && <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-rose-400 text-[9px] font-bold text-black">{unread}</span>}</button></div></header>
    {notificationsOpen && <NotificationPanel onClose={() => setNotificationsOpen(false)} />}
    {reels.length ? <div className="reel-scroller snap-y snap-mandatory overflow-y-auto">{reels.map((reel) => <ReelCard key={reel.id} reel={reel} muted={muted} onMuteToggle={() => setMuted((current) => !current)} isLiked={liked.includes(reel.id)} isSaved={saved.includes(reel.id)} onLike={() => toggleLike(reel.id)} onSave={() => toggleSave(reel.id)} onComments={() => { setActiveReel(reel); setSheet('comments') }} onShare={() => { setActiveReel(reel); setSheet('share') }} />)}</div> : <Empty icon={<Sparkles />} title="No reels yet" text="Be the first to share something worth discovering." />}
    {activeReel && sheet && <Sheet title={sheet === 'comments' ? 'Comments' : 'Share this reel'} onClose={() => setSheet(null)}>{sheet === 'comments' ? <CommentSheet reel={activeReel} comments={comments[activeReel.id] ?? []} onComment={(text) => addComment(activeReel.id, text)} /> : <ShareSheet reel={activeReel} />}</Sheet>}
  </main></AppLayout>
}

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const sections = [
    { id: 'follow', label: 'Follows', count: 0, icon: <UserPlus size={18} />, tone: 'amber', items: [] as Array<{ title: string; time: string }> },
    { id: 'comment', label: 'Comments', count: 0, icon: <MessageSquareText size={18} />, tone: 'rose', items: [] as Array<{ title: string; time: string }> },
    { id: 'reel', label: 'New reels', count: 0, icon: <Sparkles size={18} />, tone: 'indigo', items: [] as Array<{ title: string; time: string }> },
  ]
  return <div className="notification-panel pointer-events-auto"><div className="flex items-center justify-between border-b border-white/10 px-4 py-4"><div><h2 className="font-semibold">Notifications</h2><p className="mt-0.5 text-xs text-white/40">No new activity yet.</p></div><button aria-label="Close notifications" onClick={onClose} className="rounded-full bg-white/10 p-2"><X size={16} /></button></div><div className="notification-sections">{sections.map((section) => <section key={section.id} className="notification-section"><div className="notification-section-header"><span className={cn('notification-section-icon', section.tone === 'rose' ? 'rose' : section.tone === 'indigo' ? 'indigo' : 'amber')}>{section.icon}</span><span className="flex-1 text-left"><b className="block text-sm">{section.label}</b><span className="text-xs text-white/35">{section.count} new</span></span><span className="notification-count">{section.count}</span></div>{section.items.length ? <div className="space-y-1">{section.items.map((item) => <button key={item.title} onClick={onClose} className="flex w-full items-center gap-3 rounded-xl p-2 text-left transition hover:bg-white/[0.06]"><span className="size-2 shrink-0 rounded-full bg-white/60" /><span className="min-w-0 flex-1"><span className="block text-sm">{item.title}</span><span className="mt-1 block text-xs text-white/35">{item.time}</span></span><ChevronRight size={15} className="text-white/30" /></button>)}</div> : <p className="px-2 pb-2 text-xs text-white/30">Nothing here yet.</p>}</section>)}</div></div>
}

function ReelCard({ reel, muted, onMuteToggle, isLiked, isSaved, onLike, onSave, onComments, onShare }: { reel: Reel; muted: boolean; onMuteToggle: () => void; isLiked: boolean; isSaved: boolean; onLike: () => void; onSave: () => void; onComments: () => void; onShare: () => void }) {
  const [playing, setPlaying] = useState(true)
  const [showHeart, setShowHeart] = useState(false)
  const likeReel = () => {
    onLike()
    setShowHeart(true)
    window.setTimeout(() => setShowHeart(false), 800)
  }
  const isInteractiveTarget = (target: EventTarget | null) => target instanceof HTMLElement && Boolean(target.closest('a, button, input, textarea'))
  const handleSurfaceClick = (event: MouseEvent<HTMLElement>) => {
    if (isInteractiveTarget(event.target)) return
    setPlaying((current) => !current)
  }
  return <article onClick={handleSurfaceClick} onDoubleClick={(event) => { if (isInteractiveTarget(event.target)) return; likeReel() }} className="reel-card relative flex h-[calc(100dvh-0px)] min-h-[620px] snap-start items-end overflow-hidden bg-zinc-950">
    <img src={reel.image} alt="" className={cn('absolute inset-0 h-full w-full object-cover transition duration-700', playing ? 'scale-100' : 'scale-[1.03]')} />
    <div className={cn('absolute inset-0 bg-gradient-to-t', reel.accent)} />
    {!playing && <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"><span className="rounded-full bg-black/50 p-4 backdrop-blur"><Sparkles size={22} /></span></div>}
    {showHeart && <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"><Heart aria-hidden="true" className="like-burst size-28 text-rose-400 drop-shadow-[0_8px_24px_rgba(244,63,94,0.55)]" fill="currentColor" /></div>}
    <div className="relative z-10 w-full px-5 pb-7 pr-24">
      <Link to={`/creator/${reel.creator}`} className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-2 py-1.5 text-xs backdrop-blur-xl"><span className="grid size-7 place-items-center rounded-full bg-amber-300 font-bold text-black">{reel.creator[0].toUpperCase()}</span><span>@{reel.creator}</span><ChevronRight size={13} className="text-white/45" /></Link>
      <h2 className="max-w-[280px] text-2xl font-semibold tracking-tight">{reel.product}</h2><p className="mt-1 max-w-[330px] text-sm leading-5 text-white/65">{reel.caption}</p>
      <div className="mt-3 flex gap-1.5">{reel.tags.map((tag) => <span key={tag} className="text-[11px] text-white/45">#{tag}</span>)}</div>
      <a href="#" onClick={(event) => event.stopPropagation()} className="mt-4 flex max-w-[310px] items-center gap-3 rounded-2xl border border-white/15 bg-black/45 p-2.5 backdrop-blur-xl"><img src={reel.image} alt="" className="size-11 rounded-xl object-cover" /><span className="min-w-0 flex-1"><span className="block truncate text-xs text-white/50">Featured product</span><span className="block truncate text-sm font-medium">{reel.product}</span></span><span className="text-sm font-bold text-amber-300">{reel.price}</span><ArrowUpRight size={16} className="text-white/50" /></a>
      <p className="mt-3 text-[10px] text-white/40">Affiliate link — creator may earn a commission.</p>
    </div>
    <div className="absolute bottom-24 right-4 z-20 flex flex-col items-center justify-end gap-2">
      <Action icon={<Heart size={22} fill={isLiked ? 'currentColor' : 'none'} />} label={formatCount(reel.likes + (isLiked ? 1 : 0))} active={isLiked} onClick={likeReel} />
      <Action icon={<MessageCircle size={22} />} label={String(2)} onClick={onComments} />
      <Action icon={<Share2 size={22} />} label={formatCount(38)} share onClick={onShare} />
      <Action icon={<Zap size={21} fill="currentColor" />} label="Buy" amber />
      <Action icon={<Bookmark size={21} fill={isSaved ? 'currentColor' : 'none'} />} label="Save" active={isSaved} onClick={onSave} />
      <Action compact icon={muted ? <VolumeX size={17} /> : <Volume2 size={17} />} label={muted ? 'Unmute' : 'Mute'} onClick={onMuteToggle} />
    </div>
  </article>
}
function Action({ icon, label, active, amber, share, compact, onClick }: { icon: ReactNode; label: string; active?: boolean; amber?: boolean; share?: boolean; compact?: boolean; onClick?: () => void }) {
  return <button onClick={onClick} aria-label={label} className={cn('reel-action flex flex-col items-center gap-1 text-[10px] text-white/70 transition hover:scale-105', active && 'text-rose-400', amber && 'text-amber-300', share && 'share-action text-amber-200', compact && 'opacity-75')}><span className={cn('grid size-11 place-items-center rounded-full border border-white/15 bg-black/35 backdrop-blur-xl', compact && 'size-9')}>{icon}</span><span className={cn(compact && 'text-[9px]')}>{label}</span></button>
}

function Sheet({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="fixed inset-0 z-50 flex items-end bg-black/60 backdrop-blur-sm"><div className="share-sheet mx-auto max-h-[88dvh] w-full max-w-lg overflow-hidden rounded-t-[2rem] border-t border-white/10 bg-[#151a1d] shadow-2xl"><div className="flex justify-center py-4"><span className="h-1 w-12 rounded-full bg-white/55" /></div><div className="flex items-center justify-between px-5 pb-3"><h2 className="text-lg font-semibold">{title}</h2><button aria-label="Close" onClick={onClose} className="rounded-full bg-white/10 p-2"><X size={18} /></button></div>{children}</div></div>
}
function CommentSheet({ reel, comments, onComment }: { reel: Reel; comments: Comment[]; onComment: (text: string) => void }) {
  const [text, setText] = useState('')
  return <><div className="max-h-[42dvh] space-y-4 overflow-y-auto">{comments.length ? comments.map((comment) => <div key={comment.id} className="flex gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-full bg-white/10 text-xs font-semibold">{comment.author[0].toUpperCase()}</span><div><p className="text-sm"><b>@{comment.author}</b> <span className="text-white/75">{comment.text}</span></p><span className="text-xs text-white/35">{comment.time}</span></div></div>) : <p className="py-8 text-center text-sm text-white/40">Be the first to comment on {reel.product}.</p>}</div><form onSubmit={(event) => { event.preventDefault(); if (text.trim()) { onComment(text.trim()); setText('') } }} className="mt-5 flex gap-2 border-t border-white/10 pt-4"><input value={text} onChange={(event) => setText(event.target.value)} placeholder="Add a comment..." className="min-w-0 flex-1 rounded-full bg-white/10 px-4 py-3 text-sm outline-none placeholder:text-white/35" /><button className="grid size-11 shrink-0 place-items-center rounded-full bg-amber-300 text-black"><Send size={17} /></button></form></>
}
function ShareSheet({ reel }: { reel: Reel }) {
  const [copied, setCopied] = useState(false)
  const [sentTo, setSentTo] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const shareUrl = `${window.location.origin}/#reel-${reel.id}`
  const friends: string[] = []
  const filteredFriends = friends.filter((friend) => friend.toLowerCase().includes(query.toLowerCase()))

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  async function shareLink() {
    try {
      if (navigator.share) {
        await navigator.share({ title: reel.product, text: reel.caption, url: shareUrl })
        return
      }
    } catch {
      // The native sheet can be dismissed without completing the share.
    }
    await copyLink()
  }

  function sendTo(friend: string) {
    setSentTo((current) => current.includes(friend) ? current : [...current, friend])
  }

  return <div className="share-sheet-content">
    <div className="share-intro"><div><p className="eyebrow">Share this reel</p><p className="mt-1 text-sm text-white/55">{reel.product}</p></div><img src={reel.image} alt="" className="size-12 rounded-xl object-cover" /></div>
    <div className="share-search"><Search size={19} className="text-white/45" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people" aria-label="Search people to share with" /><button aria-label="Find friends" className="grid size-10 place-items-center rounded-full bg-amber-300 text-black"><Users size={18} /></button></div>
    <div className="mb-3 mt-6 flex items-center justify-between"><h3 className="font-semibold">Send to people</h3><span className="text-xs text-white/35">{filteredFriends.length} friends</span></div>
    <div className="share-friend-list">{filteredFriends.map((friend, index) => { const sent = sentTo.includes(friend); return <button key={`${friend}-${index}`} onClick={() => sendTo(friend)} className="share-friend-row"><span className="grid size-11 shrink-0 place-items-center rounded-full bg-gradient-to-br from-amber-200 to-indigo-300 font-semibold text-black">{friend[0]}</span><span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium">{friend}</span><span className="mt-0.5 block text-xs text-white/35">{sent ? 'Reel sent' : 'Available to chat'}</span></span><span className={cn('grid size-9 place-items-center rounded-full', sent ? 'bg-emerald-400/15 text-emerald-300' : 'bg-white/10 text-white/65')}>{sent ? <Check size={17} /> : <Send size={16} />}</span></button> })}</div>
    {!filteredFriends.length && <p className="py-8 text-center text-sm text-white/40">No people found.</p>}
    <div className="my-6 flex items-center gap-3"><span className="h-px flex-1 bg-white/10" /><span className="eyebrow">More ways to share</span><span className="h-px flex-1 bg-white/10" /></div>
    <div className="share-options"><button onClick={() => void copyLink()} className="share-option"><span className="share-option-icon"><Link2 size={22} /></span><span>{copied ? 'Copied' : 'Copy link'}</span></button><a href={`https://wa.me/?text=${encodeURIComponent(`${reel.product} — ${shareUrl}`)}`} target="_blank" rel="noopener noreferrer" className="share-option"><span className="share-option-icon whatsapp"><MessageCircle size={22} /></span><span>WhatsApp</span></a><button onClick={() => void shareLink()} className="share-option"><span className="share-option-icon"><Share size={22} /></span><span>Other apps</span></button><a href={`mailto:?subject=${encodeURIComponent(reel.product)}&body=${encodeURIComponent(`${reel.caption}\n\n${shareUrl}`)}`} className="share-option"><span className="share-option-icon"><Copy size={21} /></span><span>Email</span></a></div>
  </div>
}

function DiscoverPage() {
  const { reels } = useDemo(); const [query, setQuery] = useState(''); const [tag, setTag] = useState('')
  const tags = [...new Set(reels.flatMap((reel) => reel.tags))]
  const filtered = reels.filter((reel) => `${reel.product} ${reel.creator}`.toLowerCase().includes(query.toLowerCase()) && (!tag || reel.tags.includes(tag)))
  return <Page><PageHeader title="Discover" subtitle="Find your next favourite thing." /><div className="relative"><Search className="absolute left-4 top-3.5 text-white/35" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products, creators..." className="w-full rounded-2xl border border-white/10 bg-white/[0.05] py-3 pl-11 pr-4 text-sm outline-none placeholder:text-white/35 focus:border-amber-300/50" /></div><div className="mt-4 flex gap-2 overflow-x-auto pb-1">{tags.map((item) => <button key={item} onClick={() => setTag(tag === item ? '' : item)} className={cn('whitespace-nowrap rounded-full border px-3 py-1.5 text-xs', tag === item ? 'border-amber-300 bg-amber-300 text-black' : 'border-white/10 text-white/55')}>#{item}</button>)}</div><div className="mt-6 grid grid-cols-2 gap-3">{filtered.map((reel) => <Link key={reel.id} to="/#reel" className="group overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03]"><img src={reel.image} alt={reel.product} className="aspect-[4/5] w-full object-cover transition group-hover:scale-105" /><div className="p-3"><p className="truncate text-sm font-medium">{reel.product}</p><p className="mt-1 text-xs text-white/40">@{reel.creator}</p></div></Link>)}</div>{!filtered.length && <Empty icon={<Search />} title="Nothing found" text="Try another product or tag." />}</Page>
}

function UploadPage() {
  const navigate = useNavigate(); const { addReel } = useDemo(); const [name, setName] = useState(''); const [price, setPrice] = useState(''); const [caption, setCaption] = useState(''); const [image, setImage] = useState<string | null>(null)
  const publish = (event: FormEvent) => { event.preventDefault(); if (!name || !caption || !image) return; addReel({ id: crypto.randomUUID(), creator: 'current-user', creatorName: 'Current user', product: name, price: price ? `₹${price}` : 'View deal', caption, image, accent: 'from-amber-950/90 via-transparent to-black', tags: [], likes: 0, views: 0 }); navigate('/') }
  return <Page><PageHeader title="Create a reel" subtitle="Show the product, drop your affiliate link, earn." /><form onSubmit={publish} className="space-y-5"><label className="block cursor-pointer rounded-3xl border border-dashed border-white/20 bg-white/[0.03] p-7 text-center"><ImagePlus className="mx-auto text-amber-300" size={28} /><p className="mt-3 text-sm font-medium">{image ? 'Product image ready' : 'Add a product image'}</p><p className="mt-1 text-xs text-white/40">A clear photo helps people decide.</p><input type="file" accept="image/*" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) setImage(URL.createObjectURL(file)) }} /></label>{image && <img src={image} alt="Product preview" className="h-44 w-full rounded-2xl object-cover" />}<Field label="Product name" value={name} onChange={setName} placeholder="What are you sharing?" required /><Field label="Price" value={price} onChange={setPrice} placeholder="1,299" prefix="₹" /><Field label="Affiliate link" value="" onChange={() => undefined} placeholder="https://store.example/product" /><Field label="Caption" value={caption} onChange={setCaption} placeholder="What makes this worth sharing?" textarea required /><button className="flex w-full items-center justify-center gap-2 rounded-full bg-amber-300 py-3.5 font-semibold text-black transition hover:bg-amber-200"><Sparkles size={17} /> Publish reel</button></form></Page>
}
function Field({ label, value, onChange, placeholder, prefix, textarea, required }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; prefix?: string; textarea?: boolean; required?: boolean }) { return <label className="block"><span className="mb-2 block text-[11px] uppercase tracking-wider text-white/40">{label}</span><div className="relative">{prefix && <span className="absolute left-4 top-3.5 text-white/40">{prefix}</span>}{textarea ? <textarea required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-28 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm outline-none placeholder:text-white/30 focus:border-amber-300/50" /> : <input required={required} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={cn('w-full rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-sm outline-none placeholder:text-white/30 focus:border-amber-300/50', prefix && 'pl-8')} />}</div></label> }

function WishlistPage() { const { reels, saved, toggleSave } = useDemo(); const items = reels.filter((reel) => saved.includes(reel.id)); return <Page><PageHeader title="Wishlist" subtitle="Your little corner of good finds." /><div className="space-y-3">{items.map((reel) => <a key={reel.id} href="#" className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"><img src={reel.image} alt="" className="size-20 rounded-xl object-cover" /><span className="min-w-0 flex-1"><b className="block truncate">{reel.product}</b><span className="mt-1 block text-sm text-amber-300">{reel.price}</span><span className="mt-1 block text-xs text-white/40">@{reel.creator}</span></span><button aria-label={`Remove ${reel.product}`} onClick={(event) => { event.preventDefault(); toggleSave(reel.id) }} className="rounded-full p-2 text-white/40 hover:text-rose-300"><Bookmark size={18} fill="currentColor" /></button></a>)}</div>{!items.length && <Empty icon={<Bookmark />} title="Your wishlist is empty" text="Save products from the feed to find them later." />}</Page> }

function ChatsPage() {
  const [query, setQuery] = useState('')
  const [showRequests, setShowRequests] = useState(false)
  return <Page><div className="flex items-start justify-between"><PageHeader title="Chats" subtitle="Share finds with your people." /><div className="relative"><button aria-label="Chat invitations" onClick={() => setShowRequests((current) => !current)} className="feed-notification-button relative rounded-full border border-white/15 bg-black/35 p-2.5 text-white/85 backdrop-blur-xl"><UserRoundPlus size={18} /></button>{showRequests && <div className="absolute right-0 top-14 z-10 w-72 rounded-2xl border border-white/10 bg-zinc-900 p-4 shadow-xl"><b className="text-sm">Chat invitations</b><p className="mt-3 text-xs text-white/40">No pending invitations.</p></div>}</div></div><div className="relative mb-7"><Search className="absolute left-4 top-3.5 text-white/35" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search people to chat with..." className="w-full rounded-2xl border border-white/10 bg-white/[0.05] py-3 pl-11 pr-4 text-sm outline-none placeholder:text-white/35 focus:border-amber-300/50" /></div>{query && <section className="mb-7 space-y-2"><p className="eyebrow">People</p><p className="rounded-2xl border border-white/10 p-4 text-sm text-white/40">No people found.</p></section>}<section className="space-y-3"><p className="eyebrow">Friends</p><Empty icon={<Users />} title="No chats yet" text="Find someone and send a chat invitation to get started." /></section></Page>
}
function ThreadPage() { const { friend } = useParams(); return <Page><div className="mb-7 flex items-center gap-3"><Link to="/chats" className="rounded-full bg-white/10 p-2"><ArrowLeft size={18} /></Link><div><p className="font-semibold">@{friend}</p><p className="text-xs text-emerald-300">Friends</p></div></div><div className="flex min-h-[55dvh] flex-col justify-end gap-3"><div className="max-w-[76%] self-start rounded-2xl rounded-bl-md bg-white/10 p-3 text-sm">That lamp is so good. Where did you find it?<span className="mt-1 block text-[10px] text-white/35">2m ago</span></div><div className="max-w-[76%] self-end rounded-2xl rounded-br-md bg-amber-300 p-3 text-sm text-black">It is in the ShopReel feed ✨<span className="mt-1 block text-[10px] text-black/50">now</span></div></div><div className="mt-5 flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] p-1.5"><button className="rounded-full p-2 text-white/50"><Paperclip size={18} /></button><input placeholder="Write a message..." className="min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" /><button className="grid size-9 place-items-center rounded-full bg-amber-300 text-black"><Send size={16} /></button></div></Page> }

function ProfilePage() { const { reels } = useDemo(); const { profile, session, updateProfile } = useAuth(); const own = reels.filter((reel) => reel.creator === 'current-user'); const [shareOpen, setShareOpen] = useState(false); const [editOpen, setEditOpen] = useState(false); const [name, setName] = useState(profile?.display_name ?? ''); const [avatarFile, setAvatarFile] = useState<File | null>(null); const [bio, setBio] = useState(profile?.bio ?? ''); const [error, setError] = useState<string | null>(null); async function saveProfile(event: FormEvent) { event.preventDefault(); setError(null); try { let avatarUrl = profile?.avatar_url ?? null; if (avatarFile) { const image = await browserVideoProvider.compressProfileImage(avatarFile); const upload = await requestUploadUrl(session!, 'profile-image', image); await putWithProgress(upload, image, () => undefined); avatarUrl = upload.publicUrl ?? null } await updateProfile({ displayName: name, avatarUrl, bio }); setAvatarFile(null); setEditOpen(false) } catch (saveError) { setError(saveError instanceof Error ? saveError.message : 'Unable to update profile') } } return <Page><div className="flex items-start justify-between"><div className="flex items-center gap-3"><span className="grid size-16 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-amber-300 to-rose-400 text-2xl font-bold text-black">{profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="size-full object-cover" /> : (profile?.display_name?.[0] ?? profile?.handle?.[0] ?? '?').toUpperCase()}</span><div><h1 className="text-xl font-semibold">{profile?.display_name ?? 'Your profile'}</h1><p className="text-sm text-white/45">@{profile?.handle ?? 'username'}</p>{profile?.bio && <p className="mt-1 max-w-[14rem] text-xs text-white/50">{profile.bio}</p>}</div></div><Link to="/settings" aria-label="Settings" className="rounded-full border border-white/10 p-2.5"><Settings size={19} /></Link></div><div className="mt-5 flex gap-2"><button onClick={() => setEditOpen(true)} className="flex-1 rounded-full bg-white/10 py-3 text-sm">Edit profile</button><button onClick={() => setShareOpen(true)} className="flex-1 rounded-full border border-amber-300/30 bg-amber-300/10 py-3 text-sm text-amber-200"><Share2 size={16} className="mr-2 inline" />Share profile</button></div><div className="mt-7 grid grid-cols-3 gap-2">{[['Posts', own.length], ['Followers', 0], ['Views', own.reduce((total, reel) => total + reel.views, 0)]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center"><b className="block text-lg">{typeof value === 'number' ? formatCount(value) : value}</b><span className="text-[10px] uppercase tracking-wider text-white/35">{label}</span></div>)}</div><p className="eyebrow mt-9">Your reels</p>{own.length ? <div className="mt-3 grid grid-cols-3 gap-1.5">{own.map((reel) => <img key={reel.id} src={reel.image} alt={reel.product} className="aspect-square w-full rounded-lg object-cover" />)}</div> : <Empty icon={<Sparkles />} title="No reels yet" text="Publish your first reel to see it on your profile." />}{shareOpen && <Sheet title="Share profile" onClose={() => setShareOpen(false)}><ProfileShareSheet /></Sheet>}{editOpen && <Sheet title="Edit profile" onClose={() => setEditOpen(false)}><form onSubmit={(event) => void saveProfile(event)} className="space-y-4"><label className="block text-sm">Display name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} required className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.05] p-3 outline-none" /></label><div className="block text-sm">Profile image<input id="profile-image-input" type="file" accept="image/*" onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)} className="sr-only" /><label htmlFor="profile-image-input" className="mt-2 flex min-h-12 cursor-pointer items-center justify-center rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 text-sm font-semibold text-amber-200 transition hover:bg-amber-300/20 focus-within:ring-2 focus-within:ring-amber-300"><ImagePlus size={18} className="mr-2" />{avatarFile ? avatarFile.name : 'Choose image from device'}</label><span className="mt-1 block text-xs text-white/40">Images are compressed on your device before upload.</span></div><label className="block text-sm">Bio<textarea value={bio} onChange={(event) => setBio(event.target.value)} maxLength={500} rows={3} className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.05] p-3 outline-none" /></label>{error && <p role="alert" className="text-sm text-rose-300">{error}</p>}<button type="submit" className="w-full rounded-full bg-amber-300 py-3 text-sm font-semibold text-black">Save changes</button></form></Sheet>}</Page> }
function ProfileShareSheet() {
  const [copied, setCopied] = useState(false)
  const profileUrl = `${window.location.origin}/profile`
  async function copyProfile() {
    try { await navigator.clipboard.writeText(profileUrl); setCopied(true) } catch { setCopied(false) }
  }
  async function shareProfile() {
    try {
      if (navigator.share) { await navigator.share({ title: 'ShopReel profile', text: 'Check out my ShopReel profile.', url: profileUrl }); return }
    } catch { /* Native sharing may be dismissed. */ }
    await copyProfile()
  }
  return <div className="space-y-3"><div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] p-4"><span className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-rose-400 font-bold text-black">?</span><div><p className="font-medium">Your profile</p><p className="text-xs text-white/45">Share your ShopReel profile</p></div></div><button onClick={() => void shareProfile()} className="flex w-full items-center gap-3 rounded-2xl bg-amber-300 p-4 text-left font-semibold text-black"><Share2 size={19} /><span className="flex-1">Share profile</span><ChevronRight size={17} /></button><button onClick={() => void copyProfile()} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left"><Link2 size={19} /><span className="flex-1">{copied ? 'Profile link copied' : 'Copy profile link'}</span><Copy size={17} className="text-white/45" /></button><a href={`mailto:?subject=ShopReel%20profile&body=${encodeURIComponent(profileUrl)}`} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left"><MessageCircle size={19} className="text-emerald-300" /><span className="flex-1">Share by email</span><ChevronRight size={17} className="text-white/45" /></a></div>
}
function AnalyticsPage() { const { reels } = useDemo(); const own = reels.filter((reel) => reel.creator === 'you'); return <Page><PageHeader title="Analytics" subtitle="See what is resonating." /><div className="grid grid-cols-3 gap-2">{[['Views', own.reduce((total, reel) => total + reel.views, 0)], ['Likes', own.reduce((total, reel) => total + reel.likes, 0)], ['Shares', 0]].map(([label, value]) => <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3"><span className="eyebrow">{label}</span><b className="mt-2 block text-xl">{typeof value === 'number' ? formatCount(value) : value}</b></div>)}</div>{own.length ? <><p className="eyebrow mt-8">Reel performance</p><div className="mt-3 space-y-3">{own.map((reel) => <div key={reel.id} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3"><img src={reel.image} alt="" className="size-14 rounded-xl object-cover" /><span className="flex-1"><b className="block truncate text-sm">{reel.product}</b><span className="mt-1 block text-xs text-white/40">{formatCount(reel.views)} views · {formatCount(reel.likes)} likes</span></span><MoreHorizontal size={17} className="text-white/35" /></div>)}</div></> : <Empty icon={<BarChart3 />} title="No analytics yet" text="Publish a reel to start seeing performance." />}</Page> }
function SettingsPage() { const { profile, signOut } = useAuth(); const navigate = useNavigate(); const [error, setError] = useState<string | null>(null); const [confirmOpen, setConfirmOpen] = useState(false); async function handleSignOut() { setError(null); try { await signOut(); navigate('/login', { replace: true }) } catch (signOutError) { setError(signOutError instanceof Error ? signOutError.message : 'Unable to sign out') } } return <Page><PageHeader title="Settings" subtitle="Manage your ShopReel account." /><section className="mb-7 rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="eyebrow">Account</p><div className="mt-4 flex items-center gap-3"><span className="grid size-12 place-items-center rounded-full bg-gradient-to-br from-amber-300 to-rose-400 font-bold text-black">{(profile?.display_name?.[0] ?? profile?.handle?.[0] ?? '?').toUpperCase()}</span><div className="min-w-0"><p className="truncate font-medium">{profile?.display_name}</p><p className="truncate text-sm text-white/40">@{profile?.handle}</p></div></div></section><section className="space-y-2"><p className="eyebrow mb-3">Preferences</p>{[['Language', 'English'], ['Affiliate disclosure', 'Learn how creator links work'], ['Privacy', 'Review your data and permissions']].map(([label, value]) => <button key={label} type="button" className="flex min-h-16 w-full items-center rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:bg-white/[0.06]"><span className="flex-1 text-sm">{label}<span className="mt-1 block text-xs text-white/40">{value}</span></span><ChevronRight size={17} className="text-white/35" /></button>)}</section><section className="mt-8"><p className="eyebrow mb-3">Session</p><button type="button" onClick={() => setConfirmOpen(true)} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-rose-400/30 bg-rose-400/10 py-3 text-sm font-medium text-rose-200 transition hover:bg-rose-400/20"><LogOut size={17} />Sign out</button>{error && <p role="alert" className="mt-3 text-center text-sm text-rose-300">{error}</p>}</section>{confirmOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-5 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="sign-out-title" className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#151a1d] p-6 shadow-2xl"><span className="grid size-12 place-items-center rounded-2xl bg-rose-400/15 text-rose-200"><LogOut size={21} /></span><h2 id="sign-out-title" className="mt-5 text-xl font-semibold">Sign out of ShopReel?</h2><p className="mt-2 text-sm leading-6 text-white/50">You’ll need to sign in again to access your profile, saved finds, and chats.</p><div className="mt-6 grid grid-cols-2 gap-3"><button type="button" onClick={() => setConfirmOpen(false)} className="min-h-11 rounded-xl border border-white/10 bg-white/[0.05] text-sm">Cancel</button><button type="button" onClick={() => void handleSignOut()} className="min-h-11 rounded-xl bg-rose-400 text-sm font-semibold text-black">Sign out</button></div></div></div>}</Page> }
function CreatorPage() { const { name } = useParams(); const { reels } = useDemo(); const creatorReels = reels.filter((reel) => reel.creator === name); const [invited, setInvited] = useState(false); return <Page><div className="mb-7 flex items-center gap-3"><Link to="/" className="rounded-full bg-white/10 p-2"><ArrowLeft size={18} /></Link><span className="text-sm text-white/50">Creator</span></div><div className="text-center"><span className="mx-auto grid size-20 place-items-center rounded-full bg-amber-300 text-2xl font-bold text-black">{name?.[0]?.toUpperCase()}</span><h1 className="mt-3 text-xl font-semibold">@{name}</h1><p className="mt-1 text-sm text-white/45">Finding beautiful things, one reel at a time.</p><div className="mt-4 flex justify-center gap-2"><button className="rounded-full bg-amber-300 px-6 py-2.5 text-sm font-semibold text-black">Follow</button><button onClick={() => setInvited(true)} disabled={invited} className="flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-5 py-2.5 text-sm font-semibold text-amber-200 disabled:opacity-70"><UserPlus size={16} /> {invited ? 'Invite sent' : 'Chat invite'}</button></div></div><div className="mt-7 grid grid-cols-3 gap-2">{[['Posts', creatorReels.length], ['Followers', 0], ['Views', creatorReels.reduce((total, reel) => total + reel.views, 0)]].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-center"><b className="block text-lg">{typeof value === 'number' ? formatCount(value) : value}</b><span className="eyebrow">{label}</span></div>)}</div>{creatorReels.length ? <div className="mt-8 grid grid-cols-3 gap-1.5">{creatorReels.map((reel) => <img key={reel.id} src={reel.image} alt={reel.product} className="aspect-square rounded-lg object-cover" />)}</div> : <Empty icon={<Sparkles />} title="No reels yet" text="This creator has not published any reels." />}</Page> }
function Page({ children }: { children: ReactNode }) { return <AppLayout><div className="px-5 pb-28 pt-10">{children}</div></AppLayout> }
function PageHeader({ title, subtitle }: { title: string; subtitle: string }) { return <div className="mb-7"><h1 className="text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-1 text-sm text-white/45">{subtitle}</p></div> }
function Empty({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="py-20 text-center"><span className="mx-auto grid size-14 place-items-center rounded-2xl bg-white/10 text-amber-300">{icon}</span><h2 className="mt-4 font-semibold">{title}</h2><p className="mx-auto mt-2 max-w-xs text-sm text-white/40">{text}</p></div> }

export function App() { return <AuthProvider><DemoProvider><BrowserRouter><Routes><Route path="/login" element={<LoginPage />} /><Route path="/onboarding" element={<OnboardingPage />} /><Route element={<AuthGate />}><Route path="/" element={<FeedPage />} /><Route path="/discover" element={<DiscoverPage />} /><Route path="/upload" element={<UploadPage />} /><Route path="/create" element={<UploadPage />} /><Route path="/wishlist" element={<WishlistPage />} /><Route path="/chats" element={<ChatsPage />} /><Route path="/chats/:friend" element={<ThreadPage />} /><Route path="/profile" element={<ProfilePage />} /><Route path="/me" element={<ProfilePage />} /><Route path="/analytics" element={<AnalyticsPage />} /><Route path="/settings" element={<SettingsPage />} /><Route path="/creator/:name" element={<CreatorPage />} /><Route path="*" element={<Navigate to="/" replace />} /></Route></Routes></BrowserRouter></DemoProvider></AuthProvider> }
function AuthGate() { const { loading, session, profile } = useAuth(); const location = useLocation(); if (loading) return <main className="grid min-h-dvh place-items-center bg-black text-sm text-white/50">Loading ShopReel…</main>; if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />; if (!profile) return <Navigate to="/onboarding" replace />; return <Outlet /> }

export default App
