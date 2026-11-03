import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { createR2Storage, type R2Env } from '../storage/r2'
import { MEDIA_LIMITS } from '../../src/features/upload/providers'
import type { PagesFunction } from '../types'

type Env = R2Env & {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

const requestSchema = z.object({
  kind: z.enum(['video', 'poster', 'product-image', 'profile-image']),
  contentType: z.enum(['video/mp4', 'image/webp']),
  contentLength: z.number().int().positive(),
}).superRefine((input, context) => {
  const expectedType = input.kind === 'video' ? 'video/mp4' : 'image/webp'
  const max = input.kind === 'video' ? MEDIA_LIMITS.videoBytes : input.kind === 'poster' ? MEDIA_LIMITS.posterBytes : input.kind === 'product-image' ? MEDIA_LIMITS.productImageBytes : MEDIA_LIMITS.profileImageBytes
  if (input.contentType !== expectedType) context.addIssue({ code: 'custom', message: 'invalid_input: content type does not match upload kind', path: ['contentType'] })
  if (input.contentLength > max) context.addIssue({ code: 'custom', message: `invalid_input: file exceeds ${max} bytes`, path: ['contentLength'] })
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
  const parsed = requestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return json({ error: parsed.error.issues[0]?.message ?? 'invalid_input: invalid upload request' }, 400)

  const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)
  const { data: setting, error: settingError } = await admin.from('app_settings').select('value').eq('key', 'uploads_enabled').maybeSingle()
  if (settingError) return json({ error: 'storage_unavailable: unable to check upload status' }, 503)
  const settingValue = setting?.value
  if (settingValue === false || (typeof settingValue === 'object' && settingValue !== null && 'enabled' in settingValue && settingValue.enabled === false)) {
    return json({ error: 'forbidden: uploads are temporarily disabled' }, 403)
  }
  if (parsed.data.kind !== 'profile-image') {
    const { data: quota, error: quotaError } = await admin.rpc('check_upload_quota', { p_user_id: userResult.user.id })
    if (quotaError || quota !== true) return json({ error: 'rate_limited: daily upload quota exceeded' }, 429)
  }
  const storage = createR2Storage(env)
  try {
    const upload = await storage.createUploadUrl(parsed.data, userResult.user.id)
    return json({ upload: { ...upload, publicUrl: `${env.R2_PUBLIC_URL.replace(/\/$/, '')}/${upload.key}` } })
  } catch {
    return json({ error: 'storage_unavailable: unable to create upload URL' }, 503)
  }
}
