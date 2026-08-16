import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULTS, withExportCanvasSize } from '../config/defaults'
import { OVERLAY_TINT_COLORS } from '../config/overlayTintColors'
import type {
  AppSettings,
  CollageLayout,
  CollageRenderOptions,
  OverlayClipboard,
  EditorState,
  MagnifierOverlay,
  MarkerRect,
  Page,
  TabId,
} from '../types'
import { detectGreenMarkers } from '../utils/markerDetector'
import { createId, loadImage, readFileAsDataUrl, rotateImageDataUrl } from '../utils/imageLoader'
import { renderCollageFromPages, renderPageToDataUrl } from '../utils/canvasRenderer'
import { idbStorage } from '../utils/idbStorage'
import {
  buildCollageTitles,
  MAX_COLLAGE_PANELS,
  MIN_COLLAGE_PANELS,
} from '../config/collage'
import { getOverlayTintSettingsForUpload } from '../config/overlayTintColors'

const LEGACY_BACKGROUND_COLORS = new Set(['#c62828', '#2e7d32', '#f9a825'])

function normalizeSettings(settings: AppSettings): AppSettings {
  const normalized: AppSettings = {
    ...DEFAULTS,
    ...settings,
    markerDetection: {
      ...DEFAULTS.markerDetection,
      ...settings.markerDetection,
    },
  }

  if (LEGACY_BACKGROUND_COLORS.has(normalized.backgroundColor.toLowerCase())) {
    normalized.backgroundColor = DEFAULTS.backgroundColor
  }

  // Always keep the fixed export canvas size (preview CSS size must never leak in).
  normalized.backgroundWidth = DEFAULTS.backgroundWidth
  normalized.backgroundHeight = DEFAULTS.backgroundHeight
  normalized.contentWidth = DEFAULTS.contentWidth
  normalized.contentHeight = DEFAULTS.contentHeight

  if (!normalized.overlayTintPreset) {
    normalized.overlayTintPreset = DEFAULTS.overlayTintPreset
  }

  if (!OVERLAY_TINT_COLORS[normalized.overlayTintPreset]) {
    normalized.overlayTintPreset = DEFAULTS.overlayTintPreset
  }

  if (
    normalized.overlayTintOpacity === undefined ||
    Number.isNaN(normalized.overlayTintOpacity)
  ) {
    normalized.overlayTintOpacity = DEFAULTS.overlayTintOpacity
  } else {
    normalized.overlayTintOpacity = Math.max(
      0.05,
      Math.min(1, normalized.overlayTintOpacity),
    )
  }

  if (
    normalized.overlayContrast === undefined ||
    Number.isNaN(normalized.overlayContrast)
  ) {
    normalized.overlayContrast = DEFAULTS.overlayContrast
  } else {
    normalized.overlayContrast = Math.max(0.5, Math.min(2, normalized.overlayContrast))
  }

  if (
    normalized.overlaySharpness === undefined ||
    Number.isNaN(normalized.overlaySharpness)
  ) {
    normalized.overlaySharpness = DEFAULTS.overlaySharpness
  } else {
    normalized.overlaySharpness = Math.max(0, Math.min(2, normalized.overlaySharpness))
  }

  if (
    normalized.blurAmount === undefined ||
    normalized.blurAmount === null ||
    Number.isNaN(Number(normalized.blurAmount))
  ) {
    normalized.blurAmount = DEFAULTS.blurAmount
  } else {
    normalized.blurAmount = Math.max(0, Math.min(20, Number(normalized.blurAmount)))
  }

  if (!normalized.overlayTintColor) {
    normalized.overlayTintColor = OVERLAY_TINT_COLORS[normalized.overlayTintPreset]
  } else if (
    normalized.overlayTintPreset !== 'custom' &&
    normalized.overlayTintPreset !== 'transparent'
  ) {
    normalized.overlayTintColor = OVERLAY_TINT_COLORS[normalized.overlayTintPreset]
  }

  return normalized
}

function normalizeOverlay(overlay: Page['overlays'][number]) {
  return {
    ...overlay,
    type: overlay.type ?? 'marker',
    userScale: overlay.userScale ?? 1,
    offsetX: overlay.offsetX ?? 0,
    offsetY: overlay.offsetY ?? 0,
  }
}

function nextCropLabel(overlays: MagnifierOverlay[]): string {
  const cropCount = overlays.filter((overlay) => overlay.type === 'crop').length
  return `Crop ${cropCount + 1}`
}

function nextMarkerLabel(overlays: MagnifierOverlay[]): string {
  const markerCount = overlays.filter((overlay) => overlay.type === 'marker').length
  return `Marker ${markerCount + 1}`
}

function nextOverlayLabel(overlays: MagnifierOverlay[], type: MagnifierOverlay['type']): string {
  return type === 'crop' ? nextCropLabel(overlays) : nextMarkerLabel(overlays)
}

function nextPastedPageName(baseName: string, pages: Page[]): string {
  const root = baseName.trim() || 'Page'
  const existing = new Set(pages.filter((page) => !page.isCollage).map((page) => page.name))
  if (!existing.has(root)) return root

  let index = 2
  while (existing.has(`${root} (${index})`)) index += 1
  return `${root} (${index})`
}

/** Map a normalized rect when the source image is rotated. */
function rotateNormalizedRect(rect: MarkerRect, degrees: 90 | -90 | 180): MarkerRect {
  if (degrees === 90) {
    return {
      x: 1 - rect.y - rect.h,
      y: rect.x,
      w: rect.h,
      h: rect.w,
    }
  }
  if (degrees === -90) {
    return {
      x: rect.y,
      y: 1 - rect.x - rect.w,
      w: rect.h,
      h: rect.w,
    }
  }
  return {
    x: 1 - rect.x - rect.w,
    y: 1 - rect.y - rect.h,
    w: rect.w,
    h: rect.h,
  }
}

function normalizePage(page: Page): Page {
  return {
    ...page,
    overlays: page.overlays.map(normalizeOverlay),
    settings: normalizeSettings(page.settings),
  }
}

function normalizePersistedState(state: {
  settings?: AppSettings
  pages?: Page[]
}) {
  return {
    ...state,
    settings: state.settings ? normalizeSettings(state.settings) : DEFAULTS,
    pages: (state.pages ?? []).map(normalizePage),
  }
}

type AppState = {
  activeTab: TabId
  settings: AppSettings
  editor: EditorState
  pages: Page[]
  overlayClipboard: OverlayClipboard | null
  collageSelectedIds: string[]
  collageLayout: CollageLayout
  collageTitles: string[]
  collageShowTitles: boolean
  collageImageScales: number[]
  setActiveTab: (tab: TabId) => void
  updateSettings: (partial: Partial<AppSettings>) => void
  uploadSourceImage: (file: File) => Promise<void>
  rotateSourceImage: (degrees: 90 | -90 | 180) => Promise<void>
  uploadBackgroundImage: (file: File) => Promise<void>
  clearBackgroundImage: () => void
  redetectMarkers: () => Promise<void>
  setCropMode: (enabled: boolean) => void
  setDocumentCropMode: (enabled: boolean) => void
  cropDocument: (rect: MarkerRect) => void
  clearDocumentCrop: () => void
  addCropOverlay: (rect: MarkerRect) => void
  updateOverlayRect: (id: string, rect: MarkerRect) => void
  updateOverlayScale: (id: string, userScale: number) => void
  updateOverlayOffset: (id: string, offsetX: number, offsetY: number) => void
  removeOverlay: (id: string) => void
  setSelectedOverlayId: (id: string | null) => void
  copySelectedOverlay: () => boolean
  pasteCopiedOverlay: () => Promise<boolean>
  clearOverlayClipboard: () => void
  resetOverlayAdjustments: () => void
  saveCurrentPage: (name?: string, options?: { asNew?: boolean }) => Promise<void>
  deletePage: (id: string) => void
  renamePage: (id: string, name: string) => void
  loadPageIntoEditor: (id: string) => void
  loadCollageIntoBuilder: (id: string) => void
  toggleCollageSelection: (id: string) => void
  setCollageTitle: (index: number, title: string) => void
  setCollageShowTitles: (show: boolean) => void
  setCollageImageScale: (index: number, scale: number) => void
  saveCollage: (name?: string) => Promise<void>
}

const initialEditor: EditorState = {
  sourceImageDataUrl: null,
  sourceImageName: '',
  activePageId: null,
  overlays: [],
  selectedOverlayId: null,
  documentCropRect: null,
  isDetecting: false,
  detectionError: null,
  isCropMode: false,
  isDocumentCropMode: false,
}

function runMarkerDetection(
  image: HTMLImageElement,
  settings: AppSettings,
): Promise<MagnifierOverlay[]> {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      try {
        resolve(detectGreenMarkers(image, settings.markerDetection))
      } catch (error) {
        reject(error)
      }
    }, 0)
  })
}

function syncCollageTitlesFromSelection(
  collageSelectedIds: string[],
  pages: Page[],
): string[] {
  const names = collageSelectedIds
    .map((id) => pages.find((page) => page.id === id)?.name)
    .filter((name): name is string => Boolean(name))

  const titles = buildCollageTitles(names)
  return [titles[0] ?? 'BEFORE', titles[1] ?? 'AFTER', titles[2] ?? '']
}

function getCollageRenderOptions(
  collageTitles: string[],
  imageCount: number,
  collageShowTitles: boolean,
  collageImageScales: number[],
): CollageRenderOptions {
  return {
    titles: collageTitles.slice(0, imageCount),
    showTitles: collageShowTitles,
    imageScales: collageImageScales.slice(0, imageCount),
  }
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      activeTab: 'editor',
      settings: DEFAULTS,
      editor: initialEditor,
      pages: [],
      overlayClipboard: null,
      collageSelectedIds: [],
      collageLayout: 'horizontal-2',
      collageTitles: ['BEFORE', 'AFTER', ''],
      collageShowTitles: true,
      collageImageScales: [1, 1, 1],

      setActiveTab: (tab) => set({ activeTab: tab }),

      updateSettings: (partial) =>
        set((state) => ({
          settings: withExportCanvasSize({ ...state.settings, ...partial }),
        })),

      uploadSourceImage: async (file) => {
        const dataUrl = await readFileAsDataUrl(file)
        const tintUpdate = getOverlayTintSettingsForUpload(file.name)

        set((state) => ({
          settings: { ...state.settings, ...tintUpdate },
          editor: {
            ...state.editor,
            sourceImageDataUrl: dataUrl,
            sourceImageName: file.name,
            activePageId: null,
            overlays: [],
            selectedOverlayId: null,
            documentCropRect: null,
            isDetecting: true,
            detectionError: null,
            isCropMode: false,
            isDocumentCropMode: false,
          },
        }))

        try {
          const image = await loadImage(dataUrl)
          const overlays = await runMarkerDetection(image, get().settings)

          set((state) => ({
            editor: {
              ...state.editor,
              overlays,
              isDetecting: false,
              detectionError:
                overlays.length === 0
                  ? 'No green or blue markers found. Adjust marker tolerance in Settings and re-detect.'
                  : null,
            },
          }))
        } catch {
          set((state) => ({
            editor: {
              ...state.editor,
              isDetecting: false,
              detectionError: 'Failed to process the uploaded image.',
            },
          }))
        }
      },

      rotateSourceImage: async (degrees) => {
        const { editor } = get()
        if (!editor.sourceImageDataUrl) return

        set((state) => ({
          editor: {
            ...state.editor,
            isDetecting: true,
            detectionError: null,
            isCropMode: false,
            isDocumentCropMode: false,
            selectedOverlayId: null,
          },
        }))

        try {
          const rotatedDataUrl = await rotateImageDataUrl(editor.sourceImageDataUrl, degrees)
          const manualCrops = editor.overlays
            .filter((overlay) => overlay.type === 'crop')
            .map((overlay) => ({
              ...overlay,
              rect: rotateNormalizedRect(overlay.rect, degrees),
              offsetX: 0,
              offsetY: 0,
            }))
          const documentCropRect = editor.documentCropRect
            ? rotateNormalizedRect(editor.documentCropRect, degrees)
            : null

          set((state) => ({
            editor: {
              ...state.editor,
              sourceImageDataUrl: rotatedDataUrl,
              overlays: manualCrops,
              documentCropRect,
            },
          }))

          const image = await loadImage(rotatedDataUrl)
          const detected = await runMarkerDetection(image, get().settings)
          const overlays = [...detected, ...manualCrops]

          set((state) => ({
            editor: {
              ...state.editor,
              overlays,
              isDetecting: false,
              detectionError:
                detected.length === 0 && manualCrops.length === 0
                  ? 'No green or blue markers found. Adjust marker tolerance in Settings and re-detect.'
                  : null,
            },
          }))
        } catch {
          set((state) => ({
            editor: {
              ...state.editor,
              isDetecting: false,
              detectionError: 'Failed to rotate the document.',
            },
          }))
        }
      },

      uploadBackgroundImage: async (file) => {
        const dataUrl = await readFileAsDataUrl(file)
        set((state) => ({
          settings: {
            ...state.settings,
            backgroundImageDataUrl: dataUrl,
            useSolidBackground: false,
          },
        }))
      },

      clearBackgroundImage: () =>
        set((state) => ({
          settings: {
            ...state.settings,
            backgroundImageDataUrl: null,
            useSolidBackground: true,
          },
        })),

      redetectMarkers: async () => {
        const { editor, settings } = get()
        if (!editor.sourceImageDataUrl) return

        const manualCrops = editor.overlays.filter((overlay) => overlay.type === 'crop')

        set((state) => ({
          editor: { ...state.editor, isDetecting: true, detectionError: null },
        }))

        try {
          const image = await loadImage(editor.sourceImageDataUrl)
          const detected = await runMarkerDetection(image, settings)
          const overlays = [...detected, ...manualCrops]
          set((state) => ({
            editor: {
              ...state.editor,
              overlays,
              isDetecting: false,
              detectionError:
                detected.length === 0 && manualCrops.length === 0
                  ? 'No green or blue markers found. Adjust marker tolerance in Settings and re-detect.'
                  : null,
            },
          }))
        } catch {
          set((state) => ({
            editor: {
              ...state.editor,
              isDetecting: false,
              detectionError: 'Failed to detect markers.',
            },
          }))
        }
      },

      setCropMode: (enabled) =>
        set((state) => ({
          editor: {
            ...state.editor,
            isCropMode: enabled,
            isDocumentCropMode: enabled ? false : state.editor.isDocumentCropMode,
          },
        })),

      setDocumentCropMode: (enabled) =>
        set((state) => ({
          editor: {
            ...state.editor,
            isDocumentCropMode: enabled,
            isCropMode: enabled ? false : state.editor.isCropMode,
          },
        })),

      cropDocument: (rect) => {
        set((state) => ({
          editor: {
            ...state.editor,
            documentCropRect: rect,
            isDocumentCropMode: false,
          },
        }))
      },

      clearDocumentCrop: () =>
        set((state) => ({
          editor: { ...state.editor, documentCropRect: null },
        })),

      addCropOverlay: (rect) =>
        set((state) => {
          const label = nextCropLabel(state.editor.overlays)
          const overlay: MagnifierOverlay = {
            id: createId(),
            label,
            type: 'crop',
            rect,
            userScale: 1,
            offsetX: 0,
            offsetY: 0,
          }
          return {
            editor: {
              ...state.editor,
              overlays: [...state.editor.overlays, overlay],
              selectedOverlayId: overlay.id,
              isCropMode: false,
            },
          }
        }),

      updateOverlayRect: (id, rect) =>
        set((state) => ({
          editor: {
            ...state.editor,
            overlays: state.editor.overlays.map((overlay) =>
              overlay.id === id ? { ...overlay, rect } : overlay,
            ),
          },
        })),

      updateOverlayScale: (id, userScale) =>
        set((state) => ({
          editor: {
            ...state.editor,
            overlays: state.editor.overlays.map((overlay) =>
              overlay.id === id ? { ...overlay, userScale } : overlay,
            ),
          },
        })),

      updateOverlayOffset: (id, offsetX, offsetY) =>
        set((state) => ({
          editor: {
            ...state.editor,
            overlays: state.editor.overlays.map((overlay) =>
              overlay.id === id ? { ...overlay, offsetX, offsetY } : overlay,
            ),
          },
        })),

      removeOverlay: (id) =>
        set((state) => ({
          editor: {
            ...state.editor,
            overlays: state.editor.overlays.filter((overlay) => overlay.id !== id),
            selectedOverlayId:
              state.editor.selectedOverlayId === id
                ? null
                : state.editor.selectedOverlayId,
          },
        })),

      setSelectedOverlayId: (id) =>
        set((state) => ({
          editor: { ...state.editor, selectedOverlayId: id },
        })),

      copySelectedOverlay: () => {
        const { editor } = get()
        const selected = editor.overlays.find(
          (overlay) => overlay.id === editor.selectedOverlayId,
        )
        if (!selected) return false

        set({
          overlayClipboard: {
            type: selected.type,
            rect: { ...selected.rect },
            userScale: selected.userScale,
            offsetX: selected.offsetX ?? 0,
            offsetY: selected.offsetY ?? 0,
          },
        })
        return true
      },

      pasteCopiedOverlay: async () => {
        const { editor, overlayClipboard } = get()
        if (!overlayClipboard || !editor.sourceImageDataUrl) return false

        const overlay: MagnifierOverlay = {
          id: createId(),
          label: nextOverlayLabel(editor.overlays, overlayClipboard.type),
          type: overlayClipboard.type,
          rect: { ...overlayClipboard.rect },
          userScale: overlayClipboard.userScale,
          offsetX: overlayClipboard.offsetX,
          offsetY: overlayClipboard.offsetY,
        }

        const nextOverlays = [...editor.overlays, overlay]
        set((state) => ({
          editor: {
            ...state.editor,
            overlays: nextOverlays,
            selectedOverlayId: overlay.id,
          },
        }))

        // Always save as a new page so the source page is not overwritten.
        const baseName =
          editor.sourceImageName.replace(/\.[^.]+$/, '') ||
          editor.sourceImageName ||
          'Page'
        await get().saveCurrentPage(nextPastedPageName(baseName, get().pages), {
          asNew: true,
        })
        return true
      },

      clearOverlayClipboard: () => set({ overlayClipboard: null }),

      resetOverlayAdjustments: () =>
        set((state) => ({
          editor: {
            ...state.editor,
            overlays: state.editor.overlays.map((overlay) => ({
              ...overlay,
              userScale: 1,
              offsetX: 0,
              offsetY: 0,
            })),
          },
        })),

      saveCurrentPage: async (name, options) => {
        const { editor, settings, pages } = get()
        if (!editor.sourceImageDataUrl) return

        const thumbnailDataUrl = await renderPageToDataUrl(
          settings,
          editor.sourceImageDataUrl,
          editor.overlays,
          'image/png',
          undefined,
          {
            skipBackground: true,
            showPlaceholderBackground: true,
            documentCropRect: editor.documentCropRect,
          },
        )

        const existing =
          !options?.asNew && editor.activePageId != null
            ? pages.find(
                (page) => page.id === editor.activePageId && !page.isCollage,
              )
            : undefined

        if (existing) {
          const updated: Page = {
            ...existing,
            name:
              name ??
              existing.name ??
              (editor.sourceImageName.replace(/\.[^.]+$/, '') || existing.name),
            sourceImageDataUrl: editor.sourceImageDataUrl,
            overlays: editor.overlays,
            settings: { ...settings },
            documentCropRect: editor.documentCropRect,
            thumbnailDataUrl,
          }

          set((state) => ({
            pages: state.pages.map((page) =>
              page.id === existing.id ? updated : page,
            ),
            editor: {
              ...state.editor,
              sourceImageName: updated.name,
              activePageId: existing.id,
            },
          }))
          return
        }

        const page: Page = {
          id: createId(),
          name:
            name ??
            (editor.sourceImageName.replace(/\.[^.]+$/, '') ||
              `Page ${get().pages.length + 1}`),
          sourceImageDataUrl: editor.sourceImageDataUrl,
          overlays: editor.overlays,
          settings: { ...settings },
          documentCropRect: editor.documentCropRect,
          thumbnailDataUrl,
          createdAt: Date.now(),
        }

        set((state) => ({
          pages: [page, ...state.pages],
          editor: { ...state.editor, activePageId: page.id, sourceImageName: page.name },
        }))
      },

      deletePage: (id) =>
        set((state) => ({
          pages: state.pages.filter((page) => page.id !== id),
          collageSelectedIds: state.collageSelectedIds.filter((pageId) => pageId !== id),
          editor:
            state.editor.activePageId === id
              ? { ...state.editor, activePageId: null }
              : state.editor,
        })),

      renamePage: (id, name) => {
        const trimmed = name.trim()
        if (!trimmed) return

        const page = get().pages.find((item) => item.id === id)
        if (!page) return

        set((state) => {
          const isActiveDocument =
            !page.isCollage &&
            state.editor.sourceImageDataUrl === page.sourceImageDataUrl &&
            state.editor.sourceImageName === page.name

          return {
            pages: state.pages.map((item) =>
              item.id === id ? { ...item, name: trimmed } : item,
            ),
            editor: isActiveDocument
              ? { ...state.editor, sourceImageName: trimmed }
              : state.editor,
          }
        })
      },

      loadPageIntoEditor: (id) => {
        const page = get().pages.find((item) => item.id === id && !item.isCollage)
        if (!page) return

        const { settings: currentSettings } = get()
        set({
          activeTab: 'editor',
          settings: withExportCanvasSize({
            ...page.settings,
            // Keep current background image / color choices from the session.
            backgroundColor: currentSettings.backgroundColor,
            useSolidBackground: currentSettings.useSolidBackground,
            backgroundImageDataUrl: currentSettings.backgroundImageDataUrl,
          }),
          editor: {
            sourceImageDataUrl: page.sourceImageDataUrl,
            sourceImageName: page.name,
            activePageId: page.id,
            overlays: page.overlays.map(normalizeOverlay),
            selectedOverlayId: null,
            documentCropRect: page.documentCropRect ?? null,
            isDetecting: false,
            detectionError: null,
            isCropMode: false,
            isDocumentCropMode: false,
          },
        })
      },

      loadCollageIntoBuilder: (id) => {
        const page = get().pages.find((item) => item.id === id && item.isCollage)
        if (!page?.collagePanelPageIds) return

        const panelIds = page.collagePanelPageIds.filter((panelId) =>
          get().pages.some((item) => item.id === panelId && !item.isCollage),
        )
        if (panelIds.length < MIN_COLLAGE_PANELS) return

        const options = page.collageRenderOptions ?? { titles: [] }
        const titles = options.titles ?? []
        const imageScales = options.imageScales ?? [1, 1, 1]

        set({
          activeTab: 'collage',
          collageSelectedIds: panelIds,
          collageTitles: [titles[0] ?? 'BEFORE', titles[1] ?? 'AFTER', titles[2] ?? ''],
          collageShowTitles: options.showTitles ?? true,
          collageImageScales: [
            imageScales[0] ?? 1,
            imageScales[1] ?? 1,
            imageScales[2] ?? 1,
          ],
        })
      },

      toggleCollageSelection: (id) =>
        set((state) => {
          const page = state.pages.find((item) => item.id === id)
          if (!page || page.isCollage) return state

          const maxSelection = MAX_COLLAGE_PANELS
          const exists = state.collageSelectedIds.includes(id)
          const collageSelectedIds = exists
            ? state.collageSelectedIds.filter((pageId) => pageId !== id)
            : state.collageSelectedIds.length >= maxSelection
              ? state.collageSelectedIds
              : [...state.collageSelectedIds, id]

          if (collageSelectedIds === state.collageSelectedIds) return state

          return {
            collageSelectedIds,
            collageTitles: syncCollageTitlesFromSelection(collageSelectedIds, state.pages),
          }
        }),

      setCollageTitle: (index, title) =>
        set((state) => {
          const collageTitles = [...state.collageTitles]
          collageTitles[index] = title
          return { collageTitles }
        }),

      setCollageShowTitles: (show) => set({ collageShowTitles: show }),

      setCollageImageScale: (index, scale) =>
        set((state) => {
          const collageImageScales = [...state.collageImageScales]
          collageImageScales[index] = scale
          return { collageImageScales }
        }),

      saveCollage: async (name) => {
        const {
          collageSelectedIds,
          collageTitles,
          collageShowTitles,
          collageImageScales,
          pages,
          settings,
        } = get()
        if (collageSelectedIds.length < MIN_COLLAGE_PANELS) return

        const selectedPages = collageSelectedIds
          .map((id) => pages.find((page) => page.id === id && !page.isCollage))
          .filter((page): page is Page => Boolean(page))

        if (selectedPages.length < MIN_COLLAGE_PANELS) return

        try {
          const collageOptions = getCollageRenderOptions(
            collageTitles,
            selectedPages.length,
            collageShowTitles,
            collageImageScales,
          )

          const previewDataUrl = await renderCollageFromPages(selectedPages, settings, {
            ...collageOptions,
            skipBackground: true,
            showPlaceholderBackground: true,
          })
          if (!previewDataUrl) return

          const collagePage: Page = {
            id: createId(),
            name: name ?? `Collage ${pages.filter((page) => page.isCollage).length + 1}`,
            sourceImageDataUrl: previewDataUrl,
            overlays: [],
            settings: { ...settings },
            thumbnailDataUrl: previewDataUrl,
            createdAt: Date.now(),
            isCollage: true,
            collagePanelPageIds: selectedPages.map((page) => page.id),
            collageRenderOptions: collageOptions,
          }

          set((state) => ({
            pages: [collagePage, ...state.pages],
            collageSelectedIds: [],
            activeTab: 'gallery',
          }))
        } catch {
          // Rendering failed silently in UI; CollageBuilder shows error via callback if needed
        }
      },
    }),
    {
      name: 'image-collage-app',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        settings: state.settings,
        pages: state.pages,
      }),
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(typeof persistedState === 'object' && persistedState !== null
          ? normalizePersistedState(persistedState as { settings?: AppSettings; pages?: Page[] })
          : {}),
      }),
    },
  ),
)
