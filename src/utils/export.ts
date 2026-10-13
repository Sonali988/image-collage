import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import type { AppSettings, Page } from '../types'
import {
  mergeBackgroundSettings,
  renderCollageFromPages,
  renderPageToDataUrl,
} from './canvasRenderer'
import { isVideoPage } from './pageKind'
import { captureVideoPageThumbnail } from './videoPoster'
import { pauseEditorPreviewVideo } from './editorVideoPlayback'
import { compositedVideoExportFilename, exportCompositedVideoBlob } from './videoExport'
import { getVideoBlob } from './videoBlobStorage'

function getReportsZipFilename(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `reports-${year}-${month}-${day}.zip`
}

async function getVideoExportBlob(
  page: Page,
  globalSettings: AppSettings,
): Promise<Blob | null> {
  const composited = await exportCompositedVideoBlob(page, globalSettings)
  if (composited) return composited
  if (!page.sourceVideoId) return null
  return getVideoBlob(page.sourceVideoId)
}

async function renderVideoPageForExport(
  page: Page,
  globalSettings: AppSettings,
): Promise<string> {
  const fallback = page.thumbnailDataUrl
  const videoId = page.sourceVideoId
  if (!videoId) return fallback

  const blob = await getVideoBlob(videoId)
  if (!blob) return fallback

  const objectUrl = URL.createObjectURL(blob)
  try {
    const merged = mergeBackgroundSettings(page.settings, globalSettings)
    return await captureVideoPageThumbnail(merged, objectUrl)
  } catch {
    return fallback
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}

export async function renderPageForExport(page: Page, globalSettings: AppSettings, allPages: Page[]) {
  if (isVideoPage(page)) {
    return renderVideoPageForExport(page, globalSettings)
  }

  if (page.isCollage && page.collagePanelPageIds?.length) {
    const panelPages = page.collagePanelPageIds
      .map((id) => allPages.find((item) => item.id === id && !item.isCollage))
      .filter((item): item is Page => Boolean(item))

    if (panelPages.length >= page.collagePanelPageIds.length) {
      return renderCollageFromPages(
        panelPages,
        globalSettings,
        page.collageRenderOptions ?? { titles: [] },
      )
    }
  }

  if (page.isCollage) {
    return page.thumbnailDataUrl
  }

  return renderPageToDataUrl(
    mergeBackgroundSettings(page.settings, globalSettings),
    page.sourceImageDataUrl,
    page.overlays,
    'image/png',
    undefined,
    { documentCropRect: page.documentCropRect ?? null, documentScale: page.documentScale ?? 1 },
  )
}

export async function downloadPagePng(
  page: Page,
  globalSettings: AppSettings,
  allPages: Page[] = [],
  filename?: string,
) {
  if (isVideoPage(page)) {
    pauseEditorPreviewVideo()
    const blob = await getVideoExportBlob(page, globalSettings)
    if (blob) {
      const name =
        filename ??
        (blob.type.includes('webm')
          ? compositedVideoExportFilename(page.name)
          : page.name.replace(/\.[^.]+$/, '') + '.mp4')
      saveAs(blob, name)
      return
    }
  }

  const dataUrl = await renderPageForExport(page, globalSettings, allPages)
  const response = await fetch(dataUrl)
  const blob = await response.blob()
  saveAs(blob, filename ?? `${page.name}.png`)
}

export async function downloadSelectedPagesAsPngs(
  pages: Page[],
  selectedIds: string[],
  globalSettings: AppSettings,
) {
  const selected = pages.filter((page) => selectedIds.includes(page.id))
  for (const page of selected) {
    await downloadPagePng(page, globalSettings, pages)
  }
}

export async function downloadSelectedPagesAsZip(
  pages: Page[],
  selectedIds: string[],
  globalSettings: AppSettings,
  zipName?: string,
) {
  const selected = pages.filter((page) => selectedIds.includes(page.id))
  if (selected.length === 0) return

  pauseEditorPreviewVideo()

  const zip = new JSZip()

  for (const page of selected) {
    if (isVideoPage(page)) {
      const blob = await getVideoExportBlob(page, globalSettings)
      if (blob) {
        const zipName = blob.type.includes('webm')
          ? compositedVideoExportFilename(page.name)
          : page.name.replace(/\.[^.]+$/, '') || 'video'
        zip.file(zipName, blob)
      }
      continue
    }

    const dataUrl = await renderPageForExport(page, globalSettings, pages)
    const response = await fetch(dataUrl)
    const blob = await response.blob()
    zip.file(`${page.name}.png`, blob)
  }

  const content = await zip.generateAsync({ type: 'blob' })
  saveAs(content, zipName ?? getReportsZipFilename())
}
