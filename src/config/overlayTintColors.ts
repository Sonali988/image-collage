import type { OverlayTintPreset } from '../types'

const TINT_ALPHA = 0.35

export const DEFAULT_OVERLAY_TINT_OPACITY = TINT_ALPHA
export const MIN_OVERLAY_TINT_OPACITY = 0.05
export const MAX_OVERLAY_TINT_OPACITY = 1

export type OverlayColorOption = {
  id: string
  label: string
  swatch: string
  color: string
  preset?: OverlayTintPreset
}

function hexToRgbaTint(hex: string, alpha = TINT_ALPHA): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function paletteColor(id: string, label: string, swatch: string): OverlayColorOption {
  return { id, label, swatch, color: hexToRgbaTint(swatch) }
}

/** Full overlay color palette — all choices live in the picker popup */
export const OVERLAY_COLOR_PALETTE: OverlayColorOption[] = [
  // Reds
  paletteColor('crimson', 'Crimson', '#b71c1c'),
  paletteColor('red', 'Red', '#dc5064'),
  paletteColor('rose', 'Rose', '#e53935'),
  paletteColor('salmon', 'Salmon', '#ef5350'),
  paletteColor('cherry', 'Cherry', '#c62828'),
  paletteColor('scarlet', 'Scarlet', '#d32f2f'),
  paletteColor('brick', 'Brick', '#a52714'),
  paletteColor('wine', 'Wine', '#880e4f'),
  paletteColor('pink', 'Pink', '#ec5a96'),
  // Oranges & yellows
  paletteColor('brown', 'Brown', '#bf360c'),
  paletteColor('orange', 'Orange', '#ff8c32'),
  paletteColor('amber', 'Amber', '#ef6c00'),
  paletteColor('tangerine', 'Tangerine', '#fb8c00'),
  paletteColor('yellow', 'Yellow', '#f0c83c'),
  paletteColor('gold', 'Gold', '#fdd835'),
  paletteColor('lemon', 'Lemon', '#fff176'),
  paletteColor('canary', 'Canary', '#ffee58'),
  paletteColor('mustard', 'Mustard', '#f9a825'),
  paletteColor('honey', 'Honey', '#ffb300'),
  // Greens
  paletteColor('forest', 'Forest', '#1b5e20'),
  paletteColor('green', 'Green', '#388e58'),
  paletteColor('emerald', 'Emerald', '#43a047'),
  paletteColor('lime', 'Lime', '#a0d23c'),
  paletteColor('jade', 'Jade', '#2e7d32'),
  paletteColor('olive', 'Olive', '#689f38'),
  paletteColor('sage', 'Sage', '#7cb342'),
  paletteColor('chartreuse', 'Chartreuse', '#c0ca33'),
  paletteColor('pea', 'Pea Green', '#558b2f'),
  // Blues & cyans
  paletteColor('navy', 'Navy', '#0d47a1'),
  paletteColor('blue', 'Blue', '#4285f4'),
  paletteColor('cyan', 'Cyan', '#32bed2'),
  paletteColor('aqua', 'Aqua', '#00acc1'),
  paletteColor('indigo', 'Indigo', '#3949ab'),
  // Purples & coral
  paletteColor('grape', 'Grape', '#6a1b9a'),
  paletteColor('purple', 'Purple', '#9c5adc'),
  paletteColor('lavender', 'Lavender', '#ab47bc'),
  paletteColor('plum', 'Plum', '#5e35b1'),
  paletteColor('coral', 'Coral', '#ff6e5a'),
  paletteColor('magenta', 'Magenta', '#c2185b'),
  paletteColor('white', 'White', '#f0f0f0'),
  {
    id: 'transparent',
    label: 'Transparent',
    swatch: 'transparent',
    color: 'rgba(0, 0, 0, 0)',
    preset: 'transparent',
  },
]

export const OVERLAY_TINT_COLORS: Record<OverlayTintPreset, string> = {
  custom: 'rgba(128, 128, 128, 0.35)',
  red: 'rgba(220, 80, 100, 0.35)',
  green: 'rgba(56, 142, 88, 0.35)',
  yellow: 'rgba(240, 200, 60, 0.35)',
  transparent: 'rgba(0, 0, 0, 0)',
  blue: 'rgba(66, 133, 244, 0.35)',
  orange: 'rgba(255, 140, 50, 0.35)',
  pink: 'rgba(236, 90, 150, 0.35)',
  purple: 'rgba(156, 90, 220, 0.35)',
  cyan: 'rgba(50, 190, 210, 0.35)',
  lime: 'rgba(160, 210, 60, 0.35)',
  coral: 'rgba(255, 110, 90, 0.35)',
  white: 'rgba(255, 255, 255, 0.35)',
}

export const OVERLAY_TINT_SWATCHES: Record<OverlayTintPreset, string> = {
  custom: '#808080',
  red: '#dc5064',
  green: '#388e58',
  yellow: '#f0c83c',
  transparent: 'transparent',
  blue: '#4285f4',
  orange: '#ff8c32',
  pink: '#ec5a96',
  purple: '#9c5adc',
  cyan: '#32bed2',
  lime: '#a0d23c',
  coral: '#ff6e5a',
  white: '#f0f0f0',
}

export const OVERLAY_TINT_LABELS: Record<OverlayTintPreset, string> = {
  custom: 'Custom',
  red: 'Red',
  green: 'Green',
  yellow: 'Yellow',
  transparent: 'Transparent',
  blue: 'Blue',
  orange: 'Orange',
  pink: 'Pink',
  purple: 'Purple',
  cyan: 'Cyan',
  lime: 'Lime',
  coral: 'Coral',
  white: 'White',
}

export function isTransparentOverlayTint(preset: OverlayTintPreset): boolean {
  return preset === 'transparent'
}

export function applyOverlayTintOpacity(color: string, opacity: number): string {
  const rgbaMatch = color.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)/i,
  )
  if (rgbaMatch) {
    return `rgba(${rgbaMatch[1]}, ${rgbaMatch[2]}, ${rgbaMatch[3]}, ${opacity})`
  }

  const hex = color.replace('#', '')
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${opacity})`
  }

  return color
}

export function clampOverlayTintOpacity(opacity: number): number {
  return Math.max(MIN_OVERLAY_TINT_OPACITY, Math.min(MAX_OVERLAY_TINT_OPACITY, opacity))
}

export function getOverlayTintPresetFromFilename(
  filename: string,
): OverlayTintPreset | null {
  const lower = filename.toLowerCase()
  if (lower.includes('before')) return 'red'
  if (lower.includes('after')) return 'green'
  return null
}

export function getOverlayTintSettingsForPreset(preset: OverlayTintPreset) {
  return {
    overlayTintPreset: preset,
    overlayTintColor: OVERLAY_TINT_COLORS[preset],
  }
}

export function getOverlayTintSettingsForUpload(filename: string) {
  return getOverlayTintSettingsForPreset(
    getOverlayTintPresetFromFilename(filename) ?? 'red',
  )
}

export function getOverlayColorLabel(
  preset: OverlayTintPreset,
  tintColor: string,
): string {
  if (preset === 'transparent') return 'Transparent'
  const match = OVERLAY_COLOR_PALETTE.find((option) => option.color === tintColor)
  if (match) return match.label
  if (preset !== 'custom') return OVERLAY_TINT_LABELS[preset]
  return 'Custom'
}

export function getOverlaySwatchStyle(
  preset: OverlayTintPreset,
  tintColor: string,
): { backgroundColor?: string; backgroundImage?: string; backgroundSize?: string; backgroundPosition?: string } {
  if (preset === 'transparent' || tintColor === 'rgba(0, 0, 0, 0)') {
    return {
      backgroundImage:
        'linear-gradient(45deg, #4b4b57 25%, transparent 25%), linear-gradient(-45deg, #4b4b57 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #4b4b57 75%), linear-gradient(-45deg, transparent 75%, #4b4b57 75%)',
      backgroundSize: '8px 8px',
      backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0',
      backgroundColor: '#2a2a34',
    }
  }

  const match = OVERLAY_COLOR_PALETTE.find((option) => option.color === tintColor)
  return { backgroundColor: match?.swatch ?? tintColor }
}

export function applyOverlayColorOption(option: OverlayColorOption) {
  if (option.preset === 'transparent') {
    return getOverlayTintSettingsForPreset('transparent')
  }
  return {
    overlayTintPreset: 'custom' as const,
    overlayTintColor: option.color,
  }
}

export function isPaletteColorSelected(
  option: OverlayColorOption,
  preset: OverlayTintPreset,
  tintColor: string,
): boolean {
  if (option.preset === 'transparent') return preset === 'transparent'
  return option.color === tintColor
}
