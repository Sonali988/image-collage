import type { MarkerDetectionSettings, MarkerRect, MagnifierOverlay } from '../types'
import { createId } from './imageLoader'

const MAX_DETECTION_DIMENSION = 1600

type Rgb = { r: number; g: number; b: number }

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  let h = 0
  let s = 0

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      default:
        h = ((r - g) / d + 4) / 6
    }
  }

  return { h: h * 360, s, l }
}

function isGreenMarker(pixel: Rgb, settings: MarkerDetectionSettings): boolean {
  const { h, s, l } = rgbToHsl(pixel.r, pixel.g, pixel.b)
  const greenDominant = pixel.g > pixel.r * 1.2 && pixel.g > pixel.b * 1.2
  return (
    greenDominant &&
    h >= settings.hueMin &&
    h <= settings.hueMax &&
    s >= settings.satMin &&
    l >= settings.lightMin &&
    l <= settings.lightMax
  )
}

function findConnectedRegions(
  mask: Uint8Array,
  width: number,
  height: number,
  minArea: number,
): MarkerRect[] {
  const visited = new Uint8Array(mask.length)
  const regions: MarkerRect[] = []

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const startIdx = y * width + x
      if (!mask[startIdx] || visited[startIdx]) continue

      let minX = x
      let maxX = x
      let minY = y
      let maxY = y
      let area = 0
      const queue = [startIdx]
      visited[startIdx] = 1

      while (queue.length > 0) {
        const current = queue.shift()!
        const cx = current % width
        const cy = Math.floor(current / width)
        area++

        minX = Math.min(minX, cx)
        maxX = Math.max(maxX, cx)
        minY = Math.min(minY, cy)
        maxY = Math.max(maxY, cy)

        const neighbors = [
          { idx: current - 1, nx: cx - 1, ny: cy },
          { idx: current + 1, nx: cx + 1, ny: cy },
          { idx: current - width, nx: cx, ny: cy - 1 },
          { idx: current + width, nx: cx, ny: cy + 1 },
        ]

        for (const neighbor of neighbors) {
          if (
            neighbor.nx < 0 ||
            neighbor.nx >= width ||
            neighbor.ny < 0 ||
            neighbor.ny >= height
          ) {
            continue
          }
          if (!mask[neighbor.idx] || visited[neighbor.idx]) continue
          visited[neighbor.idx] = 1
          queue.push(neighbor.idx)
        }
      }

      if (area >= minArea) {
        regions.push({
          x: minX / width,
          y: minY / height,
          w: (maxX - minX + 1) / width,
          h: (maxY - minY + 1) / height,
        })
      }
    }
  }

  return regions.sort((a, b) => a.y - b.y || a.x - b.x)
}

export function detectGreenMarkers(
  image: HTMLImageElement,
  settings: MarkerDetectionSettings,
): MagnifierOverlay[] {
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight)
  const scale =
    longestSide > MAX_DETECTION_DIMENSION ? MAX_DETECTION_DIMENSION / longestSide : 1
  const detectWidth = Math.max(1, Math.round(image.naturalWidth * scale))
  const detectHeight = Math.max(1, Math.round(image.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = detectWidth
  canvas.height = detectHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  ctx.drawImage(image, 0, 0, detectWidth, detectHeight)
  const { data, width, height } = ctx.getImageData(0, 0, detectWidth, detectHeight)
  const mask = new Uint8Array(width * height)

  for (let i = 0; i < data.length; i += 4) {
    const pixel = { r: data[i], g: data[i + 1], b: data[i + 2] }
    mask[i / 4] = isGreenMarker(pixel, settings) ? 1 : 0
  }

  const scaledMinArea = Math.max(25, Math.round(settings.minMarkerArea * scale * scale))
  const regions = findConnectedRegions(mask, width, height, scaledMinArea)

  return regions.map((rect, index) => ({
    id: createId(),
    label: `Marker ${index + 1}`,
    type: 'marker' as const,
    rect,
    userScale: 1,
    offsetX: 0,
    offsetY: 0,
  }))
}
