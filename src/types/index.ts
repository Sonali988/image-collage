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

export type MarkerDetectionSettings = {
  hueMin: number
  hueMax: number
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
}

export type Page = {
  id: string
  name: string
  sourceImageDataUrl: string
  overlays: MagnifierOverlay[]
  settings: AppSettings
  thumbnailDataUrl: string
  createdAt: number
  isCollage?: boolean
  collagePanelPageIds?: string[]
  collageRenderOptions?: CollageRenderOptions
}

export type CollageLayout = 'horizontal-2'

export type CollageRenderOptions = {
  titles: string[]
  showTitles?: boolean
  showCenterDivider?: boolean
  imageScales?: number[]
  skipBackground?: boolean
  showPlaceholderBackground?: boolean
}

export type EditorState = {
  sourceImageDataUrl: string | null
  sourceImageName: string
  overlays: MagnifierOverlay[]
  isDetecting: boolean
  detectionError: string | null
  isCropMode: boolean
}

export type TabId = 'editor' | 'gallery' | 'collage' | 'export' | 'settings'
