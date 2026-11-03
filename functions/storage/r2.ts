import { DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type { PresignedUpload, StorageProvider, UploadRequest } from '../../src/features/upload/providers'

export type R2Env = {
  R2_BUCKET: string
  R2_ENDPOINT: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_PUBLIC_URL: string
}

export function createR2Storage(env: R2Env): StorageProvider {
  const client = new S3Client({
    region: 'auto',
    endpoint: env.R2_ENDPOINT,
    credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
  })
  return {
    async createUploadUrl(request: UploadRequest, userId: string): Promise<PresignedUpload> {
      const extension = request.kind === 'video' ? 'mp4' : 'webp'
      const key = `users/${userId}/uploads/${crypto.randomUUID()}.${extension}`
      const command = new PutObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: key,
        ContentLength: request.contentLength,
        ContentType: request.contentType,
      })
      const expiresIn = 15 * 60
      const url = await getSignedUrl(client, command, { expiresIn })
      return {
        key,
        url,
        expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
        headers: { 'Content-Length': String(request.contentLength), 'Content-Type': request.contentType },
      }
    },
    async head(key) {
      try {
        const result = await client.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET, Key: key }))
        return result.ContentLength === undefined || !result.ContentType
          ? null
          : { contentLength: result.ContentLength, contentType: result.ContentType }
      } catch (error) {
        if (error instanceof Error && error.name === 'NotFound') return null
        throw error
      }
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }))
    },
    async list(prefix) {
      const result = await client.send(new ListObjectsV2Command({ Bucket: env.R2_BUCKET, Prefix: prefix }))
      return (result.Contents ?? []).flatMap((object) => object.Key ? [{ key: object.Key, uploadedAt: object.LastModified }] : [])
    },
  }
}
