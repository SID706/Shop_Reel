import { describe, expect, it, vi } from 'vitest'
import { onRequestGet } from './health'

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
}

describe('health endpoint', () => {
  it('reports healthy when the Supabase REST endpoint responds', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))

    const response = await onRequestGet({
      env,
      request: new Request('https://example.com/api/health'),
      params: {},
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ ok: true })
    expect(fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/',
      expect.objectContaining({
        headers: {
          apikey: 'anon-key',
          authorization: 'Bearer anon-key',
        },
      }),
    )
  })

  it('reports unavailable when Supabase is unreachable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const response = await onRequestGet({
      env,
      request: new Request('https://example.com/api/health'),
      params: {},
    })

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: 'database',
    })
  })
})
