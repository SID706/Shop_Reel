import type { PagesFunction } from '../types'

export const onRequestGet: PagesFunction = async ({ env }) => {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'configuration' }), { status: 503, headers: { 'content-type': 'application/json' } })
  }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5_000)
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: env.SUPABASE_ANON_KEY, authorization: 'Bearer ' + env.SUPABASE_ANON_KEY },
      signal: controller.signal,
    })
    return new Response(JSON.stringify(response.ok ? { ok: true } : { ok: false, error: 'database' }), {
      status: response.ok ? 200 : 503,
      headers: { 'content-type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ ok: false, error: 'database' }), { status: 503, headers: { 'content-type': 'application/json' } })
  } finally {
    clearTimeout(timeout)
  }
}
