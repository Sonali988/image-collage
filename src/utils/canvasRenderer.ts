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
  documentScale = 1,
  documentCropRect?: MarkerRect | null,
): ContentPlacement {
  const contentX = (settings.backgroundWidth - settings.contentWidth) / 2
  const contentY = (settings.backgroundHeight - settings.contentHeight) / 2
  if (imageWidth <= 0 || imageHeight <= 0) {
    return {
      drawX: contentX,
      drawY: contentY,
      drawW: settings.contentWidth,
      drawH: settings.contentHeight,
      scale: 1,
    }
  }

  const crop =
    documentCropRect && documentCropRect.w > 0 && documentCropRect.h > 0
      ? documentCropRect
      : null
  const srcW = crop ? crop.w * imageWidth : imageWidth
  const srcH = crop ? crop.h * imageHeight : imageHeight

  const fit = Math.min(settings.contentWidth / srcW, settings.contentHeight / srcH)
  const baseW = srcW * fit
  const baseH = srcH * fit
  const maxZoom = Math.max(
    1,
    Math.min(settings.backgroundWidth / baseW, settings.backgroundHeight / baseH),
  )
  const requested = Number.isFinite(documentScale) && documentScale > 0 ? documentScale : 1
  const zoom = Math.min(requested, maxZoom)
  const scale = fit * zoom
  const visibleW = srcW * scale
  const visibleH = srcH * scale
  const visibleX = contentX + (settings.contentWidth - visibleW) / 2
  const visibleY = contentY + (settings.contentHeight - visibleH) / 2

  if (!crop) {
    return {
      drawX: visibleX,
      drawY: visibleY,
      drawW: visibleW,
      drawH: visibleH,
      scale,
    }
  }

  const drawW = visibleW / crop.w
  const drawH = visibleH / crop.h
  return {
    drawX: visibleX - crop.x * drawW,
    drawY: visibleY - crop.y * drawH,
    drawW,
    drawH,
    scale,
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

function visibleCropRect(placement: ContentPlacement, documentCropRect: MarkerRect) {
  return {
    x: placement.drawX + documentCropRect.x * placement.drawW,
    y: placement.drawY + documentCropRect.y * placement.drawH,
    w: documentCropRect.w * placement.drawW,
    h: documentCropRect.h * placement.drawH,
  }
}

function visibleSourceRect(documentCropRect?: MarkerRect | null): MarkerRect {
  if (documentCropRect && documentCropRect.w > 0 && documentCropRect.h > 0) {
    return documentCropRect
  }
  return { x: 0, y: 0, w: 1, h: 1 }
}

/** Place a pasted overlay inside the currently visible document, not off-canvas. */
export function placePastedOverlayInVisibleArea(
  clipboard: Pick<MagnifierOverlay, 'rect' | 'userScale'>,
  imageWidth: number,
  imageHeight: number,
  settings: AppSettings,
  documentScale = 1,
  documentCropRect?: MarkerRect | null,
): Pick<MagnifierOverlay, 'rect' | 'offsetX' | 'offsetY' | 'userScale'> {
  const visible = visibleSourceRect(documentCropRect)
  const w = Math.min(Math.max(clipboard.rect.w, 0.04), visible.w)
  const h = Math.min(Math.max(clipboard.rect.h, 0.04), visible.h)
  const rect: MarkerRect = {
    x: visible.x + (visible.w - w) / 2,
    y: visible.y + (visible.h - h) / 2,
    w,
    h,
  }

  let userScale = clipboard.userScale > 0 ? clipboard.userScale : 1
  const placement = getContentPlacement(
    imageWidth,
    imageHeight,
    settings,
    documentScale,
    documentCropRect,
  )
  const bounds =
    documentCropRect && documentCropRect.w > 0 && documentCropRect.h > 0
      ? visibleCropRect(placement, documentCropRect)
      : {
          x: 0,
          y: 0,
          w: settings.backgroundWidth,
          h: settings.backgroundHeight,
        }

  const measure = (scale: number) =>
    getOverlayDestRect(
      {
        id: 'paste-preview',
        label: '',
        type: 'crop',
        rect,
        userScale: scale,
        offsetX: 0,
        offsetY: 0,
      },
      placement,
      settings,
    )

  let dest = measure(userScale)
  if (dest && bounds.h > 0 && dest.destH > bounds.h) {
    userScale = Math.max(0.25, userScale * (bounds.h / dest.destH))
    dest = measure(userScale)
  }
  if (dest && bounds.w > 0 && dest.destW > bounds.w) {
    userScale = Math.max(0.25, userScale * (bounds.w / dest.destW))
    dest = measure(userScale)
  }

  let offsetX = 0
  let offsetY = 0
  if (dest) {
    let destX = dest.destX
    let destY = dest.destY
    if (destX + dest.destW > bounds.x + bounds.w) destX = bounds.x + bounds.w - dest.destW
    if (destY + dest.destH > bounds.y + bounds.h) destY = bounds.y + bounds.h - dest.destH
    if (destX < bounds.x) destX = bounds.x
    if (destY < bounds.y) destY = bounds.y
    offsetX = destX - dest.destX
    offsetY = destY - dest.destY
  }

  return { rect, offsetX, offsetY, userScale }
}

function drawBlurredContent(
  ctx: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  placement: ContentPlacement,
  blurAmount: number,
) {
  const blurPx = Math.max(0, Number(blurAmount) || 0)

  if (blurPx <= 0) {
    ctx.drawImage(
      sourceImage,
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

  sourceCtx.drawImage(sourceImage, pad, pad, destW, destH)

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

async function drawMagnifiedOverlay(
  ctx: CanvasRenderingContext2D,
  sourceImage: HTMLImageElement,
  overlay: MagnifierOverlay,
  placement: ContentPlacement,
  settings: AppSettings,
) {
  const dest = getOverlayDestRect(overlay, placement, settings)
  if (!dest) return

  const { destX, destY, destW, destH } = dest
  const patch = document.createElement('canvas')
  const patchCtx = patch.getContext('2d')
  if (!patchCtx) return

  if (overlay.patchImageDataUrl) {
    const pasted = await loadImage(overlay.patchImageDataUrl)
    const crop = overlay.patchCropRect
    const srcX = crop ? crop.x * pasted.naturalWidth : 0
    const srcY = crop ? crop.y * pasted.naturalHeight : 0
    const srcW = crop ? crop.w * pasted.naturalWidth : pasted.naturalWidth
    const srcH = crop ? crop.h * pasted.naturalHeight : pasted.naturalHeight
    if (srcW <= 1 || srcH <= 1) return

    patch.width = Math.max(1, Math.round(srcW))
    patch.height = Math.max(1, Math.round(srcH))
    patchCtx.drawImage(pasted, srcX, srcY, srcW, srcH, 0, 0, patch.width, patch.height)
  } else {
    const inset =
      overlay.type === 'marker' ? settings.markerDetection.markerInset / placement.scale : 0
    const srcX = overlay.rect.x * sourceImage.naturalWidth + inset
    const srcY = overlay.rect.y * sourceImage.naturalHeight + inset
    const srcW = overlay.rect.w * sourceImage.naturalWidth - inset * 2
    const srcH = overlay.rect.h * sourceImage.naturalHeight - inset * 2
    if (srcW <= 0 || srcH <= 0) return

    patch.width = Math.ceil(srcW)
    patch.height = Math.ceil(srcH)
    patchCtx.drawImage(sourceImage, srcX, srcY, srcW, srcH, 0, 0, patch.width, patch.height)
  }

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
  const documentScale = renderOptions.documentScale ?? 1
  const placement = getContentPlacement(
    sourceImage.naturalWidth,
    sourceImage.naturalHeight,
    settings,
    documentScale,
    documentCropRect,
  )

  if (!renderOptions.overlaysOnly) {
    if (documentCropRect) {
      const cropDest = visibleCropRect(placement, documentCropRect)
      ctx.save()
      ctx.beginPath()
      ctx.rect(cropDest.x, cropDest.y, cropDest.w, cropDest.h)
      ctx.clip()
      drawBlurredContent(ctx, sourceImage, placement, settings.blurAmount)
      ctx.restore()
    } else {
      drawBlurredContent(ctx, sourceImage, placement, settings.blurAmount)
    }
  }

  if (!renderOptions.omitOverlays) {
    for (const overlay of overlays) {
      await drawMagnifiedOverlay(ctx, sourceImage, overlay, placement, settings)
      if (renderOptions.shouldContinue && !renderOptions.shouldContinue()) return
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
        documentScale: page.documentScale ?? 1,
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
        documentScale: page.documentScale ?? 1,
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
