import type { AppSettings, CollageRenderOptions, MagnifierOverlay } from '../types'
import { COLLAGE_TITLE_HEIGHT_RATIO, getCollageSlots } from '../config/collage'
import { applyOverlayTintOpacity, DEFAULT_OVERLAY_TINT_OPACITY, isTransparentOverlayTint } from '../config/overlayTintColors'
import { enhanceOverlayPatch } from './imageEnhance'
import { loadImage } from './imageLoader'

export type ContentPlacement = {
  drawX: number
  drawY: number
  drawW: number
  drawH: number
  scale: number
}

export function getContentPlacement(
  imageWidth: number,
  imageHeight: number,
  settings: AppSettings,
): ContentPlacement {
  const contentX = (settings.backgroundWidth - settings.contentWidth) / 2
  const contentY = (settings.backgroundHeight - settings.contentHeight) / 2
  const scale = Math.max(
    settings.contentWidth / imageWidth,
    settings.contentHeight / imageHeight,
  )
  const drawW = imageWidth * scale
  const drawH = imageHeight * scale

  return {
    drawX: contentX + (settings.contentWidth - drawW) / 2,
    drawY: contentY + (settings.contentHeight - drawH) / 2,
    drawW,
    drawH,
    scale,
  }
}

export function getContentBounds(settings: AppSettings) {
  return {
    x: (settings.backgroundWidth - settings.contentWidth) / 2,
    y: (settings.backgroundHeight - settings.contentHeight) / 2,
    width: settings.contentWidth,
    height: settings.contentHeight,
  }
}

function drawBackground(ctx: CanvasRenderingContext2D, settings: AppSettings, bgImage: HTMLImageElement | null) {
  if (!settings.useSolidBackground && bgImage) {
    ctx.drawImage(bgImage, 0, 0, settings.backgroundWidth, settings.backgroundHeight)
    return
  }

  ctx.fillStyle = settings.backgroundColor
  ctx.fillRect(0, 0, settings.backgroundWidth, settings.backgroundHeight)
}

function drawBlurredContent(
  ctx: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  placement: ContentPlacement,
  blurAmount: number,
) {
  const temp = document.createElement('canvas')
  temp.width = placement.drawW
  temp.height = placement.drawH
  const tempCtx = temp.getContext('2d')
  if (!tempCtx) return

  tempCtx.filter = `blur(${blurAmount}px)`
  tempCtx.drawImage(sourceImage, 0, 0, placement.drawW, placement.drawH)
  ctx.drawImage(temp, placement.drawX, placement.drawY, placement.drawW, placement.drawH)
}

function drawMagnifiedOverlay(
  ctx: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  overlay: MagnifierOverlay,
  placement: ContentPlacement,
  settings: AppSettings,
) {
  const inset = overlay.type === 'marker' ? settings.markerDetection.markerInset / placement.scale : 0
  const srcX = overlay.rect.x * sourceImage.naturalWidth + inset
  const srcY = overlay.rect.y * sourceImage.naturalHeight + inset
  const srcW = overlay.rect.w * sourceImage.naturalWidth - inset * 2
  const srcH = overlay.rect.h * sourceImage.naturalHeight - inset * 2

  if (srcW <= 0 || srcH <= 0) return

  const dest = getOverlayDestRect(overlay, placement, settings)
  if (!dest) return

  const { destX, destY, destW, destH } = dest

  const patch = document.createElement('canvas')
  patch.width = Math.ceil(srcW)
  patch.height = Math.ceil(srcH)
  const patchCtx = patch.getContext('2d')
  if (!patchCtx) return

  patchCtx.drawImage(sourceImage, srcX, srcY, srcW, srcH, 0, 0, patch.width, patch.height)

  enhanceOverlayPatch(
    patchCtx,
    patch.width,
    patch.height,
    settings.overlayContrast ?? 1,
    settings.overlaySharpness ?? 0,
  )

  if (!isTransparentOverlayTint(settings.overlayTintPreset)) {
    patchCtx.globalCompositeOperation = 'source-atop'
    patchCtx.fillStyle = applyOverlayTintOpacity(
      settings.overlayTintColor,
      settings.overlayTintOpacity ?? DEFAULT_OVERLAY_TINT_OPACITY,
    )
    patchCtx.fillRect(0, 0, patch.width, patch.height)
    patchCtx.globalCompositeOperation = 'source-over'
  }

  ctx.drawImage(patch, destX, destY, destW, destH)
  ctx.strokeStyle = '#000000'
  ctx.lineWidth = settings.overlayBorderWidth
  ctx.strokeRect(destX, destY, destW, destH)
}

export function getOverlayDestRect(
  overlay: MagnifierOverlay,
  placement: ContentPlacement,
  settings: AppSettings,
): { destX: number; destY: number; destW: number; destH: number } | null {
  const zoom = settings.defaultZoomFactor * overlay.userScale
  const markerDestW = overlay.rect.w * placement.drawW
  const markerDestH = overlay.rect.h * placement.drawH
  const destW = markerDestW * zoom
  const destH = markerDestH * zoom

  const markerDestX = placement.drawX + overlay.rect.x * placement.drawW
  const markerDestY = placement.drawY + overlay.rect.y * placement.drawH
  let destX = markerDestX + (markerDestW - destW) / 2
  let destY = markerDestY + (markerDestH - destH) / 2

  const contentX = (settings.backgroundWidth - settings.contentWidth) / 2
  if (destW > settings.contentWidth) {
    destX = contentX + (settings.contentWidth - destW) / 2
  }

  destX += overlay.offsetX ?? 0
  destY += overlay.offsetY ?? 0

  return { destX, destY, destW, destH }
}

export async function renderPageToCanvas(
  canvas: HTMLCanvasElement,
  settings: AppSettings,
  sourceImageDataUrl: string,
  overlays: MagnifierOverlay[],
): Promise<void> {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = settings.backgroundWidth
  canvas.height = settings.backgroundHeight

  const sourceImage = await loadImage(sourceImageDataUrl)
  const bgImage = settings.backgroundImageDataUrl
    ? await loadImage(settings.backgroundImageDataUrl)
    : null

  drawBackground(ctx, settings, bgImage)

  const placement = getContentPlacement(
    sourceImage.naturalWidth,
    sourceImage.naturalHeight,
    settings,
  )

  const contentBounds = getContentBounds(settings)
  ctx.save()
  ctx.beginPath()
  ctx.rect(contentBounds.x, contentBounds.y, contentBounds.width, contentBounds.height)
  ctx.clip()
  drawBlurredContent(ctx, sourceImage, placement, settings.blurAmount)
  ctx.restore()

  for (const overlay of overlays) {
    drawMagnifiedOverlay(ctx, sourceImage, overlay, placement, settings)
  }
}

export async function renderPageToDataUrl(
  settings: AppSettings,
  sourceImageDataUrl: string,
  overlays: MagnifierOverlay[],
  mimeType = 'image/png',
  quality?: number,
): Promise<string> {
  const canvas = document.createElement('canvas')
  await renderPageToCanvas(canvas, settings, sourceImageDataUrl, overlays)
  if (mimeType === 'image/jpeg' && quality !== undefined) {
    return canvas.toDataURL(mimeType, quality)
  }
  return canvas.toDataURL(mimeType)
}

function drawCollageSlotTitle(
  ctx: CanvasRenderingContext2D,
  text: string,
  slotX: number,
  slotY: number,
  slotW: number,
  titleHeight: number,
) {
  if (!text.trim()) return

  ctx.save()
  ctx.fillStyle = '#ffffff'
  const fontSize = Math.max(28, Math.round(titleHeight * 0.52))
  ctx.font = `italic bold ${fontSize}px Arial, Helvetica, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text.toUpperCase(), slotX + slotW / 2, slotY + titleHeight / 2)
  ctx.restore()
}

function drawCollageSlotImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  slotX: number,
  slotY: number,
  slotW: number,
  slotH: number,
  titleHeight: number,
  padding: number,
  imageScale = 1,
) {
  const contentX = slotX + padding
  const contentY = slotY + titleHeight
  const contentW = slotW - padding * 2
  const contentH = slotH - titleHeight - padding

  if (contentW <= 0 || contentH <= 0) return

  const drawH = contentH * imageScale
  const scale = drawH / image.naturalHeight
  const drawW = image.naturalWidth * scale
  const drawX = contentX + (contentW - drawW) / 2
  const drawY = contentY + (contentH - drawH) / 2

  ctx.save()
  ctx.beginPath()
  ctx.rect(contentX, contentY, contentW, contentH)
  ctx.clip()
  ctx.drawImage(image, drawX, drawY, drawW, drawH)
  ctx.restore()
}

function drawCollageCenterDivider(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  startY: number,
) {
  ctx.save()
  ctx.strokeStyle = '#ffffff'
  ctx.lineWidth = 3
  ctx.setLineDash([14, 10])
  ctx.beginPath()
  ctx.moveTo(canvasWidth / 2, startY)
  ctx.lineTo(canvasWidth / 2, canvasHeight)
  ctx.stroke()
  ctx.restore()
}

export async function renderCollageToDataUrl(
  pageDataUrls: string[],
  settings: AppSettings,
  options: CollageRenderOptions = { titles: [] },
): Promise<string> {
  const images = await Promise.all(pageDataUrls.map(loadImage))
  const canvas = document.createElement('canvas')
  canvas.width = settings.backgroundWidth
  canvas.height = settings.backgroundHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const bgImage = settings.backgroundImageDataUrl
    ? await loadImage(settings.backgroundImageDataUrl)
    : null

  drawBackground(ctx, settings, bgImage)

  const showTitles = options.showTitles ?? true
  const titleHeight = showTitles ? Math.round(canvas.height * COLLAGE_TITLE_HEIGHT_RATIO) : 0
  const slotPadding = 6

  const slots = getCollageSlots(images.length)

  images.forEach((image, index) => {
    const slot = slots[index]
    if (!slot) return

    const slotX = slot.x * canvas.width
    const slotY = slot.y * canvas.height
    const slotW = slot.w * canvas.width
    const slotH = slot.h * canvas.height
    const title = options.titles[index] ?? ''
    const imageScale = options.imageScales?.[index] ?? 1

    if (showTitles) {
      drawCollageSlotTitle(ctx, title, slotX, slotY, slotW, titleHeight)
    }
    drawCollageSlotImage(
      ctx,
      image,
      slotX,
      slotY,
      slotW,
      slotH,
      titleHeight,
      slotPadding,
      imageScale,
    )
  })

  if (options.showCenterDivider) {
    drawCollageCenterDivider(
      ctx,
      canvas.width,
      canvas.height,
      showTitles ? titleHeight * 0.6 : 0,
    )
  }

  return canvas.toDataURL('image/png')
}
