import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createR2Storage } from './r2'

const send = vi.fn()
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = send },
  DeleteObjectCommand: class { constructor(public input: unknown) {} },
  HeadObjectCommand: class { constructor(public input: unknown) {} },
  ListObjectsV2Command: class { constructor(public input: unknown) {} },
  PutObjectCommand: class { constructor(public input: unknown) {} },
}))
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: vi.fn(async () => 'https://signed.example/put') }))

describe('R2 storage provider', () => {
  beforeEach(() => send.mockReset())

  it('creates a fixed user-scoped key and signs exact upload headers', async () => {
    const storage = createR2Storage({
      R2_BUCKET: 'shopreel',
      R2_ENDPOINT: 'https://r2.example',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_PUBLIC_URL: 'https://media.example',
    })
    const result = await storage.createUploadUrl({ kind: 'video', contentType: 'video/mp4', contentLength: 1234 }, 'user-1')
    expect(result.url).toBe('https://signed.example/put')
    expect(result.key).toMatch(/^users\/user-1\/uploads\/.+\.mp4$/)
    expect(result.headers).toEqual({ 'Content-Length': '1234', 'Content-Type': 'video/mp4' })
  })
})
