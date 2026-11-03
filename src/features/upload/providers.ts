export const MEDIA_LIMITS = {
  videoBytes: 12 * 1024 * 1024,
  posterBytes: 100 * 1024,
  productImageBytes: 200 * 1024,
  profileImageBytes: 1024 * 1024,
  durationSeconds: 45,
} as const

export type UploadKind = 'video' | 'poster' | 'product-image' | 'profile-image'

export type UploadRequest = {
  kind: UploadKind
  contentType: 'video/mp4' | 'image/webp'
  contentLength: number
}

export type PresignedUpload = {
  key: string
  url: string
  expiresAt: string
  headers: Record<string, string>
  publicUrl?: string
}

export interface StorageProvider {
  createUploadUrl(request: UploadRequest, userId: string): Promise<PresignedUpload>
  head(key: string): Promise<{ contentLength: number; contentType: string } | null>
  delete(key: string): Promise<void>
  list(prefix?: string): Promise<Array<{ key: string; uploadedAt?: Date }>>
}

export interface VideoProvider {
  compress(input: File, onProgress?: (progress: number) => void, signal?: AbortSignal): Promise<Blob>
  createPoster(input: Blob, signal?: AbortSignal): Promise<Blob>
  compressProductImage(input: File, signal?: AbortSignal): Promise<Blob>
  compressProfileImage(input: File, signal?: AbortSignal): Promise<Blob>
}
