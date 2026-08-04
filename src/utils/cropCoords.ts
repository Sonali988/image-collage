import type { AppSettings, MarkerRect } from '../types'
import { getContentPlacement } from './canvasRenderer'

const MIN_RECT_SIZE = 0.01

export function pointerToCanvasCoords(
  clientX: number,
  clientY: number,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY,
  }
}

export function canvasToDisplayCoords(
  canvasX: number,
  canvasY: number,
  canvas: HTMLCanvasElement,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect()
  return {
    x: (canvasX / canvas.width) * rect.width,
    y: (canvasY / canvas.height) * rect.height,
  }
}

function canvasPointToNormalized(
  canvasX: number,
  canvasY: number,
  imageWidth: number,
  imageHeight: number,
  settings: AppSettings,
): { x: number; y: number } {
  const placement = getContentPlacement(imageWidth, imageHeight, settings)
  const nx = (canvasX - placement.drawX) / placement.drawW
  const ny = (canvasY - placement.drawY) / placement.drawH
  return {
    x: Math.max(0, Math.min(1, nx)),
    y: Math.max(0, Math.min(1, ny)),
  }
}

export function normalizedRectFromCanvasDrag(
  start: { x: number; y: number },
  end: { x: number; y: number },
  imageWidth: number,
  imageHeight: number,
  settings: AppSettings,
  _documentCropRect?: MarkerRect | null,
): MarkerRect | null {
  const p1 = canvasPointToNormalized(start.x, start.y, imageWidth, imageHeight, settings)
  const p2 = canvasPointToNormalized(end.x, end.y, imageWidth, imageHeight, settings)

  let x = Math.min(p1.x, p2.x)
  let y = Math.min(p1.y, p2.y)
  let w = Math.abs(p2.x - p1.x)
  let h = Math.abs(p2.y - p1.y)

  x = Math.max(0, Math.min(1, x))
  y = Math.max(0, Math.min(1, y))
  w = Math.min(1 - x, w)
  h = Math.min(1 - y, h)

  if (w < MIN_RECT_SIZE || h < MIN_RECT_SIZE) return null
  return { x, y, w, h }
}
