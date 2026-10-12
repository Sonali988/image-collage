import type { AppSettings } from '../types'
import { getContentPlacement } from './canvasRenderer'

export type VideoContentBox = {
  left: number
  top: number
  width: number
  height: number
}

/** Pixel box where the video is drawn (contain-fit inside the content area). */
export function getVideoContentBox(
  videoWidth: number,
  videoHeight: number,
  settings: AppSettings,
): VideoContentBox {
  const placement = getContentPlacement(videoWidth, videoHeight, settings, 1, null)
  return {
    left: placement.drawX,
    top: placement.drawY,
    width: placement.drawW,
    height: placement.drawH,
  }
}
