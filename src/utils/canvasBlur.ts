let canvasFilterSupported: boolean | undefined

/** Safari (pre-18.2) exposes `filter` but silently ignores it — WebKit #198416. */
export function supportsCanvasFilter(): boolean {
  if (canvasFilterSupported !== undefined) return canvasFilterSupported

  try {
    const source = document.createElement('canvas')
    source.width = 24
    source.height = 24
    const sourceCtx = source.getContext('2d')
    if (!sourceCtx) {
      canvasFilterSupported = false
      return false
    }

    sourceCtx.fillStyle = '#000000'
    sourceCtx.fillRect(0, 0, 24, 24)
    sourceCtx.fillStyle = '#ffffff'
    sourceCtx.fillRect(0, 0, 12, 24)

    const probe = document.createElement('canvas')
    probe.width = 24
    probe.height = 24
    const probeCtx = probe.getContext('2d')
    if (!probeCtx || !('filter' in probeCtx)) {
      canvasFilterSupported = false
      return false
    }

    probeCtx.drawImage(source, 0, 0)
    const before = probeCtx.getImageData(10, 12, 1, 1).data[0]

    probeCtx.clearRect(0, 0, 24, 24)
    probeCtx.filter = 'blur(8px)'
    probeCtx.drawImage(source, 0, 0)
    probeCtx.filter = 'none'
    const after = probeCtx.getImageData(10, 12, 1, 1).data[0]

    canvasFilterSupported = before > 200 && after < before - 20
  } catch {
    canvasFilterSupported = false
  }

  return canvasFilterSupported
}

function scaleBlurCanvas(source: HTMLCanvasElement, blurPx: number): HTMLCanvasElement {
  const width = source.width
  const height = source.height
  const factor = Math.max(2, Math.min(32, Math.round(blurPx * 0.75) + 2))

  const small = document.createElement('canvas')
  small.width = Math.max(1, Math.round(width / factor))
  small.height = Math.max(1, Math.round(height / factor))
  const smallCtx = small.getContext('2d')
  if (!smallCtx) return source

  smallCtx.imageSmoothingEnabled = true
  smallCtx.imageSmoothingQuality = 'high'
  smallCtx.drawImage(source, 0, 0, small.width, small.height)

  const output = document.createElement('canvas')
  output.width = width
  output.height = height
  const outputCtx = output.getContext('2d')
  if (!outputCtx) return source

  outputCtx.imageSmoothingEnabled = true
  outputCtx.imageSmoothingQuality = 'high'
  outputCtx.drawImage(small, 0, 0, width, height)

  return output
}

function filterBlurCanvas(source: HTMLCanvasElement, blurPx: number): HTMLCanvasElement | null {
  const output = document.createElement('canvas')
  output.width = source.width
  output.height = source.height
  const outputCtx = output.getContext('2d')
  if (!outputCtx) return null

  outputCtx.filter = `blur(${blurPx}px)`
  outputCtx.drawImage(source, 0, 0)
  outputCtx.filter = 'none'

  return output
}

/** Blur a canvas; uses native filter when supported, scale fallback on Safari. */
export function blurCanvas(source: HTMLCanvasElement, blurPx: number): HTMLCanvasElement {
  if (blurPx <= 0) return source

  if (supportsCanvasFilter()) {
    const filtered = filterBlurCanvas(source, blurPx)
    if (filtered) return filtered
  }

  let current = source
  let remaining = blurPx

  while (remaining > 0) {
    const pass = Math.min(remaining, 10)
    current = scaleBlurCanvas(current, pass)
    remaining -= pass
  }

  return current
}
