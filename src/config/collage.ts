export const COLLAGE_TITLE_HEIGHT_RATIO = 0.11
export const DEFAULT_COLLAGE_IMAGE_SCALE = 1
export const MIN_COLLAGE_IMAGE_SCALE = 0.25
export const MAX_COLLAGE_IMAGE_SCALE = 1.75
export const MIN_COLLAGE_PANELS = 2
export const MAX_COLLAGE_PANELS = 3

export type CollageSlot = { x: number; y: number; w: number; h: number }

export function getCollageSlots(panelCount: number): CollageSlot[] {
  if (panelCount >= 3) {
    return [
      { x: 0, y: 0, w: 1 / 3, h: 1 },
      { x: 1 / 3, y: 0, w: 1 / 3, h: 1 },
      { x: 2 / 3, y: 0, w: 1 / 3, h: 1 },
    ]
  }

  return [
    { x: 0, y: 0, w: 0.5, h: 1 },
    { x: 0.5, y: 0, w: 0.5, h: 1 },
  ]
}

export function getTitleForPage(name: string, index: number, total: number): string {
  const lower = name.toLowerCase()
  if (lower.includes('before')) return 'BEFORE'
  if (lower.includes('after')) return 'AFTER'
  if (total === 2) return index === 0 ? 'BEFORE' : 'AFTER'
  return `Panel ${index + 1}`
}

export function buildCollageTitles(pageNames: string[]): string[] {
  return pageNames.map((name, index) => getTitleForPage(name, index, pageNames.length))
}
