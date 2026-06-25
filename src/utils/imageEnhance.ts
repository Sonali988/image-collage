function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

function applyContrast(data: Uint8ClampedArray, contrast: number): void {
  if (contrast === 1) return

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clampByte((data[i] - 128) * contrast + 128)
    data[i + 1] = clampByte((data[i + 1] - 128) * contrast + 128)
    data[i + 2] = clampByte((data[i + 2] - 128) * contrast + 128)
  }
}

function boxBlurChannel(
  source: Uint8ClampedArray,
  width: number,
  height: number,
  channelOffset: number,
): Float32Array {
  const output = new Float32Array(width * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let count = 0

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const px = x + kx
          const py = y + ky
          if (px < 0 || px >= width || py < 0 || py >= height) continue
          sum += source[(py * width + px) * 4 + channelOffset]
          count++
        }
      }

      output[y * width + x] = sum / count
    }
  }

  return output
}

function applyUnsharpMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
): void {
  if (amount <= 0) return

  const blurredR = boxBlurChannel(data, width, height, 0)
  const blurredG = boxBlurChannel(data, width, height, 1)
  const blurredB = boxBlurChannel(data, width, height, 2)

  for (let i = 0; i < width * height; i++) {
    const offset = i * 4
    data[offset] = clampByte(data[offset] + amount * (data[offset] - blurredR[i]))
    data[offset + 1] = clampByte(data[offset + 1] + amount * (data[offset + 1] - blurredG[i]))
    data[offset + 2] = clampByte(data[offset + 2] + amount * (data[offset + 2] - blurredB[i]))
  }
}

export function enhanceOverlayPatch(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  contrast: number,
  sharpness: number,
): void {
  if (width <= 0 || height <= 0) return
  if (contrast === 1 && sharpness <= 0) return

  const imageData = ctx.getImageData(0, 0, width, height)
  applyContrast(imageData.data, contrast)
  applyUnsharpMask(imageData.data, width, height, sharpness)
  ctx.putImageData(imageData, 0, 0)
}
