import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { MEDIA_LIMITS, type VideoProvider } from './providers'

let ffmpegPromise: Promise<{ ffmpeg: FFmpeg; fetchFile: (file: Blob | string) => Promise<Uint8Array> }> | undefined

async function loadFfmpeg(onProgress?: (progress: number) => void) {
  if (!ffmpegPromise) {
    ffmpegPromise = (async () => {
      const [{ FFmpeg }, { fetchFile, toBlobURL }] = await Promise.all([import('@ffmpeg/ffmpeg'), import('@ffmpeg/util')])
      const ffmpeg = new FFmpeg()
      ffmpeg.on('progress', ({ progress }) => onProgress?.(Math.max(0, Math.min(1, progress))))
      const base = 'https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd'
      await ffmpeg.load({
        coreURL: await toBlobURL(`${base}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${base}/ffmpeg-core.wasm`, 'application/wasm'),
      })
      return { ffmpeg, fetchFile }
    })()
  }
  return ffmpegPromise
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Upload cancelled', 'AbortError')
}

async function canvasWebp(blob: Blob, maxBytes: number, signal?: AbortSignal) {
  throwIfAborted(signal)
  const bitmap = await createImageBitmap(blob)
  try {
    const scale = Math.min(1, 720 / bitmap.width, 1280 / bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Unable to create image encoder')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    for (let quality = 0.85; quality >= 0.2; quality -= 0.1) {
      throwIfAborted(signal)
      const candidate = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
      if (candidate && candidate.size <= maxBytes) return candidate
    }
    throw new Error(`Image must be smaller than ${Math.round(maxBytes / 1024)}KB`)
  } finally {
    bitmap.close()
  }
}

export const browserVideoProvider: VideoProvider = {
  async compress(input, onProgress, signal) {
    throwIfAborted(signal)
    if (input.size === 0 || !input.type.startsWith('video/')) throw new Error('Select a video file')
    const loaded = await loadFfmpeg(onProgress)
    const ffmpeg = loaded.ffmpeg
    const cancel = () => {
      void ffmpeg.terminate()
      ffmpegPromise = undefined
    }
    signal?.addEventListener('abort', cancel, { once: true })
    throwIfAborted(signal)
    await ffmpeg.writeFile('input', await loaded.fetchFile(input))
    try {
      await ffmpeg.exec([
        '-threads', '1', '-i', 'input', '-t', String(MEDIA_LIMITS.durationSeconds),
        '-vf', 'scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2',
        '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        '-an', 'output.mp4',
      ])
      throwIfAborted(signal)
      const output = await ffmpeg.readFile('output.mp4')
      const result = new Blob([output], { type: 'video/mp4' })
      if (result.size > MEDIA_LIMITS.videoBytes) throw new Error('Compressed video must be smaller than 12MB')
      return result
    } finally {
      await ffmpeg.deleteFile('input').catch(() => undefined)
      await ffmpeg.deleteFile('output.mp4').catch(() => undefined)
      signal?.removeEventListener('abort', cancel)
    }
  },

  async createPoster(input, signal) {
    throwIfAborted(signal)
    const url = URL.createObjectURL(input)
    try {
      const video = document.createElement('video')
      video.preload = 'metadata'
      video.muted = true
      video.src = url
      await new Promise<void>((resolve, reject) => {
        video.onloadeddata = () => resolve()
        video.onerror = () => reject(new Error('Unable to read compressed video'))
      })
      const canvas = document.createElement('canvas')
      const scale = Math.min(1, 720 / video.videoWidth, 1280 / video.videoHeight)
      canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
      canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
      const poster = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.8))
      if (!poster || poster.size > MEDIA_LIMITS.posterBytes) {
        throw new Error('Poster image must be smaller than 100KB')
      }
      return poster
    } finally {
      URL.revokeObjectURL(url)
    }
  },

  async compressProductImage(input, signal) {
    if (!input.type.startsWith('image/')) throw new Error('Select a product image')
    return canvasWebp(input, MEDIA_LIMITS.productImageBytes, signal)
  },
}
