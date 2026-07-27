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
