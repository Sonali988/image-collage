import type {
  AppSettings,
  CollageRenderOptions,
  MagnifierOverlay,
  MarkerRect,
  Page,
  RenderPageOptions,
} from '../types'
import { COLLAGE_TITLE_HEIGHT_RATIO, getCollageSlots } from '../config/collage'
import { applyOverlayTintOpacity, DEFAULT_OVERLAY_TINT_OPACITY, isTransparentOverlayTint } from '../config/overlayTintColors'
import { enhanceOverlayPatch } from './imageEnhance'
import { blurCanvas } from './canvasBlur'
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
  // Fit entire document inside the content area (contain) — never auto-crop.
  const scale = Math.min(
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

function drawPlaceholderBackground(ctx: CanvasRenderingContext2D, settings: AppSettings) {
  const size = 16
  ctx.fillStyle = '#1a1a22'
  ctx.fillRect(0, 0, settings.backgroundWidth, settings.backgroundHeight)
  ctx.fillStyle = '#252530'
  for (let y = 0; y < settings.backgroundHeight; y += size) {
    for (let x = 0; x < settings.backgroundWidth; x += size) {
      if ((x / size + y / size) % 2 === 0) {
        ctx.fillRect(x, y, size, size)
      }
    }
  }
}

export function mergeBackgroundSettings(pageSettings: AppSettings, globalSettings: AppSettings): AppSettings {
  return {
    ...pageSettings,
    backgroundWidth: globalSettings.backgroundWidth,
    backgroundHeight: globalSettings.backgroundHeight,
    backgroundColor: globalSettings.backgroundColor,
    useSolidBackground: globalSettings.useSolidBackground,
    backgroundImageDataUrl: globalSettings.backgroundImageDataUrl,
  }
}

function drawBlurredContent(
  ctx: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  settings: AppSettings,
  blurAmount: number,
  documentCropRect?: MarkerRect | null,
) {
  let srcX = 0
  let srcY = 0
  let srcW = sourceImage.naturalWidth
  let srcH = sourceImage.naturalHeight

  if (documentCropRect) {
    srcX = documentCropRect.x * sourceImage.naturalWidth
    srcY = documentCropRect.y * sourceImage.naturalHeight
    srcW = documentCropRect.w * sourceImage.naturalWidth
    srcH = documentCropRect.h * sourceImage.naturalHeight
  }

  const placement = getContentPlacement(srcW, srcH, settings)
  const blurPx = Math.max(0, Number(blurAmount) || 0)

  if (blurPx <= 0) {
    ctx.drawImage(
      sourceImage,
      srcX,
      srcY,
      srcW,
      srcH,
      placement.drawX,
      placement.drawY,
      placement.drawW,
      placement.drawH,
    )
    return
  }

  const destW = Math.max(1, Math.round(placement.drawW))
  const destH = Math.max(1, Math.round(placement.drawH))
  const pad = Math.ceil(blurPx * 3)

  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = destW + pad * 2
  sourceCanvas.height = destH + pad * 2
  const sourceCtx = sourceCanvas.getContext('2d')
  if (!sourceCtx) return

  sourceCtx.drawImage(sourceImage, srcX, srcY, srcW, srcH, pad, pad, destW, destH)

  const blurredCanvas = blurCanvas(sourceCanvas, blurPx)

  ctx.drawImage(
    blurredCanvas,
    pad,
    pad,
    destW,
    destH,
    placement.drawX,
    placement.drawY,
    placement.drawW,
    placement.drawH,
  )
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
  renderOptions: RenderPageOptions = {},
): Promise<void> {
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  canvas.width = settings.backgroundWidth
  canvas.height = settings.backgroundHeight

  const sourceImage = await loadImage(sourceImageDataUrl)
  if (renderOptions.shouldContinue && !renderOptions.shouldContinue()) return

  if (renderOptions.skipBackground || renderOptions.overlaysOnly) {
    if (renderOptions.showPlaceholderBackground && !renderOptions.overlaysOnly) {
      drawPlaceholderBackground(ctx, settings)
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  } else {
    const bgImage = settings.backgroundImageDataUrl
      ? await loadImage(settings.backgroundImageDataUrl)
      : null
    drawBackground(ctx, settings, bgImage)
  }

  const documentCropRect = renderOptions.documentCropRect ?? null
  const placement = getContentPlacement(
    sourceImage.naturalWidth,
    sourceImage.naturalHeight,
    settings,
  )

  if (!renderOptions.overlaysOnly) {
    const contentBounds = getContentBounds(settings)
    ctx.save()
    ctx.beginPath()
    ctx.rect(contentBounds.x, contentBounds.y, contentBounds.width, contentBounds.height)
    ctx.clip()
    drawBlurredContent(
      ctx,
      sourceImage,
      settings,
      settings.blurAmount,
      documentCropRect,
    )
    ctx.restore()
  }

  if (!renderOptions.omitOverlays) {
    for (const overlay of overlays) {
      drawMagnifiedOverlay(ctx, sourceImage, overlay, placement, settings)
    }
  }
}

export async function renderPageToDataUrl(
  settings: AppSettings,
  sourceImageDataUrl: string,
  overlays: MagnifierOverlay[],
  mimeType = 'image/png',
  quality?: number,
  renderOptions: RenderPageOptions = {},
): Promise<string> {
  const canvas = document.createElement('canvas')
  await renderPageToCanvas(canvas, settings, sourceImageDataUrl, overlays, renderOptions)
  if (mimeType === 'image/jpeg' && quality !== undefined) {
    return canvas.toDataURL(mimeType, quality)
  }
  return canvas.toDataURL(mimeType)
}

export async function renderCollagePanelDataUrls(pages: Page[]): Promise<string[]> {
  return Promise.all(
    pages.map((page) =>
      renderPageToDataUrl(page.settings, page.sourceImageDataUrl, page.overlays, 'image/png', undefined, {
        skipBackground: true,
        omitOverlays: true,
        documentCropRect: page.documentCropRect ?? null,
      }),
    ),
  )
}

async function renderCollageOverlayDataUrls(pages: Page[]): Promise<string[]> {
  return Promise.all(
    pages.map((page) =>
      renderPageToDataUrl(page.settings, page.sourceImageDataUrl, page.overlays, 'image/png', undefined, {
        skipBackground: true,
        overlaysOnly: true,
        documentCropRect: page.documentCropRect ?? null,
      }),
    ),
  )
}

export async function renderCollageFromPages(
  panelPages: Page[],
  backgroundSettings: AppSettings,
  options: CollageRenderOptions = { titles: [] },
): Promise<string> {
  const [panelDataUrls, overlayDataUrls] = await Promise.all([
    renderCollagePanelDataUrls(panelPages),
    renderCollageOverlayDataUrls(panelPages),
  ])
  return renderCollageToDataUrl(panelDataUrls, backgroundSettings, options, overlayDataUrls)
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

function getCollageSlotDrawRect(
  imageWidth: number,
  imageHeight: number,
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

  if (contentW <= 0 || contentH <= 0 || imageHeight <= 0) {
    return null
  }

  const drawH = contentH * imageScale
  const scale = drawH / imageHeight
  const drawW = imageWidth * scale
  const drawX = contentX + (contentW - drawW) / 2
  const drawY = contentY + (contentH - drawH) / 2

  return { contentX, contentY, contentW, contentH, drawX, drawY, drawW, drawH }
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
  clipToSlot = true,
) {
  const draw = getCollageSlotDrawRect(
    image.naturalWidth,
    image.naturalHeight,
    slotX,
    slotY,
    slotW,
    slotH,
    titleHeight,
    padding,
    imageScale,
  )
  if (!draw) return

  if (clipToSlot) {
    ctx.save()
    ctx.beginPath()
    ctx.rect(draw.contentX, draw.contentY, draw.contentW, draw.contentH)
    ctx.clip()
    ctx.drawImage(image, draw.drawX, draw.drawY, draw.drawW, draw.drawH)
    ctx.restore()
    return
  }

  // Magnifier overlays may intentionally overflow into neighboring panels.
  ctx.drawImage(image, draw.drawX, draw.drawY, draw.drawW, draw.drawH)
}


export async function renderCollageToDataUrl(
  pageDataUrls: string[],
  settings: AppSettings,
  options: CollageRenderOptions = { titles: [] },
  overlayDataUrls: string[] = [],
): Promise<string> {
  const images = await Promise.all(pageDataUrls.map(loadImage))
  const overlayImages = await Promise.all(overlayDataUrls.map(loadImage))
  const canvas = document.createElement('canvas')
  canvas.width = settings.backgroundWidth
  canvas.height = settings.backgroundHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const bgImage = settings.backgroundImageDataUrl
    ? await loadImage(settings.backgroundImageDataUrl)
    : null

  if (options.skipBackground) {
    if (options.showPlaceholderBackground) {
      drawPlaceholderBackground(ctx, settings)
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  } else {
    drawBackground(ctx, settings, bgImage)
  }

  const showTitles = options.showTitles ?? true
  const titleHeight = showTitles ? Math.round(canvas.height * COLLAGE_TITLE_HEIGHT_RATIO) : 0
  const slotPadding = 6

  const slots = getCollageSlots(images.length)

  // Pass 1: documents stay clipped inside their slots.
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
      true,
    )
  })

  // Pass 2: crops/markers on top, unclipped so they can overlap neighbors.
  overlayImages.forEach((image, index) => {
    const slot = slots[index]
    if (!slot) return

    const slotX = slot.x * canvas.width
    const slotY = slot.y * canvas.height
    const slotW = slot.w * canvas.width
    const slotH = slot.h * canvas.height
    const imageScale = options.imageScales?.[index] ?? 1

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
      false,
    )
  })

  return canvas.toDataURL('image/png')
}
