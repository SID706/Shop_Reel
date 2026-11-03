import type { Session } from '@supabase/supabase-js'
import type { PresignedUpload, UploadKind } from './providers'

export async function requestUploadUrl(
  session: Session,
  kind: UploadKind,
  file: Blob,
): Promise<PresignedUpload> {
  const contentType = kind === 'video' ? 'video/mp4' : 'image/webp'
  const response = await fetch('/api/upload-url', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ kind, contentType, contentLength: file.size }),
  })
  const body = await response.json() as { error?: string; upload?: PresignedUpload }
  if (!response.ok || !body.upload) throw new Error(body.error ?? 'Unable to prepare upload')
  return body.upload
}

export async function putWithProgress(
  upload: PresignedUpload,
  file: Blob,
  onProgress: (progress: number) => void,
  signal?: AbortSignal,
) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', upload.url)
    Object.entries(upload.headers).forEach(([name, value]) => xhr.setRequestHeader(name, value))
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300
      ? resolve()
      : reject(new Error(`Storage upload failed (${xhr.status})`))
    xhr.onerror = () => reject(new Error('Storage upload failed; retry the upload'))
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'))
    signal?.addEventListener('abort', () => xhr.abort(), { once: true })
    xhr.send(file)
  })
}
