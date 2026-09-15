import type { MagnifierOverlay } from '../types'

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Failed to load image'))
    img.src = src
  })
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsDataURL(file)
  })
}

export function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/** Rotate an image data URL by 90, -90, or 180 degrees. */
export async function rotateImageDataUrl(
  dataUrl: string,
  degrees: 90 | -90 | 180,
): Promise<string> {
  const image = await loadImage(dataUrl)
  const swap = degrees === 90 || degrees === -90
  const canvas = document.createElement('canvas')
  canvas.width = swap ? image.naturalHeight : image.naturalWidth
  canvas.height = swap ? image.naturalWidth : image.naturalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return dataUrl

  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((degrees * Math.PI) / 180)
  ctx.drawImage(image, -image.naturalWidth / 2, -image.naturalHeight / 2)

  return canvas.toDataURL('image/png')
}

/** Capture the pixels of an overlay zone from a source document. */
export async function extractOverlayPatch(
  sourceImageDataUrl: string,
  overlay: Pick<MagnifierOverlay, 'type' | 'rect' | 'patchImageDataUrl' | 'patchCropRect'>,
  markerInset = 0,
): Promise<string | null> {
  if (overlay.patchImageDataUrl) {
    if (!overlay.patchCropRect) return overlay.patchImageDataUrl
    const image = await loadImage(overlay.patchImageDataUrl)
    const crop = overlay.patchCropRect
    const srcX = crop.x * image.naturalWidth
    const srcY = crop.y * image.naturalHeight
    const srcW = crop.w * image.naturalWidth
    const srcH = crop.h * image.naturalHeight
    if (srcW <= 1 || srcH <= 1) return overlay.patchImageDataUrl

    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(srcW))
    canvas.height = Math.max(1, Math.round(srcH))
    const ctx = canvas.getContext('2d')
    if (!ctx) return overlay.patchImageDataUrl
    ctx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  }

  const image = await loadImage(sourceImageDataUrl)
  const inset = overlay.type === 'marker' ? markerInset : 0
  const srcX = overlay.rect.x * image.naturalWidth + inset
  const srcY = overlay.rect.y * image.naturalHeight + inset
  const srcW = overlay.rect.w * image.naturalWidth - inset * 2
  const srcH = overlay.rect.h * image.naturalHeight - inset * 2
  if (srcW <= 1 || srcH <= 1) return null

  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(srcW))
  canvas.height = Math.max(1, Math.round(srcH))
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}
