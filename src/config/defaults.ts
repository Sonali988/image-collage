import type { AppSettings } from '../types'
import { DEFAULT_OVERLAY_TINT_OPACITY, OVERLAY_TINT_COLORS } from './overlayTintColors'

export const DEFAULTS: AppSettings = {
  backgroundWidth: 1960,
  backgroundHeight: 1080,
  contentWidth: 900,
  contentHeight: 1080,
  defaultZoomFactor: 1.25,
  blurAmount: 3,
  overlayBorderWidth: 2,
  overlayTintPreset: 'red',
  overlayTintColor: OVERLAY_TINT_COLORS.red,
  overlayTintOpacity: DEFAULT_OVERLAY_TINT_OPACITY,
  overlayContrast: 1,
  overlaySharpness: 0,
  backgroundColor: '#2d1b4e',
  useSolidBackground: true,
  backgroundImageDataUrl: null,
  markerDetection: {
    hueMin: 80,
    hueMax: 160,
    blueHueMin: 185,
    blueHueMax: 255,
    satMin: 0.3,
    lightMin: 0.2,
    lightMax: 0.9,
    minMarkerArea: 200,
    markerInset: 6,
  },
}

/** Keep canvas/export size locked to the fixed defaults. */
export function withExportCanvasSize(settings: AppSettings): AppSettings {
  return {
    ...settings,
    backgroundWidth: DEFAULTS.backgroundWidth,
    backgroundHeight: DEFAULTS.backgroundHeight,
    contentWidth: DEFAULTS.contentWidth,
    contentHeight: DEFAULTS.contentHeight,
  }
}
