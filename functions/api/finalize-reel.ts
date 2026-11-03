import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { MEDIA_LIMITS } from '../../src/features/upload/providers'
import { createR2Storage, type R2Env } from '../storage/r2'
import type { PagesFunction } from '../types'

type Env = R2Env & { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY: string; R2_PUBLIC_URL: string }
const schema = z.object({
  videoKey: z.string().regex(/^users\/[0-9a-f-]+\/uploads\/[A-Za-z0-9-]+\.mp4$/),
  posterKey: z.string().regex(/^users\/[0-9a-f-]+\/uploads\/[A-Za-z0-9-]+\.webp$/),
  productImageKey: z.string().regex(/^users\/[0-9a-f-]+\/uploads\/[A-Za-z0-9-]+\.webp$/),
  durationSeconds: z.number().positive().max(MEDIA_LIMITS.durationSeconds),
  videoSizeBytes: z.number().int().positive().max(MEDIA_LIMITS.videoBytes),
  caption: z.string().max(300),
  productName: z.string().min(1).max(120),
  affiliateUrl: z.string().url().startsWith('https://'),
  tags: z.array(z.string().min(1).max(40)).max(5),
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const authorization = request.headers.get('Authorization')
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return json({ error: 'unauthenticated: bearer token required' }, 401)
  const auth = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY)
  const { data: userResult, error: authError } = await auth.auth.getUser(token)
  if (authError || !userResult.user) return json({ error: 'unauthenticated: invalid token' }, 401)
  const input = schema.safeParse(await request.json().catch(() => null))
  if (!input.success) return json({ error: input.error.issues[0]?.message ?? 'invalid_input: invalid reel metadata' }, 400)
  const storage = createR2Storage(env)
  const prefix = `users/${userResult.user.id}/uploads/`
  if (![input.data.videoKey, input.data.posterKey, input.data.productImageKey].every((key) => key.startsWith(prefix))) return json({ error: 'forbidden: upload does not belong to this account' }, 403)
  const [video, poster, productImage] = await Promise.all([storage.head(input.data.videoKey), storage.head(input.data.posterKey), storage.head(input.data.productImageKey)])
  if (!video || video.contentType !== 'video/mp4' || video.contentLength !== input.data.videoSizeBytes || video.contentLength > MEDIA_LIMITS.videoBytes) return json({ error: 'invalid_input: video object failed verification' }, 400)
  if (!poster || poster.contentType !== 'image/webp' || poster.contentLength > MEDIA_LIMITS.posterBytes) return json({ error: 'invalid_input: poster object failed verification' }, 400)
  if (!productImage || productImage.contentType !== 'image/webp' || productImage.contentLength > MEDIA_LIMITS.productImageBytes) return json({ error: 'invalid_input: product image object failed verification' }, 400)
  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const publicUrl = env.R2_PUBLIC_URL.replace(/\/$/, '')
  const { data: reel, error } = await admin.rpc('create_reel', {
    p_video_key: input.data.videoKey, p_poster_key: input.data.posterKey, p_product_image_key: input.data.productImageKey,
    p_video_url: `${publicUrl}/${input.data.videoKey}`, p_poster_url: `${publicUrl}/${input.data.posterKey}`,
    p_duration_s: input.data.durationSeconds, p_size_bytes: video.contentLength, p_caption: input.data.caption,
    p_product_name: input.data.productName, p_price_paise: null, p_product_image_url: `${publicUrl}/${input.data.productImageKey}`,
    p_affiliate_url: input.data.affiliateUrl, p_tags: input.data.tags,
  })
  if (error) return json({ error: error.message.startsWith('invalid_input:') ? error.message : 'conflict: unable to create reel' }, 400)
  return json({ reel })
}

