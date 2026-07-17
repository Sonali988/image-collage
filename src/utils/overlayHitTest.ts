import type { AppSettings, MagnifierOverlay, MarkerRect } from '../types'
import { getContentPlacement, getOverlayDestRect } from './canvasRenderer'

export type OverlayDestBox = {
  overlay: MagnifierOverlay
  destX: number
  destY: number
  destW: number
  destH: number
}

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se'

const HANDLE_HIT_PAD = 12
const MIN_RECT = 0.02

export function getOverlayDestBoxes(
  overlays: MagnifierOverlay[],
  imageWidth: number,
  imageHeight: number,
  settings: AppSettings,
  _documentCropRect?: MarkerRect | null,
): OverlayDestBox[] {
  if (imageWidth <= 0 || imageHeight <= 0) return []

  const placement = getContentPlacement(imageWidth, imageHeight, settings)
  const boxes: OverlayDestBox[] = []

  for (const overlay of overlays) {
    const dest = getOverlayDestRect(overlay, placement, settings)
    if (!dest) continue
    boxes.push({ overlay, ...dest })
  }
  return boxes
}

export function hitTestOverlay(
  canvasX: number,
  canvasY: number,
  boxes: OverlayDestBox[],
): { box: OverlayDestBox; handle: ResizeHandle | null } | null {
  for (let i = boxes.length - 1; i >= 0; i--) {
    const box = boxes[i]!
    const handle = hitTestHandle(canvasX, canvasY, box)
    if (handle) return { box, handle }

    if (
      canvasX >= box.destX &&
      canvasX <= box.destX + box.destW &&
      canvasY >= box.destY &&
      canvasY <= box.destY + box.destH
    ) {
      return { box, handle: null }
    }
  }
  return null
}

function hitTestHandle(
  canvasX: number,
  canvasY: number,
  box: OverlayDestBox,
): ResizeHandle | null {
  const left = box.destX
  const right = box.destX + box.destW
  const top = box.destY
  const bottom = box.destY + box.destH
  const cx = left + box.destW / 2
  const cy = top + box.destH / 2

  const points: { handle: ResizeHandle; x: number; y: number }[] = [
    { handle: 'nw', x: left, y: top },
    { handle: 'ne', x: right, y: top },
    { handle: 'sw', x: left, y: bottom },
    { handle: 'se', x: right, y: bottom },
    { handle: 'n', x: cx, y: top },
    { handle: 's', x: cx, y: bottom },
    { handle: 'w', x: left, y: cy },
    { handle: 'e', x: right, y: cy },
  ]

  let best: ResizeHandle | null = null
  let bestDist = HANDLE_HIT_PAD
  for (const point of points) {
    const dist = Math.hypot(canvasX - point.x, canvasY - point.y)
    if (dist <= bestDist) {
      bestDist = dist
      best = point.handle
    }
  }
  return best
}

function clampRect(rect: MarkerRect): MarkerRect {
  let { x, y, w, h } = rect
  w = Math.max(MIN_RECT, Math.min(1, w))
  h = Math.max(MIN_RECT, Math.min(1, h))
  x = Math.max(0, Math.min(1 - w, x))
  y = Math.max(0, Math.min(1 - h, y))
  return { x, y, w, h }
}

/** Resize the source crop rect from a canvas-space handle drag. */
export function resizeOverlaySourceRect(
  originRect: MarkerRect,
  handle: ResizeHandle,
  deltaCanvasX: number,
  deltaCanvasY: number,
  userScale: number,
  imageWidth: number,
  imageHeight: number,
  settings: AppSettings,
  _documentCropRect?: MarkerRect | null,
): MarkerRect {
  const placement = getContentPlacement(imageWidth, imageHeight, settings)
  const zoom = Math.max(0.01, settings.defaultZoomFactor * userScale)
  const dW = deltaCanvasX / (placement.drawW * zoom)
  const dH = deltaCanvasY / (placement.drawH * zoom)

  let { x, y, w, h } = originRect

  if (handle === 'e' || handle === 'ne' || handle === 'se') {
    w = originRect.w + dW
  } else if (handle === 'w' || handle === 'nw' || handle === 'sw') {
    x = originRect.x + dW
    w = originRect.w - dW
  }

  if (handle === 's' || handle === 'se' || handle === 'sw') {
    h = originRect.h + dH
  } else if (handle === 'n' || handle === 'ne' || handle === 'nw') {
    y = originRect.y + dH
    h = originRect.h - dH
  }

  return clampRect({ x, y, w, h })
}

export const HANDLE_CURSOR: Record<ResizeHandle, string> = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
}
