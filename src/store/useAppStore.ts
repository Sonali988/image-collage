import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { DEFAULTS } from '../config/defaults'
import { OVERLAY_TINT_COLORS } from '../config/overlayTintColors'
import type {
  AppSettings,
  CollageLayout,
  CollageRenderOptions,
  EditorState,
  MagnifierOverlay,
  MarkerRect,
  Page,
  TabId,
} from '../types'
import { detectGreenMarkers } from '../utils/markerDetector'
import { createId, loadImage, readFileAsDataUrl } from '../utils/imageLoader'
import { renderCollageToDataUrl, renderPageToDataUrl } from '../utils/canvasRenderer'
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
  collageSelectedIds: string[]
  collageLayout: CollageLayout
  collageTitles: string[]
  collageShowTitles: boolean
  collageImageScales: number[]
  setActiveTab: (tab: TabId) => void
  updateSettings: (partial: Partial<AppSettings>) => void
  uploadSourceImage: (file: File) => Promise<void>
  uploadBackgroundImage: (file: File) => Promise<void>
  clearBackgroundImage: () => void
  redetectMarkers: () => Promise<void>
  setCropMode: (enabled: boolean) => void
  addCropOverlay: (rect: MarkerRect) => void
  updateOverlayRect: (id: string, rect: MarkerRect) => void
  updateOverlayScale: (id: string, userScale: number) => void
  updateOverlayOffset: (id: string, offsetX: number, offsetY: number) => void
  removeOverlay: (id: string) => void
  resetOverlayAdjustments: () => void
  saveCurrentPage: (name?: string) => Promise<void>
  deletePage: (id: string) => void
  renameCollage: (id: string, name: string) => void
  loadPageIntoEditor: (id: string) => void
  toggleCollageSelection: (id: string) => void
  setCollageTitle: (index: number, title: string) => void
  setCollageShowTitles: (show: boolean) => void
  setCollageImageScale: (index: number, scale: number) => void
  saveCollage: (name?: string) => Promise<void>
}

const initialEditor: EditorState = {
  sourceImageDataUrl: null,
  sourceImageName: '',
  overlays: [],
  isDetecting: false,
  detectionError: null,
  isCropMode: false,
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
    showCenterDivider: imageCount === 2,
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
      collageSelectedIds: [],
      collageLayout: 'horizontal-2',
      collageTitles: ['BEFORE', 'AFTER', ''],
      collageShowTitles: true,
      collageImageScales: [1, 1, 1],

      setActiveTab: (tab) => set({ activeTab: tab }),

      updateSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
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
            overlays: [],
            isDetecting: true,
            detectionError: null,
            isCropMode: false,
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
                  ? 'No green markers found. Adjust marker tolerance in Settings and re-detect.'
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
                  ? 'No green markers found. Adjust marker tolerance in Settings and re-detect.'
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
          editor: { ...state.editor, isCropMode: enabled },
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
          },
        })),

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

      saveCurrentPage: async (name) => {
        const { editor, settings } = get()
        if (!editor.sourceImageDataUrl) return

        const thumbnailDataUrl = await renderPageToDataUrl(
          settings,
          editor.sourceImageDataUrl,
          editor.overlays,
          'image/jpeg',
          0.82,
        )

        const page: Page = {
          id: createId(),
          name:
            name ??
            (editor.sourceImageName.replace(/\.[^.]+$/, '') ||
              `Page ${get().pages.length + 1}`),
          sourceImageDataUrl: editor.sourceImageDataUrl,
          overlays: editor.overlays,
          settings: { ...settings },
          thumbnailDataUrl,
          createdAt: Date.now(),
        }

        set((state) => ({ pages: [page, ...state.pages] }))
      },

      deletePage: (id) =>
        set((state) => ({
          pages: state.pages.filter((page) => page.id !== id),
          collageSelectedIds: state.collageSelectedIds.filter((pageId) => pageId !== id),
        })),

      renameCollage: (id, name) => {
        const trimmed = name.trim()
        if (!trimmed) return

        set((state) => ({
          pages: state.pages.map((page) =>
            page.id === id && page.isCollage ? { ...page, name: trimmed } : page,
          ),
        }))
      },

      loadPageIntoEditor: (id) => {
        const page = get().pages.find((item) => item.id === id && !item.isCollage)
        if (!page) return

        set({
          activeTab: 'editor',
          settings: { ...page.settings },
          editor: {
            sourceImageDataUrl: page.sourceImageDataUrl,
            sourceImageName: page.name,
            overlays: page.overlays.map(normalizeOverlay),
            isDetecting: false,
            detectionError: null,
            isCropMode: false,
          },
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
          const thumbnails = selectedPages.map((page) => page.thumbnailDataUrl)

          const collageDataUrl = await renderCollageToDataUrl(
            thumbnails,
            settings,
            getCollageRenderOptions(
              collageTitles,
              selectedPages.length,
              collageShowTitles,
              collageImageScales,
            ),
          )
          if (!collageDataUrl) return

          const collagePage: Page = {
            id: createId(),
            name: name ?? `Collage ${pages.filter((page) => page.isCollage).length + 1}`,
            sourceImageDataUrl: collageDataUrl,
            overlays: [],
            settings: { ...settings },
            thumbnailDataUrl: collageDataUrl,
            createdAt: Date.now(),
            isCollage: true,
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
