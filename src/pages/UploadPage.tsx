import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { Button } from '../components/ui/button'
import { useAuth } from '../features/auth/AuthProvider'
import { browserVideoProvider } from '../features/upload/media'
import { MEDIA_LIMITS } from '../features/upload/providers'
import { putWithProgress, requestUploadUrl } from '../features/upload/uploadApi'

const metadataSchema = z.object({
  caption: z.string().trim().max(300),
  productName: z.string().trim().min(1).max(120),
  affiliateUrl: z.string().url().refine((value) => value.startsWith('https://'), 'Use an HTTPS product URL'),
  tags: z.string().transform((value) => value.split(',').map((tag) => tag.trim().toLowerCase()).filter(Boolean)).refine((value) => value.length <= 5, 'Use at most 5 tags'),
})

export function UploadPage() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const abortRef = useRef<AbortController | undefined>(undefined)
  const [video, setVideo] = useState<File | null>(null)
  const [productImage, setProductImage] = useState<File | null>(null)
  const [caption, setCaption] = useState('')
  const [productName, setProductName] = useState('')
  const [affiliateUrl, setAffiliateUrl] = useState('')
  const [tags, setTags] = useState('')
  const [progress, setProgress] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!session || !video || !productImage) {
      setError('Sign in and choose both a video and product image')
      return
    }
    const parsed = metadataSchema.safeParse({ caption, productName, affiliateUrl, tags })
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the reel details')
      return
    }
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setError(null)
    try {
      const compressedVideo = await browserVideoProvider.compress(video, (value) => setProgress(value * 0.35), controller.signal)
      const poster = await browserVideoProvider.createPoster(compressedVideo, controller.signal)
      const compressedProduct = await browserVideoProvider.compressProductImage(productImage, controller.signal)
      const files = [
        { kind: 'video' as const, file: compressedVideo },
        { kind: 'poster' as const, file: poster },
        { kind: 'product-image' as const, file: compressedProduct },
      ]
      const uploads: Array<{ key: string; size: number }> = []
      for (let index = 0; index < files.length; index += 1) {
        const item = files[index]
        const upload = await requestUploadUrl(session, item.kind, item.file)
        await putWithProgress(upload, item.file, (value) => setProgress(0.35 + ((index + value) / files.length) * 0.55), controller.signal)
        uploads.push({ key: upload.key, size: item.file.size })
      }
      const response = await fetch('/api/finalize-reel', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + session.access_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...parsed.data,
          videoKey: uploads[0].key,
          posterKey: uploads[1].key,
          productImageKey: uploads[2].key,
          durationSeconds: MEDIA_LIMITS.durationSeconds,
          videoSizeBytes: uploads[0].size,
        }),
      })
      const result = await response.json() as { reel?: { id: string }; error?: string }
      if (!response.ok || !result.reel) throw new Error(result.error ?? 'Unable to create reel')
      setProgress(1)
      navigate('/')
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === 'AbortError') setError('Upload cancelled. You can retry safely.')
      else setError(cause instanceof Error ? cause.message : 'Upload failed. Please retry.')
    } finally {
      abortRef.current = undefined
      setBusy(false)
    }
  }

  return (
    <section className="space-y-5 p-5">
      <div><h1 className="text-2xl font-semibold">Create a reel</h1><p className="text-sm text-muted-foreground">Videos are compressed on your device before upload.</p></div>
      <label className="block text-sm">Video<input className="mt-2 block w-full text-sm" type="file" accept="video/*" onChange={(event) => setVideo(event.target.files?.[0] ?? null)} /></label>
      <label className="block text-sm">Product image<input className="mt-2 block w-full text-sm" type="file" accept="image/*" onChange={(event) => setProductImage(event.target.files?.[0] ?? null)} /></label>
      <input className="w-full rounded border bg-transparent p-2" placeholder="Product name" value={productName} onChange={(event) => setProductName(event.target.value)} />
      <input className="w-full rounded border bg-transparent p-2" placeholder="Affiliate URL (HTTPS)" value={affiliateUrl} onChange={(event) => setAffiliateUrl(event.target.value)} />
      <input className="w-full rounded border bg-transparent p-2" placeholder="Tags, separated by commas" value={tags} onChange={(event) => setTags(event.target.value)} />
      <textarea className="w-full rounded border bg-transparent p-2" placeholder="Caption" maxLength={300} value={caption} onChange={(event) => setCaption(event.target.value)} />
      {busy && <progress className="w-full" max={1} value={progress} />}
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-3">
        <Button disabled={busy} onClick={() => void submit()}>{busy ? 'Uploading…' : 'Upload reel'}</Button>
        {busy && <Button className="bg-muted text-foreground" onClick={() => abortRef.current?.abort()}>Cancel</Button>}
      </div>
    </section>
  )
}
