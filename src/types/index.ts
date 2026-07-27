export type MarkerRect = {
  x: number
  y: number
  w: number
  h: number
}

export type OverlayType = 'marker' | 'crop'

export type MagnifierOverlay = {
  id: string
  label: string
  type: OverlayType
  rect: MarkerRect
  userScale: number
  offsetX: number
  offsetY: number
}

/** Copied crop/marker zone (no id) for pasting onto another page. */
export type OverlayClipboard = {
  type: OverlayType
  rect: MarkerRect
  userScale: number
  offsetX: number
  offsetY: number
}

export type MarkerDetectionSettings = {
  /** Green marker hue range (degrees). */
  hueMin: number
  hueMax: number
  /** Blue marker hue range (degrees). */
  blueHueMin: number
  blueHueMax: number
  satMin: number
  lightMin: number
  lightMax: number
  minMarkerArea: number
  markerInset: number
}

export type OverlayTintPreset =
  | 'custom'
  | 'red'
  | 'green'
  | 'yellow'
  | 'transparent'
  | 'blue'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'cyan'
  | 'lime'
  | 'coral'
  | 'white'

export type AppSettings = {
  backgroundWidth: number
  backgroundHeight: number
  contentWidth: number
  contentHeight: number
  defaultZoomFactor: number
  blurAmount: number
  overlayBorderWidth: number
  overlayTintPreset: OverlayTintPreset
  overlayTintColor: string
  overlayTintOpacity: number
  overlayContrast: number
  overlaySharpness: number
  backgroundColor: string
  useSolidBackground: boolean
  backgroundImageDataUrl: string | null
  markerDetection: MarkerDetectionSettings
}

export type RenderPageOptions = {
  /** Omit user background; content is composited on transparency (use PNG). */
  skipBackground?: boolean
  /** Checkerboard behind content when skipping background (UI previews only). */
  showPlaceholderBackground?: boolean
  /** Visible document region; magnifier overlays still use the full source image. */
  documentCropRect?: MarkerRect | null
  /** Draw document content only (no magnifier overlays). */
  omitOverlays?: boolean
  /** Draw magnifier overlays only on transparency (no document). */
  overlaysOnly?: boolean
}

export type Page = {
  id: string
  name: string
  sourceImageDataUrl: string
  overlays: MagnifierOverlay[]
  settings: AppSettings
  thumbnailDataUrl: string
  createdAt: number
  documentCropRect?: MarkerRect | null
  isCollage?: boolean
  collagePanelPageIds?: string[]
  collageRenderOptions?: CollageRenderOptions
}

export type CollageLayout = 'horizontal-2'

export type CollageRenderOptions = {
  titles: string[]
  showTitles?: boolean
  imageScales?: number[]
  skipBackground?: boolean
  showPlaceholderBackground?: boolean
}

export type EditorState = {
  sourceImageDataUrl: string | null
  sourceImageName: string
  /** When set, Save updates this page instead of creating a new one. */
  activePageId: string | null
  overlays: MagnifierOverlay[]
  /** Selected marker/crop shown highlighted in the left panel. */
  selectedOverlayId: string | null
  documentCropRect: MarkerRect | null
  isDetecting: boolean
  detectionError: string | null
  isCropMode: boolean
  isDocumentCropMode: boolean
}

export type TabId = 'editor' | 'gallery' | 'collage' | 'export' | 'settings'
