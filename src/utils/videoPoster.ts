import type { AppSettings } from '../types'
import { getContentPlacement } from './canvasRenderer'
import { loadImage } from './imageLoader'

function drawPageBackground(
  ctx: CanvasRenderingContext2D,
  settings: AppSettings,
  bgImage: HTMLImageElement | null,
) {
  if (!settings.useSolidBackground && bgImage) {
    ctx.drawImage(bgImage, 0, 0, settings.backgroundWidth, settings.backgroundHeight)
    return
  }
  ctx.fillStyle = settings.backgroundColor
  ctx.fillRect(0, 0, settings.backgroundWidth, settings.backgroundHeight)
}

export function loadVideoElement(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.onloadeddata = () => resolve(video)
    video.onerror = () => reject(new Error('Failed to load video'))
    video.src = src
  })
}

export async function captureVideoPageThumbnail(
  settings: AppSettings,
  videoObjectUrl: string,
): Promise<string> {
  const video = await loadVideoElement(videoObjectUrl)
  video.currentTime = 0

  await new Promise<void>((resolve) => {
    if (video.readyState >= 2) {
      resolve()
      return
    }
    video.onseeked = () => resolve()
    window.setTimeout(() => resolve(), 500)
  })

  const vw = video.videoWidth || 640
  const vh = video.videoHeight || 360

  const bgImage = settings.backgroundImageDataUrl
    ? await loadImage(settings.backgroundImageDataUrl)
    : null

  const canvas = document.createElement('canvas')
  canvas.width = settings.backgroundWidth
  canvas.height = settings.backgroundHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  drawPageBackground(ctx, settings, bgImage)

  const placement = getContentPlacement(vw, vh, settings, 1, null)
  ctx.drawImage(video, placement.drawX, placement.drawY, placement.drawW, placement.drawH)

  video.removeAttribute('src')
  video.load()

  return canvas.toDataURL('image/jpeg', 0.85)
}
